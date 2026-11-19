# Pruebas de carga (k6) — Plan de Acción

Entregable del Sprint 3 ("Diseño de Pruebas y Rendimiento"). Mide los
endpoints de lectura de `plan_accion` bajo carga concurrente.

## Por qué no corre automático en cada PR

Los 3 endpoints exigen un JWT real (Keycloak). El job `backend-keycloak`
del CI solo verifica que la imagen de Keycloak arranca — **no** crea
realm/cliente/usuario de prueba todavía (ver el comentario de ese job en
`.github/workflows/ci.yml`: "eso es una tarjeta siguiente"). Hasta que esa
tarjeta exista, no hay forma de conseguir un token válido dentro de un
runner de GitHub Actions sin inventar un supuesto de seguridad no
verificado. Por eso este script:

- Se ejecuta **manualmente** contra un backend ya corriendo (local o
  staging), o
- Desde el workflow `.github/workflows/perf.yml`, disparado a mano
  (`workflow_dispatch`) pasando el token como secreto de ejecución — nunca
  automático en cada push/PR.

## Uso local

```bash
# 1. Levantar el backend (local o apuntando a staging)
# 2. Obtener un JWT real iniciando sesión contra Keycloak (rol
#    administrador o visitante)
# 3. Instalar k6: https://k6.io/docs/get-started/installation/

BASE_URL=http://localhost:8000 K6_TOKEN="<jwt>" k6 run tests/perf/k6_plan_accion.js
```

Variables: `BASE_URL`, `K6_TOKEN` (obligatoria), `VUS` (default 10),
`DURATION` (default 30s).

## Pendiente para el equipo

- Crear el realm/cliente/usuario de prueba en el job `backend-keycloak`
  (la tarjeta que ese job ya señala como pendiente) es el requisito real
  para poder automatizar esto en CI contra un token válido, no inventado.
- Los umbrales de `thresholds` en el script (p95 < 1.5s/2s/3s) son un
  punto de partida razonable para una pantalla interactiva, **no** un SLA
  ratificado por el equipo — ajustar si el equipo define uno distinto.
