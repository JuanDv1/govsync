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
