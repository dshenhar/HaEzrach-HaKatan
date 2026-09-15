import time

import feedparser
from bs4 import BeautifulSoup
from kan11RssFetcher import generate_feed
from c14RssFetcher import fetch_c14_feed
from datetime import datetime, timedelta
import threading
from db.db_session import SessionLocal
from db.models import Article
from queue import Queue

lock = threading.Lock()

MINUTES = 300
HOURS = 12


def add_relevant_articles_to_clusterer(clusterer, new_articles_ids, formatted_articles_ids):
    cutoff_time = datetime.now() - timedelta(hours=HOURS)
    print(f"last check was normal, last check was {clusterer.last_check}")
    clusterer.last_check = datetime.now()

    print("========== adding new articles ==========")
    ids = []
    while not new_articles_ids.empty():
        ids.append(new_articles_ids.get())
    while not formatted_articles_ids.empty():
        ids.append(formatted_articles_ids.get())
    with SessionLocal() as session:
        articles = session.query(Article).filter(Article.id.in_(ids)).all()
        new_articles_count = 0
        for article in articles:
            if article.created_at >= cutoff_time:
                start = time.process_time()
                clusterer.add_article(article, session)
                new_articles_count += 1
                print(f"added article {new_articles_count}, time taken: {time.process_time() - start}")
            else:
                print(f"article is too old and is not a copy of an old one. article header: {article.header}")
        session.commit()

    # for model in models:
    print(f"============ model: {clusterer.model_name} =============")
    print(f"Added {new_articles_count} new relevant articles")
    print(f"============ finished scheduler interval ============")


def crawl(site, url, new_articles_ids, formatted_articles_ids, site_id):
    print(f"Fetching {site}...")
    if site == "Kan11":
        feed = generate_feed()
    elif site == "C14":
        feed = fetch_c14_feed()
    else:
        feed = feedparser.parse(url)
    print(f"found {len(feed["entries"])} entries")

    # Only query articles from last 24 hours to reduce memory usage
    cutoff_time = datetime.now() - timedelta(hours=24)

    with SessionLocal() as session:
        existing_articles = session.query(Article).filter(
            Article.site_id == site_id,
            Article.created_at >= cutoff_time
        ).all()

        # Build dicts for O(1) lookup instead of O(n) loop
        existing_headers = {a.header: a for a in existing_articles}
        existing_subheaders = {a.subheader: a for a in existing_articles}
        for entry in feed["entries"]:
            header = entry.get("title", "").strip()
            if site == "Kan11" and header in ["כל הכתבות", "פוליטי מדיני", "צבא וביטחון", "העולם הערבי", "בארץ", "בעולם",
                                             "כאן כלכלי", "משפט ופלילים", "תרבות ובידור"]:
                continue
            if site == "Israel Hayom" and "news" not in entry["link"].split("/"):
                continue

            raw = entry.get("summary", "")
            subheader = BeautifulSoup(raw, "html.parser").get_text().strip()

            # Format date
            if 'published_parsed' in entry and entry["published_parsed"]:
                dt = datetime(*entry["published_parsed"][:6])
            elif 'updated_parsed' in entry and entry["updated_parsed"]:
                dt = datetime(*entry["updated_parsed"][:6])
            else:
                dt = datetime.now()

            found = False
            if header in existing_headers:
                ea = existing_headers[header]
                if header and subheader != ea.subheader:
                    print(
                        f"changed description:\nprevious:\ntitle: {ea.header}\ndescription: {ea.subheader}\nnew:\ntitle: {header}\ndescription: {subheader}\n")
                    ea.subheader = subheader
                    ea.created_at = dt
                    session.flush()
                    formatted_articles_ids.put(ea.id)
                found = True
            elif subheader in existing_subheaders:
                ea = existing_subheaders[subheader]
                if subheader and header != ea.header:
                    print(
                        f"changed tilte:\nprevious:\ntitle: {ea.header}\ndescription: {ea.subheader}\nnew:\ntitle: {header}\ndescription: {subheader}\n")
                    ea.header = header
                    ea.created_at = dt
                    session.flush()
                    formatted_articles_ids.put(ea.id)
                found = True

            if found:
                continue

            new_article = Article(
                site_id=site_id,
                header=header,
                subheader=subheader,
                created_at=dt,
                link=entry.get("link", "").strip()
            )

            print(f"================ created: {new_article.created_at} ================")
            session.add(new_article)
            session.flush()
            new_articles_ids.put(new_article.id)
        session.commit()
    # print(f"Added {new_count} new entries, and formatted {formatted_count} entries from {site}.")
    # return new_count, formatted_count


def load_new_articles(rss_feeds, clusterer=None):
    new_articles_ids = Queue()
    formatted_articles_ids = Queue()
    threads = []
    for site_id, site, url in rss_feeds:
        cur_thread = threading.Thread(target=crawl, args=(site, url, new_articles_ids, formatted_articles_ids, site_id))
        threads.append(cur_thread)

        try:
            cur_thread.start()
        except Exception as e:
            print(f"error: {e}")
            print(f"failed to load {site}")

    for thread in threads:
        thread.join()
    print("finished crawling feeds")

    print(f"{new_articles_ids.qsize()} new items added, formatted {formatted_articles_ids.qsize()}.")

    if clusterer:
        add_relevant_articles_to_clusterer(clusterer, new_articles_ids, formatted_articles_ids)


if __name__ == "__main__":
    load_new_articles(None)
