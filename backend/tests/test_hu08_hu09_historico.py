"""Pruebas de aceptación de E-02/HU-08 (histórico de cortes) y E-02/HU-09
(matriz de cualquier corte registrado).

TARJETAS: [E-02/HU-08] TEST y [E-02/HU-09] TEST (deuda de pruebas del
Sprint 1, Sprint 3). Fuente de los CA: hojas HU_E02_08 y HU_E02_09 del
levantamiento v3.0.

Qué NO se repite aquí porque ya está probado en otro archivo:
- Orden descendente a nivel de repositorio SQL (HU08-CA02):
  `test_repositorios_cortes.py::test_listar_ordena_del_mas_reciente_al_mas_antiguo`.
- 404/409/200 de la matriz por corte (HU09-CA01, camino básico):
  `test_router_trazabilidad.py`.
- Copia física de los datos al reutilizar fuentes:
  `test_repositorio_datos_corte.py::test_copiar_datos_*`.

Qué SÍ cubre este archivo (huecos reales encontrados al revisar):
- HU08-CA01/CA02 de punta a punta por HTTP con SQL real: campos que la
  pantalla necesita y orden, incluido un BORRADOR (DEC-005 del plan de QA
  del Sprint 2 sigue abierta: aquí solo se fija lo que hoy hace el sistema,
  no se decide la regla).
- HU09-CA01 + TC-E02-HU09-004 (DEC-012, resuelta): dos cortes de
  vigencias distintas no mezclan datos.
- HU09-CA02: modificar el corte nuevo NO altera la matriz del corte
  anterior, aunque el nuevo haya reutilizado (copiado) sus fuentes.
- HU09-CA03: la API de la matriz es de solo lectura (no hay verbo de
  escritura expuesto).

No se prueban HU08-CA03, HU08-CA04 ni HU09-CA04: no están implementados o
están en discusión (decisión #17 del levantamiento v3.0). Probarlos sería
inventar el comportamiento esperado.
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest

from app.modules.cortes.application.casos_uso import ServicioCortes
from app.modules.cortes.domain.entidades import EstadoCorte, TipoArchivoFuente
from app.modules.cortes.persistence.models import ArchivoFuenteORM, CorteORM, MetaORM
from app.modules.cortes.persistence.repositorios import (
    RepositorioCortesSQL,
    RepositorioDatosCorteSQL,
)

COD_CORTE_ANTERIOR = "040110500"  # empieza en cero a propósito
COD_CORTE_NUEVO = "330105300"


def _crear_corte(
    sesion,
    *,
    vigencia: int,
    fecha: date,
    estado: EstadoCorte = EstadoCorte.REGISTRADO,
    tipos: tuple[TipoArchivoFuente, ...] = tuple(TipoArchivoFuente),
) -> uuid.UUID:
    corte_id = uuid.uuid4()
    sesion.add(CorteORM(id=corte_id, vigencia=vigencia, fecha_corte=fecha, estado=estado))
    sesion.flush()
    for tipo in tipos:
        sesion.add(
            ArchivoFuenteORM(
                id=uuid.uuid4(),
                corte_id=corte_id,
                tipo=tipo,
                nombre_archivo=f"{tipo.value.lower()}.xlsx",
            )
        )
    return corte_id


def _agregar_meta(sesion, corte_id: uuid.UUID, codigo: str, nombre: str) -> None:
    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            cod_indicador_producto=codigo,
            nombre_producto=nombre,
            es_principal=True,
        )
    )


def _codigos_de_la_matriz(cliente, corte_id: uuid.UUID) -> list[str]:
    respuesta = cliente.get(f"/api/v1/matriz-relacion/{corte_id}")
    assert respuesta.status_code == 200, respuesta.text
    return [fila["cod_indicador_producto"] for fila in respuesta.json()["filas"]]


# --- HU-08 -------------------------------------------------------------------


def test_hu08_ca01_historico_expone_vigencia_fecha_estado_y_archivos(cliente, sesion):
    """HU08-CA01: la tabla del histórico muestra Vigencia, Fecha de Corte,
    Estado y Archivos Cargados. Se verifica que la API entregue esos cuatro
    datos para cada corte (la pantalla `Cortes.jsx` los pinta tal cual)."""
    corte_id = _crear_corte(sesion, vigencia=2026, fecha=date(2026, 6, 30))
    sesion.commit()

    respuesta = cliente.get("/api/v1/cortes")

    assert respuesta.status_code == 200
    (corte,) = respuesta.json()
    assert corte["id"] == str(corte_id)
    assert corte["vigencia"] == 2026
    assert corte["fecha_corte"] == "2026-06-30"
    assert corte["estado"] == "REGISTRADO"
    assert {a["tipo"] for a in corte["archivos"]} == {"PDT", "EJECUCION", "PROYECTOS"}


def test_hu08_ca02_historico_ordena_del_mas_reciente_al_mas_antiguo_por_http(cliente, sesion):
    """HU08-CA02 de punta a punta (el repositorio ya tiene su propia prueba;
    esta comprueba que el router no reordena). Se insertan desordenados y
    mezclando vigencias: el orden es por fecha de corte, no por vigencia ni
    por orden de inserción."""
    medio = _crear_corte(sesion, vigencia=2026, fecha=date(2026, 3, 31))
    antiguo = _crear_corte(sesion, vigencia=2025, fecha=date(2025, 12, 31))
    reciente = _crear_corte(sesion, vigencia=2026, fecha=date(2026, 8, 31))
    sesion.commit()

    ids = [c["id"] for c in cliente.get("/api/v1/cortes").json()]

    assert ids == [str(reciente), str(medio), str(antiguo)]


def test_hu08_historico_incluye_borradores_con_su_estado(cliente, sesion):
    """Fija el comportamiento ACTUAL, no una regla de negocio: hoy el
    histórico lista también el corte en BORRADOR y la API lo marca como tal.
    DEC-005 (plan de QA Sprint 2: "¿los borradores aparecen en histórico y
    con qué acción?") sigue abierta; si el PO decide ocultarlos, esta prueba
    debe cambiar junto con esa decisión, no antes."""
    registrado = _crear_corte(sesion, vigencia=2026, fecha=date(2026, 6, 30))
    borrador = _crear_corte(
        sesion,
        vigencia=2026,
        fecha=date(2026, 7, 31),
        estado=EstadoCorte.BORRADOR,
        tipos=(TipoArchivoFuente.PDT,),
    )
    sesion.commit()

    cortes = {c["id"]: c for c in cliente.get("/api/v1/cortes").json()}

    assert cortes[str(borrador)]["estado"] == "BORRADOR"
    assert len(cortes[str(borrador)]["archivos"]) == 1
    assert cortes[str(registrado)]["estado"] == "REGISTRADO"


# --- HU-09 -------------------------------------------------------------------


def test_hu09_ca01_matrices_de_dos_cortes_no_mezclan_datos(cliente, sesion):
    """HU09-CA01 + TC-E02-HU09-004 (DEC-012, resuelta en Sprint 2): abrir la
    matriz de un corte antiguo devuelve SOLO sus datos, aunque exista otro
    corte más reciente de otra vigencia."""
    corte_2025 = _crear_corte(sesion, vigencia=2025, fecha=date(2025, 12, 31))
    _agregar_meta(sesion, corte_2025, COD_CORTE_ANTERIOR, "Meta 2025")
    corte_2026 = _crear_corte(sesion, vigencia=2026, fecha=date(2026, 6, 30))
    _agregar_meta(sesion, corte_2026, COD_CORTE_NUEVO, "Meta 2026")
    sesion.commit()

    assert _codigos_de_la_matriz(cliente, corte_2025) == [COD_CORTE_ANTERIOR]
    assert _codigos_de_la_matriz(cliente, corte_2026) == [COD_CORTE_NUEVO]


@pytest.fixture()
def servicio_sql(sesion):
    """ServicioCortes real sobre SQLite: necesario para ejercer la
    reutilización de fuentes de HU-01/CA-5 tal como ocurre en producción
    (copiar_datos), en vez de simularla insertando filas a mano."""
    return ServicioCortes(
        repo_cortes=RepositorioCortesSQL(sesion),
        repo_datos=RepositorioDatosCorteSQL(sesion),
        confirmar_transaccion=sesion.commit,
        revertir_transaccion=sesion.rollback,
        hoy=date(2026, 9, 8),
    )


def test_hu09_ca02_modificar_el_corte_nuevo_no_altera_la_matriz_del_anterior(
    cliente, sesion, servicio_sql
):
    """HU09-CA02: "ve datos tal como estaban en ese momento, sin cambios
    posteriores".

    Escenario de mayor riesgo: el corte nuevo de la MISMA vigencia reutiliza
    PDT y PROYECTOS del anterior (HU-01/CA-5). Si la reutilización fuera una
    referencia en vez de una copia, reemplazar el PDT del corte nuevo
    (E02-HU05) cambiaría también el pasado. Se reemplazan las metas del corte
    nuevo y se comprueba que la matriz del anterior no cambió."""
    anterior = _crear_corte(sesion, vigencia=2026, fecha=date(2026, 3, 31))
    _agregar_meta(sesion, anterior, COD_CORTE_ANTERIOR, "Meta original")
    sesion.commit()

    nuevo = servicio_sql.crear_corte(2026, date(2026, 6, 30))
    archivo_pdt = nuevo.archivos[TipoArchivoFuente.PDT]
    assert archivo_pdt.reutilizado is True
    assert archivo_pdt.corte_origen_id == anterior

    RepositorioDatosCorteSQL(sesion).reemplazar_metas(
        nuevo.id,
        [{"cod_indicador_producto": COD_CORTE_NUEVO, "principal": True}],
    )
    sesion.add(
        ArchivoFuenteORM(
            id=uuid.uuid4(),
            corte_id=nuevo.id,
            tipo=TipoArchivoFuente.EJECUCION,
            nombre_archivo="ejecucion.xlsx",
        )
    )
    sesion.commit()

    assert _codigos_de_la_matriz(cliente, anterior) == [COD_CORTE_ANTERIOR]
    assert _codigos_de_la_matriz(cliente, nuevo.id) == [COD_CORTE_NUEVO]


@pytest.mark.parametrize("metodo", ["post", "put", "patch", "delete"])
def test_hu09_ca03_la_matriz_no_expone_ningun_verbo_de_escritura(cliente, sesion, metodo):
    """HU09-CA03: la matriz histórica no se puede editar. La garantía real
    está en el backend: no existe ningún endpoint de escritura sobre la
    matriz, así que cualquier intento recibe 405 (no basta con que la
    pantalla no muestre controles de edición).

    Observación para el PO (no es un defecto de esta prueba): el CA pide el
    mensaje literal "Datos históricos no pueden editarse" al intentar editar
    una celda, pero la pantalla no tiene celdas editables, así que ese
    mensaje nunca puede aparecer."""
    corte_id = _crear_corte(sesion, vigencia=2026, fecha=date(2026, 6, 30))
    sesion.commit()

    respuesta = getattr(cliente, metodo)(f"/api/v1/matriz-relacion/{corte_id}")

    assert respuesta.status_code == 405
