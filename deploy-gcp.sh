#!/usr/bin/env bash
# Deploy the server to Google Cloud - the project Firebase created.
#
#   ./deploy-gcp.sh <project-id>             build, then update everything below
#   SCHEDULE=on  ./deploy-gcp.sh <id>        ... and start the half-hourly ingest
#   SCHEDULE=off ./deploy-gcp.sh <id>        ... and stop it
#
#   api      Cloud Run service; scales to zero between requests
#   ingest   Cloud Run job, one pass per run (local_ingest.py --once)
#   timers   Cloud Scheduler: the ingest every 30 minutes (created paused), and a
#            /ping every 10 so the api is usually warm when someone opens the app
#   keys     Secret Manager, copied from src/.env and never printed
#
# The database is this project's Firestore. The limits here - two api instances at
# most, one ingest at a time, 15 minutes a run, no retries - are what stop a bug
# from turning into a bill.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HERE/src/.env"
PROJECT="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
[ -n "$PROJECT" ] || { echo "usage: $0 <project-id>"; exit 1; }
REGION="${REGION:-europe-west1}"
REPO=news360
API=news360-api
JOB=news360-ingest
TAG="$(date +%Y%m%d-%H%M%S)"
API_IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REPO/api:$TAG"
WORKER_IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REPO/worker:$TAG"
G=(gcloud --project "$PROJECT" --quiet)

value() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
for key in OPENAI_API_KEY GEMINI_API_KEY DEV_KEY; do
  [ -n "$(value "$key")" ] || { echo "missing $key in src/.env"; exit 1; }
done

echo "==> services"
"${G[@]}" services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com \
  firestore.googleapis.com

echo "==> database"
if ! "${G[@]}" firestore databases describe --database='(default)' >/dev/null 2>&1; then
  "${G[@]}" firestore databases create --location="$REGION" --type=firestore-native
fi
# a rating is kept only to stop a second one from the same reader; what it taught
# lives in the topic's state, so the rating itself expires after a month
# --async: the policy is applied in the background, and waiting on it once held
# the whole deploy for ten minutes
"${G[@]}" firestore fields ttls update expires_at --collection-group=votes \
  --enable-ttl --database='(default)' --async >/dev/null 2>&1 || true

NUMBER="$("${G[@]}" projects describe "$PROJECT" --format='value(projectNumber)')"
SA="$NUMBER-compute@developer.gserviceaccount.com"
for role in roles/secretmanager.secretAccessor roles/run.invoker roles/datastore.user \
            roles/cloudbuild.builds.builder roles/logging.logWriter; do
  "${G[@]}" projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" \
    --role "$role" --condition=None >/dev/null
done

echo "==> keys"
# A new version only when the value changed, and the older ones destroyed: the free
# tier counts six live versions across the whole account.
put_secret() {
  local name="$1" val="$2"
  if ! "${G[@]}" secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$val" | "${G[@]}" secrets create "$name" --replication-policy automatic --data-file=- >/dev/null
    echo "   $name created"
    return
  fi
  if [ "$("${G[@]}" secrets versions access latest --secret "$name" 2>/dev/null || true)" = "$val" ]; then
    echo "   $name unchanged"
    return
  fi
  printf '%s' "$val" | "${G[@]}" secrets versions add "$name" --data-file=- >/dev/null
  local latest
  latest="$("${G[@]}" secrets versions describe latest --secret "$name" --format='value(name.basename())')"
  for v in $("${G[@]}" secrets versions list "$name" --filter='state=enabled' --format='value(name.basename())'); do
    [ "$v" = "$latest" ] || "${G[@]}" secrets versions destroy "$v" --secret "$name" >/dev/null
  done
  echo "   $name updated"
}
put_secret OPENAI_API_KEY "$(value OPENAI_API_KEY)"
put_secret GEMINI_API_KEY "$(value GEMINI_API_KEY)"
put_secret DEV_KEY "$(value DEV_KEY)"

echo "==> images"
"${G[@]}" artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1 || \
  "${G[@]}" artifacts repositories create "$REPO" --location "$REGION" --repository-format docker
# the free tier stores 0.5GB of images; keep the latest two of each
"${G[@]}" artifacts repositories set-cleanup-policies "$REPO" --location "$REGION" \
  --policy "$HERE/artifact-cleanup.json" --no-dry-run >/dev/null
# src/.gcloudignore keeps the keys and the database dumps out of the upload
"${G[@]}" builds submit "$HERE/src" --config "$HERE/cloudbuild.yaml" \
  --substitutions "_API_IMAGE=$API_IMAGE,_WORKER_IMAGE=$WORKER_IMAGE"

echo "==> api"
"${G[@]}" run deploy "$API" --image "$API_IMAGE" --region "$REGION" --port 8000 \
  --allow-unauthenticated --min-instances 0 --max-instances 2 --cpu 1 --memory 512Mi \
  --timeout 120 --service-account "$SA" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT" \
  --set-secrets "OPENAI_API_KEY=OPENAI_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,DEV_KEY=DEV_KEY:latest"
API_URL="$("${G[@]}" run services describe "$API" --region "$REGION" --format='value(status.url)')"

echo "==> ingest job"
"${G[@]}" run jobs deploy "$JOB" --image "$WORKER_IMAGE" --region "$REGION" \
  --tasks 1 --parallelism 1 --max-retries 0 --task-timeout 15m --cpu 1 --memory 1Gi \
  --service-account "$SA" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT" \
  --set-secrets "OPENAI_API_KEY=OPENAI_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest"

echo "==> timers"
has_timer() { "${G[@]}" scheduler jobs describe "$1" --location "$REGION" >/dev/null 2>&1; }
INGEST_TIMER=(--schedule "*/30 * * * *" --time-zone "Asia/Jerusalem"
  --uri "https://run.googleapis.com/v2/projects/$PROJECT/locations/$REGION/jobs/$JOB:run"
  --http-method POST --oauth-service-account-email "$SA")
if has_timer news360-ingest-every-30; then
  "${G[@]}" scheduler jobs update http news360-ingest-every-30 --location "$REGION" "${INGEST_TIMER[@]}" >/dev/null
else
  "${G[@]}" scheduler jobs create http news360-ingest-every-30 --location "$REGION" "${INGEST_TIMER[@]}" >/dev/null
  # paused until the database is in place and the thresholds are calibrated
  [ "${SCHEDULE:-}" = on ] || "${G[@]}" scheduler jobs pause news360-ingest-every-30 --location "$REGION" >/dev/null
fi
PING_TIMER=(--schedule "*/10 * * * *" --uri "$API_URL/ping" --http-method GET)
if has_timer news360-ping; then
  "${G[@]}" scheduler jobs update http news360-ping --location "$REGION" "${PING_TIMER[@]}" >/dev/null
else
  "${G[@]}" scheduler jobs create http news360-ping --location "$REGION" "${PING_TIMER[@]}" >/dev/null
fi
case "${SCHEDULE:-}" in
  on)  "${G[@]}" scheduler jobs resume news360-ingest-every-30 --location "$REGION" >/dev/null ;;
  off) "${G[@]}" scheduler jobs pause news360-ingest-every-30 --location "$REGION" >/dev/null ;;
esac
STATE="$("${G[@]}" scheduler jobs describe news360-ingest-every-30 --location "$REGION" --format='value(state)')"

echo "==> done"
echo "   api:    $API_URL"
echo "   ingest: every 30 minutes, currently $STATE"
