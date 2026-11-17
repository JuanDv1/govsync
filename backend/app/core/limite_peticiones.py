"""Límite de peticiones para las rutas públicas sin token (D38).

CAPA: núcleo transversal (middleware ASGI puro).

Solo se aplica al prefijo `/api/v1/publico`; el resto de la API no pasa por
aquí. Es en memoria y POR PROCESO: con N procesos el tope real por cliente es
N veces el configurado (docs/SEGURIDAD.md).

Decisiones:
- Ventana fija por cliente (contador + inicio de ventana). Permite una ráfaga
  de hasta 2x el límite en el cambio de ventana; se acepta a cambio de
  memoria O(1) por cliente.
- Memoria acotada: al llenarse `max_clientes` se descartan primero las
  ventanas vencidas y, si no alcanza, las más antiguas. Se prefiere "olvidar"
  contadores (el límite se relaja) a rechazar clientes nuevos (un atacante con
  muchas IPs dejaría sin servicio a todos); los datos son públicos.
- Sin `await` entre leer y escribir el contador: el bucle de eventos es de un
  solo hilo, así que la operación es atómica sin candados.
- La IP del cliente sale de `ip_del_cliente`: con 0 proxies de confianza es la
  del socket; con N, la entrada N contando desde la derecha de
  X-Forwarded-For. Lo que el cliente escriba a la izquierda se ignora.
"""

from __future__ import annotations

import ipaddress
import math
import time
from collections.abc import Callable
from typing import Any

from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.errores import respuesta_de_error
from app.shared.errors import LimiteDePeticionesExcedido

PREFIJO_PUBLICO = "/api/v1/publico"


def _normalizar_ip(texto: str) -> str | None:
    """IP válida normalizada, o None. Las IPv6 se agrupan por /64: un
    cliente con un bloque /64 tiene 2^64 direcciones y rotarlas evadiría el
    límite."""
    texto = texto.strip()
    # Algunos balanceadores agregan el puerto ("1.2.3.4:5678", "[::1]:80").
    if texto.startswith("["):
        texto = texto[1:].split("]", 1)[0]
    elif texto.count(":") == 1:
        texto = texto.split(":", 1)[0]
    try:
        ip = ipaddress.ip_address(texto)
    except ValueError:
        return None
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return str(ip.ipv4_mapped)
        return str(ipaddress.ip_network(f"{ip}/64", strict=False))
    return str(ip)


def _ruta_de_enrutamiento(scope: Scope) -> str:
    """Ruta tal como la enruta Starlette: sin el `root_path`. Con
    `--root-path /gs` uvicorn entrega `path="/gs/api/v1/..."`; comparar el
    prefijo contra ese valor dejaría el límite desactivado en silencio."""
    ruta = scope["path"]
    raiz = scope.get("root_path", "").rstrip("/")
    if raiz and (ruta == raiz or ruta.startswith(raiz + "/")):
        return ruta[len(raiz) :] or "/"
    return ruta


def ip_del_cliente(scope: Scope, proxies_confiables: int) -> str:
    """Identificador del cliente para el límite. Nunca lanza: ante cualquier
    dato dudoso cae a la IP del socket, que el cliente no controla."""
    cliente = scope.get("client")
    ip_socket = (_normalizar_ip(cliente[0]) if cliente else None) or "desconocido"
    if proxies_confiables <= 0:
        return ip_socket

    entradas: list[str] = []
    for nombre, valor in scope.get("headers", []):
        if nombre == b"x-forwarded-for":
            entradas.extend(valor.decode("latin-1").split(","))
    if len(entradas) < proxies_confiables:
        # La petición no pasó por tantos proxies como se configuraron:
        # el encabezado no es confiable, se usa el socket.
        return ip_socket
    return _normalizar_ip(entradas[-proxies_confiables]) or ip_socket


class LimitePeticionesPublicas:
    def __init__(
        self,
        app: ASGIApp,
        *,
        limite: int,
        ventana_segundos: int,
        proxies_confiables: int = 0,
        max_clientes: int = 10_000,
        reloj: Callable[[], float] = time.monotonic,
    ) -> None:
        self.app = app
        self.limite = limite
        self.ventana = ventana_segundos
        self.proxies = proxies_confiables
        self.max_clientes = max_clientes
        self._reloj = reloj
        # cliente -> [inicio_de_ventana, contador]; el dict conserva el orden
        # de inserción, que se usa para descartar los más antiguos.
        self._clientes: dict[str, list[float]] = {}

    @staticmethod
    def _es_publica(ruta: str) -> bool:
        return ruta == PREFIJO_PUBLICO or ruta.startswith(PREFIJO_PUBLICO + "/")

    def _registrar(self, cliente: str) -> int | None:
        """Cuenta la petición. None si pasa; si no, segundos para reintentar."""
        ahora = self._reloj()
        entrada = self._clientes.get(cliente)
        if entrada is None or ahora - entrada[0] >= self.ventana:
            if entrada is None and len(self._clientes) >= self.max_clientes:
                self._liberar_espacio(ahora)
            self._clientes.pop(cliente, None)  # reinserta al final (más reciente)
            self._clientes[cliente] = [ahora, 1]
            return None
        if entrada[1] >= self.limite:
            return max(1, math.ceil(self.ventana - (ahora - entrada[0])))
        entrada[1] += 1
        return None

    def _liberar_espacio(self, ahora: float) -> None:
        vencidos = [
            c for c, (inicio, _) in self._clientes.items() if ahora - inicio >= self.ventana
        ]
        for c in vencidos:
            del self._clientes[c]
        # Si todos siguen vigentes, se descarta el 10 % más antiguo para no
        # recorrer el dict en cada petición nueva.
        exceso = len(self._clientes) - self.max_clientes + 1
        if exceso > 0:
            for c in list(self._clientes)[: max(exceso, self.max_clientes // 10)]:
                del self._clientes[c]

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> Any:
        if scope["type"] != "http" or not self._es_publica(_ruta_de_enrutamiento(scope)):
            return await self.app(scope, receive, send)

        espera = self._registrar(ip_del_cliente(scope, self.proxies))
        if espera is None:
            return await self.app(scope, receive, send)

        error = LimiteDePeticionesExcedido(
            "Superaste el límite de peticiones. Intenta de nuevo en unos segundos.",
            detalles={"reintentar_en_segundos": espera},
        )
        respuesta = respuesta_de_error(error, headers={"Retry-After": str(espera)})
        return await respuesta(scope, receive, send)
