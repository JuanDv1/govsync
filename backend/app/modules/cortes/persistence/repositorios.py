"""Implementaciones SQLAlchemy de los puertos del módulo de cortes.

CAPA: Persistencia
TARJETA: [BD-02] Repositorios SQLAlchemy reemplazando los repositorios en memoria
DEPENDE DE: [BD-01]

De la tarjeta: «La conversión entre modelo ORM y entidad de dominio es
explícita: el ORM no se filtra hacia el Dominio.» Por eso existe `_a_dominio`:
ningún objeto de SQLAlchemy debe llegar a la aplicación ni a la respuesta HTTP.

=============================================================================
TRAMPA CONOCIDA — LEER ANTES DE ESCRIBIR reemplazar_presupuesto
=============================================================================
El `default=uuid.uuid4` de una columna SOLO se evalúa cuando SQLAlchemy emite
el INSERT. Si se construye el objeto y se lee `objeto.id` ANTES del flush, el
valor es None.

Al cargar el archivo presupuestal se necesita un índice
`codigo_rubro -> id` para resolver la FK de los 319 registros presupuestales
sin hacer una consulta por cada uno (N+1). Si ese índice se llena con `.id`
antes del flush, queda lleno de None, TODOS los registros se descartan y la
matriz de [HU-07] no muestra un solo contrato — sin ningún error visible.

Solución: generar el UUID explícitamente al construir el objeto
(`RubroORM(id=uuid.uuid4(), ...)`). Así se conserva la inserción en lote y se
elimina la trampa de orden.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.modules.cortes.domain.puertos import RepositorioCortes, RepositorioDatosCorte


class RepositorioCortesSQL(RepositorioCortes):
    def __init__(self, sesion: Session) -> None:
        self._s = sesion

    # TODO [BD-02] Implementar los métodos del puerto.
    # Los repositorios hacen flush(), NUNCA commit(): la transacción la
    # controla el caso de uso.


class RepositorioDatosCorteSQL(RepositorioDatosCorte):
    """Etapa Load del ETL. Escribe en lote; nunca hace commit por fila."""

    def __init__(self, sesion: Session) -> None:
        self._s = sesion

    # TODO [BD-02] Implementar los métodos del puerto.
