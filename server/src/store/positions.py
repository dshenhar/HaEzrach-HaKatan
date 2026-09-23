"""Where every outlet stands, read off the topic states.

The map asks for one topic, the analytics page and the bloc view ask for the
outlet overall. Both are the same numbers: learning.py holds the state per outlet
and topic, this turns it into positions.
"""
from __future__ import annotations

from store.learning import State, position

# Zero on purpose: leaning even slightly one way puts an outlet in that bloc.
# There is no neutral band - the app's claim is that the blocs are a construction,
# and a comfortable "centre" bucket would let outlets sit out the argument.
BREAKING_POINT = 0.0


def bloc_of(bias: float | None) -> str:
    if bias is None:
        return "unknown"
    return "right" if bias >= BREAKING_POINT else "left"


def positions_for_topic(state_doc: dict) -> dict[str, float]:
    """site id -> its position on this topic."""
    return {site_id: position(State.from_doc(entry))
            for site_id, entry in (state_doc.get("sites") or {}).items()}


def overall(states: dict[str, dict]) -> dict[str, dict]:
    """site id -> its position across every topic it is scored on, and its bloc.

    Averaging the topics equally is deliberate: an outlet is not more right-wing
    because it publishes more about the settlements than about welfare.
    """
    scores: dict[str, list[float]] = {}
    for state_doc in states.values():
        for site_id, value in positions_for_topic(state_doc).items():
            scores.setdefault(site_id, []).append(value)
    out = {}
    for site_id, values in scores.items():
        bias = sum(values) / len(values)
        out[site_id] = {"bias": round(bias, 3), "bloc": bloc_of(bias),
                        "topics_scored": len(values)}
    return out
