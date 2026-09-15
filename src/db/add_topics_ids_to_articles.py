from db_session import engine, SessionLocal

from models import Article, Topic  # adjust import path

def backfill_article_topics():
    session = SessionLocal()

    try:
        # Build topic lookup: { "politics": 1, "economy": 2, ... }
        topics = session.query(Topic).all()
        topic_map = {t.name.lower(): t.id for t in topics}

        print(f"Loaded {len(topic_map)} topics")

        articles = session.query(Article).filter(Article.topic_id.is_(None)).all()
        print(f"Found {len(articles)} articles without topic_id")

        updated = 0
        skipped = 0

        for article in articles:
            if not article.topic_name:
                skipped += 1
                continue

            topic_key = article.topic_name.lower().strip()

            if topic_key not in topic_map:
                print(f"⚠️ No topic found for article {article.id}: '{article.topic_name}'")
                skipped += 1
                continue

            article.topic_id = topic_map[topic_key]
            updated += 1

        session.commit()

        print(f"✅ Updated {updated} articles")
        print(f"⏭️ Skipped {skipped} articles")

    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    backfill_article_topics()
