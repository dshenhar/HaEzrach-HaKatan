"""Hot topics: the affairs Israel's right and left are split on, and which of them
today's feed is about.

  pool      polar/{id}, about fifty affairs. Each holds a factual summary of what
            happened, how each bloc covers it, sees it and why, and how burning it
            is now (1-10). WRITE_MODEL writes them after searching the web, because
            the state of an affair is news and no model's memory has it.
  matching  every ingest pass, the feed's new stories go to MATCH_MODEL with the
            pool's list, and each story keeps the affairs it is about (polar,
            polar_n, polar_v on the story's own document, gone with it after 30h).
  meta/hot  what the page reads, built with the feed: every affair with its tier
            and its links into the feed, and today's - at most three, only those
            the feed has stories on.
  refresh   by hand, once a month, in a session with the owner - not by the ingest,
            which used to rewrite every affair with WRITE_MODEL and mail the pool,
            and was turned off to save the OpenAI credit. `refresh` below still
            does it with the model when that is wanted.

    python hot_topics.py seed [--count 50]     propose the pool and write every affair
    python hot_topics.py add "<title>"           one more affair
    python hot_topics.py drop <id>               take one out (kept, inactive)
    python hot_topics.py rewrite <id> [...]      write these again now
    python hot_topics.py relevance <id> <1-10>   set how burning an affair is, by hand
    python hot_topics.py refresh                 rewrite the month-old affairs with the model,
                                                 then mail the report (run by hand only)
    python hot_topics.py report [--send]         print the report, and mail it
    python hot_topics.py build                   match the current feed and rebuild meta/hot
    python hot_topics.py table                   the pool, for review
    python hot_topics.py load <file.json> [--force]  affairs written elsewhere, e.g.
                                                 /app/migrate/hot_affairs/2026-10-08.json
    python hot_topics.py edit <file.json>        corrections by hand to affairs' fields,
                                                 without the model, e.g.
                                                 /app/migrate/hot_affairs/2026-10-10-no-outlet-names.json
"""
import argparse
import base64
import hashlib
import html
import json
import os
import re
import smtplib
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from email.mime.text import MIMEText
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from gpt_models import OpenAIUnavailable, _post
from store import db
from store.taxonomy import TOPICS

# The two were tried side by side on the same affairs (October 2026). The writer is
# the public face of the page and runs fifty times a month, so it is the strongest
# model, about $10 a month with its searches. The matcher runs every half hour on a
# yes-or-no question, where the small one answers as well at a twentieth the price.
WRITE_MODEL = os.getenv("HOT_WRITE_MODEL", "gpt-6.1-sol")
WRITE_EFFORT = os.getenv("HOT_WRITE_EFFORT", "medium")
MATCH_MODEL = os.getenv("HOT_MATCH_MODEL", "gpt-6-luna")

POOL_SIZE = 50
TODAY_MAX = 3
# relevance at or above this is the "high" tier: three of the five on the page
HIGH = 7
LINKS_MAX = 8
MATCH_BATCH = 20
# a story is asked about again once this many more outlets have joined it
RECHECK_GROWTH = 2
REFRESH_DAYS = 30
# rewriting is a web search and a long answer per affair; the ingest pass has to
# end inside its fifteen minutes, so a month's refresh is spread over a few passes
REFRESH_PER_PASS = 12
REPORT_EVERY_DAYS = 27
WRITERS = 6

REPORT_TO = os.getenv("HOT_REPORT_TO", "haezrachh@gmail.com")
REPORT_FROM = os.getenv("HOT_REPORT_FROM", "haezrachh@gmail.com")
LOCAL_TZ = ZoneInfo("Asia/Jerusalem")


def _today() -> str:
    return datetime.now(LOCAL_TZ).strftime("%Y-%m-%d")


# ---- writing an affair -------------------------------------------------------

SIDE = {"type": "object", "additionalProperties": False,
        "required": ["coverage", "view", "motives"],
        "properties": {"coverage": {"type": "string"}, "view": {"type": "string"},
                       "motives": {"type": "string"}}}
