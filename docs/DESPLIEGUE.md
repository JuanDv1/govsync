# Despliegue — GovSync

## Flujo automático de despliegue del backend

Cada push a `main` (en la práctica, la fusión del PR `develop` → `main`)
dispara `.github/workflows/ci.yml` en este orden:

1. `backend-calidad` (lint, formato y pruebas) y `backend-migraciones`
   (ida y vuelta de Alembic contra un Postgres desechable) corren en
   paralelo.
2. Si ambos pasan, `migrate-render` aplica `alembic upgrade head` contra
   la base de datos de Render y, **solo después**, llama al Deploy Hook de
   Render para desplegar el Web Service. Así el código nuevo nunca arranca
   antes de que su migración esté aplicada.

Secrets de GitHub Actions requeridos (Settings → Secrets and variables →
Actions):

| Secret                | Contenido                                                           |
| --------------------- | ------------------------------------------------------------------- |
| `RENDER_DATABASE_URL` | External Database URL de Render con prefijo `postgresql+psycopg://` |
| `RENDER_DEPLOY_HOOK`  | URL del Deploy Hook del Web Service (Settings → Deploy Hook)        |

Ambos son secretos: quien tenga la URL del hook puede desplegar. Nunca se
escriben en archivos del repo ni se imprimen en los logs del job.

En Render, el Web Service debe tener **Auto-Deploy = Off**: el Deploy Hook
del CI es el único disparador. Si Auto-Deploy quedara encendido, Render
desplegaría en paralelo con la migración.

**Despliegue manual** (si el job falla después de migrar o hay que
redesplegar sin cambios): dashboard de Render → Web Service → **Manual
Deploy** → _Deploy latest commit_. Si además hay una migración pendiente,
aplicarla antes siguiendo la sección siguiente.

## Despliegue del frontend (Vercel)

El frontend no pasa por `ci.yml`: no hay workflow de GitHub Actions para
desplegarlo. Se despliega aparte mediante la integración directa de Vercel con
el repositorio de GitHub. `frontend/vercel.json` solo define el fallback de SPA
(ver "Keycloak en Render" para las variables de Vercel).

Verificable desde este repositorio:

- La plantilla de PR (`.github/pull_request_template.md`) incluye "Revisé el
  preview deploy de Vercel (link en los checks del PR)" — confirma que Vercel
  está integrado con el repositorio y publica un preview por PR.
- El build de producción es `npm run build` (Vite) y el cliente HTTP lee la
  URL del backend de `import.meta.env.VITE_API_URL`
  (`frontend/src/api/cliente.js`) — esa variable debe existir en el entorno
  de Vercel con la URL del backend en Render.
- El frontend vive en `frontend/`, no en la raíz del repositorio.

**[CONFIRMAR]** (no verificable desde el repositorio, depende de la
configuración del proyecto en el dashboard de Vercel):

- Root Directory del proyecto de Vercel (`frontend/`).
- Qué rama dispara el deploy de producción (`main`, `develop` u otra) y si el
  resto generan solo previews.
- Valor real de `VITE_API_URL` configurado por entorno (producción/preview).
- Dominio del deploy de producción.

## Plan B: migraciones manuales contra la base de datos real de Render

El camino normal es el flujo automático de la sección anterior: el job
`migrate-render` aplica las migraciones y luego despliega. Este
procedimiento manual queda **solo** para cuando ese job falla o para una
corrección puntual fuera del flujo de `main`.

**Caso especial — el paso del Deploy Hook falló después de migrar:** el
esquema de la base ya quedó migrado pero el código desplegado sigue siendo
el anterior. No hay que repetir la migración: hacer de inmediato **Manual
Deploy** en Render (Web Service → Manual Deploy → _Deploy latest commit_)
para que el código alcance al esquema.

El `Start Command` de Render NO encadena `alembic upgrade head`; solo
levanta `uvicorn` — decisión explícita de `[DEV-07]`: una migración con
error no debe tumbar el Web Service en producción sin aviso previo. Por
eso la migración vive en el CI (o en este procedimiento), nunca en el
arranque del servicio. Pasos:

