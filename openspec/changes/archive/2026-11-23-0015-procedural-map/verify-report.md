# Verify report · 0015-procedural-map

Rama `change/0015-procedural-map` (apply cerrado en 31c559c). Verificador independiente.

## Ejecución
- `npm run verify`: verde. Lint, typecheck y `guard:all` (652 ficheros) pasan. Vitest: 152 ficheros y 1719 tests en verde.
- E2E: no re-ejecutado por mí. Tomo del apply (`docs/ai-log/2026-11-23-0015-apply.md`) 129 pasan y 1 saltado (suite
  entera), y 3 fallos en la pasada `CI_LIKE` realtime ×3, todos de `throttle.spec`.
- Commits del change (0fbed57..31c559c): todos con `refs: 0015-procedural-map` y trailer de IA. `b2c43c0` (docs gdd)
  no lleva refs ni trailer (no afecta al código).

## Escenario → Test → Estado
El apply registra la tabla completa (129 escenarios, 8 specs) en `docs/ai-log/2026-11-23-0015-apply.md`, con búsqueda
literal del nombre en `tests/`. Muestreo propio (todos OK):

| Escenario (spec) | Test | Estado |
|---|---|---|
| Tasa de victoria del bot de referencia (RO) | `tests/domain/balance.test.ts` (aserta `WIN_BAND` 25..35) | OK |
| Jugador quieto pierde con todas las semillas / con mapa vacío (RO) | `balance.test.ts` | OK |
| Muerte quieta en el límite de 180 s (RO) | `balance.test.ts` | OK |
| Mapa vacío en modo E2E / Valor inválido / Ignorado fuera de E2E (PM) | `tests/infrastructure/resolve-map-mode.test.ts`, `tests/e2e/procedural-map.spec.ts` | OK |
| Sonda coherente, Sonda en el menú, Reinicio con otra semilla (PM) | `procedural-map.spec.ts`, `tests/support/map-golden.test.ts` | OK |
| Colisión, deslizamiento, puente y agua (MOV) | `tests/domain/player-collision.test.ts` | OK |
| Recolocación de gemas (GEM) | `tests/domain/run-gems-map.test.ts` | OK |
| Celdas pintadas iguales al mapa, mapa vacío (SR) | `tests/infrastructure/terrain-view.test.ts`, `sprite-rendering.spec.ts` | OK |
| Mismos spawns con y sin mapa (PM/EB) | `tests/domain/map-independence.test.ts` | OK |
| Sin semillas sueltas de balance (RO) | `tests/guardrails/balance-seeds.test.ts` | OK |

Ningún escenario sin test.

## Hallazgos

### Critical
Ninguno.

### Warning
- W1. `throttle.spec` falla en CI_LIKE (frenado medido 11,2–12,3 frente al umbral 12,5). El spec solo mide un bucle JS
  fijo con CDP y `gameUrl({manual:true})`, así que no depende del mapa. Lo más probable es que el fallo venga de la
  calibración de 0014: el change no toca `throttle.spec` ni el frenado. Sin embargo, no hay una pasada base en `main`
  que lo demuestre. Hay que registrarlo como deuda preexistente (retro o backlog). El umbral de 12,5 no se puede tocar
  dentro de 0015. 6.2 está marcada [x] con esta excepción: debe constar así en el archivo.
- W2. ADR-0013 sigue en "propuesta". La tarea 7.1 lo pasa a "aceptada" si el verify no tiene Critical. Es un paso del
  archivado, no un defecto.
- W3. Deuda aceptada por el usuario, sin acción: se retiró la cruzada "resto del mundo 0 o ≥ 2r" de la celda. El
  design §3.1 y §11 la siguen describiendo, y el apply la registra. Al archivar hay que sincronizar `design.md` y
  `openspec/specs/procedural-map` para que no la prometan. Con el contenido actual (resto 0) no aplica.
- W4. El fix de NEAREST tras `refresh()` (ce66333, `phaserArt.ts`) no tiene test automático. Un test unitario sobre
  la costura `TerrainCanvas` no vería el filtro de Phaser, y la regresión (mapa borroso) solo se vería en una captura
  visual. Hay que anotarlo como riesgo conocido, cubierto solo por el punto de control visual 2.
- W5. TDD sin rojo visto en 4.2, 5.1 y 5.2 (declarado). Es un incumplimiento de proceso, no de producto: los
  tests existen y son sustantivos. Hay que reflejarlo en la retro.

### Suggestion
- S1. `?map=empty` se comporta como pide la spec. `resolveMapMode` devuelve `emptyForced:false` sin `?e2e`, valida con
  zod `z.literal('empty')` y trunca el eco a 32 caracteres. Solo lo consume la composición (`main.ts`, `seedSource.ts`).
  El dominio solo ve `TerrainSource`. Sin hallazgo; queda constancia.
- S2. Balance: `content/player.json` tiene `speed` 210 (decisión del usuario, 29/50 victorias y 0 quietos vivos con el
  mapa generado y con el vacío). La spec run-outcome fija la banda 25..35 sin cifras de contenido, lo que es correcto.
  `balance.test.ts` aserta la banda. 29 queda 4 por encima del límite inferior. Es mejor margen que en 0013 (25).
- S3. Reglas de arquitectura: no hay `Math.random`, `Date.now` ni `performance.now` en `src/domain` ni en
  `src/application`. El mapa se lee de `content/map.json` con zod. El guardarraíl `balance-seeds` evita semillas sueltas.
  Hooks de commit y `guard:all` en verde.
- S4. Hay que añadir el recuento de `?e2e&map=empty` y de la sonda `map` en AGENTS.md §1. El apply dice haberlo hecho en
  4dc5023. Compruébalo en el archivado.

C: 0 · W: 5 · S: 4

Veredicto: se puede pasar al gate humano. Antes de archivar hay que resolver W1 (registrar como deuda de 0014), W2
(ADR a "aceptada") y W3 (sincronizar design y specs).
