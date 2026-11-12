"""Pruebas del dominio de Plan de Acción Consolidado (agregación por meta).

CUBRE: HU01-CA02, CA03, CA05, CA08 -- ver docs/DECISIONES.md D26 y el
docstring de `app/modules/plan_accion/domain/entidades.py`.

Son pruebas puras: sin FastAPI, sin SQLAlchemy, sin sesión -- exactamente
lo que la regla de arquitectura exige para el dominio (test_arquitectura.py).
"""

from __future__ import annotations

from dataclasses import replace
from decimal import Decimal

from app.modules.plan_accion.domain.entidades import (
    EstadoCruceMeta,
    FilaFuenteMeta,
    FiltrosPlanAccion,
    agregar_por_meta,
    calcular_resumen,
    filtrar_plan_accion,
)


def _fila(
    cod="000000001",
    nombre_producto="Producto X",
    sector="Educación",
    meta_cuatrienio=Decimal("100"),
    cod_bpin="2024000010001",
    codigo_rubro=None,
    presupuesto=None,
    ejecucion=None,
    contrato=None,
    objeto_contrato=None,
    valor_contrato=None,
    valor_pagado_contrato=None,
) -> FilaFuenteMeta:
    return FilaFuenteMeta(
        cod_indicador_producto=cod,
        nombre_producto=nombre_producto,
        sector=sector,
        meta_cuatrienio=meta_cuatrienio,
        cod_bpin=cod_bpin,
        codigo_rubro=codigo_rubro,
        presupuesto_apropiado=presupuesto,
        ejecucion=ejecucion,
        numero_contrato=contrato,
        objeto_contrato=objeto_contrato,
        valor_contrato=valor_contrato,
        valor_pagado_contrato=valor_pagado_contrato,
    )


class TestAgregarPorMetaUnaFilaPorMeta:
    """CA03: "sin duplicar los valores de la meta en los totales"."""

    def test_una_meta_con_tres_filas_crudas_produce_una_sola_fila_agregada(self):
        filas = [
            _fila(codigo_rubro="R1", presupuesto=Decimal("1000"), contrato="C1"),
            _fila(codigo_rubro="R1", presupuesto=Decimal("1000"), contrato="C2"),
            _fila(codigo_rubro="R1", presupuesto=Decimal("1000"), contrato="C3"),
        ]

        resultado = agregar_por_meta(filas)

        assert len(resultado) == 1
        assert resultado[0].contratos == ("C1", "C2", "C3")

    def test_metas_distintas_producen_filas_distintas(self):
        filas = [_fila(cod="000000001"), _fila(cod="000000002")]

        resultado = agregar_por_meta(filas)

        assert {f.cod_indicador_producto for f in resultado} == {"000000001", "000000002"}
        # Orden estable (CA02: tabla consolidada) -- por código ascendente.
        assert [f.cod_indicador_producto for f in resultado] == ["000000001", "000000002"]


class TestAgregarPorMetaSinDuplicarDinero:
    """CA08: el fan-out de 1 rubro -> N contratos NO debe sumarse N veces.

    Escenario real documentado en trazabilidad/persistence/consultas.py:
    un rubro vinculado a 3 contratos produce 3 filas crudas con el MISMO
    presupuesto/ejecución repetido -- `agregar_por_meta` debe sumarlo UNA
    sola vez, deduplicando por `codigo_rubro`, nunca por fila.
    """

    def test_un_rubro_con_tres_contratos_no_triplica_el_presupuesto(self):
        filas = [
            _fila(
                codigo_rubro="R1",
                presupuesto=Decimal("5000"),
                ejecucion=Decimal("2000"),
                contrato=c,
            )
            for c in ("C1", "C2", "C3")
        ]

        resultado = agregar_por_meta(filas)

        assert len(resultado) == 1
        assert resultado[0].presupuesto_definitivo == Decimal("5000")
        assert resultado[0].ejecucion == Decimal("2000")
        assert resultado[0].contratos == ("C1", "C2", "C3")

    def test_dos_rubros_distintos_de_la_misma_meta_si_se_suman(self):
        filas = [
            _fila(codigo_rubro="R1", presupuesto=Decimal("1000"), ejecucion=Decimal("100")),
            _fila(codigo_rubro="R2", presupuesto=Decimal("2000"), ejecucion=Decimal("300")),
        ]

        resultado = agregar_por_meta(filas)

        assert resultado[0].presupuesto_definitivo == Decimal("3000")
        assert resultado[0].ejecucion == Decimal("400")
        assert resultado[0].rubros == ("R1", "R2")


