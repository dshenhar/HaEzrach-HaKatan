"""RSS scrape -> embed -> topic -> incremental clustering, without the missing model.

Same pipeline and the same thresholds as scheduler.py + NewsClusterer.py, with two
substitutions, because `hebrew_classifier/` is not in this checkout:

  embeddings   dicta-il/dictabert          -> paraphrase-multilingual-mpnet-base-v2
               (768-dim either way, so the Vector(768) columns are unchanged)

  topic label  fine-tuned text-classifier  -> multilingual zero-shot NLI classifier
               (the route the original code left commented out on NewsClusterer.py:58,
               but with mDeBERTa-base rather than xlm-roberta-large, which is 4x the
               size and far slower on CPU)

The second substitution is the lossy one. A fine-tuned classifier learned these 22
labels from labelled Hebrew news; zero-shot only reasons from the label text, so it
is weaker on the narrow ones. Articles whose best label scores below TOPIC_MIN_SCORE
are skipped rather than forced into the nearest label - most general news (crime,
courts, world news) is about none of these 22 political issues.

Cosine similarity against embedded topic descriptions was tried first and was worse:
it put "מנהיגי עולם התורה בהתרת נדרים" under מאחזים, and raising the cutoff did not
help because the wrong labels scored at the top of the distribution too.

    python local_ingest.py --once      one pass and exit
    python local_ingest.py             every INTERVAL_SECONDS, like the real scheduler
"""
import argparse
import json as _json
import os
import re
import sys
import time

import requests
from datetime import datetime, timedelta, timezone

import feedparser
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup
from sqlalchemy import cast, func, select
from pgvector.sqlalchemy import Vector
from sentence_transformers import SentenceTransformer
from transformers import pipeline

from db.db_session import SessionLocal
from db.models import Article, Cluster, ClusterSummary, Site, Topic, TopicCorrection
from db.summaries import BLOCS, articles_for, prompt as summary_prompt, site_blocs

GENERAL_TOPIC = "חדשות כלליות"

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
ZERO_SHOT_MODEL = "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7"
EMBEDDING_DIM = 768

# NewsClusterer used 0.88, tuned for dicta-il/dictabert. This model reports lower
# similarities for the same pair of texts: measured on a real scrape, every
# cross-site pair down to ~0.74 was the same story (same verdict, same budget
# dispute, same raid), so 0.88 was discarding correct matches. Re-tune with
# --recluster after changing this.
SIMILARITY_THRESHOLD = 0.75
SAME_ARTICLE_THRESHOLD = 0.97
TIME_WINDOW_HOURS = 12
INTERVAL_SECONDS = 1800   # every half hour

# The zero-shot classifier costs seconds per article while embedding costs
# milliseconds, and it was being run on every article scraped. Most articles are
# the only coverage of their story, never reach a 2+ cluster and never reach the
# feed - so classifying them was most of the work for none of the benefit. Topics
# are now assigned AFTER clustering, to the articles that actually surface.
# One cycle was taking hours; "every 30 minutes" never happened.
MAX_PER_CYCLE = 250

# A catch-all candidate label. Without one, zero-shot always returns a best topic,
# and most news (crime, weather, world events, sport) is about none of these 22
# political issues - the first run labelled 179 of 191 articles, which is nonsense.
# An article is kept only when its best real topic beats the catch-all by TOPIC_MARGIN.
CATCH_ALL = "חדשות כלליות שאינן עוסקות בסוגיה פוליטית שנויה במחלוקת"
TOPIC_MIN_SCORE = 0.20
TOPIC_MARGIN = 0.05

# A human correction outranks the classifier. Every fix made in dev mode is stored
# with the article's embedding, and a new article close enough to one of them takes
# its topic outright. This is nearest-neighbour over human labels, not fine-tuning:
# at tens or hundreds of examples it is both far more accurate and instant, where
# fine-tuning would need thousands of labels and a training run to beat a coin flip.
# It also means the very first correction already changes the next ingest.
CORRECTION_MATCH = 0.82
HYPOTHESIS = "הכתבה עוסקת ב{}."

