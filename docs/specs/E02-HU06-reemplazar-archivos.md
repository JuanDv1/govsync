# [E02-HU06] Reemplazar archivos durante la creación de un corte

**Estado de la Specification:** Borrador

> Mientras esté en `Borrador`, la fuente de requisitos vigente de esta HU es
> su hoja del Excel (`docs/requisitos/GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`,
> hoja `HU_E02_06`). El estado de avance de la tarjeta vive únicamente en
> Trello, no en este documento.

## Origen

Hoja `HU_E02_06` del Excel de levantamiento de requisitos.

## Historia

Como administradora quiero reemplazar o modificar un archivo cargado durante
la creación de un corte para corregir información errónea o incompleta antes
de finalizar.

## Actores y permisos

Administradora — único rol operativo hoy. La aplicación no tiene control de
acceso por rol: autenticación y autorización están fuera de alcance
(`docs/DECISIONES.md` D2).

## Criterios de aceptación

| ID            | Escenario                              | Dado                                                                        | Cuando                                                          | Entonces                                                                                                    | Tipo    | Notas                                                                                                                                       |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| E02-HU06-CA01 | Reemplazar archivo durante la creación | El corte está en estado "En creación" y una fuente ya tiene archivo cargado | selecciona "Reemplazar" en esa fuente y carga un archivo válido | El sistema valida y reemplaza el archivo; la fuente muestra el nuevo nombre, fecha y estado "Válido"        | Feliz   | Antes HU06-CA01                                                                                                                             |
| E02-HU06-CA02 | Reemplazo inválido                     | Seleccionó "Reemplazar"                                                     | carga un archivo inválido                                       | Lo rechaza con la lista de errores (columna/fila) y conserva el archivo anterior                            | Error   | Antes HU06-CA02                                                                                                                             |
| E02-HU06-CA03 | No perder las demás fuentes            | Hay 3 fuentes cargadas                                                      | reemplaza una de ellas                                          | Las otras 2 permanecen sin cambios                                                                          | Negocio | Antes HU06-CA03                                                                                                                             |
| E02-HU06-CA04 | Fuente sin archivo                     | Una fuente aún no tiene archivo                                             | revisa la fuente                                                | La acción se llama "Cargar" (no "Reemplazar") y funciona como carga inicial                                 | Alterno | Antes HU06-CA04                                                                                                                             |
| E02-HU06-CA05 | Cancelar el reemplazo                  | Abrió el selector de archivo para reemplazar                                | cierra el selector sin elegir archivo                           | No hay cambios en la fuente                                                                                 | Alterno | Antes HU06-CA05                                                                                                                             |
| E02-HU06-CA06 | Progreso guardado                      | El corte en creación tiene archivos cargados                                | la administradora sale del flujo y vuelve más tarde             | El corte sigue "En creación" con los archivos ya cargados                                                   | Negocio | Antes HU06-CA06. Resuelto: fila 2.0 de `03_DECISIONES_SPRINT2` (Cerrada) y D11 de `docs/DECISIONES.md` lo respaldan — ya no es `[VALIDAR]`. |
| E02-HU06-CA07 | Finalizar solo con fuentes válidas     | Está en el paso final de creación                                           | alguna de las 3 fuentes falta o es inválida                     | El botón "Finalizar corte" está deshabilitado e indica qué fuente falta                                     | Negocio | Antes HU06-CA07                                                                                                                             |
| E02-HU06-CA08 | Fin del flujo de creación              | El corte fue finalizado                                                     | se consulta de nuevo                                            | Ya no aparece "Reemplazar" de este flujo; los cambios posteriores se hacen con "Editar archivos" (E02-HU05) | Negocio | Antes HU06-CA08                                                                                                                             |

## Reglas de negocio

- El reemplazo y la carga inicial de una fuente usan el mismo mecanismo de
  backend; no hay una distinción de comportamiento entre "cargar" y
  "reemplazar" (CA04 es una distinción de interfaz, no de contrato).
  [`backend/app/modules/cortes/application/casos_uso.py:158-165`,
  `ServicioCortes.cargar_archivo`, docstring: "HU-06 (reemplazo del archivo)"].
- La validación y extracción del archivo ocurren por completo antes de abrir
  cualquier escritura; si el archivo de reemplazo es inválido, no se abre
  transacción y el archivo anterior no se modifica (CA02).
  [`casos_uso.py:166-174`, comentario EXTRACT+TRANSFORM/LOAD].
- Reemplazar una fuente no afecta el estado de las demás fuentes ya cargadas
  del mismo corte (CA03).

## Contrato

Endpoints ya existentes (ninguno nuevo para esta HU), sin autenticación
(fuera de alcance, D2):

- `POST /cortes/{corte_id}/archivos/{tipo}` — carga o reemplaza el archivo de
  una fuente del corte. Rechaza con 409 si el corte no está en estado
  "En creación" (CA08).
- `GET /cortes/{corte_id}` — consulta el corte, incluyendo sus fuentes ya
  cargadas (CA06).
- `POST /cortes/{corte_id}/registrar` — finaliza el corte; ya existe desde
  E02-HU01, sin cambios de esta HU (respalda CA07).

## Estados y errores

Estados relevantes de la entidad Corte: "En creación" (admite reemplazo,
CA01-CA07) y "Finalizado" (ya no admite, CA08).

| Código HTTP | `codigo`                 | Cuándo                                                                 |
| ----------- | ------------------------ | ---------------------------------------------------------------------- |
| 404         | `recurso_no_encontrado`  | El corte no existe                                                     |
| 409         | `operacion_no_permitida` | El corte ya está finalizado — no admite carga/reemplazo (CA08)         |
| 422         | `archivo_invalido`       | El archivo de reemplazo no cumple el formato esperado (CA02)           |
| 409         | `operacion_no_permitida` | Al finalizar, faltan fuentes obligatorias (CA07, contrato de E02-HU01) |

## Decisiones aplicadas

- Un corte en creación persiste en base de datos desde el momento en que se
  crea — "guardar progreso" (CA06) no exige ninguna acción explícita de
  guardado, el corte simplemente existe mientras no se finalice. Confirmado
  en la fila 2.0 de `03_DECISIONES_SPRINT2` ("Sí, queda en borrador",
  Cerrada).
- El reemplazo/carga de archivos se bloquea para un corte ya finalizado
  (CA08): el dominio lo rechaza con 409 antes de tocar el archivo
  [`backend/app/modules/cortes/domain/entidades.py`, `Corte.verificar_modificable`].
  Corregir un archivo de un corte finalizado es responsabilidad de E02-HU05
  ("Editar archivos"), todavía sin implementar.
- Transversal: D11 en `docs/DECISIONES.md` (a lo sumo un corte en creación
  activo en toda la tabla, índice único parcial) es la decisión de
  arquitectura que respalda la persistencia de CA06.
- `[VALIDAR]`: el changelog v2.1→v2.2 del Excel menciona que el par
  E02-HU05/HU06 "agrega... auditoría", pero ningún criterio de aceptación de
  esta HU pide explícitamente un registro de auditoría propio para el
  reemplazo durante la creación (más allá de que `ArchivoFuente` ya guarda
  nombre y fecha del archivo vigente). Pendiente que el equipo confirme si
  falta un requisito aquí o si la auditoría mencionada aplica solo a E02-HU05.

---

Esta Specification define **qué** debe hacer el sistema, no **cómo**
implementarlo. No incluye componentes, archivos, hooks, funciones, Tailwind
ni detalles internos de implementación, salvo los necesarios para definir el
comportamiento.
