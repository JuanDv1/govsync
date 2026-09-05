# Estándar de Ramas

## Formato

```
<tipo>/<identificador-opcional>/<descripcion-corta>
```

## Tipos

| Tipo       | Propósito           | Ejemplo                          |
| ---------- | ------------------- | -------------------------------- |
| `feature`  | Nueva funcionalidad | `feature/crear-endpoint-ordenes` |
| `bugfix`   | Corrección de bug   | `bugfix/validacion-fecha`        |
| `refactor` | Mejora de código    | `refactor/simplificar-auth`      |
| `docs`     | Documentación       | `docs/actualizar-readme`         |
| `test`     | Tests               | `test/dashboard-filters`         |
| `chore`    | Mantenimiento       | `chore/actualizar-deps`          |

## Reglas

- Minúsculas, palabras separadas por guiones (`-`).
- Se crea siempre desde la rama de integración del equipo (`develop`).
- Nunca se commitea directo en la rama de integración ni en producción (`main`).
- El identificador de historia/issue (`E-XX-HU-XX`) es opcional pero recomendado.

```bash
<!-- ejemplo de flujo -->
git checkout develop
git pull origin develop
git checkout -b feature/nombre-de-la-tarea
```

---

# Formato de Commits

Basado en [Conventional Commits](https://www.conventionalcommits.org/).

## Estructura

```
<tipo>(<alcance opcional>): <descripción en presente, minúscula>
```

## Tipos permitidos

| Tipo       | Cuándo usarlo                                  |
| ---------- | ---------------------------------------------- |
| `feat`     | Nueva funcionalidad                            |
| `fix`      | Corrección de bug                              |
| `docs`     | Solo documentación                             |
| `style`    | Formato, sin cambio de lógica                  |
| `refactor` | Cambio de código sin alterar el comportamiento |
| `test`     | Agregar o corregir tests                       |
| `chore`    | Mantenimiento, dependencias, config            |
| `perf`     | Mejora de rendimiento                          |

## Ejemplo

```bash
<!-- ejemplo de commit -->
git commit -m "feat(orders): agregar endpoint de creación de orden"
```
