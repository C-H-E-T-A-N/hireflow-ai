FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first so the layer caches across code changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a non-root user.
RUN useradd --create-home --uid 1000 hireflow && chown -R hireflow:hireflow /app
USER hireflow

EXPOSE 8000

# Migrations run at start so a fresh environment converges on its own, then the
# demo workspace is seeded. The seeder is a no-op once data exists (it exits
# non-zero and says so), hence the `|| true` - a populated database must never
# stop the service from booting.
CMD ["sh", "-c", "alembic upgrade head && (python -m scripts.seed || true) && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
