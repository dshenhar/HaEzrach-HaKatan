"""Where an outlet stands on a topic, learned as the ratings come in.

The old answer averaged every rating ever cast, every time anyone opened the map.
This one keeps five numbers per outlet and topic and updates them in place, so
nothing is recomputed and no history has to be kept:

    prior, strength    the benchmark and how much evidence stands behind it
    w, s               the readers: a decayed sum of weights, and of weighted ratings
    raters             how many distinct people have rated this outlet on this topic

Two things guard the result, because a map that can be voted into nonsense says
nothing. First, ratings fade: w and s halve every HALF_LIFE, so the position follows
what an outlet publishes now rather than what it published in the spring, and a
burst of ratings loses its grip over the weeks. Second, the readers may only move an
outlet so far from its benchmark - how far depends on how many of them there are,
and on how well founded the benchmark is.

Worked through on an outlet whose benchmark on a topic is -4 and well founded:

    20 people rate it +5  ->  -2.9        100 people rate it +5  ->  -2.0

Where that same cell is a placeholder, 100 readers take it all the way to 0 - the
guard is strongest exactly where we know most, and absent where we know nothing.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone

# What a benchmark cell is worth, by how well it is founded: how many ratings it
# stands against, and how far the readers may pull the outlet away from it. A cell
# measured from the outlet's own articles outranks one reasoned from its identity,
# and a placeholder cell defends nothing - the readers may overwrite it entirely.
#                   strength  furthest move
PRIOR_WEIGHT = {"high": (12.0, 2.5),
                "med":  (8.0, 3.5),
                "low":  (5.0, 5.0)}
DEFAULT_STRENGTH, DEFAULT_MOVE = PRIOR_WEIGHT["med"]

HALF_LIFE = timedelta(days=30)
# the weight at which the readers have half the room they can ever have
MOVE_HALF = 25.0
# under this many distinct people, the benchmark stands on its own
MIN_RATERS = 5

# One person rating twenty articles of the same outlet in a day is not twenty
# people: their first few ratings count fully and the rest are worth a third.
RATER_FULL = 3
RATER_TAIL = 1 / 3

SCALE = 5.0     # ratings and positions both run -5..5


@dataclass(frozen=True)
class State:
    prior: float = 0.0
    strength: float = DEFAULT_STRENGTH
    move: float = DEFAULT_MOVE
    w: float = 0.0
    s: float = 0.0
    raters: int = 0
    updated: datetime | None = None

    @classmethod
    def from_doc(cls, doc: dict | None) -> "State":
        doc = doc or {}
        return cls(
            prior=float(doc.get("prior", 0.0)),
            strength=float(doc.get("strength", DEFAULT_STRENGTH)),
            move=float(doc.get("move", DEFAULT_MOVE)),
            w=float(doc.get("w", 0.0)),
            s=float(doc.get("s", 0.0)),
            raters=int(doc.get("raters", 0)),
            updated=doc.get("updated"),
        )

    def to_doc(self) -> dict:
        return {"prior": self.prior, "strength": self.strength, "move": self.move,
                "w": self.w, "s": self.s, "raters": self.raters, "updated": self.updated}


def _decayed(state: State, now: datetime) -> tuple[float, float]:
    """w and s as they stand now, the older ratings worth less."""
    if not state.updated or not state.w:
        return state.w, state.s
    updated = state.updated
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    age = (now - updated).total_seconds()
    if age <= 0:
        return state.w, state.s
    factor = math.pow(0.5, age / HALF_LIFE.total_seconds())
    return state.w * factor, state.s * factor


def room(state: State, w: float) -> float:
    """How far the readers may move this outlet: their weight against the benchmark's."""
    return state.move * w / (w + MOVE_HALF)


def position(state: State, now: datetime | None = None) -> float:
    """The outlet's position on this topic: the benchmark, as far as the readers have earned."""
    now = now or datetime.now(timezone.utc)
    w, s = _decayed(state, now)
    if state.raters < MIN_RATERS or w <= 0:
        return round(state.prior, 3)
    blended = (state.strength * state.prior + s) / (state.strength + w)
    limit = room(state, w)
    moved = max(-limit, min(limit, blended - state.prior))
    return round(max(-SCALE, min(SCALE, state.prior + moved)), 3)


def rater_weight(ratings_today_for_outlet: int) -> float:
    """What one more rating from the same person about the same outlet is worth today."""
    return 1.0 if ratings_today_for_outlet < RATER_FULL else RATER_TAIL


def apply_rating(state: State, value: float, weight: float = 1.0,
                 first_time_rater: bool = True, now: datetime | None = None) -> State:
    """Fold one rating into the state. value is -5..5, the topic's own axis."""
    now = now or datetime.now(timezone.utc)
    w, s = _decayed(state, now)
    value = max(-SCALE, min(SCALE, float(value)))
    return replace(
        state,
        w=w + weight,
        s=s + weight * value,
        raters=state.raters + (1 if first_time_rater else 0),
        updated=now,
    )


def revise_rating(state: State, old_value: float, new_value: float, weight: float = 1.0,
                  now: datetime | None = None) -> State:
    """Someone changed their mind: swap their rating without counting them twice."""
    now = now or datetime.now(timezone.utc)
    w, s = _decayed(state, now)
    old_value = max(-SCALE, min(SCALE, float(old_value)))
    new_value = max(-SCALE, min(SCALE, float(new_value)))
    return replace(state, w=w, s=s + weight * (new_value - old_value), updated=now)


def set_prior(state: State, prior: float, confidence: str = "med") -> State:
    """A new benchmark. What the readers taught is kept - it is about this outlet either way."""
    strength, move = PRIOR_WEIGHT.get(confidence, PRIOR_WEIGHT["med"])
    return replace(state, prior=max(-SCALE, min(SCALE, float(prior))),
                   strength=strength, move=move)
