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
cd "$(dirname "$0")"

echo "==> checking the API answers before building against it"
curl -fsS -m 15 "https://$API_HOST/health" >/dev/null \
  || { echo "https://$API_HOST/health did not answer - deploy the server first"; exit 1; }

echo "==> exporting the web build"
rm -rf dist
EXPO_PUBLIC_URL_BASE="https://$API_HOST" npx expo export --platform web

# expo-router's static output writes mapPage.html etc; cleanUrls serves /mapPage
cat > dist/vercel.json <<'JSON'
{ "cleanUrls": true }
JSON

echo "==> publishing to Vercel"
npx vercel deploy dist --prod --yes
