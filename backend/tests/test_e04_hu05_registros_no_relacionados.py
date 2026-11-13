"""[E-04/HU-05] Registros no relacionados (alertas de cruce).

TARJETA: [E-04/HU-05] BE. Fuente: hoja HU_E04_05 del levantamiento v3.0 y
el refinamiento del 2026-11-11 (catálogo cerrado de 9 motivos).

Base de cada prueba: un corte REGISTRADO con una meta COMPLETAMENTE
relacionada (proyecto, rubro válido y contrato de INVERSIÓN por registro
presupuestal), que no debe aparecer en ningún motivo. Cada prueba agrega
solo el registro inconsistente que quiere comprobar. SQL real (SQLite en
memoria, fixtures de conftest.py).
"""

from __future__ import annotations

import io
import uuid
from datetime import date
from decimal import Decimal

import openpyxl
import pytest

from app.core.dependencias import obtener_usuario_actual
from app.modules.alertas.domain.registros_no_relacionados import (
    FiltrosNoRelacionados,
    Fuente,
    Motivo,
    RegistroNoRelacionado,
    consultar,
)
from app.modules.alertas.persistence.consultas import listar_registros_no_relacionados
from app.modules.cortes.domain.entidades import EstadoCorte, TipoArchivoFuente
from app.modules.cortes.persistence.models import (
    ArchivoFuenteORM,
    ContratoORM,
    CorteORM,
    MetaORM,
    ProyectoIndicadorORM,
    ProyectoORM,
    RegistroPresupuestalORM,
    RubroORM,
)
from app.modules.identidad.domain.entidades import Rol, Usuario

_ADMIN = Usuario(id="a1", correo="admin@santarosa.gov.co", roles=frozenset({Rol.ADMINISTRADOR}))
_VISITANTE = Usuario(id="v1", correo="alcalde@santarosa.gov.co", roles=frozenset({Rol.VISITANTE}))
_GESTOR = Usuario(id="g1", correo="gestor@santarosa.gov.co", roles=frozenset({Rol.GESTOR}))

META_OK = "040110500"  # empieza en cero a propósito
BPIN_OK = "2024196980001"


