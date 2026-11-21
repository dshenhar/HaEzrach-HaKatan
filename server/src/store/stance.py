"""Where a headline falls: on its outlet's side, moved by what the headline says.

The outlets are the base. Every outlet has a place on each issue, an editorial
estimate written in advance from its public identity - ownership, founding purpose,
declared line (db/initial_ranks.json) - and its bloc is the side those places
average to (positions.py). A headline on one of the issues starts on its outlet's
side, OUTLET_BASE out on the issue's axis of -5..5: +3 for a right-wing outlet, -3
for a left-wing one.

Then it is read on its own. The tagging pass gives every headline on an issue a
lean, -5..5, from its headline and standfirst alone - never the article itself -
for what the text says: 0 for a report of an event, however well the event suits
one side; 1 to 3 for framing; 4 or 5 only where the headline itself argues one
side's position. The lean is added to the base. A headline that says what its
outlet's side says goes further out; one that leans the other way comes in; and
only one that plainly argues the other side's position - a lean of 4 or 5 against
its outlet - crosses over. A headline that comes to exactly 0 stays with its
outlet: there is no middle.

Readers: at the end of an article a reader says where it fell, -5..5 on the same
axis. The reading above stands until MIN_VOTERS readers have answered; from then
the score is their mean with the reading counted as MODEL_WEIGHT readers of its
own. Enough readers can move a headline to the other side, a few cannot. Readers
move headlines, not outlets.

An outlet's place is its estimate, and its headlines do not move it. For five weeks
from October 2026 they did - each headline placed by the model alone, its side
counted on its outlet - and the places drifted wherever the model misread: reports
of strikes read as support for the war put nearly every outlet to the right of it.
Those counters are still on the topic states, and nothing reads them.
"""
from __future__ import annotations

SCALE = 5.0
# where a headline starts, out from the middle on its outlet's side
OUTLET_BASE = 3.0

# the readers
MODEL_WEIGHT = 5.0      # the reading counts as this many readers
MIN_VOTERS = 3          # fewer readers than this leave the reading alone

_SIGN = {"right": 1.0, "left": -1.0}


def reading(lean: float | None, bloc: str | None) -> float | None:
    """A headline's place before any reader: its outlet's side, moved by its own
    lean. None for a headline with neither - an outlet in no bloc, and no lean."""
    base = OUTLET_BASE * _SIGN.get(bloc or "", 0.0)
    if lean is None and not base:
        return None
    return max(-SCALE, min(SCALE, base + float(lean or 0)))


def score(lean: float | None, feel: dict | None, bloc: str | None) -> float | None:
    """A headline's place on its issue's axis: the reading, and the readers' once
    there are enough of them. None when there is neither."""
    model = reading(lean, bloc)
    feel = feel or {}
    n = int(feel.get("n", 0))
    total = float(feel.get("s", 0.0))
    if model is None:
        return round(total / n, 2) if n >= MIN_VOTERS else None
    if n < MIN_VOTERS:
        return model
    return round((MODEL_WEIGHT * model + total) / (MODEL_WEIGHT + n), 2)


def side(value: float | None) -> str | None:
    """right or left - or None for nothing placed, or placed at zero."""
    if value is None or value == 0:
        return None
    return "right" if value > 0 else "left"


def placed(article: dict, blocs: dict[str, str]) -> str | None:
    """The side a headline on one of the issues is shown on: its own score's, and
    its outlet's when that comes to zero. Right or left, never in between."""
    bloc = blocs.get(str(article.get("site_id")))
    own = side(score(article.get("lean"), article.get("feel"), bloc))
    if own is not None:
        return own
    return bloc if bloc in ("right", "left") else None


def outlet_position(entry: dict | None) -> float:
    """Where an outlet stands on an issue: its estimate."""
    return round(float((entry or {}).get("prior", 0.0)), 3)
