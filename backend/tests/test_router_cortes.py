"""Pruebas de los endpoints de cortes (capa API), sin base de datos real.

TARJETA: [HU-01][FE-01]
CUBRE: HU-01 / CA-1, CA-2, CA-8

Prueba la traducción HTTP <-> DTO, no la persistencia: sobreescribe
`ServicioCortesDep` con un `ServicioCortes` construido sobre los mismos
repositorios en memoria que usa `test_casos_uso_cortes.py`, en vez de
`RepositorioCortesSQL` (incompleto en develop, ver [BD-02]).

Los dobles en memoria se redefinen aquí en vez de importarse de
`test_casos_uso_cortes.py` para no tocar ese archivo (es de Juan Esteban);
hay ~20 líneas de duplicación deliberada, señalada en el plan de esta
tarjeta.
"""

from __future__ import annotations

import io
import uuid
from datetime import UTC, date, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.core.config import Settings, get_settings
from app.core.dependencias import obtener_servicio_cortes, obtener_usuario_actual
from app.main import crear_app
from app.modules.cortes.application.casos_uso import ServicioCortes
from app.modules.cortes.domain.entidades import (
    ArchivoFuente,
    Corte,
    EstadoCorte,
    HistorialReemplazoArchivo,
    TipoArchivoFuente,
)
from app.modules.cortes.domain.puertos import RepositorioCortes, RepositorioDatosCorte
from app.modules.ingesta.domain.contratos import (
    LectorArchivoFuente,
    ResultadoLectura,
    TipoArchivo,
)
from app.shared.codigos import CategoriaDescarte, CodigoIndicadorProducto, DescarteIndicador
from tests.conftest import USUARIO_DE_PRUEBA

HOY = date(2026, 9, 8)


class RepositorioCortesEnMemoria(RepositorioCortes):
    def __init__(self) -> None:
        self._cortes: dict[uuid.UUID, Corte] = {}
        self.historial: list[HistorialReemplazoArchivo] = []

    def guardar(self, corte: Corte) -> Corte:
        self._cortes[corte.id] = corte
        return corte

    def existe_borrador_activo(self) -> bool:
        return any(c.estado == EstadoCorte.BORRADOR for c in self._cortes.values())

    def existe_corte_duplicado(
        self, vigencia: int, fecha_corte: date, *, excluir_id: uuid.UUID | None = None
    ) -> bool:
        return any(
            c.vigencia == vigencia and c.fecha_corte == fecha_corte and c.id != excluir_id
            for c in self._cortes.values()
        )

    def obtener(self, corte_id: uuid.UUID) -> Corte | None:
        return self._cortes.get(corte_id)

    def ultimo_registrado(self, vigencia: int | None = None) -> Corte | None:
        candidatos = [c for c in self._cortes.values() if c.estado == EstadoCorte.REGISTRADO]
        if vigencia is not None:
            candidatos = [c for c in candidatos if c.vigencia == vigencia]
        return max(candidatos, key=lambda c: c.fecha_corte, default=None)

    def listar(self) -> list[Corte]:
        return sorted(self._cortes.values(), key=lambda c: c.fecha_corte, reverse=True)

    def registrar_archivo(self, corte_id: uuid.UUID, archivo: ArchivoFuente) -> None:
        self._cortes[corte_id].archivos[archivo.tipo] = archivo

    def confirmar_registro(self, corte: Corte) -> None:
        self._cortes[corte.id].estado = EstadoCorte.REGISTRADO

    def confirmar_correccion(self, corte: Corte) -> None:
        self._cortes[corte.id].vigencia = corte.vigencia
        self._cortes[corte.id].fecha_corte = corte.fecha_corte

    def registrar_historial_reemplazo(self, historial: HistorialReemplazoArchivo) -> None:
        if historial.fecha is None:
            historial.fecha = datetime.now(UTC)
        self.historial.append(historial)

    def listar_historial_reemplazos(self, corte_id: uuid.UUID) -> list[HistorialReemplazoArchivo]:
        return [h for h in self.historial if h.corte_id == corte_id]


class RepositorioDatosCorteEnMemoria(RepositorioDatosCorte):
    """Los 3 métodos de carga se ejercitan (TestCargarArchivo, un tipo cada
    uno) — ya no quedan NotImplementedError aquí, mismo estado que el real
    en `develop` desde que [HU-03][BE-06]/[HU-04][BE-01] cerraron."""

    def reemplazar_metas(self, corte_id: uuid.UUID, metas: list[dict[str, Any]]) -> int:
        return len(metas)

    def reemplazar_presupuesto(self, corte_id, rubros, contratos, registros) -> int:
        return len(rubros) + len(contratos) + len(registros)

    def reemplazar_proyectos(self, corte_id: uuid.UUID, proyectos: list[dict[str, Any]]) -> int:
        return len(proyectos)

    def copiar_datos(self, origen_id, destino_id, tipo) -> int:
        raise NotImplementedError


