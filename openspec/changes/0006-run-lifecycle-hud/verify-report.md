# Verify report · 0006-run-lifecycle-hud

- Commit HEAD verificado: `433879ab336245cb0736c79495c25268c3ce36f3` (rama `change/0006-run-lifecycle-hud`, árbol limpio).
- Verificador: sdd-verifier (independiente del implementador).

## Resultado

**C: 0 · W: 2 · S: 4**

Sin Critical: el change puede pasar al gate de archivado, con los dos Warning resueltos o registrados.

## Ejecución

| Comando | Resultado |
|---|---|
| `npm run verify` (lint + typecheck + guard:all + vitest) | Verde: guardarraíl con 333 ficheros, 78 ficheros de test y 930 tests en verde |
| `npm run test:e2e` | Verde: 7/7 (smoke, enemies x2, weapons, level-up, health, results) |
| Tamaños | `Run.ts` 278 líneas (límite duro < 300), `GameScene.ts` 138 (objetivo ≤ 200) |
| Trailers | Los 36 commits de `origin/main..HEAD` llevan `refs: 0006-run-lifecycle-hud`, `Assisted-by` y `Co-Authored-By` |

## Puntos pedidos

| Punto | Veredicto | Evidencia |
|---|---|---|
| Invariante `over` ⇔ resultado | OK | `RunPhase` es una unión discriminada con 4 constantes congeladas (no se puede representar "over sin resultado"). `invariantHolds` en `run-outcome-long.test.ts` comprueba la doble implicación en cada snapshot de una partida completa de 36.000 ticks. |
| La derrota gana al empate en el mismo tick | OK | `Run.tick` hace `applyContact(n) \|\| reachedEnd(n)`, así que el contacto va antes que la victoria. Tests "Muerte y victoria en el mismo tick" con duración corta (tick 120) y con 36.000 ticks reales (tick 36.000): ambos esperan `lost` y vida 0. |
| El reinicio no tiene fugas | OK | `RestartRun` sustituye la `Run` (ADR-0009), solo procede desde `over`, y solo entonces llama a `nextRandom`. `GameScene.restart` hace `clear()` de las 4 capas. El test "Cinco reinicios seguidos" comprueba que en la sexta partida los sprites visibles coinciden con el snapshot. El test de equivalencia compara 600 snapshots entre reiniciada y nueva. `Hud` y `ResultsOverlay` se resincronizan por caché de cambios. |
| No se ejecutan ticks con la partida en `over` | OK | `Run.tick` sale si `status !== 'running'`. `TickRun` hace `loop.reset()` y no avanza. Test "Frames con la partida terminada": 600 frames y el tick sigue en 60. "Fin de partida a mitad de frame": 50 ms dan 1 tick y el acumulador queda a 0. Los tests "600 ticks después de ganar/terminar" cubren el congelado. |
| Todos los escenarios tienen test | OK | 133 escenarios en `specs/**`: los 133 aparecen literalmente como título de un test (ver tabla). Los ~12 que inspeccioné en profundidad prueban comportamiento real, sin tautologías. No hay `.skip`, `.only` ni `.todo`. |

## Desviaciones declaradas

| Desviación | Juicio |
|---|---|
| `RunSetup.kills` nuevo | Aceptable. Es solo para tests, con validación entera ≥ 0 (`SETUP_KILLS_MUST_BE_INTEGER`) y valor por defecto 0. No afecta a producción. |
| Validación del estado inicial en `RunSetup.initialState` | Aceptable. Sigue en dominio y devuelve `Result`. Además, esto permitió bajar `Run.ts`. |
| `Run.ts` con 278 líneas (objetivo ≤ 270) | Cumple el límite duro de 300 de la tarea 4.4 y no el objetivo del design. Ver S1. |
| `fleeInput` con arena opcional | Aceptable, está en `tests/support`, no en `src`. |
| Commits que agrupan tareas | Ver S2. |
| Tests en verde a la primera | Ver S3. |
| Rebalanceo de `waves.json` (3,5 a 2,5 en el tramo de 180 s) | Con decisión del usuario del 2026-11-20 (mensaje del commit `0281e1f`) y medición en `design.md` y en el diario. Ver W1. |

## Hallazgos

### Critical
Ninguno.

