#!/usr/bin/env bash
# Ejecuta pytest (backend) y Playwright E2E (frontend).
# Requiere POSTGRES_TEST_URL para pytest (ver scripts/test.sh).
# Los E2E necesitan la API en marcha; Playwright arranca Vite si hace falta.
#
# Uso:
#   ./scripts/test-all.sh
#   SKIP_E2E=1 ./scripts/test-all.sh      # solo pytest
#   SKIP_BACKEND=1 ./scripts/test-all.sh # solo Playwright
#   ./scripts/test-all.sh --skip-e2e
#   ./scripts/test-all.sh --skip-backend

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

SKIP_E2E="${SKIP_E2E:-0}"
SKIP_BACKEND="${SKIP_BACKEND:-0}"

for arg in "$@"; do
  case "$arg" in
    --skip-e2e) SKIP_E2E=1 ;;
    --skip-backend) SKIP_BACKEND=1 ;;
    *)
      echo "Opción desconocida: $arg (usa --skip-e2e o --skip-backend)" >&2
      exit 1
      ;;
  esac
done

if [[ "$SKIP_E2E" == 1 && "$SKIP_BACKEND" == 1 ]]; then
  echo "Nada que ejecutar: no combines SKIP_E2E y SKIP_BACKEND." >&2
  exit 1
fi

if [[ "$SKIP_BACKEND" != 1 ]]; then
  "$SCRIPT_DIR/test.sh"
  echo ""
  echo "--- Backend (pytest) OK ---"
  echo ""
fi

if [[ "$SKIP_E2E" != 1 ]]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "No se encontró npm; no se pueden ejecutar los E2E de Playwright." >&2
    exit 1
  fi

  echo "E2E Playwright: asegúrate de que la API responde (p. ej. uvicorn en :8000)."
  echo ""

  if [[ ! -d "$REPO_ROOT/frontend" ]]; then
    echo "No existe la carpeta frontend/" >&2
    exit 1
  fi

  (cd "$REPO_ROOT/frontend" && npm run test:e2e)

  echo ""
  echo "--- Frontend E2E (Playwright) OK ---"
  echo ""
fi

echo "Todas las suites solicitadas terminaron correctamente."
