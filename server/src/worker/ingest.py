"""One ingest pass: scrape -> embed -> group into stories -> tag -> summarise -> feed.

Cloud Scheduler starts this every half hour as a Cloud Run job. The scraping is the
original worker's, unchanged; the two models it used locally now run on OpenAI's API
(gpt_models.py); the stories live in Firestore (store/db.py).

    python ingest.py --once          one pass, what the scheduled job runs
    python ingest.py --scrape-only   fetch every site and report, write nothing
    python ingest.py --feed          rebuild the feed document only
    python ingest.py --summaries     write the missing summaries only
    python ingest.py --cleanup       drop the vectors of stories nothing will join

The pass is deliberately all-or-nothing on embeddings: if OpenAI does not answer,
nothing is stored and the same items are still in the feeds half an hour later.
"""
import argparse
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import numpy as np

import hot_topics
from gpt_models import OTHER, TAG_MODEL, OpenAIUnavailable, classify, embed, same_event
from scraping import article_key, fetch_entries, has_arabic, parse_entry, translate_to_hebrew
from store import db
from store.positions import overall, positions_for_topic
from store.taxonomy import GENERAL_SECTION, SECTION_HINTS, SECTIONS
from store.summaries import (BLOCS, GEMINI_API_KEY, SUMMARY_MAX_PER_CYCLE,
                            SUMMARY_MIN_GAP, SUMMARY_WINDOW, QuotaExhausted,
                            articles_for, prompt as summary_prompt, summarise)

GENERAL_TOPIC = db.GENERAL_TOPIC

# Every embedding model has a scale of its own - the previous one needed 0.75, and
# dictabert before it 0.88. Set by calibrate.py, which replays the grouping over
# stored articles and scores each threshold against the stories already there.
SIMILARITY_THRESHOLD = 0.70
SAME_ARTICLE_THRESHOLD = 0.97
TIME_WINDOW_HOURS = 12
# An article that opens a story by falling just short of the threshold leaves the
# event split in two for good, because nothing compared stories to each other: Kan
# and Haredim 10 in one, Srugim and Davar in another, one IDF statement between
# them. After placing, stories this close are put to the model as a pair, and only
# the ones it calls the same event are joined. The floor only decides what is
# worth asking about - the model decides - and the cap bounds one call a cycle.
SPLIT_FLOOR = 0.55
SPLIT_MAX_PAIRS = 40
# a cap on one cycle, so the first run after a long gap stays bounded; newest kept
MAX_PER_CYCLE = 250

# A human correction outranks the model. Every dev-mode fix keeps the article's
# vector, and a new article close enough to one takes its topic outright. Further
# away they still teach, as precedent inside the tagging model's instructions.
CORRECTION_MATCH = 0.70
CORRECTION_EXAMPLES = 40

# A new article is matched against the stories of the last TIME_WINDOW_HOURS, so a
# vector is dead weight long before its story is deleted.
EMBED_KEEP_HOURS = 24
# A story and its headlines are dropped once they are past the feed. The feed shows
# today's stories, or the last 24 hours when the day is young, so 30 hours leaves a
# margin and keeps nothing a reader could still see. Nothing that was learned goes
# with them: an outlet's position on a topic is five numbers on the topic's own
# document, and a rating or a stance reading is folded in when it happens.
RETENTION_HOURS = 30
# at most this many stories deleted per cycle, so a long outage cannot turn one run
# into a mass delete
RETENTION_MAX = 400

# Readers think in Israeli calendar days, the database stores UTC. A day that has
# barely started has barely any news, so a thin morning falls back to a rolling day.
LOCAL_TZ = ZoneInfo("Asia/Jerusalem")
MIN_STORIES = 5

SEEN_HOURS = 24


# ---- scraping ----------------------------------------------------------------

