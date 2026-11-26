# Verify report · 0031-combat-feedback

Verificador independiente. Rama `change/0031-combat-feedback` (64f9bff, 320cfb2, 17ed68e, a44bb0c sobre f1431b1).

## Ejecución

- `npm run verify`: lint, typecheck, guard:all (1197 ficheros) y vitest en verde (324 ficheros, 3854 tests).
- E2E `logic`: no repetido; el implementer informa de 17/17 en apply. Sin duda concreta que lo justifique.
- `git diff f1431b1..HEAD -- tests/support`: solo hay añadidos (appearance, builders, combat, feedback, inputs,
  weapons). `balanceBaseline.ts`, `mapGolden.ts` y el resto de firmas doradas no se tocaron.
- Pureza del núcleo: sin `Math.random`, `Date.now`, `performance` ni `window` nuevos en `src/domain` ni en
  `src/application`. No se añaden flujos de azar. El escenario "Otra ventana u otro tope no cambian la partida"
  y el de determinismo tienen test.
- `tasks.md`: 0 tareas sin marcar. Un commit por grupo (4 grupos, 4 commits), con `refs` y el formato esperado.

## Escenario → Test → Estado

Mapeo hecho por título de escenario contra `tests/`. Los títulos de cada escenario tienen test y no hay tests
vacíos ni tautológicos en las muestras que leí.

| Escenario (spec) | Test | Estado |
|---|---|---|
| simulation-loop: contenido de combate (4 escenarios) | tests/infrastructure/combat-content.test.ts | OK |
| simulation-loop: registro de golpes (golpe letal recortado, suma por objetivo/tick, arma+explosión, abatido, ticks distintos, ruina, oveja, armadura, un solo golpe al jugador, invulnerable, letal al jugador, curaciones) | tests/domain/run-hits.test.ts, run-hits-player.test.ts, run-structures.test.ts | OK |
| simulation-loop: orden e identificadores (3) | tests/domain/run-hits-order.test.ts, combat/hit-log.test.ts | OK |
| simulation-loop: tope por tick (5, incl. descarte determinista) | tests/domain/combat/hit-log.test.ts, run-hits-order.test.ts | OK |
| simulation-loop: golpes en el snapshot (5, incl. ventana con frame de 15 ticks) | tests/domain/run-hits-snapshot.test.ts | OK |
| simulation-loop: mismos golpes con la misma semilla / otra ventana u otro tope | tests/domain/run-hits-snapshot.test.ts | OK |
| simulation-loop: Balance y firmas intactos | Test de balance existente contra `BALANCE_BASELINE` y las firmas, sin regenerar y en verde | OK (sin test nuevo, correcto) |
| auto-weapons: destello, reserva, pulsos, proyectiles | Tests existentes, sin cambios de comportamiento | OK |
| auto-weapons: Destello y número del mismo impacto | tests/infrastructure/render-layers-feedback.test.ts | OK |
| goblin-structures: snapshot de estructuras y vida máxima | tests/domain/run-structures.test.ts | OK |
| goblin-structures: Firma de estructuras intacta | `STRUCTURE_GOLDEN` existente, sin cambios y en verde | OK |
| sprite-rendering: datos de aspecto de combate (3) | tests/infrastructure/appearance-combat.test.ts | OK |
| sprite-rendering: números de daño (12) | tests/infrastructure/damage-number-layer.test.ts, render-layers-feedback.test.ts | OK |
| sprite-rendering: barras de vida (5) | tests/infrastructure/health-bar-layer.test.ts, render-layers-feedback.test.ts | OK |
| sprite-rendering: sonda (coherencia) | tests/infrastructure/combat-feedback.test.ts, render-layers-feedback.test.ts | OK |
| sprite-rendering: Números de daño en el navegador [E2E] | tests/e2e/gameplay.spec.ts, ampliación de un test existente | OK (1 E2E, manual, sin umbrales) |
| sprite-rendering: capas, limpieza (R y menú), ovejas | render-layers-feedback.test.ts, tests de oveja | OK |

## Hallazgos

### Critical
Ninguno.

### Warning

- **W1 · design.md desactualizado (D1).** `design.md` (línea 217) describe "una búsqueda lineal de ≤ 49 registros
  del tick", pero `HitLog` usa un `Map<WeaponTarget, HitRecord>` por tick. La desviación es una mejora: es más
  simple, igual de determinista, porque el orden de registro lo da la inserción en un array, y más barata. Pero
  la spec de diseño y el código discrepan. Hay que actualizar la línea del design, o registrar la desviación en
  el diario de IA (ya figura en `docs/ai-log/2026-11-26-0031-apply.md`). El ADR-0027 no menciona la búsqueda
  lineal, así que no hace falta tocarlo. Debe resolverse en archive.
- **W2 · Tinte de los números sin test en navegador.** El color por clase se comprueba con un doble de `setTint`
  (`damage-number-layer.test.ts`). Nada prueba que Phaser pinte el tinte sobre un `Text` (el componente Tint de
  `Text` es WebGL). Es aceptable por la regla e2e-lite, y el E2E sí cubre los recuentos de la sonda. Conviene una
  comprobación visual manual o registrarlo como deuda.

### Suggestion

- **S1 · `combat.json` en el commit del grupo 1** (en vez del 2). Es coherente: el dominio necesita el contenido
  para `RunConfig.combat`, y el commit lo declara. Basta con reflejarlo en `tasks.md`.
- **S2 · `heldInputs` y `JUMP_PX`** son soportes de tests legítimos, bien documentados y sin efecto en el
  código de producción. `heldInputs` es una función pura con semilla, así que no rompe el determinismo.
- **S3 · Se añadió un `id` por defecto en `FakeTarget`** (`readonly id = 0`). Los tests antiguos no se ven
  afectados, pero los nuevos que dependan del orden por `id` deberían pasarlo explícito.

## Recuento

C: 0 · W: 2 · S: 3

## Seguimiento del orquestador (2026-11-26)
- **W1 resuelto**: `design.md` (Rendimiento, Tick) describe ahora el `Map` por tick como desviación D1 medida en apply.
- **W2 comprobado a mano** (sin test automático, como permite e2e-lite): `npx vite` en local con
  `?e2e&manual&map=empty&seed=7`; con el color `enemy` cambiado temporalmente a `#00ff00` en `appearance.json`, el
  número del golpe del tick 762 se pinta verde sobre el goblin, así que `setTint` sobre `Text` funciona en Phaser
  4.2.1. Color revertido sin commit.
