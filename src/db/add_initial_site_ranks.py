import json
from sqlalchemy.orm import Session

from db_session import SessionLocal
from models import Site, Topic, SiteTopicPriorBias


JSON_PATH = "../../../research/initial_ranks.json"


def load_initial_biases():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    with SessionLocal() as session:
        for entry in data:
            topic_name = entry["category"]
            ranks = entry["ranks"]

            # --- get or create topic ---
            topic = (
                session.query(Topic)
                .filter(Topic.name == topic_name)
                .one_or_none()
            )

            if not topic:
                topic = Topic(name=topic_name)
                session.add(topic)
                session.flush()  # get topic.id
                print("added new topic", topic_name)

            for site_name, score in ranks.items():
                site = (
                    session.query(Site)
                    .filter(Site.name == site_name)
                    .one_or_none()
                )

                if not site:
                    print(f"⚠️ Site not found: {site_name}")
                    continue

                bias = (
                    session.query(SiteTopicPriorBias)
                    .filter(
                        SiteTopicPriorBias.site_id == site.id,
                        SiteTopicPriorBias.topic_id == topic.id
                    )
                    .one_or_none()
                )

                if bias:
                    bias.initial_bias_score = score
                else:
                    bias = SiteTopicPriorBias(
                        site_id=site.id,
                        topic_id=topic.id,
                        prior_bias=score
                    )
                    session.add(bias)

        session.commit()


if __name__ == "__main__":
    load_initial_biases()
    print("✅ Initial site-topic bias data loaded")
