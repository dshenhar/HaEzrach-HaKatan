"""Point outlets at the feeds they actually publish to.

N12's address was a sports feed abandoned in September; walla's was a page of the
day before yesterday; shakuf's had a trailing slash its server refuses. Measured
by worker/feed_discover.py, which reports how old a feed's newest item is.

N12 is now every mako news feed that is still moving, and then mako's news
sitemap, which is the only place politics is published at all (news-politics.xml
answers 404). The feeds come first so their version of an article, the one with
a standfirst, is the one kept; the sitemap fills in the rest, and scraping.py
keeps only its news- sections and knows an article by its id, whichever section
it was filed under.

Channel 13 is read from its news sitemap, which its robots.txt opens to crawlers.

    ./run-job.sh haezrach-hakatan /app/migrate/fix_feeds.py
"""
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from store import db

MAKO = "https://rcs.mako.co.il/rss/"

FIX = {
    "N12": [MAKO + "news-israel.xml",
            MAKO + "news-military.xml",
            MAKO + "news-world.xml",
            MAKO + "news-law.xml",
            MAKO + "news-money.xml",
            "https://www.mako.co.il/SiteMap/mako_news/1.xml.gz"],
    "ערוץ 13": ["https://13tv.co.il/Services/sitemapGenerator/xmls/news_sitemap.xml"],
    "וואלה": ["https://rss.walla.co.il/feed/1?type=main"],
    "שקוף": ["https://shakuf.co.il/feed"],
}

found = set()
for site in db.all_sites():
    feeds = FIX.get(site["name"])
    if not feeds:
        continue
    db.save_site(site["id"], {"feeds": feeds, "domain": feeds[0]})
    found.add(site["name"])
    print(f"{site['name']}: {len(feeds)} feed(s) -> {feeds[0]}")
for name in FIX.keys() - found:
    print(f"! no outlet named {name!r} - nothing changed for it")