class _Corte:
    """Constructor de datos de prueba sobre un corte."""

    def __init__(
        self,
        sesion,
        *,
        estado=EstadoCorte.REGISTRADO,
        fuentes=tuple(TipoArchivoFuente),
        fecha=date(2026, 6, 30),
    ):
        self.s = sesion
        self.id = uuid.uuid4()
        sesion.add(CorteORM(id=self.id, vigencia=fecha.year, fecha_corte=fecha, estado=estado))
        sesion.flush()
        for tipo in fuentes:
            sesion.add(
                ArchivoFuenteORM(
                    id=uuid.uuid4(), corte_id=self.id, tipo=tipo, nombre_archivo=f"{tipo}.xlsx"
                )
            )

    def meta(self, codigo: str, nombre: str | None = None) -> None:
        self.s.add(
            MetaORM(
                id=uuid.uuid4(),
                corte_id=self.id,
                cod_indicador_producto=codigo,
                nombre_producto=nombre or f"Meta {codigo}",
                es_principal=True,
            )
        )

    def proyecto(self, bpin: str | None, *indicadores: str, raw: str | None = None):
        proyecto = ProyectoORM(
            id=uuid.uuid4(),
            corte_id=self.id,
            bpin=bpin,
            nombre_proyecto=f"Proyecto {bpin}",
            indicador_producto_raw=raw,
        )
        self.s.add(proyecto)
        self.s.flush()
        for codigo in indicadores:
            self.s.add(
                ProyectoIndicadorORM(
                    id=uuid.uuid4(), proyecto_id=proyecto.id, cod_indicador_producto=codigo
                )
            )
        return proyecto

    def rubro(
        self,
        nivel: str,
        indicador: str | None,
        *,
        sector: str | None = "22",
        ultimo_nivel: bool = True,
        apropiacion: str = "1000",
    ) -> RubroORM:
        rubro = RubroORM(
            id=uuid.uuid4(),
            corte_id=self.id,
            codigo_rubro_nivel=nivel,
            cod_indicador_producto=indicador,
            ultimo_nivel=ultimo_nivel,
            codigo_sector_ccpet=sector,
            nombre_sector_ccpet="Educación",
            apropiacion_definitiva=Decimal(apropiacion),
        )
        self.s.add(rubro)
        self.s.flush()
        return rubro

    def contrato(
        self,
        numero: str,
        *,
        rubro: RubroORM | None = None,
        codigo_rubro_crudo: str | None = None,
        tipo_gasto: str = "INVERSIÓN",
        bpin: str | None = None,
        valor: str = "500",
        objeto: str | None = None,
    ) -> ContratoORM:
        contrato = ContratoORM(
            id=uuid.uuid4(),
            corte_id=self.id,
            numero_contrato=numero,
            tipo_gasto=tipo_gasto,
            bpin=bpin,
            valor_contrato=Decimal(valor),
            objeto=objeto or f"Objeto {numero}",
        )
        self.s.add(contrato)
        self.s.flush()
        self.s.add(
            RegistroPresupuestalORM(
                id=uuid.uuid4(),
                contrato_id=contrato.id,
                rubro_id=rubro.id if rubro else None,
                codigo_rubro_crudo=codigo_rubro_crudo
                or (rubro.codigo_rubro_nivel if rubro else None),
                valor_registro_ptal=Decimal("300"),
            )
        )
        return contrato

    def meta_completa(self, codigo: str = META_OK, bpin: str = BPIN_OK) -> None:
        self.meta(codigo)
        self.proyecto(bpin, codigo)
        rubro = self.rubro(f"R-{codigo}", codigo)
        self.contrato(f"C-{codigo}", rubro=rubro, bpin=bpin)


def _registros(sesion, corte: _Corte) -> list[RegistroNoRelacionado]:
    sesion.flush()
    return listar_registros_no_relacionados(sesion, corte.id)


def _motivos(sesion, corte: _Corte) -> list[tuple[Motivo, str | None]]:
    return sorted(((r.motivo, r.codigo) for r in _registros(sesion, corte)), key=str)


@pytest.fixture()
def corte(sesion) -> _Corte:
    c = _Corte(sesion)
    c.meta_completa()
    return c


# --- Base -------------------------------------------------------------------


def test_ca06_un_corte_completamente_relacionado_no_tiene_registros(sesion, corte) -> None:
    assert _registros(sesion, corte) == []


# --- CA03: un caso por motivo -----------------------------------------------


