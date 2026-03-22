"""
Espera a que POSTGRES_URL sea accesible (Docker/Kubernetes antes de migraciones o worker).
"""
from __future__ import annotations

import os
import sys
import time

from sqlalchemy import create_engine, text


def main() -> None:
    url = os.getenv("POSTGRES_URL")
    if not url:
        print("wait_for_db: falta POSTGRES_URL", file=sys.stderr)
        raise SystemExit(1)

    max_wait_s = int(os.getenv("WAIT_FOR_DB_MAX_S", "120"))
    interval = float(os.getenv("WAIT_FOR_DB_INTERVAL_S", "2"))
    deadline = time.monotonic() + max_wait_s

    engine = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 5})

    while time.monotonic() < deadline:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("wait_for_db: conexión a PostgreSQL lista.")
            return
        except OSError:
            pass
        except Exception as e:
            print(f"wait_for_db: esperando… ({e})", file=sys.stderr)
        time.sleep(interval)

    print("wait_for_db: tiempo de espera agotado.", file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    main()
