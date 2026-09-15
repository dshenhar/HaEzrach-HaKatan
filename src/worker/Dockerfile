FROM python:3.12-slim

WORKDIR /app

COPY worker/requirements.txt /tmp/requirements.txt

# Install with aggressive cache cleanup
RUN pip install --no-cache-dir -r /tmp/requirements.txt && \
    find /usr/local/lib/python3.12/site-packages -type f -name "*.pyc" -delete && \
    find /usr/local/lib/python3.12/site-packages -type d -name "__pycache__" -delete && \
    find /usr/local/lib/python3.12/site-packages -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true && \
    rm -rf /tmp/requirements.txt /root/.cache

# Copy application code
COPY worker /app/worker
COPY db /app/db

ENV PYTHONPATH="/app"
ENV PYTHONUNBUFFERED=1

WORKDIR /app/worker

CMD ["python", "scheduler.py"]