### Warning

- **W1. La ganabilidad es frágil.** Con el rebalanceo solo gana 1 de 10 semillas (semilla 2, `fleeInput` + opción 0). Con `guardrail` primero gana 0 de 10. La mediana de muerte es de unos 201 s sobre 600 s. La regresión `balance.test.ts` fija una única semilla y una única estrategia, así que cualquier cambio de contenido o de azar la rompe sin que eso signifique un fallo del juego. El escenario "Partida ganada con estrategia documentada" se cumple, pero la partida de 10 min es en la práctica muy difícil. Hay que registrarlo como deuda de balance (backlog o GDD) antes de archivar. Las variantes medidas (2 / 2,5 / 3 gana 3/10) están en el design.
- **W2. El cableado de reinicio en `GameScene` solo se prueba en navegador para la derrota.** `GameScene` (R, `restart`, `clear()` y `started` intercambiado) no tiene test unitario, porque depende de Phaser. El único camino de extremo a extremo es derrota y R en `results.spec.ts`. El reinicio tras victoria está cubierto a nivel de aplicación (`restart-run.test.ts`) y de capas (`layers-clear.test.ts`), pero no en el navegador. Es un riesgo bajo (el mismo código sirve a ambos resultados), pero debe quedar anotado.

### Suggestion

- **S1.** `Run.ts` queda en 278 líneas frente al objetivo de 270 del design. Cumple el límite duro, pero queda poco margen para los siguientes changes: conviene extraer más (por ejemplo `snapshot()`).
- **S2.** La tarea pedía un commit por tarea. Varios commits agrupan tareas: 1.2 con 3.1 (justificado en el mensaje), 2.2 con 2.3, 3.9 con 3.10 y 3.11, y 1.6 con 1.7. Anotarlo en el diario de IA como desviación de proceso.
- **S3.** Varios tests pasaron en verde a la primera, con lo que no se vio el rojo del TDD en esos casos. Las aserciones que revisé tienen valores concretos y no son tautológicas, así que no hay riesgo detectado. Un test de mutación sobre `applyContact || reachedEnd` (invertir el orden) daría confianza extra. No lo he ejecutado.
- **S4.** La comprobación de escenarios es por título literal de test. Los 133 coinciden, pero solo inspeccioné a fondo una muestra (invariante, empate, ticks tras `over`, reinicios, bucle). Si se quiere más garantía, revisar por muestreo los escenarios de `hud` y `run-results` (contenido de texto).

## Tareas

Todas las tareas de `tasks.md` (0.1 a 4.4) están marcadas `[x]` y tienen commit con `refs`. ADR-0009 pasó a aceptada, y el diario `docs/ai-log/2026-11-20-0006-apply.md` existe. No hay secretos ni `.env` en el diff. La capa de dominio no usa APIs del navegador y `content/run.json` se valida con zod estricto.

## Escenario → Test → Estado

Estado "OK" = existe un test con ese título (comprobación literal en `tests/`).

