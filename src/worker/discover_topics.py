"""What the right and the left are actually arguing about, read off our own corpus.

    python discover_topics.py [--sample 1200]

Reads the headlines from a Postgres copy of the archive (DATABASE_URL), shows them
to the model in batches, and asks which public disputes they belong to. A second
pass merges the batches into one list, each issue with the two ends of its axis.

It proposes; a person decides. Nothing is written anywhere.
"""
import argparse
import json
import os
import random
import sys
from collections import Counter

import psycopg2
import psycopg2.extras

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gpt_models import TAG_MODEL, _post

BATCH = 60

FIND = """להלן כותרות מאתרי חדשות ישראליים.
זהה אילו סוגיות ציבוריות שנויות במחלוקת עולות מהן - כאלה שיש בהן עמדה מזוהה עם הימין ועמדה מזוהה עם השמאל בישראל.
אל תמציא סוגיות שלא עולות מהכותרות. אל תכלול נושאים שאינם מחלוקת פוליטית (פלילים, תאונות, ספורט, מזג אוויר).
לכל סוגיה תן שם קצר, תיאור של משפט, ניסוח קצר של עמדת הימין ושל עמדת השמאל, וכמה כותרות מהרשימה שייכות לה."""

MERGE = """להלן רשימות של סוגיות שזוהו בקבוצות כותרות שונות מאותם אתרי חדשות.
אחד אותן לרשימה אחת סופית של הסוגיות המרכזיות שהימין והשמאל בישראל חלוקים עליהן כרגע.
אחד כפילויות, העדף סוגיה רחבה על פני פיצול מלאכותי, וסדר לפי מספר הכותרות.
לכל סוגיה: שם קצר, תיאור של משפט שמסביר מה נכלל בה ומה לא, עמדת הימין, עמדת השמאל, וסך הכותרות."""

SCHEMA = {
    "type": "object", "additionalProperties": False, "required": ["topics"],
    "properties": {"topics": {"type": "array", "items": {
        "type": "object", "additionalProperties": False,
        "required": ["name", "description", "right", "left", "headlines"],
        "properties": {"name": {"type": "string"}, "description": {"type": "string"},
                       "right": {"type": "string"}, "left": {"type": "string"},
                       "headlines": {"type": "integer"}}}}},
}


def ask(instructions: str, payload: str, effort: str = "low") -> list[dict]:
    reply = _post("/chat/completions", {
        "model": TAG_MODEL, "reasoning_effort": effort,
        "messages": [{"role": "developer", "content": instructions},
                     {"role": "user", "content": payload}],
        "response_format": {"type": "json_schema", "json_schema": {
            "name": "topics", "strict": True, "schema": SCHEMA}},
    }, timeout=180)
    return json.loads(reply["choices"][0]["message"]["content"])["topics"]


def main(sample: int) -> None:
    conn = psycopg2.connect(os.environ["DATABASE_URL"],
                            cursor_factory=psycopg2.extras.RealDictCursor)
    with conn.cursor() as cur:
        cur.execute("""select a.header, a.topic_name, s.name as site
                       from articles a join sites s on s.id = a.site_id
                       join clusters c on c.id = a.cluster_id
                       where c.article_count >= 2 order by a.created_at desc limit 4000""")
        rows = cur.fetchall()
    conn.close()
    seen, headlines = set(), []
    for row in rows:                      # one headline per story, the first outlet's
        if row["header"] in seen:
            continue
        seen.add(row["header"])
        headlines.append(row["header"])
    headlines = random.Random(7).sample(headlines, min(sample, len(headlines)))
    print(f"{len(headlines)} headlines from {len(rows)} stored articles\n")

    found = []
    for start in range(0, len(headlines), BATCH):
        batch = headlines[start:start + BATCH]
        found += ask(FIND, "\n".join(f"- {h}" for h in batch))
        print(f"  {min(start + BATCH, len(headlines))}/{len(headlines)}")

    rolled = Counter()
    for topic in found:
        rolled[topic["name"]] += topic.get("headlines", 0)
    merged = ask(MERGE, json.dumps(found, ensure_ascii=False), effort="medium")

    print(f"\n{len(merged)} issues, most covered first:\n")
    for topic in sorted(merged, key=lambda t: -t.get("headlines", 0)):
        print(f"{topic['headlines']:>4}  {topic['name']}")
        print(f"      {topic['description']}")
        print(f"      ימין: {topic['right']}   |   שמאל: {topic['left']}\n")
    with open("/tmp/topics.json", "w", encoding="utf-8") as fh:
        json.dump(merged, fh, ensure_ascii=False, indent=2)
    print("written to /tmp/topics.json inside the container")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", type=int, default=1200)
    main(parser.parse_args().sample)
