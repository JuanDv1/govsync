# Recorrido del código (code walkthrough)

Guía para entender GovSync siguiendo el camino de una petición real, de punta a punta. Cubre
cómo está organizado el backend, cómo funciona el login con Keycloak y qué pasa cuando se carga
un archivo. No reemplaza a [DECISIONES.md](DECISIONES.md) ni a [SEGURIDAD.md](SEGURIDAD.md): los
resume y apunta al código donde viven.

## 1. Mapa general

```
Navegador (React, :5173)
   │  1. login OIDC + PKCE                     ┌──────────────────┐
   ├──────────────────────────────────────────▶│ Keycloak (:8080) │
   │  ◀── access token (JWT firmado RS256) ────┴──────────────────┘
   │
   │  2. HTTP con  Authorization: Bearer <token>
   ▼
FastAPI (:8000)  ── valida el token contra el JWKS de Keycloak ──▶ Keycloak
   │
   ▼
PostgreSQL (:5432)
```

| Pieza         | Carpeta              | Qué hace                                   |
| ------------- | -------------------- | ------------------------------------------ |
| Frontend      | `frontend/src/`      | Pantallas, login y cliente HTTP            |
| Backend       | `backend/app/`       | API, reglas de negocio y acceso a datos    |
| Keycloak      | `keycloak/`          | Identidad: usuarios, roles y tema de login |
| Base de datos | `docker-compose.yml` | Postgres 16 y Keycloak en desarrollo       |

## 2. El backend en capas

El backend es un **monolito modular**. Cada módulo (`app/modules/<modulo>/`) tiene cuatro capas
y las dependencias apuntan siempre hacia el dominio:

```
api/  ──▶  application/  ──▶  domain/  ◀──  persistence/
(HTTP)     (casos de uso)    (reglas puras)   (SQLAlchemy, Excel, JWT)
```

- **`domain/`**: Python puro. Entidades, excepciones y _puertos_ (interfaces).
- **`application/`**: casos de uso. No sabe nada de HTTP ni de FastAPI.
- **`persistence/`**: implementa los puertos del dominio (base de datos, lectores de Excel,
  verificación de tokens).
- **`api/`**: routers FastAPI. Solo traducen HTTP a llamadas al caso de uso.

Esto lo hace cumplir `backend/tests/test_arquitectura.py`. Si alguien importa SQLAlchemy desde
`domain/` o consulta la base desde un router, **el test falla**. Córrelo después de tocar
cualquier módulo.

Módulos que existen hoy: `cortes`, `ingesta`, `trazabilidad`, `identidad` y `plan_accion`.
`alertas` y `avance_fisico` son carpetas vacías reservadas para tarjetas futuras.

## 3. Punto de entrada: `app/main.py`

`crear_app()` arma la aplicación en este orden:

1. **`RequestBodyLimitMiddleware`**: corta la conexión si el cuerpo supera `max_upload_bytes`
   (25 MB). Cuenta los bytes reales, no confía en el header `Content-Length`.
2. **`CORSMiddleware`**: solo deja pasar los orígenes de `cors_origins`. Se agrega **de último**
   a propósito: en Starlette el último middleware es el más externo, y así hasta el 413 del
   paso anterior sale con cabeceras CORS.
3. **`registrar_manejadores(app)`** (`core/errores.py`): convierte excepciones de dominio en
   respuestas HTTP.
4. Los routers `cortes`, `trazabilidad` y `plan_accion`, todos bajo `/api/v1`.
5. `/health` (no toca la base de datos) y su alias `/api/v1/salud`.

## 4. Autenticación y autorización, paso a paso

Es la parte donde el equipo ha tenido problemas, así que va completa.

### 4.1 Qué hace Keycloak y qué hace el backend

El backend **nunca firma tokens ni guarda contraseñas**. Solo **valida** los tokens que emite
Keycloak. Los usuarios y sus roles viven en Keycloak.

El realm `govsync` se crea solo, la primera vez que Keycloak arranca sobre un volumen vacío, a
partir de `keycloak/import/govsync-realm.json` (`docker-compose.yml` usa `start-dev
--import-realm`). Ese archivo trae:

- Clientes `govsync-frontend` (público, PKCE `S256`) y `govsync-backend`.
- Un _audience mapper_ en cada uno que agrega `govsync-backend` al `aud` del access token.
- Los roles `administrador`, `gestor` y `visitante`.
- Tres usuarios de prueba (`administrador.prueba`, `gestor.prueba`, `visitante.prueba`), todos
  con contraseña `GovSync2026!`.