# Nothing non-Hebrew reaches the reader. Arabic items are translated here, at
# ingest, so the headline stored in the database is already the one shown.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-3.6-flash"
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-sonnet-5"

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


# Short noun phrase per topic, substituted into HYPOTHESIS as the NLI hypothesis.
# Zero-shot works better with a concise label than with a long description, but a
# bare name like "מאחזים" is ambiguous, so the narrow ones carry a word of context.
TOPIC_LABELS = {
    "שתי מדינות": "פתרון שתי המדינות והקמת מדינה פלסטינית",
    "סיפוח שטחי C": "סיפוח שטחים ביהודה ושומרון והחלת ריבונות",
    "חלוקת ירושלים": "מעמד ירושלים וחלוקת העיר",
    "סיכולים ממוקדים": "חיסול ממוקד של פעילי טרור",
    "בנייה בהתנחלויות": "בנייה והרחבה של התנחלויות",
    "מאחזים": "מאחזים בלתי חוקיים ביהודה ושומרון",
    "פינוי ההתנחלויות": "פינוי התנחלויות והריסת בתים",
    "עסקת המאה": "תוכנית מדינית אמריקאית להסדר עם הפלסטינים",
    "חוק הלאום": "חוק הלאום ומעמד ערביי ישראל",
    "כלכלה": "כלכלה, תקציב המדינה ויוקר המחיה",
    "קצבאות לחלשים": "קצבאות רווחה וביטוח לאומי",
    "מימון ישיבות": "מימון ישיבות ומוסדות תורניים",
    "דיור ציבורי": "דיור ציבורי ומחירי הדיור",
    "לימודי ליבה": "לימודי ליבה בחינוך החרדי",
    "גיוס חרדים": "גיוס בני ישיבות לצה\"ל",
    "נישואים אזרחיים": "נישואים אזרחיים ומעמד אישי",
    "נישואים חד מיניים": "זכויות הקהילה הגאה ונישואים חד מיניים",
    "סביבה": "איכות הסביבה ומשבר האקלים",
    "מהגרי עבודה": "מהגרי עבודה ומבקשי מקלט",
    "עצמאות שיפוטית": "הרפורמה המשפטית ועצמאות בתי המשפט",
    "ליגליזציה": "לגליזציה של קנאביס",
    "טיפולי המרה": "טיפולי המרה בקהילה הגאה",
}

# kept only so the earlier calibration script still imports
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
TRANSLATE_RETRIES = 4


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
    """Translate one item to Hebrew. Returns None when it could not be translated."""
    global _last_translate_at
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


# ---- AI summaries, written ahead of any reader --------------------------------
# Every story the feed can show gets its summaries here: one for each bloc that
# covered it and one across all of them for the citizen view, so opening a story
# never waits on the AI. A summary is redone only when more headlines have joined
# its story since. This runs after translation, so on a tight quota the headlines
# come first - and it stops at the first refusal instead of waiting the quota out.
SUMMARY_WINDOW = timedelta(hours=26)     # a little over the feed's day
SUMMARY_MAX_PER_CYCLE = 90
SUMMARY_MIN_GAP = 1.0


class QuotaExhausted(Exception):
    """The AI provider refuses more requests for now; the rest wait for the next cycle."""


def _summary_via_gemini(text_prompt: str) -> str | None:
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": GEMINI_API_KEY, "content-type": "application/json"},
        json={"contents": [{"parts": [{"text": text_prompt}]}],
              "generationConfig": {"maxOutputTokens": 300, "temperature": 0.3,
                                   "thinkingConfig": {"thinkingBudget": 0}}},
        timeout=60,
    )
    if r.status_code == 429:
        raise QuotaExhausted("gemini")
    r.raise_for_status()
    parts = r.json()["candidates"][0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip() or None


def _summary_via_claude(text_prompt: str) -> str | None:
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": CLAUDE_MODEL, "max_tokens": 300,
              "messages": [{"role": "user", "content": text_prompt}]},
        timeout=60,
    )
    if r.status_code in (429, 529):
        raise QuotaExhausted("claude")
    r.raise_for_status()
    return "".join(b.get("text", "") for b in r.json().get("content", [])).strip() or None


