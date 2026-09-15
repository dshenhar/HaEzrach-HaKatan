#!/usr/bin/env bash
# Deploy the 360News server stack to a fresh Ubuntu 24.04 VPS.
#
#   ./deploy.sh 1.2.3.4
#
# Safe to re-run: every step is idempotent, and the database is only restored
# when the server's database is still empty - a redeploy never overwrites live data.
set -euo pipefail

IP="${1:?usage: ./deploy.sh <server-ip>}"
KEY="$HOME/.ssh/360news_deploy"
HOST="root@$IP"
# sslip.io resolves 1-2-3-4.sslip.io to 1.2.3.4, and Let's Encrypt issues for it
API_HOST="$(echo "$IP" | tr . -).sslip.io"
HERE="$(cd "$(dirname "$0")" && pwd)"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$HOST")

say() { printf '\n==> %s\n' "$*"; }

say "connecting to $IP"
"${SSH[@]}" true

say "installing Docker and a firewall (Ubuntu packages, no piped installers)"
"${SSH[@]}" bash -s <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if ! command -v docker >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq docker.io docker-compose-v2 >/dev/null
  systemctl enable --now docker
fi
apt-get install -y -qq ufw >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
# the ML image is ~9GB and the build needs headroom; a small box without swap
# gets OOM-killed half way through installing torch
if ! swapon --show | grep -q swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
mkdir -p /opt/360news
REMOTE

say "copying the code"
rsync -az --delete \
  -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new" \
  --exclude '.env' --exclude 'news360.dump' --exclude '__pycache__' \
  --exclude 'docker-compose.yml.orig' \
  "$HERE/src/" "$HOST:/opt/360news/"

say "writing the server's .env (only on first deploy)"
if ! "${SSH[@]}" test -f /opt/360news/.env; then
  GEMINI="$(grep '^GEMINI_API_KEY=' "$HERE/src/.env" | cut -d= -f2- || true)"
  # a fresh password: the local one appears in plain text in db/db_init.py.
  # CLAUDE_API_KEY is left out on purpose - it was pasted into a chat and must be
  # rotated before it goes anywhere near a public server.
  "${SSH[@]}" "umask 077 && cat > /opt/360news/.env" <<ENV
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$(openssl rand -hex 24)
API_HOST=$API_HOST
GEMINI_API_KEY=$GEMINI
ENV
fi

COMPOSE="cd /opt/360news && docker compose -f docker-compose.prod.yml"

say "starting the database"
"${SSH[@]}" "$COMPOSE up -d db"
"${SSH[@]}" "for i in \$(seq 1 30); do $COMPOSE exec -T db pg_isready -U postgres -d news360 >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1"

ROWS="$("${SSH[@]}" "$COMPOSE exec -T db psql -U postgres -d news360 -tAc \"select count(*) from information_schema.tables where table_name='articles'\"")"
if [ "$ROWS" = "0" ] && [ -f "$HERE/src/news360.dump" ]; then
  say "restoring the database from news360.dump (first deploy only)"
  rsync -az -e "ssh -i $KEY" "$HERE/src/news360.dump" "$HOST:/opt/360news/news360.dump"
  "${SSH[@]}" "$COMPOSE cp news360.dump db:/tmp/news360.dump && $COMPOSE exec -T db pg_restore -U postgres -d news360 --no-owner /tmp/news360.dump || true"
else
  say "database already populated - leaving it alone"
fi

say "building and starting everything (the ML image takes 10-20 minutes the first time)"
"${SSH[@]}" "$COMPOSE up -d --build"

say "bringing the schema up to date"
"${SSH[@]}" "$COMPOSE exec -T api python /db/local_init.py" | tail -2

say "waiting for HTTPS on https://$API_HOST"
for i in $(seq 1 40); do
  if curl -fsS -m 10 "https://$API_HOST/health" >/dev/null 2>&1; then
    curl -fsS "https://$API_HOST/health"; echo
    say "done - API is live at https://$API_HOST"
    exit 0
  fi
  sleep 6
done
echo "API did not answer over HTTPS yet. Check: ssh -i $KEY $HOST '$COMPOSE logs caddy api'"
exit 1
