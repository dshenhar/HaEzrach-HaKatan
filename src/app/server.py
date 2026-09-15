import os
import sys
# Get the absolute path to the src directory relative to this file
module_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, module_dir)
from sqlalchemy import select, and_, or_, func, Float
from db.models import (Article, ClusterMerge, ClusterSummary, Cluster, Site,
                       SiteTopicPriorBias, Topic, TopicCorrection, Vote)
from db.db_session import SessionLocal
from getClusters import get_clusters
from fastapi import Depends, FastAPI, Query, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
import hmac
import uuid
from datetime import datetime


K = 5

# Retagging and merging change the feed for every reader, so they need the code
# the app's dev mode asks for. With no DEV_KEY on the server they are refused.
DEV_KEY = os.environ.get("DEV_KEY", "")


def require_dev(request: Request):
    given = request.headers.get("x-dev-key", "")
    if not DEV_KEY or not hmac.compare_digest(given.encode(), DEV_KEY.encode()):
        raise HTTPException(status_code=403, detail="dev code required")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins (for dev)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/feed")
def get_feed(response: Response):
    response.headers["ngrok-skip-browser-warning"] = "true"
    formatted_data = get_clusters()
    return formatted_data


@app.get("/sites")
def get_sites():
    with SessionLocal() as session:
        sites = session.execute(select(Site.id, Site.name)).scalars().all()
    return sites


# not a political axis: outlets have no left/right position on general news, so it
# is offered as a correction target but kept off the map
GENERAL_TOPIC = "חדשות כלליות"


@app.get("/topics")
def get_topics(include_general: bool = False):
    with SessionLocal() as session:
        topics = session.execute(select(Topic.name)).scalars().all()
    return topics if include_general else [t for t in topics if t != GENERAL_TOPIC]


@app.get("/topics/poles")
def get_topic_poles():
    """What each end of a topic's axis means, so the app never labels it wrong."""
    with SessionLocal() as session:
        rows = session.execute(select(Topic.name, Topic.pole_right, Topic.pole_left)).all()
    return {r.name: {"right": r.pole_right or "בעד", "left": r.pole_left or "נגד"} for r in rows}


# Zero on purpose: leaning even slightly one way puts an outlet in that bloc.
# There is no neutral band - the app's claim is that the blocs are a construction,
# and a comfortable "centre" bucket would let outlets sit out the argument.
BREAKING_POINT = 0.0


@app.get("/sites/bias")
def get_sites_bias():
    """Each site's overall position, and the bloc that falls out of it.

    Same blend as /ranks/{topic} - prior weighted against rated articles - just
    averaged across every topic. The bloc is derived here rather than stored on
    the row, so it moves as readers rate articles.
    """
    with SessionLocal() as session:
        site_names = {s.id: s.name for s in session.execute(select(Site.id, Site.name)).all()}
        topic_ids = [t.id for t in session.execute(select(Topic.id)).all()]

        stmt = (
            select(
                Article.site_id,
                Article.topic_id,
                func.count(Article.id).filter(Article.votes_count > 0).label("n_rated"),
                func.avg(Article.bias_score.cast(Float) / func.nullif(Article.votes_count, 0)).label("avg_bias"),
            )
            .group_by(Article.site_id, Article.topic_id)
        )
        rated = {(r.site_id, r.topic_id): (r.n_rated, r.avg_bias or 0.0)
                 for r in session.execute(stmt)}

        priors = {(r.site_id, r.topic_id): r.prior_bias
                  for r in session.execute(select(SiteTopicPriorBias)).scalars()}

    results = []
    for s_id, name in site_names.items():
        scores = []
        for t_id in topic_ids:
            n_rated, avg_bias = rated.get((s_id, t_id), (0, 0.0))
            prior = priors.get((s_id, t_id))
            if prior is None and n_rated == 0:
                continue                      # nothing known about this pair
            w = n_rated / (n_rated + K) if n_rated > 0 else 0.0
            scores.append(w * avg_bias + (1 - w) * (prior or 0.0))

        if not scores:
            results.append({"source": name, "bias": None, "bloc": "unknown", "topics_scored": 0})
            continue

        bias = sum(scores) / len(scores)
        bloc = "right" if bias >= BREAKING_POINT else "left"
        results.append({
            "source": name,
            "bias": round(bias, 3),
            "bloc": bloc,
            "topics_scored": len(scores),
        })

    results.sort(key=lambda r: (r["bias"] is None, -(r["bias"] or 0)))
    return results


