# Tasks · 0010-balance-pass

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → aplicación →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea. -->

Este change no toca `src/`: no hay tareas de dominio, aplicación ni composición. El trabajo está en
`tests/support/`, en el contenido (`content/waves.json` y su espejo) y en los tests. Specs:
`specs/run-outcome/spec.md` (RO) y `specs/simulation-loop/spec.md` (SL). El design está en `design.md`.
Tras cada tarea, `npm run verify 2>&1 | tail -20` en verde.

## 1. Bot de referencia y helpers (`tests/support/`)
- [x] 1.1 Elección priorizada. En `tests/support/policies.ts`, añadir `REFERENCE_UPGRADE_PRIORITY`
  (`guardrail`, `strict-rules`, `fast-ci`, `hard-asserts`, `watch-mode`) y
  `pickByPriority(offer, priority = REFERENCE_UPGRADE_PRIORITY): number`. Va por la prioridad, no por la posición
  en la oferta; si no hay ningún id, devuelve 0.
  - Tests en `tests/domain/policies.test.ts`, en rojo hasta que exista la función: los 4 escenarios con ofertas
    `OfferSnapshot` hechas a mano, y que cada id de la prioridad existe en `DEFAULT_UPGRADE_LIST` (protege de una
    errata, que haría caer en silencio en la opción 0).
  - En el mismo fichero: añadir el test "Enemigo fuera de rango" (enemigo en (630, 270), input (0, 0)) y renombrar
    los dos tests de `fleeInput` que ya existen con los nombres de los escenarios. Se esperan verdes: ya los cumple
    `fleeInput`.
  - Escenarios (RO, "Bot de referencia para el balance"): "Elige por prioridad, no por posición", "La prioridad
    más alta gana", "Ningún id priorizado en la oferta", "Oferta de una sola opción", "Huida sin amenazas", "Huida
    de un enemigo" y "Enemigo fuera de rango".
- [x] 1.2 Bucle del bot. En `tests/support/runs.ts`:
  - añadir `chooseWhileOpen(run, pick)` y reescribir `chooseFirstWhileOpen` como `chooseWhileOpen(run, () => 0)`,
    con la misma firma y sin tocar a quien la llama;
  - añadir `playReferenceBot(run, maxTicks): RunSnapshot`. En cada tick hace `chooseWhileOpen(run,
    pickByPriority)` y luego `run.tick(fleeInput(run.snapshot()))`, y para cuando `status === 'over'`.
  - Test en `tests/domain/balance.test.ts`: la semilla 7 jugada dos veces con `playReferenceBot(run, 36_000)` da el
    mismo `status`, `outcome`, `tick`, `kills` y `upgrades`. Está en rojo mientras no exista el helper.
  - Escenario: RO "Bot reproducible".
- [ ] 1.3 Conjunto de semillas e invariante "quieto pierde".
  - Crear `tests/support/balanceSeeds.ts`, solo con constantes y sin imports: `BALANCE_SEEDS` (1..50),
    `WIN_BAND = { min: 25, max: 35 }`, `STILL_LIMIT_TICKS = 180 * 60` y `STILL_DEFEAT_SEED = 42`.
  - Añadir en `runs.ts` `stillSurvivors(config, seeds, limitTicks): number[]`, que usa `play(run, limitTicks - 1)`
    con input (0, 0) y la política fija, y devuelve las semillas que no acaban `over` + `lost`.
  - Tests en `balance.test.ts`:
    - con `withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH })`, `stillSurvivors(…, [7],
      STILL_LIMIT_TICKS)` devuelve `[7]`. Está en rojo mientras no exista el helper;
    - con `aDefaultConfig()` y `BALANCE_SEEDS` devuelve `[]`;
    - `BALANCE_SEEDS` contiene `STILL_DEFEAT_SEED`.
  - Borrar el describe de `FAST_DEFEAT_SEED` (semilla 90, ≤ 4.560 ticks).
  - En `tests/infrastructure/speed-equivalence.test.ts`, el escenario de la semilla 90 pasa a la semilla 7 (input
    (0, 0), velocidades 1 y 8), con `outcome` `lost` y `tick < STILL_LIMIT_TICKS`. Se espera verde; se junta aquí
    porque usa las constantes nuevas.
  - Escenarios: RO "Jugador quieto pierde con todas las semillas", RO "Muerte quieta en el límite de 180 s" y SL
    "Derrota equivalente con otra semilla del conjunto".

