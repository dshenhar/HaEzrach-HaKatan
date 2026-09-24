"""Find the feed an outlet actually publishes to today.

    python feed_discover.py

A feed that answers is not the same as a feed that is alive: three of the biggest
outlets in the country were handing us items from days and months ago, which the
ingest then dropped as too old - so the outlet looked blocked when it was only
pointed at an abandoned address.

For each outlet this reads the page it publishes and collects the feeds it
advertises in its own head (the standard way a site says "here is my feed"),
tries a few addresses its publishing system is known to use, and reports how old
the newest item in each one is. The age is the number that matters.
"""
import os
import re
import sys
from datetime import datetime, timezone

import feedparser
import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from store import db

UA = ("HaEzrachHaKatanBot/1.0 (+https://haezrach-hakatan.web.app; haezrachh@gmail.com) "
      "Mozilla/5.0 (compatible)")
HEADERS = {"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/html;q=0.8"}

# addresses worth trying per site, beyond whatever the page advertises
HOMES = {
    "ערוץ 13": "https://13tv.co.il", "מקור ראשון": "https://www.makorrishon.co.il",
    "זמן ישראל": "https://www.zman.co.il", "דבר": "https://www.davar1.co.il",
    "כל הזמן": "https://www.kolhazman.co.il", "בחדרי חרדים": "https://www.bhol.co.il",
    "ערוץ 14": "https://www.now14.co.il", "שיחה מקומית": "https://www.mekomit.co.il",
    "972+": "https://www.972mag.com", "ערב 48": "https://www.arab48.com",
    "כלכליסט": "https://www.calcalist.co.il", "דה מרקר": "https://www.themarker.com",
}

EXTRA = {
    "דה מרקר": ["https://www.themarker.com/srv/rss---feedly",
                "https://www.themarker.com/cmlink/1.144",
                "https://www.themarker.com/srv/tm-all"],
    "N12": ["https://rcs.mako.co.il/rss/news-military.xml",
            "https://rcs.mako.co.il/rss/news-israel.xml",
            "https://www.mako.co.il/news/rss"],
    "וואלה": ["https://rss.walla.co.il/feed/1?type=main",
              "https://rss.walla.co.il/feed/22",
              "https://rss.walla.co.il/feed/2686"],
    "כלכליסט": ["https://www.calcalist.co.il/GeneralRSS/0,16335,L-3673,00.xml"],
    "שקוף": ["https://shakuf.co.il/feed"],
}


def newest(url: str) -> tuple[str, int, float | None]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=12)
    except Exception as err:
        return type(err).__name__, 0, None
    if r.status_code != 200:
        return str(r.status_code), 0, None
    entries = feedparser.parse(r.content).get("entries", [])
    if not entries:
        return "200 (no items)", 0, None
    ages = []
    for entry in entries:
        stamp = entry.get("published_parsed") or entry.get("updated_parsed")
        if stamp:
            ages.append((datetime.now(timezone.utc) - datetime(*stamp[:6], tzinfo=timezone.utc))
                        .total_seconds() / 3600)
    return "200", len(entries), min(ages) if ages else None


def advertised(page: str) -> list[str]:
    """The feeds a page names in its own head."""
    try:
        r = requests.get(page, headers=HEADERS, timeout=12)
        if r.status_code != 200:
            return []
    except Exception:
        return []
    found = re.findall(
        r'<link[^>]+type=["\']application/(?:rss|atom)\+xml["\'][^>]*href=["\']([^"\']+)["\']',
        r.text, re.I)
    found += re.findall(
        r'<link[^>]+href=["\']([^"\']+)["\'][^>]+type=["\']application/(?:rss|atom)\+xml["\']',
        r.text, re.I)
    out = []
    for href in found:
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            href = page.rstrip("/") + href
        if href not in out:
            out.append(href)
    return out[:6]


def main() -> None:
    wanted = set(HOMES)
    for site in sorted(db.all_sites(), key=lambda s: s["name"]):
        name = site["name"]
        if name not in wanted:
            continue
        domain = site.get("domain") or ""
        home = HOMES.get(name) or (f"https://{domain.split('/')[2]}" if domain.startswith("http") else "")
        print(f"\n{name}")
        candidates = EXTRA.get(name, [])
        if home:
            candidates = candidates + [u for u in advertised(home) if u not in candidates]
        if domain:
            candidates.append(domain)
        for url in candidates[:8]:
            status, count, age = newest(url)
            fresh = f"{age:.1f}h" if age is not None else "-"
            flag = "✅" if status == "200" and age is not None and age < 6 else "  "
            print(f"   {flag} {status:<14} {count:>3} items  newest {fresh:>8}  {url[:78]}")


if __name__ == "__main__":
    main()
