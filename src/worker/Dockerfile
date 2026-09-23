FROM python:3.12-slim

WORKDIR /app

COPY worker/requirements.txt /tmp/requirements.txt

# no torch and no local models any more - both run on OpenAI's API (gpt_models.py)
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

COPY worker /app/worker
COPY store /app/store
COPY migrate /app/migrate
# initial_ranks.json: the benchmark the migration seeds the map from
COPY db/initial_ranks.json /app/db/initial_ranks.json

ENV PYTHONPATH="/app"
ENV PYTHONUNBUFFERED=1

WORKDIR /app/worker

# one pass and exit: the half-hourly cadence belongs to whoever starts it. python is
# the entrypoint so a run can name another script, e.g. `calibrate.py clusters`.
ENTRYPOINT ["python"]
CMD ["ingest.py", "--once"]
