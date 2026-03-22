#!/usr/bin/env bash
# Ejecutado en la imagen mcr.microsoft.com/playwright (servicio «e2e» en docker-compose).
set -euo pipefail
cd /work
npm ci
# Alinear navegadores con @playwright/test del proyecto (por si la imagen base difiere ligeramente)
npx playwright install chromium
exec npm run test:e2e -- "$@"