class TestPlanIndicativo:
    def test_meta_sin_proyecto(self, sesion, corte) -> None:
        corte.meta("330105300")
        rubro = corte.rubro("R-330105300", "330105300")
        corte.contrato("C-2", rubro=rubro)

        assert _motivos(sesion, corte) == [(Motivo.META_SIN_PROYECTO, "330105300")]

    def test_meta_sin_ejecucion(self, sesion, corte) -> None:
        corte.meta("330105300")
        corte.proyecto("2024000000002", "330105300")

        assert _motivos(sesion, corte) == [(Motivo.META_SIN_EJECUCION, "330105300")]

    def test_meta_sin_contrato(self, sesion, corte) -> None:
        corte.meta("330105300")
        corte.proyecto("2024000000002", "330105300")
        corte.rubro("R-330105300", "330105300")

        assert _motivos(sesion, corte) == [(Motivo.META_SIN_CONTRATO, "330105300")]

    def test_una_meta_con_dos_motivos_aparece_dos_veces(self, sesion, corte) -> None:
        """Decisión 2 del refinamiento: una fila por (registro, motivo)."""
        corte.meta("330105300")

        assert _motivos(sesion, corte) == [
            (Motivo.META_SIN_EJECUCION, "330105300"),
            (Motivo.META_SIN_PROYECTO, "330105300"),
        ]

    def test_una_meta_repetida_en_el_pdt_aparece_una_vez(self, sesion, corte) -> None:
        corte.meta("330105300")
        corte.meta("330105300")
        corte.proyecto("2024000000002", "330105300")

        assert _motivos(sesion, corte) == [(Motivo.META_SIN_EJECUCION, "330105300")]

    def test_meta_sin_contrato_no_se_reporta_si_ya_no_tiene_ejecucion(self, sesion, corte) -> None:
        """Sin rubro ya es `meta_sin_ejecucion`; no se duplica como sin contrato."""
        corte.meta("330105300")
        corte.proyecto("2024000000002", "330105300")

        motivos = {m for m, _ in _motivos(sesion, corte)}
        assert Motivo.META_SIN_CONTRATO not in motivos

    def test_los_ceros_a_la_izquierda_no_se_pierden(self, sesion, corte) -> None:
        """'040110500' y '40110500' son metas distintas: una sin el cero no
        se relaciona con el proyecto de la otra."""
        corte.meta("40110500")
        corte.proyecto("2024000000002", "40110500")
        rubro = corte.rubro("R-40110500", "40110500")
        corte.contrato("C-2", rubro=rubro)
        corte.meta("030110500")

        codigos = {codigo for _, codigo in _motivos(sesion, corte)}
        assert codigos == {"030110500"}


class TestPresupuestal:
    def test_rubro_con_indicador_que_no_existe_en_el_pdt(self, sesion, corte) -> None:
        corte.rubro("R-999", "999999999", apropiacion="2500000")

        (registro,) = _registros(sesion, corte)
        assert registro.motivo is Motivo.RUBRO_INDICADOR_NO_EXISTE_EN_PDT
        assert registro.codigo == "R-999"
        assert registro.valor == Decimal("2500000")
        assert "Indicador 999999999" in registro.descripcion

    def test_rubro_sin_indicador(self, sesion, corte) -> None:
        corte.rubro("R-SIN", None)

        assert _motivos(sesion, corte) == [(Motivo.RUBRO_SIN_INDICADOR, "R-SIN")]

    def test_registro_con_rubro_que_no_existe_en_la_ejecucion(self, sesion, corte) -> None:
        corte.contrato("C-9", codigo_rubro_crudo="2.3.2.02.02.008-9999")

        (registro,) = _registros(sesion, corte)
        assert registro.motivo is Motivo.REGISTRO_RUBRO_NO_EXISTE
        assert registro.codigo == "2.3.2.02.02.008-9999"
        assert registro.descripcion == "Contrato C-9"
        assert registro.valor == Decimal("300")

    def test_contrato_con_bpin_que_no_existe_en_la_plantilla(self, sesion, corte) -> None:
        rubro = corte.rubro("R-2", META_OK)
        corte.contrato("C-7", rubro=rubro, bpin="2099000000000", valor="750000")

        (registro,) = _registros(sesion, corte)
        assert registro.motivo is Motivo.CONTRATO_BPIN_NO_EXISTE_EN_PLANTILLA
        assert registro.codigo == "C-7"
        assert registro.valor == Decimal("750000")

    def test_un_contrato_sin_bpin_no_se_reporta_por_bpin(self, sesion, corte) -> None:
        rubro = corte.rubro("R-2", META_OK)
        corte.contrato("C-7", rubro=rubro, bpin=None)

        assert _registros(sesion, corte) == []

    @pytest.mark.parametrize(
        ("bpin_contrato", "bpin_plantilla"),
        [
            ("20260000006448", "202600000006448"),
            ("2025000000050662", "202500000050662"),
            (" 202600000006448 ", "202600000006448"),
        ],
    )
    def test_el_bpin_se_compara_sin_los_ceros_de_relleno(
        self, sesion, corte, bpin_contrato, bpin_plantilla
    ) -> None:
        """Con los archivos reales de la clienta (2026-11-12), 10 de 17
        contratos "sin BPIN en la plantilla" sí estaban: solo cambiaba el
        relleno de ceros entre el año y el consecutivo (14 o 16 dígitos en
        la ejecución, 15 en la plantilla). Reportarlos como inexistentes
        sería falso."""
        corte.proyecto(bpin_plantilla, META_OK)
        rubro = corte.rubro("R-2", META_OK)
        corte.contrato("C-7", rubro=rubro, bpin=bpin_contrato)

        assert _registros(sesion, corte) == []

    def test_un_bpin_de_otro_anio_o_consecutivo_si_se_reporta(self, sesion, corte) -> None:
        corte.proyecto("202600000006448", META_OK)
        rubro = corte.rubro("R-2", META_OK)
        corte.contrato("C-7", rubro=rubro, bpin="20250000006448")
        corte.contrato("C-8", rubro=rubro, bpin="20260000006449")

        assert {r.codigo for r in _registros(sesion, corte)} == {"C-7", "C-8"}

    def test_un_bpin_no_numerico_se_compara_tal_cual(self, sesion, corte) -> None:
        corte.proyecto("BPIN-ABC", META_OK)
        rubro = corte.rubro("R-2", META_OK)
        corte.contrato("C-7", rubro=rubro, bpin="BPIN-ABC")
        corte.contrato("C-8", rubro=rubro, bpin="BPIN-XYZ")

        assert [r.codigo for r in _registros(sesion, corte)] == ["C-8"]


