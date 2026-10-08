# Working on this repository

The owner writes in Hebrew and wants the answers in Hebrew.

`server/` is the scrape, grouping, tagging and api, in Python on Google Cloud
([server/README.md](server/README.md), [server/LOCAL_SETUP.md](server/LOCAL_SETUP.md)).
`ui/` is the app - Expo and React Native, published as the web app at
https://haezrach-hakatan.web.app ([ui/README.md](ui/README.md)).

## A change is done when it is live

The owner expects a change to be in production when the work is reported done,
not only merged. Work on a branch, open a pull request, merge it into `main`
with a rebase, and then publish what changed.

A push to `main` runs the Deploy workflow (`.github/workflows/deploy.yml`), which
runs `./deploy.sh server` and/or `./deploy.sh web` for whatever the push changed.
After merging, find the Deploy run for the merged commit in GitHub Actions and
wait for it. If it published, that is the deploy - do not publish again. If it
failed, or did not run (the `GCP_SERVICE_ACCOUNT_JSON` secret not yet set:
[docs/github-actions-setup.md](docs/github-actions-setup.md)), say so and
publish by hand:

    ./deploy.sh server   something under server/src changed
    ./deploy.sh web      something under ui/ changed
    ./deploy.sh all      both

Then check that it is live (below), and say in the answer what was published.

In a Claude Code cloud session the environment carries the deploy key as
`GCP_SA_KEY`, and `deploy.sh` signs in with it through `scripts/gcp-auth.sh`.
Never print the key or write it into the repository. Shell state does not carry
from one command to the next, so any other gcloud or firebase call signs in in
the same command:

    source scripts/gcp-auth.sh && ./server/run-job.sh haezrach-hakatan ingest.py --scrape-only
    source scripts/gcp-auth.sh && gcloud logging read 'resource.type="cloud_run_job"' --limit 50 --format='value(textPayload)'

`deploy.sh` publishes code only. Keys, timers and database settings are
`server/deploy-gcp.sh`'s, which needs `server/src/.env` and is the owner's to run.
A migration under `server/src/migrate/` runs in the published image, so publish
first: `./server/run-job.sh haezrach-hakatan /app/migrate/<script>.py`.

## Checking that it is live

- **web**: the page names its bundle, `_expo/static/js/web/entry-<hash>.js`, and a
  new publish changes the hash. `npx firebase-tools hosting:channel:list --project
  haezrach-hakatan` shows when the live channel was last released.
- **server**: the ingest runs every half hour, on the hour and the half hour in
  Israel, and a change shows in the next pass - in its log, and in the feed at
  https://news360-api-hh4th4joma-ew.a.run.app/feed.
- **database**: Firestore holds the outlets and their feed addresses (`sites`),
  readable with the same key.

## Before pushing

There is no test suite. For `ui/`: `npx tsc --noEmit`, and eslint on the changed
files compared with before the change - the codebase has existing findings, so
compare rather than expect zero. For `server/`: pyflakes, and a run of the changed
code against the live sites when it scrapes. A cloud session has Chromium for
Playwright, so the web build (`npx expo export --platform web`) can be driven and
photographed before it is published.
