import random
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from db.db_session import SessionLocal
from db.models import Cluster, Article, Site


def _get_category(subtopic):
    if subtopic in ["שתי מדינות", "סיפוח שטחי C", "חלוקת ירושלים", "סיכולים ממוקדים"]:
        return "הסכסוך הישראלי-פלסטיני"
    if subtopic in ["בנייה בהתנחלויות", "מאחזים", "פינוי ההתנחלויות"]:
        return "התנחלויות"
    if subtopic in ["עסקת המאה"]:
        return "עסקת המאה"
    if subtopic in ["חוק הלאום"]:
        return "ערביי ישראל"
    if subtopic in ["כלכלה", "קצבאות לחלשים", "מימון ישיבות", "דיור ציבורי"]:
        return "מדיניות כלכלית"
    if subtopic in ["לימודי ליבה", "גיוס חרדים", "נישואים אזרחיים", "נישואים חד מיניים"]:
        return "יחסי דת-מדינה"
    if subtopic in ["סביבה", "מהגרי עבודה", "עצמאות שיפוטית", "ליגליזציה", "טיפולי המרה"]:
        return "שונות"
    return "שונות"


# Readers think in Israeli calendar days, the database stores UTC.
LOCAL_TZ = ZoneInfo("Asia/Jerusalem")
# A day that has barely started has barely any news, so a thin morning falls back
# to a rolling day rather than showing an empty feed.
MIN_STORIES = 5


def _day_start_utc() -> datetime:
    """Midnight today in Israel, as a naive UTC value to compare against."""
    local_midnight = datetime.now(LOCAL_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    return local_midnight.astimezone(timezone.utc).replace(tzinfo=None)


def _fetch(session, cutoff):
    return (
        session.query(Article, Site.name, Site.bias_score, Site.language)
        .join(Cluster, Article.cluster_id == Cluster.id).join(Site, Article.site_id == Site.id)
        .filter(Cluster.created_at >= cutoff, Cluster.article_count >= 2)
        .order_by(Cluster.created_at.desc(), Article.created_at)
        .all()
    )


def get_clusters():
    formatted_data = []
    cutoff = _day_start_utc()
    with SessionLocal() as session:
        articles = _fetch(session, cutoff)
        if len({a[0].cluster_id for a in articles}) < MIN_STORIES:
            articles = _fetch(session, datetime.utcnow() - timedelta(hours=24))
        # print(articles)
        counter = 0
        while counter < len(articles):
            cluster_id = articles[counter][0].cluster_id
            temp_articles = []
            articles_topics = {}
            while counter < len(articles) and articles[counter][0].cluster_id == cluster_id:
                article, site_name, site_bias_score, site_language = articles[counter]
                articles_topics[article.topic.name] = articles_topics.get(article.topic.name, 0) + 1
                temp_articles.append({
                    "id": str(article.cluster_id) + "-" + str(article.id),
                    "title": article.header,
                    "source": site_name,
                    "time": article.created_at.isoformat() + "Z",
                    "summary": article.subheader,
                    "biasScore": article.bias_score if article.bias_score else random.randint(-5, 5),
                    "siteBiasScore": site_bias_score if site_bias_score else random.randint(-5, 5),
                    "topic": None,
                    "category": None,
                    "link": article.link,
                    "groupId": article.cluster_id,
                    "language": site_language,
                })
                counter += 1
            topic = max(articles_topics, key=articles_topics.get)
            for art in temp_articles:
                art["topic"] = topic
                art["category"] = _get_category(topic)
            temp_articles = sorted(temp_articles, key=lambda x: x["biasScore"])
            # the feed shows the first item of each cluster, and that item must be
            # from a Hebrew outlet - a translated headline should never be the face
            # of a story when an original Hebrew one exists
            temp_articles.sort(key=lambda x: x.get("language", "he") != "he")
            formatted_data.append(temp_articles)
        return formatted_data
