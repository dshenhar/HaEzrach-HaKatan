"""What this machine can read. The point is to run it where the ingest runs.

An outlet that answers a laptop on a home line and refuses a server in a Google
datacentre is not blocking us, it is blocking datacentres - and the answer to
that is a door it leaves open to crawlers on purpose, not a cleverer disguise.
This prints, per outlet, what each address gives back from here.
"""
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import feedparser
import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from store import db
import sitemap as news_sitemap

UA = os.environ.get("UA_KIND", "chrome")
AGENTS = {
    "chrome": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
               "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
    "honest": "HaEzrachHaKatanBot/1.0 (+https://haezrach-hakatan.web.app; haezrachh@gmail.com)",
}
HEAD = {"User-Agent": AGENTS.get(UA, AGENTS["chrome"]), "Accept-Language": "he-IL,he;q=0.9"}

# the addresses worth trying beyond the one we store, per host
GUESSES = ["/sitemap-news.xml", "/news-sitemap.xml", "/sitemap_news.xml", "/robots.txt"]


def age(stamps) -> str:
    best = None
    for t in stamps:
        if not t:
            continue
        when = datetime(*t[:6], tzinfo=timezone.utc)
        if best is None or when > best:
            best = when
    if best is None:
        return "no dates"
    return f"{(datetime.now(timezone.utc) - best).total_seconds() / 3600:.1f}h"


def ask(url: str) -> str:
    try:
        r = requests.get(url, headers=HEAD, timeout=15)
    except Exception as err:
        return f"{type(err).__name__}"
    if r.status_code != 200:
        return str(r.status_code)
    if url.endswith("robots.txt"):
        maps = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", r.text)
        return f"200 robots, {len(maps)} maps: " + " ".join(maps[:3])
    items = feedparser.parse(r.content).get("entries", [])
    if items:
        return f"200 feed {len(items)} items, newest {age(e.get('published_parsed') or e.get('updated_parsed') for e in items)}"
    items = news_sitemap.entries(r.content)
    if items:
        return f"200 SITEMAP {len(items)} items, newest {age(e['published_parsed'] for e in items)}"
    return f"200 but empty ({len(r.content)} bytes)"


def main() -> None:
    sites = sorted(db.all_sites(), key=lambda s: s["name"])
    print(f"asking as: {UA}\n")
    for site in sites:
        urls = list(site.get("feeds") or [])
        if site.get("domain"):
            urls.append(site["domain"])
        if not urls:
            print(f"{site['name']}\n   (no address stored)")
            continue
        host = re.match(r"https?://[^/]+", urls[0])
        tries = urls + ([host.group(0) + g for g in GUESSES] if host else [])
        print(site["name"])
        with ThreadPoolExecutor(max_workers=5) as ex:
            for url, answer in zip(tries, ex.map(ask, tries)):
                print(f"   {answer[:96]:<96} {url[:70]}")


if __name__ == "__main__":
    main()
