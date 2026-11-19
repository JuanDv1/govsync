"""Pruebas de los ajustes de prácticas (seguridad y código limpio) del
Sprint 3. No corresponden a una HU: fijan comportamientos que el análisis
de calidad pidió proteger.
"""

from __future__ import annotations

import logging
import uuid

import pytest

from app.core.dependencias import obtener_usuario_actual
from app.modules.identidad.domain.entidades import Rol, Usuario
from app.modules.ingesta.persistence.lectores import _comun, ejecucion
from app.shared.errors import ArchivoInvalido
from tests.test_autorizacion_rutas import _cliente_con_sesion_real_sin_usuario

_VISITANTE = Usuario(id="v1", correo="visitante@santarosa.gov.co", roles=frozenset({Rol.VISITANTE}))


class TestRegistroDeAccesosRechazados:
    """OWASP A09 (fallas de registro y monitoreo): un 401 o un 403 deja
    rastro en el log, sin datos sensibles."""

    def test_un_401_queda_registrado_con_metodo_y_ruta(self, sesion, caplog) -> None:
        cliente = _cliente_con_sesion_real_sin_usuario(sesion)

        with caplog.at_level(logging.WARNING, logger="govsync"):
            respuesta = cliente.get("/api/v1/cortes")

        assert respuesta.status_code == 401
        assert "Acceso rechazado (401 credenciales_invalidas) en GET /api/v1/cortes" in caplog.text

    def test_un_403_queda_registrado(self, cliente, caplog) -> None:
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _VISITANTE

        with caplog.at_level(logging.WARNING, logger="govsync"):
            respuesta = cliente.post(
                "/api/v1/cortes", json={"vigencia": 2026, "fecha_corte": "2026-01-01"}
            )

        assert respuesta.status_code == 403
        assert "Acceso rechazado (403 permiso_insuficiente) en POST /api/v1/cortes" in caplog.text

    def test_el_registro_no_incluye_el_token(self, sesion, caplog) -> None:
        cliente = _cliente_con_sesion_real_sin_usuario(sesion)

        with caplog.at_level(logging.WARNING, logger="govsync"):
            cliente.get("/api/v1/cortes", headers={"Authorization": "Bearer token-secreto"})

        assert "token-secreto" not in caplog.text

    def test_un_404_no_se_registra_como_acceso_rechazado(self, cliente, caplog) -> None:
        with caplog.at_level(logging.WARNING, logger="govsync"):
            respuesta = cliente.get(f"/api/v1/cortes/{uuid.uuid4()}")

        assert respuesta.status_code == 404
        assert "Acceso rechazado" not in caplog.text


class TestEncabezadoPorAlias:
    """`_localizar_fila_encabezado_por_alias` usaba un `assert` para
    control de flujo (se elimina al ejecutar Python con -O). Se fija el
    comportamiento sin él."""

    def test_usa_el_primer_alias_que_encuentra(self, monkeypatch) -> None:
        def falso(_contenido, _hoja, requeridas):
            if requeridas == ("Segundo",):
                return 7
            raise ArchivoInvalido("no está")

        monkeypatch.setattr(_comun, "localizar_fila_encabezado", falso)

        fila = ejecucion._localizar_fila_encabezado_por_alias(b"", "Hoja", ("Primero", "Segundo"))

        assert fila == 7

    def test_si_ningun_alias_existe_propaga_el_error_del_ultimo(self, monkeypatch) -> None:
        def falso(_contenido, _hoja, requeridas):
            raise ArchivoInvalido(f"falta {requeridas[0]}")

        monkeypatch.setattr(_comun, "localizar_fila_encabezado", falso)

        with pytest.raises(ArchivoInvalido, match="falta Segundo"):
            ejecucion._localizar_fila_encabezado_por_alias(b"", "Hoja", ("Primero", "Segundo"))

    def test_sin_alias_es_un_error_de_programacion_explicito(self) -> None:
        with pytest.raises(ValueError, match="al menos un alias"):
            ejecucion._localizar_fila_encabezado_por_alias(b"", "Hoja", ())