AFFAIR = {
    "type": "object", "additionalProperties": False,
    "required": ["title", "one_line", "summary", "right", "left", "relevance",
                 "relevance_reason", "status_date", "match_hint", "sources"],
    "properties": {
        "title": {"type": "string"}, "one_line": {"type": "string"},
        "summary": {"type": "string"}, "right": SIDE, "left": SIDE,
        "relevance": {"type": "integer"}, "relevance_reason": {"type": "string"},
        "status_date": {"type": "string"}, "match_hint": {"type": "string"},
        "sources": {"type": "array", "items": {"type": "string"}},
    },
}

WRITE = """אתה עורך באתר חדשות ישראלי שמציג לקוראים מחלוקות ציבוריות בהגינות כלפי שני הצדדים. היום {today}.
חפש ברשת מידע עדכני ומהימן על הסוגיה שתקבל, ואז כתוב בעברית פשוטה ובהירה:

- title: שם קצר וניטרלי לסוגיה, 2 עד 6 מילים. כשלכל צד שם משלו לאותו דבר (למשל "רפורמה משפטית" ו"הפיכה משטרית") כתוב את שניהם.
- one_line: משפט אחד, עד 15 מילים, שאומר במה המחלוקת.
- summary: סיכום עובדתי של פרטי הפרשה - מה בדיוק מוצע או קרה, מי מוביל, הפרטים המהותיים שרוב הציבור לא מכיר, ומה המצב נכון להיום. 70 עד 110 מילים, בלי שיפוט ובלי תארים טעונים.
- right.coverage: איך כלי התקשורת המזוהים עם הימין מסקרים את הסוגיה - על מה הם שמים דגש ובאיזה מסגור. משפט או שניים. כתוב "תקשורת הימין", "כלי תקשורת ימניים" וכדומה, בלי שמות של כלי תקשורת.
- right.view: איך הימין תופס את הסוגיה ומה עמדתו. משפט או שניים.
- right.motives: הערכים, המניעים והאינטרסים של הימין, מנוסחים כפי שהצד עצמו היה מנסח אותם במיטבו. משפט או שניים.
- left.coverage, left.view, left.motives: אותו דבר לשמאל.
- relevance: מספר שלם 1 עד 10 - עד כמה הסוגיה מקטבת ובוערת בישראל עכשיו. 10: בלב הכותרות והוויכוח השבוע. 7: מחלוקת פעילה שעלתה בכותרות בחודש האחרון. 4: מחלוקת ידועה שכרגע שקטה. 1: כמעט לא עולה. relevance_reason: משפט שמסביר את הציון.
- status_date: תאריך ההתפתחות האחרונה שמצאת, YYYY-MM-DD.
- match_hint: לשימוש פנימי בלבד - שורה אחת של שמות, מונחים, הצעות חוק ואירועים שלפיהם מזהים כתבת חדשות שעוסקת בסוגיה הזו, ומה לא נחשב לה.
- sources: עד 5 כתובות שעליהן הסתמכת.

כללים:
- אל תמציא עובדות, מספרים, תאריכים או ציטוטים. מה שלא מצאת במקור - אל תכתוב.
- שני הצדדים מקבלים אותו אורך, אותו טון ואותה רמת פירוט, וכל אחד מוצג במיטבו.
- תווית או טענה של צד אחד מיוחסת לו ("לטענת התומכים", "המתנגדים מכנים").
- בלי קישורים ובלי הפניות למקורות בתוך הטקסט - הם הולכים רק ל-sources.
- "ימין" ו"שמאל" הם הגושים הפוליטיים בישראל. אם העמדות חוצות גושים, אמור זאת בקצרה.
- בשום שדה אין שמות של כלי תקשורת - ערוצים, עיתונים, אתרים, תחנות, תוכניות או פודקאסטים - לא כמקור ולא כדוגמה. כתוב "בימין", "תקשורת הימין", "כלי תקשורת המזוהים עם השמאל", "בתקשורת" וכדומה. רק כלי תקשורת שהוא עצמו נושא הסוגיה (למשל תחנה שהממשלה מבקשת לסגור) נקרא בשמו.
- ענה ב-JSON בלבד."""

UPDATE = """
זו הגרסה הקיימת שמוצגת לקוראים. בדוק ברשת מה השתנה מאז, עדכן את מה שהשתנה (כולל המצב הנוכחי והציון), ושמור על הניסוח במקומות שבהם לא השתנה דבר:
{current}"""


