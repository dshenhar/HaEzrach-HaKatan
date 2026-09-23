"""Move everything out of Postgres and into Firestore, once.

    python pg_to_firestore.py            the lot
    python pg_to_firestore.py --days 7   only re-embed that many days (default 7)

Reads a Postgres copy of the old database (DATABASE_URL) and writes the shapes in
store/db.py. Two things are not copied as they are:

  vectors    the old ones came from a different model and mean nothing next to the
             new ones, so the last --days of articles are embedded again with
             OpenAI and every story of that window gets a fresh centre
  positions  the benchmark, the ratings and the article counts are folded into the
             learning state of store/learning.py, which is what the map now reads

Safe to run again: every write is keyed by the row's old id.
"""
import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "worker")))

import psycopg2
import psycopg2.extras

from gpt_models import embed
from store import db
from store.learning import State, apply_rating, set_prior

# What each topic covers. The tagging model reads these off the topic documents;
# until now they lived in the worker's source.
DESCRIPTIONS = {
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


def rows(cur, sql, *args):
    cur.execute(sql, *args)
    return cur.fetchall()


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def main(days: int) -> None:
    confidence = {}
    here = os.path.dirname(__file__)
    with open(os.path.join(here, "..", "db", "initial_ranks.json"), encoding="utf-8") as fh:
        for block in json.load(fh):
            confidence[block["category"]] = block.get("confidence", "med")

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    writer = db.Writer()

    sites = {r["id"]: r for r in rows(cur, "select * from sites")}
    for site in sites.values():
        writer.set(db.client().collection("sites").document(str(site["id"])), {
            "name": site["name"], "domain": site["domain"],
            "language": site["language"], "in_roster": bool(site["in_roster"]),
        })
    topics = {r["id"]: r for r in rows(cur, "select * from topics")}
    for topic in topics.values():
        writer.set(db.client().collection("topics").document(str(topic["id"])), {
            "name": topic["name"], "pole_right": topic["pole_right"],
            "pole_left": topic["pole_left"],
            "description": DESCRIPTIONS.get(topic["name"], topic["name"]),
            "confidence": confidence.get(topic["name"], "med"),
        })
    writer.flush()
    print(f"sites {len(sites)}, topics {len(topics)}")

    # ---- the stories and their articles
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    articles = rows(cur, "select * from articles order by created_at")
    by_cluster = defaultdict(list)
    for article in articles:
        if article["cluster_id"]:
            by_cluster[article["cluster_id"]].append(article)

    fresh = [a for a in articles if utc(a["created_at"]) >= cutoff]
    print(f"embedding {len(fresh)} articles of the last {days} days")
    vectors = {}
    for start in range(0, len(fresh), 256):
        batch = fresh[start:start + 256]
        for article, vector in zip(batch, embed([f"{a['header']}\n{a['subheader']}" for a in batch])):
            vectors[article["id"]] = vector
        print(f"  {min(start + 256, len(fresh))}/{len(fresh)}")

    summaries = defaultdict(dict)
    for row in rows(cur, "select * from cluster_summaries"):
        summaries[row["cluster_id"]][row["bloc"]] = {
            "text": row["summary"], "count": row["article_count"]}

    clusters = rows(cur, "select * from clusters")
    for cluster in clusters:
        members = by_cluster.get(cluster["id"], [])
        if not members:
            continue
        entries = []
        for article in members:
            entry = {
                "id": article["id"],
                "site_id": str(article["site_id"]),
                "site": sites[article["site_id"]]["name"],
                "language": sites[article["site_id"]]["language"],
                "header": article["header"],
                "subheader": article["subheader"],
                "link": article["link"],
                "created_at": utc(article["created_at"]),
                "topic": article["topic_name"],
                "topic_id": str(article["topic_id"]),
                "topic_model": article.get("topic_model"),
                "rating": {"w": float(article["votes_count"] or 0),
                           "s": float(article["bias_score"] or 0),
                           "n": int(article["votes_count"] or 0)},
            }
            if article["id"] in vectors:
                entry["v"] = db.pack(vectors[article["id"]])
            entries.append(entry)
            writer.article({k: v for k, v in entry.items()
                            if k != "v"} | {"story_id": cluster["id"]})

        story = {
            "id": cluster["id"],
            "created_at": utc(cluster["created_at"]),
            "last_updated": utc(cluster["last_updated"]),
            "article_count": len(entries),
            "articles": entries,
            "topic": max({e["topic"] for e in entries},
                         key=lambda t: sum(1 for e in entries if e["topic"] == t)),
            "summaries": summaries.get(cluster["id"], {}),
        }
        members_with_vectors = [vectors[a["id"]] for a in members if a["id"] in vectors]
        if members_with_vectors:
            import numpy as np
            story["centroid"] = db.pack(np.mean(members_with_vectors, axis=0))
        writer.story(story)
    writer.flush()
    print(f"stories {len(clusters)}, articles {len(articles)}")

    # ---- the map: benchmark, coverage and the ratings cast so far
    state: dict[tuple, State] = {}
    counts: dict[tuple, dict] = defaultdict(lambda: {"articles": 0, "rated": 0})
    for row in rows(cur, "select * from site_topic_prior_bias"):
        key = (str(row["topic_id"]), str(row["site_id"]))
        topic_name = topics[row["topic_id"]]["name"]
        state[key] = set_prior(State(), row["prior_bias"],
                               confidence.get(topic_name, "med"))
    for article in articles:
        key = (str(article["topic_id"]), str(article["site_id"]))
        counts[key]["articles"] += 1
        if article["votes_count"]:
            counts[key]["rated"] += 1

    for vote in rows(cur, "select v.*, a.site_id, a.topic_id, a.created_at as article_at "
                          "from votes v join articles a on a.id = v.article_id"):
        key = (str(vote["topic_id"]), str(vote["site_id"]))
        state[key] = apply_rating(state.get(key, State()), vote["value"],
                                  now=utc(vote["created_at"]))

    latest: dict[tuple, dict] = {}
    for article in articles:
        key = (str(article["topic_id"]), str(article["site_id"]))
        when = utc(article["created_at"])
        if key not in latest or latest[key]["at"] < when:
            latest[key] = {"header": article["header"], "at": when}

    by_topic: dict[str, dict] = defaultdict(dict)
    for key in set(state) | set(counts):
        topic_id, site_id = key
        entry = state.get(key, State()).to_doc()
        entry |= {"articles": counts[key]["articles"], "rated": counts[key]["rated"]}
        if key in latest:
            entry["latest"] = latest[key]
        by_topic[topic_id][site_id] = entry
    for topic_id, entries in by_topic.items():
        writer.set(db.topic_state_ref(topic_id), {"sites": entries}, merge=True)
    writer.flush()
    print(f"topic states {len(by_topic)} topics, {sum(len(v) for v in by_topic.values())} cells")

    # ---- what dev mode taught, re-embedded so it matches the new vectors
    corrections = rows(cur, "select c.*, t.name as topic_name from topic_corrections c "
                            "join topics t on t.id = c.topic_id")
    if corrections:
        texts = []
        for correction in corrections:
            source = next((a for a in articles if a["id"] == correction["article_id"]), None)
            texts.append(f"{source['header']}\n{source['subheader']}" if source
                         else (correction["header"] or ""))
        for correction, vector in zip(corrections, embed(texts)):
            writer.set(db.client().collection("corrections").document(str(correction["id"])), {
                "article_id": correction["article_id"],
                "topic": correction["topic_name"],
                "topic_id": str(correction["topic_id"]),
                "header": correction["header"],
                "v": db.pack(vector),
                "created_at": utc(correction["created_at"]),
            })
    for merge in rows(cur, "select * from cluster_merges"):
        writer.set(db.client().collection("merges").document(str(merge["id"])), {
            "kept": str(merge["kept_cluster_id"]), "merged": str(merge["merged_cluster_id"]),
            "similarity": merge["similarity"], "created_at": utc(merge["created_at"])})
    writer.flush()
    print(f"corrections {len(corrections)}")

    # ---- the ids the next article and story take, and what not to scrape again
    db.client().collection("meta").document("counters").set({
        "article": max((a["id"] for a in articles), default=0),
        "story": max((c["id"] for c in clusters), default=0),
    })
    day = datetime.now(timezone.utc) - timedelta(hours=24)
    recent = [a for a in articles if utc(a["created_at"]) >= day]
    db.save_seen([a["link"] for a in recent], [a["header"] for a in recent],
                 [utc(a["created_at"]).timestamp() for a in recent])
    print(f"seen {len(recent)} links from the last day")
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7)
    main(parser.parse_args().days)
