#!/usr/bin/env bash
# Ejecutado en la imagen E2E (con dependencias ya instaladas en build).
set -euo pipefail
cd /work
exec npm run test:e2e -- "$@"