def _respond(instructions: str, prompt: str, schema: dict, name: str,
             effort: str = WRITE_EFFORT, search: bool = True) -> dict:
    """One call to the writer, answered in the given JSON schema."""
    body = {"model": WRITE_MODEL, "instructions": instructions, "input": prompt,
            "reasoning": {"effort": effort},
            "text": {"format": {"type": "json_schema", "name": name,
                                "schema": schema, "strict": True}}}
    if search:
        body["tools"] = [{"type": "web_search"}]
    reply = _post("/responses", body, timeout=900)
    text = "".join(part.get("text", "") for item in reply.get("output", [])
                   if item.get("type") == "message" for part in item.get("content", []))
    return json.loads(text)


# a model that was told not to cite inline sometimes still does: "([site](url))" goes,
# and a link inside a sentence keeps its words
_CITE = re.compile(r"\s*\(\[[^\]]*\]\([^)]*\)\)")
_LINK = re.compile(r"\[([^\]]*)\]\(https?://[^)]*\)")


def _clean(text: str) -> str:
    text = _LINK.sub(r"\1", _CITE.sub("", text or ""))
    return re.sub(r"\s{2,}", " ", text).strip()


def write_affair(topic: dict) -> dict:
    """The affair written, or written again, from the web as it is today."""
    prompt = f"הסוגיה: {topic['title']}"
    if topic.get("one_line"):
        prompt += f"\nבמה מדובר: {topic['one_line']}"
    if topic.get("summary"):
        current = {k: topic.get(k) for k in ("title", "one_line", "summary", "right", "left",
                                              "relevance", "relevance_reason", "status_date")}
        prompt += UPDATE.format(current=json.dumps(current, ensure_ascii=False))
    out = _respond(WRITE.format(today=_today()), prompt, AFFAIR, "affair")
    for side in ("right", "left"):
        out[side] = {k: _clean(v) for k, v in out[side].items()}
    for key in ("title", "one_line", "summary", "relevance_reason", "match_hint"):
        out[key] = _clean(out[key])
    out["relevance"] = max(1, min(10, int(out["relevance"])))
    out["sources"] = [s.split("?utm_source")[0] for s in out.get("sources", [])][:5]
    return out


def _store(topic_id: str, before: dict, written: dict) -> dict:
    changed = _norm(before.get("summary")) != _norm(written["summary"]) or any(
        _norm((before.get(side) or {}).get(k)) != _norm(written[side][k])
        for side in ("right", "left") for k in ("coverage", "view", "motives"))
    doc = written | {"updated_at": db.now(), "active": before.get("active", True),
                     "changed": changed or not before.get("summary"),
                     "previous_relevance": before.get("relevance")}
    if not before.get("created_at"):
        doc["created_at"] = db.now()
    db.save_polar(topic_id, doc)
    return doc


def _norm(text) -> str:
    return re.sub(r"\W+", "", text or "")


def rewrite(topics: list[dict]) -> int:
    """Write each of these again, side by side. An affair that fails keeps its text."""
    def one(topic):
        try:
            _store(topic["id"], topic, write_affair(topic))
            print(f"  ✓ {topic['title']}")
            return 1
        except (OpenAIUnavailable, ValueError, KeyError) as err:
            print(f"  ! {topic['title']}: {err}")
            return 0
    with ThreadPoolExecutor(WRITERS) as pool:
        return sum(pool.map(one, topics))


# ---- proposing the pool ------------------------------------------------------

PROPOSAL = {
    "type": "object", "additionalProperties": False, "required": ["topics"],
    "properties": {"topics": {"type": "array", "items": {
        "type": "object", "additionalProperties": False,
        "required": ["id", "title", "one_line", "relevance", "relevance_reason"],
        "properties": {"id": {"type": "string"}, "title": {"type": "string"},
                       "one_line": {"type": "string"}, "relevance": {"type": "integer"},
                       "relevance_reason": {"type": "string"}}}}},
}