def _summarise(text_prompt: str) -> str | None:
    """Gemini first, Claude as the fallback - the same order as the api."""
    providers = [fn for key, fn in ((GEMINI_API_KEY, _summary_via_gemini),
                                    (CLAUDE_API_KEY, _summary_via_claude)) if key]
    refused = 0
    for fn in providers:
        try:
            text = fn(text_prompt)
            if text:
                return text
        except QuotaExhausted:
            refused += 1
        except Exception as err:
            print(f"  ! summary failed: {err}")
    if providers and refused == len(providers):
        raise QuotaExhausted("every provider")
    return None


def write_summaries():
    if not (GEMINI_API_KEY or CLAUDE_API_KEY):
        return
    since = datetime.now(timezone.utc).replace(tzinfo=None) - SUMMARY_WINDOW
    written = 0
    with SessionLocal() as session:
        cluster_ids = session.execute(
            select(Cluster.id)
            .where(Cluster.article_count >= 2, Cluster.last_updated >= since)
            .order_by(Cluster.last_updated.desc())
        ).scalars().all()
        for cluster_id in cluster_ids:
            rows = session.execute(
                select(Article.header, Article.subheader, Article.site_id)
                .where(Article.cluster_id == cluster_id)
            ).all()
            blocs = site_blocs(session, {r.site_id for r in rows})
            have = {s.bloc: s.article_count for s in session.execute(
                select(ClusterSummary).where(ClusterSummary.cluster_id == cluster_id)
            ).scalars()}
            for bloc in BLOCS:
                articles = articles_for(rows, blocs, bloc)
                if not articles or have.get(bloc) == len(articles):
                    continue
                if written >= SUMMARY_MAX_PER_CYCLE:
                    print(f"summaries: {written} written, the rest next cycle")
                    return
                try:
                    text = _summarise(summary_prompt(articles, bloc))
                except QuotaExhausted as err:
                    print(f"summaries: {written} written, then the AI quota ran out ({err}) - the rest next cycle")
                    return
                if not text:
                    continue
                session.merge(ClusterSummary(cluster_id=cluster_id, bloc=bloc,
                                             summary=text[:2048], article_count=len(articles)))
                session.commit()
                written += 1
                time.sleep(SUMMARY_MIN_GAP)
    print(f"summaries: {written} written")


def encode(model, text):
    return model.encode(text, convert_to_numpy=True, normalize_embeddings=True)


UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
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
    if site_name == "כאן 11":
        if generate_feed is None:
            return []
        try:
            return generate_feed().get("entries", [])
        except Exception as err:
            print(f"  ! {site_name}: scraper failed: {err}")
            return []
    if not url:
        return []
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=FEED_TIMEOUT)
        r.raise_for_status()
        return feedparser.parse(r.content).get("entries", [])
    except Exception as err:
        print(f"  ! {site_name}: {err}")
        return []


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


