# LogiSuite TMS - API FastAPI (multi-stage)

# ---- Etapa 1: dependencias en un entorno virtual aislado -------------------
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && pip check

# ---- Etapa 2: imagen de ejecución mínima -----------------------------------
FROM python:3.11-slim AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=America/Bogota \
    LOGISUITE_DB_PATH=/data/logistics.db

RUN groupadd --system --gid 1000 app \
    && useradd --system --uid 1000 --gid app --home-dir /srv --shell /usr/sbin/nologin app

COPY --from=builder /opt/venv /opt/venv
WORKDIR /srv
COPY --chown=app:app app ./app
COPY --chown=app:app entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh && mkdir -p /data && chown app:app /data

EXPOSE 8000
VOLUME ["/data"]

HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"

ENTRYPOINT ["./entrypoint.sh"]