class TestBpin:
    def test_proyecto_con_indicador_que_no_existe_en_el_pdt(self, sesion, corte) -> None:
        corte.proyecto("2024000000009", "888888888")

        (registro,) = _registros(sesion, corte)
        assert registro.motivo is Motivo.PROYECTO_INDICADOR_NO_EXISTE_EN_PDT
        assert registro.codigo == "2024000000009"
        assert "Indicador 888888888" in registro.descripcion
        assert registro.valor is None

    def test_proyecto_sin_indicador_muestra_el_texto_crudo(self, sesion, corte) -> None:
        corte.proyecto("2024000000010", raw="Producto sin código")

        (registro,) = _registros(sesion, corte)
        assert registro.motivo is Motivo.PROYECTO_SIN_INDICADOR
        assert "Producto sin código" in registro.descripcion


class TestExclusionesDelCruce:
    """Decisión 5 (R): lo excluido a propósito no es 'no relacionado'."""

    @pytest.mark.parametrize("sector", [None, "", "NA", "na"])
    def test_rubro_con_sector_invalido_no_cuenta_regla_1b(self, sesion, corte, sector) -> None:
        corte.rubro("R-X", "999999999", sector=sector)
        corte.rubro("R-Y", None, sector=sector)

        assert _registros(sesion, corte) == []

    def test_subtotal_de_ejecucion_no_cuenta(self, sesion, corte) -> None:
        corte.rubro("R-SUB", "999999999", ultimo_nivel=False)

        assert _registros(sesion, corte) == []

    def test_contrato_que_no_es_de_inversion_no_cuenta_regla_1c(self, sesion, corte) -> None:
        corte.contrato("C-F", codigo_rubro_crudo="X", tipo_gasto="FUNCIONAMIENTO", bpin="2099")

        assert _registros(sesion, corte) == []

    def test_un_rubro_con_sector_invalido_no_cuenta_como_ejecucion_de_la_meta(
        self, sesion, corte
    ) -> None:
        """Coherente con el cruce: si el único rubro de la meta tiene sector
        "NA", la meta queda sin ejecución."""
        corte.meta("330105300")
        corte.proyecto("2024000000002", "330105300")
        corte.rubro("R-NA", "330105300", sector="NA")

        assert _motivos(sesion, corte) == [(Motivo.META_SIN_EJECUCION, "330105300")]

    def test_un_contrato_de_funcionamiento_no_cuenta_como_contrato_de_la_meta(
        self, sesion, corte
    ) -> None:
        corte.meta("330105300")
        corte.proyecto("2024000000002", "330105300")
        rubro = corte.rubro("R-3", "330105300")
        corte.contrato("C-F", rubro=rubro, tipo_gasto="FUNCIONAMIENTO")

        assert _motivos(sesion, corte) == [(Motivo.META_SIN_CONTRATO, "330105300")]

    def test_otro_corte_no_contamina(self, sesion, corte) -> None:
        otro = _Corte(sesion, fecha=date(2026, 3, 31))
        otro.meta("330105300")
        otro.rubro("R-999", "999999999")

        assert _registros(sesion, corte) == []


