"""[D38] Límite de peticiones de las rutas públicas.

El middleware se prueba directamente sobre el protocolo ASGI (sin red) para
poder fijar la IP del socket y el reloj; el cableado en `crear_app` se prueba
al final con la app real.
"""

from __future__ import annotations

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.database import get_session
from app.core.limite_peticiones import LimitePeticionesPublicas, ip_del_cliente
from app.main import crear_app

RUTA = "/api/v1/publico/plan-accion/actual"


class _Reloj:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


async def _app_ok(scope, receive, send):
    await send({"type": "http.response.start", "status": 200, "headers": []})
    await send({"type": "http.response.body", "body": b"ok"})


def _mw(**kw) -> LimitePeticionesPublicas:
    kw.setdefault("limite", 3)
    kw.setdefault("ventana_segundos", 60)
    return LimitePeticionesPublicas(_app_ok, **kw)


def _scope(ip: str | None, ruta: str = RUTA, xff: list[str] | None = None) -> dict:
    return {
        "type": "http",
        "path": ruta,
        "client": (ip, 5000) if ip else None,
        "headers": [(b"x-forwarded-for", v.encode()) for v in (xff or [])],
    }


def _llamar(mw, ip, ruta: str = RUTA, xff=None):
    mensajes: list[dict] = []

    async def _send(m):
        mensajes.append(m)

    async def _recibir():
        return {"type": "http.request"}

    asyncio.run(mw(_scope(ip, ruta, xff), _recibir, _send))
    estado = mensajes[0]["status"]
    cabeceras = {k.decode(): v.decode() for k, v in mensajes[0]["headers"]}
    cuerpo = mensajes[1]["body"]
    return estado, cabeceras, cuerpo


class TestLimite:
    def test_supera_el_limite_devuelve_429_con_el_sobre_de_errores(self) -> None:
        mw = _mw(reloj=_Reloj())
        assert [_llamar(mw, "1.1.1.1")[0] for _ in range(3)] == [200, 200, 200]

        estado, cabeceras, cuerpo = _llamar(mw, "1.1.1.1")

        assert estado == 429
        datos = json.loads(cuerpo)
        assert set(datos) == {"codigo", "mensaje", "detalles"}
        assert datos["codigo"] == "limite_peticiones_excedido"
        assert datos["detalles"]["reintentar_en_segundos"] == 60
        assert cabeceras["retry-after"] == "60"

    def test_cada_cliente_tiene_su_propio_contador(self) -> None:
        mw = _mw(reloj=_Reloj())
        for _ in range(3):
            _llamar(mw, "1.1.1.1")

        assert _llamar(mw, "1.1.1.1")[0] == 429
        assert _llamar(mw, "2.2.2.2")[0] == 200

    def test_la_ventana_se_reinicia_y_retry_after_baja_con_el_tiempo(self) -> None:
        reloj = _Reloj()
        mw = _mw(reloj=reloj)
        for _ in range(3):
            _llamar(mw, "1.1.1.1")
        reloj.t += 45
        estado, cabeceras, _ = _llamar(mw, "1.1.1.1")
        assert estado == 429
        assert cabeceras["retry-after"] == "15"

        reloj.t += 15
        assert _llamar(mw, "1.1.1.1")[0] == 200

    @pytest.mark.parametrize(
        "ruta",
        ["/health", "/api/v1/salud", "/api/v1/plan-accion/actual", "/api/v1/cortes"],
    )
    def test_no_limita_rutas_fuera_del_prefijo_publico(self, ruta: str) -> None:
        mw = _mw(reloj=_Reloj())
        assert all(_llamar(mw, "1.1.1.1", ruta)[0] == 200 for _ in range(50))

    @pytest.mark.parametrize(
        "ruta",
        [
            "/api/v1/publico",
            "/api/v1/publico/",
            "/api/v1/publico/plan-accion/exportar",
            "/api/v1/publico/lo-que-sea",
        ],
    )
    def test_limita_todo_el_prefijo_publico_aunque_la_ruta_no_exista(self, ruta: str) -> None:
        mw = _mw(reloj=_Reloj())
        for _ in range(3):
            _llamar(mw, "1.1.1.1", ruta)
        assert _llamar(mw, "1.1.1.1", ruta)[0] == 429

    def test_con_root_path_el_prefijo_publico_sigue_limitado(self) -> None:
        """Con `--root-path /gs`, uvicorn entrega path='/gs/api/v1/publico/...'."""
        mw = _mw(reloj=_Reloj())

        def _con_raiz(ruta: str) -> dict:
            return {**_scope("1.1.1.1", ruta), "root_path": "/gs"}

        async def _enviar(scope) -> int:
            mensajes: list[dict] = []

            async def _send(m):
                mensajes.append(m)

            async def _recibir():
                return {"type": "http.request"}

            await mw(scope, _recibir, _send)
            return mensajes[0]["status"]

        estados = [asyncio.run(_enviar(_con_raiz("/gs" + RUTA))) for _ in range(4)]
        assert estados == [200, 200, 200, 429]
        # Fuera del prefijo público, aun con root_path, no se limita.
        assert all(asyncio.run(_enviar(_con_raiz("/gs/health"))) == 200 for _ in range(10))

    def test_un_prefijo_parecido_no_cuenta_como_publico(self) -> None:
        mw = _mw(reloj=_Reloj())
        assert all(_llamar(mw, "1.1.1.1", "/api/v1/publicos")[0] == 200 for _ in range(10))


