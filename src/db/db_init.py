import asyncio
from sqlalchemy import text, insert
from sqlalchemy.ext.asyncio import create_async_engine


# IMPORTANT: import all models
from models import Site, Cluster, Article, Base, Topic
DATABASE_URL = (
    "postgresql+asyncpg://postgres:Agltv4213@localhost/news360"
)

rss_feeds = {
    "Kan11": None,
    # "C14": "https://www.c14.co.il/feed/",
    "Ynet": "https://www.ynet.co.il/Integration/StoryRss2.xml",
    "Haaretz": "https://www.haaretz.co.il/srv/rss---feedly",
    "Globes": "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2",
    "Walla": "https://rss.walla.co.il/feed/1",
    # "Israel National News": "https://www.israelnationalnews.com/Rss.aspx",
    # "Hayadan": "https://www.hayadan.org.il/feed",
    # "Jerusalem Post (Ivrit)": "https://www.jpost.com/rss/premiumrss/rssfeedsivrit.aspx",
    "Calcalist": "https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml",
    "Kikar HaShabbat": "https://a.kikar.co.il/v1/rss/scoop-news/latest/rss2",
    "N12": "https://rcs.mako.co.il/rss/31750a2610f26110VgnVCM1000005201000aRCRD.xml",
    # "Mako politics": "https://rcs.mako.co.il/rss/news-military.xml",
    "Israel Hayom": "https://www.israelhayom.co.il/rss.xml",
    "The Marker": "https://www.themarker.com/srv/tm-news",
    "Maariv": "https://www.maariv.co.il/Rss/RssChadashot",
    # "0404": "https://www.0404.co.il/rss/rss"
}

topics = [
    "שתי מדינות",
    "סיפוח שטחי C",
    "חלוקת ירושלים",
    "סיכולים ממוקדים",
    "בנייה בהתנחלויות",
    "מאחזים",
    "פינוי ההתנחלויות",
    "עסקת המאה",
    "חוק הלאום",
    "כלכלה",
    "קצבאות לחלשים",
    "מימון ישיבות",
    "דיור ציבורי",
    "לימודי ליבה",
    "גיוס חרדים",
    "נישואים אזרחיים",
    "נישואים חד מיניים",
    "סביבה",
    "מהגרי עבודה",
    "עצמאות שיפוטית",
    "ליגליזציה",
    "טיפולי המרה",
]


async def init_db():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        # Enable pgvector
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

        # Create tables
        await conn.run_sync(Base.metadata.create_all)

        # Create indexes for vector search
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS clusters_centroid_hnsw
            ON clusters
            USING hnsw (centroid_embedding vector_cosine_ops);
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS articles_embedding_hnsw
            ON articles
            USING hnsw (embedding vector_cosine_ops);
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_articles_topic_site
            ON articles (topic_id, site_id);
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_articles_topic_site_created
            ON articles (topic_id, site_id, created_at);
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_votes_article
            ON votes (article_id);
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_articles_cluster
            ON articles (cluster_id);
        """))

        # values = [
        #     {"name": name, "domain": domain}
        #     for name, domain in rss_feeds.items()
        # ]
        # await conn.execute(insert(Site).values(values))

        # values = [
        #     {"name": topic}
        #     for topic in topics
        # ]
        # await conn.execute(insert(Topic).values(values))

    print("Database initialized successfully")


if __name__ == "__main__":
    asyncio.run(init_db())
