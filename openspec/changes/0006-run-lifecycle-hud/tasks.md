# Tasks · 0006-run-lifecycle-hud

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → aplicación →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea.
     TDD: primero el test en rojo, después el código mínimo y `npm run verify` en verde. -->

## 0. Medición de ganabilidad (antes de tocar `src/`)
- [x] 0.1 `tests/support/policies.ts`: crear `fleeInput(snapshot)`, una política de movimiento pura y reproducible.
  Suma una repulsión `1/d²` de los enemigos a menos de 150 px y otra de las paredes a menos de 64 px, y la cuantiza a
  8 direcciones con `PlayerInput.of`. Con vector nulo devuelve `PlayerInput.NONE`. Test unitario con 3 casos (enemigo
  a la derecha ⇒ huye a la izquierda, pared y sin enemigos). Escenario: run-outcome "Partida ganada con estrategia
  documentada" (preparación).
- [x] 0.2 Medición con el código actual y el contenido por defecto (`aDefaultConfig()`), semillas 1–10:
  - Estrategias: `fleeInput` + política de elección fija (opción 0) y, como alternativa, `fleeInput` + prioridad
    `guardrail`.
  - Por semilla se anota el tick en que termina (o 36.000 si sigue viva), el nivel y las bajas (contadas por ids
    desaparecidos, porque aún no existe el contador).
  - Se mide también el tick de muerte con `?seed=42` (semilla 42, input (0, 0), elección fija), que fija el plazo del
    E2E de derrota.
  - Script de medición en un test `it.skip` o en el scratchpad (no se versiona). Los resultados van a la sección
    *Medición* de `design.md` y a `docs/ai-log/`.

  **Criterio de parada**:
  - Si ninguna semilla con ninguna estrategia llega viva al tick 36.000, **se detiene apply** y se consulta al
    usuario con los datos. Ajustes propuestos, en orden y midiendo de nuevo tras cada uno:
    1. Presupuesto del tramo de 480 s (`waves.json`): de 7/s a 5/s.
    2. `guardrail.perLevel`: de 20 a 30.
    3. Volver al gate para revisar la duración.

    Ningún ajuste se aplica sin el OK del usuario. Tras cualquier ajuste, `balance.test.ts` debe seguir en verde.
  - Si la muerte con semilla 42 supera 120 s de juego (7.200 ticks), también se consulta: hay que cambiar de semilla
    o de plazo del E2E.

  Escenarios: run-outcome "Partida ganada con estrategia documentada", run-results "Derrota y reinicio en el
  navegador".

## 1. Dominio
- [x] 1.1 `run/RunDuration.ts` (VO): `create(seconds)` → `Result`, `ticks` y `endsAt(n)`, con el error
  `RUN_DURATION_MUST_BE_INTEGER`. Test: 600 ⇒ 36.000; 1 ⇒ 60; 0, −60 y 600,5 ⇒ error que menciona `durationSeconds`.
  Escenarios: run-outcome "Duración mínima válida", "Duración cero o negativa" y "Duración no entera o ausente"
  (parte de dominio).
- [x] 1.2 `RunConfig.run` + `RunRules.duration` en `buildRunRules`. En `tests/support/builders.ts`: `DEFAULT_RUN`
  en `aRunConfig`, `withDuration(config, s)` y `RawContent.run`. Test: `buildRunRules` rechaza una duración
  inválida y expone `duration.ticks`. Escenario: run-outcome "Contenido por defecto" (dominio).
- [x] 1.3 `run/RunPhase.ts`: `RunOutcome`, la unión `RunPhase` y las constantes congeladas `RUNNING`, `CHOOSING`,
  `WON` y `LOST`. `RunStatus = RunPhase['status']`. Test: las 4 constantes están congeladas y cumplen la invariante,
  más un test de tipos (`expectTypeOf`): `over` ⇒ `outcome` no nulo. Escenario: run-outcome "Invariante entre estado
  y resultado" (modelo).
- [x] 1.4 `enemy/Horde.ts`: extraer de `Run.ts` la lista de vivos, `nextEnemyId`, `chase`, `spawn` y
  `removeDead(onDeath)` (compactación ADR-0006 sin cambios), con `kills`. Tests propios: orden estable, ids nunca
  reutilizados y 1 baja por muerto. Toda la batería actual sigue verde: la refactorización no cambia el
  comportamiento. Escenarios: simulation-loop "Bajas sin reordenar" y "Baja del primero y del último", run-outcome
  "Una baja cuenta una sola vez".
