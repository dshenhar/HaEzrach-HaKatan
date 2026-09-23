#!/usr/bin/env bash
# Run one script in the ingest image on Google Cloud and print its output.
#
#   ./run-job.sh <project-id> local_ingest.py --scrape-only
#   ./run-job.sh <project-id> calibrate.py clusters --days 4
#   ./run-job.sh <project-id> /app/db/local_init.py
#   ./run-job.sh <project-id>                        one ordinary ingest pass
#
# Same image, keys and database as the scheduled ingest - only the command differs.
set -euo pipefail

PROJECT="${1:?usage: $0 <project-id> [script args...]}"; shift
REGION="${REGION:-europe-west1}"
JOB=news360-ingest
G=(gcloud --project "$PROJECT" --quiet)

ARGS=()
[ $# -gt 0 ] && ARGS=(--args "$(IFS=,; echo "$*")")

# ${ARGS[@]+...}: macOS's bash 3.2 calls an empty array unbound under set -u
EXEC="$("${G[@]}" run jobs execute "$JOB" --region "$REGION" --wait ${ARGS[@]+"${ARGS[@]}"} \
          --format='value(metadata.name)' 2>/dev/null)" || STATUS=$?
EXEC="${EXEC:-$("${G[@]}" run jobs executions list --job "$JOB" --region "$REGION" --limit 1 --format='value(metadata.name)')}"

# the log lines arrive in Cloud Logging a few seconds after the run ends
sleep 8
"${G[@]}" logging read \
  "resource.type=\"cloud_run_job\" AND labels.\"run.googleapis.com/execution_name\"=\"$EXEC\"" \
  --order asc --limit 5000 --format 'value(textPayload)'
exit "${STATUS:-0}"