def scrape(session):
    """Fetch every site's feed and return entries that are not already stored."""
    sites = session.execute(select(Site.id, Site.name, Site.domain, Site.language)).all()
    cutoff = datetime.now() - timedelta(hours=24)

    known_links = set(
        session.execute(
            select(Article.link).where(Article.created_at >= cutoff)
        ).scalars().all()
    )
    known_headers = set(
        session.execute(
            select(Article.header).where(Article.created_at >= cutoff)
        ).scalars().all()
    )

    with ThreadPoolExecutor(max_workers=10) as pool:
        feeds = dict(zip(
            [row[1] for row in sites],
            pool.map(lambda row: fetch_entries(row[1], row[2]), sites),
        ))

    fresh = []
    skipped_untranslated = 0
    for site_id, site_name, domain, language in sites:
        entries = feeds.get(site_name, [])
        kept = 0
        for entry in entries:
            parsed = parse_entry(entry, site_name)
            if not parsed:
                continue
            if parsed["link"] in known_links or parsed["header"] in known_headers:
                continue
            if parsed["created_at"] < cutoff:
                continue
            if language != "he" or has_arabic(parsed["header"]) or has_arabic(parsed["subheader"]):
                translated = translate_to_hebrew(parsed["header"], parsed["subheader"])
                if translated is None:
                    skipped_untranslated += 1
                    continue
                parsed["header"], parsed["subheader"] = translated
                # last line of defence: a failed or partial translation must never
                # be stored, because nothing downstream checks again
                if has_arabic(parsed["header"]) or has_arabic(parsed["subheader"]):
                    print(f"  ! {site_name}: תרגום החזיר ערבית, מדלג")
                    skipped_untranslated += 1
                    continue

            known_links.add(parsed["link"])
            known_headers.add(parsed["header"])
            parsed["site_id"] = site_id
            fresh.append(parsed)
            kept += 1
        suffix = "" if language == "he" else "  (מתורגם)"
        print(f"  {site_name:<18} {len(entries):>3} entries, {kept:>3} new{suffix}")
    if skipped_untranslated:
        print(f"  ! {skipped_untranslated} פריטים בערבית דולגו - אין GEMINI_API_KEY לתרגום")
    return fresh


def build_topic_index(session):
    """Map each hypothesis label back to its topic row."""
    rows = session.execute(select(Topic.id, Topic.name)).all()
    if not rows:
        raise SystemExit("no topics in the database - run /db/local_init.py first")
    by_label = {}
    for topic_id, name in rows:
        by_label[TOPIC_LABELS.get(name, name)] = (topic_id, name)
    return by_label


def topic_from_corrections(session, embedding):
    """Nearest human-corrected article, when it is close enough to trust."""
    row = (
        session.query(TopicCorrection, Topic.name)
        .join(Topic, Topic.id == TopicCorrection.topic_id)
        .order_by(func.cosine_distance(TopicCorrection.embedding,
                                       cast(embedding, Vector(EMBEDDING_DIM))))
        .limit(1)
        .one_or_none()
    )
    if row is None:
        return None
    correction, topic_name = row
    stored = np.asarray(correction.embedding, dtype=np.float32)
    similarity = float(np.dot(embedding, stored) /
                       (np.linalg.norm(embedding) * np.linalg.norm(stored)))
    if similarity < CORRECTION_MATCH:
        return None
    return correction.topic_id, topic_name, similarity


def assign_topic(classifier, by_label, text):
    """Zero-shot against the 22 topics plus a catch-all.

    Returns (topic_id, topic_name, score), or None when the catch-all wins - i.e.
    the article is not about any of the 22 topics, which is the common case.
    """
    result = classifier(
        text,
        candidate_labels=list(by_label.keys()) + [CATCH_ALL],
        hypothesis_template=HYPOTHESIS,
    )
    ranked = list(zip(result["labels"], result["scores"]))
    catch_all_score = next(sc for lb, sc in ranked if lb == CATCH_ALL)
    label, score = next((lb, sc) for lb, sc in ranked if lb != CATCH_ALL)

    if score < TOPIC_MIN_SCORE or score < catch_all_score + TOPIC_MARGIN:
        return None
    topic_id, topic_name = by_label[label]
    return topic_id, topic_name, float(score)


def nearest_cluster(session, embedding, created_at):
    """Closest cluster centroid inside the time window, as in NewsClusterer.add_article."""
    window_start = created_at - timedelta(hours=TIME_WINDOW_HOURS)
    return (
        session.query(Cluster)
        .filter(Cluster.created_at >= window_start)
        .order_by(func.cosine_distance(Cluster.centroid_embedding,
                                       cast(embedding, Vector(EMBEDDING_DIM))))
        .limit(1)
        .one_or_none()
    )


