"""The two models the ingest worker uses, both called on OpenAI's API.

  embeddings  text-embedding-3-large, cut to 768 dimensions so every Vector(768)
              column stays as it is. Stories are grouped by these.
  topics      gpt-5.6-luna, answering in a JSON schema whose only allowed values
              are the topic names, so it cannot invent a topic or misspell one.

They replace two local models - paraphrase-multilingual-mpnet-base-v2 and a
zero-shot mDeBERTa - which needed torch, a 1.5GB image and 1.2GB of RAM on the
server. The zero-shot one only ever saw the topic's label; this one reads the
topic's description and the corrections a human made in dev mode.
"""
import json
import os
import time

import numpy as np
import requests

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-large")
TAG_MODEL = os.getenv("TAG_MODEL", "gpt-5.6-luna")
# a little reasoning measurably helps on the narrow topics and costs little at
# this length; "none" is the cheaper setting if it ever matters
TAG_EFFORT = os.getenv("TAG_EFFORT", "low")
EMBEDDING_DIM = 768

API = "https://api.openai.com/v1"
RETRIES = 5
EMBED_BATCH = 256
TAG_BATCH = 20

# what the model answers for an article that is about none of the topics - most news
OTHER = "אחר"


class OpenAIUnavailable(Exception):
    """OpenAI did not answer, or will not until something changes (key, credit)."""


def _post(path: str, body: dict, timeout: int = 120) -> dict:
    if not OPENAI_API_KEY:
        raise OpenAIUnavailable("OPENAI_API_KEY not set")
    for attempt in range(RETRIES):
        try:
            r = requests.post(f"{API}{path}", json=body, timeout=timeout,
                              headers={"Authorization": f"Bearer {OPENAI_API_KEY}"})
        except requests.RequestException as err:
            if attempt == RETRIES - 1:
                raise OpenAIUnavailable(str(err)) from err
            time.sleep(2 ** attempt)
            continue
        # an empty credit balance also comes back as 429, and no amount of waiting fixes it
        if r.status_code == 429 and "insufficient_quota" in r.text:
            raise OpenAIUnavailable("the OpenAI credit balance is used up")
        if r.status_code == 429 or r.status_code >= 500:
            if attempt == RETRIES - 1:
                raise OpenAIUnavailable(f"{r.status_code}: {r.text[:200]}")
            time.sleep(2 ** attempt * 2)
            continue
        if r.status_code >= 400:
            raise OpenAIUnavailable(f"{r.status_code}: {r.text[:300]}")
        return r.json()
    raise OpenAIUnavailable("no answer")


def embed(texts: list[str]) -> list[np.ndarray]:
    """Unit-length vectors, one per text, in the same order."""
    out: list[np.ndarray] = []
    for start in range(0, len(texts), EMBED_BATCH):
        # the API rejects an empty string
        chunk = [(t or " ")[:4000] for t in texts[start:start + EMBED_BATCH]]
        data = _post("/embeddings", {"model": EMBED_MODEL, "input": chunk,
                                     "dimensions": EMBEDDING_DIM})["data"]
        for item in sorted(data, key=lambda d: d["index"]):
            v = np.asarray(item["embedding"], dtype=np.float32)
            out.append(v / (np.linalg.norm(v) or 1.0))
    return out


def _instructions(topics: dict[str, str], sections: dict[str, str],
                  examples: list[tuple[str, str]]) -> str:
    lines = [
        "אתה מתייג כתבות מאתרי חדשות ישראליים בשני שדות.",
        "",
        "1. מדור - לכל כתבה בדיוק אחד, גם אם אין בה שום פוליטיקה:",
    ]
    lines += [f"   - {name}: {hint}" for name, hint in sections.items()]
    lines += [
        "",
        "2. סוגיה - רק אם הכתבה עוסקת באופן ישיר ומהותי באחת מהמחלוקות הציבוריות האלה:",
    ]
    lines += [f"   - {name}: {desc}" for name, desc in topics.items()]
    lines += [
        "",
        f"אם הכתבה אינה עוסקת באף אחת מהמחלוקות, בחר סוגיה \"{OTHER}\". "
        "זה המצב ברוב החדשות: פלילים, תאונות, מזג אוויר, ספורט, בריאות ורוב חדשות העולם.",
        "אזכור אגבי אינו מספיק - הסוגיה צריכה להיות מה שהכתבה עוסקת בו.",
    ]
    if examples:
        lines += ["", "תיקונים שעשה עורך אנושי. תייג כתבות דומות באותו אופן:"]
        lines += [f"- \"{header}\" -> {topic}" for header, topic in examples]
    return "\n".join(lines)


