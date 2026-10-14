"""Where every outlet stands, read off the topic states.

The map asks for one topic, the analytics page and the bloc view ask for the
outlet overall. Both are the same numbers: each outlet's entry on a topic's state
holds the counters of where its headlines fell and the benchmark for until there
are enough of them (stance.py), and this turns them into positions.
"""
from __future__ import annotations

from store.stance import outlet_position

# General news is a place to put a story, not an issue: no outlet has a position on
# it, and averaging its zeros in pulled every outlet towards the centre.
GENERAL_ID = "general"


def bloc_of(bias: float | None) -> str:
    """Leaning even slightly one way puts an outlet in that bloc: there is no
    comfortable centre to sit the argument out in. Only an outlet with no lean at
    all - nothing measured and no benchmark - is in neither."""
    if bias is None or bias == 0:
        return "unknown"
    return "right" if bias > 0 else "left"


def positions_for_topic(state_doc: dict) -> dict[str, float]:
    """site id -> its position on this topic."""
    return {site_id: outlet_position(entry)
            for site_id, entry in (state_doc.get("sites") or {}).items()}


def overall(states: dict[str, dict]) -> dict[str, dict]:
    """site id -> its position across every topic it is scored on, and its bloc.

    Averaging the topics equally is deliberate: an outlet is not more right-wing
    because it publishes more about the settlements than about welfare.
    """
    scores: dict[str, list[float]] = {}
    for topic_id, state_doc in states.items():
        if topic_id == GENERAL_ID:
            continue
        for site_id, value in positions_for_topic(state_doc).items():
            scores.setdefault(site_id, []).append(value)
    out = {}
    for site_id, values in scores.items():
        bias = sum(values) / len(values)
        out[site_id] = {"bias": round(bias, 3), "bloc": bloc_of(bias),
                        "topics_scored": len(values)}
    return out
