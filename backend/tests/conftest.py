"""Configuración de pruebas.

TARJETA: [DEV-05] Pipeline CI — pruebas y cobertura

La base de pruebas es SQLite en memoria. Es posible porque los modelos deben
usar tipos neutrales (`sa.Uuid`, `sa.Numeric`) y generar los UUID en Python, no
con `gen_random_uuid()` del servidor. Mantiene la suite rápida y sin
dependencias externas en CI.

Las restricciones específicas de PostgreSQL (índices parciales, CHECK con
expresiones regulares) NO se verifican aquí: para eso está el job de CI que
aplica la migración contra PostgreSQL 16.

OJO: los correos de prueba no pueden usar dominios reservados por RFC 2606
(.test, .local, .example, .invalid). `email-validator`, que Pydantic usa detrás
de EmailStr, los rechaza.
"""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_session
from app.core.dependencias import obtener_usuario_actual
from app.main import crear_app
from app.modules.identidad.domain.entidades import Rol, Usuario

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

#: [HU-E01-02] / D24: usuario de prueba por defecto para las pruebas HTTP
#: que no se centran en autenticación/autorización. GESTOR porque ya
#: satisface tanto los endpoints de lectura como los de escritura (D24).
USUARIO_DE_PRUEBA = Usuario(
    id="usuario-de-prueba", correo="prueba@santarosa.gov.co", roles=frozenset({Rol.GESTOR})
)

# Importa los modelos ORM para que Base.metadata conozca todas las tablas antes
# de create_all; sin este import la base de pruebas se crea vacía.
from app.modules.cortes.persistence import models as _modelos  # noqa: E402, F401


@pytest.fixture()
def motor():
    motor = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite no aplica las llaves foráneas si no se activan explícitamente.
    @event.listens_for(motor, "connect")
    def _activar_fk(conexion, _registro):
        conexion.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(motor)
    yield motor
    Base.metadata.drop_all(motor)
    motor.dispose()


@pytest.fixture()
def sesion(motor):
    fabrica_sesion = sessionmaker(bind=motor, autocommit=False, autoflush=False, future=True)
    with fabrica_sesion() as s:
        yield s


@pytest.fixture()
def cliente(motor, sesion):
    app = crear_app()

    def _sesion_de_prueba():
        yield sesion

    app.dependency_overrides[get_session] = _sesion_de_prueba
    app.dependency_overrides[obtener_usuario_actual] = lambda: USUARIO_DE_PRUEBA
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
