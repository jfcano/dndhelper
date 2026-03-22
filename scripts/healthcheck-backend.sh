#!/usr/bin/env sh
# Comprueba /health/ready del API (Python está en la imagen del backend).
set -e
export BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:8000/health/ready}"
exec python -c "import os, urllib.request; urllib.request.urlopen(os.environ['BACKEND_HEALTH_URL'], timeout=5)"
