"""Pruebas integradas de E-02/HU-05 sobre SQLite en memoria."""

import uuid
from datetime import date

import pytest

from app.modules.cortes.application.casos_uso import ServicioCortes
from app.modules.cortes.domain.entidades import (
    ArchivoFuente,
    EstadoCorte,
    TipoArchivoFuente,
)
from app.modules.cortes.persistence.models import CorteORM, MetaORM
from app.modules.cortes.persistence.repositorios import (
    RepositorioCortesSQL,
    RepositorioDatosCorteSQL,
)
from app.modules.ingesta.domain.contratos import (
    ResultadoLectura,
)
from app.modules.ingesta.domain.contratos import (
    TipoArchivo as TipoArchivoIngesta,
)
from app.modules.trazabilidad.persistence.consultas import construir_matriz
from tests.fabricas import construir_pdt

CODIGO_ANTERIOR = "040110500"
CODIGO_NUEVO = "330105300"
XLSX_VALIDO = construir_pdt()


class LectorPDTControlado:
    def leer(self, contenido, nombre_archivo, vigencia):
        return ResultadoLectura(
            tipo=TipoArchivoIngesta.PDT,
            filas={
                "metas": [
                    {
                        "cod_indicador_producto": CODIGO_NUEVO,
                        "principal": True,
                        "nombre_producto": "Meta actualizada",
                    }
                ]
            },
        )


@pytest.fixture()
def escenario(sesion):
    corte_id = uuid.uuid4()

    sesion.add(
        CorteORM(
            id=corte_id,
            vigencia=2026,
            fecha_corte=date(2026, 9, 8),
            estado=EstadoCorte.REGISTRADO,
        )
    )
    sesion.flush()

    repositorio_cortes = RepositorioCortesSQL(sesion)
    repositorio_cortes.registrar_archivo(
        corte_id,
        ArchivoFuente(
            tipo=TipoArchivoFuente.PDT,
            nombre_archivo="pdt_anterior.xlsx",
            filas_reconocidas=1,
        ),
    )

    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            cod_indicador_producto=CODIGO_ANTERIOR,
            nombre_producto="Meta anterior",
            es_principal=True,
        )
    )
    sesion.commit()

    servicio = ServicioCortes(
        repo_cortes=repositorio_cortes,
        repo_datos=RepositorioDatosCorteSQL(sesion),
        confirmar_transaccion=sesion.commit,
        revertir_transaccion=sesion.rollback,
        lectores={TipoArchivoFuente.PDT: LectorPDTControlado()},
        hoy=date(2026, 9, 8),
    )

    return corte_id, repositorio_cortes, servicio


def _codigos_matriz(sesion, corte_id):
    resultado = construir_matriz(sesion, corte_id)
    return [fila.cod_indicador_producto for fila in resultado.filas]


def test_reemplazo_pdt_actualiza_matriz_e_historial(sesion, escenario):
    corte_id, repositorio_cortes, servicio = escenario

    assert _codigos_matriz(sesion, corte_id) == [CODIGO_ANTERIOR]

    servicio.reemplazar_archivo_corte_actual(
        corte_id,
        TipoArchivoFuente.PDT,
        XLSX_VALIDO,
        "pdt_nuevo.xlsx",
        "gestor@santarosa.gov.co",
    )

    assert _codigos_matriz(sesion, corte_id) == [CODIGO_NUEVO]

    corte = repositorio_cortes.obtener(corte_id)
    assert corte.archivos[TipoArchivoFuente.PDT].nombre_archivo == "pdt_nuevo.xlsx"

    historial = repositorio_cortes.listar_historial_reemplazos(corte_id)
    assert len(historial) == 1
    assert historial[0].nombre_archivo_anterior == "pdt_anterior.xlsx"
    assert historial[0].nombre_archivo_nuevo == "pdt_nuevo.xlsx"
    assert historial[0].usuario == "gestor@santarosa.gov.co"


def test_reemplazo_pdt_informa_la_meta_que_desaparecio(escenario):
    corte_id, _, servicio = escenario

    archivo = servicio.reemplazar_archivo_corte_actual(
        corte_id,
        TipoArchivoFuente.PDT,
        XLSX_VALIDO,
        "pdt_nuevo.xlsx",
        "gestor@santarosa.gov.co",
    )

    assert archivo.metas_eliminadas == [CODIGO_ANTERIOR]


def test_segundo_reemplazo_ya_no_informa_la_meta_que_ya_se_habia_ido(escenario):
    """Lo que se compara es lo persistido: tras el primer reemplazo el corte
    ya solo tiene CODIGO_NUEVO, así que repetir el mismo archivo no elimina nada."""
    corte_id, _, servicio = escenario
    argumentos = (
        corte_id,
        TipoArchivoFuente.PDT,
        XLSX_VALIDO,
        "pdt.xlsx",
        "gestor@santarosa.gov.co",
    )

    primero = servicio.reemplazar_archivo_corte_actual(*argumentos)
    segundo = servicio.reemplazar_archivo_corte_actual(*argumentos)

    assert primero.metas_eliminadas == [CODIGO_ANTERIOR]
    assert segundo.metas_eliminadas == []


def test_fallo_en_auditoria_no_pierde_las_metas_que_se_iban_a_eliminar(
    sesion, escenario, monkeypatch
):
    """Si el reemplazo se revierte, la meta "eliminada" sigue en la base: el
    aviso nunca debe describir un cambio que no se aplicó."""
    corte_id, repositorio_cortes, servicio = escenario

    def auditoria_que_falla(_historial):
        raise RuntimeError("Fallo simulado al registrar historial")

    monkeypatch.setattr(repositorio_cortes, "registrar_historial_reemplazo", auditoria_que_falla)

    with pytest.raises(RuntimeError):
        servicio.reemplazar_archivo_corte_actual(
            corte_id, TipoArchivoFuente.PDT, XLSX_VALIDO, "pdt_nuevo.xlsx", "g@santarosa.gov.co"
        )

    assert RepositorioDatosCorteSQL(sesion).listar_codigos_metas(corte_id) == {CODIGO_ANTERIOR}


def test_fallo_en_auditoria_revierte_metas_y_archivo(sesion, escenario, monkeypatch):
    corte_id, repositorio_cortes, servicio = escenario

    def auditoria_que_falla(_historial):
        raise RuntimeError("Fallo simulado al registrar historial")

    monkeypatch.setattr(
        repositorio_cortes,
        "registrar_historial_reemplazo",
        auditoria_que_falla,
    )

    with pytest.raises(RuntimeError, match="Fallo simulado"):
        servicio.reemplazar_archivo_corte_actual(
            corte_id,
            TipoArchivoFuente.PDT,
            XLSX_VALIDO,
            "pdt_nuevo.xlsx",
            "gestor@santarosa.gov.co",
        )

    assert _codigos_matriz(sesion, corte_id) == [CODIGO_ANTERIOR]

    corte = repositorio_cortes.obtener(corte_id)
    assert corte.archivos[TipoArchivoFuente.PDT].nombre_archivo == "pdt_anterior.xlsx"

    historial = repositorio_cortes.listar_historial_reemplazos(corte_id)
    assert historial == []
