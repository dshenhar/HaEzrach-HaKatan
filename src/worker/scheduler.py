import os
import sys

from db.models import Site
from main import load_new_articles
from NewsClusterer import NewsClusterer
from db.db_session import SessionLocal
import time

model = "dicta-il/dictabert"
# model = "paraphrase-multilingual-MiniLM-L12-v2"
clusterer = NewsClusterer(similarity_threshold=0.88, time_window_hours=12, model_name=model)


def run_once():
    print("Starting scheduler...")
    try:
        with SessionLocal() as session:
            rss_feeds = session.query(Site.id, Site.name, Site.domain).all()
        load_new_articles(rss_feeds, clusterer)
    except Exception as e:
        print(f"Error in scheduler: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    print("Worker initialized successfully")
    while True:
        try:
            run_once()
            time.sleep(300)
        except KeyboardInterrupt:
            print("Worker stopped")
            break
        except Exception as e:
            print(f"Fatal error in worker: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(30)