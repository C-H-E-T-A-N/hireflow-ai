#!/bin/sh
# Container start-up for the HireFlow API.
#
# Ordering matters on platforms that health-check a new instance and kill it if
# the port does not open quickly:
#
#   1. Print a redacted diagnostic summary, so a failed deploy leaves an
#      explanation in the platform log instead of an unexplained hang.
#   2. Run migrations synchronously. They are fast, and serving requests against
#      an un-migrated database would be worse than a slightly later start.
#   3. Seed the demo workspace in the BACKGROUND. Seeding inserts a few thousand
#      attendance rows, which is far too slow to block the port from opening.
#      The seeder is a no-op once data exists, so restarts are safe.
#   4. Exec uvicorn as PID 1 so it receives shutdown signals directly.

set -e

python -m scripts.preflight

echo "[entrypoint] running database migrations..."
alembic upgrade head

echo "[entrypoint] seeding demo workspace in the background..."
( python -m scripts.seed || echo "[entrypoint] seed skipped (data already present or failed)" ) &

echo "[entrypoint] starting API on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
