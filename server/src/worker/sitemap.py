"""A news sitemap, read as if it were a feed.

Google asks publishers for this one file - the headline, the address and the
publication time of everything they have put out in the last two days - and they
keep it open to whatever asks for it, because Googlebot reads it from a datacentre
like any other crawler. Several outlets here wall off their RSS and serve this to
anyone, which makes it the honest way in: it is the file they publish *for*
machines, and it carries exactly what a story needs and nothing more.

The entries come out shaped like feedparser's, so nothing downstream has to know
where they came from.
"""
from datetime import datetime, time, timedelta, timezone
from xml.etree import ElementTree

# a page dated before this is a publisher writing a placeholder, not a date
EPOCH_FLOOR = 1990


def _name(tag: str) -> str:
    """the tag without its namespace - sitemaps use three of them"""
    return tag.rsplit("}", 1)[-1]


def _when(text) -> datetime | None:
    if not text:
        return None
    try:
        when = datetime.fromisoformat(text.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if when.year < EPOCH_FLOOR:
        return None          # kan dates a page it is still writing 0001-01-01
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return when


def _published(field: dict, url) -> datetime | None:
    published = _when(field.get("publication_date"))
    edited = _when(field.get("lastmod"))
    # Channel 13 gives the day and not the hour - every item at midnight - and its
    # lastmod is the last edit. An edit cannot come before the publication, so the
    # earlier of the edit and the end of that day is the nearest time that never
    # makes a story from yesterday evening look a day old and drop out.
    if published and edited and published.time() == time(0):
        published = min(edited, published + timedelta(days=1, seconds=-1))
    # the attribute is kan's, and it is the only true time they publish
    return published or _when(url.get("SortDateTime")) or edited


def looks_like_one(body: bytes) -> bool:
    head = body[:800].lower()
    return b"<urlset" in head and b"sitemap-news" in head or b"<news:news" in body[:4000].lower()


def entries(body: bytes) -> list[dict]:
    try:
        root = ElementTree.fromstring(body.lstrip(b"\xef\xbb\xbf").strip())
    except ElementTree.ParseError:
        return []
    out = []
    for url in root:
        if _name(url.tag) != "url":
            continue
        field = {}
        for child in url.iter():
            text = (child.text or "").strip()
            if text:
                field.setdefault(_name(child.tag), text)
        title, link = field.get("title"), field.get("loc")
        if not title or not link:
            continue
        when = _published(field, url)
        out.append({"title": title, "link": link, "summary": "",
                    "published_parsed": when.astimezone(timezone.utc).timetuple() if when else None})
    return out
