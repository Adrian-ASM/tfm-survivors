# Design · 0001-walking-skeleton

## Resumen
Un núcleo puro (`domain` + `application`) mueve al jugador en ticks fijos de 1/60 s y devuelve un `RunSnapshot`
inmutable. Phaser 4 (infraestructura) solo lee el teclado, le pasa al bucle el tiempo transcurrido y pinta el
snapshot. Los guardarraíles de arquitectura se aplican a cualquier autor reutilizando los hooks de `.claude/hooks/`
en el `pre-commit` y en CI, además de ESLint con reglas de capas.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `shared/Vector2` (VO) | Nueva | Inmutable: `add`, `scale`, `length` (la normalización vive en `PlayerInput.of`). Base de `Position` y `PlayerInput` |
| domain | `arena/Arena` (VO) | Nueva | Ancho y alto; `clampCircle(center, radius)`. Invariante: ancho, alto > 0 |
| domain | `player/Player` (entidad) | Nueva | Posición, radio y velocidad; `move(input, dt, arena)` devuelve un `Player` nuevo |
| domain | `player/PlayerInput` (VO) | Nueva | Componentes limitadas a [-1, 1] y normalizadas si el módulo > 1 |
| domain | `run/Run` (aggregate root) | Nueva | Tick actual + jugador + arena; `tick(input)` avanza un paso; `snapshot()` devuelve copia congelada |
| domain | `run/RunSnapshot` (DTO) | Nueva | `{ tick, player: { x, y, radius } }`, `readonly` y `Object.freeze` |
| domain | `shared/Result` | Nueva | `Ok | Err` para fallos esperables (AGENTS.md §4) |
| application | `FixedStepLoop` | Nueva | Acumulador puro: `advance(elapsedMs, step) → ticks ejecutados` (`step` es un callback por tick). Tope 250 ms (15 ticks) |
| application | `StartRun` (caso de uso) | Nueva | Crea un `Run` a partir de `RunConfig` ya validado |
| application | `TickRun` (caso de uso) | Nueva | Orquesta `FixedStepLoop` + `Run`; devuelve el `RunSnapshot` del frame |
| infrastructure | `content/loadRunConfig` | Nueva | Lee `content/player.json` y `content/arena.json` y los valida con zod → `Result<RunConfig>` |
| infrastructure | `phaser/KeyboardInput` | Nueva | WASD + flechas → `PlayerInput` |
| infrastructure | `phaser/GameScene` | Nueva | `update(_, deltaMs)`: input → `TickRun` → pinta el círculo. Sin lógica de juego |
| composition | `main.ts` | Nueva | Carga contenido, crea casos de uso y `Phaser.Game`; si el contenido es inválido muestra el error en pantalla |
| tooling | `scripts/guard-staged.mjs` | Nueva | Ejecuta los dos hooks sobre el contenido preparado (`git show :<ruta>`) o, con `--all`, sobre `git ls-files` |
| tooling | `eslint.config.js` | Nueva | typescript-eslint `strictTypeChecked` + `no-restricted-imports` por capa + `no-restricted-globals/properties/syntax` (ver "Cambios en apply") |
| tooling | `.husky/pre-commit` | Nueva | `npx lint-staged && node scripts/guard-staged.mjs` |
| tooling | `.github/workflows/ci.yml` | Mod. | Añade `npm run guard:all` en `quality` (dentro de `npm run verify`) |

Sin puertos nuevos: el movimiento no necesita `Clock` ni `RandomGenerator` (el tiempo llega como argumento y no hay
azar). Se crearán cuando un change los necesite, con dos implementaciones (real y fake), para no sobrediseñar.

## Flujo de un frame
```mermaid
sequenceDiagram
  participant P as Phaser (GameScene)
  participant K as KeyboardInput
  participant T as TickRun
  participant L as FixedStepLoop
  participant R as Run
  P->>K: read()
  K-->>P: PlayerInput
  P->>T: execute(deltaMs, input)
  T->>L: advance(deltaMs)
  loop 0..15 ticks
    L->>R: tick(input)
  end
  T-->>P: RunSnapshot (congelado)
  P->>P: circle.setPosition(snapshot.player.x, y)
```