class TestIdentificacionDelCliente:
    def test_con_cero_proxies_ignora_x_forwarded_for(self) -> None:
        """Un cliente no puede rotar su IP escribiendo el encabezado."""
        mw = _mw(reloj=_Reloj(), proxies_confiables=0)
        for i in range(3):
            _llamar(mw, "9.9.9.9", xff=[f"10.0.0.{i}"])

        assert _llamar(mw, "9.9.9.9", xff=["10.0.0.99"])[0] == 429

    def test_con_un_proxy_toma_la_ultima_entrada_y_ignora_las_falsificadas(self) -> None:
        mw = _mw(reloj=_Reloj(), proxies_confiables=1)
        # El cliente real (7.7.7.7) antepone IPs falsas; el proxy agrega la suya al final.
        for i in range(3):
            _llamar(mw, "172.16.0.1", xff=[f"1.2.3.{i}, 7.7.7.7"])

        assert _llamar(mw, "172.16.0.1", xff=["8.8.8.8, 7.7.7.7"])[0] == 429
        assert _llamar(mw, "172.16.0.1", xff=["8.8.8.8, 6.6.6.6"])[0] == 200

    def test_varias_cabeceras_x_forwarded_for_se_cuentan_como_una_lista(self) -> None:
        scope = _scope("172.16.0.1", xff=["1.1.1.1", "7.7.7.7"])
        assert ip_del_cliente(scope, 1) == "7.7.7.7"
        assert ip_del_cliente(scope, 2) == "1.1.1.1"

    def test_con_menos_entradas_que_proxies_cae_a_la_ip_del_socket(self) -> None:
        assert ip_del_cliente(_scope("5.5.5.5", xff=["7.7.7.7"]), 2) == "5.5.5.5"
        assert ip_del_cliente(_scope("5.5.5.5"), 1) == "5.5.5.5"

    @pytest.mark.parametrize("basura", ["no-es-ip", "", "999.1.1.1", "' OR 1=1 --"])
    def test_entrada_invalida_cae_a_la_ip_del_socket(self, basura: str) -> None:
        assert ip_del_cliente(_scope("5.5.5.5", xff=[basura]), 1) == "5.5.5.5"

    @pytest.mark.parametrize(
        ("entrada", "esperada"),
        [
            ("1.2.3.4:5678", "1.2.3.4"),
            ("[2001:db8:1:2::9]:80", "2001:db8:1:2::/64"),
            ("[::1]", "::/64"),
        ],
    )
    def test_quita_el_puerto_que_agregan_algunos_balanceadores(self, entrada, esperada) -> None:
        assert ip_del_cliente(_scope("5.5.5.5", xff=[entrada]), 1) == esperada

    def test_sin_socket_no_lanza_y_usa_un_cubo_comun(self) -> None:
        assert ip_del_cliente(_scope(None), 0) == "desconocido"

    def test_ipv6_se_agrupa_por_64_para_que_rotar_direcciones_no_evada_el_limite(self) -> None:
        mw = _mw(reloj=_Reloj())
        for i in range(3):
            _llamar(mw, f"2001:db8:aaaa:bbbb::{i + 1}")

        assert _llamar(mw, "2001:db8:aaaa:bbbb:ffff::1")[0] == 429
        assert _llamar(mw, "2001:db8:aaaa:cccc::1")[0] == 200

    def test_ipv4_mapeada_en_ipv6_cuenta_como_la_ipv4(self) -> None:
        assert ip_del_cliente(_scope("::ffff:1.2.3.4"), 0) == "1.2.3.4"


