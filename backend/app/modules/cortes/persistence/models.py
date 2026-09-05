"""Modelos ORM del corte y de los datos que sus fuentes alimentan.

CAPA: Persistencia
TARJETA: [BD-01] Modelo de dominio y migraciones Alembic iniciales
BLOQUEADA POR: [REF-01] Verificación de diagramas conceptual y E/R

=============================================================================
ANTES DE ESCRIBIR ESTE ARCHIVO: RESOLVER [REF-01]
=============================================================================
Circulan tres esquemas (govsync_schema.sql, govsync_schema2.sql,
govsync_schema_con_auditoria.sql) MÁS un diagrama E/R paralelo, y no están
reconciliados. La guía del proyecto (§5) lo advierte explícitamente.

DECISIÓN QUE EL EQUIPO DEBE TOMAR: a partir de aquí, ¿la migración de Alembic
es la única fuente de verdad del esquema? Si la respuesta es sí, los tres .sql
quedan como material histórico.

=============================================================================
TABLAS MÍNIMAS DEL SPRINT 1
=============================================================================
  corte                     vigencia, fecha_corte, estado(BORRADOR|REGISTRADO)
  archivo_fuente            corte_id, tipo, nombre, filas, reutilizado, origen
  meta                      del PDT       -> [HU-02]
  meta_programacion         física y financiera por año
  proyecto                  de la plantilla BPIN -> [HU-04]
  proyecto_indicador        separación multivalor -> [HU-04][BE-03]
  rubro                     de la pestaña Ejecución  -> [HU-03]
  contrato                  de la pestaña Contratación -> [HU-03]
  registro_presupuestal     puente contrato <-> rubro (1..N por contrato)

=============================================================================
DECISIONES DE MODELO YA VERIFICADAS CONTRA LOS DATOS REALES
=============================================================================
Ver docs/DECISIONES.md y docs/DATOS.md. Las que más impacto tienen:

1. Los códigos de indicador son VARCHAR(9), NUNCA INTEGER. Hay cuatro que
   empiezan en cero.

2. `rubro.ultimo_nivel` NOT NULL. 111 de 485 filas son subtotales jerárquicos
   que ya contienen a sus hojas.

3. UNIQUE (corte_id, codigo_rubro_nivel). Verificado: 484 únicos de 485, y 0
   duplicados entre las 374 filas hoja. NO usar codigo_rubro_ccpet (142
   duplicados).

4. `registro_presupuestal` SIN restricción UNIQUE: 45 filas repiten
   (contrato, registro) con rubros distintos. Deuda técnica documentada hasta
   revisar esos casos con quien conoce el proceso de captura.

5. `registro_presupuestal.rubro_id` NULLABLE a propósito: si el código de
   rubro de Contratación no cruza, guardar la fila con el código crudo para
   diagnóstico en vez de rechazar la carga completa.

6. HU-02/CA-3 declara la marca "Principal" como columna obligatoria: hace
   falta una columna donde guardarla.

7. Índice compuesto (corte_id, cod_indicador_producto) en meta, rubro y
   contrato: son exactamente las condiciones de JOIN de la matriz [HU-07].

PREGUNTA QUE DEBEN HACERSE EN CADA REGLA (instrucciones del proyecto):
¿esta regla debe vivir solo en Python, o también debería protegerla la base?
"""

from __future__ import annotations

from app.core.database import Base  # noqa: F401

# TODO [BD-01] Declarar aquí los modelos ORM y luego generar la migración:
#     alembic revision --autogenerate -m "esquema inicial"
#     alembic upgrade head
