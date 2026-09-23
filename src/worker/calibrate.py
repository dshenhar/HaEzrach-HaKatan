"""Measure the OpenAI models against the stories and topics already stored.

    python calibrate.py clusters [--days 4]   replay the grouping at a range of
                                              thresholds and score each one
    python calibrate.py tags [--n 200]        the tagging model against the stored
                                              topics, and against every dev-mode fix

Reads a Postgres copy of the old database (DATABASE_URL) and writes nothing - not
to Postgres and not to Firestore. Embeddings are computed in memory for the run.

The stored stories and topics came from the previous models, so they are a
reference and not the truth: what matters in the report is where the two disagree
and which side reads better. The dev-mode corrections are the exception - a person
made those, and they are scored as the answer key.
"""
import argparse
import os
import random
import sys
from collections import Counter
from datetime import datetime, timedelta

import numpy as np
import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from gpt_models import EMBED_MODEL, TAG_MODEL, classify, embed

# the rules being calibrated, as ingest.py applies them
TIME_WINDOW_HOURS = 12
SAME_ARTICLE_THRESHOLD = 0.97
GENERAL_TOPIC = "חדשות כלליות"


def connect():
    return psycopg2.connect(os.environ["DATABASE_URL"],
                            cursor_factory=psycopg2.extras.RealDictCursor)


def _simulate(rows, vectors, threshold):
    """ingest.Stories.place, replayed over the stored articles in time order."""
    window = timedelta(hours=TIME_WINDOW_HOURS)
    sums = np.zeros((len(rows), vectors[0].shape[0]), dtype=np.float32)
    counts = np.zeros(len(rows), dtype=np.float32)
    created, sites = [], []
    assigned = [None] * len(rows)
    oldest = 0

    def open_story(i):
        k = len(created)
        sums[k] = vectors[i]
        counts[k] = 1
        created.append(rows[i]["created_at"])
        sites.append({rows[i]["site_id"]: i})
        assigned[i] = k

    for i, row in enumerate(rows):
        v = vectors[i]
        while oldest < len(created) and created[oldest] < row["created_at"] - window:
            oldest += 1
        if oldest == len(created):
            open_story(i)
            continue
        centroids = sums[oldest:len(created)] / counts[oldest:len(created), None]
        scores = centroids @ v / np.maximum(np.linalg.norm(centroids, axis=1), 1e-9)
        best = oldest + int(np.argmax(scores))
        best_score = float(scores[best - oldest])
        if best_score < threshold:
            open_story(i)
            continue
        rival = sites[best].get(row["site_id"])
        if rival is None:
            sums[best] += v
            counts[best] += 1
            sites[best][row["site_id"]] = i
            assigned[i] = best
            continue
        if float(v @ vectors[rival]) > SAME_ARTICLE_THRESHOLD:
            continue
        centroid = sums[best] / counts[best]
        rival_score = float(vectors[rival] @ centroid / (np.linalg.norm(centroid) or 1.0))
        if best_score > rival_score:
            assigned[rival] = None
            sites[best][row["site_id"]] = i
            assigned[i] = best
        else:
            open_story(i)
    return assigned


def _pairs(groups):
    by_group: dict = {}
    for i, g in enumerate(groups):
        if g is not None:
            by_group.setdefault(g, []).append(i)
    out = set()
    for members in by_group.values():
        for a in range(len(members)):
            for b in range(a + 1, len(members)):
                out.add((members[a], members[b]))
    return out