# --- Dominio: filtros, conteos, orden y paginación (CA04, CA05) ------------


def _r(motivo: Motivo, codigo: str) -> RegistroNoRelacionado:
    return RegistroNoRelacionado(motivo=motivo, codigo=codigo, descripcion=None, valor=None)


_MUESTRA = [
    _r(Motivo.PROYECTO_SIN_INDICADOR, "B1"),
    _r(Motivo.META_SIN_PROYECTO, "002"),
    _r(Motivo.RUBRO_SIN_INDICADOR, "R1"),
    _r(Motivo.META_SIN_PROYECTO, "001"),
    _r(Motivo.META_SIN_EJECUCION, "001"),
]


class TestDominio:
    def test_ca05_total_igual_a_la_suma_por_fuente(self) -> None:
        resultado = consultar(_MUESTRA, FiltrosNoRelacionados(), 1, 50)

        assert resultado.total == 5
        assert resultado.conteos_por_fuente == {
            Fuente.PLAN_INDICATIVO: 3,
            Fuente.PRESUPUESTAL: 1,
            Fuente.BPIN: 1,
        }
        assert sum(resultado.conteos_por_fuente.values()) == resultado.total

    def test_orden_estable_por_fuente_motivo_y_codigo(self) -> None:
        resultado = consultar(_MUESTRA, FiltrosNoRelacionados(), 1, 50)

        assert [(r.motivo, r.codigo) for r in resultado.filas] == [
            (Motivo.META_SIN_PROYECTO, "001"),
            (Motivo.META_SIN_PROYECTO, "002"),
            (Motivo.META_SIN_EJECUCION, "001"),
            (Motivo.RUBRO_SIN_INDICADOR, "R1"),
            (Motivo.PROYECTO_SIN_INDICADOR, "B1"),
        ]

    def test_ca04_or_dentro_del_criterio(self) -> None:
        filtros = FiltrosNoRelacionados(fuentes=(Fuente.PRESUPUESTAL, Fuente.BPIN))

        assert consultar(_MUESTRA, filtros, 1, 50).total == 2

    def test_ca04_and_entre_criterios(self) -> None:
        filtros = FiltrosNoRelacionados(
            fuentes=(Fuente.PLAN_INDICATIVO,), motivos=(Motivo.META_SIN_PROYECTO,)
        )

        resultado = consultar(_MUESTRA, filtros, 1, 50)
        assert resultado.total == 2
        assert resultado.conteos_por_fuente[Fuente.PRESUPUESTAL] == 0

    def test_ca04_un_motivo_de_otra_fuente_con_and_da_vacio(self) -> None:
        filtros = FiltrosNoRelacionados(fuentes=(Fuente.BPIN,), motivos=(Motivo.META_SIN_PROYECTO,))

        assert consultar(_MUESTRA, filtros, 1, 50).total == 0

    def test_los_filtros_se_aplican_antes_de_paginar(self) -> None:
        filtros = FiltrosNoRelacionados(motivos=(Motivo.META_SIN_PROYECTO,))

        resultado = consultar(_MUESTRA, filtros, pagina=2, tamano_pagina=1)

        assert resultado.total == 2
        assert [r.codigo for r in resultado.filas] == ["002"]

    def test_una_pagina_fuera_de_rango_da_filas_vacias_con_el_total(self) -> None:
        resultado = consultar(_MUESTRA, FiltrosNoRelacionados(), pagina=9, tamano_pagina=50)

        assert resultado.filas == ()
        assert resultado.total == 5


