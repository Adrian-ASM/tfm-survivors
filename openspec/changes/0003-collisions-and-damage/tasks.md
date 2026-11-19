# Tasks · 0003-collisions-and-damage

<!-- Cada tarea dura unos 30 min y se hace en TDD (rojo → verde → refactor), con su fichero de test y los escenarios de
     spec que cubre. Orden: dominio → aplicación → infraestructura → composición → bench → E2E → docs.
     Lección de 0002 (verify-report W2): las tareas de un mismo bloque comparten ficheros. Por eso se hace
     **un commit por bloque** con `npm run verify` en verde, Conventional Commits, `refs: 0003-collisions-and-damage`
     y `Assisted-by`.
     Specs: PH = player-health, RS = run-state, ES = enemy-spawning (delta), EB = enemy-behavior (delta),
     SL = simulation-loop (delta), PM = player-movement (delta). Design = design.md de este change. -->

## 1. Dominio: value objects y reglas de contenido
- [x] 1.1 `src/domain/shared/Health.ts`: `full(max)`, `damage(amount)` con recorte a 0, `isDepleted`, congelado.
      Test: `tests/domain/health.test.ts`. Cubre PH "Daño exactamente igual a la vida restante", "Daño mayor que la
      vida restante" y "Vida que no llega a 0" (regla).
- [x] 1.2 `EnemyType` con `damage` y `health` > 0 y finitos, más las constantes `ENEMY_DAMAGE_MUST_BE_POSITIVE` y
      `ENEMY_HEALTH_MUST_BE_POSITIVE`. `EnemyCatalog.maxCost`. Actualizar `DEFAULT_ENEMY_TYPES` en
      `tests/support/builders.ts` con los valores del design (5/10, 15/45, 8/20). Test:
      `tests/domain/enemy-catalog.test.ts`. Cubre ES "Vida cero o negativa", "Daño cero o ausente" (dominio) y
      "Contenido por defecto" (vida y daño > 0).
- [x] 1.3 `SpawnRules.maxBudget` > 0 (`MAX_BUDGET_MUST_BE_POSITIVE`). En `RunConfig`/`buildRunRules`:
      - el tipo de `waves.maxBudget`;
      - la regla cruzada `maxBudget ≥ catalog.maxCost` (`MAX_BUDGET_BELOW_MAX_COST`, campo `waves.maxBudget`).

      Builders: `DEFAULT_WAVES.maxBudget = 10` y `maxBudget` en `aWavesConfig`. Test:
      `tests/domain/run-config.test.ts`. Cubre ES "Máximo de presupuesto no positivo", "menor que el coste más caro"
      y "igual al coste más caro" (validación).
- [x] 1.4 `RunConfig.player` con `maxHealth` (> 0, `PLAYER_HEALTH_MUST_BE_POSITIVE`) e `invulnerabilityTicks`
      (entero ≥ 1, `INVULNERABILITY_TICKS_MUST_BE_INTEGER`) en `checkPlayer`. `aRunConfig` acepta `maxHealth` e
      `invulnerabilityTicks` (100 y 30 por defecto) y exporta `LONG_RUN_HEALTH = 1e9`. Test:
      `tests/domain/run-config.test.ts`. Cubre PM "Vida máxima cero o negativa" y PH "Duración cero" y "Duración
      negativa" (dominio).

## 2. Dominio: jugador, enemigo y contacto
- [ ] 2.1 `Player`: `spawn(position, rules.player)`, `health`, `invulnerableUntil` (vale 0 al empezar),
      `canBeHitAt(n)`, `hit(damage, n)`, `isInvulnerableAfter(k)` (`k < invulnerableUntil`). `move` conserva vida e
      *i-frames*. Test: `tests/domain/player.test.ts`, con las fronteras t, t + N − 1, t + N y t + N + 1. Cubre PH
      "Fin de la invulnerabilidad justo en el tick N" (regla).
- [ ] 2.2 `Enemy`: `hp` escalar, `alive`, `damage` y `takeDamage(amount): boolean`, que recorta a 0 y no hace nada
      sobre un enemigo muerto. Test: `tests/domain/enemy.test.ts`. Cubre ES "Vida inicial del tipo", "Daño mayor
      que la vida" y "Daño a un enemigo ya dado de baja" (regla).
- [ ] 2.3 `src/domain/collision/contact.ts`: `circlesOverlap` (`d² < (r₁ + r₂)²`) y `contactDamage` (el mayor
      daño, 0 si no hay contacto, bucle indexado y sin asignaciones). Test: `tests/domain/contact.test.ts`, con:
      - tangencia 26 = 16 + 10 → false;
      - distancia 25 → true;
      - d = 0;
      - [10, 25] y [25, 10] → 25;
      - lista vacía → 0.

      Cubre PH "Tangencia exacta no es contacto" y "Contactos simultáneos de daño distinto" (regla).

