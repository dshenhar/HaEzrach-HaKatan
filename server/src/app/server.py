"""The app's API: the feed, the map, the readers' answers, and the dev-mode fixes.

Everything it serves is already computed. The feed is one document written by the
ingest; the map is one document per topic holding every outlet's position; a
reader's answer changes a handful of numbers on its article in place
(store/stance.py). Nothing here scans the articles or averages the answers, which
is what the Postgres version did on every request.
"""
import hashlib
import hmac
import os
import random
import re
import secrets
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore
from pydantic import BaseModel

from store import db
from store.positions import overall, positions_for_topic
from store.stance import confidence, headlines, score, side
from store.summaries import (GEMINI_API_KEY, GEMINI_MODEL, SIDES, articles_for,
                             prompt as summary_prompt)
from store.taxonomy import SECTIONS

GENERAL_TOPIC = db.GENERAL_TOPIC

# Retagging and merging change the feed for every reader, so they need the code the
# app's dev mode asks for. With no DEV_KEY on the server they are refused.
DEV_KEY = os.environ.get("DEV_KEY", "")


def require_dev(request: Request):
    given = request.headers.get("x-dev-key", "")
    if not DEV_KEY or not hmac.compare_digest(given.encode(), DEV_KEY.encode()):
        raise HTTPException(status_code=403, detail="dev code required")


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/ping")
def ping():
    """Keeps an instance warm without touching the database."""
    return {"ok": True}


@app.get("/health")
def health_check():
    try:
        db.client().collection("meta").document("feed").get()
        return {"status": "healthy", "db": "ok", "timestamp": datetime.now().isoformat()}
    except Exception as err:
        return {"status": "degraded", "db": str(err)[:200],
                "timestamp": datetime.now().isoformat()}


@app.get("/feed")
def get_feed(response: Response):
    response.headers["ngrok-skip-browser-warning"] = "true"
    return db.read_feed()


@app.get("/hot")
def get_hot():
    """The hot topics page: every affair with its tier and its links into the feed,
    and today's ids. Built with the feed (worker/hot_topics.py)."""
    hot = db.read_hot()
    return {"today": hot.get("today") or [], "topics": hot.get("topics") or [],
            "built_at": hot["built_at"].isoformat() if hot.get("built_at") else None}


@app.get("/sites")
def get_sites():
    return sorted(site["name"] for site in db.all_sites())


@app.get("/sections")
def get_sections():
    """The sections the feed filters by, in the order they are shown."""
    return [{"id": key, "name": name} for key, name in SECTIONS.items()]


@app.get("/topics")
def get_topics(include_general: bool = False):
    names = [t["name"] for t in db.all_topics()]
    return names if include_general else [n for n in names if n != GENERAL_TOPIC]


@app.get("/topics/poles")
def get_topic_poles():
    """What each end of a topic's axis means, so the app never labels it wrong."""
    return {t["name"]: {"right": t.get("pole_right") or "בעד",
                        "left": t.get("pole_left") or "נגד"}
            for t in db.all_topics()}


@app.get("/sites/bias")
def get_sites_bias():
    """Each outlet's position across every topic, and the bloc that falls out of it."""
    names = {site["id"]: site["name"] for site in db.all_sites()}
    scored = overall(db.all_topic_states())
    results = [{"source": names.get(site_id, site_id), **info}
               for site_id, info in scored.items() if site_id in names]
    for site_id, name in names.items():
        if site_id not in scored:
            results.append({"source": name, "bias": None, "bloc": "unknown",
                            "topics_scored": 0})
    results.sort(key=lambda r: (r["bias"] is None, -(r["bias"] or 0)))
    return results


def _topic_doc(topic: str) -> tuple[str, dict]:
    match = next((t for t in db.all_topics() if t["name"] == topic), None)
    if match is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return match["id"], db.topic_state(match["id"])


@app.get("/ranks/{topic}")
def get_ranks(topic: str):
    """One topic's map: where each outlet on the roster stands, and what it last ran."""
    topic_id, state = _topic_doc(topic)
    sites = {s["id"]: s for s in db.all_sites() if s.get("in_roster")}
    positions = positions_for_topic(state)
    entries = state.get("sites") or {}
    results = []
    for site_id, site in sites.items():
        entry = entries.get(site_id, {})
        results.append({
            "source": site["name"],
            "bias": positions.get(site_id, round(float(entry.get("prior", 0.0)), 3)),
            # how many headlines, faded, its place stands on, and how much of the
            # place they make up rather than the benchmark
            "article_count": round(headlines(entry)),
            "rated_count": round(headlines(entry)),
            "confidence": confidence(entry),
            "latest_article_header": (entry.get("latest") or {}).get("header", ""),
        })
    return results


