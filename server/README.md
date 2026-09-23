# The server

The server behind חדשות האזרח הקטן: it reads the Israeli news sites every half
hour, groups the coverage into stories, works out what each story is about, and
serves the feed and the map the app draws.

```
scrape  ->  embed  ->  group into stories  ->  tag  ->  summarise  ->  feed
```

- **scrape** `worker/scraping.py` — the feeds, the scrapers for the sites without
  one, and a Hebrew translation of the Arabic ones.
- **embed and tag** `worker/gpt_models.py` — OpenAI. Embeddings decide which
  articles are the same story; the tagging model gives each article a section and,
  where there is one, a public issue.
- **store** `store/db.py` — Firestore. The feed is one document, the map is one
  document per issue, a rating touches three.
- **positions** `store/learning.py` — where an outlet stands on an issue, learned
  from readers' ratings against a benchmark, and guarded so a burst of ratings
  cannot vote the map into nonsense.
- **serve** `app/server.py` — the api the app calls.

Everything it needs to run, and every command worth knowing, is in
[LOCAL_SETUP.md](LOCAL_SETUP.md).
