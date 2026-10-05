# [EXX-HUyy] Nombre de la historia

**Spec:** Borrador

> La línea de arriba indica la validez de ESTE documento, no el avance de la
> tarjeta en Trello (eso vive solo en Trello). Valores posibles:
> `Borrador` o `Aprobada (quién, fecha)`. No puede pasar a `Aprobada` con
> marcas `[VALIDAR]` sin resolver.
>
> Mientras esté en `Borrador`, la fuente de requisitos vigente de esta HU es
> su hoja del Excel (`docs/requisitos/`), no este documento.

## Origen

Hoja del Excel de levantamiento de requisitos correspondiente a esta HU
(`docs/requisitos/GovSync_Levantamiento_Requisitos_v2_2_Sprint2.xlsx`, hoja
«[nombre de la hoja]»). Esta spec se crea copiando esa hoja y resolviendo sus
marcas `[VALIDAR]`.

## Historia

Como [rol], quiero [acción], para [beneficio].

## Criterios de aceptación

| ID            | Criterio | Notas |
| ------------- | -------- | ----- |
| EXX-HUyy-CA01 |          |       |
| EXX-HUyy-CA02 |          |       |

## Reglas de negocio

- [Regla, con su motivo. Si ya está en `docs/DECISIONES.md`, enlazar la entrada
  en vez de repetir el texto.]

## Contrato

Ruta y operación del OpenAPI que genera FastAPI (`/docs` o `/openapi.json`),
no se copian aquí los esquemas de request/response:

- `MÉTODO /ruta/{parametro}` — ver operación `nombre_operacion` en el OpenAPI.

## Errores

| Código HTTP | `codigo` | Cuándo |
| ----------- | -------- | ------ |
|             |          |        |

## Decisiones aplicadas

- [Enlace a la entrada de `docs/DECISIONES.md` si la decisión es transversal
  a más de una HU. Una decisión que solo afecta esta HU se documenta aquí
  mismo, en el criterio de aceptación que corresponda, no en
  `docs/DECISIONES.md`.]
