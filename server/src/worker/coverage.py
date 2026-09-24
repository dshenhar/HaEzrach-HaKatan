"""Who is actually getting in, and who only looks like they are.

    python coverage.py

An outlet missing from the feed is not the same as an outlet we failed to read:
the feed only shows stories two outlets or more covered, so a paper whose
coverage never meets anyone else's is stored and still invisible. This counts
both, per outlet, over what the database keeps.
"""
import os
import sys
from collections import defaultdict
from datetime import timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from store import db
from store.positions import overall

RETENTION_HOURS = 30


def main() -> None:
    stories = db.stories_since(db.now() - timedelta(hours=RETENTION_HOURS), min_articles=1)
    stored, shared, latest = defaultdict(int), defaultdict(int), {}
    for story in stories:
        articles = story.get("articles", [])
        for article in articles:
            name = article.get("site", "?")
            stored[name] += 1
            if len(articles) >= 2:
                shared[name] += 1
            when = article["created_at"]
            if name not in latest or latest[name] < when:
                latest[name] = when

    names = {s["id"]: s["name"] for s in db.all_sites()}
    blocs = {names[i]: info["bloc"] for i, info in overall(db.all_topic_states()).items() if i in names}
    now = db.now()

    print(f"{len(stories)} stories held, {sum(stored.values())} articles\n")
    print(f"{'outlet':<16}{'bloc':<7}{'stored':>7}{'in a shared story':>19}{'last seen':>12}")
    for name in sorted(names.values(), key=lambda n: -stored[n]):
        seen = f"{(now - latest[name]).total_seconds() / 3600:.1f}h" if name in latest else "never"
        print(f"{name:<16}{blocs.get(name, '?'):<7}{stored[name]:>7}{shared[name]:>19}{seen:>12}")


if __name__ == "__main__":
    main()
