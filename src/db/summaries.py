"""The AI summaries the app shows over a story: one for each bloc that covered it,
and one across all of them for the citizen view.

Shared by the api, which writes a summary on demand when a reader opens a story
that has none yet, and the ingest worker, which writes them ahead of time so that
rarely happens. Both go through the same prompt and the same idea of which bloc an
outlet belongs to.
"""
from sqlalchemy import select

from db.models import SiteTopicPriorBias

# the api's breaking point: no neutral band, an outlet is right or left
BREAKING_POINT = 0.0

# who wrote the headlines being summarised, as the prompt puts it
SIDES = {
    "right": "מהצד הימני של המפה הפוליטית",
    "left": "מהצד השמאלי של המפה הפוליטית",
    # the citizen view: every outlet that covered the story, no blocs
    "all": "מכל צדי המפה הפוליטית",
}
BLOCS = tuple(SIDES)


def bloc_of(bias: float | None) -> str:
    if bias is None:
        return "unknown"
    return "right" if bias >= BREAKING_POINT else "left"


def site_blocs(session, site_ids) -> dict[int, str]:
    """Each outlet's bloc, from the mean of its per-topic benchmark positions."""
    priors: dict[int, list[float]] = {}
    for row in session.execute(
        select(SiteTopicPriorBias).where(SiteTopicPriorBias.site_id.in_(site_ids))
    ).scalars():
        priors.setdefault(row.site_id, []).append(row.prior_bias)
    return {
        site_id: bloc_of(sum(priors[site_id]) / len(priors[site_id]) if priors.get(site_id) else None)
        for site_id in site_ids
    }


def articles_for(rows, blocs: dict[int, str], bloc: str) -> list[tuple[str, str]]:
    """The (headline, standfirst) pairs one summary is written from."""
    return [
        (r.header, r.subheader or "") for r in rows
        if bloc == "all" or blocs.get(r.site_id) == bloc
    ]


def prompt(articles: list[tuple[str, str]], bloc: str) -> str:
    listed = "\n\n".join(
        f"כותרת: {h}" + (f"\nתקציר: {sub}" if sub else "") for h, sub in articles
    )
    return (
        f"להלן כותרות ותקצירים שפרסמו גופי תקשורת {SIDES[bloc]} "
        f"בישראל על אותו אירוע:\n\n{listed}\n\n"
        "כתוב שורה אחת בעברית שמאחדת את מה שנאמר בהן - מיזוג מינימליסטי, "
        "כמו כותרת אחת מסכמת. עד 25 מילים, בלשון עיתונאית ישירה.\n"
        "אל תתאר את הכותרות ואל תתייחס אליהן כאובייקט: בלי \"הכותרות\", "
        "\"הדיווחים\", \"גופי התקשורת\", \"מדגישים\", \"מבליטים\", \"משמיטים\", "
        "\"פותחות ב\". כתוב את החדשות עצמן.\n"
        "אל תוסיף פרשנות, שיפוט או עובדות שלא מופיעות בטקסט. החזר רק את השורה."
    )
