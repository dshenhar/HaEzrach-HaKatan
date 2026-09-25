"""Reading the news sites: the feeds, the scrapers for the sites without one, and
the Hebrew translation of the Arabic ones.

This is the original worker's scraping, unchanged by the move off Postgres - the
same feed list, the same per-site quirks, the same 15 second timeout that stopped
one slow publisher from eating a whole cycle.
"""
import json as _json
import os
import re
import time
from datetime import datetime, timedelta

import feedparser
import requests
from bs4 import BeautifulSoup

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-3.6-flash"

# Arabic script, including the presentation forms some feeds emit. The site's
# declared language is a hint; THIS is the guarantee - an outlet added without
# language='ar', or a Hebrew outlet quoting an Arabic headline, still gets caught.
ARABIC_BLOCKS = (
    ("\u0600", "\u06FF"),  # Arabic
    ("\u0750", "\u077F"),  # Arabic Supplement
    ("\u08A0", "\u08FF"),  # Arabic Extended-A
    ("\uFB50", "\uFDFF"),  # Arabic Presentation Forms-A
    ("\uFE70", "\uFEFF"),  # Arabic Presentation Forms-B
)


def has_arabic(text: str) -> bool:
    return any(lo <= ch <= hi for ch in (text or "") for lo, hi in ARABIC_BLOCKS)


# What each topic covers - the model reads these, since a bare name like מאחזים
# is ambiguous. A topic missing here is shown to it by name alone.
TOPIC_DESCRIPTIONS = {
    "שתי מדינות": "הסדר מדיני להקמת מדינה פלסטינית לצד ישראל, משא ומתן על פתרון שתי המדינות",
    "סיפוח שטחי C": "החלת ריבונות ישראלית וסיפוח שטחי C ביהודה ושומרון",
    "חלוקת ירושלים": "מעמד ירושלים, חלוקת העיר ושכונות מזרח ירושלים במסגרת הסדר מדיני",
    "סיכולים ממוקדים": "חיסולים וסיכולים ממוקדים של פעילי טרור בידי כוחות הביטחון",
    "בנייה בהתנחלויות": "אישורי בנייה והרחבת התנחלויות ויישובים ביהודה ושומרון",
    "מאחזים": "מאחזים בלתי חוקיים ביהודה ושומרון והסדרתם או הכשרתם",
    "פינוי ההתנחלויות": "פינוי התנחלויות ויישובים, עקירת תושבים והריסת בתים",
    "עסקת המאה": "תוכנית המדינית האמריקאית להסדר בין ישראל לפלסטינים, עסקת המאה",
    "חוק הלאום": "חוק יסוד הלאום, מעמד ערביי ישראל והזהות היהודית של המדינה",
    "כלכלה": "המשק והכלכלה, תקציב המדינה, מיסים, אינפלציה, יוקר המחיה ושוק ההון",
    "קצבאות לחלשים": "קצבאות רווחה, ביטוח לאומי, תמיכה בשכבות חלשות ובקשישים",
    "מימון ישיבות": "תקציבי ישיבות וכוללים, מימון מוסדות תורניים מכספי המדינה",
    "דיור ציבורי": "דיור ציבורי, מחירי הדיור, שכר דירה ופתרונות דיור בר השגה",
    "לימודי ליבה": "לימודי ליבה בחינוך החרדי, תוכנית הלימודים ופיקוח על מוסדות חינוך",
    "גיוס חרדים": "גיוס בני ישיבות לצה\"ל, חוק הגיוס והשוויון בנטל",
    "נישואים אזרחיים": "נישואים אזרחיים בישראל, רבנות, גיור ומעמד אישי",
    "נישואים חד מיניים": "זכויות הקהילה הגאה, נישואים חד מיניים והורות של זוגות חד מיניים",
    "סביבה": "איכות הסביבה, זיהום אוויר, משבר האקלים, אנרגיה מתחדשת ומיחזור",
    "מהגרי עבודה": "מהגרי עבודה, מבקשי מקלט, פליטים ומדיניות ההגירה בישראל",
    "עצמאות שיפוטית": "הרפורמה המשפטית, מעמד בית המשפט העליון, היועץ המשפטי ועצמאות הרשות השופטת",
    "ליגליזציה": "לגליזציה של קנאביס, שימוש רפואי בקנאביס ומדיניות אכיפת סמים",
    "טיפולי המרה": "טיפולי המרה, איסור על טיפולי המרה ויחס הממסד לקהילה הגאה",
}