| Spec | Escenario | Ficheros de test | Estado |
|---|---|---|---|
| auto-weapons | Duración del destello | domain/enemy.test.ts | OK |
| auto-weapons | Destello renovado | domain/enemy.test.ts | OK |
| auto-weapons | Duración del pulso | domain/arsenal.test.ts, infrastructure/pulse-layer.test.ts | OK |
| auto-weapons | Pulso visible durante una mejora de radio | domain/arsenal.test.ts, domain/run-upgrades.test.ts | OK |
| auto-weapons | Sprites de proyectiles | infrastructure/projectile-layer.test.ts | OK |
| hud | HUD al empezar | infrastructure/hud.test.ts | OK |
| hud | HUD con la partida terminada | infrastructure/hud.test.ts | OK |
| hud | El HUD no altera la simulación | infrastructure/hud.test.ts | OK |
| hud | Vida llena | infrastructure/hud-format.test.ts | OK |
| hud | Vida parcial con la vida máxima mejorada | infrastructure/hud-format.test.ts | OK |
| hud | Vida 0 | infrastructure/hud-format.test.ts | OK |
| hud | Vida fraccionaria | infrastructure/hud-format.test.ts | OK |
| hud | Golpe entre dos snapshots | infrastructure/hud.test.ts | OK |
| hud | Valores en torno al inicio | infrastructure/hud-format.test.ts | OK |
| hud | Valores en torno al final | infrastructure/hud-format.test.ts | OK |
| hud | Valor intermedio | infrastructure/hud-format.test.ts | OK |
| hud | Otras duraciones | infrastructure/hud-format.test.ts | OK |
| hud | El tiempo no corre mientras se elige mejora | infrastructure/hud.test.ts | OK |
| hud | Barra de XP dentro del HUD | infrastructure/hud.test.ts | OK |
| hud | Sin bajas | domain/long-run.test.ts, infrastructure/hud-format.test.ts, infrastructure/hud.test.ts | OK |
| hud | Bajas que cambian entre snapshots | infrastructure/hud.test.ts | OK |
| hud | Muchas bajas | infrastructure/hud-format.test.ts | OK |
| leveling | Barra vacía al empezar | infrastructure/xp-bar.test.ts | OK |
| leveling | Relleno parcial | infrastructure/xp-bar.test.ts | OK |
| leveling | Tras subir de nivel | infrastructure/xp-bar.test.ts | OK |
| player-health | Daño exactamente igual a la vida restante | domain/health.test.ts, domain/run-outcome.test.ts | OK |
| player-health | Daño mayor que la vida restante | domain/health.test.ts, domain/run-outcome.test.ts | OK |
| player-health | Vida que no llega a 0 | domain/health.test.ts, domain/run-outcome.test.ts | OK |
| player-health | Vida 1 en el tick de la victoria | domain/run-outcome.test.ts | OK |
| run-outcome | Contenido por defecto | application/choose-upgrade.test.ts, application/restart-run.test.ts, bench/run.bench.ts, domain/enemy-catalog.test.ts, domain/run-choosing.test.ts, domain/run-config.test.ts, domain/run-duration.test.ts, domain/run-offer.test.ts, infrastructure/content.test.ts, infrastructure/progression-content.test.ts, infrastructure/weapons-content.test.ts, support/builders.ts | OK |
| run-outcome | Duración mínima válida | domain/run-duration.test.ts, infrastructure/content.test.ts | OK |
| run-outcome | Duración cero o negativa | domain/run-duration.test.ts, infrastructure/content.test.ts | OK |
| run-outcome | Duración no entera o ausente | domain/run-duration.test.ts, infrastructure/content.test.ts | OK |
| run-outcome | La elección de mejora no consume tiempo de partida | domain/run-outcome.test.ts | OK |
| run-outcome | Victoria exacta en el tick 36.000 | domain/run-outcome-long.test.ts | OK |
| run-outcome | Victoria con duración corta | domain/run-outcome.test.ts | OK |
| run-outcome | Ticks pedidos tras la victoria | domain/run-outcome.test.ts | OK |
| run-outcome | Derrota temprana | domain/run-outcome.test.ts | OK |
| run-outcome | La derrota no se convierte en victoria | domain/run-outcome.test.ts | OK |
| run-outcome | Derrota en el tick anterior a la victoria | domain/run-outcome.test.ts | OK |
| run-outcome | Muerte y victoria en el mismo tick | domain/run-outcome.test.ts | OK |
| run-outcome | Victoria y subida de nivel en el mismo tick | domain/run-outcome.test.ts | OK |
| run-outcome | Sin spawns en el tick de la victoria | domain/run-outcome.test.ts | OK |
| run-outcome | Una baja en el tick de la victoria cuenta y deja su gema | domain/run-outcome.test.ts | OK |
| run-outcome | Partida recién creada | domain/run-outcome.test.ts, domain/run-progression.test.ts, domain/run-snapshot.test.ts, domain/run-state.test.ts, domain/run.test.ts | OK |
| run-outcome | Varias bajas en un tick | domain/run-outcome.test.ts | OK |
| run-outcome | Una baja cuenta una sola vez | domain/horde.test.ts, domain/run-outcome.test.ts | OK |
| run-outcome | El contacto no cuenta como baja | domain/run-outcome.test.ts | OK |
| run-outcome | Las bajas sobreviven a la subida de nivel | domain/run-outcome.test.ts | OK |
| run-outcome | Baja en el tick de la muerte | domain/run-outcome.test.ts | OK |
| run-outcome | Invariante durante una partida completa | domain/run-outcome-long.test.ts | OK |
| run-outcome | Sin resultado mientras se elige mejora | domain/run-outcome.test.ts | OK |
| run-outcome | Partida ganada con estrategia documentada | domain/balance.test.ts, domain/policies.test.ts | OK |
| run-outcome | Jugador quieto pierde | domain/run-outcome-long.test.ts | OK |
| run-results | Overlay tras una derrota | infrastructure/results-text.test.ts | OK |
| run-results | Overlay tras una victoria | infrastructure/results-text.test.ts | OK |
| run-results | Sin overlay durante la partida | infrastructure/results-overlay.test.ts | OK |
| run-results | Aparece en el mismo frame en que termina la partida | infrastructure/results-overlay.test.ts | OK |
| run-results | Valores de borde | infrastructure/results-text.test.ts | OK |
| run-results | Más de una hora | infrastructure/results-text.test.ts | OK |
| run-results | Reinicio tras una derrota | infrastructure/results-overlay.test.ts | OK |
| run-results | Reinicio tras una victoria | infrastructure/results-overlay.test.ts | OK |
| run-results | R durante la partida | application/restart-run.test.ts | OK |
| run-results | R mientras se elige mejora | application/restart-run.test.ts | OK |
| run-results | Una pulsación, una partida nueva | infrastructure/restart-key.test.ts | OK |
| run-results | Teclas sin efecto con la partida terminada | infrastructure/results-overlay.test.ts | OK |
| run-results | Estado inicial tras reiniciar una partida avanzada | application/restart-run.test.ts | OK |
| run-results | La partida nueva juega con normalidad | application/restart-run.test.ts | OK |
| run-results | Equivalente a una partida recién creada | application/restart-run.test.ts | OK |
| run-results | Primer frame tras reiniciar | infrastructure/layers-clear.test.ts | OK |
| run-results | Cinco reinicios seguidos | infrastructure/layers-clear.test.ts | OK |
| run-results | Derrota y reinicio en el navegador | e2e/results.spec.ts | OK |
| run-state | Partida recién creada | domain/run-outcome.test.ts, domain/run-progression.test.ts, domain/run-snapshot.test.ts, domain/run-state.test.ts, domain/run.test.ts | OK |
| run-state | Partida con vida restante | domain/run-state.test.ts | OK |
| run-state | Eligiendo mejora y vuelta a en curso | domain/run-outcome.test.ts | OK |
| run-state | Sin pasar por eligiendo si no hay mejoras disponibles | domain/run-offer.test.ts | OK |
| run-state | Terminada por victoria | domain/run-outcome.test.ts | OK |
| run-state | Terminada por derrota | domain/run-outcome.test.ts | OK |
| run-state | Oferta abierta justo antes del tick de la victoria | domain/run-outcome.test.ts | OK |
| run-state | Golpe que deja la vida en 0 | domain/run-state.test.ts | OK |
| run-state | Varios contactos en el tick de la muerte | domain/run-state.test.ts | OK |
| run-state | Sin spawns en el tick de la muerte | domain/run-state.test.ts | OK |
| run-state | Muerte y subida de nivel en el mismo tick | domain/run-gems.test.ts | OK |
| run-state | Una baja en el tick de la muerte deja su gema | domain/run-gems.test.ts, domain/run-outcome.test.ts | OK |
| run-state | Muerte en el tick de la duración objetivo | domain/run-outcome.test.ts | OK |
| run-state | 600 ticks después de terminar | application/loop.test.ts, domain/run-state.test.ts | OK |
| run-state | 600 ticks después de ganar | domain/run-state.test.ts | OK |
| run-state | Armas congeladas al terminar | domain/run-state.test.ts | OK |
| run-state | Gemas congeladas al terminar | domain/run-gems.test.ts | OK |
| run-state | La terminación no consume azar | domain/run-state.test.ts | OK |
| run-state | Una partida terminada no vuelve a en curso | domain/run-state.test.ts | OK |
| simulation-loop | Frames con la partida terminada | application/loop.test.ts | OK |
| simulation-loop | Fin de partida a mitad de frame | application/loop.test.ts | OK |
| simulation-loop | Primer frame de la partida nueva | application/restart-run.test.ts | OK |
| simulation-loop | Dos partidas idénticas | application/loop.test.ts, domain/determinism-progression.test.ts, domain/determinism.test.ts | OK |
| simulation-loop | Semillas distintas | domain/determinism.test.ts | OK |
| simulation-loop | Partida con contactos reproducible | domain/determinism-progression.test.ts | OK |
| simulation-loop | Partida con armas reproducible | domain/determinism-progression.test.ts, domain/determinism.test.ts | OK |
| simulation-loop | Partida con progresión reproducible | domain/balance.test.ts, domain/determinism-progression.test.ts | OK |
| simulation-loop | Elecciones distintas divergen | domain/determinism-progression.test.ts | OK |
| simulation-loop | Partida larga reproducible | domain/determinism-progression.test.ts, domain/long-run.test.ts | OK |
| simulation-loop | Resultado reproducible | domain/run-outcome-long.test.ts | OK |
| simulation-loop | Victoria reproducible | domain/run-outcome-long.test.ts | OK |
| simulation-loop | Snapshot no mutable desde fuera | domain/run-snapshot.test.ts, domain/run-weapons.test.ts, domain/run.test.ts | OK |
| simulation-loop | Contador de ticks | domain/run.test.ts | OK |
| simulation-loop | Partida recién creada | domain/run-outcome.test.ts, domain/run-progression.test.ts, domain/run-snapshot.test.ts, domain/run-state.test.ts, domain/run.test.ts | OK |
| simulation-loop | Duración objetivo constante | domain/run-snapshot.test.ts | OK |
| simulation-loop | Carga de las armas en el snapshot | domain/run-weapons.test.ts, domain/weapon.test.ts | OK |
| simulation-loop | Pulso identificado en el snapshot | domain/run-weapons.test.ts | OK |
| simulation-loop | Enemigos en el snapshot | domain/run.test.ts | OK |
| simulation-loop | Identificador estable | domain/run.test.ts | OK |
| simulation-loop | Bajas sin reordenar | domain/horde.test.ts, domain/run-removal.test.ts | OK |
| simulation-loop | Reposición al final de la lista | domain/run-removal.test.ts | OK |
| simulation-loop | Baja del primero y del último | domain/horde.test.ts, domain/run-removal.test.ts | OK |
| simulation-loop | Proyectiles en el snapshot | domain/arsenal.test.ts | OK |
| simulation-loop | Gemas en el snapshot | domain/gem-field.test.ts | OK |
| simulation-loop | Oferta en el snapshot | domain/run-snapshot.test.ts | OK |
| simulation-loop | Semilla válida por URL | infrastructure/seed.test.ts | OK |
| simulation-loop | Límites del rango | infrastructure/seed.test.ts | OK |
| simulation-loop | Semilla inválida | infrastructure/seed.test.ts | OK |
| simulation-loop | Sin semilla en la URL | infrastructure/seed.test.ts | OK |
| simulation-loop | Semilla nueva al reiniciar | composition/seed-source.test.ts | OK |
| simulation-loop | Reinicio tras una semilla inválida | composition/seed-source.test.ts | OK |
| simulation-loop | El contacto usa las posiciones tras moverse ambos | domain/run-contact.test.ts | OK |
| simulation-loop | Solo el movimiento del jugador no basta | domain/run-contact.test.ts | OK |
| simulation-loop | Un enemigo recién aparecido no golpea en su tick de aparición | domain/run-removal.test.ts | OK |
| simulation-loop | Un enemigo recién aparecido no es objetivo en su tick de aparición | domain/run-weapons.test.ts | OK |
| simulation-loop | Las armas apuntan tras la persecución | domain/run-weapons.test.ts | OK |
| simulation-loop | Una baja libera el hueco antes del director | domain/run-weapons.test.ts | OK |
| simulation-loop | El imán usa la posición del jugador ya movido | domain/run-gems.test.ts | OK |
| simulation-loop | El director actúa antes de abrir la oferta | domain/run-offer.test.ts | OK |
| simulation-loop | El tick de la victoria acaba tras el contacto | domain/run-outcome.test.ts | OK |
| simulation-loop | Las armas actúan en el tick de la victoria | domain/run-outcome.test.ts | OK |