def clusters(days: int) -> None:
    since = datetime.utcnow() - timedelta(days=days)
    with connect() as conn, conn.cursor() as cur:
        cur.execute("select id, site_id, cluster_id, header, subheader, created_at "
                    "from articles where created_at >= %s order by created_at", (since,))
        rows = cur.fetchall()
    print(f"{len(rows)} articles from the last {days} days, embedding with {EMBED_MODEL}")
    vectors = embed([f"{r['header']}\n{r['subheader']}" for r in rows])

    reference = _pairs([r["cluster_id"] for r in rows])
    stored_feed = sum(1 for n in Counter(r["cluster_id"] for r in rows).values() if n >= 2)
    print(f"{stored_feed} stored stories with 2+ outlets, {len(reference)} same-story pairs\n")

    print(" threshold  precision  recall     F1   stories with 2+")
    results = []
    for threshold in np.arange(0.35, 0.801, 0.025):
        assigned = _simulate(rows, vectors, float(threshold))
        predicted = _pairs(assigned)
        hit = len(predicted & reference)
        precision = hit / len(predicted) if predicted else 0.0
        recall = hit / len(reference) if reference else 0.0
        f1 = 2 * precision * recall / (precision + recall) if hit else 0.0
        feed = sum(1 for n in Counter(g for g in assigned if g is not None).values() if n >= 2)
        results.append((f1, float(threshold), predicted))
        print(f"   {threshold:.3f}     {precision:.2f}     {recall:.2f}    {f1:.2f}      {feed}")

    f1, best, predicted = max(results, key=lambda r: r[0])
    print(f"\nclosest to the stored grouping at {best:.3f} (F1 {f1:.2f})")

    # the similarity above which two articles are nearly always the same story -
    # what a dev-mode correction may be carried across on
    sims, same = [], []
    for i in range(len(rows)):
        for j in range(i + 1, min(i + 400, len(rows))):
            if rows[j]["created_at"] - rows[i]["created_at"] > timedelta(hours=TIME_WINDOW_HOURS):
                break
            if rows[i]["site_id"] == rows[j]["site_id"]:
                continue
            sims.append(float(vectors[i] @ vectors[j]))
            same.append((i, j) in reference)
    hits = 0
    for k, idx in enumerate(np.argsort(sims)[::-1], 1):
        hits += same[idx]
        if k >= 20 and hits / k < 0.95:
            print(f"pairs above {sims[idx]:.3f} are the same stored story 95% of the time")
            break

    def show(title, pairs):
        print(f"\n{title}")
        for i, j in random.Random(7).sample(sorted(pairs), min(8, len(pairs))):
            print(f"  {float(vectors[i] @ vectors[j]):.2f}  {rows[i]['header'][:70]}")
            print(f"        {rows[j]['header'][:70]}")

    show("joined now, apart in the stored stories:", predicted - reference)
    show("apart now, joined in the stored stories:", reference - predicted)


def tags(n: int) -> None:
    with connect() as conn, conn.cursor() as cur:
        cur.execute("select id, name, pole_right, pole_left from topics")
        topics = cur.fetchall()
        cur.execute("""select a.id, a.header, a.subheader, a.topic_name
                       from articles a join clusters c on c.id = a.cluster_id
                       where c.article_count >= 2
                         and a.id not in (select coalesce(article_id, -1) from topic_corrections)
                       order by a.created_at desc limit %s""", (n,))
        sample = cur.fetchall()
        cur.execute("""select c.header, t.name as topic from topic_corrections c
                       join topics t on t.id = c.topic_id where c.header is not null""")
        fixes = cur.fetchall()

    from migrate.pg_to_firestore import DESCRIPTIONS
    catalogue = {t["name"]: DESCRIPTIONS.get(t["name"], t["name"])
                 for t in topics if t["name"] != GENERAL_TOPIC}
    examples = [(f["header"], f["topic"]) for f in fixes]

    answers = classify([(a["id"], f"{a['header']}\n{a['subheader']}") for a in sample],
                       catalogue, examples)
    agree = 0
    changes, disagreements = Counter(), []
    for article in sample:
        new = answers.get(article["id"]) or GENERAL_TOPIC
        if new == article["topic_name"]:
            agree += 1
        else:
            changes[(article["topic_name"], new)] += 1
            disagreements.append((article["header"], article["topic_name"], new))
    print(f"{TAG_MODEL} against the stored topics on {len(sample)} feed articles: "
          f"{agree} agree ({agree / max(len(sample), 1):.0%})")
    old_general = sum(1 for a in sample if a["topic_name"] == GENERAL_TOPIC)
    new_general = sum(1 for a in sample if (answers.get(a["id"]) or GENERAL_TOPIC) == GENERAL_TOPIC)
    print(f"  given a real topic: stored {len(sample) - old_general}, now {len(sample) - new_general}")
    print("  most common changes:")
    for (old, new), count in changes.most_common(8):
        print(f"    {count:>3}  {old} -> {new}")
    print("  examples:")
    for header, old, new in random.Random(7).sample(disagreements, min(15, len(disagreements))):
        print(f"    [{old} -> {new}] {header[:75]}")

    if fixes:
        # scored with the fixes themselves left out of the prompt, or the test
        # would be the answer key
        answers = classify([(i, f["header"]) for i, f in enumerate(fixes)], catalogue, [])
        right = sum(1 for i, f in enumerate(fixes)
                    if (answers.get(i) or GENERAL_TOPIC) == f["topic"])
        print(f"\nagainst the {len(fixes)} dev-mode corrections: {right} right")
        for i, f in enumerate(fixes):
            got = answers.get(i) or GENERAL_TOPIC
            if got != f["topic"]:
                print(f"    [{f['topic']}, model said {got}] {f['header'][:70]}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["clusters", "tags"])
    parser.add_argument("--days", type=int, default=4)
    parser.add_argument("--n", type=int, default=200)
    args = parser.parse_args()
    clusters(args.days) if args.command == "clusters" else tags(args.n)
