"""The app's API: the feed, the map, the ratings, and the dev-mode fixes.

Everything it serves is already computed. The feed is one document written by the
ingest; the map is one document per topic holding every outlet's position; a rating
changes a handful of numbers in place (store/learning.py). Nothing here scans the
articles or averages the ratings, which is what the Postgres version did on every
request.
"""
import hmac
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore
from pydantic import BaseModel

from store import db
from store.learning import State, apply_rating, rater_weight, revise_rating
from store.positions import overall, positions_for_topic
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
        raters = int(entry.get("raters", 0))
        results.append({
            "source": site["name"],
            "bias": positions.get(site_id, round(float(entry.get("prior", 0.0)), 3)),
            "article_count": int(entry.get("articles", 0)),
            "rated_count": raters,
            "confidence": round(min(1.0, raters / 20), 2),
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
        if entry is None or topic_id not in names:
            continue
        raters = int(entry.get("raters", 0))
        results.append({
            "topic": names[topic_id],
            "bias": positions_for_topic(state).get(match["id"], 0.0),
            "article_count": int(entry.get("articles", 0)),
            "rated_count": raters,
            "confidence": round(min(1.0, raters / 20), 2),
        })
    return results


# ---- ratings -----------------------------------------------------------------

class VoteRequest(BaseModel):
    value: int


def voter_id(request: Request) -> str:
    """The same reader across visits: their cookie, or their address until they have one."""
    cookie = request.cookies.get("anon_id")
    if cookie:
        return cookie
    return f"ip-{request.client.host}" if request.client else str(uuid.uuid4())


@app.post("/articles/{article_id}/vote")
def add_vote(article_id: str, vote: VoteRequest, request: Request, response: Response):
    """One reader's verdict on one article, folded into the outlet's position.

    Everything happens in a single transaction: the article's own score, the
    reader's record for the day, and the state the outlet's position on this topic
    is learned from. No history is kept - the rating itself is dropped after a
    month, and what it taught stays in the state.
    """
    voter = voter_id(request)
    response.set_cookie("anon_id", voter, 60 * 60 * 24 * 365, httponly=True,
                        secure=True, samesite="lax")
    client = db.client()
    article_ref = client.collection("articles").document(str(article_id))
    vote_ref = db.vote_ref(article_id, voter)
    voter_ref = db.voter_ref(voter)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    value = max(-5, min(5, int(vote.value)))

    @firestore.transactional
    def apply(tx):
        article_snap = article_ref.get(transaction=tx)
        if not article_snap.exists:
            raise HTTPException(status_code=404, detail="article not found")
        article = article_snap.to_dict()
        topic_id = str(article.get("topic_id"))
        site_id = str(article.get("site_id"))
        state_ref = db.topic_state_ref(topic_id)

        vote_snap = vote_ref.get(transaction=tx)
        voter_snap = voter_ref.get(transaction=tx)
        state_snap = state_ref.get(transaction=tx)
        story_ref = (client.collection("stories").document(str(article["story_id"]))
                     if article.get("story_id") else None)
        story_snap = story_ref.get(transaction=tx) if story_ref else None

        previous = vote_snap.to_dict() if vote_snap.exists else None
        if previous and previous.get("value") == value:
            return {"status": "no_change"}

        record = voter_snap.to_dict() if voter_snap.exists else {}
        if record.get("day") != today:
            record = {"day": today, "sites": {}, "pairs": record.get("pairs", {})}
        done_today = int((record.get("sites") or {}).get(site_id, 0))
        weight = rater_weight(done_today)
        pair = f"{site_id}:{topic_id}"
        first_time = pair not in (record.get("pairs") or {})

        state = State.from_doc(((state_snap.to_dict() or {}).get("sites") or {}).get(site_id))
        if previous:
            state = revise_rating(state, previous["value"], value, previous.get("weight", 1.0))
        else:
            state = apply_rating(state, value, weight, first_time_rater=first_time)

        rating = article.get("rating") or {"w": 0.0, "s": 0.0, "n": 0}
        if previous:
            rating["s"] = rating.get("s", 0.0) + previous.get("weight", 1.0) * (value - previous["value"])
        else:
            rating = {"w": rating.get("w", 0.0) + weight,
                      "s": rating.get("s", 0.0) + weight * value,
                      "n": rating.get("n", 0) + 1}

        tx.set(vote_ref, {"article_id": str(article_id), "value": value, "weight": weight,
                          "site_id": site_id, "topic_id": topic_id,
                          "created_at": db.now(), "expires_at": db.vote_expiry()})
        record.setdefault("sites", {})[site_id] = done_today + 1
        record.setdefault("pairs", {})[pair] = True
        tx.set(voter_ref, record)
        tx.set(article_ref, {"rating": rating}, merge=True)
        entry = state.to_doc()
        stored = ((state_snap.to_dict() or {}).get("sites") or {}).get(site_id, {})
        # how many of this outlet's articles on this topic anyone has rated
        entry["rated"] = int(stored.get("rated", 0)) + (1 if not previous and rating["n"] == 1 else 0)
        tx.set(state_ref, {"sites": {site_id: entry}}, merge=True)
        # the feed carries a copy of the score, so the story keeps it in step until
        # the next ingest rebuilds the feed document
        if story_snap is not None and story_snap.exists:
            story = story_snap.to_dict()
            articles = story.get("articles", [])
            for entry in articles:
                if str(entry.get("id")) == str(article_id):
                    entry["rating"] = rating
            tx.set(story_ref, {"articles": articles}, merge=True)
        return {"mean_score": round(rating["s"] / rating["w"], 2) if rating["w"] else 0}

    return apply(client.transaction())


# ---- AI summaries ------------------------------------------------------------
# Written during the ingest, before any reader asks. This path only covers a story
# whose summary is missing - one that joined the feed between two cycles.

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("TAG_MODEL", "gpt-5.6-luna")


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
             "site_id": str(a["site_id"])} for a in story.get("articles", [])]
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
        writer.set(db.client().collection("articles").document(str(article["id"])),
                   {"topic": topic["name"], "topic_id": topic["id"], "topic_model": "human"},
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


@app.get("/api/bypass")
async def proxy_ynet(url: str = Query(..., description="Full article URL")):
    if not url.startswith("https://www.ynet.co.il/") and not url.startswith("https://www.calcalist.co.il/"):
        raise HTTPException(status_code=400, detail="only ynet and calcalist")
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
        r = await http.get(url, headers={"User-Agent": "Mozilla/5.0"})
    return Response(content=r.content, media_type=r.headers.get("content-type", "text/html"))
