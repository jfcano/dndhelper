#!/bin/sh
set -e
cd /app
python -m backend.scripts.wait_for_db
alembic upgrade head
exec uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
