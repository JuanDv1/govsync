"""Endpoint del Plan de Acción Consolidado.

CAPA: API
TARJETA: [E04-HU01] Consultar Plan de Acción Consolidado
CUBRE: HU01-CA01 a CA06, CA08 a CA10 (ver docs/DECISIONES.md D26 para CA02,
CA03, CA05, CA08 -- implementados con defaults propuestos, pendientes de
ratificar). CA07 es 100% frontend (scroll horizontal + columnas fijas) --
no tiene contraparte aquí.

ALCANCE Y PATRÓN: igual que `trazabilidad/api/router.py` -- sin capa de
`application/` propia. El único "caso de uso" es "leer y agregar", sin
escritura, sin transacción, sin orquestación entre repositorios: toda la
lógica no trivial (agregar filas por meta) ya es una función pura de
dominio (`agregar_por_meta`), así que el router solo compone: obtiene el
corte -> valida -> consulta -> agrega -> arma el DTO. Agregar una capa de
aplicación aquí envolvería esas 4 llamadas en una clase sin estado y sin
ninguna regla propia -- indirección sin beneficio (mismo razonamiento ya
documentado para `trazabilidad`, que esta HU reutiliza sin reabrirlo).

=============================================================================
CA10 -- RESTRICCIÓN DE ROL (DECISIÓN TÉCNICA D26, PENDIENTE DE RATIFICAR)
=============================================================================
CA10 solo dice explícitamente que un "Usuario con rol Supervisor" NO debe
tener acceso. La historia nombra como actores únicamente "administradora y
alcalde" -- ninguno de los dos es el `gestor` de D24 (ese rol existe para
operaciones de escritura en `cortes`, no aparece en esta historia). Se
propone `administrador` + `visitante` (sin `gestor`) como el default más
ajustado a lo que la HU describe, DISTINTO del patrón de D24
(administrador+gestor para escritura en `cortes`) porque esta HU es de
software diferente: ES DE LECTURA y sus actores nombrados no incluyen al
rol operativo. Si el equipo decide que "alcalde" no es el rol `visitante`
actual, o que `gestor` también debe poder consultar el Plan de Acción, este
único `exigir_roles(...)` es el que cambia -- sin tocar nada más del
archivo.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.dependencias import ServicioCortesDep, SesionDep, exigir_roles
from app.modules.cortes.domain.entidades import Corte, TipoArchivoFuente
from app.modules.identidad.domain.entidades import Rol, Usuario
from app.modules.plan_accion.domain.entidades import (
    FilaFuenteMeta,
    FilaPlanAccion,
    agregar_por_meta,
    calcular_resumen,
)
from app.modules.plan_accion.persistence.consultas import construir_filas_plan_accion
from app.shared.errors import OperacionNoPermitida

router = APIRouter(prefix="/plan-accion", tags=["Plan de Accion"])

#: CA10 -- ver docstring del módulo. Any de los dos basta (igual semántica
#: que `exigir_roles` en el resto del backend: "al menos uno"). Mismo patrón
#: que `EscrituraDep` en `cortes/api/router.py`: se envuelve en
#: `Annotated[Usuario, Depends(...)]`, nunca se asigna la dependencia "pelada"
#: (FastAPI/Pydantic necesitan el tipo explícito para resolver el esquema).
AccesoPlanAccionDep = Annotated[Usuario, Depends(exigir_roles(Rol.ADMINISTRADOR, Rol.VISITANTE))]


# --- DTOs (Pydantic, nunca la entidad de dominio) ---------------------------


class FilaPlanAccionRespuesta(BaseModel):
    sector: str | None
    cod_indicador_producto: str
    nombre_producto: str | None
    meta_programada: Decimal | None
    cod_bpin: str | None
    rubros: list[str]
    presupuesto_definitivo: Decimal | None
    ejecucion: Decimal | None
    contratos: list[str]
    avance_fisico_pct: None
    avance_financiero_pct: Decimal | None
    estado_cruce: str


class ResumenPlanAccionRespuesta(BaseModel):
    """CA05: pie de la tabla."""

    total: int
    completo: int
    parcial: int
    sin_informacion: int


class PlanAccionRespuesta(BaseModel):
    corte_id: UUID
    vigencia: int
    fecha_corte: str
    filas: list[FilaPlanAccionRespuesta]
    resumen: ResumenPlanAccionRespuesta


def _fila_a_respuesta(fila: FilaPlanAccion) -> FilaPlanAccionRespuesta:
    return FilaPlanAccionRespuesta(
        sector=fila.sector,
        cod_indicador_producto=fila.cod_indicador_producto,
        nombre_producto=fila.nombre_producto,
        meta_programada=fila.meta_programada,
        cod_bpin=fila.cod_bpin,
        rubros=list(fila.rubros),
        presupuesto_definitivo=fila.presupuesto_definitivo,
        ejecucion=fila.ejecucion,
        contratos=list(fila.contratos),
        avance_fisico_pct=None,
        avance_financiero_pct=fila.avance_financiero_pct,
        estado_cruce=fila.estado_cruce.value,
    )


def _verificar_fuentes_completas(corte: Corte) -> None:
    """409 -- mismo criterio y misma duplicación deliberada que
    `trazabilidad/api/router.py::_verificar_fuentes_completas` (ver su
    docstring): el Plan de Acción tampoco tiene sentido sin las tres
    fuentes cargadas."""
    faltantes: list[TipoArchivoFuente] = corte.archivos_faltantes()
    if faltantes:
        raise OperacionNoPermitida(
            "El corte no tiene todas las fuentes cargadas. "
            f"Falta: {', '.join(tipo.value for tipo in faltantes)}.",
            detalles={
                "motivo": "fuentes_incompletas",
                "archivos_faltantes": [tipo.value for tipo in faltantes],
            },
        )


@router.get("/actual", response_model=PlanAccionRespuesta)
def obtener_plan_accion_actual(
    servicio: ServicioCortesDep,
    sesion: SesionDep,
    usuario: AccesoPlanAccionDep,
) -> PlanAccionRespuesta:
    """HU01-CA01: Plan de Acción consolidado del corte REGISTRADO más
    reciente (mismo criterio que `trazabilidad`/`ServicioCortes.
    obtener_corte_actual` -- global, sin filtro de vigencia).

    CA09: si no hay ningún corte registrado, `obtener_corte_actual()` ya
    lanza `RecursoNoEncontrado` (404) -- el frontend traduce ese 404 al
    estado vacío "Aún no hay cortes finalizados para consultar" (no es
    responsabilidad de este endpoint decidir el texto, solo señalar que no
    hay datos).

    CA04 (solo lectura): no existe ningún verbo de escritura en este
    router -- la ausencia es la implementación.
    """
    corte: Corte = servicio.obtener_corte_actual()
    _verificar_fuentes_completas(corte)

    filas_crudas = construir_filas_plan_accion(sesion, corte.id)
    filas_meta = [
        FilaFuenteMeta(
            cod_indicador_producto=f.cod_indicador_producto,
            nombre_producto=f.nombre_producto,
            sector=f.sector,
            meta_cuatrienio=f.meta_cuatrienio,
            cod_bpin=f.cod_bpin,
            codigo_rubro=f.codigo_rubro,
            presupuesto_apropiado=f.presupuesto_apropiado,
            ejecucion=f.ejecucion,
            numero_contrato=f.numero_contrato,
        )
        for f in filas_crudas
    ]
    filas_agregadas = agregar_por_meta(filas_meta)
    resumen = calcular_resumen(filas_agregadas)

    return PlanAccionRespuesta(
        corte_id=corte.id,
        vigencia=corte.vigencia,
        fecha_corte=corte.fecha_corte.isoformat(),
        filas=[_fila_a_respuesta(f) for f in filas_agregadas],
        resumen=ResumenPlanAccionRespuesta(
            total=resumen.total,
            completo=resumen.completo,
            parcial=resumen.parcial,
            sin_informacion=resumen.sin_informacion,
        ),
    )