### 1. Conseguir la URL externa de la base de datos

En el dashboard de Render, la base de datos Postgres → pestaña **Connect**
→ **External Database URL** (no la "Internal Database URL": esa solo es
alcanzable desde dentro de la red de Render, no desde tu máquina).

### 2. Corregir el prefijo del driver

La URL que Render genera viene como `postgresql://...`. El proyecto usa
`psycopg3` (`backend/requirements.txt`, ver también
`backend/.env.example`), así que hay que agregar `+psycopg` a mano:

```
postgresql://usuario:clave@host/basededatos          ← como la da Render
postgresql+psycopg://usuario:clave@host/basededatos  ← lo que hay que usar
```

### 3. Pasarla como variable de entorno temporal — nunca guardarla en archivo

```bash
cd backend
DATABASE_URL="postgresql+psycopg://usuario:clave@host/basededatos" \
  alembic upgrade head
```

En PowerShell:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://usuario:clave@host/basededatos"
alembic upgrade head
Remove-Item Env:DATABASE_URL
```

**No la pegues en `.env`, ni en ningún archivo del repo, ni en un script
que quede guardado.** Es la contraseña real de la base de datos de
producción — mismo principio que `docs/SEGURIDAD.md` (§Manejo de
secretos): vive en la sesión de terminal, nada más, y solo mientras dura
el comando.

### 4. Nunca repetir esto sobre una base con datos reales sin respaldo previo

Antes de correr `alembic upgrade head` (o `downgrade`) contra la base de
Render una vez ya tenga datos reales de la clienta cargados: **tomar un
respaldo primero** (Render permite backups manuales desde el dashboard de
la base de datos, o `pg_dump` contra la External Database URL). Una
migración mal escrita contra una base vacía es un problema de desarrollo;
la misma migración contra datos reales sin respaldo es una pérdida de
información irreversible.

El job automático `migrate-render` (`ci.yml`) NO hace respaldo antes de
migrar — riesgo aceptado conscientemente dado el volumen de datos
actual. Si una futura migración borra o transforma datos de forma
irreversible, quien la escriba es responsable de respaldar manualmente
ANTES de fusionar a `main`, no confiar en el job automático para eso.

Antes de aprobar un PR que modifique una migración de forma
destructiva (`DROP COLUMN`, `ALTER TYPE` que pueda truncar datos,
`DELETE`), quien revisa debe exigir evidencia de un respaldo manual
reciente en la descripción del PR — el job automático no lo hace por
ustedes.

## Keycloak en Render

Keycloak (D23: autentica a todos los usuarios; el backend solo valida sus
tokens) corre en producción como un **Web Service Docker** de Render,
construido desde [`keycloak/Dockerfile`](../keycloak/Dockerfile). Usa la
**misma base de datos gratis de Render que el backend**, en un esquema aparte
(`keycloak`): el plan gratis solo permite una base por cuenta.

> Lo verificado con la imagen en local está dicho como tal; lo que depende de
> los paneles de Render o Vercel y no se pudo comprobar desde el repositorio
> está marcado **[CONFIRMAR]**.

### Cómo es la imagen

- Base `quay.io/keycloak/keycloak:26.7` (la misma versión que
  `docker-compose.yml`; subirla en los dos archivos a la vez).
- Copia dentro de la imagen el tema `keycloak/themes/govsync` y el realm
  `keycloak/import/govsync-realm.json` (Render no permite montar carpetas).
- `kc.sh build` con Postgres, health y caché local (una sola instancia, sin
  clúster); arranca con `start --optimized --import-realm`.
- `--import-realm` **solo importa si el realm `govsync` no existe**: nunca
  sobrescribe cambios hechos en la consola.
- El realm usa `${GOVSYNC_FRONTEND_URL:http://localhost:5173}` en
  `redirectUris`, `webOrigins` y `post.logout.redirect.uris`. Sin la variable
  queda el valor local (así `docker-compose.yml` sigue igual); en Render se
  define con la URL de Vercel. Si en Render se olvida, el realm queda apuntando
  a `localhost` (ver "Si la URL de Vercel estaba mal").
- **Memoria (512 MB):** por defecto Keycloak reserva el 70 % del límite para el
  heap y llegó a 477 MiB reales en la prueba local. La imagen limita el heap al
  40 % (≈205 MB), usa solo el compilador C1 y acota caché de código, pilas y
  conexiones (`KC_DB_POOL_MAX_SIZE=10`): medido ≈353 MiB (pico 360) con
  `--memory=512m`, tras importar el realm y atender ~50 peticiones. El porqué de
  cada valor está comentado en el Dockerfile.

### Orden de arranque (importa: el realm se importa UNA sola vez)

1. Crear el proyecto de Vercel y conocer su URL de producción (el realm la
   necesita en su primer arranque).
2. Crear la base de datos y el esquema `keycloak`.
3. Crear el Web Service de Keycloak y esperar a que esté _Live_.
4. Anotar su URL y configurar con ella el backend (`KEYCLOAK_ISSUER`) y Vercel
   (`VITE_KEYCLOAK_URL`).
5. Verificar que la clave pública de los usuarios de prueba no sirve (ver más abajo).

### Paso a paso en los paneles de Render

**1. Base de datos (si aún no existe).** Dashboard → New → PostgreSQL → plan
Free. Es la misma que usa el backend (`RENDER_DATABASE_URL`).

**2. Esquema `keycloak`.** Keycloak no lo crea por sí mismo (si se olvida, el servicio no llega a _Live_ y el
log se queja de que el esquema no existe: crearlo y reiniciar). Con la _External
Database URL_ (dashboard de la base → Connect), desde tu máquina:

```bash
psql "<External Database URL>" -c "CREATE SCHEMA IF NOT EXISTS keycloak;"
```

(No la guardes en archivos; mismo criterio de la sección "Plan B".) Keycloak
crea y usa sus tablas solo dentro de `keycloak`; las del backend siguen en
`public`.

**3. Web Service.** New → Web Service → conectar el repositorio.

| Campo             | Valor                                       |
| ----------------- | ------------------------------------------- |
| Language          | Docker                                      |
| Branch            | la que se despliega a producción            |
| Root Directory    | `keycloak`                                  |
| Dockerfile Path   | `./Dockerfile` (relativo al Root Directory) |
| Instance Type     | Free (512 MB)                               |
| Health Check Path | `/realms/govsync`                           |

**Health Check Path:** Keycloak 26 sirve `/health/ready` en el puerto de gestión
**9000** (comprobado: en el 8080 da 404), y Render solo mira el puerto público.
Por eso se usa `/realms/govsync`, que en el 8080 responde 200 cuando el realm
ya está importado y el servidor listo.

**4. Variables de entorno del servicio de Keycloak.**

| Variable                      | Valor                                                                      |
| ----------------------------- | -------------------------------------------------------------------------- |
| `KC_DB_URL`                   | `jdbc:postgresql://<host interno>:5432/<base>` (host de la _Internal_ URL) |
| `KC_DB_USERNAME`              | usuario de la base                                                         |
| `KC_DB_PASSWORD`              | contraseña de la base (**secret**)                                         |
| `KC_DB_SCHEMA`                | `keycloak` (ya es el valor de la imagen; se deja explícito)                |
| `KC_HOSTNAME`                 | URL pública con https, p. ej. `https://govsync-keycloak.onrender.com`      |
| `KC_PROXY_HEADERS`            | `xforwarded` (Render termina el TLS y manda `X-Forwarded-*`)               |
| `KC_HTTP_ENABLED`             | `true` (el proxy de Render habla HTTP con el contenedor)                   |
| `KC_HTTP_PORT`                | `8080` (ya es el valor de la imagen)                                       |
| `KC_BOOTSTRAP_ADMIN_USERNAME` | usuario administrador de Keycloak (no `admin`)                             |
| `KC_BOOTSTRAP_ADMIN_PASSWORD` | contraseña larga y única (**secret**), NUNCA la de local (`admin`)         |
| `GOVSYNC_CLAVE_ADMINISTRADOR` | contraseña de `administrador.prueba` (**secret, obligatoria**)             |
| `GOVSYNC_CLAVE_GESTOR`        | contraseña de `gestor.prueba` (**secret, obligatoria**)                    |
| `GOVSYNC_CLAVE_VISITANTE`     | contraseña de `visitante.prueba` (**secret, obligatoria**)                 |
| `GOVSYNC_FRONTEND_URL`        | URL de Vercel **sin barra final**, p. ej. `https://govsync.vercel.app`     |

Auto-Deploy: cada push a la rama reconstruye y reinicia Keycloak; es inocuo
para los datos (el import no sobrescribe) pero corta el login unos minutos.
Dejarlo en **Off** antes de una demo.

Notas:

- Las 3 `GOVSYNC_CLAVE_*` y `KC_BOOTSTRAP_ADMIN_PASSWORD` son secretos del
  panel de Render: nunca van en el repo ni en los logs.
- La _Internal Database URL_ de Render es `postgresql://usuario:clave@host/base`;
  para `KC_DB_URL` se arma en formato JDBC y usuario y clave van **separados**
  en `KC_DB_USERNAME`/`KC_DB_PASSWORD`. **[CONFIRMAR]** el host y el puerto
  exactos en el panel.
- `KC_PROXY_HEADERS=xforwarded` solo es seguro detrás de un proxy que
  **sobrescribe** esas cabeceras (la documentación de Keycloak lo exige; Render
  lo hace, **[CONFIRMAR]**). Por eso no está fijado en la imagen: nadie debería
  ejecutarla expuesta con esa confianza.
- `KC_HOSTNAME` define el `issuer` de los tokens: tiene que ser exactamente la
  URL pública, y es la que el backend compara.
- `KC_BOOTSTRAP_ADMIN_*` solo se usan al crear el realm `master` (primer
  arranque). Es el administrador de TODO Keycloak.

**5. Verificar.** Con el servicio _Live_:

```bash
curl -s https://<keycloak>/realms/govsync/.well-known/openid-configuration | grep -o '"issuer":"[^"]*"'
# → "issuer":"https://<keycloak>/realms/govsync"
```

La pantalla de login debe verse en español y con la marca de GovSync.

### Si la URL de Vercel estaba mal en el primer arranque

El import no se repite. Dos salidas: (a) corregirla en la consola de Keycloak
(Clients → `govsync-frontend` → _Valid redirect URIs_, _Web origins_ y _Valid
post logout redirect URIs_), o (b) si aún no hay nada que perder, borrar el
esquema (`DROP SCHEMA keycloak CASCADE; CREATE SCHEMA keycloak;`) y reiniciar el
servicio: se reimporta con la variable corregida. **Nunca** poner `*` como
redirect URI.

### Usuarios de prueba y administrador: contraseñas por variable (decisión del PO)

El realm trae 3 usuarios de prueba (`administrador.prueba`, `gestor.prueba`,
`visitante.prueba`). Su contraseña NO está escrita en el realm: sale de
`${GOVSYNC_CLAVE_ADMINISTRADOR:...}`, `${GOVSYNC_CLAVE_GESTOR:...}` y
`${GOVSYNC_CLAVE_VISITANTE:...}`. Sin la variable queda la clave local de
desarrollo (`GovSync2026!`, que es **pública porque está en el repositorio**);
con ella, Keycloak usa la de la variable y la clave local deja de servir
(comprobado en la imagen: con las 3 variables definidas cada usuario inicia
sesión con la suya y `GovSync2026!` es rechazada).

**Las 3 variables son OBLIGATORIAS en Render.** Si se omite una, ese usuario
queda con la clave pública y el servicio arranca igual, sin ningún aviso. Por eso:

1. Definir las 3 variables (**secret**, largas y distintas entre sí) ANTES del
   primer arranque, y no reutilizar la clave local.
2. Tras el primer arranque, comprobar que la clave pública no sirve (login de
   `administrador.prueba` con `GovSync2026!` debe fallar).
3. Realm **master**: `KC_BOOTSTRAP_ADMIN_PASSWORD` debe ser una contraseña
   fuerte puesta por variable, nunca la de local. Solo se usa al crear el realm
   `master`; cambiarla después en la consola (Users → administrador →
   Credentials) no la cambia en el panel, y viceversa.

El import ocurre una sola vez: cambiar luego una variable de clave NO cambia la
contraseña ya guardada (hay que cambiarla en la consola: Realm **govsync** →
Users → usuario → Credentials → _Reset password_, **Temporary = Off**). Lo mismo
al renovar la base: con el esquema vacío se reimporta y vuelven a leerse las
variables, que deben seguir definidas.

**Riesgo aceptado (H3): la consola `/admin` queda pública** en la misma URL que
el login. La única barrera es la contraseña del administrador de `master` (y que
el realm `master` no trae por sí solo bloqueo por intentos: **[CONFIRMAR]**).
Por eso esa contraseña debe ser fuerte y única. Mitigaciones posibles, no
aplicadas: `KC_HOSTNAME_ADMIN` en otra URL o un proxy delante.

### Variables nuevas del backend (Web Service del backend)

| Variable                     | Valor                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `ENVIRONMENT`                | `production`                                                                                     |
| `KEYCLOAK_ISSUER`            | `https://<keycloak>/realms/govsync` — igual a `KC_HOSTNAME` + `/realms/govsync`, sin barra final |
| `KEYCLOAK_AUDIENCE`          | `govsync-backend` (ya es el valor por defecto)                                                   |
| `CORS_ORIGINS`               | la URL de Vercel, p. ej. `https://govsync.vercel.app` (sin `*`)                                  |
| `PUBLICO_PROXIES_CONFIABLES` | `1` (un solo proxy, el de Render, delante de la app; ver `.env.example`)                         |

El backend se niega a arrancar en producción si `KEYCLOAK_ISSUER` contiene
`localhost`. Además descarga las claves de
`{issuer}/protocol/openid-connect/certs`, así que **el backend tiene que poder
alcanzar Keycloak por su URL pública**. Si el `issuer` difiere en una letra de
`KC_HOSTNAME` (esquema, mayúsculas, barra final), TODOS los tokens se rechazan
con `401 credenciales_invalidas` (comprobado en local: un issuer distinto se
rechaza).

### Variables de Vercel (Project → Settings → Environment Variables)

| Variable                  | Valor                                                             |
| ------------------------- | ----------------------------------------------------------------- |
| `VITE_API_URL`            | URL del backend en Render                                         |
| `VITE_KEYCLOAK_URL`       | URL pública de Keycloak (`https://<keycloak>`, sin `/realms/...`) |
| `VITE_KEYCLOAK_REALM`     | `govsync`                                                         |
| `VITE_KEYCLOAK_CLIENT_ID` | `govsync-frontend`                                                |

Son variables de **build** (Vite las incrusta): tras cambiarlas hay que
redesplegar. Las previews de Vercel tienen otra URL y **no** están en las
redirect URIs del realm: el login solo funciona en el dominio de producción.

`frontend/vercel.json` reescribe toda ruta a `/index.html` (SPA), para que
recargar `/cortes` o `/publico/plan-accion` no dé 404. Vercel sirve primero los
archivos que existen (`silent-check-sso.html`, `/assets/*`) y aplica la
reescritura solo a lo demás (comportamiento documentado de Vercel; **[CONFIRMAR]**
con un deploy real).

### Renovar la base gratis cuando vence

La base gratis de Render expira y se borra. Como Keycloak **y** el backend viven
en ella, caduca todo a la vez (usuarios, contraseñas cambiadas y Excel cargados).

1. Si hay datos que conservar, `pg_dump` antes de que expire (incluye los
   esquemas `public` y `keycloak`; la URL solo en la sesión, nunca en un archivo):
   `pg_dump --no-owner -Fc "<External Database URL>" -f respaldo.dump`.
   **[CONFIRMAR]** en el panel la fecha exacta de vencimiento.
2. Crear una base gratis nueva y su esquema `keycloak` (paso 2).
3. Actualizar el secret `RENDER_DATABASE_URL` de GitHub Actions (con prefijo
   `postgresql+psycopg://`) y la variable `DATABASE_URL` del Web Service del
   backend.
4. Actualizar `KC_DB_URL`, `KC_DB_USERNAME` y `KC_DB_PASSWORD` del servicio de
   Keycloak y reiniciarlo: con el esquema vacío **reimporta el realm**, con los
   usuarios de prueba leyendo de nuevo las variables `GOVSYNC_CLAVE_*` (deben
   seguir definidas) y recrea el administrador `master` con
   `KC_BOOTSTRAP_ADMIN_PASSWORD`.
5. Migrar el backend: `alembic upgrade head` (ver "Plan B") o un push a `main`.
6. Volver a cargar los Excel (los cortes viven en esa base).

### Límites del plan gratis

- Cada Web Service **se duerme tras 15 min sin tráfico**; despertarlo tarda
  alrededor de un minuto (en Keycloak, más: JVM, conexión a la base).
- El backend valida tokens consultando a Keycloak: con Keycloak dormido, el
  primer login o la primera petición puede fallar o tardar. **Antes de una demo,
  despertar ambos** con unos minutos de anticipación:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<keycloak>/realms/govsync
curl -s -o /dev/null -w "%{http_code}\n" https://<backend>/health
```

Repetir hasta ver `200` y hacer un login de prueba completo.

- 512 MB de RAM y poca CPU: Keycloak entra, pero con poco margen (≈353 MiB
  medidos en local). No agregar proveedores ni subir el heap sin volver a medir.
  El arranque en frío en Render puede ser más lento que los ~25 s medidos en local.
- Una sola base gratis por cuenta, con conexiones compartidas entre Keycloak y
  el backend; por eso el pool de Keycloak se limita a 10. **[CONFIRMAR]** el tope de
  conexiones de la base gratis en el panel: Keycloak (hasta 10) + backend +
  migraciones de CI deben caber.

### Prueba local de la imagen

Desde la raíz, con el Postgres de `docker-compose.yml` arriba y el esquema creado
(`docker exec govsync-postgres psql -U govsync -d govsync -c "CREATE SCHEMA IF NOT EXISTS keycloak;"`):

```bash
docker build -t govsync-keycloak keycloak
docker run --rm --memory=512m --network govsync_default -p 8080:8080 \
  -e KC_DB_URL=jdbc:postgresql://govsync-postgres:5432/govsync \
  -e KC_DB_USERNAME=govsync -e KC_DB_PASSWORD=govsync \
  -e KC_HOSTNAME=http://localhost:8080 -e KC_HTTP_ENABLED=true \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=<clave-local> \
  govsync-keycloak
```

Pararlo antes de usar el servicio `keycloak` de `docker-compose.yml`: ambos usan
el puerto 8080.

### Pendientes conocidos (decididos NO hacer ahora)

- **Job de CI** que construya `keycloak/Dockerfile` e importe el realm: hoy solo
  lo protege `frontend/src/tema-keycloak/despliegueKeycloak.test.js` (lee el
  realm y el Dockerfile como texto) y el job `backend-keycloak` solo arranca la
  imagen oficial.
- **503 cuando Keycloak está dormido o inalcanzable:** hoy el backend responde
  401 (`credenciales_invalidas`) si no puede descargar el JWKS, y el frontend lo
  ve como sesión inválida. Distinguirlo (503) queda pendiente.
- Restringir `/admin` (ver "Riesgo aceptado (H3)").