class TestAgregarPorMetaCamposNulosExplicitos:
    """CA06/CA-8 (heredado de HU-07): sin rubro/contrato, los totales deben
    ser `None`, nunca `Decimal(0)` -- distinguir "no hay dato" de "el dato
    es cero" (CA06: resaltar celdas vacías con leyenda, imposible si un
    0 inventado se confunde con un 0 real)."""

    def test_meta_sin_ningun_rubro_tiene_totales_en_none_no_en_cero(self):
        filas = [_fila(codigo_rubro=None, presupuesto=None, ejecucion=None, contrato=None)]

        resultado = agregar_por_meta(filas)

        assert resultado[0].presupuesto_definitivo is None
        assert resultado[0].ejecucion is None
        assert resultado[0].rubros == ()
        assert resultado[0].contratos == ()
        assert resultado[0].avance_financiero_pct is None

    def test_avance_fisico_siempre_es_none_sin_implementacion_de_e03(self):
        resultado = agregar_por_meta([_fila(codigo_rubro="R1", presupuesto=Decimal("100"))])

        assert resultado[0].avance_fisico_pct is None


class TestAgregarPorMetaAvanceFinanciero:
    def test_calcula_porcentaje_cuando_hay_presupuesto_y_ejecucion(self):
        filas = [_fila(codigo_rubro="R1", presupuesto=Decimal("200"), ejecucion=Decimal("50"))]

        resultado = agregar_por_meta(filas)

        assert resultado[0].avance_financiero_pct == Decimal("25")

    def test_no_divide_por_cero_cuando_el_presupuesto_es_cero(self):
        filas = [_fila(codigo_rubro="R1", presupuesto=Decimal("0"), ejecucion=Decimal("0"))]

        resultado = agregar_por_meta(filas)

        assert resultado[0].avance_financiero_pct is None


class TestAgregarPorMetaEstadoCruce:
    """CA05: "Completo = la meta relacionó PDT, presupuesto y BPIN; Parcial
    = falta al menos una relación; Sin información = solo existe en el
    PDT" -- texto literal del CA, no una definición inventada."""

    def test_meta_con_bpin_rubro_y_contrato_es_completo(self):
        filas = [_fila(cod_bpin="2024000010001", codigo_rubro="R1", contrato="C1")]

        resultado = agregar_por_meta(filas)

        assert resultado[0].estado_cruce == EstadoCruceMeta.COMPLETO

    def test_meta_sin_bpin_ni_rubro_ni_contrato_es_sin_informacion(self):
        filas = [_fila(cod_bpin=None, codigo_rubro=None, contrato=None)]

        resultado = agregar_por_meta(filas)

        assert resultado[0].estado_cruce == EstadoCruceMeta.SIN_INFORMACION

    def test_meta_con_bpin_pero_sin_rubro_es_parcial(self):
        filas = [_fila(cod_bpin="2024000010001", codigo_rubro=None, contrato=None)]

        resultado = agregar_por_meta(filas)

        assert resultado[0].estado_cruce == EstadoCruceMeta.PARCIAL

    def test_meta_con_rubro_pero_sin_bpin_ni_contrato_es_parcial(self):
        filas = [_fila(cod_bpin=None, codigo_rubro="R1", contrato=None)]

        resultado = agregar_por_meta(filas)

        assert resultado[0].estado_cruce == EstadoCruceMeta.PARCIAL

    def test_meta_con_todo_menos_contrato_es_parcial(self):
        filas = [_fila(cod_bpin="2024000010001", codigo_rubro="R1", contrato=None)]

        resultado = agregar_por_meta(filas)

        assert resultado[0].estado_cruce == EstadoCruceMeta.PARCIAL


