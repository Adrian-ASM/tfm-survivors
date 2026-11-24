# Verify report · 0020-enemy-behaviors

HEAD be54898 · base origin/main e9b2ccb · verificador independiente.

## Ejecución
- `npm run verify`: verde (lint, typecheck, guard:all, 192 ficheros y 2.235 tests).
- `npm run test:e2e` (proyecto `logic`): 14/14 en verde. Los E2E nuevos son 1 en `gameplay.spec.ts` (barril en mecha
  y explosión, en modo manual) más la ampliación de `probe.ts`. Cumple "máximo 1–2" y no tiene umbrales de fps ni de
  tiempo real.
- `npm run bench`: "Peor caso con peligros" 0,037–0,045 ms/tick, bajo el objetivo informativo de 0,25. El peor caso
  con proyectiles da 0,215 ms/tick.
- `tasks.md`: sin casillas abiertas.
- Arquitectura: sin `Math.random`, `Date.now` ni `performance.now` en `domain` ni `application`. La procedencia de
  `Dynamite.png` y `Explosions.png` está en `asset-provenance.json` con sha256 y ambos ficheros están versionados.
  Oleadas, `maxAlive`, anillo, `player.speed` y stats de tipos no se tocaron. Solo desaparece `damage` del barril
  (D3) y `xpGrowth` pasa de 3 a 4.

## Escenarios -> Test -> Estado
Las 11 specs delta tienen cobertura en los ficheros de test nuevos o ampliados. Revisados por muestreo, sin tests
vacíos ni tautológicos.

| Spec | Escenarios (muestra) | Test | Estado |
|---|---|---|---|
| enemy-behavior | estados, salida por distancia, espera, barril (mecha, abatido, mismo tick), TNT, determinismo | `tests/domain/enemy/Behavior.test.ts`, `run-behavior.test.ts`, `run-hazard-order.test.ts`, `tests/content/enemies.test.ts` | Cubierto |
| enemy-hazards | dinamita, aviso, radio y tangencia, fuego amigo, tope de peligros | `run-hazards.test.ts`, `HazardRules.test.ts`, `run-hazard-order.test.ts` | Cubierto |
| enemy-hazards | "Fuego amigo que mata" | `run-hazard-order.test.ts:55` | Parcial (ver W2) |
| leveling (delta) | curva 9/4, de escenario 5/5, inválidos, plana | `progression-content.test.ts`, `enemies-schema.test.ts` | Cubierto |
| player-health, xp-gems, enemy-spawning, run-state, simulation-loop | daño por explosión con invulnerabilidad, un solo golpe, gema por baja, orden del tick | `run-hazard-order.test.ts`, `determinism-hazards.test.ts`, `hazard-bench-setup.test.ts` | Cubierto |
| run-outcome | bot v3, 25–35 victorias, 0 quietos en ambos mapas, plazos | `policies-dodge.test.ts`, `balance.test.ts` | Cubierto (27/50, 0 quietos) |
| sprite-rendering, asset-provenance | capa de peligros, animaciones, avisos, sonda, procedencia | `hazard-layer.test.ts`, `enemy-layer-states.test.ts`, `appearance-hazards.test.ts`, E2E de peligros | Cubierto |

## Hallazgos

### Critical
Ninguno.

### Warning
- **W1. Design y ADR desfasados respecto al contenido final.** `design.md` §5 sigue con salida del TNT 260, daño del
  barril 20 y curva 9/3, y la cota "38 < 260 ≤ 360". El contenido final es 100, 25 y 9/4. El addendum de ADR-0019 sí
  lo recoge, pero el design no. El ADR sigue en "propuesta". Antes de archivar hay que actualizar §5 (o marcarlo como
  "valores de partida, ver addendum") y pasar el ADR a "aceptada".
- **W2. "Fuego amigo que mata" cubre solo en parte la spec.** La spec exige "exactamente 1 gema nueva, con el `xp` de
  su tipo, en la posición que tenía". El test comprueba `kills` y `progression.xp === 3`. Eso prueba que se generó y
  recogió una gema de 3 de XP, pero no su posición ni que sea una sola. La razón es que la gema nace bajo el jugador y
  se recoge en el mismo tick. Es aceptable, pero conviene cambiar el escenario para que la víctima esté lejos del
  jugador y se pueda mirar `snapshot.gems`, o ajustar la redacción de la spec.
- **W3. Debilidad de la regla de esquive del bot v3.** Con la huida en (0, 0) y la dinamita en el centro exacto, la
  suma de esquive es 0 y el bot se queda quieto. Es una carencia de la spec del bot, no un fallo de implementación:
  `dodgeInput` cumple la regla escrita. Un jugador humano no está afectado. Pero esa carencia se resolvió moviendo el
  contenido: el TNT lanza desde 100 px, casi a contacto (la dinamita tiene radio 56, el radio del jugador es 16 y el
  barril activa a 40), y no desde 260. Eso recorta el carácter a distancia del TNT que pedía la propuesta.
  Recomiendo registrar la deuda (backlog o nota en el ADR) para revisar la regla del bot, por ejemplo con un
  desempate fijo cuando la suma es nula, en vez de dejarla solo en el addendum.
- **W4. Calibración fuera del §5, sin gate humano propio.** Se aplicó la segunda palanca (curva 9/4) con una spec
  delta nueva, `leveling`. La delta es coherente con la propuesta y con el design ("solo si no basta, la curva de
  XP"). Comprobado: solo cambian los valores por defecto, y la curva de escenario 5/5 y la fórmula no cambian.
  `xpToNext(50)` = 205 es correcto. La tabla del addendum documenta la búsqueda. Pero la propuesta fue aprobada sin
  esa delta, así que el usuario debe aceptarla de forma explícita en el gate de verify -> archive.

### Suggestion
- **S1.** Sección 3 commiteada junto con 5.1 y 6.2 para no dejar el commit en rojo. Es razonable, pero el historial
  pierde trazabilidad por tarea. Anótalo en el diario de IA.
- **S2.** La excepción del pool de explosiones (crece hasta su máximo histórico) está declarada en el ADR. Convendría
  un test que fije que no crece de forma indefinida en 600 ticks. El bench no asigna por tick en el caso medido.
- **S3.** Gate de balance 27/50 y 0 quietos en ambos mapas (semilla 43 incluida). La firma dorada del mapa no cambió
  (`mapGolden.ts` sin diff). El margen de 2 sobre el límite inferior de 25 es estrecho, como en changes anteriores.

## Recuento
C: 0 · W: 4 · S: 3

## Resolución (orquestador, 2026-11-24, antes del PR)
- **W1** resuelto: `design.md` §5 recoge los valores finales (100 / 25 / 9/4) y el ADR-0019 pasa a "aceptada".
- **W3** registrado como **deuda** para la parte B (0020b): la regla de esquive del bot v3 se anula cuando la huida
  es (0, 0) y la dinamita cae en su centro exacto; revisar la regla (p. ej. dirección de escape por defecto) y
  recuperar una distancia de lanzamiento del TNT mayor que 100.
- **W2**, **W4** y las Suggestions quedan para el gate humano de revisión del PR (W4: aceptar la delta `leveling`).
