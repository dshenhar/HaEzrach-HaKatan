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
npx --yes firebase-tools deploy --only hosting --project haezrach-hakatan
