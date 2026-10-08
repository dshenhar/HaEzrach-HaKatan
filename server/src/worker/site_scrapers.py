# -*- coding: utf-8 -*-
"""Feed builders for outlets that publish no usable RSS.

Same contract as feedparser and as worker/kan11RssFetcher.py: each function
returns {"entries": [{"title", "summary", "link"}, ...]}. No published date is
available from a section page, so local_ingest falls back to now() - these
articles are timestamped when first seen, not when published. Channel 13's page
is the exception, and its entries carry published_parsed.

    Makor Rishon  Next.js App Router. The homepage streams its payload through
                  self.__next_f.push([1,"..."]); article links and headlines sit
                  in there. /feed and /wp-json both answer 403.
    i24NEWS       React SPA, but the Hebrew homepage is server-rendered, so the
                  headlines are in the HTML. /he/rss returns the page, not a feed.
    BeSheva       No feed and no server-rendered section page. BeSheva is Arutz
                  Sheva's weekly - same publisher, same newsroom - so it reads the
                  Arutz Sheva feed. Attributing those items to BeSheva is an
                  editorial call, not a technical one: if you want them separated,
                  BeSheva needs a rendered scrape of inn.co.il/besheva.
    Channel 13    Its news sitemap is open to crawlers, but the file is rebuilt
                  only now and then - it once went a whole day without a new
                  item. The news page is current to the minute, and Next.js hands
                  it its articles as data in __NEXT_DATA__: the headline, the
                  standfirst and the publication time. The sitemap is still read
                  behind it. 13tv answers 403 to the browser this file claims to
                  be, so this one builder asks under the crawler's own name and
                  keeps to robots.txt, like the feeds do.
"""
import json
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

import sitemap as news_sitemap

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Accept-Language": "he-IL,he;q=0.9"}
TIMEOUT = 20


def _get(url):
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    return r.text


def fetch_makor_rishon():
    """Pull headlines out of the Next.js RSC payload on the homepage."""
    html = _get("https://www.makorrishon.co.il/")

    chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html, re.S)
    blob = ""
    for c in chunks:
        try:
            blob += json.loads('"%s"' % c)
        except ValueError:
            continue

    # an article link looks like /news/defence/article/370566; /writer/<id> is an
    # author page and must not be mistaken for one
    pattern = re.compile(
        r'"href":"(/(?:news|magazine|opinions|culture|lifestyle)/[^"]*?/\d{5,}[^"]*)"'
        r'.{0,600}?"children":"([^"]{15,200})"', re.S)

    entries, seen = [], set()
    for href, title in pattern.findall(blob):
        title = title.strip()
        if href in seen or not title:
            continue
        seen.add(href)
        entries.append({
            "title": title,
            "summary": "",
            "link": "https://www.makorrishon.co.il" + href,
        })
    return {"entries": entries}


def _abs(base, href):
    """i24 mixes absolute and relative hrefs in the same page."""
    return href if href.startswith("http") else base + href


def fetch_i24():
    """The Hebrew homepage is server-rendered; headlines sit in heading tags."""
    soup = BeautifulSoup(_get("https://www.i24news.tv/he"), "html.parser")

    entries, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        path = href.replace("https://www.i24news.tv", "")
        if not path.startswith("/he/") or path.count("/") < 3:
            continue
        heading = a.find(["h1", "h2", "h3", "h4"])
        title = (heading.get_text(strip=True) if heading else "")
        if len(title) < 15 or path in seen:
            continue
        seen.add(path)
        entries.append({
            "title": title,
            "summary": "",
            "link": _abs("https://www.i24news.tv", path),
        })

    if not entries:  # the anchors may not wrap the headings; fall back to headings
        for h in soup.select("h3.widget-typography-title, h2.widget-typography-title"):
            title = h.get_text(strip=True)
            link = h.find_parent("a", href=True)
            if len(title) < 15:
                continue
            entries.append({
                "title": title,
                "summary": "",
                "link": _abs("https://www.i24news.tv", link["href"]) if link else "https://www.i24news.tv/he",
            })
    return {"entries": entries}


def fetch_besheva():
    """Arutz Sheva's full news feed, attributed to BeSheva. See module docstring."""
    import feedparser
    parsed = feedparser.parse("https://www.inn.co.il/Rss.aspx?act=.2")
    return {"entries": parsed.get("entries", [])}


CHANNEL_13 = "https://13tv.co.il"
# the page gives "2026-10-08 10:22:01" and means Israel time
ISRAEL = ZoneInfo("Asia/Jerusalem")


def _channel13_articles(data) -> list[dict]:
    """Every article the page data holds, once each: a link under /item/news/, a
    headline and a publication time. The live blog's day pages have no time and
    are not articles."""
    out, seen = [], set()

    def walk(node):
        if isinstance(node, list):
            for value in node:
                walk(value)
            return
        if not isinstance(node, dict):
            return
        link, title, published = node.get("link"), node.get("title"), node.get("publishDate")
        if (isinstance(link, str) and link.startswith("/item/news/") and title and published
                and link not in seen):
            try:
                when = datetime.strptime(published, "%Y-%m-%d %H:%M:%S").replace(tzinfo=ISRAEL)
            except (TypeError, ValueError):
                when = None
            if when:
                seen.add(link)
                out.append({"title": title, "summary": node.get("secondaryTitle") or "",
                            "link": CHANNEL_13 + link,
                            "published_parsed": when.astimezone(timezone.utc).timetuple()})
        for value in node.values():
            walk(value)

    walk(data)
    return out


def fetch_channel13():
    """The news page first, then the news sitemap. See module docstring."""
    # here and not at the top: scraping.py imports this file
    from scraping import UA as OURS, allowed
    head = {"User-Agent": OURS, "Accept-Language": "he-IL,he;q=0.9"}
    entries = []

    page = CHANNEL_13 + "/news/"
    try:
        if allowed(page):
            r = requests.get(page, headers=head, timeout=TIMEOUT)
            r.raise_for_status()
            found = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.S)
            entries += _channel13_articles(json.loads(found.group(1))) if found else []
    except Exception as err:
        print(f"  ! ערוץ 13: news page: {err}")

    # the same articles by the same addresses, so the ingest keeps one of each
    sitemap = CHANNEL_13 + "/Services/sitemapGenerator/xmls/news_sitemap.xml"
    try:
        if allowed(sitemap):
            r = requests.get(sitemap, headers=head, timeout=TIMEOUT)
            r.raise_for_status()
            entries += news_sitemap.entries(r.content)
    except Exception as err:
        print(f"  ! ערוץ 13: sitemap: {err}")
    return {"entries": entries}


SCRAPERS = {
    "מקור ראשון": fetch_makor_rishon,
    "i24News": fetch_i24,
    "בשבע": fetch_besheva,
    "ערוץ 13": fetch_channel13,
}
