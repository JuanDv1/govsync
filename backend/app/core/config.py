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
    # JWKS (RS256). "localhost" es el valor de desarrollo (Keycloak corre
    # solo local por ahora, D23) — nunca usable en producción, igual que el
    # resto de defaults de esta sección.
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
    def _no_default_keycloak_en_produccion(cls, v: str, info):
        if info.data.get("environment") == "production" and "localhost" in v:
            raise ValueError("KEYCLOAK_ISSUER debe definirse explícitamente en producción")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