def scrape(sites: list[dict], seen: dict, translate: bool = True,
           newest: dict | None = None) -> list[dict]:
    """Every site's feed, minus what was already stored in the last day.

    newest, when given, collects each outlet's freshest item whether or not it is
    new to us - which is what tells a quiet newsroom apart from a feed that has
    stopped moving."""
    from concurrent.futures import ThreadPoolExecutor

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=SEEN_HOURS)
    # keyed the same way remember() keys them; a list written before the keys
    # were is keyed here
    known_links = {article_key(link) for link in seen.get("links", [])}
    known_headers = set(seen.get("headers", []))

    # An outlet may publish more than one feed - mako splits its news by section,
    # and one section's feed had been abandoned while the others kept going. A site
    # can name several, and they are read as one.
    jobs = [(site["name"], url)
            for site in sites
            for url in (site.get("feeds") or [site.get("domain")])]
    with ThreadPoolExecutor(max_workers=10) as pool:
        fetched = list(pool.map(lambda job: (job[0], fetch_entries(job[0], job[1])), jobs))
    feeds: dict[str, list] = {}
    for name, entries in fetched:
        feeds.setdefault(name, []).extend(entries)

    fresh, untranslated = [], 0
    for site in sites:
        entries = feeds.get(site["name"], [])
        kept = 0
        for entry in entries:
            parsed = parse_entry(entry, site["name"])
            if not parsed:
                continue
            if newest is not None:
                first = newest.get(site["name"])
                if first is None or first < parsed["created_at"]:
                    newest[site["name"]] = parsed["created_at"]
            if article_key(parsed["link"]) in known_links or parsed["header"] in known_headers:
                continue
            if parsed["created_at"] < cutoff:
                continue
            if site.get("language", "he") != "he" or has_arabic(parsed["header"]) \
                    or has_arabic(parsed["subheader"]):
                if not translate:
                    kept += 1
                    continue
                done = translate_to_hebrew(parsed["header"], parsed["subheader"])
                # a failed or partial translation must never be stored: nothing
                # downstream checks again
                if done is None or has_arabic(done[0]) or has_arabic(done[1] or ""):
                    untranslated += 1
                    continue
                parsed["header"], parsed["subheader"] = done[0], done[1] or done[0]

            known_links.add(article_key(parsed["link"]))
            known_headers.add(parsed["header"])
            parsed["site_id"] = site["id"]
            parsed["site"] = site["name"]
            parsed["language"] = site.get("language", "he")
            fresh.append(parsed)
            kept += 1
        suffix = "" if site.get("language", "he") == "he" else "  (מתורגם)"
        print(f"  {site['name']:<18} {len(entries):>3} entries, {kept:>3} new{suffix}")
    if untranslated:
        print(f"  ! {untranslated} פריטים בערבית דולגו")
    return fresh


SILENT_AFTER_HOURS = 24


def note_health(sites: list[dict], newest: dict) -> None:
    """How fresh each outlet's feed is, and who has stopped moving.

    Three of the largest outlets in the country were pointed at feeds that had
    stopped updating - one of them in May - and nothing noticed, because a feed
    full of old items looks exactly like a newsroom having a quiet day. What is
    measured here is the age of the newest item an outlet offers, which tells the
    two apart.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ages = {name: (now - when).total_seconds() / 3600 for name, when in newest.items()}
    db.client().collection("meta").document("health").set(
        {"newest_item_hours": {name: round(age, 1) for name, age in ages.items()},
         "checked_at": db.now()}, merge=True)

    stale = [f"{site['name']} ({ages[site['name']]:.0f}h)" for site in sites
             if site["name"] in ages and ages[site["name"]] > SILENT_AFTER_HOURS]
    unreachable = [site["name"] for site in sites if site["name"] not in ages]
    if stale:
        print(f"  ! STALE FEEDS: {', '.join(stale)}")
    if unreachable:
        print(f"  ! NOTHING CAME BACK FROM: {', '.join(unreachable)}")


def remember(fresh: list[dict], seen: dict) -> None:
    """Keep one day of links and headlines, so the next cycle skips them.

    A link is kept as its article_key, so a mako article that comes back under
    another section's address is still known."""
    stamp = time.time()
    links = list(seen.get("links", []))
    headers = list(seen.get("headers", []))
    stamps = list(seen.get("at", []))
    for entry in fresh:
        links.append(article_key(entry["link"]))
        headers.append(entry["header"])
        stamps.append(stamp)
    keep = [i for i, at in enumerate(stamps) if stamp - at < SEEN_HOURS * 3600]
    db.save_seen([links[i] for i in keep], [headers[i] for i in keep],
                 [stamps[i] for i in keep])


