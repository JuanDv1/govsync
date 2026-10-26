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
desplegarlo, y el repositorio no tiene `vercel.json`. Se despliega aparte
mediante la integración directa de Vercel con el repositorio de GitHub.

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
