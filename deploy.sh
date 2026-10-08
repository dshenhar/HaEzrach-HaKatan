#!/usr/bin/env bash
# Publish this checkout to production.
#
#   ./deploy.sh server    the ingest job and the api, built from server/src
#   ./deploy.sh web       the web app on Firebase Hosting, built from ui/
#   ./deploy.sh all       both, the server first
#
# The code and nothing else. Keys, timers and database settings belong to
# server/deploy-gcp.sh, which needs server/src/.env and is for a first deploy or
# for changing the infrastructure. This is the everyday one, and the one a Claude
# Code cloud session can run by itself: it signs in with $GCP_SA_KEY when the
# environment has it (scripts/gcp-auth.sh), and otherwise uses whoever gcloud is
# signed in as.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WHAT="${1:?usage: ./deploy.sh server|web|all}"
PROJECT=haezrach-hakatan
REGION=europe-west1
# shellcheck source=scripts/gcp-auth.sh
source "$HERE/scripts/gcp-auth.sh"

server() {
  local tag img
  tag="$(date +%Y%m%d-%H%M%S)"
  img="$REGION-docker.pkg.dev/$PROJECT/news360"
  echo "==> building the api and the ingest images ($tag)"
  # src/.gcloudignore keeps keys and database dumps out of the upload
  gcloud --project "$PROJECT" --quiet builds submit "$HERE/server/src" \
    --config "$HERE/server/cloudbuild.yaml" \
    --substitutions "_API_IMAGE=$img/api:$tag,_WORKER_IMAGE=$img/worker:$tag"
  echo "==> the ingest job"
  gcloud --project "$PROJECT" --quiet run jobs update news360-ingest \
    --region "$REGION" --image "$img/worker:$tag"
  # The api moves to the same build even when its own code did not change: the
  # registry keeps the newest two images of each kind, so an api left on an older
  # one would find it deleted under it a day later.
  echo "==> the api"
  gcloud --project "$PROJECT" --quiet run deploy news360-api \
    --region "$REGION" --image "$img/api:$tag"
  echo "   server: $tag - the ingest picks it up at its next half hour"
}

web() {
  cd "$HERE/ui"
  [ -d node_modules ] || npm ci --no-audit --no-fund
  ./deploy-firebase.sh
}

case "$WHAT" in
  server) server ;;
  web) web ;;
  all) server; web ;;
  *) echo "usage: ./deploy.sh server|web|all"; exit 1 ;;
esac