# --- Endpoints ---------------------------------------------------------------


@pytest.fixture()
def cliente_admin(cliente):
    cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMIN
    return cliente


def _url(corte: _Corte, sufijo: str = "") -> str:
    return f"/api/v1/registros-no-relacionados/{corte.id}{sufijo}"


class TestEndpoint:
    def test_ca01_ca02_devuelve_las_filas_con_su_forma(self, cliente_admin, sesion, corte) -> None:
        corte.meta("330105300")
        sesion.commit()

        cuerpo = cliente_admin.get(_url(corte)).json()

        assert cuerpo["total"] == 2
        assert cuerpo["conteos_por_fuente"] == {"PLAN_INDICATIVO": 2, "PRESUPUESTAL": 0, "BPIN": 0}
        fila = cuerpo["filas"][0]
        assert set(fila) == {
            "fuente",
            "fuente_etiqueta",
            "codigo",
            "descripcion",
            "valor",
            "motivo",
            "motivo_etiqueta",
        }
        assert fila["fuente_etiqueta"] == "Plan Indicativo"
        assert fila["codigo"] == "330105300"
        assert fila["valor"] is None
        assert fila["motivo_etiqueta"] == "Meta sin proyecto BPIN"

    def test_ca03_el_catalogo_es_un_enum_en_el_openapi(self, cliente_admin) -> None:
        esquemas = cliente_admin.get("/openapi.json").json()["components"]["schemas"]

        assert set(esquemas["Motivo"]["enum"]) == {m.value for m in Motivo}
        assert set(esquemas["Fuente"]["enum"]) == {f.value for f in Fuente}

    def test_ca04_filtros_repetibles_por_query(self, cliente_admin, sesion, corte) -> None:
        corte.meta("330105300")
        corte.rubro("R-SIN", None)
        sesion.commit()

        cuerpo = cliente_admin.get(
            _url(corte), params=[("fuente", "PRESUPUESTAL"), ("motivo", "rubro_sin_indicador")]
        ).json()

        assert cuerpo["total"] == 1
        assert cuerpo["filas"][0]["codigo"] == "R-SIN"

    def test_un_motivo_fuera_del_catalogo_es_422(self, cliente_admin, sesion, corte) -> None:
        sesion.commit()

        assert cliente_admin.get(_url(corte), params={"motivo": "otro"}).status_code == 422

    def test_ca06_sin_no_relacionados_lista_vacia_y_total_cero(
        self, cliente_admin, sesion, corte
    ) -> None:
        sesion.commit()

        cuerpo = cliente_admin.get(_url(corte)).json()

        assert cuerpo["filas"] == []
        assert cuerpo["total"] == 0

    def test_paginacion(self, cliente_admin, sesion, corte) -> None:
        for i in range(5):
            corte.rubro(f"R-SIN-{i}", None)
        sesion.commit()

        cuerpo = cliente_admin.get(_url(corte), params={"pagina": 2, "tamano_pagina": 2}).json()

        assert cuerpo["total"] == 5
        assert [f["codigo"] for f in cuerpo["filas"]] == ["R-SIN-2", "R-SIN-3"]

    @pytest.mark.parametrize(
        "params", [{"pagina": 0}, {"tamano_pagina": 0}, {"tamano_pagina": 201}]
    )
    def test_paginacion_fuera_de_limites_es_422(self, cliente_admin, sesion, corte, params) -> None:
        sesion.commit()

        assert cliente_admin.get(_url(corte), params=params).status_code == 422

    def test_corte_inexistente_404(self, cliente_admin) -> None:
        url = f"/api/v1/registros-no-relacionados/{uuid.uuid4()}"

        assert cliente_admin.get(url).status_code == 404

    def test_corte_en_borrador_409(self, cliente_admin, sesion) -> None:
        borrador = _Corte(sesion, estado=EstadoCorte.BORRADOR)
        sesion.commit()

        respuesta = cliente_admin.get(_url(borrador))

        assert respuesta.status_code == 409
        assert respuesta.json()["detalles"]["motivo"] == "corte_no_registrado"

    def test_corte_con_fuentes_incompletas_409(self, cliente_admin, sesion) -> None:
        incompleto = _Corte(sesion, fuentes=(TipoArchivoFuente.PDT,))
        sesion.commit()

        respuesta = cliente_admin.get(_url(incompleto))

        assert respuesta.status_code == 409
        assert respuesta.json()["detalles"]["motivo"] == "fuentes_incompletas"

    def test_el_visitante_alcalde_puede_consultar(self, cliente, sesion, corte) -> None:
        sesion.commit()
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _VISITANTE

        assert cliente.get(_url(corte)).status_code == 200

    @pytest.mark.parametrize("sufijo", ["", "/exportar"])
    def test_el_gestor_no_tiene_acceso_d37(self, cliente, sesion, corte, sufijo) -> None:
        sesion.commit()
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _GESTOR

        assert cliente.get(_url(corte, sufijo)).status_code == 403


