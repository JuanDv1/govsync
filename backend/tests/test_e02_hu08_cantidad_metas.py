"""[E02-HU08][CA03] Cantidad de metas por corte en el histórico.

TARJETA: [E-02/HU-08] BE+FE - Mostrar cantidad de metas por corte (CA03).
Decisión del PO (2026-11-11): cantidad de metas DISTINTAS del Plan de
Acción del corte (no filas de la matriz); "—" (aquí `None`) si el corte aún
no está finalizado; el conteo sale de UNA consulta agrupada en GET /cortes.

Repositorio y endpoint con SQL real (SQLite en memoria, fixtures de
conftest.py).
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import event

from app.modules.cortes.domain.entidades import EstadoCorte, TipoArchivoFuente
from app.modules.cortes.persistence.models import ArchivoFuenteORM, CorteORM, MetaORM
from app.modules.cortes.persistence.repositorios import RepositorioDatosCorteSQL


def _corte(sesion, *, fecha: date, estado: EstadoCorte = EstadoCorte.REGISTRADO) -> uuid.UUID:
    corte_id = uuid.uuid4()
    sesion.add(CorteORM(id=corte_id, vigencia=fecha.year, fecha_corte=fecha, estado=estado))
    sesion.flush()
    for tipo in TipoArchivoFuente:
        sesion.add(
            ArchivoFuenteORM(
                id=uuid.uuid4(), corte_id=corte_id, tipo=tipo, nombre_archivo=f"{tipo.value}.xlsx"
            )
        )
    return corte_id


def _metas(sesion, corte_id: uuid.UUID, *codigos: str) -> None:
    for codigo in codigos:
        sesion.add(
            MetaORM(
                id=uuid.uuid4(),
                corte_id=corte_id,
                cod_indicador_producto=codigo,
                nombre_producto=f"Meta {codigo}",
                es_principal=True,
            )
        )


class TestRepositorio:
    def test_cuenta_metas_distintas_por_corte(self, sesion) -> None:
        a = _corte(sesion, fecha=date(2026, 3, 31))
        b = _corte(sesion, fecha=date(2026, 6, 30))
        _metas(sesion, a, "040110500", "330105300")
        _metas(sesion, b, "040110500")
        sesion.flush()

        assert RepositorioDatosCorteSQL(sesion).contar_metas_por_corte() == {a: 2, b: 1}

    def test_un_codigo_repetido_en_el_mismo_corte_cuenta_una_vez(self, sesion) -> None:
        """El Plan de Acción agrupa por código; el conteo debe coincidir."""
        corte = _corte(sesion, fecha=date(2026, 6, 30))
        _metas(sesion, corte, "040110500", "040110500", "330105300")
        sesion.flush()

        assert RepositorioDatosCorteSQL(sesion).contar_metas_por_corte() == {corte: 2}

    def test_los_ceros_a_la_izquierda_distinguen_codigos(self, sesion) -> None:
        """Los códigos son texto: '040110500' y '40110500' son dos metas."""
        corte = _corte(sesion, fecha=date(2026, 6, 30))
        _metas(sesion, corte, "040110500", "40110500")
        sesion.flush()

        assert RepositorioDatosCorteSQL(sesion).contar_metas_por_corte() == {corte: 2}

    def test_un_corte_sin_metas_no_aparece(self, sesion) -> None:
        _corte(sesion, fecha=date(2026, 6, 30))
        sesion.flush()

        assert RepositorioDatosCorteSQL(sesion).contar_metas_por_corte() == {}


class TestEndpoint:
    def test_ca03_cada_corte_registrado_trae_su_cantidad_de_metas(self, cliente, sesion) -> None:
        a = _corte(sesion, fecha=date(2026, 3, 31))
        b = _corte(sesion, fecha=date(2026, 6, 30))
        _metas(sesion, a, "040110500", "330105300", "450201100")
        _metas(sesion, b, "040110500")
        sesion.commit()

        cortes = {c["id"]: c for c in cliente.get("/api/v1/cortes").json()}

        assert cortes[str(a)]["cantidad_metas"] == 3
        assert cortes[str(b)]["cantidad_metas"] == 1

    def test_ca03_un_borrador_no_trae_cantidad(self, cliente, sesion) -> None:
        """'Si el corte aún no está finalizado, mostrar "—" en vez de 0'."""
        borrador = _corte(sesion, fecha=date(2026, 7, 31), estado=EstadoCorte.BORRADOR)
        _metas(sesion, borrador, "040110500")
        sesion.commit()

        (corte,) = cliente.get("/api/v1/cortes").json()

        assert corte["id"] == str(borrador)
        assert corte["cantidad_metas"] is None

    def test_ca03_un_corte_registrado_sin_metas_trae_cero(self, cliente, sesion) -> None:
        _corte(sesion, fecha=date(2026, 6, 30))
        sesion.commit()

        (corte,) = cliente.get("/api/v1/cortes").json()

        assert corte["cantidad_metas"] == 0

    def test_ca03_el_conteo_es_una_sola_consulta_sin_importar_cuantos_cortes(
        self, cliente, sesion
    ) -> None:
        """Nota técnica de la tarjeta: "una sola consulta agrupada en GET
        /cortes, no una consulta por corte" (evita N+1)."""
        for mes in (1, 3, 6, 9):
            corte = _corte(sesion, fecha=date(2026, mes, 28))
            _metas(sesion, corte, f"0{mes}0110500")
        sesion.commit()

        conteos: list[str] = []

        def _registrar(_conn, _cursor, sentencia, *_args) -> None:
            if "count(DISTINCT" in sentencia:
                conteos.append(sentencia)

        motor = sesion.get_bind()
        event.listen(motor, "before_cursor_execute", _registrar)
        try:
            respuesta = cliente.get("/api/v1/cortes")
        finally:
            event.remove(motor, "before_cursor_execute", _registrar)

        assert respuesta.status_code == 200
        assert len(respuesta.json()) == 4
        assert len(conteos) == 1

    def test_las_demas_respuestas_de_cortes_no_cambian_de_forma(self, cliente, sesion) -> None:
        """El campo es solo del histórico: el detalle de un corte no lo trae."""
        corte = _corte(sesion, fecha=date(2026, 6, 30))
        sesion.commit()

        detalle = cliente.get(f"/api/v1/cortes/{corte}").json()

        assert "cantidad_metas" not in detalle
