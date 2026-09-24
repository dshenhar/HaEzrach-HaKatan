"""Point three outlets at the feeds they actually publish to.

N12's address was a sports feed abandoned in September; walla's was a page of the
day before yesterday; shakuf's had a trailing slash its server refuses. Measured
by worker/feed_discover.py, which reports how old a feed's newest item is.
"""
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from store import db

FIX = {
    "N12": ["https://rcs.mako.co.il/rss/news-israel.xml",
            "https://rcs.mako.co.il/rss/news-military.xml"],
    "וואלה": ["https://rss.walla.co.il/feed/1?type=main"],
    "שקוף": ["https://shakuf.co.il/feed"],
}

for site in db.all_sites():
    feeds = FIX.get(site["name"])
    if not feeds:
        continue
    db.save_site(site["id"], {"feeds": feeds, "domain": feeds[0]})
    print(f"{site['name']}: {len(feeds)} feed(s) -> {feeds[0]}")
