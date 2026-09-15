#!/usr/bin/env bash
# Build the web app against the production API and publish it on Vercel.
#
#   ./deploy-web.sh 1-2-3-4.sslip.io
#
# The API address is baked into the bundle at build time, so this has to be
# re-run whenever the API host changes. A variable set in the shell wins over the
# LAN address in .env.local, which stays the local-dev setting.
set -euo pipefail

API_HOST="${1:?usage: ./deploy-web.sh <api-host>}"
# the project name becomes the address: https://<name>.vercel.app
PROJECT="${VERCEL_PROJECT:-haezrach-hakatan}"
cd "$(dirname "$0")"

echo "==> checking the API answers before building against it"
curl -fsS -m 15 "https://$API_HOST/health" >/dev/null \
  || { echo "https://$API_HOST/health did not answer - deploy the server first"; exit 1; }

echo "==> exporting the web build"
rm -rf dist
EXPO_PUBLIC_URL_BASE="https://$API_HOST" npx expo export --platform web

# The Vercel CLI never uploads a path containing node_modules, and expo export puts
# the fonts and icon fonts under dist/assets/node_modules - the live site then
# waits for fonts that 404 and stays blank. Move them out from under that name and
# point the bundle and pages at the new place.
if [ -d dist/assets/node_modules ]; then
  mv dist/assets/node_modules dist/assets/vendor
  grep -rlIF 'assets/node_modules/' dist | while IFS= read -r f; do
    perl -pi -e 's{assets/node_modules/}{assets/vendor/}g' "$f"
  done || true
fi
if grep -rqIF 'assets/node_modules/' dist; then
  echo "dist still points at assets/node_modules - Vercel would drop those files"
  exit 1
fi

# expo-router's static output writes mapPage.html etc; cleanUrls serves /mapPage
cat > dist/vercel.json <<'JSON'
{ "cleanUrls": true }
JSON

echo "==> publishing to Vercel as $PROJECT"
# deploying the bare dist folder would name the project "dist"; creating it by
# name first fails harmlessly on every run after the first
npx vercel project add "$PROJECT" >/dev/null 2>&1 || true
npx vercel deploy dist --prod --yes --project "$PROJECT"