PROPOSE = """אתה עורך באתר חדשות ישראלי שמציג לקוראים את המחלוקות שמפלגות את הציבור בין ימין לשמאל. היום {today}.
המטרה: מאגר של {count} סוגיות ופרשות שמקטבות את החברה הישראלית ושיש עליהן מחלוקת אמיתית בין הימין לשמאל - כאלה שאנשים מתווכחים עליהן בלי להכיר את הפרטים.

חפש ברשת מה מעסיק ומפלג את הציבור בתקופה האחרונה, והיעזר גם בכותרות של היום ובתחומים שתקבל.
- העדף פרשות קונקרטיות - הצעת חוק, החלטה, אירוע, מדיניות - על פני נושאים כלליים, וכלול גם מחלוקות מתמשכות חשובות.
- פרש את המאגר על פני כל התחומים: מלחמה וביטחון, מערכת המשפט ושלטון החוק, דת ומדינה, תקשורת, כלכלה וחברה, יחסי חוץ, יהודה ושומרון והסכסוך, החברה הערבית, בחירות ומשילות.
- אל תכלול מה שאינו מחלוקת ימין-שמאל (פלילים, ספורט, אסונות), ולא פרשות זניחות או אזוטריות.
- בלי כפילויות: שתי סוגיות שהן אותו ויכוח הן סוגיה אחת.
- לפחות 15 מהן בציון 7 ומעלה.

לכל סוגיה:
- id: מזהה באנגלית, אותיות קטנות ומקפים.
- title: שם קצר וניטרלי, 2 עד 6 מילים. כשלכל צד שם משלו לאותו דבר, כתוב את שניהם.
- one_line: משפט אחד, עד 15 מילים, שאומר במה המחלוקת.
- relevance: 1 עד 10 - עד כמה היא מקטבת ובוערת עכשיו (10: בלב הכותרות השבוע; 7: עלתה בכותרות בחודש האחרון; 4: ידועה אבל שקטה כרגע). relevance_reason: משפט.
ענה ב-JSON בלבד."""


