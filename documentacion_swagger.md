# Documentación con Swagger (OpenAPI)

## Regla del equipo

Ningún endpoint nuevo se aprueba en PR sin su bloque `@openapi` completo.

## Patrón por endpoint

```typescript
<!-- ejemplo -->
/**
 * @openapi
 * /api/<recurso>/{id}:
 *   get:
 *     tags:
 *       - <!-- Nombre del dominio -->
 *     summary: <!-- resumen corto -->
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: <!-- descripción -->
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/<!-- NombreSchema -->'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', getHandler);
```

## Puntos clave

- `tags`: agrupa endpoints en la UI por dominio.
- `security: - bearerAuth: []`: obligatorio en todo endpoint que requiera autenticación.
- `$ref`: reutiliza schemas y respuestas ya definidos; nunca dupliques la misma estructura en dos sitios.

## Registrar un módulo nuevo

1. Confirma que el patrón de rutas (`**/routes.ts` o equivalente) ya cubre el archivo nuevo automáticamente.
2. Registra el router en el archivo central de la app (`app.ts` o equivalente).

---