class LectorPDTFalso(LectorArchivoFuente):
    """Doble mínimo: no lee Excel de verdad, solo produce un ResultadoLectura
    con una fila fija — suficiente para probar el cableado del endpoint
    (router -> ServicioCortes.cargar_archivo -> reemplazar_metas -> 201),
    no la lógica real de lectura (eso es `test_lectores_pdt.py`)."""

    tipo = TipoArchivo.PDT

    def leer(self, contenido: bytes, nombre_archivo: str, vigencia: int) -> ResultadoLectura:
        return ResultadoLectura(
            tipo=TipoArchivo.PDT,
            filas={"metas": [{"cod_indicador_producto": "040110500", "principal": True}]},
            conteos={"metas": 1},
        )


class LectorEjecucionFalso(LectorArchivoFuente):
    """Mismo espíritu que LectorPDTFalso, para el tipo EJECUCION — el
    cableado real está en `test_lectores_ejecucion.py`, aquí solo se
    prueba router -> cargar_archivo -> reemplazar_presupuesto -> 201."""

    tipo = TipoArchivo.EJECUCION

    def leer(self, contenido: bytes, nombre_archivo: str, vigencia: int) -> ResultadoLectura:
        return ResultadoLectura(
            tipo=TipoArchivo.EJECUCION,
            filas={
                "rubros": [{"codigo_rubro_nivel": "1", "ultimo_nivel": True}],
                "contratos": [{"numero_contrato": "1"}],
                "registros": [{"numero_contrato": "1"}],
            },
            conteos={"ejecucion": 1, "contratacion": 1},
        )


class LectorProyectosFalso(LectorArchivoFuente):
    """Mismo espíritu que LectorPDTFalso, para el tipo PROYECTOS — el
    cableado real está en `test_lectores_proyectos.py`, aquí solo se
    prueba router -> cargar_archivo -> reemplazar_proyectos -> 201.

    Incluye un descarte fabricado (D14, [HU-04][FE-03]) y un código
    fabricado (D16, [HU-04][FE-03]) para probar el cableado
    `ResultadoLectura.descartes`/`.codigos` -> `ArchivoFuente.descartes`/
    `.codigos` -> `DescarteRespuesta`/`codigos` de punta a punta, sin
    depender de que `LectorProyectos` real ya lo produzca (eso es
    `test_lectores_proyectos.py`)."""

    tipo = TipoArchivo.PROYECTOS

    def leer(self, contenido: bytes, nombre_archivo: str, vigencia: int) -> ResultadoLectura:
        return ResultadoLectura(
            tipo=TipoArchivo.PROYECTOS,
            filas={"proyectos": [{"bpin": "459903100000000"}]},
            conteos={"proyectos": 1},
            codigos=[CodigoIndicadorProducto("459903100")],
            descartes=[
                DescarteIndicador(
                    valor_crudo="2026",
                    motivo="4 dígitos: ni 9 ni múltiplo de 9 (no se adivina dónde cortarlo).",
                    categoria=CategoriaDescarte.LONGITUD_CORTA,
                )
            ],
        )


@pytest.fixture()
def cliente():
    repo_cortes = RepositorioCortesEnMemoria()
    servicio = ServicioCortes(
        repo_cortes=repo_cortes,
        repo_datos=RepositorioDatosCorteEnMemoria(),
        confirmar_transaccion=lambda: None,
        revertir_transaccion=lambda: None,
        hoy=HOY,
    )

    app = crear_app()
    app.dependency_overrides[obtener_servicio_cortes] = lambda: servicio
    app.dependency_overrides[obtener_usuario_actual] = lambda: USUARIO_DE_PRUEBA
    with TestClient(app) as c:
        c.repo_cortes = repo_cortes  # D11: acceso directo para registrar cortes en pruebas
        yield c
    app.dependency_overrides.clear()


def test_post_cortes_crea_en_borrador_201(cliente):
    respuesta = cliente.post("/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"})

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "BORRADOR"
    assert cuerpo["vigencia"] == 2026
    assert cuerpo["archivos"] == []


