# Design · 0006-run-lifecycle-hud

## Resumen
La duración objetivo vive en un fichero nuevo, `content/run.json` (`durationSeconds`), validado con zod y convertido a
ticks por un VO de dominio, `RunDuration`. El estado de la partida pasa a ser una **fase** (`RunPhase`): una unión
discriminada con cuatro valores congelados (`running`, `choosing`, `over+won`, `over+lost`). Así la invariante
"resultado definido si y solo si `over`" la garantiza el tipo, no un test. En el tick `n === durationTicks`, si el
jugador sobrevive al contacto, la partida termina con victoria en ese mismo punto, igual que el tick de la muerte:
sin gemas, sin director y sin oferta (spec `run-outcome`). Los ticks anteriores no cambian, así que las partidas de
cualquier semilla siguen siendo idénticas hasta ese tick. El reinicio **crea otra `Run`** con un caso de uso,
`RestartRun`. La semilla nueva la da la composición. La escena cambia sus referencias y vacía sus capas: los pools
se reutilizan y no se crean objetos del motor. El HUD y el overlay de resultados van en `GameScene`. Su lógica de
formato es pura y se prueba sin motor, con el mismo patrón que `XpBar` y `xpBarFill`.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `run/RunPhase.ts`: `RunOutcome = 'won' \| 'lost'`, `RunPhase` (unión discriminada) y las constantes congeladas `RUNNING`, `CHOOSING`, `WON`, `LOST` | Nueva | `RunStatus` pasa a ser `RunPhase['status']` (mismo literal, no rompe nada). Solo existen 4 valores, así que `over` sin resultado o un resultado sin `over` no se pueden representar. Las transiciones siguen solo en `Run`. |
| domain | `run/RunDuration.ts` (VO): `create(durationSeconds)` → `Result`, `ticks`, `endsAt(n)` | Nueva | Entero ≥ 1 de segundos. `ticks = durationSeconds · TICKS_PER_SECOND`. Error `RUN_DURATION_MUST_BE_INTEGER`, que reutiliza el schema. No hay regla cruzada con `waves.segments`: un tramo posterior a la duración es inalcanzable, pero válido. |
| domain | `run/RunConfig.ts` | Mod. | `RunConfig.run: { durationSeconds }` y `RunRules.duration: RunDuration`, construido en `buildRunRules`. |
| domain | `enemy/Horde.ts` (entidad interna de `Run`): lista de vivos, `nextEnemyId`, `kills`, `chase`, `removeDead(onDeath)`, `spawn` | Nueva | Se extrae de `Run.ts` la compactación estable (ADR-0006, sin cambios) y el alta de enemigos. `removeDead` suma 1 a `kills` por cada muerto retirado: es la misma regla de "baja = soltó gema". El callback `onDeath` (soltar gema) se crea una sola vez en `Run`, nunca por tick. |
| domain | `run/Run.ts` | Mod. | Guarda `phase` en lugar de `state`. Añade el getter `outcome`. Pasa a `LOST` en `applyContact` y a `WON` justo después del contacto (ver Flujo). Usa `Horde`. Snapshot ampliado. **Reparto para bajar de 300 líneas**: `Horde` (~45 líneas fuera), `maxHealthBonus` → `upgrade/upgradeStats.ts` e `InitialState` → `RunSetup.ts`. Objetivo ≤ 270 líneas. Si en apply se pasa de 300, el montaje del snapshot se mueve a `snapshotParts.ts`. |
| domain | `run/RunSnapshot.ts` | Mod. | `RunSnapshot = RunSnapshotBody & RunPhase` (`status` + `outcome: RunOutcome \| null`). Campos nuevos (escalares): `durationTicks` y `kills`. La duración va en ticks, coherente con `tick`; la vista convierte a segundos. |
| application | `RestartRun` (caso de uso): `constructor(config, nextRandom: () => RandomGenerator, start = new StartRun())`, `execute(current: TickRun): Result<StartedRun, RestartError \| DomainError>` | Nueva | La regla "solo desde `over`" vive aquí, no en la escena. `RestartError = { code: 'not-over' }`. No consume azar de la partida actual ni la cambia. `nextRandom` es una función, no un puerto nuevo: solo tiene una implementación previsible. |
| application | `TickRun` | Mod. | Getter `status` (lectura barata, la usa `RestartRun`). El resto no cambia: con `over` ya resetea el bucle y no avanza. |
| infrastructure | `content/run.json` + `RunSchema` en `schemas.ts` | Nueva | `z.strictObject({ durationSeconds: Count(RUN_DURATION_MUST_BE_INTEGER) })`. `loadRunConfig`/`parseRunConfig` añaden la clave `run`. |
| infrastructure | `phaser/hudFormat.ts` (puro): `formatClock(s)`, `remainingSeconds(tick, durationTicks)`, `healthFill(cur, max)`, `healthLabel(cur, max)`, `killsLabel(k)` | Nueva | `remainingSeconds = max(0, ceil((durationTicks − tick) / TICKS_PER_SECOND))`: se ve `10:00` en los ticks 0 y 1, `00:01` en el 35.999 y `00:00` en el 36.000. `formatClock` da `mm:ss` con dos cifras mínimo. La vida actual se muestra con `ceil`, así que con vida > 0 nunca se ve 0. Si la spec fija otro redondeo, manda la spec. |
| infrastructure | `phaser/Hud.ts`: compone `XpBar`, la barra de vida y las etiquetas de tiempo y bajas | Nueva | `sync(snapshot)` solo llama a `setSize`/`setText` si el valor cambió (caché como `XpBar`). En régimen, el tiempo cambia una vez por segundo. Usa las costuras `BarSprite`/`LabelSprite` de `XpBar.ts`. |
| infrastructure | `phaser/resultsText.ts` (puro): `resultsView(snapshot): ResultsView \| null` | Nueva | Devuelve `null` si no es `over`. Si no, título por resultado, tiempo sobrevivido (`formatClock(floor(tick / 60))`, que en victoria da `10:00`), nivel, bajas y la pista "R: jugar otra vez". |
| infrastructure | `phaser/ResultsOverlay.ts`: velo + textos creados una vez; `sync(snapshot)` y getter `view` | Nueva | Pinta solo cuando cambia la clave (resultado + tick). `view` devuelve el `ResultsView` mostrado (o `null`) para que la escena lo pase al probe de E2E. |
| infrastructure | `phaser/RestartKey.ts`: evento `down` de `R` → `read(): boolean` (lo consume) | Nueva | Mismo patrón que `ChoiceKeys` (sin `JustDown`, por el fallo con `keyboard.press` documentado allí). |
| infrastructure | `SlotPool.clear()` y `clear()` en `EnemyLayer`, `GemLayer`, `ProjectileLayer` y `PulseLayer` | Mod. | Equivale a `sync` con un array vacío congelado compartido, sin asignar. Así un id 0 de la partida nueva no hereda el hueco (ni el color o radio) del id 0 de la anterior. |
| infrastructure | `phaser/GameScene.ts` + `phaser/sceneWidgets.ts` | Mod. / Nueva | La escena recibe `StartedRun` (mutable) y `RestartRun`. Las fábricas de objetos del motor (HUD, overlay de mejoras y overlay de resultados, con sus constantes de estilo y profundidad) pasan a `sceneWidgets.ts`, para que `GameScene` quede en ~200 líneas y solo haga input → casos de uso → render. El callback `onSnapshot` pasa a `onRender(snapshot, results)`. |
| composition | `composition/seedSource.ts`: `restartRandoms(randomSeed: () => number, onSeed: (seed) => void): () => RandomGenerator` | Nueva | Saca de `main.ts` la fábrica de `nextRandom` para poder probarla sin navegador (spec `simulation-loop`: "Semilla nueva al reiniciar" y "Reinicio tras una semilla inválida"). No lee la URL, no emite avisos y crea un `Mulberry32RandomGenerator` con la semilla sorteada. |
| composition | `main.ts` | Mod. | La primera partida usa la semilla de la URL (`resolveSeed`, como hoy). `nextRandom = restartRandoms(randomSeed, (s) => { probe.seed = s; })`; `probe.seed` deja de ser `readonly`. Con `?seed=` el reinicio **no** repite la semilla: la proposal pide una nueva en cada reinicio. El probe añade `results: ResultsView \| null`. |