@app.get("/ranks/site/{site}")
def get_ranks_by_site(site: str):
    """One outlet, topic by topic - what the analytics page draws."""
    match = next((s for s in db.all_sites() if s["name"] == site), None)
    if match is None:
        raise HTTPException(status_code=404, detail="Site not found")
    names = {t["id"]: t["name"] for t in db.all_topics()}
    results = []
    for topic_id, state in db.all_topic_states().items():
        entry = (state.get("sites") or {}).get(match["id"])
        if entry is None or topic_id not in names or names[topic_id] == GENERAL_TOPIC:
            continue
        results.append({
            "topic": names[topic_id],
            "bias": positions_for_topic(state).get(match["id"], 0.0),
            "article_count": round(headlines(entry)),
            "rated_count": round(headlines(entry)),
            "confidence": confidence(entry),
        })
    return results


@app.get("/blind")
def blind_pick(seen: str = ""):
    """One headline with the masthead taken off it.

    The weak link in the whole map is that the benchmark is an editorial estimate,
    and a reader who can see whose article it is mostly confirms what they already
    believe about that outlet - which teaches the model nothing it did not start
    with. Here the outlet is hidden until the vote is in, so what comes back is a
    judgement about the writing instead of about the name above it.

    It draws from the feed document, which is already built and cached, so asking
    for another one costs nothing.
    """
    skip = {s for s in seen.split(",") if s}
    poles = get_topic_poles()
    pool = [article for story in db.read_feed() for article in story
            if article.get("topic") and article["topic"] != GENERAL_TOPIC
            and str(article.get("id")) not in skip]
    if not pool:
        raise HTTPException(status_code=404, detail="nothing to rate")
    pick = random.choice(pool)
    return {
        "id": str(pick.get("id")),
        "title": pick.get("title", ""),
        "summary": pick.get("summary", ""),
        "topic": pick["topic"],
        "poles": poles.get(pick["topic"], {"right": "בעד", "left": "נגד"}),
    }


# ---- readers' answers ---------------------------------------------------------

class FeelRequest(BaseModel):
    # how right (+) or left (-) the article felt, -5..5
    value: int
    # whether the reader placed it without being told whose article it was
    blind: bool = False


def _article_id(given: str) -> str:
    """The feed names an item story-article; the article is the part after the dash."""
    return given.rsplit("-", 1)[-1]


def _salt() -> str:
    """A secret of this database's own, made once, for hashing addresses with."""
    ref = db.client().collection("meta").document("secrets")
    snap = ref.get()
    salt = (snap.to_dict() or {}).get("voter_salt") if snap.exists else None
    if not salt:
        salt = secrets.token_hex(32)
        ref.set({"voter_salt": salt}, merge=True)
    return salt


# what the app sends as its own id: our own alphabet, our own length, and nothing
# a caller can turn into a path or a query
VOTER_ID = re.compile(r"^[A-Za-z0-9_-]{16,64}$")


def voter_id(request: Request) -> str:
    """The same reader across visits, without holding anything that identifies them.

    The app makes a random id once and keeps it on the device; it arrives in a
    header. There is no cookie: a cookie would not survive the app and the api
    being on different addresses anyway, and this way there is nothing to ask
    consent for.

    A reader whose app has not sent one - a bare request - is told apart by their
    address, hashed with a secret of this database's own and never stored. Enough
    to stop one person rating the same article twice, not enough to say who they
    are or to recognise them anywhere else.
    """
    given = request.headers.get("x-voter", "")
    if VOTER_ID.match(given):
        return given
    if not request.client:
        return secrets.token_urlsafe(16)
    digest = hmac.new(_salt().encode(), request.client.host.encode(), hashlib.sha256)
    return f"ip-{digest.hexdigest()[:20]}"


