# [EXX-HUyy] Nombre de la historia

**Estado de la Specification:** Borrador

> Valores posibles: `Borrador` o `Aprobada (quién, fecha)`.
>
> - Los `[VALIDAR]` pendientes impiden pasar a `Aprobada`.
> - Mientras esté en `Borrador`, la fuente de requisitos de esta HU es su hoja
>   del Excel (`docs/requisitos/`).
> - Una vez `Aprobada`, esta Specification es la fuente de requisitos de la HU.
> - El estado de la HU (avance de la tarjeta) vive únicamente en Trello —
>   este campo no lo reemplaza ni lo refleja.

## Origen

Hoja del Excel de levantamiento de requisitos correspondiente a esta HU
(`docs/requisitos/GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`, hoja
«[nombre de la hoja]»). Esta spec se construye a partir de esa hoja,
resolviendo sus marcas `[VALIDAR]`, sin inventar requisitos que no estén ahí.

## Historia

Como [rol], quiero [acción], para [beneficio].

## Alcance

_(omitir si no aplica)_

- **Incluye:** [...]
- **Fuera de alcance:** [...]

## Actores y permisos

Quién puede hacer qué. Marcar `[VALIDAR]` lo que no esté confirmado.

## Criterios de aceptación

Mismas columnas que el Excel. IDs con épica (`EXX-HUyy-CA01`). Cada criterio
debe ser verificable con Dado/Cuando/Entonces.

| ID            | Escenario | Dado | Cuando | Entonces | Tipo | Notas |
| ------------- | --------- | ---- | ------ | -------- | ---- | ----- |
| EXX-HUyy-CA01 |           |      |        |          |      |       |

En "Notas", si el criterio ya existía con otro ID en el Excel, indicarlo (ej.
"Antes HU10-CA01").

## Reglas de negocio

Separadas de los criterios de aceptación y de las decisiones. Si una regla ya
está en `docs/DECISIONES.md`, enlazar la entrada en vez de repetir el texto.

- [Regla, con su motivo.]

## Datos involucrados

_(omitir si no aplica)_

Entidades, datos y relaciones relevantes para esta HU, sin duplicar el modelo
técnico — apoyarse en [docs/DATOS.md](../DATOS.md) y enlazarlo.

## Contrato

Al escribir la spec el endpoint puede no existir todavía: esto es una
propuesta. Una vez implementado, si difiere del OpenAPI generado por FastAPI,
manda el OpenAPI y la spec se corrige en el mismo PR. No se copian aquí
esquemas de request/response.

- `MÉTODO /ruta/{parametro}` — autenticación/permisos: [...].
  `operationId`: solo si el endpoint lo declara explícitamente (el generado
  automáticamente es largo e inestable).

## Estados y errores

Estados relevantes de la entidad o del flujo _(omitir el apartado de estados
si la HU no los tiene)_, y los errores esperados:

| Código HTTP | `codigo` | Cuándo |
| ----------- | -------- | ------ |
|             |          |        |

## Decisiones aplicadas

Una decisión específica de esta HU se documenta **aquí**, con su porqué — el
criterio de aceptación solo recoge el resultado, no la razón. No esconder
decisiones dentro de los criterios.

- [Decisión específica de esta HU, con su motivo.]
- [Enlace a la entrada de `docs/DECISIONES.md` si la decisión es transversal
  a más de una HU, sin repetir el texto.]

---

Esta Specification define **qué** debe hacer el sistema, no **cómo**
implementarlo. No incluir componentes, archivos, hooks, funciones, Tailwind
ni detalles internos de implementación, salvo que sean necesarios para
definir el comportamiento.
