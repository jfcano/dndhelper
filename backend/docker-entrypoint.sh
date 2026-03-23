#!/bin/sh
set -e
cd /app

if [ -n "${SETUP_MASTER_PASSWORD:-}" ]; then
  echo "[setup] SETUP_MASTER_PASSWORD definida: ${SETUP_MASTER_PASSWORD}"
else
  SETUP_MASTER_PASSWORD="$(python - <<'PY'
import secrets
print(secrets.token_urlsafe(24))
PY
)"
  export SETUP_MASTER_PASSWORD
  echo "[setup] SETUP_MASTER_PASSWORD no definida; generada automáticamente: ${SETUP_MASTER_PASSWORD}"
fi

python -m backend.scripts.wait_for_db
alembic upgrade head
exec uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