@app.post("/articles/{article_id}/feel")
def add_feel(article_id: str, feel: FeelRequest, request: Request):
    """How right or left one reader found one article, folded into the article's
    own score (store/stance.py). One answer per reader and article: a second one
    replaces the first.

    Nothing about the outlet changes here. An outlet learns where its headlines
    fell when they leave the database, a day on, with their sides final - so a
    reader moves a headline, and only enough of them move an outlet.
    """
    voter = voter_id(request)
    article_id = _article_id(article_id)
    client = db.client()
    article_ref = client.collection("articles").document(article_id)
    answer_ref = db.feel_ref(article_id, voter)
    value = max(-5, min(5, int(feel.value)))

    @firestore.transactional
    def apply(tx):
        article_snap = article_ref.get(transaction=tx)
        if not article_snap.exists:
            raise HTTPException(status_code=404, detail="article not found")
        article = article_snap.to_dict()
        answer_snap = answer_ref.get(transaction=tx)
        story_ref = (client.collection("stories").document(str(article["story_id"]))
                     if article.get("story_id") else None)
        story_snap = story_ref.get(transaction=tx) if story_ref else None

        source = article.get("site", "")
        previous = answer_snap.to_dict() if answer_snap.exists else None
        tally = dict(article.get("feel") or {"n": 0, "s": 0})
        if previous:
            if previous.get("value") == value:
                own = score(article.get("stance"), tally)
                return {"status": "no_change", "source": source, "side": side(own)}
            tally["s"] = int(tally.get("s", 0)) + value - int(previous.get("value", 0))
        else:
            tally = {"n": int(tally.get("n", 0)) + 1, "s": int(tally.get("s", 0)) + value}

        tx.set(answer_ref, {"kind": "feel", "article_id": article_id, "value": value,
                            "site_id": str(article.get("site_id")), "voter": voter,
                            "blind": bool(feel.blind),
                            "created_at": db.now(), "expires_at": db.vote_expiry()})
        tx.set(article_ref, {"feel": tally}, merge=True)
        # the feed is built from the story's copy of its articles
        if story_snap is not None and story_snap.exists:
            articles = story_snap.to_dict().get("articles", [])
            for entry in articles:
                if str(entry.get("id")) == article_id:
                    entry["feel"] = tally
            tx.set(story_ref, {"articles": articles}, merge=True)
        own = score(article.get("stance"), tally)
        # the name comes back with the answer, which is the whole of the blind
        # survey: you learn whose article it was only once you have committed
        return {"source": source, "score": own, "side": side(own), "readers": tally["n"]}

    return apply(client.transaction())


@app.delete("/me")
def forget_me(request: Request):
    """Delete what this reader left behind: their answers and their day's tally.

    What an answer taught is not deleted with it, and the page that offers this says
    so: an outlet's position is a running number that cannot be traced back to
    anyone, and it fades on its own.
    """
    voter = request.headers.get("x-voter", "")
    if not VOTER_ID.match(voter):
        raise HTTPException(status_code=400, detail="no reader id")
    client = db.client()
    writer = db.Writer()
    deleted = 0
    for snap in client.collection("votes").where(
            filter=firestore.FieldFilter("voter", "==", voter)).stream():
        writer.delete(snap.reference)
        deleted += 1
    writer.delete(db.voter_ref(voter))
    writer.flush()
    return {"deleted": deleted}


# ---- AI summaries ------------------------------------------------------------
# Written during the ingest, before any reader asks. This path only covers a story
# whose summary is missing - one that joined the feed between two cycles.

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("LIGHT_MODEL", "gpt-6-luna")


async def _openai(prompt: str) -> str | None:
    async with httpx.AsyncClient(timeout=90) as http:
        r = await http.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json={"model": OPENAI_MODEL, "reasoning_effort": "none",
                  "max_completion_tokens": 300,
                  "messages": [{"role": "user", "content": prompt}]},
        )
        r.raise_for_status()
        return (r.json()["choices"][0]["message"].get("content") or "").strip() or None


