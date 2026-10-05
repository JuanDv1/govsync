# [E02-HU06] Reemplazar archivos durante la creación de un corte

**Estado de la Specification:** Borrador

> Spec retroactiva (2026-10-05): la HU ya está implementada y mergeada a
> `develop` (PR #130, commit de cierre de CA-8). Se escribe esta spec para
> ponerla al día con el proceso nuevo (`docs/PROCESO.md`), no porque falte
> implementar algo. Queda en `Borrador` porque CA-06 trae un `[VALIDAR]` sin
> resolver (ver tabla de CA) y porque "Actores y permisos" no tiene
> confirmación explícita del equipo todavía — no por duda sobre el código ya
> escrito.

## Origen

Hoja del Excel de levantamiento de requisitos (`docs/requisitos/GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`,
hoja «HU_E02_06»).

## Historia

Como administradora, quiero reemplazar o modificar un archivo cargado
durante la creación de un corte, para corregir información errónea o
incompleta antes de finalizarlo.

## Alcance

- **Incluye:** reemplazar (o cargar por primera vez) una de las tres fuentes
  (Plan Indicativo, Presupuestal, Plantilla BPIN) mientras el corte sigue en
  estado `BORRADOR` ("en creación").
- **Fuera de alcance:** corregir un archivo de un corte ya `REGISTRADO`
  ("finalizado") — eso es [E02-HU05] ("Editar archivos"), con su propio
  registro de auditoría. CA-08 de esta HU es exactamente el límite entre
  ambas: marca dónde termina HU-06 y empieza HU-05.

## Actores y permisos

Administradora. `[VALIDAR]`: el Excel no define un CA de restricción de rol
para esta HU (a diferencia de `[E04-HU01]/CA-10`) — no confirmado si
Supervisor/Alcalde deben o no ver esta acción. No bloqueante para el código
ya escrito: hoy no hay control de rol en ningún endpoint del sistema
(autenticación diferida, D2 en `docs/DECISIONES.md`).

## Criterios de aceptación

| ID            | Escenario                           | Dado                                                                  | Cuando                                            | Entonces                                                                                                                | Tipo     | Notas |
| ------------- | ------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| E02-HU06-CA01 | Reemplazar archivo durante la creación | El corte está en estado "En creación" y una fuente ya tiene archivo cargado | selecciona "Reemplazar" en esa fuente y carga un archivo válido | El sistema valida y reemplaza el archivo; la fuente muestra el nuevo nombre, fecha y estado "Válido"                      | Feliz    | Antes HU06-CA01 |
| E02-HU06-CA02 | Reemplazo inválido                   | Seleccionó "Reemplazar"                                                | carga un archivo inválido                          | Lo rechaza con la lista de errores (columna/fila) y conserva el archivo anterior                                         | Error    | Antes HU06-CA02 |
| E02-HU06-CA03 | No perder las demás fuentes          | Hay 3 fuentes cargadas                                                 | reemplaza una de ellas                             | Las otras 2 permanecen sin cambios                                                                                       | Negocio  | Antes HU06-CA03 |
| E02-HU06-CA04 | Fuente sin archivo                   | Una fuente aún no tiene archivo                                        | revisa la fuente                                   | La acción se llama "Cargar" (no "Reemplazar") y funciona como carga inicial                                              | Alterno  | Antes HU06-CA04. Solo frontend (etiqueta del botón) — la API usa el mismo endpoint para cargar y reemplazar. |
| E02-HU06-CA05 | Cancelar el reemplazo                | Abrió el selector de archivo para reemplazar                          | cierra el selector sin elegir archivo              | No hay cambios en la fuente                                                                                              | Alterno  | Antes HU06-CA05. Solo frontend — no hay petición HTTP si no se elige archivo. |
| E02-HU06-CA06 | Progreso guardado                    | El corte en creación tiene archivos cargados                          | la administradora sale del flujo y vuelve más tarde | El corte sigue "En creación" con los archivos ya cargados                                                                | Negocio  | `[VALIDAR]` (así venía en el Excel). Antes HU06-CA06. |
| E02-HU06-CA07 | Finalizar solo con fuentes válidas   | Está en el paso final de creación                                     | alguna de las 3 fuentes falta o es inválida        | El botón "Finalizar corte" está deshabilitado e indica qué fuente falta                                                  | Negocio  | Antes HU06-CA07 |
| E02-HU06-CA08 | Fin del flujo de creación            | El corte fue finalizado                                                | se consulta de nuevo                               | Ya no aparece "Reemplazar" de este flujo; los cambios posteriores se hacen con "Editar archivos" (HU-05)                 | Negocio  | Antes HU06-CA08. Límite claro entre HU-06 y HU-05. |

## Reglas de negocio

- Reemplazar y cargar por primera vez son la **misma operación** a nivel de
  dominio y de API: ambas pasan por `ServicioCortes.cargar_archivo`, que
  simplemente sobrescribe `Corte.archivos[tipo]` si ya existía. CA-01 y
  CA-04 son la misma mecánica vista desde dos estados distintos de la
  fuente, no dos flujos distintos.
- El archivo de reemplazo se valida con las mismas reglas de carga que
  [E02-HU02]/[E02-HU03]/[E02-HU04] (SEC-03: extensión, tamaño, columnas
  obligatorias) — rechazo total si es inválido (CA-02), nunca datos
  parciales.
- Un corte ya `REGISTRADO` no admite este flujo (CA-08) —
  `Corte.verificar_modificable()` lo bloquea explícitamente con 409 antes de
  gastar validación de archivo. Ver [docs/DECISIONES.md, D7](../DECISIONES.md)
  (los dos estados de `Corte`).

## Contrato

- `POST /cortes/{corte_id}/archivos/{tipo}` — sin autenticación (D2). Mismo
  endpoint para "cargar" (fuente sin archivo) y "reemplazar" (fuente con
  archivo existente); la diferencia de etiqueta ("Cargar" vs "Reemplazar")
  es solo de frontend (CA-04).

## Estados y errores

| Código HTTP | `codigo`               | Cuándo                                                                 |
| ----------- | ----------------------- | ------------------------------------------------------------------------ |
| 404         | `recurso_no_encontrado` | `corte_id` no existe                                                     |
| 409         | `operacion_no_permitida` | El corte ya está `REGISTRADO` (CA-08, `motivo: corte_no_es_borrador`)    |
| 422         | `archivo_invalido`      | El archivo no pasa SEC-03 (CA-02): extensión, tamaño, columnas, tipos    |

## Decisiones aplicadas

- `Corte.verificar_modificable()` (dominio) separa esta invariante
  (¿el corte sigue en BORRADOR?) de `Corte.verificar_reemplazable()`
  (invariante equivalente pero inversa para HU-05: ¿el corte ya está
  REGISTRADO y es el más reciente de su vigencia?) — mismo patrón, dos
  métodos, porque las reglas de autorización de ambas HU son mutuamente
  excluyentes por diseño: un corte nunca cumple las dos a la vez.
- CA-01/02/03/06/07 no necesitaron código nuevo: ya los resolvía el mismo
  mecanismo genérico de `cargar_archivo` compartido con HU-02/03/04 (antes
  de CA-08, ese mecanismo simplemente no distinguía el estado del corte).
