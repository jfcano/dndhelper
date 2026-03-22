#!/bin/sh
set -e
cd /app
python -m backend.scripts.wait_for_db
exec python -m backend.scripts.ingest_worker
