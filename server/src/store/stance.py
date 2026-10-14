"""Where a headline falls, and where an outlet stands because of its headlines.

An outlet used to be placed by hand - a benchmark per issue - and its bloc read off
the average. Now every article that is about one of the issues is placed on that
issue's own axis, from its headline and standfirst alone:

    the model   the tagging pass reads each one and gives it a stance, -5..5, where
                +5 is the right's pole of the issue and -5 the left's, and 0 a plain
                report that leans to neither
    readers     at the end of an article a reader says how right or left it felt,
                -5..5 on the same axis

The model's reading is the article's score until MIN_VOTERS readers have said
otherwise; from then the score is their mean with the model counted as
MODEL_WEIGHT readers of its own. Enough readers can move a headline to the other
side, a few cannot. These three numbers are the first guess, to be tuned once
there are votes to tune them against.

The side follows from the score, with a narrow band around zero for the headlines
that lean to neither.

An outlet's place on an issue is where its headlines on it fell: when an article
leaves the database, a day after it came, its final side is counted on the outlet's
entry for its issue - right, left or neither - in counters that halve every
HALF_LIFE, so the place follows what the outlet publishes now. The share of right
less the share of left, on the -5..5 scale, is the measured place. Until an outlet
has enough headlines on an issue the old benchmark carries it, fading as they come:
it is worth PRIOR_WEIGHT headlines.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

SCALE = 5.0

# an article's score
MODEL_WEIGHT = 5.0      # the model counts as this many readers
MIN_VOTERS = 3          # fewer readers than this leave the model's reading alone
NEUTRAL = 0.5           # a score within this of zero leans to neither side

# an outlet's place
HALF_LIFE = timedelta(days=90)
PRIOR_WEIGHT = 10.0     # the benchmark is worth this many headlines

COUNTER = {"right": "r", "left": "l", "neutral": "c"}


def score(stance: float | None, feel: dict | None) -> float | None:
    """An article's place on its issue's axis: the model's reading, and the readers'
    once there are enough of them. None when there is neither."""
    feel = feel or {}
    n = int(feel.get("n", 0))
    total = float(feel.get("s", 0.0))
    if stance is None:
        return round(total / n, 2) if n >= MIN_VOTERS else None
    if n < MIN_VOTERS:
        return float(stance)
    return round((MODEL_WEIGHT * float(stance) + total) / (MODEL_WEIGHT + n), 2)


def side(value: float | None) -> str | None:
    """right, left or neutral - or None for an article nothing has placed."""
    if value is None:
        return None
    if value > NEUTRAL:
        return "right"
    if value < -NEUTRAL:
        return "left"
    return "neutral"


def article_side(article: dict) -> str | None:
    return side(score(article.get("stance"), article.get("feel")))


def placed(article: dict, blocs: dict[str, str]) -> str | None:
    """The side an article is shown on: its own, or - for one nothing has placed
    yet, tagged before articles were read for their stance - its outlet's."""
    own = article_side(article)
    if own is not None:
        return own
    bloc = blocs.get(str(article.get("site_id")))
    return bloc if bloc in ("right", "left") else None


def _aware(at: datetime | None) -> datetime | None:
    if at is not None and at.tzinfo is None:
        return at.replace(tzinfo=timezone.utc)
    return at


def _decayed(entry: dict, now: datetime) -> tuple[float, float, float]:
    """An outlet's counters on an issue as they stand now."""
    r, l, c = (float(entry.get(k, 0.0)) for k in ("r", "l", "c"))
    counted = _aware(entry.get("counted"))
    if counted is None:
        return r, l, c
    age = (now - counted).total_seconds()
    factor = 0.5 ** (age / HALF_LIFE.total_seconds()) if age > 0 else 1.0
    return r * factor, l * factor, c * factor


def fold(entry: dict, add: dict[str, int], now: datetime | None = None) -> dict:
    """The counters with a pass's headlines added - the fields to merge into the entry."""
    now = now or datetime.now(timezone.utc)
    r, l, c = _decayed(entry, now)
    return {"r": round(r + add.get("r", 0), 4), "l": round(l + add.get("l", 0), 4),
            "c": round(c + add.get("c", 0), 4), "counted": now}


def headlines(entry: dict, now: datetime | None = None) -> float:
    """How many headlines, faded, an outlet's place on an issue stands on."""
    return sum(_decayed(entry or {}, now or datetime.now(timezone.utc)))


def outlet_position(entry: dict | None, now: datetime | None = None) -> float:
    """Where an outlet stands on an issue: its headlines, with the benchmark for the
    ones it does not have yet."""
    entry = entry or {}
    prior = float(entry.get("prior", 0.0))
    r, l, c = _decayed(entry, now or datetime.now(timezone.utc))
    n = r + l + c
    if n <= 0:
        return round(prior, 3)
    measured = SCALE * (r - l) / n
    return round((PRIOR_WEIGHT * prior + n * measured) / (PRIOR_WEIGHT + n), 3)


def confidence(entry: dict | None, now: datetime | None = None) -> float:
    """0..1: how much of the place is measured rather than estimated."""
    n = headlines(entry or {}, now)
    return round(n / (n + PRIOR_WEIGHT), 2)