> **Trampa conocida:** si el volumen `datos_keycloak` ya tenía un realm `govsync`, Keycloak
> **no lo reimporta ni lo sobrescribe**. Quien tenga un volumen anterior a esos cambios debe
> hacer `git pull`, `docker compose down`, `docker volume rm <volumen_keycloak>` y
> `docker compose up -d`.

### 4.2 Lado frontend (`frontend/src/auth/ProveedorAutenticacion.jsx`)

1. Al montar la app, `keycloak.init({ onLoad: "check-sso", pkceMethod: "S256", ... })` revisa
   en un iframe oculto (`public/silent-check-sso.html`) si ya hay sesión activa. Por eso
   recargar la página no pierde el login.
2. `establecerProveedorToken(() => keycloak.token)` le dice a `api/cliente.js` de dónde sacar el
   token. Desde ahí **cada** petición HTTP lleva `Authorization: Bearer <token>`.
3. `onTokenExpired` renueva el token con `updateToken(30)`.
4. `useAutenticacion()` expone `usuario`, `estaAutenticado`, `puedeEscribir`, `iniciarSesion` y
   `cerrarSesion`. `puedeEscribir` es verdadero para `administrador` y `gestor`.
5. En `App.jsx`, `RutaProtegida` envuelve todas las rutas menos `/login`. Mientras
   `cargando` muestra "Verificando sesión…", y sin sesión redirige a `/login`.

Ocultar botones según `puedeEscribir` es **solo cosmética**. La seguridad real la impone el
backend.

### 4.3 Lado backend (`core/dependencias.py` y `identidad/persistence/keycloak.py`)

Cuando llega una petición protegida:

```
Authorization: Bearer <jwt>
        │
        ▼
obtener_usuario_actual()                       (core/dependencias.py)
   ├─ ¿falta el header?  → CredencialesInvalidas  → 401
   ├─ verificador.verificar(token)              (VerificadorTokenKeycloak)
   │     ├─ baja el JWKS de Keycloak (cacheado 5 min por PyJWKClient)
   │     ├─ jwt.decode: firma RS256 + issuer + audience
   │     │     └─ cualquier fallo de PyJWT → CredencialesInvalidas → 401
   │     ├─ exige claims `sub` y `email`
   │     └─ arma Usuario(id, correo, roles) con realm_access.roles
   └─ ¿el usuario no tiene ningún rol? → PermisoInsuficiente → 403
        │
        ▼
exigir_roles(Rol.ADMINISTRADOR, Rol.GESTOR)     (solo en endpoints de escritura)
   └─ ¿tiene al menos uno de esos roles? si no → PermisoInsuficiente → 403
```

Puntos que conviene recordar:

- **`audience` es obligatorio** (`keycloak_audience = "govsync-backend"`). Sin validarlo, un
  token de _otra_ aplicación del mismo realm sería aceptado.
- **El `issuer` debe coincidir exactamente** con `keycloak_issuer`
  (`http://localhost:8080/realms/govsync` por defecto).
- `obtener_verificador_token()` usa `@lru_cache` para reutilizar un único `PyJWKClient` y su
  caché de llaves. Sin eso se golpearía a Keycloak en cada request.
- **Todos los fallos de PyJWT se convierten en `credenciales_invalidas`**, incluido que el
  backend no pueda alcanzar Keycloak para bajar las llaves. Por eso "token no es válido o
  expiró" puede significar cosas muy distintas. Ver la sección 7.
- Lecturas: cualquier rol autenticado (`UsuarioActualDep`). Escrituras en `cortes` y
  `trazabilidad`: `administrador` o `gestor` (D24 en `DECISIONES.md`).

### 4.4 Cómo se traducen los errores

`core/errores.py` es el **único** lugar que conoce el mapa de excepción a HTTP:

| Excepción (`shared/errors.py`)             | HTTP                                           |
| ------------------------------------------ | ---------------------------------------------- |
| `CredencialesInvalidas`                    | 401                                            |
| `PermisoInsuficiente`                      | 403                                            |
| `OperacionNoPermitida`                     | 409                                            |
| `RecursoNoEncontrado`                      | 404                                            |
| `ReglaDeNegocioViolada`, `ArchivoInvalido` | 422                                            |
| cualquier otra                             | 500 genérico, sin trazas; el detalle va al log |

La respuesta siempre tiene la forma `{codigo, mensaje, detalles}`. El frontend la guarda en
`ErrorApi` (`api/cliente.js`) y por eso puede mostrar "Código: credenciales_invalidas".

## 5. Recorrido de un caso real: cargar un archivo a un corte

1. **Frontend**: `CargaDeArchivo.jsx` llama a `api.cargarArchivo(corteId, tipo, archivo)`
   (`api/cliente.js`), que hace `POST` multipart con el token.