def test_post_cortes_fecha_futura_devuelve_422_con_motivo(cliente):
    respuesta = cliente.post("/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-09"})

    assert respuesta.status_code == 422
    cuerpo = respuesta.json()
    assert cuerpo["codigo"] == "regla_de_negocio_violada"
    assert cuerpo["detalles"]["fecha_corte"] == "2026-09-09"


def test_get_cortes_devuelve_historico_200(cliente):
    primero = cliente.post(
        "/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"}
    ).json()
    # D11: como máximo un BORRADOR a la vez — se registra el primero antes
    # de crear el segundo.
    corte = cliente.repo_cortes.obtener(uuid.UUID(primero["id"]))
    corte.estado = EstadoCorte.REGISTRADO
    cliente.repo_cortes.confirmar_registro(corte)
    cliente.post("/api/v1/cortes", json={"vigencia": 2025, "fecha_corte": "2025-12-01"})

    respuesta = cliente.get("/api/v1/cortes")

    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 2


def test_get_cortes_id_devuelve_detalle_200(cliente):
    creado = cliente.post(
        "/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"}
    ).json()

    respuesta = cliente.get(f"/api/v1/cortes/{creado['id']}")

    assert respuesta.status_code == 200
    assert respuesta.json()["id"] == creado["id"]


def test_get_cortes_id_inexistente_devuelve_404(cliente):
    respuesta = cliente.get(f"/api/v1/cortes/{uuid.uuid4()}")

    assert respuesta.status_code == 404
    assert respuesta.json()["codigo"] == "recurso_no_encontrado"


# --- es_corte_actual — [E02-HU05], Contrato de la spec original ------------
# Indicador calculado por el backend para que el frontend
# (`EditarArchivosCorteActual.jsx`) no tenga que recalcular el orden con
# una segunda petición a GET /cortes completo (ver docstring de
# `CorteRespuesta.es_corte_actual` en el router).


def test_corte_en_borrador_nunca_es_el_actual(cliente):
    corte_id = _crear_corte_borrador(cliente)

    respuesta = cliente.get(f"/api/v1/cortes/{corte_id}")

    assert respuesta.json()["es_corte_actual"] is False


def test_unico_corte_registrado_es_el_actual(cliente_con_lectores):
    corte_id = _crear_corte_actual_registrado(cliente_con_lectores)

    respuesta = cliente_con_lectores.get(f"/api/v1/cortes/{corte_id}")

    assert respuesta.json()["es_corte_actual"] is True


def test_corte_registrado_desplazado_por_uno_mas_reciente_deja_de_ser_el_actual(
    cliente_con_lectores,
):
    """CA05: mismo escenario que ya prueba el reemplazo (corte global, no
    por vigencia) -- aquí se confirma el valor del indicador en sí."""
    corte_antiguo_id = _crear_corte_actual_registrado(
        cliente_con_lectores, vigencia=2025, fecha_corte="2025-12-31"
    )
    corte_reciente_id = _crear_corte_actual_registrado(
        cliente_con_lectores, vigencia=2026, fecha_corte="2026-09-08"
    )

    respuesta_antiguo = cliente_con_lectores.get(f"/api/v1/cortes/{corte_antiguo_id}")
    respuesta_reciente = cliente_con_lectores.get(f"/api/v1/cortes/{corte_reciente_id}")

    assert respuesta_antiguo.json()["es_corte_actual"] is False
    assert respuesta_reciente.json()["es_corte_actual"] is True


def test_listar_cortes_marca_es_corte_actual_sin_consultar_por_cada_fila(cliente_con_lectores):
    corte_antiguo_id = _crear_corte_actual_registrado(
        cliente_con_lectores, vigencia=2025, fecha_corte="2025-12-31"
    )
    corte_reciente_id = _crear_corte_actual_registrado(
        cliente_con_lectores, vigencia=2026, fecha_corte="2026-09-08"
    )

    respuesta = cliente_con_lectores.get("/api/v1/cortes")

    por_id = {fila["id"]: fila["es_corte_actual"] for fila in respuesta.json()}
    assert por_id[corte_antiguo_id] is False
    assert por_id[corte_reciente_id] is True


def test_sin_ningun_corte_registrado_ninguno_es_el_actual(cliente):
    corte_id = _crear_corte_borrador(cliente)

    respuesta = cliente.get("/api/v1/cortes")

    assert all(fila["es_corte_actual"] is False for fila in respuesta.json())
    assert any(fila["id"] == corte_id for fila in respuesta.json())