async def _gemini(prompt: str) -> str | None:
    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            headers={"x-goog-api-key": GEMINI_API_KEY, "content-type": "application/json"},
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"maxOutputTokens": 300, "temperature": 0.3,
                                       "thinkingConfig": {"thinkingBudget": 0}}},
        )
        r.raise_for_status()
        parts = r.json()["candidates"][0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip() or None


@app.get("/clusters/{story_id}/summary/{bloc}")
async def get_bloc_summary(story_id: str, bloc: str):
    """One line on how one bloc framed a story, or on the story as everyone told it."""
    if bloc not in SIDES:
        raise HTTPException(status_code=400, detail="bloc must be right, left or all")
    story = db.get_story(story_id)
    if story is None:
        raise HTTPException(status_code=404, detail="story not found")

    stored = (story.get("summaries") or {}).get(bloc)
    if stored and stored.get("text"):
        return {"summary": stored["text"], "cached": True}
    if not (OPENAI_API_KEY or GEMINI_API_KEY):
        return {"summary": None, "reason": "no summary key set"}

    blocs = {site_id: info["bloc"] for site_id, info in overall(db.all_topic_states()).items()}
    rows = [{"header": a["header"], "subheader": a.get("subheader"),
             "site_id": str(a["site_id"]), "stance": a.get("stance"), "feel": a.get("feel")}
            for a in story.get("articles", [])]
    articles = articles_for(rows, blocs, bloc)
    if not articles:
        return {"summary": None, "reason": "bloc did not cover this story"}

    text, failure = None, None
    for provider in ([_openai] if OPENAI_API_KEY else []) + ([_gemini] if GEMINI_API_KEY else []):
        try:
            text = await provider(summary_prompt(articles, bloc))
            if text:
                break
        except Exception as err:
            print(f"summary failed for {story_id}/{bloc}: {err}")
            failure = str(err)[:200]
    if not text and failure:
        return {"summary": None, "reason": failure}
    if not text:
        return {"summary": None, "reason": "no summary came back"}

    db.client().collection("stories").document(str(story_id)).set(
        {"summaries": {bloc: {"text": text[:2048], "count": len(articles)}}}, merge=True)
    return {"summary": text, "cached": False, "articles": len(articles)}


# ---- dev mode ----------------------------------------------------------------

class TopicFix(BaseModel):
    topic: str


@app.patch("/clusters/{story_id}/topic", dependencies=[Depends(require_dev)])
def set_story_topic(story_id: str, fix: TopicFix):
    """Reassign a story's topic and keep the correction as a labelled example."""
    topic = next((t for t in db.all_topics() if t["name"] == fix.topic), None)
    if topic is None:
        raise HTTPException(status_code=404, detail="topic not found")
    story = db.get_story(story_id)
    if story is None:
        raise HTTPException(status_code=404, detail="story not found")

    writer = db.Writer()
    taught = 0
    for article in story.get("articles", []):
        if article.get("topic_id") != topic["id"] and article.get("v"):
            db.add_correction({"article_id": article["id"], "topic": topic["name"],
                               "topic_id": topic["id"], "header": article["header"][:512],
                               "v": article["v"], "created_at": db.now()})
            taught += 1
        article["topic"] = topic["name"]
        article["topic_id"] = topic["id"]
        article["topic_model"] = "human"
        # its stance was read on the old issue's axis, which is not this one's
        article["stance"] = None
        writer.set(db.client().collection("articles").document(str(article["id"])),
                   {"topic": topic["name"], "topic_id": topic["id"], "topic_model": "human",
                    "stance": None},
                   merge=True)
    writer.set(db.client().collection("stories").document(str(story_id)),
               {"topic": topic["name"], "articles": story["articles"]}, merge=True)
    writer.flush()
    return {"cluster_id": story_id, "topic": topic["name"],
            "articles_updated": len(story.get("articles", [])), "examples_learned": taught}


class MergeRequest(BaseModel):
    keep: str
    merge: str


@app.post("/clusters/merge", dependencies=[Depends(require_dev)])
def merge_stories(req: MergeRequest):
    """Fold one story into another and remember that a human joined them."""
    if str(req.keep) == str(req.merge):
        raise HTTPException(status_code=400, detail="same story")
    keep = db.get_story(req.keep)
    merge = db.get_story(req.merge)
    if keep is None or merge is None:
        raise HTTPException(status_code=404, detail="story not found")

    similarity = None
    a, b = db.unpack(keep.get("centroid")), db.unpack(merge.get("centroid"))
    if a is not None and b is not None:
        import numpy as np
        similarity = float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))

    taken = {str(art["site_id"]) for art in keep.get("articles", [])}
    moved = 0
    writer = db.Writer()
    for article in merge.get("articles", []):
        if str(article["site_id"]) in taken:
            continue            # one article per outlet in a story
        keep["articles"].append(article)
        taken.add(str(article["site_id"]))
        moved += 1
        writer.set(db.client().collection("articles").document(str(article["id"])),
                   {"story_id": keep["id"]}, merge=True)
    # the headlines changed, so the stored summaries no longer describe the story
    writer.set(db.client().collection("stories").document(str(req.keep)),
               {"articles": keep["articles"], "article_count": len(keep["articles"]),
                "summaries": {}}, merge=True)
    writer.delete(db.client().collection("stories").document(str(req.merge)))
    writer.flush()
    db.client().collection("merges").add(
        {"kept": str(req.keep), "merged": str(req.merge), "similarity": similarity,
         "created_at": db.now()})
    return {"kept": req.keep, "moved": moved, "similarity": similarity}


@app.post("/dev/unlock", dependencies=[Depends(require_dev)])
def dev_unlock():
    return {"ok": True}


@app.get("/dev/learning")
def learning_stats():
    """What the app has been taught so far."""
    client = db.client()
    corrections = client.collection("corrections").count().get()[0][0].value
    merges = list(client.collection("merges").stream())
    lowest = min((m.to_dict().get("similarity") for m in merges
                  if m.to_dict().get("similarity") is not None), default=None)
    return {"topic_corrections": int(corrections), "cluster_merges": len(merges),
            # every human merge is a pair the threshold should have caught
            "lowest_merged_similarity": lowest}