# Gemini first because its free tier costs nothing; Claude only when Gemini is out
# of quota or unset, so paid credits are spent only when there is no free option.
# Either way a summary is computed once and stored, so no story is ever paid for twice.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-3.6-flash"
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-sonnet-5"




def _bloc_of(bias: float | None) -> str:
    if bias is None:
        return "unknown"
    return "right" if bias >= BREAKING_POINT else "left"


def _prompt(articles: list[tuple[str, str]], bloc: str) -> str:
    side = "הימני" if bloc == "right" else "השמאלי"
    listed = "\n\n".join(
        f"כותרת: {h}" + (f"\nתקציר: {sub}" if sub else "") for h, sub in articles
    )
    return (
        f"להלן כותרות ותקצירים שפרסמו גופי תקשורת מהצד {side} של המפה הפוליטית "
        f"בישראל על אותו אירוע:\n\n{listed}\n\n"
        "כתוב שורה אחת בעברית שמאחדת את מה שנאמר בהן - מיזוג מינימליסטי, "
        "כמו כותרת אחת מסכמת. עד 25 מילים, בלשון עיתונאית ישירה.\n"
        "אל תתאר את הכותרות ואל תתייחס אליהן כאובייקט: בלי \"הכותרות\", "
        "\"הדיווחים\", \"גופי התקשורת\", \"מדגישים\", \"מבליטים\", \"משמיטים\", "
        "\"פותחות ב\". כתוב את החדשות עצמן.\n"
        "אל תוסיף פרשנות, שיפוט או עובדות שלא מופיעות בטקסט. החזר רק את השורה."
    )


async def _gemini(client, prompt: str) -> str | None:
    r = await client.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": GEMINI_API_KEY, "content-type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": 300,
                "temperature": 0.3,
                # 3.x flash reasons against the same budget and would truncate
                "thinkingConfig": {"thinkingBudget": 0},
            },
        },
    )
    r.raise_for_status()
    parts = r.json()["candidates"][0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip() or None


async def _claude(client, prompt: str) -> str | None:
    r = await client.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": CLAUDE_MODEL, "max_tokens": 300,
              "messages": [{"role": "user", "content": prompt}]},
    )
    r.raise_for_status()
    return "".join(b.get("text", "") for b in r.json().get("content", [])).strip() or None


async def _summarise(articles: list[tuple[str, str]], bloc: str) -> str | None:
    prompt = _prompt(articles, bloc)
    last_error = None

    async with httpx.AsyncClient(timeout=60) as client:
        for name, key, fn in (("gemini", GEMINI_API_KEY, _gemini),
                              ("claude", CLAUDE_API_KEY, _claude)):
            if not key:
                continue
            try:
                text = await fn(client, prompt)
                if text:
                    return text
            except Exception as err:
                print(f"summary via {name} failed: {err}")
                last_error = err

    if last_error:
        raise last_error
    return None