def _slug(text: str, taken: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "topic"
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    taken.add(slug)
    return slug


def propose(count: int) -> list[dict]:
    feed = db.read_feed()
    headlines = [story[0]["title"] for story in feed if story][:80]
    areas = "\n".join(f"- {name}: {desc}" for name, desc, _, _ in TOPICS.values())
    prompt = (f"התחומים שהאתר מסווג לפיהם:\n{areas}\n\n"
              "כותרות מהפיד של היום:\n" + "\n".join(f"- {h}" for h in headlines))
    out = _respond(PROPOSE.format(today=_today(), count=count), prompt, PROPOSAL,
                   "pool", effort="high")
    taken: set[str] = set()
    return [t | {"id": _slug(t["id"], taken)} for t in out["topics"]][:count]


# ---- matching the feed -------------------------------------------------------

MATCH = """לפניך סיפורי חדשות מאתרים ישראליים, כל אחד בכותרות שלו. לכל סיפור החזר את המזהים של הסוגיות מהרשימה שהסיפור עוסק בהן באופן ישיר ומהותי - בדרך כלל אף אחת.
סיפור שייך לסוגיה רק אם הוא מדווח על התפתחות בה, על המחלוקת סביבה או על מי שמוביל אותה בהקשר שלה. אזכור אגבי, או נושא קרוב שאינו אותה סוגיה, אינם מספיקים.

הסוגיות:
{topics}"""


def _match_schema(ids: list[str]) -> dict:
    return {"type": "object", "additionalProperties": False, "required": ["items"],
            "properties": {"items": {"type": "array", "items": {
                "type": "object", "additionalProperties": False, "required": ["id", "topics"],
                "properties": {"id": {"type": "string"},
                               "topics": {"type": "array", "items": {"type": "string", "enum": ids}}}}}}}


def _story_text(story: dict) -> str:
    seen, lines = set(), []
    for article in story.get("articles", []):
        header = (article.get("header") or "").strip()
        if header and header not in seen:
            seen.add(header)
            lines.append(header)
    first = next((a.get("subheader") for a in story.get("articles", []) if a.get("subheader")), "")
    return " | ".join(lines[:4]) + (f"\n{first[:300]}" if first else "")


def match(stories: list[dict], pool: list[dict]) -> dict[str, list[str]]:
    """The affairs each story is about, by story id; stories the model skipped are left out."""
    ids = [t["id"] for t in pool]
    listing = "\n".join(f"- {t['id']}: {t['title']} - {t.get('one_line', '')}"
                        f" (מזהים: {t.get('match_hint', '')})" for t in pool)
    instructions = MATCH.format(topics=listing)
    out: dict[str, list[str]] = {}
    for start in range(0, len(stories), MATCH_BATCH):
        batch = stories[start:start + MATCH_BATCH]
        payload = json.dumps([{"id": str(s["id"]), "text": _story_text(s)} for s in batch],
                             ensure_ascii=False)
        reply = _post("/chat/completions", {
            "model": MATCH_MODEL, "reasoning_effort": "low",
            "messages": [{"role": "developer", "content": instructions},
                         {"role": "user", "content": payload}],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": "hot_match", "strict": True, "schema": _match_schema(ids)}},
        })
        content = reply["choices"][0]["message"].get("content") or "{}"
        wanted = {str(s["id"]) for s in batch}
        for row in json.loads(content).get("items", []):
            if row.get("id") in wanted:
                out[row["id"]] = sorted(set(row.get("topics") or []))
    return out


def _pool_version(pool: list[dict]) -> str:
    return hashlib.sha1(",".join(sorted(t["id"] for t in pool)).encode()).hexdigest()[:10]


def update(stories: list[dict], feed: list[list]) -> None:
    """After the feed is built: match its new stories, then rebuild what the page reads."""
    pool = [t for t in db.all_polar() if t.get("active", True) and t.get("summary")]
    if not pool:
        return
    version = _pool_version(pool)
    todo = [s for s in stories
            if s.get("polar_v") != version
            or len(s.get("articles", [])) >= (s.get("polar_n") or 0) + RECHECK_GROWTH]
    if todo:
        try:
            found = match(todo, pool)
        except OpenAIUnavailable as err:
            print(f"hot      ! matching failed, retried next pass: {err}")
            found = {}
        writer = db.Writer()
        for story in todo:
            sid = str(story["id"])
            if sid not in found:
                continue
            story["polar"] = found[sid]
            story["polar_n"] = len(story.get("articles", []))
            story["polar_v"] = version
            writer.set(db.client().collection("stories").document(sid),
                       {"polar": story["polar"], "polar_n": story["polar_n"],
                        "polar_v": version}, merge=True)
        writer.flush()
    build(pool, stories, feed)
    print(f"hot      {len(todo)} stories matched against {len(pool)} affairs")


def build(pool: list[dict], stories: list[dict], feed: list[list]) -> None:
    by_story = {str(s["id"]): s.get("polar") or [] for s in stories}
    links: dict[str, list[dict]] = {}
    for items in feed:
        if not items:
            continue
        sid = str(items[0].get("groupId"))
        for topic_id in by_story.get(sid, []):
            links.setdefault(topic_id, []).append(
                {"id": sid, "title": items[0].get("title", ""), "outlets": len(items)})
    for entries in links.values():
        entries.sort(key=lambda e: -e["outlets"])

    def weight(t):
        return (sum(e["outlets"] for e in links.get(t["id"], [])), t.get("relevance", 0))
    today = [t["id"] for t in sorted(pool, key=weight, reverse=True) if links.get(t["id"])][:TODAY_MAX]

    shown = []
    for t in sorted(pool, key=lambda t: -t.get("relevance", 0)):
        own = links.get(t["id"], [])[:LINKS_MAX]
        shown.append({
            "id": t["id"], "title": t["title"], "one_line": t.get("one_line", ""),
            "summary": t["summary"], "right": t["right"], "left": t["left"],
            "relevance": t.get("relevance", 0),
            # in the news today counts as burning, whatever the month's score said
            "tier": "high" if t.get("relevance", 0) >= HIGH or own else "low",
            "status_date": t.get("status_date", ""),
            "updated": t["updated_at"].isoformat() if t.get("updated_at") else "",
            "links": own,
        })
    db.write_hot({"today": today, "topics": shown})


def rebuild_from_feed() -> None:
    """Match the current feed and rebuild meta/hot, without an ingest pass."""
    from ingest import feed_stories
    stories = feed_stories()
    update(stories, db.read_feed())


def rebuild_page() -> None:
    """Rebuild meta/hot from the matches the feed's stories already carry, asking the
    model nothing: for when the affairs' words changed and not which affairs there are."""
    from ingest import feed_stories
    pool = [t for t in db.all_polar() if t.get("active", True) and t.get("summary")]
    build(pool, feed_stories(), db.read_feed())


# ---- the monthly refresh and its report -----------------------------------------

def _age_days(topic: dict) -> float:
    at = topic.get("updated_at")
    return (db.now() - at).total_seconds() / 86400 if at else 1e9


def maybe_refresh() -> None:
    """At the end of a pass: rewrite a few affairs that are a month old, and once
    none is, mail the report if the last one is older than REPORT_EVERY_DAYS."""
    pool = [t for t in db.all_polar() if t.get("active", True)]
    if not pool:
        return
    due = sorted((t for t in pool if _age_days(t) >= REFRESH_DAYS), key=_age_days, reverse=True)
    if due:
        print(f"hot      refreshing {min(len(due), REFRESH_PER_PASS)} of {len(due)} affairs due")
        rewrite(due[:REFRESH_PER_PASS])
        return
    sent = db.hot_state().get("report_sent_at")
    if sent and (db.now() - sent).days < REPORT_EVERY_DAYS:
        return
    send_report()


def _gmail_password() -> str | None:
    """The app password of the sending account, from the environment or Secret Manager."""
    value = os.getenv("GMAIL_APP_PASSWORD")
    if not value:
        try:
            import google.auth
            from google.auth.transport.requests import AuthorizedSession
            creds, project = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"])
            project = db.PROJECT or project
            r = AuthorizedSession(creds).get(
                f"https://secretmanager.googleapis.com/v1/projects/{project}"
                "/secrets/GMAIL_APP_PASSWORD/versions/latest:access", timeout=30)
            if r.status_code == 200:
                value = base64.b64decode(r.json()["payload"]["data"]).decode()
        except Exception as err:          # no secret, no access: the report waits
            print(f"hot      ! could not read GMAIL_APP_PASSWORD: {err}")
    return value.replace(" ", "").strip() if value else None


def report_html(pool: list[dict]) -> str:
    hot = db.read_hot()
    today = set(hot.get("today") or [])
    linked = {t["id"]: len(t.get("links") or []) for t in hot.get("topics") or []}
    pool = sorted(pool, key=lambda t: -t.get("relevance", 0))
    high = sum(1 for t in pool if t.get("relevance", 0) >= HIGH)
    e = html.escape

    def side(name, ink, soft, s):
        return (f'<td style="background:{soft};padding:8px;vertical-align:top;width:50%">'
                f'<b style="color:{ink}">{name}</b><br>'
                f'<b>סיקור:</b> {e(s.get("coverage", ""))}<br>'
                f'<b>תפיסה:</b> {e(s.get("view", ""))}<br>'
                f'<b>מניעים:</b> {e(s.get("motives", ""))}</td>')

    rows = []
    for n, t in enumerate(pool, 1):
        tier = "גבוה" if t.get("relevance", 0) >= HIGH else "נמוך-בינוני"
        flags = []
        if t["id"] in today:
            flags.append("בנושאים החמים היום")
        if linked.get(t["id"]):
            flags.append(f"{linked[t['id']]} סיפורים בפיד")
        if t.get("changed"):
            prev = t.get("previous_relevance")
            flags.append("עודכן" + (f" (ציון קודם {prev})" if prev not in (None, t.get("relevance")) else ""))
        else:
            flags.append("ללא שינוי מהותי")
        sources = " · ".join(f'<a href="{e(s)}">{e(s.split("/")[2] if "//" in s else s)}</a>'
                             for s in t.get("sources") or [])
        rows.append(
            f'<div style="border:1px solid #ddd;border-radius:10px;padding:12px;margin:14px 0">'
            f'<div style="font-size:17px"><b>{n}. {e(t["title"])}</b> '
            f'<span style="color:#666">· ציון {t.get("relevance")} ({tier}) · {" · ".join(flags)}</span></div>'
            f'<div style="color:#444;margin:4px 0">{e(t.get("one_line", ""))}</div>'
            f'<div style="color:#666;font-size:13px">{e(t.get("relevance_reason", ""))} '
            f'(התפתחות אחרונה: {e(t.get("status_date", ""))})</div>'
            f'<p>{e(t.get("summary", ""))}</p>'
            f'<table style="width:100%;border-collapse:separate;border-spacing:6px"><tr>'
            f'{side("ימין", "#C0392F", "#FBEDEB", t.get("right") or {})}'
            f'{side("שמאל", "#2B5EA7", "#EDF1F9", t.get("left") or {})}</tr></table>'
            f'<div style="font-size:12px;color:#666">מקורות: {sources}</div></div>')
    return (
        f'<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">'
        f'<h2>נושאים חמים - דו״ח חודשי, {_today()}</h2>'
        f'<p>{len(pool)} סוגיות במאגר, {high} מהן בציון {HIGH} ומעלה. '
        f'בכל כניסה לאפליקציה מוצגות בקטע "מקוטבים" 5 סוגיות: 3 מהציון הגבוה ו-2 מהנמוך-בינוני, '
        f'מוגרלות מחדש. סוגיה שיש עליה סיפורים בפיד של היום נחשבת גבוהה גם אם הציון שלה נמוך. '
        f'"הנושאים החמים היום" הם עד 3 סוגיות שיש עליהן סיפורים בפיד, לפי היקף הסיקור.</p>'
        f'<p>כל סוגיה נכתבה מחדש מול הרשת בחודש האחרון. מה לשנות, להוסיף או להוריד - '
        f'אפשר לבקש בשיחה עם Claude.</p>'
        + "".join(rows) + "</div>")


def send_report() -> bool:
    pool = [t for t in db.all_polar() if t.get("active", True) and t.get("summary")]
    if not pool:
        return False
    password = _gmail_password()
    if not password:
        print("hot      report ready, not sent: no GMAIL_APP_PASSWORD in Secret Manager")
        return False
    msg = MIMEText(report_html(pool), "html", "utf-8")
    msg["Subject"] = f"האזרח הקטן - נושאים חמים, דו״ח חודשי {_today()}"
    msg["From"] = REPORT_FROM
    msg["To"] = REPORT_TO
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=60) as smtp:
            smtp.login(REPORT_FROM, password)
            smtp.sendmail(REPORT_FROM, [REPORT_TO], msg.as_string())
    except (smtplib.SMTPException, OSError) as err:
        print(f"hot      ! report not sent: {err}")
        return False
    db.save_hot_state({"report_sent_at": db.now(), "report_topics": len(pool)})
    print(f"hot      report sent to {REPORT_TO} ({len(pool)} affairs)")
    return True