# The file outlets publish for Google, read as if it were a feed
import sitemap as news_sitemap

# Kan11 has no RSS url and is fetched by a scraper in the original worker.
try:
    from kan11RssFetcher import generate_feed
except Exception:  # pragma: no cover - the scraper is optional
    generate_feed = None

# Outlets with no usable RSS at all - see worker/site_scrapers.py
try:
    from site_scrapers import SCRAPERS
except Exception:
    SCRAPERS = {}

KAN_SECTION_TITLES = {
    "כל הכתבות", "פוליטי מדיני", "צבא וביטחון", "העולם הערבי", "בארץ",
    "בעולם", "כאן כלכלי", "משפט ופלילים", "תרבות ובידור",
}


# The free tier allows only a handful of requests a minute, so calls are spaced
# and 429s are retried with backoff rather than dropped - a dropped translation
# means the article is skipped entirely.
_last_translate_at = 0.0
TRANSLATE_MIN_GAP = 4.0
TRANSLATE_RETRIES = 2


def _salvage_json(raw: str) -> dict | None:
    """Pull header/subheader out of a JSON reply that got cut off mid-string."""
    out = {}
    for key in ("header", "subheader"):
        m = re.search(r'"%s"\s*:\s*"((?:[^"\\]|\\.)*)' % key, raw)
        if m:
            try:
                out[key] = _json.loads('"%s"' % m.group(1))
            except ValueError:
                out[key] = m.group(1)
    return out if out.get("header") else None


def translate_to_hebrew(header: str, subheader: str) -> tuple[str, str] | None:
    """Translate one item to Hebrew. Returns None when it could not be translated.

    OpenAI does this now. Gemini's free tier answers a few requests a minute, and a
    cycle with ten Arabic headlines spent a quarter of an hour backing off - it is
    kept only as the fallback.
    """
    global _last_translate_at
    from gpt_models import OPENAI_API_KEY, translate as translate_via_openai

    if OPENAI_API_KEY:
        done = translate_via_openai(header, subheader)
        if done:
            return done
    if not GEMINI_API_KEY:
        return None

    # the columns cap at 512/2048 anyway, and a shorter prompt is less likely to
    # run the reply past the token budget
    header = (header or "")[:400]
    subheader = (subheader or "")[:900]

    prompt = (
        "תרגם לעברית את הכותרת והתקציר הבאים מתוך אתר חדשות בערבית. "
        "שמור על סגנון עיתונאי, אל תוסיף פרשנות ואל תשמיט פרטים. "
        "החזר JSON בלבד במבנה {\"header\": \"...\", \"subheader\": \"...\"}.\n\n"
        f"כותרת: {header}\n\nתקציר: {subheader}"
    )

    for attempt in range(TRANSLATE_RETRIES):
        gap = TRANSLATE_MIN_GAP - (time.time() - _last_translate_at)
        if gap > 0:
            time.sleep(gap)
        try:
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
                headers={"x-goog-api-key": GEMINI_API_KEY, "content-type": "application/json"},
                json={"contents": [{"parts": [{"text": prompt}]}],
                      "generationConfig": {"maxOutputTokens": 2000, "temperature": 0.1,
                                           "responseMimeType": "application/json",
                                           "thinkingConfig": {"thinkingBudget": 0}}},
                timeout=60,
            )
            _last_translate_at = time.time()
            if r.status_code == 429:
                wait = 8 * (attempt + 1)
                print(f"  . מגבלת קצב, ממתין {wait}s")
                time.sleep(wait)
                continue
            r.raise_for_status()

            parts = r.json()["candidates"][0].get("content", {}).get("parts", [])
            raw = "".join(p.get("text", "") for p in parts if not p.get("thought"))
            try:
                out = _json.loads(raw)
            except ValueError:
                out = _salvage_json(raw)
                if out is None:
                    print("  ! תשובת תרגום לא קריאה")
                    return None
            head = (out.get("header") or "").strip()
            if not head:
                return None
            return head, (out.get("subheader") or "").strip()
        except Exception as err:
            _last_translate_at = time.time()
            if attempt == TRANSLATE_RETRIES - 1:
                print(f"  ! translation failed: {err}")
                return None
            time.sleep(4 * (attempt + 1))
    return None


