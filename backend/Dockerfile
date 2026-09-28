FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --require-hashes --only-binary ":all:" -r requirements.txt

# Copia explícita de lo que la imagen necesita (nunca `COPY . .`): el código de
# la app y las migraciones. Así un `.env` local, pruebas o scripts nunca terminan
# dentro de la imagen aunque falte una regla en .dockerignore.
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

# No ejecutar como root (OWASP A05: configuración de seguridad).
RUN useradd --create-home --uid 1001 govsync && chown -R govsync:govsync /app
USER govsync

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
