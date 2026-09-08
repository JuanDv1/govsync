# Seguridad — checklist OWASP y específico de GovSync

Checklist a completar a medida que se implementa cada tarjeta con superficie
de seguridad. No marcar "Verificado" sin una prueba o evidencia concreta —
ocultar una opción en el frontend no cuenta como verificación (regla del
proyecto).

## Tabla 4 de la rúbrica — OWASP Top 10

| Verificación                | Estado          | Evidencia / tarjeta responsable                                                                                                                                                                                  |
| --------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL Injection               | Pendiente       | El acceso a datos pasa por SQLAlchemy con parámetros (no SQL crudo concatenado) — confirmar en `[BD-02]`, `[HU-07][BE-01]`                                                                                       |
| XSS (Cross-Site Scripting)  | Pendiente       | React escapa por defecto; verificar que ningún componente use `dangerouslySetInnerHTML` con datos de usuario                                                                                                     |
| CSRF                        | N/A por ahora   | La API es stateless (Bearer JWT, no cookies de sesión) — CSRF aplica a autenticación basada en cookies, que no existe en Sprint 1 (ver `docs/DECISIONES.md`, D2). Revisar de nuevo si Sprint 2 introduce cookies |
| Autenticación               | N/A este sprint | Diferida a Sprint 2 — ver `docs/DECISIONES.md`, D2                                                                                                                                                               |
| Autorización                | N/A este sprint | Diferida a Sprint 2 — ver `docs/DECISIONES.md`, D2                                                                                                                                                               |
| Datos sensibles encriptados | Pendiente       | Verificar TLS en despliegue (`[DEV-07]`) y que no haya secretos ni datos personales en logs                                                                                                                      |

## Específico de GovSync — validación de archivos cargados (`[SEC-03]`)

La superficie de ataque real de este sprint no es login (que no existe
todavía) sino la carga de archivos Excel. Checklist de `[SEC-03]`:

- [ ] Extensión declarada vs. tipo MIME real del contenido (no confiar en la
      extensión del nombre de archivo)
- [ ] Tamaño máximo verificado **antes** de leer el archivo completo en
      memoria (evitar que una carga de varios GB se lea entera antes de
      rechazarse)
- [ ] Sanitización del nombre de archivo (rechazar path traversal, ej.
      `../../etc/passwd`)
- [ ] Rechazo explícito de libros con macros (`.xlsm`)
- [ ] Verificación de que las hojas obligatorias existen antes de procesar
      (no leer estructuras parciales)
- [ ] Los mensajes de error no exponen rutas internas del servidor ni trazas
      completas de excepción al cliente

## Manejo de secretos

- [ ] Ningún archivo `.env` real llegó al repositorio (`[SEC-02]`) — verificar
      con `git log --all --full-history -- "**/.env"` antes de cada entrega
- [ ] Variables de entorno documentadas en `.env.example` sin valores reales
- [ ] `SONAR_TOKEN` y credenciales de despliegue viven en GitHub Secrets, no
      en el código ni en `docker-compose.yml`

## Exposición de errores internos

- [ ] Las excepciones de dominio (`app/shared/errors.py`) llegan al cliente
      como mensajes de negocio (ej. "falta el archivo de ejecución"), nunca
      como traceback de Python ni detalle de SQLAlchemy

## CORS

- [ ] CORS restringido al dominio real del frontend desplegado, no `*`
      (tarjeta `[DEV-07]`)

---

**Cómo se llena:** cada tarjeta que toque una de estas filas debe, al
cerrarse, actualizar el Estado y dejar el enlace al PR o a la prueba que lo
demuestra. Antes del cierre del Sprint 1, esta tabla debe copiarse (ya
resuelta) a la Tabla 4 del documento de entrega, tal como pide
`PlantillaSprint1.md` §4.3.
