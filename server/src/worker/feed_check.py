"""Why an outlet is missing from the feed, one outlet at a time.

    python feed_check.py [--site "הארץ"]

For every outlet it tries the address we have, and then the feed addresses a site
of that kind usually publishes, with two identities: the one the scraper uses
today, and an honest one that says who we are and how to reach us.

Nothing here tries to get past a refusal. A site that answers 403 to a crawler
that has named itself is a site that does not want to be read this way, and the
answer to that is an email to its editor, not a cleverer request.
"""
import argparse
import os
import sys
import time
from urllib.parse import urlparse

import feedparser
import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from store import db

# What the scraper sends today: a browser that we are not. Kept here to measure
# against, not to keep.
BROWSER = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
           "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
# Who we actually are, with a way to ask us to stop
HONEST = ("HaEzrachHaKatanBot/1.0 (+https://haezrach-hakatan.web.app; "
          "haezrachh@gmail.com)")

HEADERS = {
    "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
}

# the paths a Hebrew news site publishes its feed at, in the order worth trying
PATHS = ["", "/feed", "/feed/", "/rss", "/rss.xml", "/feed/rss", "/?feed=rss2",
         "/rss/news", "/sitemap-news.xml"]


def try_one(url: str, agent: str) -> tuple[int | str, int]:
    try:
        r = requests.get(url, headers={**HEADERS, "User-Agent": agent}, timeout=12)
    except Exception as err:
        return type(err).__name__, 0
    if r.status_code != 200:
        return r.status_code, 0
    return 200, len(feedparser.parse(r.content).get("entries", []))


def check(name: str, domain: str) -> None:
    print(f"\n{name}  ({domain})")
    if not domain:
        print("   no address stored")
        return

    base = f"{urlparse(domain).scheme}://{urlparse(domain).netloc}"
    tried = []
    for path in PATHS:
        url = domain if path == "" else base + path
        if url in tried:
            continue
        tried.append(url)
        for label, agent in (("as a browser", BROWSER), ("as ourselves", HONEST)):
            status, entries = try_one(url, agent)
            if status == 200 and entries:
                print(f"   ✅ {entries:>3} entries  {label:<13} {url}")
                return
            if status != 200:
                print(f"   {status}  {label:<13} {url}")
            time.sleep(0.4)
    print("   nothing answered with a feed")


def main(only: str | None) -> None:
    sites = sorted(db.all_sites(), key=lambda s: s["name"])
    for site in sites:
        if only and site["name"] != only:
            continue
        check(site["name"], site.get("domain") or "")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", default=None)
    main(parser.parse_args().site)
