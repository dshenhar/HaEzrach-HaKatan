# Sign gcloud and firebase-tools in with the deploy key in $GCP_SA_KEY.
#
#   source scripts/gcp-auth.sh
#
# For a Claude Code cloud session, whose environment carries the key of the
# project's deploy service account as GCP_SA_KEY - the JSON key, or its base64.
# On a machine already signed in with `gcloud auth login` and without GCP_SA_KEY
# this does nothing, and every script works the way it always has.
#
# The key is written once, to a file only this user can read, outside the
# repository. It is never printed. Shell state does not carry from one command to
# the next in a session, so source this in the same command as the gcloud call:
#
#   source scripts/gcp-auth.sh && ./server/run-job.sh haezrach-hakatan ingest.py --scrape-only

if [ -n "${GCP_SA_KEY:-}" ]; then
  _gcp_dir="${XDG_CONFIG_HOME:-$HOME/.config}/haezrach-gcloud"
  mkdir -p "$_gcp_dir" && chmod 700 "$_gcp_dir"
  if [ ! -s "$_gcp_dir/sa.json" ]; then
    (umask 077 && python3 -c '
import base64, json, os, sys
raw = os.environ["GCP_SA_KEY"].strip()
try:
    key = json.loads(raw)
except ValueError:
    key = json.loads(base64.b64decode("".join(raw.split())))
sys.stdout.write(json.dumps(key))' > "$_gcp_dir/sa.json") \
      || echo "gcp-auth: GCP_SA_KEY is neither a JSON key nor its base64" >&2
  fi
  # a config of its own, so the key's sign-in is the only one gcloud sees here;
  # the proxy and certificate settings still come from the CLOUDSDK_* variables
  export CLOUDSDK_CONFIG="$_gcp_dir/config"
  # a cloud session presets a token for gcloud, and a token wins over any account
  unset CLOUDSDK_AUTH_ACCESS_TOKEN
  # firebase-tools and the Google client libraries read the key from here
  export GOOGLE_APPLICATION_CREDENTIALS="$_gcp_dir/sa.json"
  if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
    gcloud auth activate-service-account --key-file="$_gcp_dir/sa.json" --quiet >/dev/null 2>&1 \
      || echo "gcp-auth: Google did not accept the key in GCP_SA_KEY" >&2
  fi
  gcloud config set core/project haezrach-hakatan --quiet >/dev/null 2>&1
  unset _gcp_dir
fi