class TestAgregarPorMetaVariosBpin:
    """H-027 (QA Sprint 2): una meta asociada a varios proyectos BPIN debe
    conservarlos todos. Antes solo quedaba el de la primera fila cruda, y
    cuál era dependía del orden en que llegaran las filas."""

    def test_conserva_todos_los_bpin_distintos_de_la_meta(self):
        filas = [_fila(cod_bpin="AAA"), _fila(cod_bpin="BBB"), _fila(cod_bpin="AAA")]

        (meta,) = agregar_por_meta(filas)

        assert meta.bpins == ("AAA", "BBB")

    def test_el_resultado_no_depende_del_orden_de_las_filas(self):
        en_un_orden = agregar_por_meta([_fila(cod_bpin="AAA"), _fila(cod_bpin="BBB")])
        en_el_otro = agregar_por_meta([_fila(cod_bpin="BBB"), _fila(cod_bpin="AAA")])

        assert en_un_orden == en_el_otro

    def test_cod_bpin_se_mantiene_por_compatibilidad_y_es_el_primero(self):
        (meta,) = agregar_por_meta([_fila(cod_bpin="BBB"), _fila(cod_bpin="AAA")])

        assert meta.cod_bpin == "AAA"

    def test_meta_sin_bpin_tiene_lista_vacia_y_cod_bpin_none(self):
        (meta,) = agregar_por_meta([_fila(cod_bpin=None)])

        assert meta.bpins == ()
        assert meta.cod_bpin is None

    def test_el_estado_de_cruce_ve_el_bpin_aunque_no_venga_en_la_primera_fila(self):
        """Antes el estado solo miraba la primera fila: una meta con BPIN en
        la segunda fila quedaba como si no tuviera proyecto."""
        filas = [
            _fila(cod_bpin=None, codigo_rubro="R1", presupuesto=Decimal("10"), contrato="C1"),
            _fila(cod_bpin="AAA", codigo_rubro="R1", presupuesto=Decimal("10"), contrato="C1"),
        ]

        (meta,) = agregar_por_meta(filas)

        assert meta.estado_cruce == EstadoCruceMeta.COMPLETO