# ---- grouping ----------------------------------------------------------------

class Stories:
    """The stories of the last TIME_WINDOW_HOURS, held in memory for one pass.

    Same rules as the original clusterer: an article joins the closest story above
    SIMILARITY_THRESHOLD, a story holds at most one article per outlet, and when an
    outlet's slot is taken the article closer to the centre of the story keeps it.
    """

    def __init__(self, stories: list[dict]):
        self.by_id = {s["id"]: s for s in stories}
        self.dirty: set = set()
        # stories folded into another one in this pass, to delete when it is written
        self.gone: set = set()
        self.centroids = {s["id"]: db.unpack(s.get("centroid")) for s in stories}
        self.vectors = {}
        for story in stories:
            for article in story.get("articles", []):
                self.vectors[article["id"]] = db.unpack(article.get("v"))

    def _candidates(self, when: datetime):
        window_start = when - timedelta(hours=TIME_WINDOW_HOURS)
        for story_id, centroid in self.centroids.items():
            if centroid is None:
                continue
            if self.by_id[story_id]["created_at"] < window_start:
                continue
            yield story_id, centroid

    def place(self, article: dict, vector, new_story_id) -> str:
        best, best_score = None, -1.0
        for story_id, centroid in self._candidates(article["created_at"]):
            score = float(vector @ centroid / (np.linalg.norm(centroid) or 1.0))
            if score > best_score:
                best, best_score = story_id, score

        if best is None or best_score < SIMILARITY_THRESHOLD:
            self._open(article, vector, new_story_id)
            return "new"

        story = self.by_id[best]
        rival = next((a for a in story["articles"] if a["site_id"] == article["site_id"]), None)
        if rival is None:
            self._join(story, article, vector)
            return "joined"

        rival_vector = self.vectors.get(rival["id"])
        if rival_vector is None:
            self._open(article, vector, new_story_id)
            return "new"
        if float(vector @ rival_vector) > SAME_ARTICLE_THRESHOLD:
            return "duplicate"      # the same story again from the same outlet

        centroid = self.centroids[best]
        rival_score = float(rival_vector @ centroid / (np.linalg.norm(centroid) or 1.0))
        if best_score <= rival_score:
            self._open(article, vector, new_story_id)
            return "new"
        story["articles"] = [a for a in story["articles"] if a["id"] != rival["id"]]
        self._join(story, article, vector)
        return "replaced"

    def _open(self, article: dict, vector, story_id) -> None:
        article["story_id"] = story_id
        self.by_id[story_id] = {
            "id": story_id,
            "created_at": article["created_at"],
            "last_updated": article["created_at"],
            "articles": [article],
            "centroid": db.pack(vector),
            "summaries": {},
        }
        self.centroids[story_id] = np.asarray(vector, dtype=np.float32)
        self.vectors[article["id"]] = vector
        self.dirty.add(story_id)

    def _join(self, story: dict, article: dict, vector) -> None:
        article["story_id"] = story["id"]
        story["articles"].append(article)
        story["last_updated"] = max(story["last_updated"], article["created_at"])
        self.vectors[article["id"]] = vector
        self._recentre(story)

    def _recentre(self, story: dict) -> None:
        members = [self.vectors[a["id"]] for a in story["articles"]
                   if self.vectors.get(a["id"]) is not None]
        if members:
            centroid = np.mean(members, axis=0)
            self.centroids[story["id"]] = centroid
            story["centroid"] = db.pack(centroid)
        self.dirty.add(story["id"])

    def splits(self, floor: float, limit: int) -> list[tuple[float, object, object]]:
        """Pairs of stories close enough to be one event told twice, closest first.

        Only pairs with a story touched in this pass: every pair is looked at in the
        pass its later story opens, and again whenever either one changes, so
        nothing is asked twice about two stories that have not moved."""
        live = [sid for sid, story in self.by_id.items()
                if story.get("articles") and self.centroids.get(sid) is not None]
        unit = {sid: self.centroids[sid] / (np.linalg.norm(self.centroids[sid]) or 1.0)
                for sid in live}
        window = timedelta(hours=TIME_WINDOW_HOURS)
        found = []
        for i, a in enumerate(live):
            for b in live[i + 1:]:
                if a not in self.dirty and b not in self.dirty:
                    continue
                if abs(self.by_id[a]["created_at"] - self.by_id[b]["created_at"]) > window:
                    continue
                score = float(unit[a] @ unit[b])
                if score >= floor:
                    found.append((score, a, b))
        # by score alone: an id is a number for a story opened in this pass and a
        # string for one read back from Firestore, and the two do not compare
        found.sort(key=lambda pair: pair[0], reverse=True)
        return found[:limit]

    def merge(self, keep_id, other_id) -> list[dict]:
        """Fold one story into another. An outlet the kept story already has stays
        behind with its article, and the other story goes only once it is empty.
        Returns the articles that moved."""
        keep, other = self.by_id[keep_id], self.by_id[other_id]
        taken = {str(a["site_id"]) for a in keep["articles"]}
        moving = [a for a in other["articles"] if str(a["site_id"]) not in taken]
        if not moving:
            return []
        for article in moving:
            article["story_id"] = keep_id
        keep["articles"] += moving
        keep["created_at"] = min(keep["created_at"], other["created_at"])
        keep["last_updated"] = max(keep["last_updated"], other["last_updated"])
        self._recentre(keep)
        other["articles"] = [a for a in other["articles"] if str(a["site_id"]) in taken]
        if other["articles"]:
            self._recentre(other)
        else:
            del self.by_id[other_id]
            self.centroids.pop(other_id, None)
            self.dirty.discard(other_id)
            self.gone.add(other_id)
        return moving


