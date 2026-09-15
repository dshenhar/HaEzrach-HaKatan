# Running the 360News server locally

## One-time: install Docker Desktop

Download from https://www.docker.com/products/docker-desktop/ (choose the
**Apple Silicon** build), drag it to Applications, open it, and wait until the
whale icon in the menu bar stops animating.

## Start the server

```bash
cd ~/360news-server/src
docker compose up --build
```

First run takes a few minutes (it downloads the Postgres image and builds the
API image). It is ready when you see `Uvicorn running on http://0.0.0.0:8000`.

## One-time: create the schema and seed data

With the server still running, in a **second terminal window** (the `cd` matters
- every `docker compose` command must run from the folder holding
`docker-compose.yml`, otherwise you get `no configuration file provided`):

```bash
cd ~/360news-server/src
docker compose exec api python /db/local_init.py
```

This creates the tables, enables pgvector, and seeds 11 sites and 22 topics.
It is safe to run again.

## Check it works

```bash
curl http://localhost:8000/health
curl http://localhost:8000/topics
```

## Everyday use

| command | what it does |
|---|---|
| `docker compose up` | start (no rebuild) |
| `docker compose up -d` | start in the background |
| `docker compose down` | stop |
| `docker compose logs -f api` | watch API logs |
| `docker compose down -v` | stop **and wipe the database** |

---

## What was changed from the original zip

`src/docker-compose.yml` (original kept as `docker-compose.yml.orig`):

1. `api` was only `expose`d on 8000, reachable through ngrok. Now published as
   `ports: "8000:8000"` so the app can reach it at `localhost:8000`.
2. The `./db360.dump` mount is commented out — that file is not in the zip.
3. The `ngrok` service is commented out — it needs an auth token and is
   pointless when the API is on localhost.
4. The `scheduler` (worker) service is commented out — see below.

`src/.env` was created with `POSTGRES_PASSWORD` (compose has no default for it,
so it fails without this file).

`src/db/local_init.py` was added: the sync version of `db_init.py`, with the
seed inserts actually enabled.

## Getting article data without db360.dump

`src/worker/local_ingest.py` is a replacement for the `scheduler` worker that does
not need the missing `hebrew_classifier/` folder. Same pipeline and the same
structure as the original, with two models swapped:

| stage | original | replacement |
|---|---|---|
| embeddings | `dicta-il/dictabert` | `paraphrase-multilingual-mpnet-base-v2` (768-dim either way) |
| topic label | fine-tuned classifier | `mDeBERTa-v3-base-xnli` zero-shot |

Run one pass:

```bash
cd ~/360news-server/src
docker compose run --rm ingest python local_ingest.py --once
```

Or leave it running on the 5-minute loop like the real scheduler:

```bash
docker compose up -d ingest
```

Tuning modes, which reuse stored articles instead of re-scraping:

```bash
docker compose run --rm ingest python local_ingest.py --recluster          # after changing SIMILARITY_THRESHOLD
docker compose run --rm ingest python local_ingest.py --relabel --limit 25 # after changing labels/thresholds
```

### How well the two replacements work

**Clustering: works.** `SIMILARITY_THRESHOLD` had to come down from 0.88 to 0.75 -
this model reports lower similarities than dictabert for the same pair of texts.
Measured on a real scrape, every cross-site pair down to ~0.74 was genuinely the
same story, so 0.88 was discarding correct matches. At 0.75, a 191-article scrape
produced 14 multi-source stories with no false groupings: the nursery-assistant
verdict matched across 6 sites, the Lapid/Netanyahu defence budget across 5.

**Topic labelling: does not work well enough to trust.** Both attempts failed:

- cosine similarity against embedded topic descriptions put
  "מנהיגי עולם התורה בהתרת נדרים" under מאחזים, and raising the cutoff did not
  help because the wrong labels scored at the top of the distribution too.
- zero-shot NLI is better at rejecting (a `CATCH_ALL` candidate label lets it
  answer "none of these"), but the labels it does keep are still wrong: the
  Lapid budget story came out as עצמאות שיפוטית, the Prinuk baby-food case as
  חוק הלאום. Every score sits between 0.20 and 0.56, i.e. the model is guessing.

These 22 labels are narrow Israeli political issues. The original system used a
classifier fine-tuned on labelled Hebrew news for exactly them; zero-shot only
reasons from the label text. This mainly degrades the **map tab**, whose
per-topic site rankings are built on `topic_id`. The **feed** is barely affected -
it uses the topic only as a display heading.

If the labels matter, the options are the real `hebrew_classifier` folder, a
larger NLI model (`joeddav/xlm-roberta-large-xnli`, ~4x the size and roughly 4x
slower on CPU - a full pass would take hours, not the ~24 minutes this one takes),
or fine-tuning a classifier on labelled data.

## What does not work locally, and why

**Without running `local_ingest.py`, the news feed is empty.** `/feed` (`getClusters.py`) only returns
articles that belong to a cluster with `article_count >= 2`. Clusters are
produced by the `scheduler` worker, and the worker cannot run here:

- `worker/NewsClusterer.py:56-58` loads a fine-tuned classifier from
  `/app/hebrew_classifier` plus `label_encoder.pkl`. That folder is not in
  the zip and cannot be reconstructed from what is here.
- `db/add_initial_site_ranks.py` reads `research/initial_ranks.json`, also
  missing, so every site starts at prior bias 0.0 (the map shows 50% for all).

To get real data you need one of these from wherever the deployed server keeps
them: the `db360.dump` database dump, or the `hebrew_classifier` model folder
plus `research/initial_ranks.json`.

**The map tab does work** — `/topics`, `/sites`, `/ranks/{topic}` and
`/ranks/site/{site}` all respond once seeded.

**`/ranks` with no topic does not exist** on this server, but
`analyticsPage.tsx` calls it via `getRanks()`. That call will 404 and fall back
to an empty object, so the analytics page renders with zeros.
