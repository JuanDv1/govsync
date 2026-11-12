"""Implementaciones concretas de los lectores (pandas / openpyxl).

Un lector por fuente: `pdt.py`, `ejecucion.py`, `proyectos.py`; lo común
vive en `_comun.py`. El mapa tipo -> lector se arma en un solo lugar, el
composition root (`app/core/dependencias.py`), y se inyecta en
`ServicioCortes`. Agregar una fuente nueva = una clase nueva + una entrada
allí (Open/Closed).
"""
