"""Construcción de la matriz de relación.

CAPA: Persistencia
TARJETAS: [HU-07][BE-01] Servicio de cruce de las tres fuentes
          [HU-07][BE-02] Manejo de relaciones múltiples sin colapsar
          [HU-07][BE-03] Registro de no coincidencias sin asociación ficticia
CUBRE: HU-07 / CA-2 a CA-8

=============================================================================
ESTRUCTURA DEL CRUCE
=============================================================================
El eje es el código de indicador de producto de 9 dígitos, la única llave
presente en las cuatro fuentes (ver app/shared/codigos.py).

    meta (PDT)
      ├─ proyecto_indicador -> proyecto     -> columna «Cód. BPIN»
      └─ rubro (SOLO hojas)                 -> columna «Cód. indicador (ejec.)»
            └─ registro_presupuestal
                  └─ contrato               -> «Núm. contrato» y «Descripción»

=============================================================================
TRES REGLAS QUE NO SE PUEDEN ROMPER
=============================================================================

1. FILTRAR ultimo_nivel = true.
   111 de 485 filas de ejecución son subtotales jerárquicos que YA contienen a
   sus hojas. Sin el filtro, cada meta aparece además emparejada con el
   subtotal que la contiene: infla la matriz y, en cualquier suma posterior,
   el dinero.

2. TODOS LOS JOIN SON LEFT (CA-8).
   «Si determinada información no pudo relacionarse, NO se crea una asociación
   ficticia.» Los campos sin correspondencia viajan como NULL EXPLÍCITO, nunca
   como cadena vacía, cero ni "N/A". La distinción entre "no hay dato" y "hay
   dato vacío" se conserva hasta el frontend.
   Una meta sin BPIN, sin ejecución o sin contrato SIGUE APARECIENDO: es el
   insumo de las alertas de cruce de E-04/HU-05.

3. NO COLAPSAR RELACIONES MÚLTIPLES (CA-7) — leer con cuidado.
   La tarjeta [HU-07][BE-02] dice: «PROHIBIDO: DISTINCT, LIMIT 1, first(), o
   cualquier agregación que se quede con una sola fila "porque queda más
   limpio". El CA lo prohíbe.»

   Pruebas obligatorias de esa tarjeta:
     - Un indicador con dos BPIN    -> aparecen ambos.
     - Un BPIN con tres indicadores -> aparecen los tres.
     - Conteo total de filas contrastado con el cálculo manual esperado.
       MÁS filas de las esperadas TAMBIÉN es un defecto.

   OJO CON UN CASO QUE PARECE VIOLAR LA REGLA Y NO LO ES:
   un contrato tiene 1..N registros presupuestales (319 registros / 270
   contratos). Como NINGUNA de las seis columnas de la matriz sale de
   `registro_presupuestal` —esa tabla solo hace de puente hacia el contrato—,
   un JOIN directo produce filas IDÉNTICAS en las seis columnas.

   La salida correcta NO es un DISTINCT sobre el resultado (lo prohíbe la
   tarjeta), sino deduplicar el PUENTE:

       SELECT DISTINCT rubro_id, contrato_id FROM registro_presupuestal

   Así no se genera fan-out en ningún momento, no se oculta ninguna relación
   válida, y la deduplicación queda explícita sobre lo que significa: «el
   conjunto de vínculos entre rubro y contrato».

=============================================================================
CUIDADO CON EL CRUCE ENTRE CORTES
=============================================================================
`proyecto_indicador` no tiene corte_id propio (lo tiene `proyecto`). Si se
encadenan dos LEFT JOIN, un indicador de OTRO corte con el mismo código entra
al primer JOIN y produce una fila fantasma con el proyecto en NULL. Acotar el
corte DENTRO de la subconsulta de proyectos.

=============================================================================
RENDIMIENTO
=============================================================================
El cruce sobre los archivos reales produce miles de combinaciones. Paginar del
lado del servidor: [HU-07][FE-01] pide el endpoint con paginación.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session


def construir_matriz(
    sesion: Session, corte_id: uuid.UUID, pagina: int = 1, tamano_pagina: int = 50
):
    raise NotImplementedError("[HU-07][BE-01]")