- [x] 1.5 Bajar `Run.ts` de 300 líneas: `maxHealthBonus` → `upgrade/upgradeStats.ts` e `InitialState` →
  `RunSetup.ts`; `Run` usa `Horde`. Sin tests nuevos: la batería actual en verde es el test. Verificar con `wc -l`
  ≤ 270.
- [x] 1.6 `Run` guarda `phase` (constantes de `RunPhase`); getter `outcome`; `applyContact` pasa a `LOST`. Test:
  derrota con resultado `lost` y la invariante en partida. Escenarios: player-health "Daño exactamente igual a la
  vida restante", "Daño mayor que la vida restante" y "Vida que no llega a 0"; run-state "Terminada por derrota" y
  "Partida recién creada".
- [x] 1.7 Snapshot ampliado: `RunSnapshot = Body & RunPhase` con `outcome`, `durationTicks` y `kills`, congelado.
  Test: valores iniciales y duración constante. Escenarios: simulation-loop "Partida recién creada" y "Duración
  objetivo constante"; run-outcome "Partida recién creada" (bajas 0).
- [x] 1.8 Test de inmutabilidad ampliado: mutar `outcome`, `kills` y `durationTicks` del snapshot no afecta al
  estado interno. Escenario: simulation-loop "Snapshot no mutable desde fuera".
- [x] 1.9 Contador de bajas en el snapshot. Tests: "Varias bajas en un tick", "El contacto no cuenta como baja",
  "Las bajas sobreviven a la subida de nivel" y "Baja en el tick de la muerte" (run-outcome), y "Una baja en el tick
  de la muerte deja su gema" (run-state).
- [x] 1.10 Victoria: salida temprana común tras el contacto
  (`if (this.applyContact(n) || this.reachedEnd(n))`). Tests con `withDuration(…, 2)`. Escenarios:
  - run-outcome: "Victoria con duración corta" y "Ticks pedidos tras la victoria".
  - run-state: "Terminada por victoria".
  - player-health: "Vida 1 en el tick de la victoria".
- [x] 1.11 Prioridades en el tick de la victoria. Escenarios:
  - run-outcome: "Muerte y victoria en el mismo tick" (con duración corta, colocando el contacto en el tick final),
    "Victoria y subida de nivel en el mismo tick", "Sin spawns en el tick de la victoria" y "Una baja en el tick de
    la victoria cuenta y deja su gema".
  - run-state: "Muerte en el tick de la duración objetivo".
  - simulation-loop: "El tick de la victoria acaba tras el contacto" y "Las armas actúan en el tick de la victoria".
- [x] 1.12 Tiempo por ticks y ofertas. Escenarios: run-outcome "La elección de mejora no consume tiempo de
  partida" y "Sin resultado mientras se elige mejora"; run-state "Oferta abierta justo antes del tick de la
  victoria" y "Eligiendo mejora y vuelta a en curso".
- [x] 1.13 Derrota frente a la duración. Escenarios: run-outcome "Derrota temprana", "La derrota no se convierte en
  victoria" y "Derrota en el tick anterior a la victoria". Con duración corta y el golpe en el tick final − 1 se
  evitan 36.000 ticks, salvo que la spec lo exija literalmente; si es así, se reutiliza la simulación de 1.15.
- [x] 1.14 Congelado en ambos resultados (`run-state.test.ts`). Escenarios: run-state "600 ticks después de
  terminar", "600 ticks después de ganar" (duración corta con ≥ 1 enemigo, proyectil y gema), "La terminación no
  consume azar" (pares de victoria y de derrota), "Una partida terminada no vuelve a en curso", "Armas congeladas al
  terminar" (con bajas) y "Gemas congeladas al terminar".
- [x] 1.15 Escenarios largos (36.000 ticks) en un `describe` con la simulación compartida en `beforeAll`:
  - run-outcome "Victoria exacta en el tick 36.000" (vida `LONG_RUN_HEALTH`, semilla 7).
  - simulation-loop "Victoria reproducible".
  - run-outcome "Invariante durante una partida completa" (semilla 42, quieto).
  - simulation-loop "Resultado reproducible".
  - run-outcome "Jugador quieto pierde".