@app.get("/clusters/{cluster_id}/summary/{bloc}")
async def get_bloc_summary(cluster_id: int, bloc: str):
    """One or two sentences on how one bloc framed a story.

    Returns summary=None when no key is configured or the bloc did not cover the
    story - the app hides the box rather than showing an empty one.
    """
    if bloc not in ("right", "left"):
        raise HTTPException(status_code=400, detail="bloc must be right or left")

    with SessionLocal() as session:
        stored = session.get(ClusterSummary, (cluster_id, bloc))
        if stored:
            return {"summary": stored.summary, "cached": True}

    if not (GEMINI_API_KEY or CLAUDE_API_KEY):
        return {"summary": None, "reason": "no summary key set (GEMINI_API_KEY or CLAUDE_API_KEY)"}

    with SessionLocal() as session:
        rows = session.execute(
            select(Article.header, Article.subheader, Article.site_id)
            .where(Article.cluster_id == cluster_id)
        ).all()
        if not rows:
            raise HTTPException(status_code=404, detail="cluster not found")

        site_ids = {r.site_id for r in rows}
        priors: dict[int, list[float]] = {}
        for row in session.execute(
            select(SiteTopicPriorBias).where(SiteTopicPriorBias.site_id.in_(site_ids))
        ).scalars():
            priors.setdefault(row.site_id, []).append(row.prior_bias)

    articles = [
        (r.header, r.subheader or "") for r in rows
        if _bloc_of(
            sum(priors[r.site_id]) / len(priors[r.site_id]) if priors.get(r.site_id) else None
        ) == bloc
    ]
    if not articles:
        return {"summary": None, "reason": "bloc did not cover this story"}

    try:
        text = await _summarise(articles, bloc)
    except httpx.HTTPStatusError as err:
        # surface what the provider actually said - "request failed" hid a
        # billing error behind a generic message for a while
        try:
            detail = err.response.json().get("error", {}).get("message", err.response.text[:200])
        except Exception:
            detail = err.response.text[:200]
        print(f"summary failed for cluster {cluster_id}/{bloc}: {detail}")
        return {"summary": None, "reason": detail}
    except Exception as err:
        print(f"summary failed for cluster {cluster_id}/{bloc}: {err}")
        return {"summary": None, "reason": str(err)[:200]}

    if not text:
        return {"summary": None, "reason": "no provider returned a summary"}

    with SessionLocal() as session:
        session.merge(ClusterSummary(cluster_id=cluster_id, bloc=bloc, summary=text[:2048]))
        session.commit()
    return {"summary": text, "cached": False, "articles": len(articles)}


class TopicFix(BaseModel):
    topic: str


@app.patch("/clusters/{cluster_id}/topic", dependencies=[Depends(require_dev)])
def set_cluster_topic(cluster_id: int, fix: TopicFix):
    """Reassign a story's topic and keep the correction as a labelled example.

    Rewrites every article in the cluster and records one TopicCorrection per
    article, carrying its embedding - that is what the ingest worker matches new
    articles against. The stored summaries survive: the topic label does not
    change what the headlines say.
    """
    with SessionLocal() as session:
        row = session.execute(
            select(Topic.id, Topic.name).where(Topic.name == fix.topic)
        ).one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="topic not found")
        # read the values out now: the objects detach when the session closes
        topic_id, topic_name = row.id, row.name

        articles = session.execute(
            select(Article).where(Article.cluster_id == cluster_id)
        ).scalars().all()
        if not articles:
            raise HTTPException(status_code=404, detail="cluster not found")

        taught = 0
        for article in articles:
            if article.topic_id == topic_id:
                continue
            if article.embedding is not None:
                session.add(TopicCorrection(
                    article_id=article.id,
                    topic_id=topic_id,
                    previous_topic_id=article.topic_id,
                    embedding=article.embedding,
                    header=article.header[:512],
                ))
                taught += 1
            article.topic_id = topic_id
            article.topic_name = topic_name[:64]
        count = len(articles)
        session.commit()

    return {"cluster_id": cluster_id, "topic": topic_name,
            "articles_updated": count, "examples_learned": taught}


class MergeRequest(BaseModel):
    keep: int
    merge: int


@app.post("/clusters/merge", dependencies=[Depends(require_dev)])
def merge_clusters(req: MergeRequest):
    """Fold one story into another and remember that a human joined them."""
    if req.keep == req.merge:
        raise HTTPException(status_code=400, detail="same cluster")

    with SessionLocal() as session:
        keep = session.get(Cluster, req.keep)
        merge = session.get(Cluster, req.merge)
        if keep is None or merge is None:
            raise HTTPException(status_code=404, detail="cluster not found")

        similarity = None
        try:
            import numpy as _np
            a = _np.asarray(keep.centroid_embedding, dtype=float)
            b = _np.asarray(merge.centroid_embedding, dtype=float)
            similarity = float(a @ b / (_np.linalg.norm(a) * _np.linalg.norm(b)))
        except Exception:
            pass

        moving = session.execute(
            select(Article).where(Article.cluster_id == merge.id)
        ).scalars().all()
        # articles has UNIQUE(cluster_id, site_id): a site already in the kept
        # cluster cannot move, so it is left unclustered rather than dropped
        taken = {
            a.site_id for a in session.execute(
                select(Article).where(Article.cluster_id == keep.id)
            ).scalars()
        }
        moved = 0
        for article in moving:
            if article.site_id in taken:
                article.cluster_id = None
                continue
            article.cluster_id = keep.id
            taken.add(article.site_id)
            moved += 1

        keep.article_count = len(taken)
        keep.last_updated = max(keep.last_updated, merge.last_updated)
        session.add(ClusterMerge(kept_cluster_id=keep.id, merged_cluster_id=merge.id,
                                 similarity=similarity))
        # the headlines changed, so the summaries no longer describe the story
        session.query(ClusterSummary).filter(
            ClusterSummary.cluster_id.in_([keep.id, merge.id])
        ).delete(synchronize_session=False)
        session.delete(merge)
        session.commit()

    return {"kept": req.keep, "moved": moved, "similarity": similarity}