def join_splits(stories: Stories) -> list[dict]:
    """Join the stories that are one event told twice. Returns the articles that moved.

    The model is asked once, about every close pair at the same time. Pairs are
    taken closest first, and a story already folded into another is followed to
    where it went, so three pieces of one event end up as one story."""
    pairs = stories.splits(SPLIT_FLOOR, SPLIT_MAX_PAIRS)
    if not pairs:
        return []

    def headlines(story_id):
        return [a["header"] for a in stories.by_id[story_id]["articles"]][:4]

    try:
        verdicts = same_event([(headlines(a), headlines(b)) for _, a, b in pairs])
    except OpenAIUnavailable as err:
        print(f"  ! split stories not checked in this pass: {err}")
        return []

    went_to: dict = {}

    def home(story_id):
        while story_id in went_to:
            story_id = went_to[story_id]
        return story_id

    moved = []
    for (score, a, b), same in zip(pairs, verdicts):
        a, b = home(a), home(b)
        if not same or a == b:
            continue
        # the bigger story keeps its id, and the older one when they are even
        keep, other = sorted((a, b), key=lambda s: (-len(stories.by_id[s]["articles"]),
                                                    stories.by_id[s]["created_at"]))
        kept_headline = stories.by_id[keep]["articles"][0]["header"]
        moving = stories.merge(keep, other)
        if not moving:
            continue
        if other in stories.gone:
            went_to[other] = keep
        moved += moving
        print(f"  joined ({score:.2f}) {kept_headline[:50]}  <-  {moving[0]['header'][:50]}")
    return moved


# ---- topics ------------------------------------------------------------------

def taught_topic(corrections: list[dict], vector):
    """The nearest dev-mode fix, when it is close enough to carry its topic across."""
    best, best_score = None, -1.0
    for correction in corrections:
        stored = db.unpack(correction.get("v"))
        if stored is None:
            continue
        score = float(vector @ stored / ((np.linalg.norm(stored) or 1.0)))
        if score > best_score:
            best, best_score = correction, score
    if best is None or best_score < CORRECTION_MATCH:
        return None
    return best


