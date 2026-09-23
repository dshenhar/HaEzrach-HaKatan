"""Create the schema and seed sites + topics on a fresh local database.

Meant to be run inside the api container, where DATABASE_URL is already set and
/db is on PYTHONPATH:

    docker compose exec api python /db/local_init.py

This is the sync (psycopg2) equivalent of db_init.py, which targets asyncpg and a
hardcoded localhost URL and has its seed inserts commented out.
Safe to run more than once.
"""
import os

from sqlalchemy import create_engine, text, select
from sqlalchemy.orm import sessionmaker

from models import Base, Site, Topic

# name -> rss feed url. Every url below was fetched and confirmed to return items.
# The bloc grouping in the comments is a starting point for seeding priors, not a
# stored field: a site's bloc is meant to fall out of site_topic_prior_bias summed
# across topics against a breaking point, so it is never hardcoded on the row.
rss_feeds = {
    # --- right ---
    "ישראל היום": "https://www.israelhayom.co.il/rss.xml",
    "ערוץ 14": "https://www.now14.co.il/feed/",
    "ערוץ 7": "https://www.inn.co.il/Rss.aspx",
    "סרוגים": "https://www.srugim.co.il/feed/",
    "מידה": "https://mida.org.il/?feed=rss2",
    # no usable RSS - need a scraper like worker/kan11RssFetcher.py
    "מקור ראשון": None,
    "בשבע": None,
    "i24News": None,
    # --- right, haredi press ---
    "כיכר השבת": "https://a.kikar.co.il/v1/rss/scoop-news/latest/rss2",
    "בחדרי חרדים": "https://www.bhol.co.il/rss",
    "חדשות JDN": "https://www.jdn.co.il/feed/",
    "חרדים 10": "https://www.ch10.co.il/feed/",
    "כל הזמן": "https://www.kolhazman.co.il/feed/",

    # --- left ---
    "הארץ": "https://www.haaretz.co.il/srv/rss---feedly",
    "דה מרקר": "https://www.themarker.com/srv/tm-news",
    "שיחה מקומית": "https://www.mekomit.co.il/feed/",
    "זמן ישראל": "https://www.zman.co.il/feed/",
    "דבר": "https://www.davar1.co.il/feed/",
    "שקוף": "https://shakuf.co.il/feed/",
    "972+": "https://www.972mag.com/feed/",
    # --- left, arab press ---
    "ערב 48": "https://www.arab48.com/rss",
    "חיפה נט": "https://www.haifanet.co.il/feed/",

    # --- centre / unaligned ---
    "כאן 11": None,
    "ערוץ 13": None,
    "Ynet": "https://www.ynet.co.il/Integration/StoryRss2.xml",
    "וואלה": "https://rss.walla.co.il/feed/1",
    "N12": "https://rcs.mako.co.il/rss/31750a2610f26110VgnVCM1000005201000aRCRD.xml",
    "מעריב": "https://www.maariv.co.il/Rss/RssChadashot",
    "גלובס": "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2",
    "כלכליסט": "https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml",
}

# Confirmed to have no usable RSS: Makor Rishon and News1 (403 to any user agent),
# Panet, Bokra, Kul al-Arab and A-Sinara (404 or no feed at all). Panet and
# A-Sinara appear in the designs, so they need a scraper of their own - the same
# treatment Kan11 already gets in worker/kan11RssFetcher.py.

GENERAL_TOPIC = "חדשות כלליות"

topics = [
    "שתי מדינות", "סיפוח שטחי C", "חלוקת ירושלים", "סיכולים ממוקדים",
    "בנייה בהתנחלויות", "מאחזים", "פינוי ההתנחלויות", "עסקת המאה",
    "חוק הלאום", "כלכלה", "קצבאות לחלשים", "מימון ישיבות",
    "דיור ציבורי", "לימודי ליבה", "גיוס חרדים", "נישואים אזרחיים",
    "נישואים חד מיניים", "סביבה", "מהגרי עבודה", "עצמאות שיפוטית",
    "ליגליזציה", "טיפולי המרה",
    # A landing place for "this is news, but it is not one of the 22 issues".
    # Without it every correction teaches a political label, even when the honest
    # answer is that the article has no political topic - which quietly biases
    # everything learned from dev mode.
    GENERAL_TOPIC,
]