## 2. Contenido y tasa de victoria
- [ ] 2.1 Tasa del bot de referencia y palanca de contenido.
  - En `balance.test.ts`, describe "Balance con el contenido por defecto (0010)". Un `beforeAll` (`timeout:
    60_000`) juega `BALANCE_SEEDS` con `playReferenceBot(run, 36_000)`. Dos `it`:
    - las 50 partidas están `over` con tick ≤ 36.000;
    - el número de `won` en el tick 36.000 está entre `WIN_BAND.min` y `WIN_BAND.max`, con el número en el mensaje
      del `expect`.

    En **rojo** con el contenido actual (medido: 17/50).
  - Después, cambiar `content/waves.json` **y** `DEFAULT_WAVES` (`tests/support/builders.ts`) a `budgetPerSecond`
    `[1, 2, 2.5, 4, 5.6]` (solo cambian los tramos de 300 y 480 s) y actualizar el comentario de `DEFAULT_WAVES`.
    Se espera 30/50. Si sale fuera de la banda, primero se revisa que `playReferenceBot` siga la secuencia de la
    medición y después se prueba el plan B, f300x75 = `[1, 2, 2.5, 3.75, 5.25]`.
  - Borrar el describe de `WIN_SEED` (semilla 2).
  - Renombrar `content.test.ts:416` con el nombre del escenario "Contenido de los tests igual al del juego". Ese test
    y "Oleadas que crecen con el contenido por defecto" deben seguir en verde.
  - Comprobar que siguen en verde sin tocarlos: "Plazos con progresión" (semillas 7 y 42), `long-run`,
    `run-outcome-long` y `determinism-progression`. El design (§5) explica por qué no se mueven: los primeros
    18.000 ticks salen idénticos.
  - Comprobar con grep que no queda `WIN_SEED` ni `FAST_DEFEAT_SEED` en `tests/domain`.
  - Anotar en `design.md`, sección "Medición": los presupuestos finales, las victorias de 50, la muerte quieta
    máxima y los ms por partida de la ejecución local.
  - Escenarios: RO "Tasa de victoria del bot de referencia", RO "Toda partida del bot termina", RO "Sin semillas
    sueltas de balance", RO "Contenido de los tests igual al del juego" y `enemy-spawning` "Oleadas que crecen con
    el contenido por defecto".

## 3. E2E
- [ ] 3.1 Derrota E2E con la semilla del conjunto.
  - En `tests/e2e/progress.spec.ts:207` y en `tests/e2e/menu-progress.spec.ts:30`, sustituir el
    `FAST_DEFEAT_SEED = 90` local por `STILL_DEFEAT_SEED`, importada de `../support/balanceSeeds`. Actualizar los
    comentarios que citan el tick 4501 y "la que antes pierde".
  - En el test de almacenamiento bloqueado, añadir `expect(ended?.tick).toBeLessThanOrEqual(STILL_LIMIT_TICKS)`.
  - No se cambian `E2E_SPEED` ni los timeouts: la 42 pierde a los 78 s de juego, unos 10 s reales.
  - Lanzar `npm run test:e2e` y anotar el tiempo de la suite.
  - Escenarios: RO "Derrota E2E con una semilla del conjunto" y SL "Derrota equivalente con otra semilla del
    conjunto" (en el navegador, con la misma lógica).

## 4. Documentación
- [ ] 4.1 Documentación.
  - `AGENTS.md` §1, estado del proyecto: una frase con el balance calibrado por el bot de referencia sobre 1..50
    (entre 25 y 35 victorias) y "quieto pierde antes de 180 s" (change 0010).
  - Entrada en `docs/ai-log/` con las mediciones y los incidentes de hooks, si los hay.
  - El GDD (criterio de 10 a 50 semillas, deudas 0006·W1 y 0007·S2) se actualiza al archivar, no aquí.
  - Sin test: se comprueba con `npm run verify`.