2. **Router** (`cortes/api/router.py`, `cargar_archivo`): pide `ServicioCortesDep` y
   `exigir_roles(administrador, gestor)`. Revisa `Content-Length` y entrega bytes y nombre al
   servicio.
3. **Composición** (`core/dependencias.py::obtener_servicio_cortes`): arma `ServicioCortes` con
   los repositorios SQL, `sesion.commit` / `sesion.rollback` y los lectores de Excel
   disponibles (PDT, EJECUCION, PROYECTOS).
4. **Caso de uso** (`cortes/application/casos_uso.py::ServicioCortes.cargar_archivo`): aplica
   las reglas **[SEC-03]**: solo `.xlsx`, tamaño comprobado antes de leer en memoria, nombre
   sanitizado contra _path traversal_, `.xlsm` rechazado y pestañas requeridas validadas. Luego
   `_extraer_y_transformar` y `_cargar_y_registrar`.
5. **Persistencia**: el lector (`ingesta/persistence/lectores/*`) lee el Excel con pandas
   (pandas/openpyxl **solo** pueden usarse dentro de `persistence/`) y los repositorios SQL
   guardan.
6. **Todo o nada**: un archivo inválido se rechaza completo. Si algo falla se hace `rollback`;
   nunca queda un corte con datos parciales.
7. **Respuesta**: el router arma el DTO con `response_model` y el frontend actualiza la UI.

### La llave que une las fuentes

`app/shared/codigos.py::CodigoIndicadorProducto` es el código de **9 dígitos** que cruza las
cuatro fuentes. **Siempre texto, nunca entero**: códigos reales como `040110500` empiezan con
cero y un `int` lo perdería.

## 6. Otros módulos en una línea

- **`cortes`**: el agregado central (`Corte`, estados `BORRADOR` y `REGISTRADO`, archivos
  fuente, historial de reemplazos). Todo lo demás cuelga de un corte.
- **`ingesta`**: lectores y transformadores de los tres Excel. Su forma real está en
  `docs/DATOS.md`.
- **`trazabilidad`**: la matriz de cruce entre indicadores, ejecución presupuestal y proyectos
  BPIN (`/matriz`). Exige que las tres fuentes estén cargadas.
- **`plan_accion`**: plan de acción consolidado, con filtros y exportación a Excel.
- **`identidad`**: `Rol`, `Usuario` y el puerto `VerificadorToken` (dominio), más su adaptador
  de Keycloak.

## 7. Diagnóstico rápido de `credenciales_invalidas`

| Síntoma                                       | Causa probable                                                          | Qué hacer                                     |
| --------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| Todos los usuarios fallan tras un `git pull`  | Volumen de Keycloak anterior al import: no tiene el mapper de audiencia | Borrar el volumen de Keycloak y reiniciar     |
| `persona1` u otro usuario creado a mano falla | Realm viejo o creado manualmente, sin mapper                            | Usar los usuarios `*.prueba` tras reimportar  |
| Fallaba y, al levantar Docker, se arregla     | El backend no alcanzó el JWKS de Keycloak                               | Verificar que Keycloak esté arriba en `:8080` |
| Falla solo en un entorno                      | `KEYCLOAK_ISSUER` o `KEYCLOAK_AUDIENCE` distintos                       | Comparar con `backend/.env.example`           |
| Login en Keycloak OK pero la API da 401       | Token sin `aud=govsync-backend`                                         | Revisar mappers de los clientes en el realm   |

Para ver qué trae un token, decodificar el payload del JWT (por ejemplo en jwt.io, con un token
de desarrollo) y revisar `iss`, `aud`, `exp`, `email` y `realm_access.roles`.

## 8. Dónde mirar según lo que quieras cambiar

| Quiero…                                | Archivo                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Agregar un endpoint                    | `modules/<modulo>/api/router.py` con `response_model`, `summary` y `responses`       |
| Agregar una regla de negocio           | `modules/<modulo>/domain/` y el caso de uso en `application/`                        |
| Cambiar qué rol puede hacer qué        | `exigir_roles(...)` en el router y `ROLES_ESCRITURA` en `ProveedorAutenticacion.jsx` |
| Agregar un usuario o rol de prueba     | `keycloak/import/govsync-realm.json` (solo aplica en un volumen nuevo)               |
| Cambiar un error HTTP                  | `core/errores.py`                                                                    |
| Agregar una dependencia Python         | `requirements.in`, luego `uv pip compile` (nunca editar `requirements.txt` a mano)   |
| Comprobar que no rompí la arquitectura | `pytest tests/test_arquitectura.py`                                                  |
