"""Every collection the app keeps, and the only place that knows their shapes.

    sites/{id}          an outlet: name, feed, language, whether the map draws it
    topics/{id}         a topic, what it covers, and what each end of its axis means
    stories/{id}        one story: when it opened, which outlets covered it and with
                        what headline, the embeddings it is matched on, and the AI
                        summaries. The feed is built from these.
    articles/{id}       one outlet's coverage of one story, on its own because a
                        rating and the benchmark both point at it
    topicStates/{id}    every outlet's position on that topic, and the state the
                        position is learned from (see learning.py). One read draws
                        the whole map.
    votes/{id}          one person's rating of one article. Deleted after a month by
                        a TTL policy - it exists to stop a second rating, and what it
                        taught is already in the topic's state.
    voters/{id}         how much rating one person has done today, so twenty ratings
                        from one reader are not twenty readers
    corrections/{id}    a dev-mode fix: this story is about X, not what the model said
    meta/{doc}          feed (the built feed, read as one document), seen (the links
                        of the last day, so a re-scrape skips them), counters, runs

Why a document database at all: nothing here is a join or an average over history.
The feed is one document, the map is one document per topic, and a rating changes a
handful of numbers in place. Postgres was answering those questions by scanning
every article and every vote each time someone opened the app.
"""
from __future__ import annotations

import base64
import os
from datetime import datetime, timedelta, timezone

import numpy as np
from google.cloud import firestore

PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCLOUD_PROJECT")
GENERAL_TOPIC = "חדשות כלליות"
VOTE_TTL = timedelta(days=30)

_client: firestore.Client | None = None


def client() -> firestore.Client:
    global _client
    if _client is None:
        _client = firestore.Client(project=PROJECT) if PROJECT else firestore.Client()
    return _client


def now() -> datetime:
    return datetime.now(timezone.utc)


# ---- vectors -----------------------------------------------------------------
# A 768-dim vector is 3KB of float32. Firestore would store it as an array of 768
# doubles - twice the size and slow to read back - so it travels as base64 text.

def pack(vector) -> str:
    return base64.b64encode(np.asarray(vector, dtype=np.float32).tobytes()).decode()


def unpack(blob: str | None):
    if not blob:
        return None
    return np.frombuffer(base64.b64decode(blob), dtype=np.float32)


# ---- ids ---------------------------------------------------------------------
# Numeric and rising, as they were in Postgres: the app already shows them and the
# order tells a story's age. One document holds the counters, and only the ingest
# job writes them, so a plain read-then-write is enough.

def next_ids(kind: str, count: int) -> list[int]:
    ref = client().collection("meta").document("counters")
    snap = ref.get()
    start = int((snap.to_dict() or {}).get(kind, 0)) + 1
    ref.set({kind: start + count - 1}, merge=True)
    return list(range(start, start + count))


# ---- sites and topics --------------------------------------------------------

# The outlet list, the topic list and the map change at most once a cycle, and an
# api instance would otherwise re-read them for every request it serves.
CACHE_SECONDS = 120
_cache: dict[str, tuple[float, object]] = {}


def cached(key: str, load):
    import time
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]
    value = load()
    _cache[key] = (time.time(), value)
    return value


def all_sites() -> list[dict]:
    return cached("sites", lambda: [d.to_dict() | {"id": d.id}
                                    for d in client().collection("sites").stream()])


def all_topics() -> list[dict]:
    return cached("topics", lambda: [d.to_dict() | {"id": d.id}
                                     for d in client().collection("topics").stream()])


def save_site(site_id: str, data: dict) -> None:
    client().collection("sites").document(str(site_id)).set(data, merge=True)


def save_topic(topic_id: str, data: dict) -> None:
    client().collection("topics").document(str(topic_id)).set(data, merge=True)


# ---- stories and articles ----------------------------------------------------

def recent_stories(hours: int) -> list[dict]:
    """The stories a new article could still join, with the vectors to match it against."""
    cutoff = now() - timedelta(hours=hours)
    docs = (client().collection("stories")
            .where(filter=firestore.FieldFilter("created_at", ">=", cutoff))
            .stream())
    return [d.to_dict() | {"id": d.id} for d in docs]