@app.post("/dev/unlock", dependencies=[Depends(require_dev)])
def dev_unlock():
    """Lets the app check a dev code before it turns dev mode on."""
    return {"ok": True}


@app.get("/dev/learning")
def learning_stats():
    """What the app has been taught so far."""
    with SessionLocal() as session:
        corrections = session.execute(select(func.count(TopicCorrection.id))).scalar_one()
        merges = session.execute(select(func.count(ClusterMerge.id))).scalar_one()
        lowest = session.execute(
            select(func.min(ClusterMerge.similarity)).where(ClusterMerge.similarity.isnot(None))
        ).scalar_one()
    return {
        "topic_corrections": corrections,
        "cluster_merges": merges,
        # every human merge is a pair the threshold should have caught
        "lowest_merged_similarity": lowest,
    }


@app.get("/ranks/{topic}")
def get_ranks(topic: str):
    with SessionLocal() as session:
        # the map draws the curated roster only; everything else is still scored
        site_names = {
            s.id: s.name
            for s in session.execute(
                select(Site.id, Site.name).where(Site.in_roster.is_(True))
            ).all()
        }
        topic_record = session.query(Topic.id).filter(Topic.name == topic).first()
        if not topic_record:
            raise HTTPException(status_code=404, detail="Topic not found")
        topic_id = topic_record[0]

        subq = (
            session.query(
                Article.site_id,
                func.max(Article.created_at).label("latest_time")
            )
            .filter(Article.topic_id == topic_id)
            .group_by(Article.site_id)
            .subquery()
        )

        # Join and select only site_id and title
        query = (
            session.query(Article.site_id, Article.header)
            .join(subq, (Article.site_id == subq.c.site_id) &
                  (Article.created_at == subq.c.latest_time))
            .all()
        )
        latest_articles = {q.site_id: q.header for q in query}
        print(latest_articles)

        stmt = (
            select(
                Article.site_id,
                func.count(Article.id).label("n_covered"),
                # only articles someone actually voted on carry evidence; counting the
                # rest pulled every well-covered site toward 0 and buried the prior
                func.count(Article.id).filter(Article.votes_count > 0).label("n_rated"),
                func.avg(Article.bias_score.cast(Float) / func.nullif(Article.votes_count, 0)).label("avg_bias"),
            )
            .where(Article.topic_id == topic_id)
            .group_by(Article.site_id)
        )

        stmt_prior = (
            select(
                SiteTopicPriorBias.site_id,
                SiteTopicPriorBias.prior_bias,
            )
            .where(SiteTopicPriorBias.topic_id == topic_id)
        )

        article_stats = {
            row.site_id: (row.n_covered, row.n_rated, row.avg_bias or 0.0)
            for row in session.execute(stmt)
        }

        priors = {
            row.site_id: row.prior_bias
            for row in session.execute(stmt_prior)
        }

    results = []

    for s_id in site_names.keys():
        n_covered, n_rated, avg_bias = article_stats.get(s_id, (0, 0, 0.0))
        prior_bias = priors.get(s_id, 0.0)

        # the prior holds until readers have actually rated something
        w_articles = n_rated / (n_rated + K) if n_rated > 0 else 0.0
        w_prior = 1.0 - w_articles

        bias = w_articles * avg_bias + w_prior * prior_bias

        results.append({
            "source": site_names[s_id],
            "bias": round(bias, 3),
            "article_count": n_covered,
            "rated_count": n_rated,
            "confidence": round(min(1.0, n_rated / 20), 2),
            "latest_article_header": latest_articles.get(s_id, "")
        })
    return results


