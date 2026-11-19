# Keycloak de GovSync para producción (Render) — docs/DESPLIEGUE.md §"Keycloak en Render".
#
# Imagen "optimizada" (docs oficiales: server/containers): el `kc.sh build` se
# ejecuta al construir la imagen, así que el arranque (`start --optimized`)
# solo lee la configuración de ejecución y es más rápido y liviano.
#
# Contexto de construcción = esta carpeta (keycloak/), que es el "Root
# Directory" del Web Service en Render. Localmente, desde la raíz del repo:
#   docker build -t govsync-keycloak keycloak
#
# La misma versión que docker-compose.yml. Subirla en los dos a la vez.

# ---- Etapa 1: build -------------------------------------------------------
FROM quay.io/keycloak/keycloak:26.7 AS builder

# Keycloak oficial corre como uid 1000; se declara explícito para no depender de
# la imagen base (OWASP A05, docker:S6471).
USER 1000

# Opciones de BUILD (cambiarlas exige reconstruir la imagen):
#   KC_DB=postgres          vendor de base de datos (comparte el Postgres de Render)
#   KC_HEALTH_ENABLED=true  endpoints /health/* (en el puerto de gestión 9000,
#                           NO en el 8080: Render no los ve; ver DESPLIEGUE.md)
#   KC_CACHE=local          caché sin clúster (Infinispan local): hay una sola
#                           instancia, y así se evita JGroups y se ahorra memoria
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_CACHE=local

# Tema de login de GovSync e importación del realm. Van dentro de la imagen
# porque Render no permite montar carpetas del repo como hace docker-compose.
COPY --chown=1000:0 themes/govsync /opt/keycloak/themes/govsync
COPY --chown=1000:0 import /opt/keycloak/data/import

RUN /opt/keycloak/bin/kc.sh build

# ---- Etapa 2: imagen final --------------------------------------------------
FROM quay.io/keycloak/keycloak:26.7
COPY --from=builder --chown=1000:0 /opt/keycloak/ /opt/keycloak/

# Keycloak oficial corre como uid 1000; se declara explícito para no depender de
# la imagen base (OWASP A05, docker:S6471). Nunca root (0).
USER 1000

# Valores NO secretos y estables. Todo lo demás (credenciales, URLs, proxy)
# se define en las variables de entorno del servicio, nunca aquí:
#   KC_DB_URL, KC_DB_USERNAME, KC_DB_PASSWORD, KC_HOSTNAME,
#   KC_PROXY_HEADERS, KC_HTTP_ENABLED,
#   KC_BOOTSTRAP_ADMIN_USERNAME, KC_BOOTSTRAP_ADMIN_PASSWORD,
#   GOVSYNC_FRONTEND_URL (placeholder del realm).
#
# Las opciones de build se repiten aquí: los ENV de la etapa 1 NO se heredan a
# la etapa 2, y si `start --optimized` no las ve, Keycloak vuelve al valor por
# defecto (comprobado: sin esto arrancaba con caché en clúster, JGroups).
#
# Memoria (plan gratis de Render: 512 MB en total para TODO el proceso).
# Medido con `docker run --memory=512m`: con los valores por defecto de
# Keycloak (heap 70 %) el proceso llegaba a 477 MiB reales, sin margen; con los
# de abajo, ~352 MiB (pico 359) tras importar el realm y atender peticiones.
#   MaxRAMPercentage=40   heap máximo ≈ 205 MB; el resto del límite queda para
#                         lo que NO es heap (metaspace, código, hilos, buffers
#                         nativos, JVM): ahí se iba la memoria, no en el heap.
#   Initial/MinRAM=20     no reservar más heap del necesario al arrancar.
#   TieredStopAtLevel=1   solo el compilador C1: menos memoria y CPU de JIT
#                         (con "poca CPU" del plan gratis conviene).
#   ReservedCodeCacheSize=48m, -Xss512k   acotan caché de código y pila de hilos.
#   KC_DB_POOL_MAX_SIZE=10  (por defecto 100) menos conexiones: la base gratis
#                         tiene un tope de conexiones que comparte con el backend.
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_CACHE=local \
    KC_HTTP_PORT=8080 \
    KC_DB_SCHEMA=keycloak \
    KC_DB_POOL_MAX_SIZE=10 \
    JAVA_OPTS_KC_HEAP="-XX:InitialRAMPercentage=20 -XX:MinRAMPercentage=20 -XX:MaxRAMPercentage=40" \
    JAVA_OPTS_APPEND="-XX:TieredStopAtLevel=1 -XX:ReservedCodeCacheSize=48m -Xss512k"

EXPOSE 8080

# `--import-realm` solo importa si el realm "govsync" NO existe (no sobrescribe).
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
