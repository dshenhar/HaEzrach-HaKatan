"""Replace the issue list with the one in store/taxonomy.py, benchmark and all.

    python seed_topics.py [--dry-run]

The old list was 22 issues drawn from an editorial map: seven variations on the
territorial dispute, eight issues that never appeared in a fortnight of news, and
nothing at all for the war, which is most of what Israel publishes. The new list
came out of a pass over our own headlines.

Each new issue inherits its benchmark from the old issues it replaces, so the map
is not blank on the first morning. An issue with no ancestor - the war, Iran, the
political coverage - starts from the outlet's own average, at low confidence, which
is the setting that lets readers and the measured benchmark move it most.

Whatever dev mode taught keeps its place wherever the issue it named still exists.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from store import db
from store.learning import PRIOR_WEIGHT, State
from store.taxonomy import GENERAL_TOPIC, PRIOR_FROM, TOPICS

GENERAL_ID = "general"
# an outlet's overall lean is a fair opening guess for an issue we cannot map,
# pulled slightly toward the centre because it is a guess
UNMAPPED_SHRINK = 0.8


def main(dry_run: bool) -> None:
    old_topics = {t["id"]: t for t in db.all_topics()}
    old_states = db.all_topic_states()
    by_name = {t["name"]: t["id"] for t in old_topics.values()}

    # every outlet's benchmark on every old issue, and its average across them
    priors: dict[str, dict[str, float]] = {}       # site -> old topic name -> prior
    learned: dict[str, dict[str, dict]] = {}       # site -> old topic name -> state doc
    for topic_id, state in old_states.items():
        name = (old_topics.get(topic_id) or {}).get("name")
        if not name:
            continue
        for site_id, entry in (state.get("sites") or {}).items():
            priors.setdefault(site_id, {})[name] = float(entry.get("prior", 0.0))
            learned.setdefault(site_id, {})[name] = entry
    overall = {site: sum(v.values()) / len(v) for site, v in priors.items() if v}
    print(f"{len(old_topics)} issues today, {len(priors)} outlets with a benchmark")

    new_states: dict[str, dict] = {}
    for topic_id, (name, description, right, left) in TOPICS.items():
        ancestors, confidence = PRIOR_FROM.get(topic_id, ([], "low"))
        strength, move = PRIOR_WEIGHT[confidence]
        sites: dict[str, dict] = {}
        for site_id, site_priors in priors.items():
            values = [site_priors[a] for a in ancestors if a in site_priors]
            if values:
                prior = sum(values) / len(values)
            else:
                prior = overall.get(site_id, 0.0) * UNMAPPED_SHRINK
            # carry what the readers taught on the issue this one grew out of
            carried = next((learned[site_id][a] for a in ancestors
                            if a in learned.get(site_id, {})), {})
            state = State.from_doc(carried)
            entry = state.to_doc() | {"prior": round(prior, 3), "strength": strength,
                                      "move": move, "articles": 0, "rated": 0}
            sites[site_id] = entry
        new_states[topic_id] = sites
        source = f"from {', '.join(ancestors)}" if ancestors else "from the outlet's average"
        print(f"  {name:<32} {confidence:<5} {source}")

    if dry_run:
        print("\\ndry run - nothing written")
        return

    writer = db.Writer()
    for topic_id, (name, description, right, left) in TOPICS.items():
        confidence = PRIOR_FROM.get(topic_id, ([], "low"))[1]
        writer.set(db.client().collection("topics").document(topic_id),
                   {"name": name, "description": description, "pole_right": right,
                    "pole_left": left, "confidence": confidence})
        writer.set(db.topic_state_ref(topic_id), {"sites": new_states[topic_id]})
    writer.set(db.client().collection("topics").document(GENERAL_ID),
               {"name": GENERAL_TOPIC, "description": "כתבה שאינה עוסקת באף אחת מהסוגיות"})

    keep = set(TOPICS) | {GENERAL_ID}
    for topic_id in old_topics:
        if topic_id not in keep:
            writer.delete(db.client().collection("topics").document(topic_id))
    for topic_id in old_states:
        if topic_id not in keep:
            writer.delete(db.topic_state_ref(topic_id))
    writer.flush()

    # a dev-mode fix points at an issue by id; keep the ones whose issue survived
    kept = dropped = 0
    names = {name: topic_id for topic_id, (name, *_rest) in TOPICS.items()}
    for correction in db.all_corrections():
        ref = db.client().collection("corrections").document(correction["id"])
        if correction.get("topic") in names:
            ref.set({"topic_id": names[correction["topic"]]}, merge=True)
            kept += 1
        else:
            ref.delete()
            dropped += 1
    print(f"\\n{len(TOPICS)} issues written, {len(old_topics) - len(keep & set(old_topics))} removed")
    print(f"corrections: {kept} kept, {dropped} dropped with the issue they named")
    print("now run:  ingest.py --retag")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    main(parser.parse_args().dry_run)
