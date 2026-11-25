# Verify report · 0025-stone-resource

Auditor independiente. Rama `change/0025-stone-resource`, 8 commits sobre c7c450d.

## Resultados de ejecución
- `npm run verify`: verde (lint, typecheck, guard:all con 1016 ficheros, vitest 266 ficheros / 3223 tests).
- `npm run test:e2e`: 16/16 verdes (proyecto `logic`).

## Escenarios -> test -> estado
Se comprobó que el título de los 71 escenarios de las 6 specs delta aparece en `tests/`. 68 coinciden literalmente.
Los 3 que no coincidían por redacción tienen test equivalente:

| Escenario | Test | Estado |
|---|---|---|
| No baja al comprar ni al recibir daño | `run-stone-pickup.test.ts` ("No baja al recibir daño", "No baja al comprar") y `stockpile.test.ts` | OK |
| Quieto sigue perdiendo | `balance.test.ts` ("Jugador quieto con el contenido por defecto") | OK |
| Partida con piedra reproducible en el mapa vacío | `determinism-stone.test.ts` (`it.each` generated/empty) | OK |
| Tirada 1 valor por baja (p=0, 100, detonado, orden armas/peligros, tope lleno) | `stone-drops.test.ts`, `run-stone.test.ts`, `determinism-stone.test.ts` | OK |
| Línea base intacta (30/50, 0 quietos, filas idénticas a `BALANCE_BASELINE`) | `balance.test.ts` (línea base sin regenerar; `balanceBaseline.ts` sin cambios) | OK |
| Firmas MAP/STRUCTURE/RESOURCE/SHEEP intactas; `STONE_GOLDEN` nueva | `stoneGolden.ts` es nuevo; ninguna otra firma tocada en el diff | OK |
| Hojas Deco/04-06 registradas e íntegras, sin Free Pack | `stone-provenance.test.ts`; sha256 y bytes de la nota coinciden con los ficheros | OK |
| Roca por origen, reserva, HUD, sonda | `appearance-stone`, `stone-render`, `pickup-layer`, `hud`, `resources-content` | OK |
| Piedra en el navegador [E2E] | Ampliación del E2E de recursos en `gameplay.spec.ts`; ningún E2E nuevo | OK |
| Sin rastro en resultados ni guardado | Ningún cambio en `src/domain/progress` ni en el almacenamiento (grep de `stone` vacío); tests de resultados/progreso actualizados | OK |

## Diseño y arquitectura
- Capas respetadas: `StoneDrops` puro en dominio, `STONE_STREAM` y `Mulberry32` solo en composición/infraestructura, guard:all verde.
- 1 valor de azar por baja siempre (`StoneDrops.roll` consume antes de mirar `detonated` o la probabilidad). Sin generador no consume.
- Contenido en `content/*.json` con zod; `STONE_PER_DROP = 1` es regla de la propuesta, no contenido (declarado en el design).
- `tasks.md`: sin tareas pendientes. 8 commits agrupados por capa (ADR-0018).
- Sin secretos ni código muerto detectado.

## Desviaciones declaradas
- (a) `RunSetup.gems[i].source` opcional solo en escenarios: aceptable. Es una ampliación de la superficie de test y no toca el contenido real.
- (b) `PickupLayer` recibe `stones: StoneLooks` como 4º parámetro: coherente con el design (`Looks.stones`). Aceptable.
- (c) Tipado de bench en `goldPerKill`/`stoneChance`: arregla una rotura previa de 0024, fuera del alcance pero inocuo.

## Hooks
`git config --show-origin --get-all core.hooksPath` devuelve `.git/config` (compartido del repo) -> `.husky/_`, ruta relativa.
En este worktree existen `.husky/_/` (con `husky.sh` y los ganchos) y `.husky/pre-commit` (`lint-staged` + `guard-staged.mjs`).
El pre-commit de husky sigue activo. No hay override a nivel de worktree (`--worktree` vacío).

## Hallazgos

### Critical
Ninguno.

### Warning
Ninguno.

### Suggestion
- S1: `core.hooksPath` vive en el config compartido y relativo. Funciona en cada worktree mientras exista `.husky/_`. Conviene anotar en el diario de IA que el `unset --worktree` fue necesario.
- S2: los títulos de 3 escenarios no coinciden literalmente con los de la spec. Igualarlos facilitaría la trazabilidad.

C: 0 · W: 0 · S: 2