## 3. Dominio: director de oleadas
- [ ] 3.1 `WaveDirector.step`: `budget60 = min(budget60 + bps, maxBudget × 60)` también en el tope, y en el tope
      `return` sin sortear. En `tests/domain/wave-director.test.ts`:
      - el `harness` acepta `maxBudget`;
      - "Se alcanza el tope" y "Varios spawns en un tick" pasan a usar `maxBudget` 20;
      - "El tope se mantiene" comprueba que no se consume azar.

      Cubre ES "Ritmo constante con coste 1", "El coste retrasa la aparición", "Varios spawns en un tick", "Se
      alcanza el tope", "El tope se mantiene", "Tope mínimo" y "El presupuesto no se pierde al aplazar".
- [ ] 3.2 Tests nuevos del director con un `place` falso y `alive` controlado por el harness:
      - "El máximo acota los spawns de un tick" (630/s, máximo 5 → 5);
      - "Presupuesto en el máximo al abrirse varios huecos" (3 y después 4);
      - "Huecos sin presupuesto suficiente" (bps 0 → 3 vivos);
      - el escenario de 185 ticks de "Máximo de presupuesto igual al coste más caro".

      Cubre ES "Tope de enemigos vivos" y "Director por presupuesto" (MODIFIED).

## 4. Dominio: `Run`, estado, bajas y snapshot
- [ ] 4.1 `RunStatus` y `RunSnapshot` ampliado: `status`; `player.health`, `maxHealth` e `invulnerable`;
      `EnemySnapshot.health`. `Run.snapshot()` sigue congelado en profundidad. Ajustar los `toEqual` de
      `tests/domain/run.test.ts` (tick 0). Cubre SL "Partida recién creada", PH "Partida recién creada", RS "Partida
      recién creada" y SL "Snapshot no mutable desde fuera" (con vida, invulnerable y estado).
- [ ] 4.2 Orden del tick en `Run.tick`: `over` → return; jugador → persecución → `contactDamage` →
      `hit` si `canBeHitAt(n)` → vida 0 ⇒ `over`, sin director → director → `tickCount++`. Test nuevo
      `tests/domain/run-contact.test.ts`, con `RunSetup` y `aRunConfig({ maxHealth, invulnerabilityTicks })`.
      Cubre:
      - PH: "Solapamiento tras la persecución", "Un golpe de un enemigo", "Varios contactos en el mismo tick",
        "Contactos simultáneos de daño distinto", "Contacto continuo con un enemigo", "Fin de la invulnerabilidad
        justo en el tick N", "Contacto nuevo que llega justo al expirar", "Un enemigo más fuerte no rompe la
        invulnerabilidad", "200 enemigos encima del jugador" y "Sin contacto no hay daño";
      - SL: "El contacto usa las posiciones tras moverse ambos" y "Solo el movimiento del jugador no basta".
- [ ] 4.3 Fin de partida en `tests/domain/run-state.test.ts`. Cubre:
      - RS: "Partida con vida restante", "Golpe que deja la vida en 0", "Varios contactos en el tick de la muerte",
        "Sin spawns en el tick de la muerte", "600 ticks después de terminar", "La terminación no consume azar"
        (con un `RandomGenerator` que cuenta llamadas) y "Una partida terminada no vuelve a en curso";
      - EB: "Sin persecución con la partida terminada".
- [ ] 4.4 Bajas: `Run.damageEnemy(id, amount): 'missing' | 'ignored' | 'damaged' | 'killed'` y `removeDead()` con
      compactación estable en el sitio (`length = w`, sin `splice` ni `filter`). Lanza `RangeError` si
      `amount` ≤ 0 o no es finito. Test: `tests/domain/run-removal.test.ts`. Cubre:
      - ES: "Daño que no mata", "Daño exactamente igual a la vida", "Daño mayor que la vida", "Daño a un enemigo
        ya dado de baja" e "Identificador no reutilizado";
      - SL: "Bajas sin reordenar", "Reposición al final de la lista" y "Baja del primero y del último";
      - PH: "Un enemigo dado de baja no hace contacto".
- [ ] 4.5 Integración de bajas con el director y la persecución en `tests/domain/run-removal.test.ts`. Cubre:
      - ES: "Reposición de una baja sin superar el tope" (`maxBudget` 20, aparece 1 y no 20) y "Golpear al jugador
        no quita vida al enemigo";
      - EB: "Un enemigo dado de baja deja de perseguir", "Sigue hasta el centro tras golpear" y "El contacto no
        empuja al jugador";
      - SL "Un enemigo recién aparecido no golpea en su tick de aparición".

## 5. Dominio: partidas largas y determinismo
- [ ] 5.1 `tests/domain/long-run.test.ts`: la auditoría de spawns, arena y reproducibilidad usa
      `aRunConfig({ maxHealth: LONG_RUN_HEALTH })`, porque prueba el spawn y no el daño. Así siguen valiendo
      `births === 200` y `maxAlive === 200`. Cubre ES "Partida larga sin spawns ilegales" y EB "Partida larga".
- [ ] 5.2 Escenarios largos con la vida por defecto (mismo fichero, una sola simulación reutilizada si es posible):
      - RS "Jugador quieto con el contenido por defecto": semilla 7, input (0, 0), termina en un tick ≤ 36.000 con
        vida 0. El design estima que hacia el tick 1.000.
      - SL "Partida larga reproducible", con el contenido por defecto.
      - Comprobar que la suite no supera unos 5 s en total.