def open_cluster(session, article, embedding):
    cluster = Cluster(
        centroid_embedding=embedding,
        article_count=1,
        created_at=article.created_at,
        last_updated=article.created_at,
    )
    session.add(cluster)
    session.flush()
    article.cluster_id = cluster.id


def join_cluster(session, cluster, article, embedding):
    article.cluster_id = cluster.id
    cluster.article_count += 1
    cluster.last_updated = max(article.created_at, cluster.last_updated)
    centroid = np.asarray(cluster.centroid_embedding, dtype=np.float32)
    cluster.centroid_embedding = (
        (centroid * (cluster.article_count - 1) + embedding) / cluster.article_count
    )


def place_article(session, article, embedding):
    """Join the nearest cluster, or open a new one.

    `articles` has UNIQUE(cluster_id, site_id), so a cluster holds at most one
    article per site. When the slot is taken the original keeps whichever article
    sits closer to the centroid; the loser starts its own cluster.
    """
    cluster = nearest_cluster(session, embedding, article.created_at)
    if cluster is None:
        open_cluster(session, article, embedding)
        return "new"

    centroid = np.asarray(cluster.centroid_embedding, dtype=np.float32)
    score = float(np.dot(embedding, centroid) /
                  (np.linalg.norm(embedding) * np.linalg.norm(centroid)))
    if score < SIMILARITY_THRESHOLD:
        open_cluster(session, article, embedding)
        return "new"

    taken = (
        session.query(Article)
        .filter(Article.cluster_id == cluster.id, Article.site_id == article.site_id)
        .first()
    )
    if taken is None:
        join_cluster(session, cluster, article, embedding)
        return "joined"

    rival = np.asarray(taken.embedding, dtype=np.float32)
    if float(np.dot(embedding, rival)) > SAME_ARTICLE_THRESHOLD:
        return "duplicate"          # the same story again from the same site

    rival_score = float(np.dot(rival, centroid) /
                        (np.linalg.norm(rival) * np.linalg.norm(centroid)))
    if score > rival_score:
        taken.cluster_id = None
        article.cluster_id = cluster.id
        return "replaced"

    open_cluster(session, article, embedding)
    return "new"


def relabel(classifier, limit=None):
    """Re-run topic assignment over stored articles. No scraping, no re-embedding.

    Lets the labelling be tuned against a fixed corpus; --limit samples a subset so
    a change can be judged in a couple of minutes rather than half an hour.
    """
    with SessionLocal() as session:
        by_label = build_topic_index(session)
        query = session.query(Article).order_by(Article.id)
        if limit:
            query = query.limit(limit)
        articles = query.all()
        print(f"relabelling {len(articles)} articles\n")

        kept = dropped = 0
        for article in articles:
            text = f"{article.header}\n{article.subheader}"
            assigned = assign_topic(classifier, by_label, text)
            if assigned is None:
                dropped += 1
                print(f"  --  {'':<20} {article.header[:56]}")
                continue
            topic_id, topic_name, score = assigned
            article.topic_id = topic_id
            article.topic_name = topic_name[:64]
            kept += 1
            print(f"  {score:.2f} [{topic_name:<18}] {article.header[:56]}")
        session.commit()

    print(f"\nkept {kept}, rejected {dropped} as not about any of the 22 topics")


