"""Prueba de humo: la aplicación arranca y responde.

Es la primera prueba del proyecto y la que hace que el pipeline de CI tenga
algo que ejecutar desde el primer commit.
"""

from __future__ import annotations


def test_la_aplicacion_responde(cliente):
    respuesta = cliente.get("/api/v1/salud")
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "ok"
