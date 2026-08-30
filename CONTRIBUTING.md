# Guía de contribución — GovSync

## Flujo de trabajo
1. Cada Historia de Usuario (HU) tiene un Issue en GitHub, agrupado en un Milestone por sprint.
2. Crea una rama desde `main` nombrada según la HU: `feature/E-02-HU-01-crear-corte` (épica-HU-slug descriptivo). Para tareas que no corresponden a una HU (configuración, documentación), usa `chore/<slug>`; para arreglos, `fix/<slug>`.
3. Haz commits siguiendo [Conventional Commits](https://www.conventionalcommits.org/) (validado automáticamente), referenciando el issue: `feat: cargar PDT (refs #12)`.
4. Abre un Pull Request hacia `main`. Usa `Closes #<numero>` en la descripción para cerrar el issue automáticamente al mergear.
5. El PR necesita: CI en verde + al menos 1 aprobación (por defecto, de un dev core vía CODEOWNERS).
6. Usa "Squash and merge" al integrar (mantiene el historial de `main` limpio).

## Despliegue
- **Frontend**: Vercel despliega automáticamente al mergear a `main` (integración nativa con GitHub, "Root Directory" configurado en `frontend/`).
- **Backend + Base de datos**: Render en fase de piloto/desarrollo, AWS Lightsail en producción. El mecanismo de despliegue automático aún no está definido — por ahora es manual, se documentará aquí cuando se decida.

## Antes de tu primer commit
```bash
npm install
```
Esto activa los hooks locales (Husky) automáticamente vía el script `prepare`. Nota: esto solo instala el tooling de gobernanza (lint/format/commits) para el frontend — para trabajar en el backend, sigue además las instrucciones de `backend/README.md` (entorno virtual de Python, dependencias) cuando existan.

## Convención de commits