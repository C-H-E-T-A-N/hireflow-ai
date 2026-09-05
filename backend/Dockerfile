FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first so the layer caches across code changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Strip carriage returns in case the image is built from a Windows checkout: a
# CRLF shebang makes the kernel report a misleading "no such file or directory".
# .gitattributes also pins *.sh to LF, so this is belt and braces.
RUN sed -i "s/\r$//" entrypoint.sh && chmod +x entrypoint.sh

# Run as a non-root user.
RUN useradd --create-home --uid 1000 hireflow && chown -R hireflow:hireflow /app
USER hireflow

EXPOSE 8000

# See entrypoint.sh: migrations run synchronously, seeding runs in the
# background, and uvicorn binds the port immediately so platform health checks
# pass without waiting for several thousand demo rows to be written.
CMD ["./entrypoint.sh"]