# No vector indexes. Nothing searches articles by vector, and a new article is
# matched only against the stories of the last few hours - a few hundred rows, which
# an exact scan handles in milliseconds. An HNSW index there was the wrong tool: it
# applies the time filter AFTER its approximate search, so the nearest story inside
# the window could be missed and a duplicate story opened.
DROP_INDEXES = [
    "DROP INDEX IF EXISTS clusters_centroid_hnsw;",
    "DROP INDEX IF EXISTS articles_embedding_hnsw;",
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_clusters_created ON clusters (created_at);",
    "CREATE INDEX IF NOT EXISTS idx_articles_created ON articles (created_at);",
    "CREATE INDEX IF NOT EXISTS idx_articles_topic_site ON articles (topic_id, site_id);",
    "CREATE INDEX IF NOT EXISTS idx_articles_topic_site_created ON articles (topic_id, site_id, created_at);",
    "CREATE INDEX IF NOT EXISTS idx_votes_article ON votes (article_id);",
    "CREATE INDEX IF NOT EXISTS idx_articles_cluster ON articles (cluster_id);",
]


# outlets that publish in Arabic - their items get translated at ingest
ARABIC_SITES = {"ערב 48", "חיפה נט"}

# The 18 the map is drawn from - nine a side. Everything else is still scraped and
# still scored, it just does not crowd the axes.
ROSTER = {
    "i24News", "ישראל היום", "ערוץ 14", "בשבע", "סרוגים", "מידה",
    "כיכר השבת", "בחדרי חרדים", "מקור ראשון",
    "ערוץ 13", "מעריב", "הארץ", "דה מרקר", "שקוף",
    "Ynet", "וואלה", "כאן 11", "N12",
}


def main():
    engine = create_engine(os.environ["DATABASE_URL"])

    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        # create_all never adds columns to a table that already exists
        conn.execute(text(
            "ALTER TABLE IF EXISTS sites ADD COLUMN IF NOT EXISTS "
            "language varchar(8) NOT NULL DEFAULT 'he'"))
        conn.execute(text("ALTER TABLE IF EXISTS topics ADD COLUMN IF NOT EXISTS pole_right varchar(64)"))
        conn.execute(text("ALTER TABLE IF EXISTS topics ADD COLUMN IF NOT EXISTS pole_left varchar(64)"))
        conn.execute(text(
            "ALTER TABLE IF EXISTS sites ADD COLUMN IF NOT EXISTS "
            "in_roster boolean NOT NULL DEFAULT false"))
        conn.execute(text(
            "ALTER TABLE IF EXISTS cluster_summaries ADD COLUMN IF NOT EXISTS article_count integer"))
        conn.execute(text("ALTER TABLE IF EXISTS articles ADD COLUMN IF NOT EXISTS topic_model varchar(32)"))
        conn.execute(text("ALTER TABLE IF EXISTS clusters ALTER COLUMN centroid_embedding DROP NOT NULL"))

    Base.metadata.create_all(engine)

    with engine.begin() as conn:
        for stmt in DROP_INDEXES + INDEXES:
            conn.execute(text(stmt))

    Session = sessionmaker(bind=engine)
    with Session() as session:
        existing_sites = set(session.execute(select(Site.name)).scalars().all())
        for name, domain in rss_feeds.items():
            if name not in existing_sites:
                session.add(Site(name=name, domain=domain))
                print(f"+ site   {name}")

        existing_topics = set(session.execute(select(Topic.name)).scalars().all())
        for name in topics:
            if name not in existing_topics:
                session.add(Topic(name=name))
                print(f"+ topic  {name}")

        session.commit()

        for site in session.execute(select(Site)).scalars():
            wanted = "ar" if site.name in ARABIC_SITES else "he"
            if site.language != wanted:
                site.language = wanted
                print(f"~ {site.name} language -> {wanted}")
            on_roster = site.name in ROSTER
            if site.in_roster != on_roster:
                site.in_roster = on_roster
        session.commit()
        print(f"roster: {len(ROSTER)} sites drawn on the map")

        n_sites = len(session.execute(select(Site.id)).scalars().all())
        n_topics = len(session.execute(select(Topic.id)).scalars().all())

    print(f"\nready: {n_sites} sites, {n_topics} topics")


if __name__ == "__main__":
    main()