class TestMemoriaAcotada:
    def test_muchas_ips_distintas_no_superan_el_tope_de_clientes(self) -> None:
        mw = _mw(reloj=_Reloj(), max_clientes=100)

        for i in range(5000):
            _llamar(mw, f"10.{i // 256 % 256}.{i % 256}.1")
            assert len(mw._clientes) <= 100

    def test_los_contadores_vencidos_se_descartan_primero(self) -> None:
        reloj = _Reloj()
        mw = _mw(reloj=reloj, max_clientes=100)
        for i in range(100):
            _llamar(mw, f"10.0.0.{i}")
        reloj.t += 61

        _llamar(mw, "20.0.0.1")

        assert set(mw._clientes) == {"20.0.0.1"}

    def test_con_el_tope_lleno_sigue_atendiendo_clientes_nuevos(self) -> None:
        """Preferimos relajar el límite a dejar sin servicio a quien llega."""
        mw = _mw(reloj=_Reloj(), max_clientes=100)
        for i in range(100):
            _llamar(mw, f"10.0.0.{i}")

        assert _llamar(mw, "30.0.0.1")[0] == 200

    def test_un_cliente_bloqueado_sigue_bloqueado_mientras_hay_espacio(self) -> None:
        mw = _mw(reloj=_Reloj(), max_clientes=100)
        for _ in range(3):
            _llamar(mw, "1.1.1.1")
        for i in range(50):
            _llamar(mw, f"10.0.0.{i}")

        assert _llamar(mw, "1.1.1.1")[0] == 429


class TestCableadoEnLaApp:
    def test_la_app_real_devuelve_429_con_cabeceras_cors_y_solo_en_el_prefijo_publico(
        self, sesion, monkeypatch
    ) -> None:
        monkeypatch.setenv("PUBLICO_LIMITE_PETICIONES", "3")
        get_settings.cache_clear()
        try:
            origen = get_settings().cors_origins_list[0]
            app = crear_app()

            def _sesion_de_prueba():
                yield sesion

            app.dependency_overrides[get_session] = _sesion_de_prueba
            with TestClient(app) as cliente:
                for _ in range(3):
                    assert cliente.get(RUTA).status_code == 404  # sin cortes: llega al endpoint
                limitada = cliente.get(RUTA, headers={"Origin": origen})
                otra_ruta = [cliente.get("/health").status_code for _ in range(10)]
        finally:
            get_settings.cache_clear()

        assert limitada.status_code == 429
        assert limitada.json()["codigo"] == "limite_peticiones_excedido"
        assert limitada.headers["access-control-allow-origin"] == origen
        assert "retry-after" in limitada.headers
        assert otra_ruta == [200] * 10

    def test_la_configuracion_por_defecto_es_60_por_minuto_y_cero_proxies(
        self, monkeypatch
    ) -> None:
        for variable in (
            "PUBLICO_LIMITE_PETICIONES",
            "PUBLICO_VENTANA_SEGUNDOS",
            "PUBLICO_PROXIES_CONFIABLES",
        ):
            monkeypatch.delenv(variable, raising=False)
        get_settings.cache_clear()
        try:
            ajustes = get_settings()
            assert ajustes.publico_limite_peticiones == 60
            assert ajustes.publico_ventana_segundos == 60
            assert ajustes.publico_proxies_confiables == 0
        finally:
            get_settings.cache_clear()
