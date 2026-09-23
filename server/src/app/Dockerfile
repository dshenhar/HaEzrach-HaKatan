FROM python:3.12-slim

WORKDIR /app

COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app /app/app
COPY store /app/store

ENV PYTHONPATH="/app"
ENV PYTHONUNBUFFERED=1

WORKDIR /app/app
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