- [x] 1.16 Revisar los tests de 36.000 ticks existentes (`long-run`, `determinism-progression`, `run-spawning`,
  `run-state`): siguen verdes. Se añade `outcome: 'won'` donde la vida es `LONG_RUN_HEALTH` y se amplía la
  comparación de "Partida larga reproducible" con resultado, tick final y bajas. Escenario: simulation-loop "Partida
  larga reproducible".
- [x] 1.17 Determinismo ampliado (`determinism*.test.ts`): resultado y bajas en "Dos partidas idénticas", "Partida
  con contactos reproducible" (≤ 4.800, revalidar el plazo) y "Partida con armas reproducible". Escenarios:
  simulation-loop, los tres citados.
- [x] 1.18 Regresión de ganabilidad en `balance.test.ts`, con la semilla y la estrategia de la tarea 0.2: victoria
  en el tick 36.000. Escenario: run-outcome "Partida ganada con estrategia documentada".

## 2. Aplicación
- [x] 2.1 `TickRun.status` (getter) y tests de bucle con `over`. Escenarios: simulation-loop "Frames con la partida
  terminada" y "Fin de partida a mitad de frame" (con victoria a mitad de frame).
- [x] 2.2 `RestartRun`: `execute(current)` devuelve `err('not-over')` desde `running` y desde `choosing`, sin tocar
  la partida ni llamar a `nextRandom`. Escenarios: run-results "R durante la partida" y "R mientras se elige mejora"
  (regla).
- [x] 2.3 `RestartRun` desde `over` (derrota y victoria): `StartedRun` nuevo en el tick 0, con `nextRandom` llamado
  una vez. Escenarios: run-results "Estado inicial tras reiniciar una partida avanzada" (con `RunSetup` para no
  simular 20.000 ticks: nivel, gemas, enemigos y `guardrail` 2) y "La partida nueva juega con normalidad".
- [x] 2.4 Equivalencia: una partida reiniciada con semilla S frente a `StartRun` con S, durante 600 ticks con la
  política fija, dan snapshots iguales en cada tick. Además, el primer `execute` de la partida nueva con 16,667 ms da
  1 tick y con 8,334 ms da 0. Escenarios: run-results "Equivalente a una partida recién creada"; simulation-loop
  "Primer frame de la partida nueva".

## 3. Infraestructura y composición
- [x] 3.1 `content/run.json` (`{ "durationSeconds": 600 }`), `RunSchema` estricto y la clave `run` en
  `loadRunConfig`/`parseRunConfig`. Tests en `content.test.ts`: por defecto ⇒ 36.000 ticks; 1 ⇒ 60; 0, −60, 600,5,
  `"600"`, ausente y campo extra ⇒ error con `durationSeconds`. Escenarios: run-outcome "Contenido por defecto",
  "Duración mínima válida", "Duración cero o negativa" y "Duración no entera o ausente".
- [x] 3.2 `tests/bench/run.bench.ts`: `benchConfig` con `BENCH_DURATION` inalcanzable. Se ejecuta `npm run bench`
  una vez para confirmar que sigue `running` y que la media es ≤ 2 ms (informativo, no bloquea).
- [ ] 3.3 `phaser/hudFormat.ts` (puro): `formatClock`, `remainingSeconds`, `healthFill`, `healthLabel` y
  `killsLabel`. Escenarios de hud: "Valores en torno al inicio", "Valores en torno al final", "Valor intermedio",
  "Otras duraciones", "Vida llena", "Vida parcial con la vida máxima mejorada", "Vida 0", "Vida fraccionaria" y
  "Muchas bajas".
- [ ] 3.4 `phaser/Hud.ts` con dobles (`BarSprite`/`LabelSprite`): compone `XpBar` y solo llama a
  `setSize`/`setText` con cambios. Escenarios de hud: "HUD al empezar", "HUD con la partida terminada", "Golpe entre
  dos snapshots", "Bajas que cambian entre snapshots", "Sin bajas", "Barra de XP dentro del HUD" y "El tiempo no
  corre mientras se elige mejora". Escenarios de leveling: "Barra vacía al empezar", "Relleno parcial" y "Tras subir
  de nivel" (siguen verdes).
