"""Configuración de Alembic. Toma la URL de la base de la configuración de la app.

Los modelos ORM deben importarse aquí para que `Base.metadata` los conozca; de
lo contrario `alembic revision --autogenerate` genera una migración vacía sin
avisar de nada.

Cada módulo nuevo que declare tablas agrega su import abajo.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings
from app.core.database import Base

# Importar los modelos registra las tablas en Base.metadata (autogenerate).
from app.modules.cortes.persistence import models as _cortes  # noqa: F401

# TODO Si se revoca [REF-05] y entra el módulo de identidad, agregar aquí:
#     from app.modules.identidad.persistence import models as _identidad  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().database_url)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
