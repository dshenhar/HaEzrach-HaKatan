"""The AI summaries the app shows over a story: one for each bloc that covered it,
and one across all of them for the citizen view.

Gemini writes them, Claude only if a Claude key is set and Gemini is out of quota.
They are written during the ingest, before any reader asks, and rewritten only when
another outlet joins the story - the summary of a given set of headlines does not
change.
"""
import os
import time
from datetime import timedelta

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-3.6-flash"
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-sonnet-5"

# who wrote the headlines being summarised, as the prompt puts it
SIDES = {
    "right": "מהצד הימני של המפה הפוליטית",
    "left": "מהצד השמאלי של המפה הפוליטית",
    # the citizen view: every outlet that covered the story, no blocs
    "all": "מכל צדי המפה הפוליטית",
}
BLOCS = tuple(SIDES)

SUMMARY_WINDOW = timedelta(hours=26)     # a little over the feed's day
SUMMARY_MAX_PER_CYCLE = 90
SUMMARY_MIN_GAP = 1.0


class QuotaExhausted(Exception):
    """The AI provider refuses more requests for now; the rest wait for the next cycle."""


def _summary_via_gemini(text_prompt: str) -> str | None:
    import requests
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": GEMINI_API_KEY, "content-type": "application/json"},
        json={"contents": [{"parts": [{"text": text_prompt}]}],
              "generationConfig": {"maxOutputTokens": 300, "temperature": 0.3,
                                   "thinkingConfig": {"thinkingBudget": 0}}},
        timeout=60,
    )
    if r.status_code == 429:
        raise QuotaExhausted("gemini")
    r.raise_for_status()
    parts = r.json()["candidates"][0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip() or None


def _summary_via_claude(text_prompt: str) -> str | None:
    import requests
    r = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": CLAUDE_API_KEY, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        json={"model": CLAUDE_MODEL, "max_tokens": 300,
              "messages": [{"role": "user", "content": text_prompt}]},
        timeout=60,
    )
    if r.status_code in (429, 529):
        raise QuotaExhausted("claude")
    r.raise_for_status()
    return "".join(b.get("text", "") for b in r.json().get("content", [])).strip() or None


def _summary_via_openai(text_prompt: str) -> str | None:
    # worker-side only: the api image carries no OpenAI key and falls back to Gemini
    from gpt_models import summarise as openai_summarise
    return openai_summarise(text_prompt)


def summarise(text_prompt: str) -> str | None:
    """OpenAI first: at about a fifth of a cent a story it covers every one of them,
    where Gemini's free tier ran out after twenty a day and left most stories bare.
    Gemini and Claude stay as fallbacks."""
    providers = [_summary_via_openai] if os.getenv("OPENAI_API_KEY") else []
    providers += [fn for key, fn in ((GEMINI_API_KEY, _summary_via_gemini),
                                     (CLAUDE_API_KEY, _summary_via_claude)) if key]
    refused = 0
    for fn in providers:
        try:
            text = fn(text_prompt)
            if text:
                return text
        except QuotaExhausted:
            refused += 1
        except Exception as err:
            print(f"  ! summary failed: {err}")
    if providers and refused == len(providers):
        raise QuotaExhausted("every provider")
    return None




def articles_for(rows: list[dict], blocs: dict[str, str], bloc: str) -> list[tuple[str, str]]:
    """The (headline, standfirst) pairs one summary is written from."""
    return [
        (a["header"], a.get("subheader") or "") for a in rows
        if bloc == "all" or blocs.get(a["site_id"]) == bloc
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
