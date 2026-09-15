# -*- coding: utf-8 -*-
"""Feed builders for outlets that publish no usable RSS.

Same contract as feedparser and as worker/kan11RssFetcher.py: each function
returns {"entries": [{"title", "summary", "link"}, ...]}. No published date is
available from a section page, so local_ingest falls back to now() - these
articles are timestamped when first seen, not when published.

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

Channel 13 has no builder. 13tv.co.il, 13news.co.il and reshet.tv answer 403 to
every request, homepage included - an explicit block, not a missing feed. Getting
it needs their permission, not a smarter scraper.
"""
import json
import re

import requests
from bs4 import BeautifulSoup

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


SCRAPERS = {
    "מקור ראשון": fetch_makor_rishon,
    "i24News": fetch_i24,
    "בשבע": fetch_besheva,
}
