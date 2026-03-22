#!/bin/sh
set -e
cd /app
python -m backend.scripts.wait_for_db
# Idempotente: mismo esquema que el API (evita carrera API/worker en Compose y en K8s).
alembic upgrade head
exec python -m backend.scripts.ingest_worker
