# Proceso de trabajo — GovSync

Reglas de juego, definición de terminado y convención de uso de IA, separadas
de la planificación tarjeta-por-tarjeta del Sprint 1 (`docs/archivo/sprint-1/PLANDETRABAJO.md`,
histórico). Esto es lo que sigue vigente entre sprints.

**Estado, prioridad, responsable y estimación de cada tarjeta viven únicamente
en Trello** — ningún documento de este repositorio los replica. El ciclo de
listas es: `Sprint2` → `Tareas en proceso` → `Código (PR abierto)` →
`Testing` (ya en `develop`) → `Tareas hechas` (ya en `main`).

---

## 1. Reglas del juego

Léanlas antes de escribir la primera línea. Son cinco y evitan el 90 % de los
choques.

### R1 · Nadie crea archivos que no estén en su tarjeta

El esqueleto ya tiene la estructura completa. Cada tarjeta dice qué archivo
toca. Si siente que necesita uno nuevo, primero pregunte en el grupo: casi
siempre significa que la lógica va en un archivo que ya existe, en otra capa.

### R2 · El contrato está en el _stub_, no en la conversación con la IA

Cada archivo del esqueleto tiene un docstring con su capa, su tarjeta, sus CA y
las trampas conocidas de los datos reales. **Ese docstring es el contrato.**
Cuando le pida código a la IA, péguele el archivo completo (más abajo, en
§3, está la plantilla). Si la IA propone cambiar la firma de un método público
o mover algo de capa, no lo acepte sin avisar al grupo: esa firma es de la que
dependen los demás.

### R3 · La prueba de arquitectura manda

`backend/tests/test_arquitectura.py` analiza el código y **rompe la build** si:

- el dominio importa FastAPI, SQLAlchemy, pandas, openpyxl o Pydantic;
- la capa de aplicación importa FastAPI;
- un router consulta la base directamente;
- pandas u openpyxl aparecen fuera de `persistence/`.

No la desactive. Si su tarjeta parece exigir romperla, es que la lógica va en
otra capa.

### R4 · Un CA sin prueba no está terminado

La trazabilidad es **HU → CA → código → prueba → evidencia**. Cada criterio de
aceptación se cierra con al menos una prueba automatizada cuyo nombre incluye
el ID del CA (ver `docs/specs/_plantilla.md`). Sin ella, la tarjeta no pasa a
"Tareas hechas".

### R5 · Commits pequeños y en orden

Un solo commit gigante al final vale menos que varios commits que cuentan cómo
se construyó. Convención de mensajes: `CONTRIBUTING.md`.

---

## 2. Definición de terminado

Antes de mover una tarjeta a "Tareas hechas" en Trello:

- [ ] Todos los CA de la tarjeta implementados
- [ ] Cada CA tiene al menos una prueba automatizada con su ID en el nombre
      (R4) que lo verifica
- [ ] `pytest` pasa y la cobertura no baja del 70 %
- [ ] `ruff check .` y `ruff format --check .` limpios
- [ ] Datos inválidos y casos borde probados
- [ ] Migración incluida si cambió el esquema
- [ ] `pytest tests/test_arquitectura.py` en verde
- [ ] Si la HU tiene spec en `docs/specs/`, queda enlazada desde el PR
- [ ] Si usó IA: PR marcado con la convención `[IA-ASISTIDO]` de
      `.github/pull_request_template.md`
- [ ] Revisado por alguien de la **otra** capa (`[REF-06]`)

---

## 3. Cómo pedirle código a la IA sin crear un Frankenstein

Esta es la parte que resuelve el problema que les preocupa. **Usen esta
plantilla, siempre.**

```
Trabajo en GovSync, un monolito modular en 5 capas (API, Aplicación,
Dominio, Persistencia, BD). Las dependencias apuntan HACIA el dominio.

TAREA: [pegue el nombre de la tarjeta de Trello]

ARCHIVO A IMPLEMENTAR: [ruta]

Este es el archivo actual, con su contrato en el docstring:
[PEGUE EL ARCHIVO COMPLETO DEL ESQUELETO]

CRITERIOS DE ACEPTACIÓN QUE DEBE CUMPLIR:
[pegue los CA del checklist de la tarjeta, textuales]

RESTRICCIONES:
- No cambies las firmas de los métodos públicos: otros módulos dependen
  de ellas.
- No agregues archivos nuevos.
- Si el archivo está en domain/: prohibido importar FastAPI, SQLAlchemy,
  pandas, openpyxl o Pydantic.
- Si está en application/: prohibido importar FastAPI.
- Las excepciones son las de app/shared/errors.py, no excepciones nuevas.

Implementa el archivo y escribe las pruebas que verifican cada CA.
Explica qué decisión tomaste en cada punto donde había alternativas.
```

Tres cosas más:

1. **Si la IA propone cambiar una firma pública, no lo acepte solo.** Avise en
   el grupo: esa firma es de la que dependen los demás.
2. **Si la IA inventa un requisito que no está en el CA, quítelo.** Nunca
   convertir un supuesto en requisito. Si de verdad hace falta, es una tarjeta
   nueva.
3. **Entienda lo que le entregó antes de commitear.** Código que funciona pero
   no se entiende es una nota perdida en el Code Walkthrough.