class TestAgregarPorMetaDesglose:
    """E04-HU01-CA03: cadena Meta -> Rubro -> Contrato con todos sus
    elementos, sin duplicar valores en los totales."""

    def test_cada_rubro_trae_su_monto_y_sus_contratos(self):
        filas = [
            _fila(
                codigo_rubro="R1",
                presupuesto=Decimal("1000"),
                ejecucion=Decimal("400"),
                contrato="C1",
                objeto_contrato="Mantenimiento vial",
                valor_contrato=Decimal("300"),
                valor_pagado_contrato=Decimal("100"),
            ),
            _fila(
                codigo_rubro="R1",
                presupuesto=Decimal("1000"),
                ejecucion=Decimal("400"),
                contrato="C2",
                objeto_contrato="Interventoría",
                valor_contrato=Decimal("50"),
            ),
            _fila(codigo_rubro="R2", presupuesto=Decimal("500"), ejecucion=Decimal("0")),
        ]

        (meta,) = agregar_por_meta(filas)

        r1, r2 = meta.desglose
        assert (r1.codigo_rubro, r1.presupuesto_definitivo, r1.ejecucion) == (
            "R1",
            Decimal("1000"),
            Decimal("400"),
        )
        assert [c.numero_contrato for c in r1.contratos] == ["C1", "C2"]
        assert r1.contratos[0].objeto == "Mantenimiento vial"
        assert r1.contratos[0].valor == Decimal("300")
        assert r1.contratos[0].valor_pagado == Decimal("100")
        assert r1.contratos[1].valor_pagado is None
        assert (r2.codigo_rubro, r2.contratos) == ("R2", ())

    def test_la_suma_del_desglose_coincide_con_los_totales_de_la_meta(self):
        """La garantía de CA03/CA08: el detalle nunca contradice el total."""
        filas = [
            _fila(
                codigo_rubro="R1",
                presupuesto=Decimal("1000"),
                ejecucion=Decimal("400"),
                contrato="C1",
            ),
            _fila(
                codigo_rubro="R1",
                presupuesto=Decimal("1000"),
                ejecucion=Decimal("400"),
                contrato="C2",
            ),
            _fila(
                codigo_rubro="R2",
                presupuesto=Decimal("500"),
                ejecucion=Decimal("50"),
                contrato="C1",
            ),
        ]

        (meta,) = agregar_por_meta(filas)

        assert sum(r.presupuesto_definitivo for r in meta.desglose) == meta.presupuesto_definitivo
        assert sum(r.ejecucion for r in meta.desglose) == meta.ejecucion
        assert meta.presupuesto_definitivo == Decimal("1500")

    def test_un_contrato_repetido_en_filas_por_varios_bpin_aparece_una_sola_vez(self):
        """Fan-out BPIN x contrato: 2 BPIN y 1 contrato producen 2 filas
        crudas con el mismo contrato; en el desglose es uno solo."""
        filas = [
            _fila(cod_bpin="AAA", codigo_rubro="R1", presupuesto=Decimal("10"), contrato="C1"),
            _fila(cod_bpin="BBB", codigo_rubro="R1", presupuesto=Decimal("10"), contrato="C1"),
        ]

        (meta,) = agregar_por_meta(filas)

        assert len(meta.desglose) == 1
        assert [c.numero_contrato for c in meta.desglose[0].contratos] == ["C1"]
        assert meta.presupuesto_definitivo == Decimal("10")

    def test_meta_sin_rubros_tiene_desglose_vacio(self):
        (meta,) = agregar_por_meta([_fila()])

        assert meta.desglose == ()

    def test_las_listas_planas_siguen_coincidiendo_con_el_desglose(self):
        """`rubros` y `contratos` (contrato anterior de la API) se conservan
        y son coherentes con el desglose nuevo."""
        filas = [
            _fila(codigo_rubro="R2", presupuesto=Decimal("1"), contrato="C9"),
            _fila(codigo_rubro="R1", presupuesto=Decimal("1"), contrato="C1"),
        ]

        (meta,) = agregar_por_meta(filas)

        assert meta.rubros == tuple(r.codigo_rubro for r in meta.desglose) == ("R1", "R2")
        assert meta.contratos == ("C1", "C9")


class TestCalcularResumen:
    """CA05: pie de la tabla -- "Total: N | Completo: a | Parcial: b |
    Sin información: c"; invariante total == completo+parcial+sin_info."""

    def test_resumen_cuenta_cada_estado_y_cuadra_el_total(self):
        filas = agregar_por_meta(
            [
                _fila(cod="1", cod_bpin="b", codigo_rubro="r", contrato="c"),  # completo
                _fila(cod="2", cod_bpin="b", codigo_rubro=None, contrato=None),  # parcial
                _fila(cod="3", cod_bpin=None, codigo_rubro=None, contrato=None),  # sin_info
            ]
        )

        resumen = calcular_resumen(filas)

        assert resumen.total == 3
        assert resumen.completo == 1
        assert resumen.parcial == 1
        assert resumen.sin_informacion == 1
        assert resumen.total == resumen.completo + resumen.parcial + resumen.sin_informacion

    def test_resumen_de_lista_vacia_es_todo_cero(self):
        resumen = calcular_resumen([])

        assert resumen.total == 0
        assert resumen.completo == 0
        assert resumen.parcial == 0
        assert resumen.sin_informacion == 0


