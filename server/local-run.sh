#!/usr/bin/env bash
# Run one script from the ingest image on this Mac, against the Neon database.
#
#   ./local-run.sh ingest.py --scrape-only
#   ./local-run.sh ingest.py --once
#   ./local-run.sh /app/migrate/pg_to_firestore.py
#   ./local-run.sh calibrate.py clusters --days 4     (needs DATABASE_URL, see below)
#
# The keys come from src/.env and go into the container's environment. Firestore is
# reached with your own gcloud login, mounted read-only.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
value() { grep "^$1=" "$HERE/src/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
docker build -q -t news360-worker -f "$HERE/src/worker/Dockerfile" "$HERE/src" >/dev/null
OPENAI_API_KEY="$(value OPENAI_API_KEY)" \
GEMINI_API_KEY="$(value GEMINI_API_KEY)" \
  docker run --rm -e OPENAI_API_KEY -e GEMINI_API_KEY \
    -e GOOGLE_CLOUD_PROJECT="$PROJECT" \
    -e GOOGLE_APPLICATION_CREDENTIALS=/adc/application_default_credentials.json \
    -e DATABASE_URL="${DATABASE_URL:-}" \
    -v "$HOME/.config/gcloud:/adc:ro" \
    news360-worker "$@"
