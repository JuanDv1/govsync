"""Pruebas del endpoint del Plan de Acción Consolidado (capa API).

TARJETA: [E04-HU01]
CUBRE: HU01-CA01 (corte actual), CA04 (solo lectura -- por ausencia de
verbos de escritura), CA09 (estado vacío -- 404 cuando no hay corte
registrado), CA10 (restricción de rol -- D26, PENDIENTE DE RATIFICAR).

Mismo patrón que `test_router_trazabilidad.py`: sin dobles, SQL real contra
SQLite en memoria vía `cliente`/`sesion` de conftest.py. El rol por defecto
del fixture `cliente` es GESTOR (ver conftest.py) -- como D26 NO le da
acceso a este endpoint, cada prueba que SÍ espera 200 sobreescribe
`obtener_usuario_actual` con un usuario administrador o visitante (mismo
mecanismo que `test_autorizacion_rutas.py::TestRolVisitante`).
"""

from __future__ import annotations

import uuid
from datetime import date

from app.core.dependencias import obtener_usuario_actual
from app.modules.cortes.domain.entidades import EstadoCorte, TipoArchivoFuente
from app.modules.cortes.persistence.models import ArchivoFuenteORM, CorteORM, MetaORM
from app.modules.identidad.domain.entidades import Rol, Usuario

_ADMINISTRADOR = Usuario(
    id="a1", correo="admin@santarosa.gov.co", roles=frozenset({Rol.ADMINISTRADOR})
)
_VISITANTE = Usuario(id="v1", correo="visitante@santarosa.gov.co", roles=frozenset({Rol.VISITANTE}))
_GESTOR = Usuario(id="g1", correo="gestor@santarosa.gov.co", roles=frozenset({Rol.GESTOR}))


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


