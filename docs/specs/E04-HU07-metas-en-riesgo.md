# [E04-HU07] Visualizar metas con menos del 50 % de avance financiero

**Estado de la Specification:** Borrador

## Origen

Hoja «HU_E04_07» del levantamiento de requisitos v3.0. Mientras esta spec
esté en `Borrador`, la fuente de requisitos es esa hoja.

## Historia

Como administradora y alcalde, quiero visualizar las metas con menos del
50 % de avance financiero, para identificar posibles riesgos de ejecución.

## Alcance

- **Incluye (backend):** cálculo y listado de las metas en riesgo del corte
  actual (CA01 a CA05, CA07).
- **Incluye (frontend):** la pantalla `/plan-accion/riesgo` (`MetasEnRiesgo.jsx`),
  con el mismo permiso del Plan de Acción. Solo muestra lo que entrega el
  backend; no recalcula, no reordena ni filtra.
- **Fuera de alcance por ahora:** el campo "Responsable" (CA06), en backend y
  en la pantalla, hasta cerrar la decisión #14.

## Actores y permisos

`administrador` y `visitante` (alcalde), igual que el resto del Plan de
Acción. `gestor` no tiene acceso.

## Criterios de aceptación

Los de la hoja «HU_E04_07» (E04-HU07-CA01 a CA07), sin cambios.

| ID            | Estado en backend                                            | Estado en frontend                                               |
| ------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| E04-HU07-CA01 | Implementado                                                 | Muestra las metas que entrega el backend                         |
| E04-HU07-CA02 | Implementado con la definición vigente de "Ejecución" (D26)  | Muestra el % que calcula el backend                              |
| E04-HU07-CA03 | Implementado (50,0 % exacto no es riesgo)                    | Lo decide el backend                                             |
| E04-HU07-CA04 | Implementado: no se listan; se informa cuántas son           | Contador "N metas sin presupuesto (no se listan)"                |
| E04-HU07-CA05 | Implementado (menor a mayor; el código de la meta desempata) | Conserva el orden del backend                                    |
| E04-HU07-CA06 | Parcial: falta "Responsable" `[VALIDAR: decisión #14]`       | Pendiente: no se muestra "Responsable" `[VALIDAR: decisión #14]` |
| E04-HU07-CA07 | Implementado: lista vacía                                    | Mensaje "No hay metas en riesgo en este corte"                   |

## Reglas de negocio

- % de avance financiero = Ejecución / Presupuesto definitivo × 100. Es el
  mismo cálculo del Plan de Acción ([D26](../DECISIONES.md)); esta HU no
  define qué es "Ejecución" `[VALIDAR: decisión #8]`.
- Riesgo = avance estrictamente menor a 50 %.
- Meta sin presupuesto definitivo (vacío o 0): no se calcula ni se lista
  (CA04).
- **Meta con presupuesto definitivo > 0 pero sin ningún dato de ejecución:**
  cuenta como 0 % de avance, entra a la lista (primera, por CA05) y se
  marca `sin_ejecucion_registrada=true`. Decisión del PO (2026-11-11,
  pendiente de ratificar con la clienta junto con la decisión #8): el
  rubro existe y su celda de ejecución está vacía, es decir, no se ha
  ejecutado nada -- el caso más riesgoso, que antes desaparecía del
  reporte sin aviso. Una meta con ejecución 0 REAL (dato explícito, no
  vacío) también entra en 0 % pero no se marca.

## Contrato

- `GET /api/v1/plan-accion/riesgo` — autenticación/permisos: `administrador`
  o `visitante`. Cada fila agrega `sin_ejecucion_registrada: bool` sobre
  los campos de `/plan-accion/actual`; ese otro endpoint no cambia y
  sigue mostrando "--" (D26) para el mismo caso.

## Estados y errores

| Código HTTP | `codigo`                 | Cuándo                                      |
| ----------- | ------------------------ | ------------------------------------------- |
| 401         | `credenciales_invalidas` | Sin token                                   |
| 403         | `permiso_insuficiente`   | Rol distinto de `administrador`/`visitante` |
| 404         | `recurso_no_encontrado`  | Ningún corte REGISTRADO                     |
| 409         | `operacion_no_permitida` | Al corte actual le falta alguna fuente      |

## Decisiones aplicadas

- **Se adelantó el backend con la tarjeta aún marcada como bloqueada**
  (acuerdo del equipo, 2026-11-10): la regla reutiliza el cálculo ya
  vigente del Plan de Acción, así que cerrar la decisión #8 cambia un solo
  lugar y no esta HU.
- **Corte:** se usa el corte registrado más reciente, igual que
  `/plan-accion/actual`. CA01 dice "hay un corte seleccionado";
  `[VALIDAR]` si debe poder elegirse otro corte.
- **Ubicación:** vive en el módulo `plan_accion` porque usa su misma
  agregación por meta. Si el equipo prefiere el módulo `alertas` (que
  ya tiene código desde HU-05) para HU-06/07, es mover un archivo de dominio
  y un endpoint.
- **Meta con presupuesto pero sin dato de ejecución:** cuenta como 0 % y
  se marca `sin_ejecucion_registrada` -- decisión del PO del 2026-11-11
  (ver "Reglas de negocio"), pendiente de ratificar con la clienta junto
  con la decisión #8.
- **Pantalla (frontend):** la marca se muestra con el texto "Sin ejecución
  registrada" (insignia, no solo color), para distinguirla de un 0 % que sí
  viene en el archivo. Pruebas: `MetasEnRiesgo.test.jsx`.
