"""Escritura segura de texto en celdas de Excel exportadas.

CAPA: Persistencia (compartida entre módulos que exportan Excel).
ORIGEN: `plan_accion/persistence/exportacion_excel.py` (hallazgo de la
revisión de Juan David sobre el PR #154, 2026-10-18). Se movió aquí cuando
[E-04/HU-05] (registros no relacionados) también necesitó exportar textos
que vienen tal cual de los Excel que sube la administradora: la regla de
seguridad debe vivir en un solo lugar.

Un texto que empiece por "=", "+", "-" o "@" (o tab/CR) puede interpretarse
como fórmula al abrir el archivo en algunas hojas de cálculo ("inyección de
fórmulas"/CSV injection, OWASP). Se antepone una comilla simple: Excel la
trata como texto literal, al costo de que la comilla quede visible.
"""

from __future__ import annotations

PREFIJOS_DE_FORMULA = ("=", "+", "-", "@", "\t", "\r")


def sanear_texto_celda(valor: str | None) -> str | None:
    if valor and valor.startswith(PREFIJOS_DE_FORMULA):
        return f"'{valor}"
    return valor
