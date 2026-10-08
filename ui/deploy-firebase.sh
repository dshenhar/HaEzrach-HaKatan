#!/usr/bin/env bash
# Build the web app against the production API and publish it on Firebase Hosting,
# in the same project as the server and the database.
#
#   ./deploy-firebase.sh                     the live api
#   ./deploy-firebase.sh <api-host>          against another one
#
# The address is https://haezrach-hakatan.web.app. It is what a shared link points
# at, so app/+html.tsx names it too - the picture and the line a message shows are
# read from there.
set -euo pipefail

API_HOST="${1:-news360-api-hh4th4joma-ew.a.run.app}"
cd "$(dirname "$0")"

echo "==> checking the API answers before building against it"
curl -fsS -m 15 "https://$API_HOST/health" >/dev/null \
  || { echo "https://$API_HOST/health did not answer"; exit 1; }

echo "==> exporting the web build"
rm -rf dist
EXPO_PUBLIC_URL_BASE="https://$API_HOST" npx expo export --platform web --clear

echo "==> publishing to Firebase Hosting"
# The upload goes file by file, and from some networks - Cloud Shell, for one -
# it is dropped after a dozen files. What was uploaded is not asked for again, so
# each attempt gets further than the one before.
for attempt in 1 2 3 4 5 6; do
  npx --yes firebase-tools deploy --only hosting --project haezrach-hakatan && exit 0
  echo "    the upload stopped at attempt $attempt; trying again"
  sleep 5
done
echo "Firebase Hosting did not take the upload after 6 attempts"
exit 1