- [ ] 5.3 `tests/domain/determinism.test.ts`: "Dos partidas idénticas" compara también la vida, `invulnerable` y
      `status`. Escenario nuevo "Partida con contactos reproducible" (semilla 42, input (0, 0), 3.600 ticks, ≥ 1
      golpe). Cubre SL "Determinismo" (MODIFIED).

## 6. Aplicación
- [ ] 6.1 Sin cambios de código en `TickRun`/`FixedStepLoop`. Test en `tests/application/loop.test.ts`:
      `TickRun.execute` sobre una partida terminada devuelve el mismo snapshot sin errores, aunque el bucle pida
      15 ticks. Cubre RS "600 ticks después de terminar" (vía caso de uso).

## 7. Infraestructura
- [x] 7.1 `schemas.ts`:
      - `PlayerSchema` con `maxHealth` e `invulnerabilityTicks` (`Count`);
      - `EnemiesSchema` con `damage` y `health`;
      - `WavesSchema` con `maxBudget`, con los mensajes del dominio.

      Actualizar `content/*.json` con los valores provisionales del design y `RawContent` en los builders. Test:
      `tests/infrastructure/content.test.ts`, con un caso por campo (0, negativo, ausente), `maxBudget` 2,5 con un
      coste de 3, y `loadRunConfig()` válido. Cubre PM "Contenido válido", "Vida máxima cero o negativa", "Vida
      máxima ausente" y "Vida máxima mínima válida"; PH "Duración cero", "Duración negativa" y "Contenido por
      defecto"; ES "Contenido de enemigos y oleadas validado" (escenarios nuevos) y "Valores de cada tipo llegan al
      dominio".
- [ ] 7.2 `EnemyLayer` con asociación hueco ↔ `id`: `Map<number, Slot>`, pila `free`, marca `seen` por frame, y
      ocultar y liberar los huecos no vistos. Test: `tests/infrastructure/enemy-layer.test.ts`, con dobles:
      - los tests existentes;
      - una baja en medio que no repinta a los demás (`restyles` sin cambios);
      - el hueco liberado lo reutiliza un enemigo nuevo;
      - sin sprites creados tras `create`.

      Cubre SL "Bajas en medio de la lista", "Todos dados de baja" y "Reposición tras bajas".

## 8. Composición
- [ ] 8.1 Revisar `src/composition/main.ts` y `GameScene`: no deberían necesitar cambios, porque `maxAlive` sigue
      siendo la capacidad del pool. Verificar con `npm run dev` que la partida se congela al llegar a vida 0
      (comprobado con el probe `?e2e`). Cubre el criterio de éxito "en Pages, la partida se congela al llegar a
      vida 0".

## 9. Rendimiento
- [ ] 9.1 `tests/bench/run.bench.ts`:
      - `runAtCap()` con el contenido por defecto y `player.maxHealth = BENCH_HEALTH` (1e9). Lanza un error si
        `status` pasa a `'over'` antes de llegar a 200 vivos, en lugar de quedarse en un bucle infinito.
      - Caso nuevo: 200 `bug` en el centro del jugador vía `RunSetup`, con `BENCH_HEALTH`.
      - Los dos casos comprueban `status === 'running'` al terminar.

      Cubre SL "Tope de vivos alcanzado" y "200 enemigos encima del jugador".
- [ ] 9.2 Ejecutar `npm run bench` y anotar para el verify-report la media y el p99 por tick (los dos casos) y de
      `snapshot()`, junto con la máquina, el SO y la versión de Node. Si la media supera 2 ms, parar y volver a
      *design*.

## 10. E2E
- [ ] 10.1 `tests/e2e/enemies.spec.ts` (o `health.spec.ts`), con `?e2e&seed=42` y sin input:
      - `probe.snapshot.player.health` baja de `maxHealth` en ≤ 20 s;
      - `status` es `'running'` mientras quede vida;
      - sin errores ni avisos de consola.

      El E2E no espera a `'over'`: la congelación se prueba en unidad (4.3). Actualizar la interfaz `Probe` del
      test. Cubre PH "Daño discreto por contacto" (navegador).

## 11. Cierre y docs
- [ ] 11.1 `npm run verify` y `npm run test:e2e` en verde. Revisar a mano en `npm run dev` que, sin moverse, la
      partida se congela y que, moviéndose, se esquiva el daño.
- [ ] 11.2 ADR-0006 pasa a *aceptada* si el apply no la contradice. ADR-0003 gana una sección "Aplicación
      (change 0003)" con las cifras de 9.2. Actualizar en AGENTS.md §1 el "Estado del proyecto" si el orquestador
      lo pide.
- [ ] 11.3 Entrada en `docs/ai-log/` del change con:
      - las decisiones contrastadas con la spec: recorte antes de gastar, `EnemySnapshot.health`, *i-frames* con un
        tick absoluto, el mayor daño y la tangencia estricta;
      - el ajuste de bench y long-run por la muerte del jugador;
      - cualquier bloqueo de hook o ESLint.
