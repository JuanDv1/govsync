"""Pruebas del endpoint de la matriz de relación (capa API).

TARJETA: [HU-07][FE-01]
CUBRE: HU-07 / CA-1

A diferencia de `test_router_cortes.py`, aquí no hay dobles en memoria:
`construir_matriz` hace SQL directo contra el ORM, así que se reutilizan
`motor`/`sesion`/`cliente` de `conftest.py` (SQLite en memoria, esquema
real) — el mismo mecanismo que ya usa `test_consultas_matriz.py` para
probar `construir_matriz` en aislamiento. Aquí se prueba el endpoint
completo: 404/409 del router + el cruce real vía `RepositorioCortesSQL`
(ya completo en develop, sin dobles).
"""

from __future__ import annotations

import uuid
from datetime import date

from app.modules.cortes.domain.entidades import EstadoCorte, TipoArchivoFuente
from app.modules.cortes.persistence.models import ArchivoFuenteORM, CorteORM, MetaORM


def _crear_corte(
    sesion,
    *,
    vigencia: int = 2026,
    fecha: date = date(2026, 1, 1),
    estado: EstadoCorte = EstadoCorte.BORRADOR,
) -> uuid.UUID:
    corte_id = uuid.uuid4()
    sesion.add(CorteORM(id=corte_id, vigencia=vigencia, fecha_corte=fecha, estado=estado))
    sesion.flush()
    return corte_id


def _marcar_archivo_cargado(sesion, corte_id: uuid.UUID, tipo: TipoArchivoFuente) -> None:
    sesion.add(
        ArchivoFuenteORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            tipo=tipo,
            nombre_archivo=f"{tipo.value.lower()}.xlsx",
        )
    )


def test_matriz_devuelve_404_si_el_corte_no_existe(cliente):
    respuesta = cliente.get(f"/api/v1/matriz-relacion/{uuid.uuid4()}")

    assert respuesta.status_code == 404
    assert respuesta.json()["codigo"] == "recurso_no_encontrado"


def test_matriz_devuelve_409_si_falta_una_fuente(cliente, sesion):
    corte_id = _crear_corte(sesion)
    _marcar_archivo_cargado(sesion, corte_id, TipoArchivoFuente.PDT)
    _marcar_archivo_cargado(sesion, corte_id, TipoArchivoFuente.EJECUCION)
    # PROYECTOS falta a propósito.
    sesion.commit()

    respuesta = cliente.get(f"/api/v1/matriz-relacion/{corte_id}")

    assert respuesta.status_code == 409
    cuerpo = respuesta.json()
    assert cuerpo["codigo"] == "operacion_no_permitida"
    assert cuerpo["detalles"]["archivos_faltantes"] == ["PROYECTOS"]


def test_matriz_devuelve_409_si_faltan_las_tres_fuentes(cliente, sesion):
    corte_id = _crear_corte(sesion)
    sesion.commit()

    respuesta = cliente.get(f"/api/v1/matriz-relacion/{corte_id}")

    assert respuesta.status_code == 409
    faltantes = respuesta.json()["detalles"]["archivos_faltantes"]
    assert set(faltantes) == {"PDT", "EJECUCION", "PROYECTOS"}


def test_matriz_devuelve_200_con_datos_reales_cuando_estan_las_tres_fuentes(cliente, sesion):
    corte_id = _crear_corte(sesion)
    for tipo in TipoArchivoFuente:
        _marcar_archivo_cargado(sesion, corte_id, tipo)
    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            cod_indicador_producto="040110500",
            nombre_producto="Vías pavimentadas",
            es_principal=True,
        )
    )
    sesion.commit()

    respuesta = cliente.get(f"/api/v1/matriz-relacion/{corte_id}?pagina=1&tamano_pagina=50")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["corte_id"] == str(corte_id)
    assert cuerpo["pagina"] == 1
    assert cuerpo["tamano_pagina"] == 50
    assert cuerpo["total_filas"] == 1
    assert len(cuerpo["filas"]) == 1
    fila = cuerpo["filas"][0]
    assert fila["cod_indicador_producto"] == "040110500"
    assert fila["nombre_producto"] == "Vías pavimentadas"
    # Sin proyecto/rubro/contrato cargados para este código: NULL explícito
    # (CA-8), no "" ni 0 — mismo criterio que consultas.py.
    assert fila["cod_bpin"] is None
    assert fila["cod_indicador_ejecucion"] is None
    assert fila["numero_contrato"] is None


