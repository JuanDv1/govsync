"""Configuración central de GovSync.

Capa: núcleo transversal. No contiene reglas de negocio.
Todos los secretos se leen de variables de entorno; ninguno tiene un valor
por defecto utilizable en producción (ver validación de `secret_key`).
"""
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    environment: Literal["development", "test", "production"] = "development"

    database_url: str = "postgresql+psycopg://govsync:govsync@localhost:5432/govsync"

    # --- Seguridad -------------------------------------------------------
    secret_key: str = "dev-only-insecure-key-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # --- CORS ------------------------------------------------------------
    cors_origins: str = "http://localhost:5173"

    # --- Carga de archivos (OWASP: límites explícitos) -------------------
    max_upload_bytes: int = 25 * 1024 * 1024  # 25 MB
    # Solo .xlsx. La tarjeta [SEC-03] exige "rechazo de libros con macros
    # (.xlsm)": un .xlsm puede traer VBA, y aunque openpyxl no lo ejecute, el
    # archivo queda almacenado y puede abrirlo un humano después.
    allowed_upload_suffixes: str = ".xlsx"

    # NOTA: la cuenta administradora semilla pertenece a la épica E-01, diferida
    # al Sprint 2 por la tarjeta [REF-05]. Si se revoca esa decisión, los campos
    # `seed_admin_email` y `seed_admin_password` entran aquí.
    #
    # Cuidado con el dominio del correo: `email-validator`, que Pydantic usa
    # detrás de EmailStr, rechaza los dominios reservados por RFC 2606
    # (.local, .test, .example, .invalid). Una cuenta con `@govsync.local` se
    # crea sin problema pero NUNCA puede iniciar sesión.

    municipio_codigo_dane: str = Field(default="19701", description="Santa Rosa, Cauca")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_suffixes(self) -> set[str]:
        return {s.strip().lower() for s in self.allowed_upload_suffixes.split(",") if s.strip()}

    @field_validator("secret_key")
    @classmethod
    def _no_default_secret_in_prod(cls, v: str, info):
        if info.data.get("environment") == "production" and v.startswith("dev-only"):
            raise ValueError("SECRET_KEY debe definirse explícitamente en producción")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