# ---- commands ----------------------------------------------------------------

def seed(count: int) -> None:
    existing = {t["id"]: t for t in db.all_polar()}
    if any(t.get("summary") for t in existing.values()):
        print(f"{len(existing)} affairs already in the pool - writing only the missing ones")
        topics = [t for t in existing.values() if t.get("active", True) and not t.get("summary")]
    else:
        print(f"proposing {count} affairs with {WRITE_MODEL}")
        topics = propose(count)
        for t in topics:
            db.save_polar(t["id"], {k: t[k] for k in ("title", "one_line", "relevance",
                                                       "relevance_reason")} | {"active": True})
        print(f"  {len(topics)} proposed")
    print(f"writing {len(topics)} affairs")
    print(f"  {rewrite(topics)} written")
    rebuild_from_feed()


def load(path: str, force: bool) -> None:
    """Affairs written outside the writer model - by hand, or in a session when the
    model could not run - from a JSON file of {id: affair} in the shape write_affair()
    returns. One that already has its text is left as it is unless forced. They are
    rewritten by the monthly refresh like any other."""
    with open(path, encoding="utf-8") as fh:
        affairs = json.load(fh)
    pool = {t["id"]: t for t in db.all_polar()}
    for topic_id, affair in affairs.items():
        before = pool.get(topic_id, {})
        if before.get("summary") and not force:
            print(f"  = {topic_id}: already written, left as it is")
            continue
        _store(topic_id, before, affair)
        print(f"  ✓ {affair['title']}")
    rebuild_from_feed()