def test_matriz_pagina_vacia_devuelve_200_con_filas_vacias(cliente, sesion):
    """Con las 3 fuentes cargadas pero sin ninguna meta: 200, no 404 ni 409
    — el corte está completo, simplemente no cruza nada todavía."""
    corte_id = _crear_corte(sesion)
    for tipo in TipoArchivoFuente:
        _marcar_archivo_cargado(sesion, corte_id, tipo)
    sesion.commit()

    respuesta = cliente.get(f"/api/v1/matriz-relacion/{corte_id}")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total_filas"] == 0
    assert cuerpo["filas"] == []


# --- GET /matriz-relacion/actual --------------------------------------------


def test_matriz_actual_devuelve_404_si_no_hay_ningun_corte_registrado(cliente, sesion):
    """Sin ningún corte REGISTRADO (aunque existan BORRADOR): 404, mismo
    codigo que /{corte_id} con un id inexistente."""
    _crear_corte(sesion)  # BORRADOR por defecto -- no cuenta como "actual".
    sesion.commit()

    respuesta = cliente.get("/api/v1/matriz-relacion/actual")

    assert respuesta.status_code == 404
    assert respuesta.json()["codigo"] == "recurso_no_encontrado"


def test_matriz_actual_devuelve_409_si_al_mas_reciente_le_falta_una_fuente(cliente, sesion):
    corte_id = _crear_corte(sesion, estado=EstadoCorte.REGISTRADO)
    _marcar_archivo_cargado(sesion, corte_id, TipoArchivoFuente.PDT)
    _marcar_archivo_cargado(sesion, corte_id, TipoArchivoFuente.EJECUCION)
    # PROYECTOS falta a propósito.
    sesion.commit()

    respuesta = cliente.get("/api/v1/matriz-relacion/actual")

    assert respuesta.status_code == 409
    cuerpo = respuesta.json()
    assert cuerpo["codigo"] == "operacion_no_permitida"
    assert cuerpo["detalles"]["archivos_faltantes"] == ["PROYECTOS"]


def test_matriz_actual_devuelve_200_con_el_corte_registrado_mas_reciente(cliente, sesion):
    """Dos cortes REGISTRADO de vigencias distintas: trae el de
    fecha_corte más reciente, GLOBAL -- ignora vigencia, mismo criterio
    que D11 usa para existe_borrador_activo(). El más reciente es el de
    2025 (fecha posterior), aunque su vigencia (2025) sea "menor" que la
    del otro corte (2026) -- confirma que el corte devuelto no es
    simplemente "el de mayor vigencia".
    """
    corte_viejo_id = _crear_corte(
        sesion, vigencia=2026, fecha=date(2024, 1, 1), estado=EstadoCorte.REGISTRADO
    )
    for tipo in TipoArchivoFuente:
        _marcar_archivo_cargado(sesion, corte_viejo_id, tipo)

    corte_reciente_id = _crear_corte(
        sesion, vigencia=2025, fecha=date(2025, 6, 1), estado=EstadoCorte.REGISTRADO
    )
    for tipo in TipoArchivoFuente:
        _marcar_archivo_cargado(sesion, corte_reciente_id, tipo)
    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_reciente_id,
            cod_indicador_producto="040110500",
            nombre_producto="Vías pavimentadas",
            es_principal=True,
        )
    )
    sesion.commit()

    respuesta = cliente.get("/api/v1/matriz-relacion/actual")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["corte_id"] == str(corte_reciente_id)
    assert cuerpo["total_filas"] == 1


# --- HU-10: filtros de la matriz ---------------------------------------------