**HUD en la misma escena y no en `HudScene`.** Una escena paralela obliga a comunicar escenas y a manejar un
segundo ciclo de vida, que además habría que coordinar con el reinicio. No aporta nada que no dé ya la profundidad
(`HUD_DEPTH`, `OVERLAY_DEPTH`) con `setScrollFactor(0)`. Se descarta.

**Reinicio con `Run` nueva, no con `Run.reset()` ni con `scene.restart()`.** `reset()` duplicaría la inicialización
de `Run.start` y podría dejar estado viejo, por ejemplo en el director, el arsenal o los ids. `scene.restart()`
destruye y recrea todos los objetos del motor y vuelve a registrar las teclas, con riesgo de oyentes duplicados.
Además, la escena tendría que releer sus dependencias del constructor. Ver ADR-0009.

## Flujo

**Orden del tick** (lo nuevo en negrita). Tick n = `tickCount + 1`, solo con `running`:
1. Mover al jugador, persecución, armas. Si hay muertos: `horde.removeDead(dropGem)` (gema + **baja**).
2. Contacto. Si deja la vida a 0: `tickCount = n`, **`phase = LOST`** y fin del tick (sin gemas ni director, como hoy).
3. **Si `duration.endsAt(n)`: `tickCount = n`, `phase = WON` y fin del tick.** Es la misma salida temprana que la
   muerte: sin gemas, sin XP, sin director y sin oferta (spec `run-outcome`, "Prioridades en el tick de la
   victoria").
4. Gemas y XP; director; `tickCount = n`; `openNextOffer()` (sin cambios).

En código, la condición del paso 2 se amplía a `if (this.applyContact(n) || this.reachedEnd(n))`, con una sola
salida temprana.

Consecuencias del orden:
- Muerte en el tick 36.000 ⇒ el paso 2 sale antes ⇒ `lost` (gana la derrota).
- Una gema que se recogería en el tick 36.000 queda en el suelo, sin subida ni oferta: gana la victoria.
- Las bajas del tick de la muerte o de la victoria cuentan y dejan su gema, porque ocurren en el paso 1.
- El director no actúa en el tick 36.000. Las auditorías de 36.000 ticks (`long-run`, `run-spawning`,
  `determinism-progression`) pierden como mucho los nacimientos de ese único tick. Sus aserciones no dependen de él:
  el tope de 200 se alcanza mucho antes y las demás son "≥ 1" o comparaciones entre dos partidas iguales.
- `choosing` no ejecuta ticks, así que el tiempo de partida no avanza mientras se elige. Una oferta abierta en el
  tick 119 (con duración de 120) se resuelve y el siguiente tick ejecutado da la victoria.

**Reinicio** (un frame de la escena):
1. `restartKey.read()` siempre se consume. Si vale `true`: `restartRun.execute(started.tickRun)`.
2. Con `err('not-over')` no pasa nada y el frame sigue normal.
3. Con `ok(next)`: `started = next` y `clear()` en cada capa, y el frame **sigue** con el flujo normal sobre la
   partida nueva: `next.tickRun.execute(deltaMs, input)` y `render`. Como el `FixedStepLoop` es nuevo y empieza con
   el acumulador a 0, 16,667 ms dan exactamente 1 tick y 8,334 ms no dan ninguno (spec `simulation-loop`, "Primer
   frame de la partida nueva"). No hay ráfaga: mientras la partida estaba en `over`, el bucle anterior ya reseteaba
   el acumulador en cada frame (`TickRun`, sin cambios). Los sprites viejos desaparecen en ese mismo render: tras
   `clear()`, cada capa muestra solo lo que trae el snapshot nuevo.
4. La `Run` anterior queda sin referencias (la recoge el GC). Los pools, el HUD y los overlays se reutilizan, porque
   el mismo contenido da la misma capacidad. Sus cachés se invalidan solas: el snapshot nuevo trae otros valores
   (tick 0, vida máxima, nivel 1, 0 bajas, oferta vacía, sin resultado).

**Medición de ganabilidad (tarea 0 de apply, antes de tocar `src/`).** Se puede medir con el código actual: basta
con comprobar que la partida no está en `over` en el tick 36.000.
- Política de movimiento reproducible en `tests/support/policies.ts`: `fleeInput(snapshot)`. Suma una repulsión
  `1/d²` de los enemigos a menos de 150 px y otra de las paredes a menos de 64 px, y la cuantiza a 8 direcciones con
  `PlayerInput.of`.
- Política de elección: la fija (opción 0) y, como alternativa, una prioridad documentada (`guardrail` primero).
- Contenido real (`aDefaultConfig()`) y semillas 1–10. Por semilla se anotan el tick de muerte (o 36.000), el nivel y
  las bajas, en la sección *Medición* de este design y en el diario de IA.
- **Criterio**: al menos una semilla llega viva al tick 36.000. Esa semilla y esa política quedan como regresión
  `Scenario: Partida ganable con el contenido por defecto` en `tests/domain/balance.test.ts` (36.000 ticks, en
  `verify`, ~1–3 s).
- **Si ninguna gana**: punto de control con el usuario; apply se detiene. Ajustes mínimos propuestos, en este
  orden, aplicando uno cada vez y volviendo a medir:
  1. Presupuesto del tramo de 480 s: de 7/s a 5/s.
  2. `guardrail.perLevel`: de 20 a 30.
  3. Si con eso no basta, volver al gate para revisar la duración (p. ej. 300 s).
- Tras cualquier ajuste, los plazos de `balance.test.ts` (primera oferta ≤ 3.600, primer golpe ≤ 4.800, baja ≤ 600,
  pulso ≤ 1.800) deben seguir en verde. El ajuste se registra en la proposal (Alcance, "ajuste mínimo") y en el
  diario.

## Impacto en tests y builders
- `tests/support/builders.ts`:
  - `DEFAULT_RUN = { durationSeconds: 600 }` en `aRunConfig`, con lo que `aDefaultConfig` y `rawContent` lo heredan.
  - Nuevo `withDuration(config, seconds)`.
  - `RawContent.run: { durationSeconds: number }`.
  - Los tests de victoria usan duraciones cortas (`withDuration(…, 2)` ⇒ 120 ticks). Para el empate se coloca un
    enemigo `probe` a la distancia que produce el contacto exactamente en el tick de la duración. Para "victoria +
    subida" se pone una gema de `RunSetup` que se recogería en ese tick con la XP justa.
  - Solo los escenarios de la spec que lo piden de forma explícita ejecutan 36.000 ticks (victoria exacta,
    invariante y partida ganable). Se agrupan con la simulación compartida en `beforeAll`, como en `long-run.test.ts`.
- `long-run.test.ts`, `determinism-progression.test.ts` y `run-spawning.test.ts` (36.000 ticks): con la vida
  `LONG_RUN_HEALTH`, terminan en `over`+`won` en el último tick. Ninguno comprueba `running` al final ni depende de
  los nacimientos del tick 36.000, así que no hace falta acotarlos. Se añade la aserción `outcome: 'won'` donde
  aporte. Ningún escenario actual mide más allá de 36.000 ticks *en curso*: los de "36.000 ticks más" parten de
  `over`.
- Los escenarios de 36.000 ticks de `enemy-spawning` y `enemy-behavior` (specs) siguen valiendo por la misma razón.
  El spec-writer decide si sus GIVEN mencionan la victoria.
- `run-state.test.ts`: los escenarios de congelado se duplican para `won` (y `toStrictEqual` del snapshot completo
  tras N ticks, con el contador de llamadas del azar igual).
- `tests/bench/run.bench.ts`: `benchConfig` fija `run.durationSeconds` a un valor inalcanzable (`BENCH_DURATION`).
  Así `runAtCap` + 660 ticks medidos nunca terminan en victoria y las aserciones `status === 'running'` siguen
  valiendo.
- Infra: `content.test.ts` (fichero `run` inválido: 0, negativo, decimal, campo extra), `hud-format.test.ts`,
  `hud.test.ts`, `results-text.test.ts`, `results-overlay.test.ts`, `restart-key.test.ts` y `clear()` de las capas
  (un id reaparecido tras `clear` entra con `appearing = true`).
- Application: `restart-run.test.ts` (rechaza desde `running` y `choosing` sin tocar la partida; desde `over`
  devuelve una partida en el tick 0 con el azar nuevo; llama a `nextRandom` una vez por reinicio).
- E2E:
  - `probe.ts`: `SnapshotView` añade `outcome`, `kills` y `durationTicks`; `Probe` añade `results`.
  - `health.spec.ts` no cambia.
  - `results.spec.ts` (nuevo, spec `run-results`, "Derrota y reinicio en el navegador"): `?e2e&seed=42` sin input
    y con la política de elección fija hasta `over` → `outcome 'lost'` y `results` con `Derrota`, ⌊tick/60⌋ en
    `mm:ss`, nivel y bajas → se pulsa `r` → con tick ≤ 60: `running`, `kills 0`, nivel 1, `xp 0` y `results null`,
    sin errores de consola.
  - El tick de muerte con semilla 42 se mide en el núcleo en la tarea 0 y fija el plazo (provisionalmente ≤ 120 s de
    juego), anotado en el test como en `level-up.spec.ts`. Timeout ≈ plazo + 30 s.

## Cobertura de las specs delta
| Spec | Requisito | Pieza que lo cubre |
|---|---|---|
| run-outcome | Duración validada | `RunSchema` + `RunDuration` en `buildRunRules` |
| run-outcome | Tiempo por ticks | `tickCount` (sin cambios); `choosing`/`over` no ejecutan ticks |
| run-outcome / run-state | Victoria, derrota, prioridades | Paso 3 del Flujo (salida temprana común) |
| run-outcome | Bajas | `Horde.removeDead` → `kills`; snapshot `kills` |
| run-outcome / run-state | Invariante estado/resultado | `RunPhase` (4 constantes) y `RunSnapshot = Body & RunPhase` |
| run-outcome | Ganable y perdible | Tarea 0 (medición) + regresión en `balance.test.ts` |
| run-state | Congelado en ambos resultados | `tick()` sale si `status !== 'running'` (sin cambios) |
| hud | Vida, tiempo, XP, bajas | `Hud` + `hudFormat.ts` (`remainingSeconds` con `ceil`, `healthLabel` con `ceil`) |
| run-results | Overlay y tiempo sobrevivido | `ResultsOverlay` + `resultsText.ts` (`floor`) |
| run-results | Reinicio con R | `RestartKey` + `RestartRun` (solo desde `over`) |
| run-results | Partida nueva y equivalencia | `Run.start` con `nextRandom()`; test con una fábrica de semilla fija |
| run-results | Vista limpia | `clear()` de las capas antes del primer render; test de 5 reinicios con dobles |
| run-results | Bucle en el navegador | `results.spec.ts` + `probe.results` |
| simulation-loop | Sin tiempo acumulado en `over` | `TickRun` + `FixedStepLoop` (ya cumplen; se añaden tests) y el `FixedStepLoop` nuevo de cada reinicio |
| simulation-loop | Determinismo (resultado, tick final, bajas) | Victoria y bajas sin azar; tests de determinismo ampliados |
| simulation-loop | Snapshot (duración, resultado, bajas) | `RunSnapshot` ampliado, congelado |
| simulation-loop | Semilla al reiniciar | `restartRandoms` (composición) |
| simulation-loop | Orden del tick (pasos 4–5) | Salida temprana común tras el contacto |
| player-health | Vida 0 ⇒ derrota, también en el tick final | `applyContact` → `LOST` antes de comprobar la victoria |
| leveling, auto-weapons | Solo cambios de texto | `XpBar` dentro de `Hud`; contador de bajas en el HUD |

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. zod, Phaser y Vitest ya cubren todo. | — |

## Rendimiento y seguridad
- **Presupuesto**: sin cambios (media ≤ 2 ms/tick con 200 vivos; `snapshot` ≤ 0,3 ms, informativo).
  - Por tick se añaden una comparación (`endsAt`) y un incremento por baja.
  - El snapshot gana 3 escalares (`outcome`, `durationTicks`, `kills`) y ninguna asignación nueva: la fase se
    copia por *spread* de una constante congelada.
  - Vista: se crean +11 objetos del motor una sola vez en `create()` (5 del HUD y 6 del overlay de resultados), y
    ninguno por frame ni al reiniciar. En régimen, `setText` solo se llama con cambios (tiempo 1/s; vida y bajas
    cuando cambian).
  - El reinicio asigna una `Run` nueva una vez por pulsación (camino frío).
- **Datos persistidos**: ninguno (local-first, sin guardado hasta 0007).
- **Entradas externas**: `content/run.json` se valida con zod estricto (`RunSchema`) más `RunDuration` en
  `buildRunRules` (defensa en `Run.start`). No hay parámetros de URL nuevos. La semilla del reinicio sale de
  `crypto.getRandomValues` en la composición, fuera del núcleo. El probe sigue existiendo solo con `?e2e`.

## ADRs
- `docs/adr/0009-ciclo-de-vida-y-resultado-de-partida.md`: fase como unión discriminada (estado + resultado
  ortogonal, opción B de la exploración, blindada por tipo) y reinicio por sustitución de la `Run`.

## Medición
<Se rellena en la tarea 0 de apply: semillas, política, tick final por semilla y decisión.>
