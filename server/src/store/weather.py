"""The weather the feed's header shows beside the logo: Jerusalem's, this hour.

From the Norwegian Meteorological Institute's forecast (api.met.no, free, under
CC BY 4.0), asked by this server and never by a reader: everyone gets the one
copy, kept until the time MET Norway says its answer expires - which is what its
terms ask, along with a User-Agent that says who is asking. A failed call keeps
the copy there is for a while longer and tries again a few minutes later.

The symbol is MET Norway's ("clearsky_night", "rainshowers_day", "cloudy"); the app
turns it into a picture, and decides day and night by the sun itself.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx

CITY = "ירושלים"
# no more than four decimals, as MET Norway asks, so its caches can serve them
LAT, LON = 31.7683, 35.2137
URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
UA = "HaEzrachHaKatanBot/1.0 (+https://haezrach-hakatan.web.app; haezrachh@gmail.com)"

KEEP_MIN = 10 * 60          # never ask more often than this
KEEP_MAX = 60 * 60          # nor keep an answer longer
RETRY = 3 * 60              # after a failure
STALE = 3 * 60 * 60         # an old answer is still shown for this long

_lock = threading.Lock()
_kept: dict = {"value": None, "fetched": 0.0, "until": 0.0}


def _when(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def _read(body: dict, now: datetime) -> dict | None:
    """The hour we are in: the last forecast step that has begun."""
    series = (body.get("properties") or {}).get("timeseries") or []
    step = None
    for entry in series:
        if _when(entry["time"]) > now:
            break
        step = entry
    step = step or (series[0] if series else None)
    if not step:
        return None
    data = step.get("data") or {}
    temp = ((data.get("instant") or {}).get("details") or {}).get("air_temperature")
    summary = (data.get("next_1_hours") or data.get("next_6_hours") or {}).get("summary") or {}
    if temp is None:
        return None
    return {"city": CITY, "temp": round(float(temp), 1), "symbol": summary.get("symbol_code"),
            "at": step["time"]}


def _keep_for(expires: str | None) -> float:
    try:
        left = parsedate_to_datetime(expires).timestamp() - time.time() if expires else 0
    except (TypeError, ValueError):
        left = 0
    return min(max(left, KEEP_MIN), KEEP_MAX)


def current() -> dict | None:
    """Jerusalem's weather now, or None when there has been none for hours."""
    with _lock:
        now = time.time()
        if now < _kept["until"]:
            return _kept["value"]
        try:
            answer = httpx.get(URL, params={"lat": LAT, "lon": LON},
                               headers={"User-Agent": UA}, timeout=8)
            answer.raise_for_status()
            value = _read(answer.json(), datetime.now(timezone.utc))
            if value is None:
                raise ValueError("no forecast step")
            _kept.update(value=value, fetched=now, until=now + _keep_for(answer.headers.get("expires")))
        except Exception as err:  # noqa: BLE001 - the header goes on without the weather
            print(f"weather: {err!r}"[:300], flush=True)
            _kept["until"] = now + RETRY
            if now - _kept["fetched"] > STALE:
                _kept["value"] = None
        return _kept["value"]