# Who we are. The crawler used to introduce itself as Chrome on a Mac, which was
# both untrue and, it turns out, worse at its job: channel 13 serves its news
# sitemap to a crawler that names itself and refuses one wearing a browser's
# clothes. Saying who we are and how to be told to stop is the honest thing and
# the effective one.
UA = "HaEzrachHaKatanBot/1.0 (+https://haezrach-hakatan.web.app; haezrachh@gmail.com)"
# The one exception, inherited rather than chosen: the Haaretz group's edge
# refuses anything it does not recognise, and between them these two are the
# largest voice on the left. Both were already being read this way before any of
# this; worth replacing with a word from them, and everything else here is honest.
BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
AS_BROWSER = {"הארץ", "דה מרקר"}
FEED_TIMEOUT = 15


def fetch_entries(site_name, url):
    """Return raw feed entries for one site, mirroring main.py:crawl.

    feedparser.parse(url) does its own fetch with NO timeout, so a single slow
    publisher blocked the whole run - that was an hour of a 77-minute cycle.
    The bytes are fetched here with a timeout and handed to the parser instead.
    """
    if site_name in SCRAPERS:
        try:
            return SCRAPERS[site_name]().get("entries", [])
        except Exception as err:
            print(f"  ! {site_name}: scraper failed: {err}")
            return []
    if not url:
        # the public broadcaster used to be read off its own lobby page; it has a
        # news sitemap now, and this stays only for the day that address moves
        if site_name == "כאן 11" and generate_feed is not None:
            try:
                return generate_feed().get("entries", [])
            except Exception as err:
                print(f"  ! {site_name}: scraper failed: {err}")
        return []
    agent = BROWSER_UA if site_name in AS_BROWSER else UA
    head = {"User-Agent": agent, "Accept-Language": "he-IL,he;q=0.9,en;q=0.8"}
    try:
        r = requests.get(url, headers=head, timeout=FEED_TIMEOUT)
        r.raise_for_status()
    except Exception as err:
        print(f"  ! {site_name}: {err}")
        return []
    found = feedparser.parse(r.content).get("entries", [])
    if found:
        return found
    # Not a feed, then - but perhaps the file they publish for Google. Several
    # outlets here wall their RSS off from anything in a datacentre and leave the
    # news sitemap open, because Googlebot has to be able to read it.
    return news_sitemap.entries(r.content)


def parse_entry(entry, site_name):
    header = entry.get("title", "").strip()
    if not header:
        return None
    if site_name == "כאן 11" and header in KAN_SECTION_TITLES:
        return None
    if site_name == "ישראל היום" and "news" not in entry.get("link", "").split("/"):
        return None

    subheader = BeautifulSoup(entry.get("summary", ""), "html.parser").get_text().strip()

    if entry.get("published_parsed"):
        created_at = datetime(*entry["published_parsed"][:6])
    elif entry.get("updated_parsed"):
        created_at = datetime(*entry["updated_parsed"][:6])
    else:
        created_at = datetime.now()

    if created_at > datetime.now() + timedelta(minutes=5):
        created_at = datetime.now()

    return {
        "header": header[:512],
        "subheader": (subheader or header)[:2048],
        "link": entry.get("link", "").strip()[:512],
        "created_at": created_at,
    }


