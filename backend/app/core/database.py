"""Sesión SQLAlchemy y Base declarativa.

Capa: persistencia (infraestructura). El dominio nunca importa este módulo.
"""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_settings = get_settings()
_connect_args = {"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    _settings.database_url,
    pool_pre_ping=True,
    future=True,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


def get_session() -> Iterator[Session]:
    """Dependencia FastAPI. Una sesión por request; commit lo hace el caso de uso."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