## Guardarraíles reutilizados (architecture-guardrails)
`guard-staged.mjs` no duplica reglas: los hooks de `.claude/hooks/` exportan `check(toolInput) → string[]` y
`guard-staged.mjs` los importa y ejecuta **en un solo proceso**; el modo stdin (`runAsHook`) se mantiene para
Claude Code. El índice se lee con una única llamada `git cat-file --batch`. Así hay **una sola fuente de reglas**
para las tres capas (Claude Code, pre-commit, CI) y "Commit limpio" tarda ~150 ms con 50 ficheros (ronda 2;
la primera versión, un `node` por fichero y hook, rozaba los 2 s). `--no-verify` queda prohibido en AGENTS.md y
lo cubre el CI.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| phaser | 4.2.1 | Motor (ADR-0001) | Kaplay, Canvas 2D (spike) |
| zod | 4.6.7 | Validar contenido y entradas externas (AGENTS.md §3.6) | Validación manual |
| typescript | 6.0.3 | Tipado estricto | 7.0.2: typescript-eslint 8.73 solo admite TS < 6.1 |
| vite | 8.3.8 | Dev server y build | — |
| vitest | 5.1.1 | Tests de dominio y aplicación | Jest (más configuración con ESM y TS) |
| @playwright/test | 1.65.1 | Smoke E2E en chromium | Cypress (más pesado) |
| eslint | 10.15.0 | Guardarraíl capa 2 | — |
| @eslint/js | 10.0.1 | Reglas base | — |
| typescript-eslint | 8.73.0 | Reglas con información de tipos | — |
| prettier | 3.10.1 | Formato | — |
| husky | 9.1.7 | Hook `pre-commit` | Hooks de git a mano (no se versionan) |
| lint-staged | 17.6.1 | ESLint/Prettier solo sobre lo preparado | — |
| @types/node | 26.6.6 | Tipos para scripts y config | — |

Todas con versión exacta (sin `^`), y `package-lock.json` versionado.

## Rendimiento y seguridad
- Presupuesto: `Run.tick` < 0,05 ms (trivial en este change; se mide con `vitest bench` en el change de colisiones,
  ADR-0003). Bundle de producción: medir y anotar en el verify-report (Phaser domina el tamaño).
- Sin datos persistidos ni red. Única entrada externa: `content/*.json` (versionado, validado con zod).
- Vite `base: '/tfm-survivors/'` para GitHub Pages.
- E2E: `main.ts` expone `window.__sprint` (solo lectura del último snapshot) **solo** si la URL lleva `?e2e`, para
  que Playwright verifique el movimiento sin leer píxeles.

## Pasos manuales del autor (fuera del código)
1. GitHub → *Settings → Pages → Source: GitHub Actions* (necesario para `deploy-pages`).
2. Protección de `main`: exigir PR y el check `quality` (ver docs/exploration §4 sobre `paths-ignore`).

## Cambios en apply
- **Sin `eslint-plugin-boundaries`**: con imports TypeScript sin extensión necesitaba además
  `eslint-import-resolver-typescript` (una dependencia más). `no-restricted-imports` con patrones `**/<capa>/**`
  cubre las rutas relativas; lo prueban los tests de `tests/guardrails/eslint.test.ts`.
- **Validación del radio**: `loadRunConfig` valida el conjunto jugador+arena con `superRefine` (reutiliza
  `Arena.fits` del dominio), así que la **carga** falla con `player.radius`, como dice la spec (ronda 2, W4).
  `Run.start` mantiene la invariante como defensa y exige `speed > 0`, con los mismos mensajes que zod.
- **Bundle medido**: 1.439,84 kB (378,90 kB gzip), casi todo Phaser. `chunkSizeWarningLimit` a 1.600 kB.

## ADRs
- ADR-0001 (Phaser 4.2.1), ADR-0002 (núcleo puro). Sin ADR nueva: la reutilización de hooks se documenta aquí y en
  AGENTS.md §3.
