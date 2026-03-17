#!/usr/bin/env bash
set -euo pipefail

load_dotenv_if_needed() {
  if [[ -n "${POSTGRES_TEST_URL:-}" ]]; then
    return
  fi
  if [[ ! -f ".env" ]]; then
    return
  fi
  # Extrae POSTGRES_TEST_URL de .env (sin ejecutar el archivo)
  local line
  line="$(grep -E '^[[:space:]]*POSTGRES_TEST_URL[[:space:]]*=' .env | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return
  fi
  local value="${line#*=}"
  value="${value%$'\r'}"
  value="$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  # Quitar comillas si existen
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  export POSTGRES_TEST_URL="$value"
}

load_dotenv_if_needed

if [[ -z "${POSTGRES_TEST_URL:-}" ]]; then
  echo "Falta POSTGRES_TEST_URL. Ejemplo:"
  echo "  export POSTGRES_TEST_URL='postgresql+psycopg://user:pass@host:5432/db_test'"
  exit 1
fi

if [[ ! -x ".venv/bin/python" && ! -x ".venv/Scripts/python.exe" ]]; then
  echo "No encuentro .venv. Crea el venv e instala requirements.txt"
  exit 1
fi

if [[ -x ".venv/bin/python" ]]; then
  # Preflight: validar conexión a la BD de tests (y que exista)
  .venv/bin/python -c "import os; from sqlalchemy import create_engine, text; url=os.getenv('POSTGRES_TEST_URL'); eng=create_engine(url, connect_args={'connect_timeout':5}, pool_pre_ping=True); 
try:
  with eng.connect() as c: c.execute(text('select 1')).scalar()
  print('OK: POSTGRES_TEST_URL accesible')
except Exception as e:
  print('ERROR: no se pudo conectar a POSTGRES_TEST_URL'); print(e); raise SystemExit(2)
"
  .venv/bin/python -m pytest -q
else
  .venv/Scripts/python.exe -c "import os; from sqlalchemy import create_engine, text; url=os.getenv('POSTGRES_TEST_URL'); eng=create_engine(url, connect_args={'connect_timeout':5}, pool_pre_ping=True); 
try:
  with eng.connect() as c: c.execute(text('select 1')).scalar()
  print('OK: POSTGRES_TEST_URL accesible')
except Exception as e:
  print('ERROR: no se pudo conectar a POSTGRES_TEST_URL'); print(e); raise SystemExit(2)
"
  .venv/Scripts/python.exe -m pytest -q
fi