def tag(articles: list[dict], topics: list[dict], corrections: list[dict]) -> int:
    """Give each article its section and, where there is one, its issue.

    Returns how many came back with a real issue - the rest are news that is about
    none of them, which is most of them and is not a failure.
    """
    if not articles:
        return 0
    catalogue = {t["name"]: t.get("description") or t["name"]
                 for t in topics if t["name"] != GENERAL_TOPIC}
    ids = {t["name"]: t["id"] for t in topics}
    sections = {SECTIONS[key]: hint for key, hint in SECTION_HINTS.items()}
    examples = [(c["header"], OTHER if c["topic"] == GENERAL_TOPIC else c["topic"])
                for c in sorted(corrections, key=lambda c: c.get("created_at") or 0)[-CORRECTION_EXAMPLES:]
                if c.get("header")]
    answers = classify([(a["id"], f"{a['header']}\n{a['subheader']}") for a in articles],
                       catalogue, sections, examples)
    tagged = 0
    for article in articles:
        answer = answers.get(article["id"])
        if not answer:
            continue            # the model skipped it; the next cycle asks again
        name = answer.get("topic") or GENERAL_TOPIC
        article["topic"] = name
        article["topic_id"] = ids.get(name, ids.get(GENERAL_TOPIC))
        article["section"] = answer.get("section") or GENERAL_SECTION
        article["topic_model"] = TAG_MODEL
        tagged += name != GENERAL_TOPIC
    return tagged


def _majority(story: dict, field: str, fallback: str) -> str:
    """What most of a story's articles were given - its topic, or its section."""
    counts: dict[str, int] = {}
    for article in story.get("articles", []):
        value = article.get(field) or fallback
        counts[value] = counts.get(value, 0) + 1
    return max(counts, key=counts.get) if counts else fallback


def story_topic(story: dict) -> str:
    return _majority(story, "topic", GENERAL_TOPIC)


def story_section(story: dict) -> str:
    return _majority(story, "section", GENERAL_SECTION)


def note_coverage(stories: list[dict], topics: list[dict]) -> None:
    """Keep each outlet's latest headline per topic on the topic's own document, so
    the map needs no second query to show what an outlet last published."""
    ids = {t["name"]: t["id"] for t in topics}
    latest: dict[tuple, dict] = {}
    for story in stories:
        for article in story.get("articles", []):
            topic_id = ids.get(article.get("topic") or GENERAL_TOPIC)
            if topic_id is None:
                continue
            key = (topic_id, str(article["site_id"]))
            if key not in latest or latest[key]["at"] < article["created_at"]:
                latest[key] = {"header": article["header"], "at": article["created_at"]}
    by_topic: dict[str, dict] = {}
    for (topic_id, site_id), entry in latest.items():
        by_topic.setdefault(str(topic_id), {})[site_id] = {"latest": entry}
    writer = db.Writer()
    for topic_id, sites in by_topic.items():
        writer.set(db.topic_state_ref(topic_id), {"sites": sites}, merge=True)
    writer.flush()


# ---- summaries ---------------------------------------------------------------

def write_summaries(stories: list[dict] | None = None) -> None:
    if not GEMINI_API_KEY:
        return
    stories = stories if stories is not None else db.stories_since(
        db.now() - SUMMARY_WINDOW)
    blocs = {site_id: info["bloc"] for site_id, info in overall(db.all_topic_states()).items()}
    written = 0
    writer = db.Writer()
    for story in stories:
        rows = [{"header": a["header"], "subheader": a.get("subheader"),
                 "site_id": str(a["site_id"])} for a in story.get("articles", [])]
        if len(rows) < 2:
            continue
        have = story.get("summaries") or {}
        changed = False
        for bloc in BLOCS:
            articles = articles_for(rows, blocs, bloc)
            if not articles or (have.get(bloc) or {}).get("count") == len(articles):
                continue
            if written >= SUMMARY_MAX_PER_CYCLE:
                break
            try:
                text = summarise(summary_prompt(articles, bloc))
            except QuotaExhausted as err:
                print(f"summaries: {written} written, then the quota ran out ({err})")
                writer.flush()
                return
            if not text:
                continue
            have[bloc] = {"text": text[:2048], "count": len(articles)}
            changed = True
            written += 1
            time.sleep(SUMMARY_MIN_GAP)
        if changed:
            writer.set(db.client().collection("stories").document(str(story["id"])),
                       {"summaries": have}, merge=True)
    writer.flush()
    print(f"summaries: {written} written")