def _preparar_corte_filtrable(sesion) -> uuid.UUID:
    corte_id = _crear_corte(sesion)
    for tipo in TipoArchivoFuente:
        _marcar_archivo_cargado(sesion, corte_id, tipo)
    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            cod_indicador_producto="040110500",
            nombre_producto="Vías pavimentadas",
            sector="Transporte",
            es_principal=True,
        )
    )
    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            cod_indicador_producto="170202300",
            nombre_producto="Aulas construidas",
            sector="Educación",
            es_principal=True,
        )
    )
    sesion.commit()
    return corte_id


def test_matriz_filtra_por_sector(cliente, sesion):
    corte_id = _preparar_corte_filtrable(sesion)

    respuesta = cliente.get(f"/api/v1/matriz-relacion/{corte_id}?sector=Transporte")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total_filas"] == 1
    assert cuerpo["filas"][0]["cod_indicador_producto"] == "040110500"


def test_matriz_combina_dos_valores_del_mismo_criterio_con_or(cliente, sesion):
    corte_id = _preparar_corte_filtrable(sesion)

    respuesta = cliente.get(
        f"/api/v1/matriz-relacion/{corte_id}?sector=Transporte&sector=Educación"
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["total_filas"] == 2


def test_matriz_actual_acepta_los_mismos_filtros(cliente, sesion):
    corte_id = _crear_corte(sesion, estado=EstadoCorte.REGISTRADO)
    for tipo in TipoArchivoFuente:
        _marcar_archivo_cargado(sesion, corte_id, tipo)
    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            cod_indicador_producto="040110500",
            nombre_producto="Vías pavimentadas",
            sector="Transporte",
            es_principal=True,
        )
    )
    sesion.commit()

    respuesta = cliente.get("/api/v1/matriz-relacion/actual?sector=Transporte")

    assert respuesta.status_code == 200
    assert respuesta.json()["total_filas"] == 1


def test_matriz_incluye_nombre_del_proyecto(cliente, sesion):
    """CA-17 (absorbido de HU-07): el nombre del proyecto viaja en la
    respuesta del endpoint, no solo el BPIN."""
    corte_id = _crear_corte(sesion)
    for tipo in TipoArchivoFuente:
        _marcar_archivo_cargado(sesion, corte_id, tipo)
    sesion.add(
        MetaORM(
            id=uuid.uuid4(),
            corte_id=corte_id,
            cod_indicador_producto="040110500",
            nombre_producto="Vías pavimentadas",
            es_principal=True,
        )
    )
    sesion.commit()

    respuesta = cliente.get(f"/api/v1/matriz-relacion/{corte_id}")

    assert respuesta.status_code == 200
    assert respuesta.json()["filas"][0]["nombre_proyecto"] is None


# --- HU-10/CA-1, CA-3: GET /matriz-relacion/{corte_id}/opciones-filtro -------


def test_opciones_filtro_devuelve_404_si_el_corte_no_existe(cliente):
    respuesta = cliente.get(f"/api/v1/matriz-relacion/{uuid.uuid4()}/opciones-filtro")

    assert respuesta.status_code == 404


def test_opciones_filtro_devuelve_409_si_falta_una_fuente(cliente, sesion):
    corte_id = _crear_corte(sesion)
    _marcar_archivo_cargado(sesion, corte_id, TipoArchivoFuente.PDT)
    sesion.commit()

    respuesta = cliente.get(f"/api/v1/matriz-relacion/{corte_id}/opciones-filtro")

    assert respuesta.status_code == 409


def test_opciones_filtro_devuelve_los_valores_del_corte(cliente, sesion):
    corte_id = _preparar_corte_filtrable(sesion)

    respuesta = cliente.get(f"/api/v1/matriz-relacion/{corte_id}/opciones-filtro")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert set(cuerpo["sectores"]) == {"Transporte", "Educación"}
    assert set(cuerpo["productos"]) == {"Vías pavimentadas", "Aulas construidas"}
    assert {i["codigo"] for i in cuerpo["indicadores"]} == {"040110500", "170202300"}
