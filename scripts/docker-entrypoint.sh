#!/bin/sh
set -e
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
alembic upgrade head
exec uvicorn app.api:app --host 0.0.0.0 --port "${PORT:-8000}"