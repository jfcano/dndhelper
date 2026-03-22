#!/usr/bin/env sh
# Comprueba que Nginx sirva el frontend (wget en nginx:alpine).
set -e
URL="${FRONTEND_HEALTH_URL:-http://127.0.0.1:80/}"
if command -v wget >/dev/null 2>&1; then
  exec wget -q -O /dev/null "$URL"
fi
if command -v curl >/dev/null 2>&1; then
  exec curl -fsS -o /dev/null "$URL"
fi
exec python -c "import urllib.request; urllib.request.urlopen('$URL', timeout=5)"
