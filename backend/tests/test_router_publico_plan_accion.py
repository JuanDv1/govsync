"""[D38] Plan de Acción público: `GET /api/v1/publico/plan-accion/actual`.

Es la única ruta de la API que responde sin token. Estas pruebas fijan, de
punta a punta (SQLite real), que:
- responde 200 sin credenciales, con el mismo 404/409 que la ruta protegida;
- solo expone una LISTA BLANCA de claves (un campo nuevo en el DTO protegido
  no se publica por accidente) y nunca objeto/valor/valor_pagado del contrato;
- ninguna otra ruta de la API responde sin token (leídas del OpenAPI);
- nada de escritura, exportación, comparación, matriz ni historial es público.
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_session
from app.core.dependencias import obtener_usuario_actual
from app.main import crear_app
from app.modules.cortes.domain.entidades import EstadoCorte, TipoArchivoFuente
from app.modules.cortes.persistence.models import ArchivoFuenteORM, CorteORM
from tests.test_ca05_sin_rol_todas_las_rutas import (
    PARAMETROS_DE_RUTA,
    RUTAS_PUBLICAS,
    _rutas_protegidas,
)
from tests.test_desglose_plan_accion import (
    _ADMINISTRADOR,
    COD,
    _contrato,
    _corte_registrado_con_una_meta,
    _proyecto,
    _rubro,
)

RUTA = "/api/v1/publico/plan-accion/actual"

# --- Lista blanca (D38). Si esta prueba falla porque agregaste un campo al DTO
# público, es una decisión de producto: no basta con "arreglar" el conjunto.
CLAVES_RAIZ = {"corte_id", "vigencia", "fecha_corte", "filas", "resumen"}
CLAVES_RESUMEN = {"total", "completo", "parcial", "sin_informacion"}
CLAVES_FILA = {
    "sector",
    "cod_indicador_producto",
    "nombre_producto",
    "meta_programada",
    "cod_bpin",
    "rubros",
    "presupuesto_definitivo",
    "ejecucion",
    "contratos",
    "avance_fisico_pct",
    "avance_financiero_pct",
    "estado_cruce",
    "bpins",
    "desglose",
}
CLAVES_RUBRO = {"codigo_rubro", "presupuesto_definitivo", "ejecucion", "contratos"}
CLAVES_CONTRATO = {"numero_contrato"}

OBJETO_SECRETO = "OBJETO-SECRETO-DEL-CONTRATO"
VALOR_SECRETO = "987654321"
PAGADO_SECRETO = "123456789"


@pytest.fixture()
def anonimo(sesion):
    """Cliente SIN token y sin override de usuario: lo único sustituido es la
    sesión de base de datos."""
    app = crear_app()

    def _sesion_de_prueba():
        yield sesion

    app.dependency_overrides[get_session] = _sesion_de_prueba
    with TestClient(app) as c:
        yield c


def _sembrar_corte_con_contrato(sesion) -> uuid.UUID:
    corte_id = _corte_registrado_con_una_meta(sesion)
    _proyecto(sesion, corte_id, "2024190010001")
    rubro_id = _rubro(sesion, corte_id, "2.3.2.02.02.009", "1000", "400")
    _contrato(
        sesion,
        corte_id,
        "CTO-001",
        [rubro_id],
        objeto=OBJETO_SECRETO,
        valor_contrato=VALOR_SECRETO,
        valor_pagado=PAGADO_SECRETO,
        nombre_contratista="CONTRATISTA-PRIVADO",
        nit_contratista="900123456",
    )
    sesion.commit()
    return corte_id


class TestAccesoSinToken:
    def test_sin_token_devuelve_200_con_los_datos_del_corte(self, anonimo, sesion) -> None:
        corte_id = _sembrar_corte_con_contrato(sesion)

        respuesta = anonimo.get(RUTA)

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["corte_id"] == str(corte_id)
        assert cuerpo["vigencia"] == 2026
        assert cuerpo["fecha_corte"] == "2026-06-30"
        assert cuerpo["filas"][0]["cod_indicador_producto"] == COD  # cero a la izquierda
        assert cuerpo["filas"][0]["contratos"] == ["CTO-001"]
        assert cuerpo["resumen"]["total"] == 1

    def test_un_token_invalido_no_cambia_el_resultado(self, anonimo, sesion) -> None:
        _sembrar_corte_con_contrato(sesion)
        base = anonimo.get(RUTA).json()

        con_basura = anonimo.get(RUTA, headers={"Authorization": "Bearer basura"})

        assert con_basura.status_code == 200
        assert con_basura.json() == base

    def test_sin_ningun_corte_registrado_devuelve_404(self, anonimo, sesion) -> None:
        sesion.add(CorteORM(id=uuid.uuid4(), vigencia=2026, fecha_corte=date(2026, 1, 1)))
        sesion.commit()

        respuesta = anonimo.get(RUTA)

        assert respuesta.status_code == 404
        assert respuesta.json()["codigo"] == "recurso_no_encontrado"

    def test_con_una_fuente_faltante_devuelve_409(self, anonimo, sesion) -> None:
        corte_id = uuid.uuid4()
        sesion.add(
            CorteORM(
                id=corte_id,
                vigencia=2026,
                fecha_corte=date(2026, 1, 1),
                estado=EstadoCorte.REGISTRADO,
            )
        )
        sesion.flush()
        sesion.add(
            ArchivoFuenteORM(
                id=uuid.uuid4(),
                corte_id=corte_id,
                tipo=TipoArchivoFuente.PDT,
                nombre_archivo="pdt.xlsx",
            )
        )
        sesion.commit()

        respuesta = anonimo.get(RUTA)

        assert respuesta.status_code == 409
        assert respuesta.json()["detalles"]["motivo"] == "fuentes_incompletas"

    def test_un_corte_en_borrador_no_se_publica(self, anonimo, sesion) -> None:
        corte_id = _sembrar_corte_con_contrato(sesion)
        sesion.get(CorteORM, corte_id).estado = EstadoCorte.BORRADOR
        sesion.commit()

        assert anonimo.get(RUTA).status_code == 404


class TestListaBlancaDeCampos:
    def test_solo_se_exponen_las_claves_de_la_lista_blanca(self, anonimo, sesion) -> None:
        _sembrar_corte_con_contrato(sesion)

        cuerpo = anonimo.get(RUTA).json()

        assert set(cuerpo) == CLAVES_RAIZ
        assert set(cuerpo["resumen"]) == CLAVES_RESUMEN
        fila = cuerpo["filas"][0]
        assert set(fila) == CLAVES_FILA
        assert fila["desglose"], "la prueba necesita un desglose para ser significativa"
        for rubro in fila["desglose"]:
            assert set(rubro) == CLAVES_RUBRO
            assert rubro["contratos"], "la prueba necesita un contrato para ser significativa"
            for contrato in rubro["contratos"]:
                assert set(contrato) == CLAVES_CONTRATO

    def test_los_datos_del_contrato_no_aparecen_en_ninguna_parte_de_la_respuesta(
        self, anonimo, sesion
    ) -> None:
        _sembrar_corte_con_contrato(sesion)

        texto = anonimo.get(RUTA).text

        for secreto in (
            OBJETO_SECRETO,
            VALOR_SECRETO,
            PAGADO_SECRETO,
            "CONTRATISTA-PRIVADO",
            "900123456",
        ):
            assert secreto not in texto
        assert "CTO-001" in texto  # el número de contrato sí es público

    def test_el_desglose_conserva_montos_por_rubro_y_numeros_de_contrato(
        self, anonimo, sesion
    ) -> None:
        _sembrar_corte_con_contrato(sesion)

        rubro = anonimo.get(RUTA).json()["filas"][0]["desglose"][0]

        assert rubro["codigo_rubro"] == "2.3.2.02.02.009"
        assert rubro["presupuesto_definitivo"] is not None
        assert rubro["ejecucion"] is not None
        assert rubro["contratos"] == [{"numero_contrato": "CTO-001"}]

    def test_es_igual_a_la_ruta_protegida_salvo_los_campos_quitados_del_contrato(
        self, anonimo, sesion
    ) -> None:
        """Mismo contrato para que el frontend reutilice la pantalla: lo único
        que cambia es el detalle de cada contrato."""
        _sembrar_corte_con_contrato(sesion)
        anonimo.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADOR
        protegido = anonimo.get("/api/v1/plan-accion/actual").json()
        anonimo.app.dependency_overrides.pop(obtener_usuario_actual)

        for fila in protegido["filas"]:
            for rubro in fila["desglose"]:
                rubro["contratos"] = [
                    {"numero_contrato": c["numero_contrato"]} for c in rubro["contratos"]
                ]

        assert anonimo.get(RUTA).json() == protegido

    def test_los_dto_publicos_no_heredan_ni_reutilizan_los_dto_protegidos(self) -> None:
        from app.modules.plan_accion.api import router, router_publico

        pares = [
            (router_publico.FilaPlanAccionPublicaRespuesta, router.FilaPlanAccionRespuesta),
            (router_publico.RubroDesglosePublicoRespuesta, router.RubroDesgloseRespuesta),
            (router_publico.ContratoDesglosePublicoRespuesta, router.ContratoDesgloseRespuesta),
            (router_publico.PlanAccionPublicoRespuesta, router.PlanAccionRespuesta),
            (router_publico.ResumenPlanAccionPublicoRespuesta, router.ResumenPlanAccionRespuesta),
        ]
        for publico, protegido in pares:
            assert not issubclass(publico, protegido)
            assert publico is not protegido


class TestParametrosInyectados:
    @pytest.mark.parametrize(
        "consulta",
        [
            "sector=Infraestructura",
            "sector=' OR 1=1 --",
            "busqueda=%'; DROP TABLE corte; --",
            "cod_indicador_producto=999999999",
            "estado_cruce=completo&estado_cruce=zzz",
            "corte_id=00000000-0000-0000-0000-000000000000",
            "vigencia=1900",
            "limit=1&offset=5&sort=-ejecucion",
            "campos=objeto,valor",
        ],
    )
    def test_los_parametros_de_consulta_se_ignoran(self, anonimo, sesion, consulta: str) -> None:
        _sembrar_corte_con_contrato(sesion)
        base = anonimo.get(RUTA).json()

        respuesta = anonimo.get(f"{RUTA}?{consulta}")

        assert respuesta.status_code == 200
        assert respuesta.json() == base

    def test_el_segmento_de_ruta_no_se_interpreta(self, anonimo, sesion) -> None:
        _sembrar_corte_con_contrato(sesion)
        for ruta in (
            "/api/v1/publico/plan-accion/actual/../../cortes",
            "/api/v1/publico/plan-accion/%2e%2e/cortes",
            "/api/v1/publico/plan-accion/actual%00",
        ):
            respuesta = anonimo.get(ruta, follow_redirects=False)
            assert respuesta.status_code in (307, 404)
            assert "cortes" not in respuesta.text.lower() or respuesta.status_code == 404


class TestSuperficiePublica:
    def test_solo_existe_una_ruta_publica_y_es_get(self) -> None:
        paths = crear_app().openapi()["paths"]
        publicas = {r: set(ops) for r, ops in paths.items() if "/publico" in r}

        assert publicas == {RUTA: {"get"}}

    @pytest.mark.parametrize("metodo", ["POST", "PUT", "PATCH", "DELETE"])
    def test_los_verbos_de_escritura_no_estan_permitidos(self, anonimo, metodo: str) -> None:
        assert anonimo.request(metodo, RUTA).status_code == 405

    @pytest.mark.parametrize(
        "ruta",
        [
            "/api/v1/publico/plan-accion/exportar",
            "/api/v1/publico/plan-accion/comparar",
            "/api/v1/publico/plan-accion/riesgo",
            "/api/v1/publico/plan-accion/cortes-disponibles",
            "/api/v1/publico/cortes",
            "/api/v1/publico/matriz",
            "/api/v1/publico/matriz-relacion/actual",
            "/api/v1/publico/trazabilidad/actual",
        ],
    )
    def test_no_hay_nada_mas_bajo_el_prefijo_publico(self, anonimo, ruta: str) -> None:
        assert anonimo.get(ruta).status_code == 404

    def test_la_ruta_publica_esta_en_la_lista_por_nombre_y_fuera_de_las_protegidas(self) -> None:
        assert RUTA in RUTAS_PUBLICAS
        assert all(r != RUTA for _m, r in _rutas_protegidas())


@pytest.mark.parametrize(("metodo", "ruta"), _rutas_protegidas())
def test_toda_otra_ruta_sigue_respondiendo_401_sin_token(anonimo, metodo: str, ruta: str) -> None:
    url = ruta
    for marcador, valor in PARAMETROS_DE_RUTA.items():
        url = url.replace(marcador, valor)

    respuesta = anonimo.request(metodo, url)

    assert respuesta.status_code == 401, f"{metodo} {ruta}: {respuesta.status_code}"
    assert respuesta.json()["codigo"] == "credenciales_invalidas"


def test_hay_rutas_no_publicas_que_verificar() -> None:
    assert len(_rutas_protegidas()) >= 15