- [ ] 3.5 `phaser/resultsText.ts` (puro): `resultsView(snapshot)`. Escenarios de run-results: "Valores de borde",
  "Más de una hora", "Overlay tras una derrota" y "Overlay tras una victoria" (contenido).
- [ ] 3.6 `phaser/ResultsOverlay.ts` con dobles: visible si y solo si `over`, getter `view` y pintado solo cuando
  cambia la clave. Escenarios de run-results: "Sin overlay durante la partida" y "Aparece en el mismo frame en que
  termina la partida".
- [ ] 3.7 `phaser/RestartKey.ts`: evento `down` de R → `read()` lo consume; una pulsación mantenida da un solo
  `true`. Test con un doble de teclado como en `choice-keys.test.ts`. Escenario: run-results "Una pulsación, una
  partida nueva" (adaptador).
- [ ] 3.8 `clear()` en `SlotPool`, `EnemyLayer`, `GemLayer`, `ProjectileLayer` y `PulseLayer` (sin asignar). Test:
  tras `clear()` no queda ningún sprite visible, y un id reaparecido entra con `appearing = true`. Test de 5 ciclos
  de "llenar y limpiar" en el que los sprites visibles coinciden con el snapshot. Escenarios de run-results: "Primer
  frame tras reiniciar" y "Cinco reinicios seguidos" (capas).
- [ ] 3.9 `phaser/sceneWidgets.ts`: mover las fábricas de objetos del motor (barra de XP, overlay de mejoras) y
  añadir las del HUD y el overlay de resultados, con las constantes de estilo y profundidad. Sin lógica: lo cubre
  `npm run verify` y el E2E de humo (`smoke.spec.ts`) sigue verde.
- [ ] 3.10 `GameScene`: recibe `StartedRun` + `RestartRun` y usa `Hud` y `ResultsOverlay`. En `update` lee R
  (siempre la consume); si el reinicio va bien, cambia `started`, llama a `clear()` en las capas y sigue el frame
  con la partida nueva. El callback pasa a `onRender(snapshot, results)`. Objetivo: ≤ 200 líneas. Lo cubren
  `verify` y los E2E (3.11 y 4.x).
- [ ] 3.11 `composition/seedSource.ts`: `restartRandoms(randomSeed, onSeed)`. Test con una fuente falsa que da 123:
  el generador tiene la semilla 123 (misma secuencia que `Mulberry32RandomGenerator(123)`), se llama a `onSeed(123)`
  y no hay avisos de consola. En `main.ts`: `RestartRun` con `restartRandoms`, `probe.seed` mutable y
  `probe.results`. Escenarios de simulation-loop: "Semilla nueva al reiniciar" y "Reinicio tras una semilla
  inválida".

## 4. E2E y documentación
- [ ] 4.1 `tests/e2e/probe.ts`: `SnapshotView` con `outcome`, `kills` y `durationTicks`; `Probe` con `results`. Los
  E2E actuales (`health`, `level-up`, `weapons`, `enemies` y `smoke`) siguen verdes con `npm run test:e2e`.
- [ ] 4.2 `tests/e2e/results.spec.ts`: `?e2e&seed=42`, sin input y con la política fija hasta `over` (dentro del
  plazo medido en 0.2, ≤ 120 s de juego), con `outcome 'lost'` y `results` = `Derrota` / ⌊tick/60⌋ / nivel / bajas.
  Después se pulsa `r` y, con tick ≤ 60: `running`, sin resultado, `kills 0`, nivel 1, `xp 0`, `results null` y sin
  errores de consola. Escenario: run-results "Derrota y reinicio en el navegador".
- [ ] 4.3 Rellenar la sección *Medición* de `design.md` (si no se hizo en 0.2) y pasar ADR-0009 a "aceptada".
  Actualizar el estado del proyecto en `AGENTS.md` §1 si procede y añadir la entrada del diario de IA en
  `docs/ai-log/`.
- [ ] 4.4 `npm run verify` y `npm run test:e2e` en verde. Comprobar que `Run.ts` tiene menos de 300 líneas y
  `GameScene.ts` unas 200 o menos. Dejar una lista de escenarios de las specs delta sin test (debe quedar vacía)
  para el verifier.