class TestRestriccionDeRolCA10:
    """D26: administrador + visitante tienen acceso; gestor no (ver
    docstring de plan_accion/api/router.py)."""

    def test_sin_token_devuelve_401(self, sesion) -> None:
        from fastapi.testclient import TestClient

        from app.core.database import get_session
        from app.main import crear_app

        def _sesion_de_prueba():
            yield sesion

        app = crear_app()
        app.dependency_overrides[get_session] = _sesion_de_prueba
        cliente_sin_usuario = TestClient(app)

        respuesta = cliente_sin_usuario.get("/api/v1/plan-accion/actual")

        assert respuesta.status_code == 401

    def test_gestor_no_tiene_acceso(self, cliente) -> None:
        # El fixture `cliente` ya usa GESTOR por defecto (conftest.py).
        respuesta = cliente.get("/api/v1/plan-accion/actual")

        assert respuesta.status_code == 403
        cuerpo = respuesta.json()
        assert cuerpo["codigo"] == "permiso_insuficiente"
        assert set(cuerpo["detalles"]["roles_requeridos"]) == {"administrador", "visitante"}

    def test_administrador_tiene_acceso(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        corte_id = _crear_corte(sesion, estado=EstadoCorte.REGISTRADO)
        for tipo in TipoArchivoFuente:
            _marcar_archivo_cargado(sesion, corte_id, tipo)
        sesion.commit()

        respuesta = cliente.get("/api/v1/plan-accion/actual")

        assert respuesta.status_code == 200

    def test_visitante_tiene_acceso(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _VISITANTE
        corte_id = _crear_corte(sesion, estado=EstadoCorte.REGISTRADO)
        for tipo in TipoArchivoFuente:
            _marcar_archivo_cargado(sesion, corte_id, tipo)
        sesion.commit()

        respuesta = cliente.get("/api/v1/plan-accion/actual")

        assert respuesta.status_code == 200


class TestEstadoVacioCA09:
    def test_sin_ningun_corte_registrado_devuelve_404(self, cliente) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR

        respuesta = cliente.get("/api/v1/plan-accion/actual")

        assert respuesta.status_code == 404
        assert respuesta.json()["codigo"] == "recurso_no_encontrado"

    def test_con_un_corte_solo_borrador_devuelve_404(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        _crear_corte(sesion, estado=EstadoCorte.BORRADOR)
        sesion.commit()

        respuesta = cliente.get("/api/v1/plan-accion/actual")

        assert respuesta.status_code == 404


class TestFuentesIncompletasCA01:
    def test_devuelve_409_si_falta_una_fuente(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        corte_id = _crear_corte(sesion, estado=EstadoCorte.REGISTRADO)
        _marcar_archivo_cargado(sesion, corte_id, TipoArchivoFuente.PDT)
        _marcar_archivo_cargado(sesion, corte_id, TipoArchivoFuente.EJECUCION)
        sesion.commit()

        respuesta = cliente.get("/api/v1/plan-accion/actual")

        assert respuesta.status_code == 409
        assert respuesta.json()["detalles"]["archivos_faltantes"] == ["PROYECTOS"]


class TestPlanAccionActualConDatos:
    """CA01/CA02/CA04/CA05: estructura de la respuesta con datos reales."""

    def test_devuelve_la_meta_agregada_con_su_resumen(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        corte_id = _crear_corte(sesion, estado=EstadoCorte.REGISTRADO)
        for tipo in TipoArchivoFuente:
            _marcar_archivo_cargado(sesion, corte_id, tipo)
        sesion.add(
            MetaORM(
                id=uuid.uuid4(),
                corte_id=corte_id,
                cod_indicador_producto="040110500",
                nombre_producto="Vías pavimentadas",
                sector="Infraestructura",
                es_principal=True,
            )
        )
        sesion.commit()

        respuesta = cliente.get("/api/v1/plan-accion/actual")

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["corte_id"] == str(corte_id)
        assert len(cuerpo["filas"]) == 1
        fila = cuerpo["filas"][0]
        assert fila["cod_indicador_producto"] == "040110500"
        assert fila["sector"] == "Infraestructura"
        # CA04: ningún campo de la fila sugiere edición -- solo lectura.
        assert fila["avance_fisico_pct"] is None
        # Sin rubro/BPIN/contrato: CA05 la clasifica "sin_informacion".
        assert fila["estado_cruce"] == "sin_informacion"
        assert cuerpo["resumen"] == {
            "total": 1,
            "completo": 0,
            "parcial": 0,
            "sin_informacion": 1,
        }

    def test_corte_registrado_sin_ninguna_meta_devuelve_filas_vacias_y_resumen_en_cero(
        self, cliente, sesion
    ) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        corte_id = _crear_corte(sesion, estado=EstadoCorte.REGISTRADO)
        for tipo in TipoArchivoFuente:
            _marcar_archivo_cargado(sesion, corte_id, tipo)
        sesion.commit()

        respuesta = cliente.get("/api/v1/plan-accion/actual")

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["filas"] == []
        assert cuerpo["resumen"]["total"] == 0


class TestFiltrosQueryParamsE04HU02:
    """[E04-HU02] filtros vía query params, de punta a punta (SQL real +
    agregación + filtrado), igual patrón que las clases de arriba."""

    def _preparar_corte_con_dos_metas(self, sesion):
        corte_id = _crear_corte(sesion, estado=EstadoCorte.REGISTRADO)
        for tipo in TipoArchivoFuente:
            _marcar_archivo_cargado(sesion, corte_id, tipo)
        sesion.add(
            MetaORM(
                id=uuid.uuid4(),
                corte_id=corte_id,
                cod_indicador_producto="040110500",
                nombre_producto="Vías pavimentadas",
                sector="Infraestructura",
                es_principal=True,
            )
        )
        sesion.add(
            MetaORM(
                id=uuid.uuid4(),
                corte_id=corte_id,
                cod_indicador_producto="170202300",
                nombre_producto="Escuelas construidas",
                sector="Educación",
                es_principal=True,
            )
        )
        sesion.commit()
        return corte_id

    def test_filtra_por_sector(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        self._preparar_corte_con_dos_metas(sesion)

        respuesta = cliente.get("/api/v1/plan-accion/actual", params={"sector": "Educación"})

        assert respuesta.status_code == 200
        filas = respuesta.json()["filas"]
        assert len(filas) == 1
        assert filas[0]["cod_indicador_producto"] == "170202300"
        assert respuesta.json()["resumen"]["total"] == 1

    def test_busqueda_sin_distinguir_tildes(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        self._preparar_corte_con_dos_metas(sesion)

        respuesta = cliente.get("/api/v1/plan-accion/actual", params={"busqueda": "Vias"})

        assert respuesta.status_code == 200
        filas = respuesta.json()["filas"]
        assert len(filas) == 1
        assert filas[0]["cod_indicador_producto"] == "040110500"

    def test_sin_resultados_devuelve_lista_vacia_y_resumen_en_cero(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        self._preparar_corte_con_dos_metas(sesion)

        respuesta = cliente.get("/api/v1/plan-accion/actual", params={"sector": "Salud"})

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["filas"] == []
        assert cuerpo["resumen"]["total"] == 0

    def test_sin_query_params_devuelve_todo_ca08(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        self._preparar_corte_con_dos_metas(sesion)

        respuesta = cliente.get("/api/v1/plan-accion/actual")

        assert respuesta.status_code == 200
        assert len(respuesta.json()["filas"]) == 2

    def test_sector_repetido_combina_con_or(self, cliente, sesion) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        self._preparar_corte_con_dos_metas(sesion)

        respuesta = cliente.get(
            "/api/v1/plan-accion/actual",
            params=[("sector", "Educación"), ("sector", "Infraestructura")],
        )

        assert respuesta.status_code == 200
        assert len(respuesta.json()["filas"]) == 2