def translate_existing():
    """Backfill: translate articles stored before translation existed.

    Rows scraped from an Arabic outlet in an earlier run still hold their original
    headline. Detect them by their site language and rewrite them in place.
    """
    if not GEMINI_API_KEY:
        raise SystemExit("GEMINI_API_KEY not set - nothing can be translated")

    with SessionLocal() as session:
        # every article, not just the ones from outlets flagged non-Hebrew
        rows = (
            session.query(Article, Site.name)
            .join(Site, Site.id == Article.site_id)
            .all()
        )
        pending = [(a, n) for a, n in rows
                   if has_arabic(a.header) or has_arabic(a.subheader or "")]
        print(f"{len(pending)} articles still carrying Arabic (of {len(rows)})")

        done = failed = 0
        for article, site_name in pending:
            translated = translate_to_hebrew(article.header, article.subheader or "")
            if translated is None:
                failed += 1
                continue
            header, subheader = translated[0][:512], (translated[1] or translated[0])[:2048]
            if has_arabic(header) or has_arabic(subheader):
                print(f"  ! {site_name}: תרגום החזיר ערבית, מדלג")
                failed += 1
                continue
            article.header, article.subheader = header, subheader
            done += 1
            print(f"  {site_name:<12} {article.header[:58]}")
            session.commit()

    print(f"\ntranslated {done}, failed {failed}")


def recluster():
    """Re-run clustering over stored articles, reusing their saved embeddings.

    Lets SIMILARITY_THRESHOLD be tuned without re-scraping (RSS feeds move on,
    so a re-scrape is not the same corpus). Does not load the model.
    """
    with SessionLocal() as session:
        session.query(Article).update({Article.cluster_id: None})
        session.query(Cluster).delete()
        session.commit()

        articles = (
            session.query(Article)
            .filter(Article.embedding.isnot(None))
            .order_by(Article.created_at)
            .all()
        )
        print(f"re-clustering {len(articles)} articles at threshold {SIMILARITY_THRESHOLD}")

        stats = {"new": 0, "joined": 0, "replaced": 0, "duplicate": 0}
        for article in articles:
            embedding = np.asarray(article.embedding, dtype=np.float32)
            stats[place_article(session, article, embedding)] += 1
            session.commit()

        total = session.execute(select(func.count(Cluster.id))).scalar_one()
        feedable = session.execute(
            select(func.count(Cluster.id)).where(Cluster.article_count >= 2)
        ).scalar_one()

    print(f"new {stats['new']}, joined {stats['joined']}, replaced {stats['replaced']}")
    print(f"clusters {total} total, {feedable} with 2+ articles (these reach /feed)")