class TestExportar:
    def _libro(self, respuesta):
        assert respuesta.status_code == 200
        return openpyxl.load_workbook(io.BytesIO(respuesta.content)).active

    def test_ca07_ca05_el_excel_tiene_las_mismas_filas_que_el_total_filtrado(
        self, cliente_admin, sesion, corte
    ) -> None:
        corte.meta("330105300")
        corte.rubro("R-SIN", None)
        for i in range(3):
            corte.proyecto(f"20240000001{i}", f"77777777{i}")
        sesion.commit()
        filtros = [("fuente", "PLAN_INDICATIVO"), ("fuente", "BPIN")]

        total = cliente_admin.get(_url(corte), params=filtros).json()["total"]
        hoja = self._libro(cliente_admin.get(_url(corte, "/exportar"), params=filtros))

        filas = list(hoja.iter_rows(min_row=8, values_only=True))
        assert total == 5
        assert len(filas) == total
        assert {f[0] for f in filas} == {"Plan Indicativo", "BPIN"}
        assert "Filtros aplicados: Fuente: Plan Indicativo, BPIN" in hoja["A3"].value

    def test_el_excel_conserva_los_ceros_a_la_izquierda(self, cliente_admin, sesion, corte) -> None:
        corte.meta("030110500")
        sesion.commit()

        hoja = self._libro(cliente_admin.get(_url(corte, "/exportar")))

        assert hoja["B8"].value == "030110500"

    def test_el_excel_neutraliza_formulas_en_los_textos(self, cliente_admin, sesion, corte) -> None:
        corte.meta("330105300", nombre='=HYPERLINK("http://x","clic")')
        sesion.commit()

        hoja = self._libro(cliente_admin.get(_url(corte, "/exportar")))

        assert hoja["C8"].value.startswith("'=")

    def test_el_nombre_del_archivo_lleva_vigencia_y_fecha_del_corte(
        self, cliente_admin, sesion, corte
    ) -> None:
        sesion.commit()

        respuesta = cliente_admin.get(_url(corte, "/exportar"))

        assert (
            'filename="No_Relacionados_2026_Corte_2026-06-30.xlsx"'
            in respuesta.headers["content-disposition"]
        )
