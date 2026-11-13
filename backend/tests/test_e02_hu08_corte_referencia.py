"""[E02-HU08][CA04] Marcar un corte como referencia, uno por vigencia.

TARJETA: [E-02/HU-08] BE+FE - Marcar corte como referencia, uno por vigencia
(CA04). Reglas de la tarjeta (decisión del PO del 2026-11-11):
- Solo la Administradora marca o desmarca.
- Solo cortes registrados (finalizados).
- Marcar otro corte de la misma vigencia mueve la estrella.
- Base de datos: índice único parcial por vigencia.

Dominio, repositorio con SQL real (SQLite en memoria) y endpoints. La
prueba contra PostgreSQL 16 de la migración y de dos marcas simultáneas se
hizo aparte (ver el PR).
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.dependencias import obtener_usuario_actual
from app.modules.cortes.domain.entidades import Corte, EstadoCorte, TipoArchivoFuente
from app.modules.cortes.persistence.models import ArchivoFuenteORM, CorteORM
from app.modules.cortes.persistence.repositorios import RepositorioCortesSQL
from app.modules.identidad.domain.entidades import Rol, Usuario
from app.shared.errors import OperacionNoPermitida

_VISITANTE = Usuario(id="v1", correo="alcalde@santarosa.gov.co", roles=frozenset({Rol.VISITANTE}))
_GESTOR = Usuario(id="g1", correo="gestor@santarosa.gov.co", roles=frozenset({Rol.GESTOR}))
_ADMINISTRADORA = Usuario(
    id="a1", correo="admin@santarosa.gov.co", roles=frozenset({Rol.ADMINISTRADOR})
)


def _corte(
    sesion,
    *,
    vigencia: int = 2026,
    fecha: date = date(2026, 6, 30),
    estado: EstadoCorte = EstadoCorte.REGISTRADO,
    es_referencia: bool = False,
) -> uuid.UUID:
    corte_id = uuid.uuid4()
    sesion.add(
        CorteORM(
            id=corte_id,
            vigencia=vigencia,
            fecha_corte=fecha,
            estado=estado,
            es_referencia=es_referencia,
        )
    )
    sesion.flush()
    for tipo in TipoArchivoFuente:
        sesion.add(
            ArchivoFuenteORM(
                id=uuid.uuid4(), corte_id=corte_id, tipo=tipo, nombre_archivo=f"{tipo.value}.xlsx"
            )
        )
    return corte_id


def _marcados(sesion) -> set[uuid.UUID]:
    sesion.expire_all()
    return {c.id for c in sesion.query(CorteORM).filter(CorteORM.es_referencia.is_(True))}


class TestDominio:
    def test_un_corte_registrado_se_puede_marcar(self) -> None:
        corte = Corte(vigencia=2026, fecha_corte=date(2026, 6, 30), estado=EstadoCorte.REGISTRADO)

        corte.marcar_como_referencia()

        assert corte.es_referencia is True

    def test_un_borrador_no_se_puede_marcar(self) -> None:
        corte = Corte(vigencia=2026, fecha_corte=date(2026, 6, 30))

        with pytest.raises(OperacionNoPermitida) as error:
            corte.marcar_como_referencia()

        assert error.value.detalles["motivo"] == "corte_no_registrado"
        assert corte.es_referencia is False

    def test_desmarcar_es_idempotente(self) -> None:
        corte = Corte(vigencia=2026, fecha_corte=date(2026, 6, 30))

        corte.desmarcar_referencia()
        corte.desmarcar_referencia()

        assert corte.es_referencia is False


class TestRepositorio:
    def test_marcar_mueve_la_estrella_dentro_de_la_vigencia(self, sesion) -> None:
        anterior = _corte(sesion, fecha=date(2026, 3, 31), es_referencia=True)
        nuevo = _corte(sesion, fecha=date(2026, 6, 30))
        repo = RepositorioCortesSQL(sesion)

        corte = repo.obtener(nuevo)
        corte.marcar_como_referencia()
        repo.confirmar_referencia(corte)

        assert _marcados(sesion) == {nuevo}
        assert anterior not in _marcados(sesion)

    def test_marcar_no_toca_la_referencia_de_otra_vigencia(self, sesion) -> None:
        de_2025 = _corte(sesion, vigencia=2025, fecha=date(2025, 12, 31), es_referencia=True)
        de_2026 = _corte(sesion, vigencia=2026, fecha=date(2026, 6, 30))
        repo = RepositorioCortesSQL(sesion)

        corte = repo.obtener(de_2026)
        corte.marcar_como_referencia()
        repo.confirmar_referencia(corte)

        assert _marcados(sesion) == {de_2025, de_2026}

    def test_el_indice_impide_dos_referencias_en_la_misma_vigencia(self, sesion) -> None:
        """Respaldo de base de datos, independiente del repositorio."""
        _corte(sesion, fecha=date(2026, 3, 31), es_referencia=True)

        with pytest.raises(IntegrityError):
            _corte(sesion, fecha=date(2026, 6, 30), es_referencia=True)

    def test_una_marca_simultanea_se_traduce_a_409(self, sesion, monkeypatch) -> None:
        """Simula la carrera: la otra marca aparece entre quitar la anterior
        y poner la nueva (se anula el paso de quitarla). El índice la
        rechaza y el repositorio lo traduce a OperacionNoPermitida, no a un
        IntegrityError crudo (500)."""
        _corte(sesion, fecha=date(2026, 3, 31), es_referencia=True)
        nuevo = _corte(sesion, fecha=date(2026, 6, 30))
        repo = RepositorioCortesSQL(sesion)
        monkeypatch.setattr(repo, "_quitar_otras_referencias", lambda _corte: None)

        corte = repo.obtener(nuevo)
        corte.marcar_como_referencia()
        with pytest.raises(OperacionNoPermitida) as error:
            repo.confirmar_referencia(corte)

        assert error.value.detalles["motivo"] == "referencia_en_conflicto"


@pytest.fixture()
def cliente_admin(cliente):
    """Fija el rol explícitamente: el usuario por defecto de `conftest.py`
    cambia con D37 (PR #209) y esta prueba no debe depender de eso."""
    cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: _ADMINISTRADORA
    return cliente


class TestEndpoints:
    def test_ca04_marcar_devuelve_el_corte_con_la_estrella(self, cliente_admin, sesion) -> None:
        corte_id = _corte(sesion)
        sesion.commit()

        respuesta = cliente_admin.put(f"/api/v1/cortes/{corte_id}/referencia")

        assert respuesta.status_code == 200
        assert respuesta.json()["es_referencia"] is True

    def test_ca04_el_historico_muestra_una_sola_estrella_por_vigencia(
        self, cliente_admin, sesion
    ) -> None:
        a = _corte(sesion, fecha=date(2026, 3, 31))
        b = _corte(sesion, fecha=date(2026, 6, 30))
        c = _corte(sesion, vigencia=2025, fecha=date(2025, 12, 31))
        sesion.commit()

        for corte_id in (a, b, c):
            assert cliente_admin.put(f"/api/v1/cortes/{corte_id}/referencia").status_code == 200

        estrellas = {
            x["id"]: x["es_referencia"] for x in cliente_admin.get("/api/v1/cortes").json()
        }
        assert estrellas == {str(a): False, str(b): True, str(c): True}

    def test_ca04_marcar_dos_veces_no_cambia_nada(self, cliente_admin, sesion) -> None:
        corte_id = _corte(sesion)
        sesion.commit()

        cliente_admin.put(f"/api/v1/cortes/{corte_id}/referencia")
        respuesta = cliente_admin.put(f"/api/v1/cortes/{corte_id}/referencia")

        assert respuesta.status_code == 200
        assert respuesta.json()["es_referencia"] is True

    def test_ca04_desmarcar_quita_la_estrella(self, cliente_admin, sesion) -> None:
        corte_id = _corte(sesion, es_referencia=True)
        sesion.commit()

        respuesta = cliente_admin.delete(f"/api/v1/cortes/{corte_id}/referencia")

        assert respuesta.status_code == 200
        assert respuesta.json()["es_referencia"] is False
        assert _marcados(sesion) == set()

    def test_ca04_un_borrador_no_se_puede_marcar(self, cliente_admin, sesion) -> None:
        corte_id = _corte(sesion, estado=EstadoCorte.BORRADOR)
        sesion.commit()

        respuesta = cliente_admin.put(f"/api/v1/cortes/{corte_id}/referencia")

        assert respuesta.status_code == 409
        assert respuesta.json()["detalles"]["motivo"] == "corte_no_registrado"

    def test_corte_inexistente_devuelve_404(self, cliente_admin) -> None:
        assert cliente_admin.put(f"/api/v1/cortes/{uuid.uuid4()}/referencia").status_code == 404

    @pytest.mark.parametrize("usuario", [_VISITANTE, _GESTOR], ids=["visitante", "gestor"])
    @pytest.mark.parametrize("metodo", ["put", "delete"])
    def test_ca04_solo_la_administradora_marca_o_desmarca(
        self, cliente, sesion, usuario, metodo
    ) -> None:
        corte_id = _corte(sesion)
        sesion.commit()
        cliente.app.dependency_overrides[obtener_usuario_actual] = lambda: usuario

        respuesta = getattr(cliente, metodo)(f"/api/v1/cortes/{corte_id}/referencia")

        assert respuesta.status_code == 403
        assert respuesta.json()["detalles"]["roles_requeridos"] == ["administrador"]
        assert _marcados(sesion) == set()