def stories_since(since: datetime, min_articles: int = 2) -> list[dict]:
    docs = (client().collection("stories")
            .where(filter=firestore.FieldFilter("created_at", ">=", since))
            .stream())
    stories = [d.to_dict() | {"id": d.id} for d in docs]
    stories = [s for s in stories if len(s.get("articles", [])) >= min_articles]
    stories.sort(key=lambda s: s["created_at"], reverse=True)
    return stories


def get_story(story_id) -> dict | None:
    snap = client().collection("stories").document(str(story_id)).get()
    return (snap.to_dict() | {"id": snap.id}) if snap.exists else None


def get_article(article_id) -> dict | None:
    snap = client().collection("articles").document(str(article_id)).get()
    return (snap.to_dict() | {"id": snap.id}) if snap.exists else None


class Writer:
    """Batched writes, flushed every 400 operations - Firestore's limit is 500."""

    def __init__(self):
        self.batch = client().batch()
        self.pending = 0
        self.written = 0

    def set(self, ref, data: dict, merge: bool = False):
        self.batch.set(ref, data, merge=merge)
        self.pending += 1
        self.written += 1
        if self.pending >= 400:
            self.flush()

    def update(self, ref, data: dict):
        self.batch.update(ref, data)
        self.pending += 1
        self.written += 1
        if self.pending >= 400:
            self.flush()

    def delete(self, ref):
        self.batch.delete(ref)
        self.pending += 1
        if self.pending >= 400:
            self.flush()

    def story(self, story: dict):
        self.set(client().collection("stories").document(str(story["id"])),
                 {k: v for k, v in story.items() if k != "id"})

    def article(self, article: dict):
        self.set(client().collection("articles").document(str(article["id"])),
                 {k: v for k, v in article.items() if k != "id"})

    def flush(self):
        if self.pending:
            self.batch.commit()
            self.batch = client().batch()
            self.pending = 0


# ---- the feed ----------------------------------------------------------------
# Built at the end of every ingest and read back as a single document, so opening
# the app costs one read no matter how many stories the day held.

# The app reads a story as a plain list of its items. Firestore refuses an array
# inside an array, so each story is stored as {"items": [...]} and unwrapped here.

def write_feed(payload: list[list]) -> None:
    client().collection("meta").document("feed").set(
        {"stories": [{"items": story} for story in payload], "built_at": now()})


def read_feed() -> list[list]:
    snap = client().collection("meta").document("feed").get()
    stored = (snap.to_dict() or {}).get("stories", []) if snap.exists else []
    return [story.get("items", []) for story in stored]


# ---- what was already scraped ------------------------------------------------
# The last day of links and headlines, kept in one document. The alternative is a
# query over every article of the last 24 hours, every half hour, which is hundreds
# of reads a cycle for a set that fits in a few dozen kilobytes.

def seen() -> dict:
    snap = client().collection("meta").document("seen").get()
    data = snap.to_dict() if snap.exists else {}
    return data or {"links": [], "headers": [], "at": []}


def save_seen(links: list[str], headers: list[str], stamps: list[float]) -> None:
    client().collection("meta").document("seen").set(
        {"links": links, "headers": headers, "at": stamps})


# ---- dev-mode corrections ----------------------------------------------------

def all_corrections() -> list[dict]:
    return [d.to_dict() | {"id": d.id} for d in client().collection("corrections").stream()]


def add_correction(data: dict) -> None:
    client().collection("corrections").add(data)


# ---- the map: one document per topic -----------------------------------------

def topic_state(topic_id) -> dict:
    snap = client().collection("topicStates").document(str(topic_id)).get()
    return (snap.to_dict() or {}) if snap.exists else {}


def all_topic_states() -> dict[str, dict]:
    return cached("states", lambda: {d.id: (d.to_dict() or {})
                                     for d in client().collection("topicStates").stream()})


def save_site_state(topic_id, site_id, state: dict) -> None:
    client().collection("topicStates").document(str(topic_id)).set(
        {"sites": {str(site_id): state}}, merge=True)


def topic_state_ref(topic_id):
    return client().collection("topicStates").document(str(topic_id))


# ---- ratings -----------------------------------------------------------------

def vote_ref(article_id, voter: str):
    return client().collection("votes").document(f"{article_id}_{voter}")


def voter_ref(voter: str):
    return client().collection("voters").document(voter)


def vote_expiry() -> datetime:
    return now() + VOTE_TTL
