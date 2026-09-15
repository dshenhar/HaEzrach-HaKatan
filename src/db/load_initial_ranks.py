"""Load initial_ranks.json into site_topic_prior_bias.

    docker compose exec api python /db/load_initial_ranks.py

The sync counterpart of add_initial_site_ranks.py, which targets a JSON_PATH that
does not exist in this checkout. Idempotent: re-running overwrites the priors.
Sites and topics must already exist - run local_init.py first.
"""
import json
import os

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from models import Site, Topic, SiteTopicPriorBias

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "initial_ranks.json")


def main():
    with open(PATH, encoding="utf-8") as f:
        data = json.load(f)

    engine = create_engine(os.environ["DATABASE_URL"])
    Session = sessionmaker(bind=engine)

    with Session() as session:
        sites = {name: sid for sid, name in session.execute(select(Site.id, Site.name)).all()}
        topics = {name: tid for tid, name in session.execute(select(Topic.id, Topic.name)).all()}
        existing = {(r.site_id, r.topic_id): r
                    for r in session.execute(select(SiteTopicPriorBias)).scalars()}

        written = 0
        missing_sites, missing_topics = set(), set()

        topic_rows = {t.name: t for t in session.execute(select(Topic)).scalars()}

        for entry in data:
            topic_id = topics.get(entry["category"])
            if topic_id is None:
                missing_topics.add(entry["category"])
                continue
            row = topic_rows.get(entry["category"])
            if row is not None:
                row.pole_right = entry.get("pole_right")
                row.pole_left = entry.get("pole_left")
            for site_name, value in entry["ranks"].items():
                site_id = sites.get(site_name)
                if site_id is None:
                    missing_sites.add(site_name)
                    continue
                row = existing.get((site_id, topic_id))
                if row:
                    row.prior_bias = float(value)
                else:
                    session.add(SiteTopicPriorBias(site_id=site_id, topic_id=topic_id,
                                                   prior_bias=float(value)))
                written += 1
        session.commit()

    print(f"wrote {written} priors")
    if missing_sites:
        print(f"sites not in db (skipped): {', '.join(sorted(missing_sites))}")
    if missing_topics:
        print(f"topics not in db (skipped): {', '.join(sorted(missing_topics))}")


if __name__ == "__main__":
    main()
