"""Objetos de valor de códigos de dominio.

CAPA: Dominio (kernel compartido)
TARJETA: [TRANS-01] Objeto de valor CodigoIndicador (9 dígitos)
BLOQUEA A: HU-02, HU-03, HU-04, HU-07

=============================================================================
POR QUÉ ESTA ES LA PRIMERA TAREA DEL SPRINT
=============================================================================
HU-02 (SisPT), HU-03 (CCPET) y HU-04 (separación multivalor) necesitan la
MISMA normalización. Implementarla tres veces produce tres comportamientos
distintos ante el mismo dato, y el cruce de HU-07 falla sin que nadie sepa
por qué.

=============================================================================
EVIDENCIA MEDIDA SOBRE LOS ARCHIVOS REALES DE SANTA ROSA
=============================================================================
El código de indicador de producto de 9 dígitos es la ÚNICA llave presente en
las cuatro fuentes:

    PDT "Código de indicador de producto (MGA)" ∩ Ejecución CodigoIndicadorCcpet
        -> 119 de 120
    Proyectos (códigos extraídos de la celda) ∩ PDT indicador MGA
        -> 67 de 67
    Ejecución CodigoIndicadorCcpet ∩ Contratación "Cod Indicador Ccpet"
        -> 40 de 40

NO usar "Código de indicador de producto (SisPT)" del PDT como llave: contiene
identificadores del tipo "IP-63" y su intersección con los códigos CCPET es
CERO. (La guía GovSync_guia_implementacion_postgresql.md §3.4 afirma lo
contrario; esa medición se hizo contra esta columna equivocada.)

Cuatro códigos reales EMPIEZAN EN CERO:
    040110500, 040600400, 040600500, 040601600
Por eso el valor es SIEMPRE texto y nunca un entero.

=============================================================================
QUÉ DEBE HACER (de la tarjeta)
=============================================================================
- Recibir el valor tal cual viene de pandas (str, int, float, NaN).
- Conservar los ceros a la izquierda: nunca convertir a int.
- Validar longitud de 9 dígitos.
- Rechazar con excepción de dominio si el valor no es normalizable.
- Ser inmutable y comparable por valor.

CUIDADO CON UN CASO BORDE: si Excel entregó el código como número, pudo perder
UN cero a la izquierda (los códigos de sector van de 01 a 45, nunca 00). Se
puede rellenar de 8 a 9 dígitos, pero rellenar cualquier número corto fabrica
códigos inexistentes: '12345' NO es '000012345'.

RESTRICCIÓN ARQUITECTÓNICA: sin imports de pandas, SQLAlchemy, FastAPI ni
openpyxl en este archivo. Lo verifica tests/test_arquitectura.py.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CodigoIndicadorProducto:
    """Código de 9 dígitos que identifica un indicador de producto."""

    valor: str

    def __post_init__(self) -> None:
        raise NotImplementedError("[TRANS-01] Validar formato de 9 dígitos")

    @classmethod
    def desde_crudo(cls, crudo: object) -> CodigoIndicadorProducto | None:
        """Normaliza un valor de Excel. Devuelve None si no es un código válido."""
        raise NotImplementedError("[TRANS-01] Normalización desde celda de Excel")

    @classmethod
    def extraer_todos(cls, texto: object) -> list[CodigoIndicadorProducto]:
        """Separa los indicadores multivalor de una sola celda (HU-04/CA-4).

        La celda real del archivo de Proyectos contiene bloques como:

            459903100
            Entidades, organismos y dependencias asistidos técnicamente
            $ 1.218.264.452

            459902300
            Sistema de Gestión implementado
            $230.000.000,00

        Un split("\\n") ingenuo devolvería nombres y montos como si fueran
        códigos. Ojo también con no extraer fragmentos de un BPIN de 15 dígitos.
        """
        raise NotImplementedError("[HU-04][BE-03] Separación multivalor")


@dataclass(frozen=True, slots=True)
class CodigoBpin:
    """Código BPIN de 15 dígitos."""

    valor: str

    def __post_init__(self) -> None:
        raise NotImplementedError("[TRANS-01] Validar formato de 15 dígitos")

    @classmethod
    def desde_crudo(cls, crudo: object) -> CodigoBpin | None:
        raise NotImplementedError("[TRANS-01] Normalización de BPIN")