def test_al_registrar_un_corte_pasa_a_ser_el_actual(cliente_con_lectores):
    corte_id = _crear_corte_borrador(cliente_con_lectores)
    _cargar_los_tres_archivos(cliente_con_lectores, corte_id)

    respuesta = cliente_con_lectores.post(f"/api/v1/cortes/{corte_id}/registrar")

    assert respuesta.json()["es_corte_actual"] is True


def test_corregir_un_corte_en_borrador_mantiene_es_corte_actual_en_falso(cliente):
    corte_id = _crear_corte_borrador(cliente)

    respuesta = cliente.patch(
        f"/api/v1/cortes/{corte_id}", json={"vigencia": 2026, "fecha_corte": "2026-01-01"}
    )

    assert respuesta.json()["es_corte_actual"] is False


# --- PATCH /cortes/{id} — D11 (docs/DECISIONES.md, aclaración 2026-09-19) --


def test_patch_cortes_id_corrige_vigencia_y_fecha_200(cliente):
    creado = cliente.post(
        "/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"}
    ).json()

    respuesta = cliente.patch(
        f"/api/v1/cortes/{creado['id']}",
        json={"vigencia": 2025, "fecha_corte": "2026-09-01"},
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["vigencia"] == 2025
    assert cuerpo["fecha_corte"] == "2026-09-01"
    assert cuerpo["estado"] == "BORRADOR"


def test_patch_cortes_id_inexistente_devuelve_404(cliente):
    respuesta = cliente.patch(
        f"/api/v1/cortes/{uuid.uuid4()}",
        json={"vigencia": 2025, "fecha_corte": "2026-09-01"},
    )

    assert respuesta.status_code == 404
    assert respuesta.json()["codigo"] == "recurso_no_encontrado"


def test_patch_cortes_id_sobre_corte_registrado_devuelve_409(cliente):
    creado = cliente.post(
        "/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"}
    ).json()
    corte = cliente.repo_cortes.obtener(uuid.UUID(creado["id"]))
    corte.estado = EstadoCorte.REGISTRADO
    cliente.repo_cortes.confirmar_registro(corte)

    respuesta = cliente.patch(
        f"/api/v1/cortes/{creado['id']}",
        json={"vigencia": 2025, "fecha_corte": "2026-09-01"},
    )

    assert respuesta.status_code == 409
    assert respuesta.json()["detalles"]["motivo"] == "corte_no_es_borrador"


def test_patch_cortes_id_duplicado_contra_otro_corte_devuelve_409(cliente):
    otro = cliente.post(
        "/api/v1/cortes", json={"vigencia": 2025, "fecha_corte": "2025-12-01"}
    ).json()
    corte_otro = cliente.repo_cortes.obtener(uuid.UUID(otro["id"]))
    corte_otro.estado = EstadoCorte.REGISTRADO
    cliente.repo_cortes.confirmar_registro(corte_otro)
    propio = cliente.post(
        "/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"}
    ).json()

    respuesta = cliente.patch(
        f"/api/v1/cortes/{propio['id']}",
        json={"vigencia": 2025, "fecha_corte": "2025-12-01"},
    )

    assert respuesta.status_code == 409
    assert respuesta.json()["detalles"]["motivo"] == "vigencia_fecha_duplicada"


def test_patch_cortes_id_fecha_futura_devuelve_422(cliente):
    creado = cliente.post(
        "/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"}
    ).json()

    respuesta = cliente.patch(
        f"/api/v1/cortes/{creado['id']}",
        json={"vigencia": 2026, "fecha_corte": "2026-09-09"},
    )

    assert respuesta.status_code == 422
    assert respuesta.json()["codigo"] == "regla_de_negocio_violada"


# --- POST /cortes/{id}/archivos/{tipo} — [HU-02][FE-01] --------------------
#
# `cliente` (arriba) construye ServicioCortes sin `lectores` (default {}) —
# suficiente para 404/422, que fallan antes de buscar un lector. El camino
# feliz (los 3 tipos) necesita lectores reales, por eso esta fixture aparte
# en vez de tocar la compartida y arriesgar los 5 tests de arriba.
@pytest.fixture()
def cliente_con_lectores():
    repo_cortes = RepositorioCortesEnMemoria()
    servicio = ServicioCortes(
        repo_cortes=repo_cortes,
        repo_datos=RepositorioDatosCorteEnMemoria(),
        confirmar_transaccion=lambda: None,
        revertir_transaccion=lambda: None,
        lectores={
            TipoArchivoFuente.PDT: LectorPDTFalso(),
            TipoArchivoFuente.EJECUCION: LectorEjecucionFalso(),
            TipoArchivoFuente.PROYECTOS: LectorProyectosFalso(),
        },
        hoy=HOY,
    )

    app = crear_app()
    app.dependency_overrides[obtener_servicio_cortes] = lambda: servicio
    app.dependency_overrides[obtener_usuario_actual] = lambda: USUARIO_DE_PRUEBA
    with TestClient(app) as c:
        c.repo_cortes = repo_cortes
        yield c
    app.dependency_overrides.clear()


