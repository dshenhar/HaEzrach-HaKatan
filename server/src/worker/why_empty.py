"""Why a feed that answers still puts nothing in the database.

    python why_empty.py

Fetches a few outlets, runs each entry through the same parse the ingest uses,
and prints what happened to it: kept, too old, or already known.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraping import fetch_entries, parse_entry
from store import db

WATCH = ["N12", "וואלה", "דה מרקר", "הארץ", "מידה", "חיפה נט"]


def main() -> None:
    sites = {s["name"]: s for s in db.all_sites()}
    seen = db.seen()
    links, headers = set(seen.get("links", [])), set(seen.get("headers", []))
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now - timedelta(hours=24)
    print(f"now (utc naive): {now:%Y-%m-%d %H:%M}, cutoff: {cutoff:%Y-%m-%d %H:%M}")
    print(f"seen list: {len(links)} links, {len(headers)} headlines\n")

    for name in WATCH:
        site = sites.get(name)
        if not site:
            continue
        entries = fetch_entries(name, site.get("domain"))
        print(f"{name}: {len(entries)} entries")
        kept = old = known = unparsed = 0
        for entry in entries:
            parsed = parse_entry(entry, name)
            if not parsed:
                unparsed += 1
                continue
            if parsed["link"] in links or parsed["header"] in headers:
                known += 1
                continue
            if parsed["created_at"] < cutoff:
                old += 1
                continue
            kept += 1
        print(f"   kept {kept} | too old {old} | already known {known} | unparsable {unparsed}")
        for entry in entries[:3]:
            parsed = parse_entry(entry, name)
            if parsed:
                age = (now - parsed["created_at"]).total_seconds() / 3600
                print(f"   {parsed['created_at']:%m-%d %H:%M} ({age:>6.1f}h ago)  {parsed['header'][:46]}")
        print()


if __name__ == "__main__":
    main()
