"""Configuración central de GovSync.

Capa: núcleo transversal. No contiene reglas de negocio.
Todos los secretos se leen de variables de entorno; ninguno tiene un valor
por defecto utilizable en producción (ver validación de `keycloak_issuer`).
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"

    # Obligatoria, sin valor por defecto: una credencial literal en el código
    # es un secreto versionado. En local viene de `.env` (ver `.env.example`),
    # en pruebas de `tests/conftest.py` y en Render de sus variables de entorno.
    database_url: str

    # --- Seguridad (Keycloak, [HU-E01-01] / D23) --------------------------
    # El backend no firma tokens: valida los que emite Keycloak contra su
    # JWKS (RS256). "localhost" es el valor de desarrollo (el Keycloak de
    # docker-compose.yml). En producción Keycloak corre en Render (D39,
    # docs/DESPLIEGUE.md) y el valor debe ser su URL pública https; el valor
    # local nunca es usable allí, igual que el resto de defaults de esta sección.
    keycloak_issuer: str = "http://localhost:8080/realms/govsync"
    keycloak_audience: str = "govsync-backend"

    # --- CORS ------------------------------------------------------------
    cors_origins: str = "http://localhost:5173"

    # --- Carga de archivos (OWASP: límites explícitos) -------------------
    max_upload_bytes: int = 25 * 1024 * 1024  # 25 MB
    # Solo .xlsx. La tarjeta [SEC-03] exige "rechazo de libros con macros
    # (.xlsm)": un .xlsm puede traer VBA, y aunque openpyxl no lo ejecute, el
    # archivo queda almacenado y puede abrirlo un humano después.
    allowed_upload_suffixes: str = ".xlsx"

    # Documentación interactiva (/docs, /redoc, /openapi.json). Sin token, expone
    # el mapa completo de la API (rutas, parámetros, esquemas). En producción
    # queda apagada salvo que se active expresamente; en local y en pruebas
    # sigue disponible.
    docs_api_en_produccion: bool = False

    # --- Rutas públicas sin token (D38) ----------------------------------
    # Límite de peticiones por cliente para el prefijo /api/v1/publico. Es en
    # memoria y POR PROCESO (con N procesos el tope real es N veces mayor).
    publico_limite_peticiones: int = Field(default=60, ge=1)
    publico_ventana_segundos: int = Field(default=60, ge=1)
    # Cuántos proxies de confianza hay delante de la app. 0 = se usa la IP del
    # socket; N = se toma la entrada N contando desde la DERECHA de
    # X-Forwarded-For (la que agregó el proxy de confianza más cercano a la
    # app que ve al cliente). Nunca se confía en más entradas que estas.
    publico_proxies_confiables: int = Field(default=0, ge=0, le=10)
    # Tope de clientes distintos que el límite recuerda a la vez (memoria acotada).
    publico_max_clientes: int = Field(default=10_000, ge=100)

    # NOTA: la gestión de usuarios (altas, roles) vive en Keycloak, no aquí
    # ([HU-E01-01] / D23) — por eso no hay `seed_admin_email` ni
    # `seed_admin_password`: esa cuenta semilla se crea en el realm de
    # Keycloak, no en esta configuración.
    #
    # Cuidado con el dominio del correo si se crea esa cuenta en Keycloak:
    # RFC 2606 reserva `.local`/`.test`/`.example`/`.invalid` — cualquier
    # validación de correo basada en `email-validator` (la usa Pydantic vía
    # EmailStr) los rechaza.

    municipio_codigo_dane: str = Field(default="19701", description="Santa Rosa, Cauca")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_suffixes(self) -> set[str]:
        return {s.strip().lower() for s in self.allowed_upload_suffixes.split(",") if s.strip()}

    @field_validator("keycloak_issuer")
    @classmethod
    def _validar_issuer_de_keycloak(cls, v: str, info):
        # PyJWT compara `iss` por igualdad exacta y arma la URL del JWKS con
        # `{issuer}/protocol/...`: una barra final haría fallar TODOS los tokens
        # (401) y dejaría `//` en la URL. Se normaliza en cualquier entorno.
        v = v.strip().rstrip("/")
        if info.data.get("environment") == "production":
            if "localhost" in v:
                raise ValueError("KEYCLOAK_ISSUER debe definirse explícitamente en producción")
            if not v.startswith("https://"):
                raise ValueError(
                    "KEYCLOAK_ISSUER debe empezar por https:// en producción "
                    "(la URL pública de Keycloak, igual a KC_HOSTNAME + /realms/<realm>)"
                )
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