def _crear_corte_borrador(cliente) -> str:
    return cliente.post(
        "/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-09-08"}
    ).json()["id"]


def _xlsx_minimo() -> bytes:
    """.xlsx real y mínimo (SEC-03 exige la firma ZIP + estructura OOXML
    válida, no basta contenido arbitrario) — LectorPDTFalso no lo parsea,
    así que su contenido interno no importa, solo que sea un libro válido."""
    libro = Workbook()
    buffer = io.BytesIO()
    libro.save(buffer)
    return buffer.getvalue()


def test_post_archivos_pdt_devuelve_201(cliente_con_lectores):
    corte_id = _crear_corte_borrador(cliente_con_lectores)

    respuesta = cliente_con_lectores.post(
        f"/api/v1/cortes/{corte_id}/archivos/PDT",
        files={
            "archivo": (
                "plan.xlsx",
                _xlsx_minimo(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["tipo"] == "PDT"
    assert cuerpo["nombre_archivo"] == "plan.xlsx"
    assert cuerpo["filas_reconocidas"] == 1
    # D14/[HU-04][FE-03]: PDT no produce descartes ni códigos de indicador.
    assert cuerpo["descartes"] == []
    assert cuerpo["codigos"] == []
    # [HU-03][FE-01]: filas por pestaña no aplica a PDT.
    assert cuerpo["filas_ejecucion_reconocidas"] is None
    assert cuerpo["filas_contratacion_reconocidas"] is None


def test_post_archivos_ejecucion_devuelve_201(cliente_con_lectores):
    """Confirma que el guard que rechazaba EJECUCION con 501 ya no existe:
    [HU-03][BE-06] cerró en develop, reemplazar_presupuesto ya no lanza
    NotImplementedError (ver docs/archivo/sprint-1/TRAZABILIDAD.md, HU-03/CA-1)."""
    corte_id = _crear_corte_borrador(cliente_con_lectores)

    respuesta = cliente_con_lectores.post(
        f"/api/v1/cortes/{corte_id}/archivos/EJECUCION",
        files={
            "archivo": (
                "ejecucion.xlsx",
                _xlsx_minimo(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["tipo"] == "EJECUCION"
    # 1 rubro + 1 contrato + 1 registro, ver LectorEjecucionFalso.
    assert cuerpo["filas_reconocidas"] == 3
    # D14/[HU-04][FE-03]: EJECUCION no produce descartes ni códigos de indicador.
    assert cuerpo["descartes"] == []
    assert cuerpo["codigos"] == []
    # [HU-03][FE-01]: conteos por pestaña, ver LectorEjecucionFalso
    # (conteos={"ejecucion": 1, "contratacion": 1}).
    assert cuerpo["filas_ejecucion_reconocidas"] == 1
    assert cuerpo["filas_contratacion_reconocidas"] == 1


def test_post_archivos_proyectos_devuelve_201(cliente_con_lectores):
    """Confirma que el guard que rechazaba PROYECTOS con 501 ya no existe:
    [HU-04][BE-01] cerró en develop, LectorProyectos.leer ya no lanza
    NotImplementedError (ver docs/archivo/sprint-1/TRAZABILIDAD.md, HU-04/CA-1)."""
    corte_id = _crear_corte_borrador(cliente_con_lectores)

    respuesta = cliente_con_lectores.post(
        f"/api/v1/cortes/{corte_id}/archivos/PROYECTOS",
        files={
            "archivo": (
                "proyectos.xlsx",
                _xlsx_minimo(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["tipo"] == "PROYECTOS"
    assert cuerpo["filas_reconocidas"] == 1
    # [HU-03][FE-01]: filas por pestaña no aplica a PROYECTOS.
    assert cuerpo["filas_ejecucion_reconocidas"] is None
    assert cuerpo["filas_contratacion_reconocidas"] is None
    # D14/[HU-04][FE-03]: el descarte fabricado por LectorProyectosFalso
    # llega intacto, con categoria como el valor del StrEnum (minúscula),
    # no el nombre del miembro.
    assert cuerpo["descartes"] == [
        {
            "valor_crudo": "2026",
            "motivo": "4 dígitos: ni 9 ni múltiplo de 9 (no se adivina dónde cortarlo).",
            "categoria": "longitud_corta",
        }
    ]
    # D16/[HU-04][FE-03]: el código fabricado por LectorProyectosFalso llega
    # intacto, como str (`.valor`), no como CodigoIndicadorProducto.
    assert cuerpo["codigos"] == ["459903100"]


def test_post_archivos_tamano_excedido_por_content_length_devuelve_422(
    cliente_con_lectores,
):
    """Hallazgo transversal a HU-02/03/04, 2026-09-20: `cargar_archivo`
    rechaza por `Content-Length` ANTES de leer el archivo (antes se leía
    completo a memoria primero, sin ningún chequeo previo). `get_settings`
    se sobreescribe con un límite minúsculo para no tener que generar un
    archivo grande de verdad -- `_xlsx_minimo()` (unos KB) ya lo excede de
    sobra. Cubre el caso común (cliente declara `Content-Length` de forma
    honesta): sigue dando el 422 estructurado de siempre, mismo `detalles`
    que ya producía `_verificar_tamano`."""
    corte_id = _crear_corte_borrador(cliente_con_lectores)
    cliente_con_lectores.app.dependency_overrides[get_settings] = lambda: Settings(
        max_upload_bytes=32
    )

    respuesta = cliente_con_lectores.post(
        f"/api/v1/cortes/{corte_id}/archivos/PDT",
        files={
            "archivo": (
                "plan.xlsx",
                _xlsx_minimo(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert respuesta.status_code == 422
    cuerpo = respuesta.json()
    assert cuerpo["codigo"] == "archivo_invalido"
    assert cuerpo["detalles"]["motivo"] == "tamano_excedido"
    assert cuerpo["detalles"]["tamano_max"] == 32


def test_post_archivos_tamano_excedido_sin_content_length_devuelve_413(monkeypatch):
    """Hallazgo transversal a HU-02/03/04, 2026-09-20: respaldo
    autoritativo (`RequestBodyLimitMiddleware`, `main.py::crear_app`) para
    el caso que el chequeo de `Content-Length` del router NO cubre -- un
    cliente que no lo declara (`chunked transfer-encoding`, simulado aquí
    con un generador) o miente. Es la única forma de ejercitar esta rama:
    `max_body_size` se hornea en el middleware al construir la app (no es
    un `Depends`), así que no se puede sobreescribir con
    `app.dependency_overrides` como el resto de las pruebas de este
    archivo -- se usa `MAX_UPLOAD_BYTES` por variable de entorno antes de
    `crear_app()`, con `get_settings.cache_clear()` porque está decorado
    con `@lru_cache`.

    A diferencia de la prueba anterior, responde 413 con texto plano, NO
    el 422 estructurado de `ArchivoInvalido` -- documentado como
    excepción deliberada en el docstring de `cargar_archivo` y en
    docs/SEGURIDAD.md (sección SEC-03): es el único caso (cliente
    adversarial o con un encoding que no declara `Content-Length`) donde
    no se preservó el contrato 422 sin reimplementar el parseo multipart
    a mano.
    """
    repo_cortes = RepositorioCortesEnMemoria()
    servicio = ServicioCortes(
        repo_cortes=repo_cortes,
        repo_datos=RepositorioDatosCorteEnMemoria(),
        confirmar_transaccion=lambda: None,
        revertir_transaccion=lambda: None,
        lectores={
            TipoArchivoFuente.PDT: LectorPDTFalso(),
            TipoArchivoFuente.EJECUCION: LectorEjecucionFalso(),
            TipoArchivoFuente.PROYECTOS: LectorProyectosFalso(),
        },
        hoy=HOY,
    )
    # El corte se crea con el límite POR DEFECTO (una app aparte, antes de
    # bajar MAX_UPLOAD_BYTES): con el límite minúsculo activo, hasta el
    # POST /cortes normal (un JSON de unos 40 bytes) ya lo excedería --
    # RequestBodyLimitMiddleware aplica a TODA la app, no solo a este
    # endpoint. `servicio`/`repo_cortes` se reutilizan entre las dos apps
    # porque son objetos Python independientes del `FastAPI` que los envuelve.
    app_normal = crear_app()
    app_normal.dependency_overrides[obtener_servicio_cortes] = lambda: servicio
    app_normal.dependency_overrides[obtener_usuario_actual] = lambda: USUARIO_DE_PRUEBA
    corte_id = _crear_corte_borrador(TestClient(app_normal))

    monkeypatch.setenv("MAX_UPLOAD_BYTES", "20")
    get_settings.cache_clear()
    try:
        app = crear_app()
        app.dependency_overrides[obtener_servicio_cortes] = lambda: servicio
        app.dependency_overrides[obtener_usuario_actual] = lambda: USUARIO_DE_PRUEBA
        cliente = TestClient(app)

        boundary = "boundaryDePrueba"
        cuerpo_multipart = (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="archivo"; filename="a.xlsx"\r\n'
            "Content-Type: application/octet-stream\r\n\r\n"
            + "A" * 5000
            + f"\r\n--{boundary}--\r\n"
        ).encode()

        def cuerpo_en_chunks():
            # Un generador (tamaño desconocido) hace que httpx envíe
            # `Transfer-Encoding: chunked` en vez de `Content-Length` --
            # es la única forma de forzar esta rama; el Content-Length
            # honesto ya lo cubre la prueba anterior.
            for inicio in range(0, len(cuerpo_multipart), 100):
                yield cuerpo_multipart[inicio : inicio + 100]

        respuesta = cliente.post(
            f"/api/v1/cortes/{corte_id}/archivos/PDT",
            content=cuerpo_en_chunks(),
            headers={"content-type": f"multipart/form-data; boundary={boundary}"},
        )

        assert respuesta.status_code == 413
    finally:
        get_settings.cache_clear()


def test_post_archivos_tipo_fuera_del_enum_devuelve_422(cliente):
    """Confirma que tipar `tipo: TipoArchivoFuente` en el endpoint basta —
    no hace falta validación propia para un valor fuera del enum."""
    corte_id = _crear_corte_borrador(cliente)

    respuesta = cliente.post(
        f"/api/v1/cortes/{corte_id}/archivos/BASURA",
        files={"archivo": ("x.xlsx", b"x", "application/octet-stream")},
    )

    assert respuesta.status_code == 422


def test_post_archivos_corte_inexistente_devuelve_404(cliente):
    respuesta = cliente.post(
        f"/api/v1/cortes/{uuid.uuid4()}/archivos/PDT",
        files={"archivo": ("plan.xlsx", b"x", "application/octet-stream")},
    )

    assert respuesta.status_code == 404
    assert respuesta.json()["codigo"] == "recurso_no_encontrado"


# --- POST /cortes/{id}/registrar -- [HU-01][BE-05] --------------------------


def _cargar_los_tres_archivos(cliente, corte_id: str) -> None:
    for tipo in ("PDT", "EJECUCION", "PROYECTOS"):
        respuesta = cliente.post(
            f"/api/v1/cortes/{corte_id}/archivos/{tipo}",
            files={
                "archivo": (
                    f"{tipo.lower()}.xlsx",
                    _xlsx_minimo(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert respuesta.status_code == 201


def test_post_registrar_con_los_tres_archivos_devuelve_200(cliente_con_lectores):
    corte_id = _crear_corte_borrador(cliente_con_lectores)
    _cargar_los_tres_archivos(cliente_con_lectores, corte_id)

    respuesta = cliente_con_lectores.post(f"/api/v1/cortes/{corte_id}/registrar")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["id"] == corte_id
    assert cuerpo["estado"] == "REGISTRADO"


def test_post_registrar_con_archivo_faltante_devuelve_409(cliente_con_lectores):
    corte_id = _crear_corte_borrador(cliente_con_lectores)

    respuesta = cliente_con_lectores.post(f"/api/v1/cortes/{corte_id}/registrar")

    assert respuesta.status_code == 409
    detalles = respuesta.json()["detalles"]
    assert "PDT" in detalles["archivos_faltantes"]
    assert "EJECUCION" in detalles["archivos_faltantes"]
    assert "PROYECTOS" in detalles["archivos_faltantes"]


def test_post_registrar_corte_inexistente_devuelve_404(cliente):
    respuesta = cliente.post(f"/api/v1/cortes/{uuid.uuid4()}/registrar")

    assert respuesta.status_code == 404
    assert respuesta.json()["codigo"] == "recurso_no_encontrado"


# --- PUT /cortes/{id}/archivos/{tipo} — [E02-HU05] --------------------------


def _crear_corte_actual_registrado(
    cliente, *, vigencia: int = 2026, fecha_corte: str = "2026-09-08"
) -> str:
    """Corte REGISTRADO con los 3 archivos. Con un solo corte en la tabla es,
    por construcción, el único candidato a `ultimo_registrado()`, o sea el
    "corte actual" que [E02-HU05] exige para el reemplazo. `vigencia` y
    `fecha_corte` son parametrizables para poder construir un corte MÁS
    ANTIGUO que otro (CA05): usar la MISMA vigencia activaría la
    reutilización automática de fuentes de HU-01/CA-5 (`copiar_datos`, sin
    implementar en `RepositorioDatosCorteEnMemoria` de este archivo), así
    que los tests que crean dos cortes usan vigencias distintas a
    propósito -- no están probando reutilización aquí, sino CA05 de
    [E02-HU05] ("corte actual" es global, no por vigencia). `fecha_corte`
    no puede ser posterior a HOY = 2026-09-08 (`Corte.validar_fecha`)."""
    corte_id = cliente.post(
        "/api/v1/cortes", json={"vigencia": vigencia, "fecha_corte": fecha_corte}
    ).json()["id"]
    _cargar_los_tres_archivos(cliente, corte_id)
    respuesta = cliente.post(f"/api/v1/cortes/{corte_id}/registrar")
    assert respuesta.status_code == 200
    return corte_id


def test_put_archivos_del_corte_actual_devuelve_200_y_registra_el_historial(
    cliente_con_lectores,
):
    corte_id = _crear_corte_actual_registrado(cliente_con_lectores)

    respuesta = cliente_con_lectores.post(
        f"/api/v1/cortes/{corte_id}/archivos/PDT/reemplazo",
        files={
            "archivo": (
                "pdt_corregido.xlsx",
                _xlsx_minimo(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["tipo"] == "PDT"
    assert cuerpo["nombre_archivo"] == "pdt_corregido.xlsx"

    historial = cliente_con_lectores.get(f"/api/v1/cortes/{corte_id}/historial")
    assert historial.status_code == 200
    filas = historial.json()
    assert len(filas) == 1
    assert filas[0]["nombre_archivo_nuevo"] == "pdt_corregido.xlsx"
    assert filas[0]["usuario"] == USUARIO_DE_PRUEBA.correo


def test_put_archivos_corte_en_borrador_devuelve_409_motivo_corte_no_registrado(
    cliente_con_lectores,
):
    corte_id = _crear_corte_borrador(cliente_con_lectores)

    respuesta = cliente_con_lectores.post(
        f"/api/v1/cortes/{corte_id}/archivos/PDT/reemplazo",
        files={
            "archivo": (
                "plan.xlsx",
                _xlsx_minimo(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert respuesta.status_code == 409
    assert respuesta.json()["detalles"]["motivo"] == "corte_no_registrado"


def test_put_archivos_corte_registrado_pero_no_es_el_actual_devuelve_409(cliente_con_lectores):
    """CA05: un segundo corte REGISTRADO con fecha posterior desplaza al
    primero como "el actual" -- el primero deja de ser editable."""
    corte_antiguo_id = _crear_corte_actual_registrado(
        cliente_con_lectores, vigencia=2025, fecha_corte="2025-12-31"
    )
    _crear_corte_actual_registrado(cliente_con_lectores, vigencia=2026, fecha_corte="2026-09-08")

    respuesta = cliente_con_lectores.post(
        f"/api/v1/cortes/{corte_antiguo_id}/archivos/PDT/reemplazo",
        files={
            "archivo": (
                "plan.xlsx",
                _xlsx_minimo(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert respuesta.status_code == 409
    assert respuesta.json()["detalles"]["motivo"] == "corte_no_es_el_actual"


def test_put_archivos_corte_inexistente_devuelve_404(cliente):
    respuesta = cliente.post(
        f"/api/v1/cortes/{uuid.uuid4()}/archivos/PDT/reemplazo",
        files={
            "archivo": (
                "plan.xlsx",
                _xlsx_minimo(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert respuesta.status_code == 404
    assert respuesta.json()["codigo"] == "recurso_no_encontrado"


# --- GET /cortes/{id}/historial — [E02-HU05][CA06] -------------------------


def test_get_historial_reemplazos_vacio_si_nunca_se_reemplazo_nada(cliente_con_lectores):
    corte_id = _crear_corte_actual_registrado(cliente_con_lectores)

    respuesta = cliente_con_lectores.get(f"/api/v1/cortes/{corte_id}/historial")

    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_get_historial_reemplazos_corte_inexistente_devuelve_404(cliente):
    respuesta = cliente.get(f"/api/v1/cortes/{uuid.uuid4()}/historial")

    assert respuesta.status_code == 404
    assert respuesta.json()["codigo"] == "recurso_no_encontrado"