EDITABLE = ("title", "one_line", "summary")


def edit(path: str) -> None:
    """Corrections made by hand to affairs already written, from a JSON file of
    {id: {field: text}}, a field being title, one_line, summary, or a side's
    "right.coverage", "left.motives" and the like. Only those fields are set, and an
    affair keeps its updated_at: it was corrected, not written again. The page is then
    rebuilt without asking the model about any story."""
    with open(path, encoding="utf-8") as fh:
        edits = json.load(fh)
    pool = {t["id"]: t for t in db.all_polar()}
    for topic_id, fields in edits.items():
        before = pool.get(topic_id)
        if not before:
            print(f"  ! {topic_id}: not in the pool")
            continue
        doc = {}
        for field, text in fields.items():
            side, _, key = field.partition(".")
            if key:
                if side not in ("right", "left") or key not in SIDE["properties"]:
                    raise ValueError(f"{topic_id}: no field {field}")
                if (before.get(side) or {}).get(key) != text:
                    doc[side] = (doc.get(side) or dict(before.get(side) or {})) | {key: text}
            elif field in EDITABLE:
                if before.get(field) != text:
                    doc[field] = text
            else:
                raise ValueError(f"{topic_id}: no field {field}")
        if not doc:
            print(f"  = {topic_id}: already so")
            continue
        db.save_polar(topic_id, doc | {"edited_at": db.now()})
        print(f"  ✓ {topic_id}: {', '.join(fields)}")
    rebuild_page()


