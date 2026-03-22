#!/usr/bin/env bash
# Entrada del servicio «test» en docker-compose: crea BD de tests y ejecuta pytest.
set -euo pipefail
cd /app
python /app/scripts/ensure_test_database.py
exec python -m pytest "$@"