def ingest(model, classifier):
    started = datetime.now()
    print(f"\n=== ingest {started:%Y-%m-%d %H:%M:%S} ===")

    with SessionLocal() as session:
        print("scraping:")
        entries = scrape(session)
        if not entries:
            print("no new articles")
            return

        # newest first when trimming, then chronological so clustering still walks
        # the timeline in order
        if len(entries) > MAX_PER_CYCLE:
            entries.sort(key=lambda e: e["created_at"], reverse=True)
            print(f"\n{len(entries)} new, keeping the newest {MAX_PER_CYCLE}")
            entries = entries[:MAX_PER_CYCLE]
        entries.sort(key=lambda e: e["created_at"])
        print(f"\nembedding and placing {len(entries)} articles")

        stats = {"new": 0, "joined": 0, "replaced": 0, "duplicate": 0,
                 "off_topic": 0, "from_corrections": 0, "classified": 0}

        general = session.execute(
            select(Topic).where(Topic.name == GENERAL_TOPIC)
        ).scalar_one_or_none()
        if general is None:
            raise SystemExit(f"topic {GENERAL_TOPIC!r} missing - run /db/local_init.py")

        placed_articles = []
        for entry in entries:
            text = f"{entry['header']}\n{entry['subheader']}"
            embedding = encode(model, text)

            taught = topic_from_corrections(session, embedding)
            if taught is not None:
                topic_id, topic_name, _sim = taught
                stats["from_corrections"] += 1
            else:
                topic_id, topic_name = general.id, general.name

            article = Article(
                site_id=entry["site_id"],
                topic_id=topic_id,
                topic_name=topic_name[:64],
                header=entry["header"],
                subheader=entry["subheader"],
                link=entry["link"],
                embedding=embedding,
                created_at=entry["created_at"],
                bias_score=0,
                votes_count=0,
            )
            session.add(article)
            session.flush()

            stats[place_article(session, article, embedding)] += 1
            placed_articles.append((article.id, taught is not None))
            session.commit()

        # now the expensive part, only where it changes what a reader sees
        pending = [aid for aid, was_taught in placed_articles if not was_taught]
        if pending:
            by_label = build_topic_index(session)
            rows = (
                session.query(Article)
                .join(Cluster, Cluster.id == Article.cluster_id)
                .filter(Article.id.in_(pending), Cluster.article_count >= 2)
                .all()
            )
            print(f"\nclassifying {len(rows)} of {len(pending)} - the rest never reach the feed")
            for article in rows:
                assigned = assign_topic(classifier, by_label,
                                        f"{article.header}\n{article.subheader}")
                if assigned is None:
                    stats["off_topic"] += 1
                    continue
                article.topic_id, article.topic_name, _ = assigned[0], assigned[1][:64], assigned[2]
                stats["classified"] += 1
            session.commit()

        total_clusters = session.execute(
            select(func.count(Cluster.id))
        ).scalar_one()
        feedable = session.execute(
            select(func.count(Cluster.id)).where(Cluster.article_count >= 2)
        ).scalar_one()

    print(
        f"\nstored   {stats['new'] + stats['joined'] + stats['replaced']}"
        f"  (new cluster {stats['new']}, joined {stats['joined']}, replaced {stats['replaced']})"
    )
    print(f"skipped  {stats['off_topic']} not about any topic, {stats['duplicate']} duplicates")
    print(f"topics   {stats['classified']} classified, {stats['from_corrections']} from human corrections")
    print(f"clusters {total_clusters} total, {feedable} with 2+ articles (these reach /feed)")
    print(f"took     {(datetime.now() - started).seconds}s")


def run_once(model, classifier):
    ingest(model, classifier)
    # after the new articles are in their stories, so the summaries cover them
    write_summaries()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="one pass, then exit")
    parser.add_argument("--relabel", action="store_true",
                        help="re-run topic assignment on stored articles, no scraping")
    parser.add_argument("--limit", type=int, default=None, help="with --relabel: sample N")
    parser.add_argument("--translate-existing", action="store_true",
                        help="backfill Hebrew for articles stored before translation existed")
    parser.add_argument("--summaries", action="store_true",
                        help="write the AI summaries the feed is missing, no scraping")
    parser.add_argument("--recluster", action="store_true",
                        help="re-cluster stored articles at the current threshold, no scraping")
    args = parser.parse_args()

    if args.recluster:
        recluster()
        return

    if args.translate_existing:
        translate_existing()
        return

    if args.summaries:
        write_summaries()
        return

    model = None
    if not args.relabel:
        print(f"loading {MODEL_NAME} ...")
        model = SentenceTransformer(MODEL_NAME)
        dim = model.get_sentence_embedding_dimension()
        if dim != EMBEDDING_DIM:
            sys.exit(f"model emits {dim}-dim vectors, the schema needs {EMBEDDING_DIM}")
    print(f"loading {ZERO_SHOT_MODEL} ...")
    classifier = pipeline("zero-shot-classification", model=ZERO_SHOT_MODEL)
    print("models ready")

    if args.relabel:
        relabel(classifier, args.limit)
        return

    if args.once:
        run_once(model, classifier)
        return

    while True:
        # a fixed cadence: sleep only what is left of the half hour. Sleeping a
        # full interval after a long cycle stretched "every 30 minutes" to 70.
        cycle_start = time.time()
        try:
            run_once(model, classifier)
        except KeyboardInterrupt:
            break
        except Exception as err:
            print(f"pass failed: {err}")
            import traceback
            traceback.print_exc()
        time.sleep(max(0, INTERVAL_SECONDS - (time.time() - cycle_start)))


if __name__ == "__main__":
    main()
