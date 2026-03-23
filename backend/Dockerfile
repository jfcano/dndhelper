FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
COPY requirements-dev.txt .
ARG INSTALL_DEV=false
RUN pip install --no-cache-dir -U pip && \
    if [ "$INSTALL_DEV" = "true" ]; then \
      pip install --no-cache-dir -r requirements-dev.txt; \
    else \
      pip install --no-cache-dir -r requirements.txt; \
    fi

COPY alembic.ini .
COPY alembic ./alembic
COPY backend ./backend

COPY backend/docker-entrypoint.sh backend/docker-entrypoint-worker.sh /usr/local/bin/
COPY scripts/healthcheck-backend.sh /usr/local/bin/
COPY scripts/ensure_test_database.py scripts/docker-test-entrypoint.sh /app/scripts/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh /usr/local/bin/docker-entrypoint-worker.sh \
    /usr/local/bin/healthcheck-backend.sh \
    /app/scripts/docker-test-entrypoint.sh

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["/usr/local/bin/docker-entrypoint.sh"]
