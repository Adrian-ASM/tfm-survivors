# Proposal · 0001-walking-skeleton

- **Estado**: pendiente de aprobación
- **Issue**: — (crear al subir el repo)
- **Rama / worktree**: `change/0001-walking-skeleton`
- **Bloqueado por**: ADR-0001 (motor). Se puede empezar todo salvo el adaptador de render.

## Problema
El repositorio solo tiene contexto para agentes y documentación. No hay código, guardarraíles ejecutables ni despliegue,
así que la IA aún no trabaja "dentro de un carril" y no hay URL pública que enseñar.

## Objetivo
Que `main` sea desplegable desde el primer día: un círculo que se mueve con el teclado, calculado por un núcleo puro
(`TickRun`) y pintado por el motor, publicado en GitHub Pages por el pipeline.

## Alcance
- **Dentro**:
  - Scaffold Vite + TypeScript estricto + motor elegido (versión exacta).
  - Estructura Clean **mínima**: `domain/`, `application/`, `infrastructure/`, `composition/`.
  - Núcleo: `Position`/`Velocity` (VOs), `PlayerInput` (DTO), `TickRun` con paso fijo de 1/60 s y normalización diagonal.
  - Guardarraíles capa 2: ESLint (typescript-eslint) con reglas de capas y pureza, Prettier, husky + lint-staged.
  - Tests: Vitest (dominio + determinismo) y un smoke E2E con Playwright (chromium).
  - `npm run verify`; activar `.github/workflows/ci.yml` y despliegue a Pages.
  - Actualizar README (instalación, ejecución, estructura) y la sección de comandos de AGENTS.md.
- **Fuera**: enemigos, colisiones, armas, arte definitivo, audio, guardado.

## Capacidades afectadas
- `openspec/specs/player-movement` (nueva)
- `openspec/specs/simulation-loop` (nueva)

## Riesgos y dudas
- La IA mezcla APIs de Phaser 3 y 4 → versión fijada + verificación en documentación oficial.
- Configurar `base` de Vite para Pages (`/<repo>/`).
- Windows: saltos de línea y rutas en hooks (`.gitattributes` ya fuerza LF).

## Criterio de éxito
- `npm run verify` y CI en verde.
- URL pública de Pages mostrando el círculo que se mueve.
- Captura de una violación de arquitectura bloqueada por el hook y por ESLint (evidencia para la memoria).