def classify(items: list[tuple[int, str]], topics: dict[str, str],
             sections: dict[str, str],
             examples: list[tuple[str, str]] | None = None) -> dict[int, dict]:
    """Section and issue per item id: {"section": name, "topic": name or None}.

    topics and sections each map a name to a line saying what belongs in it. The
    instructions come first and stay identical from call to call, so OpenAI serves
    them from its prompt cache at a tenth of the price.
    """
    instructions = _instructions(topics, sections, examples or [])
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["items"],
        "properties": {"items": {"type": "array", "items": {
            "type": "object",
            "additionalProperties": False,
            "required": ["id", "section", "topic"],
            "properties": {"id": {"type": "integer"},
                           "section": {"type": "string", "enum": list(sections)},
                           "topic": {"type": "string", "enum": list(topics) + [OTHER]}},
        }}},
    }
    out: dict[int, dict] = {}
    for start in range(0, len(items), TAG_BATCH):
        batch = items[start:start + TAG_BATCH]
        payload = json.dumps([{"id": i, "text": text[:600]} for i, text in batch],
                             ensure_ascii=False)
        reply = _post("/chat/completions", {
            "model": TAG_MODEL,
            "reasoning_effort": TAG_EFFORT,
            "messages": [{"role": "developer", "content": instructions},
                         {"role": "user", "content": payload}],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": "tags", "strict": True, "schema": schema}},
        })
        content = reply["choices"][0]["message"].get("content") or "{}"
        wanted = {i for i, _ in batch}
        for row in json.loads(content).get("items", []):
            if row.get("id") in wanted:
                topic = row.get("topic")
                out[row["id"]] = {"section": row.get("section"),
                                  "topic": None if topic == OTHER else topic}
    return out


def translate(header: str, subheader: str) -> tuple[str, str] | None:
    """One Arabic item in Hebrew, or None if it could not be translated.

    This used to go to Gemini's free tier, which rate-limited a cycle into a
    fifteen-minute wait over a handful of headlines. Here it is a fraction of a
    cent an item and never blocks the scrape.
    """
    schema = {"type": "object", "additionalProperties": False,
              "required": ["header", "subheader"],
              "properties": {"header": {"type": "string"},
                             "subheader": {"type": "string"}}}
    try:
        reply = _post("/chat/completions", {
            "model": TAG_MODEL,
            "reasoning_effort": "none",
            "messages": [
                {"role": "developer", "content":
                 "תרגם לעברית כותרת ותקציר מאתר חדשות בערבית. שמור על סגנון עיתונאי, "
                 "אל תוסיף פרשנות ואל תשמיט פרטים."},
                {"role": "user", "content": f"כותרת: {header[:400]}\n\nתקציר: {subheader[:900]}"},
            ],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": "translation", "strict": True, "schema": schema}},
        }, timeout=60)
    except OpenAIUnavailable as err:
        print(f"  ! translation failed: {err}")
        return None
    content = reply["choices"][0]["message"].get("content") or "{}"
    out = json.loads(content)
    head = (out.get("header") or "").strip()
    return (head, (out.get("subheader") or "").strip()) if head else None


def summarise(text_prompt: str) -> str | None:
    """One line over a story's headlines. Plain text, no schema to get in the way."""
    reply = _post("/chat/completions", {
        "model": TAG_MODEL,
        "reasoning_effort": "none",
        "max_completion_tokens": 300,
        "messages": [{"role": "user", "content": text_prompt}],
    }, timeout=90)
    return (reply["choices"][0]["message"].get("content") or "").strip() or None