def table() -> None:
    pool = sorted((t for t in db.all_polar() if t.get("active", True)),
                  key=lambda t: -t.get("relevance", 0))
    for n, t in enumerate(pool, 1):
        print(json.dumps({"n": n, "id": t["id"], "title": t["title"],
                          "one_line": t.get("one_line"), "relevance": t.get("relevance"),
                          "reason": t.get("relevance_reason"), "status": t.get("status_date"),
                          "right": (t.get("right") or {}).get("view"),
                          "left": (t.get("left") or {}).get("view")}, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("seed"); p.add_argument("--count", type=int, default=POOL_SIZE)
    p = sub.add_parser("add"); p.add_argument("title")
    p = sub.add_parser("drop"); p.add_argument("id")
    p = sub.add_parser("rewrite"); p.add_argument("ids", nargs="+")
    p = sub.add_parser("relevance"); p.add_argument("id"); p.add_argument("score", type=int)
    sub.add_parser("refresh")
    p = sub.add_parser("report"); p.add_argument("--send", action="store_true")
    sub.add_parser("build")
    sub.add_parser("table")
    p = sub.add_parser("load"); p.add_argument("path"); p.add_argument("--force", action="store_true")
    p = sub.add_parser("edit"); p.add_argument("path")
    args = parser.parse_args()

    if args.cmd == "seed":
        seed(args.count)
    elif args.cmd == "add":
        taken = {t["id"] for t in db.all_polar()}
        # a Hebrew title has no letters a URL-safe id can keep
        digest = hashlib.sha1(args.title.encode()).hexdigest()[:6]
        topic = {"id": _slug(f"topic-{digest}", taken), "title": args.title}
        _store(topic["id"], {}, write_affair(topic))
        print(f"added {topic['id']}")
        rebuild_from_feed()
    elif args.cmd == "drop":
        db.save_polar(args.id, {"active": False})
        rebuild_from_feed()
    elif args.cmd == "rewrite":
        pool = {t["id"]: t for t in db.all_polar()}
        rewrite([pool[i] for i in args.ids if i in pool])
        rebuild_from_feed()
    elif args.cmd == "relevance":
        db.save_polar(args.id, {"relevance": max(1, min(10, args.score)),
                                "relevance_reason": "נקבע ידנית"})
        rebuild_from_feed()
    elif args.cmd == "refresh":
        maybe_refresh()
    elif args.cmd == "report":
        pool = [t for t in db.all_polar() if t.get("active", True) and t.get("summary")]
        if args.send:
            send_report()
        else:
            print(report_html(pool))
    elif args.cmd == "build":
        rebuild_from_feed()
    elif args.cmd == "table":
        table()
    elif args.cmd == "load":
        load(args.path, args.force)
    elif args.cmd == "edit":
        edit(args.path)


if __name__ == "__main__":
    main()