# ---- the feed ----------------------------------------------------------------

def feed_stories() -> list[dict]:
    """Today's stories with two outlets or more - what the feed shows."""
    local_midnight = datetime.now(LOCAL_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    stories = db.stories_since(local_midnight.astimezone(timezone.utc))
    if len(stories) < MIN_STORIES:
        stories = db.stories_since(db.now() - timedelta(hours=24))
    return stories


def build_feed(stories: list[dict] | None = None) -> list[list]:
    """The feed the app reads, as one document, and what was written to it."""
    stories = stories if stories is not None else feed_stories()

    states = db.all_topic_states()
    positions = {}      # (topic_id, site_id) -> position
    for topic_id, doc in states.items():
        for site_id, value in positions_for_topic(doc).items():
            positions[(topic_id, site_id)] = value
    site_bias = {site_id: info["bias"] for site_id, info in overall(states).items()}
    # general news has no axis, so an outlet's place on a story about none of the
    # topics is where it stands overall
    general_id = next((t["id"] for t in db.all_topics() if t["name"] == GENERAL_TOPIC), None)

    feed = []
    for story in stories:
        topic = story.get("topic") or story_topic(story)
        section = story.get("section") or story_section(story)
        items = []
        for article in story["articles"]:
            site_id = str(article["site_id"])
            topic_id = str(article.get("topic_id"))
            outlet = (site_bias.get(site_id, 0.0) if topic_id == general_id
                      else positions.get((topic_id, site_id), site_bias.get(site_id, 0.0)))
            rating = article.get("rating") or {}
            rated = rating.get("s", 0.0) / rating["w"] if rating.get("w") else None
            items.append({
                "id": f"{story['id']}-{article['id']}",
                "title": article["header"],
                "source": article.get("site", ""),
                "time": article["created_at"].isoformat(),
                "summary": article.get("subheader") or "",
                # the reader's own verdict where there is one, otherwise where the
                # outlet stands on this topic. Never a random number, as it was.
                "biasScore": round(rated if rated is not None else outlet, 2),
                "siteBiasScore": round(outlet, 2),
                "topic": topic,
                "section": section,
                # kept for the app's older field name; a section is what it means now
                "category": section,
                "link": article.get("link", ""),
                "groupId": story["id"],
                "language": article.get("language", "he"),
            })
        items.sort(key=lambda x: x["biasScore"])
        # the face of a story must be an original Hebrew headline, never a translation
        items.sort(key=lambda x: x.get("language", "he") != "he")
        # The summaries are written in the pass before this one is built, so they
        # travel with the story and the app shows them without asking for each one.
        # They ride on the first item only: the app reads a story as a plain list of
        # its items, and three copies of every summary would double the feed.
        summaries = {bloc: s["text"] for bloc, s in (story.get("summaries") or {}).items()
                     if isinstance(s, dict) and s.get("text")}
        if summaries and items:
            items[0]["summaries"] = summaries
        feed.append(items)
    db.write_feed(feed)
    return feed


# ---- cleanup -----------------------------------------------------------------

def cleanup() -> None:
    """Drop the vectors of stories nothing can join, then the stories past retention."""
    cutoff = db.now() - timedelta(hours=EMBED_KEEP_HOURS)
    stories = db.client().collection("stories") \
        .where(filter=db.firestore.FieldFilter("created_at", ">=", cutoff - timedelta(hours=12))) \
        .where(filter=db.firestore.FieldFilter("created_at", "<", cutoff)).stream()
    writer = db.Writer()
    stripped = 0
    for snap in stories:
        story = snap.to_dict()
        if not story.get("centroid") and not any(a.get("v") for a in story.get("articles", [])):
            continue
        articles = [{k: v for k, v in a.items() if k != "v"} for a in story.get("articles", [])]
        writer.set(snap.reference, {"centroid": None, "articles": articles}, merge=True)
        stripped += 1
    writer.flush()
    if stripped:
        print(f"cleanup: dropped the vectors of {stripped} stories")

    old = db.client().collection("stories") \
        .where(filter=db.firestore.FieldFilter("created_at", "<",
                                               db.now() - timedelta(hours=RETENTION_HOURS))) \
        .order_by("created_at").limit(RETENTION_MAX).stream()
    writer = db.Writer()
    stories = articles = 0
    for snap in old:
        for article in (snap.to_dict() or {}).get("articles", []):
            writer.delete(db.client().collection("articles").document(str(article["id"])))
            articles += 1
        writer.delete(snap.reference)
        stories += 1
    writer.flush()
    if stories:
        print(f"cleanup: deleted {stories} stories and {articles} articles "
              f"older than {RETENTION_HOURS} hours")


def retag() -> None:
    """Give every stored article its section and issue again, under the current list.

    What dev mode fixed by hand is left alone.
    """
    topics = db.all_topics()
    corrections = db.all_corrections()
    fixed = {c.get("article_id") for c in corrections}
    stories = db.stories_since(db.now() - timedelta(hours=RETENTION_HOURS), min_articles=1)
    print(f"retagging {sum(len(s.get('articles', [])) for s in stories)} articles "
          f"in {len(stories)} stories")
    writer = db.Writer()
    tagged = 0
    for start in range(0, len(stories), 20):
        batch = stories[start:start + 20]
        articles = [a for story in batch for a in story.get("articles", [])
                    if a["id"] not in fixed]
        tagged += tag(articles, topics, corrections)
        for story in batch:
            story["topic"] = story_topic(story)
            story["section"] = story_section(story)
            writer.story(story)
            for article in story.get("articles", []):
                writer.set(db.client().collection("articles").document(str(article["id"])),
                           {"topic": article.get("topic"), "topic_id": article.get("topic_id"),
                            "section": article.get("section"),
                            "topic_model": article.get("topic_model")}, merge=True)
        writer.flush()
        print(f"  {min(start + 20, len(stories))}/{len(stories)} stories")
    print(f"{tagged} articles are about one of the issues")


# ---- one pass ----------------------------------------------------------------

def cycle() -> None:
    started = datetime.now()
    print(f"\n=== ingest {started:%Y-%m-%d %H:%M:%S} ===")
    sites = db.all_sites()
    topics = db.all_topics()
    seen = db.seen()

    print("scraping:")
    newest: dict = {}
    fresh = scrape(sites, seen, newest=newest)
    if not fresh:
        print("no new articles")
        return
    if len(fresh) > MAX_PER_CYCLE:
        fresh.sort(key=lambda e: e["created_at"], reverse=True)
        print(f"\n{len(fresh)} new, keeping the newest {MAX_PER_CYCLE}")
        fresh = fresh[:MAX_PER_CYCLE]
    fresh.sort(key=lambda e: e["created_at"])

    print(f"\nembedding and placing {len(fresh)} articles")
    vectors = embed([f"{e['header']}\n{e['subheader']}" for e in fresh])
    article_ids = db.next_ids("article", len(fresh))
    story_ids = db.next_ids("story", len(fresh))
    corrections = db.all_corrections()
    stories = Stories(db.recent_stories(TIME_WINDOW_HOURS))
    general = next((t for t in topics if t["name"] == GENERAL_TOPIC), None)
    if general is None:
        raise SystemExit(f"topic {GENERAL_TOPIC!r} missing - run the migration first")

    stats = {"new": 0, "joined": 0, "replaced": 0, "duplicate": 0, "from_corrections": 0}
    placed = []
    for entry, vector, article_id, story_id in zip(fresh, vectors, article_ids, story_ids):
        taught = taught_topic(corrections, vector)
        article = {
            "id": article_id,
            "site_id": str(entry["site_id"]),
            "site": entry["site"],
            "language": entry.get("language", "he"),
            "header": entry["header"],
            "subheader": entry["subheader"],
            "link": entry["link"],
            "created_at": entry["created_at"].replace(tzinfo=timezone.utc),
            "topic": taught["topic"] if taught else GENERAL_TOPIC,
            "topic_id": taught["topic_id"] if taught else general["id"],
            "section": GENERAL_SECTION,      # until the tagging pass says otherwise
            "topic_model": "correction" if taught else None,
            "rating": {"w": 0.0, "s": 0.0, "n": 0},
            "v": db.pack(vector),
        }
        if taught:
            stats["from_corrections"] += 1
        outcome = stories.place(article, vector, story_id)
        stats[outcome] += 1
        if outcome != "duplicate":
            placed.append(article)

    moved = join_splits(stories)

    # Every article is tagged, not just the ones that reach the feed: at a fraction
    # of a cent a cycle it costs nothing, and the benchmark needs an outlet's
    # single-source coverage too.
    untagged = [a for a in placed if not a["topic_model"]]
    if untagged:
        print(f"\ntagging {len(untagged)} articles")
        try:
            tagged = tag(untagged, topics, corrections)
            print(f"  {tagged} are about one of the topics")
        except OpenAIUnavailable as err:
            print(f"  ! tagging failed, retried next cycle: {err}")

    writer = db.Writer()
    for story_id in stories.dirty:
        story = stories.by_id[story_id]
        story["topic"] = story_topic(story)
        story["section"] = story_section(story)
        story["article_count"] = len(story["articles"])
        writer.story(story)
    for article in placed:
        writer.article({k: v for k, v in article.items() if k != "v"})
    # an article stored in an earlier pass moved with its story; one placed in this
    # pass already carries its new story above
    new = {article["id"] for article in placed}
    for article in moved:
        if article["id"] not in new:
            writer.set(db.client().collection("articles").document(str(article["id"])),
                       {"story_id": article["story_id"]}, merge=True)
    for story_id in stories.gone:
        writer.delete(db.client().collection("stories").document(str(story_id)))
    writer.flush()
    remember(fresh, seen)
    note_health(sites, newest)
    note_coverage([stories.by_id[s] for s in stories.dirty], topics)

    print(f"\nstored   {len(placed)} (new story {stats['new']}, joined {stats['joined']}, "
          f"replaced {stats['replaced']}), {stats['duplicate']} duplicates")
    print(f"splits   {len(moved)} articles moved into the story they belong to, "
          f"{len(stories.gone)} stories folded away")
    print(f"topics   {stats['from_corrections']} from human corrections")
    print(f"stories  {len(stories.dirty)} written, {writer.written} documents")
    print(f"took     {(datetime.now() - started).seconds}s")


def once() -> None:
    cycle()
    write_summaries()
    stories = feed_stories()
    feed = build_feed(stories)
    print(f"feed     {len(feed)} stories")
    # The hot topics page is built on the feed, after it: whatever goes wrong there
    # must not cost the pass its feed, which is already written.
    try:
        hot_topics.update(stories, feed)
    except Exception as err:
        print(f"hot      ! not rebuilt this pass: {err!r}")
    cleanup()
    try:
        hot_topics.maybe_refresh()
    except Exception as err:
        print(f"hot      ! refresh failed this pass: {err!r}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="one pass, then exit")
    parser.add_argument("--scrape-only", action="store_true",
                        help="fetch every site and report what is new, write nothing")
    parser.add_argument("--feed", action="store_true", help="rebuild the feed document only")
    parser.add_argument("--summaries", action="store_true", help="write missing summaries only")
    parser.add_argument("--cleanup", action="store_true", help="drop old vectors only")
    parser.add_argument("--retag", action="store_true",
                        help="re-tag every stored article under the current lists")
    args = parser.parse_args()

    if args.scrape_only:
        fresh = scrape(db.all_sites(), db.seen(), translate=False)
        print(f"\n{len(fresh)} new items would be stored - nothing was written")
    elif args.feed:
        print(f"feed: {len(build_feed())} stories")
    elif args.summaries:
        write_summaries()
    elif args.cleanup:
        cleanup()
    elif args.retag:
        retag()
        build_feed()
    else:
        once()


if __name__ == "__main__":
    main()