class TestFiltrarPlanAccion:
    """[E04-HU02] CA02, CA03, CA04, CA05: filtros sobre filas YA agregadas
    por meta -- ver docstring de `FiltrosPlanAccion`."""

    def _fila_agregada(
        self, cod="000000001", sector="Educación", nombre="Vías pavimentadas", estado=None
    ):
        filas = agregar_por_meta(
            [_fila(cod=cod, sector=sector, nombre_producto=nombre, cod_bpin=None)]
        )
        fila = filas[0]
        if estado is not None:
            fila = replace(fila, estado_cruce=estado)
        return fila

    def test_sin_filtros_devuelve_todas_las_filas(self):
        filas = [self._fila_agregada(cod="1"), self._fila_agregada(cod="2")]

        resultado = filtrar_plan_accion(filas, FiltrosPlanAccion())

        assert resultado == filas

    def test_filtra_por_sector_ca02(self):
        filas = [
            self._fila_agregada(cod="1", sector="Educación"),
            self._fila_agregada(cod="2", sector="Salud"),
        ]

        resultado = filtrar_plan_accion(filas, FiltrosPlanAccion(sector=("Educación",)))

        assert [f.cod_indicador_producto for f in resultado] == ["1"]

    def test_sector_con_varios_valores_combina_con_or_ca05(self):
        filas = [
            self._fila_agregada(cod="1", sector="Educación"),
            self._fila_agregada(cod="2", sector="Salud"),
            self._fila_agregada(cod="3", sector="Infraestructura"),
        ]

        resultado = filtrar_plan_accion(filas, FiltrosPlanAccion(sector=("Educación", "Salud")))

        assert {f.cod_indicador_producto for f in resultado} == {"1", "2"}

    def test_filtra_por_estado_de_cruce_ca03(self):
        filas = [
            self._fila_agregada(cod="1", estado=EstadoCruceMeta.PARCIAL),
            self._fila_agregada(cod="2", estado=EstadoCruceMeta.COMPLETO),
        ]

        resultado = filtrar_plan_accion(
            filas, FiltrosPlanAccion(estado_cruce=(EstadoCruceMeta.PARCIAL,))
        )

        assert [f.cod_indicador_producto for f in resultado] == ["1"]

    def test_busqueda_por_codigo_ca04(self):
        filas = [self._fila_agregada(cod="040110500"), self._fila_agregada(cod="170202300")]

        resultado = filtrar_plan_accion(filas, FiltrosPlanAccion(busqueda="0401"))

        assert [f.cod_indicador_producto for f in resultado] == ["040110500"]

    def test_busqueda_por_nombre_sin_distinguir_mayusculas_ni_tildes_ca04(self):
        filas = [
            self._fila_agregada(cod="1", nombre="Vías pavimentadas"),
            self._fila_agregada(cod="2", nombre="Escuelas construidas"),
        ]

        resultado = filtrar_plan_accion(filas, FiltrosPlanAccion(busqueda="VIAS"))

        assert [f.cod_indicador_producto for f in resultado] == ["1"]

    def test_busqueda_no_falla_si_nombre_producto_es_none(self):
        filas = [self._fila_agregada(cod="1", nombre=None)]

        resultado = filtrar_plan_accion(filas, FiltrosPlanAccion(busqueda="algo"))

        assert resultado == []

    def test_una_busqueda_de_menos_de_tres_caracteres_se_aplica_ca04(self):
        """El dominio NO reimponer el mínimo de 3 caracteres de CA04: lo
        hace explícito el docstring de `FiltrosPlanAccion` ("esta función
        SIEMPRE compara si `busqueda` no es None, sin reimponer el mínimo de
        3 (eso es UX, no una regla de dominio)"). El mínimo de 3 caracteres
        es la precondición de la acción del usuario en el panel (Excel de
        requisitos, hoja `HU_E04_02`, HU02-CA04: "escribe 3 o más
        caracteres"), no una regla de dominio ni un error del endpoint.

        Esta prueba fija ese comportamiento a propósito: si el equipo decide
        (DEC-015) que el backend debe rechazar por debajo de 3 caracteres,
        esta es la prueba que hay que cambiar.
        """
        filas = [
            self._fila_agregada(cod="1", nombre="Vías pavimentadas"),
            self._fila_agregada(cod="2", nombre="Escuelas construidas"),
        ]

        # "ví" son 2 caracteres (normalizados a "vi"): por debajo del mínimo
        # de 3 de CA04.
        resultado = filtrar_plan_accion(filas, FiltrosPlanAccion(busqueda="ví"))

        assert [f.cod_indicador_producto for f in resultado] == ["1"]

    def test_combinacion_sector_y_estado_cruce_es_and_ca05(self):
        filas = [
            self._fila_agregada(cod="1", sector="Educación", estado=EstadoCruceMeta.PARCIAL),
            self._fila_agregada(cod="2", sector="Educación", estado=EstadoCruceMeta.COMPLETO),
            self._fila_agregada(cod="3", sector="Salud", estado=EstadoCruceMeta.PARCIAL),
        ]

        resultado = filtrar_plan_accion(
            filas,
            FiltrosPlanAccion(sector=("Educación",), estado_cruce=(EstadoCruceMeta.PARCIAL,)),
        )

        assert [f.cod_indicador_producto for f in resultado] == ["1"]

    def test_sin_resultados_devuelve_lista_vacia_ca07(self):
        filas = [self._fila_agregada(cod="1", sector="Educación")]

        resultado = filtrar_plan_accion(filas, FiltrosPlanAccion(sector=("Salud",)))

        assert resultado == []

    def test_resumen_sobre_filas_filtradas_refleja_solo_esas_ca06(self):
        filas = [
            self._fila_agregada(cod="1", sector="Educación", estado=EstadoCruceMeta.COMPLETO),
            self._fila_agregada(cod="2", sector="Salud", estado=EstadoCruceMeta.PARCIAL),
        ]

        filtradas = filtrar_plan_accion(filas, FiltrosPlanAccion(sector=("Educación",)))
        resumen = calcular_resumen(filtradas)

        assert resumen.total == 1
        assert resumen.completo == 1
        assert resumen.parcial == 0

    def test_filtra_por_indicador_exacto_ca01_d27(self):
        filas = [
            self._fila_agregada(cod="040110500"),
            self._fila_agregada(cod="170202300"),
        ]

        resultado = filtrar_plan_accion(
            filas, FiltrosPlanAccion(cod_indicador_producto=("040110500",))
        )

        assert [f.cod_indicador_producto for f in resultado] == ["040110500"]

    def test_indicador_con_varios_valores_combina_con_or_ca05(self):
        filas = [
            self._fila_agregada(cod="1"),
            self._fila_agregada(cod="2"),
            self._fila_agregada(cod="3"),
        ]

        resultado = filtrar_plan_accion(filas, FiltrosPlanAccion(cod_indicador_producto=("1", "2")))

        assert {f.cod_indicador_producto for f in resultado} == {"1", "2"}

    def test_indicador_es_exacto_no_substring_a_diferencia_de_busqueda(self):
        filas = [self._fila_agregada(cod="040110500")]

        resultado = filtrar_plan_accion(filas, FiltrosPlanAccion(cod_indicador_producto=("0401",)))

        assert resultado == []

    def test_combinacion_indicador_y_sector_es_and_ca05(self):
        filas = [
            self._fila_agregada(cod="1", sector="Educación"),
            self._fila_agregada(cod="1", sector="Salud"),
        ]

        resultado = filtrar_plan_accion(
            filas,
            FiltrosPlanAccion(cod_indicador_producto=("1",), sector=("Salud",)),
        )

        assert len(resultado) == 1
        assert resultado[0].sector == "Salud"
