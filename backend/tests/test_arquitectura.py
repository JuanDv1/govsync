"""Pruebas de arquitectura: la regla de dependencias es ejecutable, no un acuerdo verbal.

Analizan el árbol sintáctico de cada módulo y verifican que las dependencias
apunten hacia el dominio. Un `import sqlalchemy` dentro de `domain/` rompe la
build en vez de descubrirse tres sprints después.

    API ──────────► Aplicación ──────► Dominio ◄────── Persistencia
                                          ▲                  │
                                          └──── contratos ───┘  ▼ Base de datos
"""

from __future__ import annotations

import ast
import pathlib

import pytest

RAIZ = pathlib.Path(__file__).resolve().parent.parent
APP = RAIZ / "app"

#: Paquetes de infraestructura que el dominio no puede tocar bajo ninguna forma.
PROHIBIDOS_EN_DOMINIO = {
    "fastapi",
    "starlette",
    "sqlalchemy",
    "alembic",
    "pandas",
    "numpy",
    "openpyxl",
    "psycopg",
    "passlib",
    "jwt",
    "pydantic",
}

#: La capa de aplicación coordina, pero no habla HTTP.
PROHIBIDOS_EN_APLICACION = {"fastapi", "starlette"}


def _archivos(patron: str) -> list[pathlib.Path]:
    return sorted(p for p in APP.rglob(patron) if p.name != "__init__.py")


def _modulos_importados(ruta: pathlib.Path) -> set[str]:
    arbol = ast.parse(ruta.read_text(encoding="utf-8"), filename=str(ruta))
    nombres: set[str] = set()
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Import):
            nombres.update(alias.name.split(".")[0] for alias in nodo.names)
        elif isinstance(nodo, ast.ImportFrom) and nodo.level == 0 and nodo.module:
            nombres.add(nodo.module.split(".")[0])
    return nombres


def _importa_capa(ruta: pathlib.Path, capa: str) -> bool:
    arbol = ast.parse(ruta.read_text(encoding="utf-8"), filename=str(ruta))
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.ImportFrom) and nodo.module:
            if f".{capa}" in nodo.module or nodo.module.endswith(capa):
                return True
        elif isinstance(nodo, ast.Import) and any(f".{capa}" in alias.name for alias in nodo.names):
            return True
    return False


ARCHIVOS_DOMINIO = _archivos("*/domain/*.py") + _archivos("shared/*.py")
ARCHIVOS_APLICACION = _archivos("*/application/*.py")
ARCHIVOS_API = _archivos("*/api/*.py")


def test_hay_archivos_que_analizar():
    """Guarda contra un falso verde si la estructura de carpetas cambia."""
    assert ARCHIVOS_DOMINIO, "no se encontró ningún archivo de dominio"
    assert ARCHIVOS_APLICACION, "no se encontró ningún caso de uso"
    assert ARCHIVOS_API, "no se encontró ningún router"


@pytest.mark.parametrize("ruta", ARCHIVOS_DOMINIO, ids=lambda p: p.name)
def test_el_dominio_no_depende_de_la_infraestructura(ruta: pathlib.Path):
    """El dominio es Python puro: sin ORM, sin framework HTTP, sin pandas."""
    prohibidos = _modulos_importados(ruta) & PROHIBIDOS_EN_DOMINIO
    assert not prohibidos, (
        f"{ruta.relative_to(RAIZ)} importa infraestructura desde el dominio: {sorted(prohibidos)}"
    )


@pytest.mark.parametrize("ruta", ARCHIVOS_DOMINIO, ids=lambda p: p.name)
def test_el_dominio_no_importa_otras_capas(ruta: pathlib.Path):
    for capa in ("persistence", "api"):
        assert not _importa_capa(ruta, capa), (
            f"{ruta.relative_to(RAIZ)} importa la capa «{capa}»; "
            "las dependencias deben apuntar HACIA el dominio"
        )


@pytest.mark.parametrize("ruta", ARCHIVOS_APLICACION, ids=lambda p: p.name)
def test_la_aplicacion_no_depende_de_http(ruta: pathlib.Path):
    """Un caso de uso debe poder ejecutarse desde una prueba o un script."""
    prohibidos = _modulos_importados(ruta) & PROHIBIDOS_EN_APLICACION
    assert not prohibidos, (
        f"{ruta.relative_to(RAIZ)} depende de FastAPI desde la capa de aplicación: "
        f"{sorted(prohibidos)}"
    )


@pytest.mark.parametrize("ruta", ARCHIVOS_API, ids=lambda p: p.name)
def test_la_api_no_consulta_la_base_directamente(ruta: pathlib.Path):
    """Sin SQL ni ORM en los routers: la API traduce HTTP, no consulta datos."""
    prohibidos = _modulos_importados(ruta) & {"sqlalchemy", "pandas", "openpyxl"}
    assert not prohibidos, (
        f"{ruta.relative_to(RAIZ)} usa {sorted(prohibidos)} en la capa API; "
        "esa lógica pertenece a persistencia o aplicación"
    )


def test_el_lector_de_excel_vive_en_infraestructura():
    """Pandas y openpyxl solo pueden aparecer bajo `persistence/`."""
    for ruta in APP.rglob("*.py"):
        if "persistence" in ruta.parts:
            continue
        usados = _modulos_importados(ruta) & {"pandas", "openpyxl"}
        assert not usados, (
            f"{ruta.relative_to(RAIZ)} usa {sorted(usados)} fuera de la capa de persistencia"
        )


def test_los_modulos_no_dependen_unos_de_otros_por_persistencia():
    """Un módulo puede usar el dominio de otro, pero no sus repositorios.

    Excepción documentada: `cortes/application` usa los lectores del módulo de
    ingesta. Es la orquestación del ETL, que es responsabilidad del caso de uso
    de carga; la alternativa sería duplicar la fábrica de estrategias.
    """
    excepciones = {("cortes", "ingesta")}
    for ruta in APP.rglob("modules/*/**/*.py"):
        partes = ruta.relative_to(APP).parts
        if len(partes) < 2 or partes[0] != "modules":
            continue
        propio = partes[1]
        arbol = ast.parse(ruta.read_text(encoding="utf-8"), filename=str(ruta))
        for nodo in ast.walk(arbol):
            if not isinstance(nodo, ast.ImportFrom) or not nodo.module:
                continue
            if not nodo.module.startswith("app.modules."):
                continue
            ajeno = nodo.module.split(".")[2]
            if ajeno == propio or (propio, ajeno) in excepciones:
                continue
            assert "persistence" not in nodo.module or "models" in nodo.module, (
                f"{ruta.relative_to(RAIZ)} importa la persistencia del módulo "
                f"«{ajeno}»: {nodo.module}"
            )