@app.get("/ranks/site/{site}")
def get_ranks_by_site(site: str):
    with SessionLocal() as session:
        topics_names = {
            t.id: t.name
            for t in session.execute(select(Topic.id, Topic.name)).all()
        }
        site_record = session.query(Site.id).filter(Site.name == site).first()
        if not site_record:
            raise HTTPException(status_code=404, detail="Site not found")
        site_id = site_record[0]

        stmt = (
            select(
                Article.topic_id,
                func.count(Article.id).label("n_covered"),
                func.count(Article.id).filter(Article.votes_count > 0).label("n_rated"),
                func.avg(Article.bias_score.cast(Float) / func.nullif(Article.votes_count, 0)).label("avg_bias"),
            )
            .where(Article.site_id == site_id)
            .group_by(Article.topic_id)
        )

        stmt_prior = (
            select(
                SiteTopicPriorBias.topic_id,
                SiteTopicPriorBias.prior_bias,
            )
            .where(SiteTopicPriorBias.site_id == site_id)
        )

        article_stats = {
            row.topic_id: (row.n_covered, row.n_rated, row.avg_bias or 0.0)
            for row in session.execute(stmt)
        }

        priors = {
            row.topic_id: row.prior_bias
            for row in session.execute(stmt_prior)
        }

    results = []

    for t_id in topics_names.keys():
        n_covered, n_rated, avg_bias = article_stats.get(t_id, (0, 0, 0.0))
        prior_bias = priors.get(t_id, 0.0)

        w_articles = n_rated / (n_rated + K) if n_rated > 0 else 0.0
        w_prior = 1.0 - w_articles

        bias = w_articles * avg_bias + w_prior * prior_bias

        results.append({
            "topic": topics_names[t_id],
            "bias": round(bias, 3),
            "article_count": n_covered,
            "rated_count": n_rated,
            "confidence": round(min(1.0, n_rated / 20), 2),
        })
    return results


class VoteRequest(BaseModel):
    value: int


def get_anonymous_id(request: Request) -> uuid.UUID:
    anon = request.cookies.get("anon_id")
    if anon:
        return uuid.UUID(anon)
    return uuid.uuid4()


@app.post("/articles/{article_id}/vote")
async def add_vote(article_id: int, vote: VoteRequest, request: Request, response: Response):
    with SessionLocal() as session:
        anon_id = get_anonymous_id(request)
        ip = request.client.host
        response.set_cookie("anon_id", str(anon_id), 60 * 60 * 24 * 365, httponly=True, secure=True, samesite="lax")

        article = session.get(Article, article_id)
        if not article:
            raise HTTPException(status_code=404, detail="article not found")

        cur_vote = session.execute(select(Vote).where(
            and_(
                Vote.article_id == article_id,
                or_(
                    Vote.anonymous_id == anon_id,
                    Vote.ip_address == ip,
                )
            )
        )).scalar_one_or_none()
        if cur_vote:
            if cur_vote.value == vote.value:
                return {"status": "no_change"}
            article.bias_score += (vote.value - cur_vote.value)
            cur_vote.value = vote.value
        else:
            new_vote = Vote(
                article_id=article_id,
                value=vote.value,
                anonymous_id=anon_id,
                ip_address=ip,
            )
            session.add(new_vote)
            article.bias_score += vote.value
            article.votes_count += 1

        session.commit()
        return {"mean_score": article.bias_score / article.votes_count}


@app.get("/api/bypass")
async def proxy_ynet(url: str = Query(..., description="Full Ynet URL")):
    # Security check: only allow ynet.co.il or calcalist.co.il
    print("in the ynet/calcalist server")
    if not url.startswith("https://www.ynet.co.il/") and not url.startswith("https://www.calcalist.co.il/"):
        raise HTTPException(status_code=400, detail="Only ynet.co.il or calcalist.co.il URLs are allowed")

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(url, timeout=10)
            html = r.text

        return Response(content=html, media_type="text/html")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching {url}: {e}")


@app.get("/")
def home():
    return {"msg": "Hebrew News Clustering API is running!"}


@app.get("/health")
def health_check():
    """Health check endpoint for monitoring and readiness probes"""
    try:
        # Check database connection
        with SessionLocal() as session:
            session.execute(select(1))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "db": db_status,
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
