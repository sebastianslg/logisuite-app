# LogiSuite TMS - imagen de producción
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=America/Bogota

WORKDIR /app

# Dependencias primero, para aprovechar la caché de capas de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Usuario sin privilegios: el entrypoint arranca como root solo para ajustar
# los permisos del volumen de datos y luego cede el proceso a este usuario.
RUN groupadd --system --gid 1000 app \
    && useradd --system --uid 1000 --gid app --home-dir /app --shell /usr/sbin/nologin app

COPY --chown=app:app . .
RUN chmod +x entrypoint.sh && mkdir -p data && chown app:app data

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8501/_stcore/health', timeout=4).status == 200 else 1)"

ENTRYPOINT ["./entrypoint.sh"]
