# חדשות האזרח הקטן

An Israeli news reader built on one claim: the same day's news reads differently
depending on which half of the map you read it in, and the way out of that is to
see both at once.

Every half hour the server reads the Israeli news sites, groups the coverage into
stories, and works out what each story is about. The app shows a story twice: once
split into the right bloc and the left bloc, each with its own AI summary of how it
was told there, and once with no blocs at all.

| | |
|---|---|
| [`ui/`](ui) | the app - Expo and React Native, one codebase for iPhone, Android and the web |
| [`server/`](server) | the scrape, the grouping, the tagging and the api - Python on Google Cloud |

- **Live:** https://haezrach-hakatan.web.app
- **Running and deploying the server:** [server/LOCAL_SETUP.md](server/LOCAL_SETUP.md)

Nothing here holds a key. Both halves read theirs from files that are never
committed (`server/src/.env`, `ui/.env.local`), and the deployed server reads them
from Google's Secret Manager.
