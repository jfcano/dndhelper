#!/usr/bin/env sh
# Uso: variables PGHOST, PGPORT (5432), PGUSER, PGDATABASE o equivalentes de libpq.
set -e
PGPORT="${PGPORT:-5432}"
exec pg_isready -h "${PGHOST:-127.0.0.1}" -p "$PGPORT" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-postgres}"
