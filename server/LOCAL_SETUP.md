# Running and changing the server

Everything below runs from `server/` in this repository.

The server has no machine of its own any more. It is three things inside the
project's own Google Cloud, which is the same project Firebase shows:

| what | where | when it runs |
|---|---|---|
| the api the app calls | Cloud Run service `news360-api` | on request, scales to zero |
| the scrape and everything after it | Cloud Run job `news360-ingest` | every 30 minutes |
| the stories, the map and the ratings | Firestore, `europe-west1` | — |

## One-time

1. Install the Google CLI and sign in, both as yourself and for the libraries:

   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project haezrach-hakatan
   ```

2. Put the keys in `src/.env` (never anywhere else, and never in a commit):

   ```
   OPENAI_API_KEY=...
   GEMINI_API_KEY=...
   DEV_KEY=...
   ```

## Deploying

```bash
./deploy-gcp.sh haezrach-hakatan
```

Builds both images, updates the service, the job and the timers, and copies the
keys from `src/.env` into Secret Manager. `SCHEDULE=off` pauses the half-hourly
ingest, `SCHEDULE=on` starts it again.

## Running one thing by hand

```bash
./run-job.sh haezrach-hakatan ingest.py --scrape-only     # every site, writes nothing
./run-job.sh haezrach-hakatan ingest.py --once            # one full pass
./run-job.sh haezrach-hakatan ingest.py --retag           # re-tag everything stored
./run-job.sh haezrach-hakatan ingest.py --feed            # rebuild the feed document
./run-job.sh haezrach-hakatan calibrate.py clusters       # score the grouping thresholds
./run-job.sh haezrach-hakatan /app/migrate/seed_topics.py # rewrite the issue list
```

Each one runs in the cloud, in the same image and with the same keys as the
scheduled ingest, and prints the run's output when it finishes.

`local-run.sh` does the same on this Mac, through Docker Desktop and your own
gcloud login - faster when iterating on a script, and it needs no deploy.

## Watching it

```bash
gcloud run jobs executions list --job news360-ingest --region europe-west1
gcloud logging read 'resource.type="cloud_run_job"' --limit 50 --format='value(textPayload)'
```

## What costs money

Google is inside its free tier at this size; the bill is OpenAI's, a few dollars
a month for the embeddings, the tagging and the summaries. Firestore keeps 30
hours of stories - the ingest deletes what is older - so storage does not grow.
