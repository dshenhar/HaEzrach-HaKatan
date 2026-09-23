# rss_kan.py
# Unofficial RSS for https://www.kan.org.il/lobby/news using urllib only
# Compatible with a consumer script that expects a feedparser-like object
# with an .entries list where each entry has: title, summary, link,
# and either published_parsed or updated_parsed (time.struct_time).
#
# Usage:
#   python rss_kan.py            -> writes feed.xml (optional)
#   python rss_kan.py serve 8000 -> serves /rss.xml (optional)
#   from rss_kan import generate_feed  # returns SimpleNamespace(entries=[...])

from __future__ import annotations

import sys
import re
import html
import time
from datetime import datetime, timezone
from types import SimpleNamespace
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from http.server import BaseHTTPRequestHandler, HTTPServer

from bs4 import BeautifulSoup  # external
try:
    from feedgen.feed import FeedGenerator  # external (only for XML output/serving)
    FEEDGEN_AVAILABLE = True
except Exception:
    FeedGenerator = None  # type: ignore
    FEEDGEN_AVAILABLE = False
from dateutil import parser as dateparser  # external

BASE_URL = "https://www.kan.org.il"
LIST_URL = "https://www.kan.org.il/lobby/news"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36"
)
TIMEOUT = 15


def _get(url: str) -> tuple[str, dict]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
        "Connection": "keep-alive",
        "Referer": BASE_URL,  # Pretend we came from the site
    }
    req = Request(url, headers=headers)
    with urlopen(req, timeout=TIMEOUT) as resp:
        content_type = resp.headers.get("Content-Type", "")
        raw = resp.read()
        encoding = "utf-8"
        m = re.search(r"charset=([\w-]+)", content_type)
        if m:
            encoding = m.group(1)
        text = raw.decode(encoding, errors="replace")
        headers = {k: v for k, v in resp.headers.items()}
        return text, headers


def discover_article_links(list_html: str, limit: int = 20) -> list[str]:
    soup = BeautifulSoup(list_html, "html.parser")
    links: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        abs_url = urljoin(BASE_URL, href)
        parsed = urlparse(abs_url)
        if parsed.netloc.endswith("kan.org.il") and re.search(r"/content/kan-news/", parsed.path):
            links.append(abs_url)
    seen = set()
    uniq = []
    for u in links:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq[:limit]


def extract_meta_content(soup: BeautifulSoup, prop: str) -> str | None:
    tag = soup.find("meta", attrs={"property": prop})
    if tag and tag.get("content"):
        return tag["content"].strip()
    tag = soup.find("meta", attrs={"name": prop})
    if tag and tag.get("content"):
        return tag["content"].strip()
    return None


def parse_article(url: str) -> dict:
    try:
        html_text, headers = _get(url)
    except (URLError, HTTPError) as e:
        return {"url": url, "error": str(e)}

    soup = BeautifulSoup(html_text, "html.parser")

    # Title
    title = None
    h1 = soup.find(["h1", "h2"], string=True)
    if h1:
        title = h1.get_text(strip=True)
    if not title:
        title = extract_meta_content(soup, "og:title") or extract_meta_content(soup, "twitter:title")

    # Description (text)
    description = extract_meta_content(soup, "description") or extract_meta_content(soup, "og:description")
    if not description:
        p = soup.find("p")
        if p:
            description = p.get_text(" ", strip=True)
    description = description or ""

    # Image
    image = extract_meta_content(soup, "og:image") or extract_meta_content(soup, "twitter:image")
    # Build HTML summary the way feedparser entries often carry it
    if image:
        summary_html = f'<p><img src="{html.escape(image, quote=True)}" alt=""/></p>'
        if description:
            summary_html += f"<p>{html.escape(description)}</p>"
    else:
        summary_html = html.escape(description)

    # Publication date → struct_time
    pub_dt = None
    for dts in [
        extract_meta_content(soup, "article:published_time"),
        extract_meta_content(soup, "og:updated_time"),
        extract_meta_content(soup, "article:modified_time"),
    ]:
        if dts:
            try:
                pub_dt = dateparser.parse(dts)
                break
            except Exception:
                pass
    if not pub_dt:
        time_tag = soup.find("time", attrs={"datetime": True})
        if time_tag:
            try:
                pub_dt = dateparser.parse(time_tag["datetime"])  # type: ignore
            except Exception:
                pass
    if not pub_dt:
        try:
            pub_dt = dateparser.parse(headers.get("Date"))  # type: ignore
        except Exception:
            pub_dt = None

    published_parsed = None
    if pub_dt:
        if not pub_dt.tzinfo:
            pub_dt = pub_dt.replace(tzinfo=timezone.utc)
        published_parsed = pub_dt.timetuple()

    return {
        "title": title or url,
        "link": url,
        "summary": summary_html,
        "published_parsed": published_parsed,
    }


def generate_feed():
    """Return a feedparser-like object with .entries for your loop."""
    list_html, _ = _get(LIST_URL)
    links = discover_article_links(list_html, limit=30)
    items = [parse_article(u) for u in links]
    entries = [it for it in items if it.get("title")]
    return {"entries": entries}


# ---------- Optional XML feed & tiny server (kept for completeness) ----------

def _build_feed_xml(entries: list[dict]) -> bytes:
    if not FEEDGEN_AVAILABLE:
        return "".encode("utf-8")
    fg = FeedGenerator()
    fg.id(LIST_URL)
    fg.title("כאן חדשות – פיד לא רשמי (לובי החדשות)")
    fg.link(href=LIST_URL, rel="alternate")
    fg.link(href=urljoin(LIST_URL, "/rss.xml"), rel="self")
    fg.description("פיד RSS לא רשמי שנבנה מסריקה של עמוד הלובי חדשות של כאן.")
    fg.language("he")
    for e in entries:
        fe = fg.add_entry()
        fe.id(e["link"])
        fe.title(e["title"])
        fe.link(href=e["link"])
        fe.description(e.get("summary") or "")
        pp = e.get("published_parsed")
        if pp:
            fe.pubDate(datetime(*pp[:6], tzinfo=timezone.utc))
    return fg.rss_str(pretty=True)


class RSSRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        if self.path.rstrip("/") in ("/rss.xml", "/rss"):
            try:
                feed = generate_feed()
                xml_bytes = _build_feed_xml(feed.entries)
                self.send_response(200)
                self.send_header("Content-Type", "application/rss+xml; charset=utf-8")
                self.end_headers()
                self.wfile.write(xml_bytes)
            except Exception as e:
                msg = ("Error generating feed: " + str(e)).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(msg)
        else:
            body = (
                "KAN News RSS Proxy (Unofficial)\n\n"
                f"Source: {LIST_URL}\n"
                "Use /rss.xml to get the feed.\n"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(body)


def serve(port: int = 8000):
    httpd = HTTPServer(("0.0.0.0", port), RSSRequestHandler)
    print(f"Serving RSS on http://0.0.0.0:{port}/rss.xml")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
        serve(port)
    else:
        # Optional: write an XML file if feedgen is installed
        feed = generate_feed()
        xml = _build_feed_xml(feed.entries)
        with open("feed.xml", "wb") as f:
            f.write(xml)
        print("Wrote feed.xml (if empty, install feedgen)")


# requirements.txt (external deps only)
# beautifulsoup4==4.12.3
# python-dateutil==2.9.0.post0
# feedgen==0.9.0   # optional, only if you want the /rss.xml output