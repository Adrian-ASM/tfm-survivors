# Tasks · 0002-enemy-spawning

<!-- Cada tarea ≈ 30 min, TDD (rojo → verde → refactor), con su fichero de test y los escenarios de spec que cubre.
     Orden por dependencia: aleatoriedad → dominio → aplicación → infraestructura → composición → bench → E2E → docs.
     El bloque 0 toca infraestructura antes que el dominio porque todo el núcleo necesita el puerto y un generador
     real para los tests de integración; el adaptador no depende de nada más.
     Un commit por tarea (Conventional Commits + `refs: 0002-enemy-spawning` + `Assisted-by`).
     `npm run verify` en verde al cerrar cada tarea. Specs: ES = enemy-spawning, EB = enemy-behavior,
     SL = simulation-loop (delta). -->

## 0. Aleatoriedad determinista
- [x] 0.1 **Regresión antes de mover nada**: `tests/infrastructure/random.test.ts` fija los 5 primeros valores de
      `seededRandom(2026)`, `seededRandom(0)` y `seededRandom(42)` con la implementación actual de
      `tests/support/builders.ts` (verde desde el principio; es la red para el movimiento) — base de SL "Determinismo"
- [x] 0.2 Puerto `src/domain/shared/RandomGenerator.ts` (`next(): number` en [0, 1)), contrato compartido
      `tests/support/randomContract.ts` (`describeRandomGeneratorContract`: rango, finitud, reproducible con la misma
      configuración) y doble `tests/support/random.ts` (`StubRandom` con `value` fijable). Test:
      `tests/domain/random-contract.test.ts` contra `StubRandom` — base de ES "El presupuesto no se pierde al aplazar"
- [x] 0.3 `src/infrastructure/random/Mulberry32RandomGenerator.ts` (expone `seed`). Rojo: el test de 0.1 pasa a
      apuntar al adaptador y el contrato se ejecuta también contra él. Verde: mover el algoritmo. Refactor: borrar
      `seededRandom` de `builders.ts` y migrar `tests/application/loop.test.ts` — SL "Determinismo" (base)

## 1. Dominio: value objects y reglas de contenido
- [x] 1.1 `Vector2.distanceTo` y `Arena.clampX/clampY`, con `clampCircle` reescrito sobre ellos (test de
      equivalencia con los casos existentes de 0001) — `tests/domain/shared.test.ts`, `tests/domain/arena.test.ts` —
      EB "Enemigos dentro de la arena" (regla)
- [x] 1.2 `src/domain/arena/View.ts` (`width`, `height` > 0 y finitos; `halfDiagonal`) — `tests/domain/view.test.ts`
      — ES "Contenido... validado" (vista > 0); √(960² + 540²)/2 ≈ 550,727
- [x] 1.3 `src/domain/enemy/EnemyType.ts` + `EnemyCatalog.create(types, arena)`: `speed`, `radius`, `cost` > 0,
      `Arena.fits`, `id` únicos; mensajes como constantes exportadas; campo = ruta (`enemies.types.N.<campo>`) —
      `tests/domain/enemy-catalog.test.ts` — ES "Velocidad cero", "Radio que no cabe en la arena",
      "Radio en el límite exacto", "Identificador duplicado" (nivel dominio)
- [x] 1.4 `src/domain/wave/WaveTable.ts`: ≥ 1 tramo, primer `fromSecond` = 0, estrictamente crecientes,
      `budgetPerSecond` ≥ 0, ≥ 1 tipo y todos en el catálogo (mensaje con el id); `indexAt(tick)` = último tramo con
      `fromSecond ≤ tick / 60` — `tests/domain/wave-table.test.ts` — ES "Oleada con un tipo inexistente",
      "Primer tramo que no empieza en 0", "Tramos desordenados o repetidos" (nivel dominio), "Oleadas por tramos"
      (selección del tramo activo)
- [x] 1.5 `src/domain/wave/SpawnRules.ts` (`maxAlive` y `maxAttempts` enteros ≥ 1, `margin` y `minDistance` ≥ 0,
      `ringRadius` calculado) y `src/domain/run/RunConfig.ts` (interfaz movida desde `Run.ts`, re-exportada) con
      `buildRunRules(config)` que compone 1.2–1.5 — `tests/domain/run-config.test.ts` — ES "Tope de vivos no entero"
      (nivel dominio), radio del anillo ≈ 582,727 (ES "Posición de aparición fuera de la vista")

## 2. Dominio: enemigos, colocación y director
- [x] 2.1 `src/domain/enemy/Enemy.ts` (`id`, `type`, `x`/`y` mutables internos; `chase(tx, ty, dt, arena)` con
      escalares, sin sobrepasar, sin dividir por 0, recorte con `clampX/Y`) — `tests/domain/enemy.test.ts` —
      EB "Persecución horizontal durante un segundo", "Persecución en diagonal", "Llegada sin sobrepasar",
      "Dos tipos, dos velocidades", "Enemigo más grande que el jugador junto a un borde"
- [x] 2.2 `src/domain/wave/placeSpawn.ts` (anillo → `clampCircle` → `minDistance`; 1 `next()` por intento; `null` si
      se agotan los intentos) — `tests/domain/place-spawn.test.ts` (mulberry32 y `StubRandom` que cuenta llamadas) —
      ES "Arena mayor que la vista", "Arena igual a la vista", "Jugador en una esquina" (nivel función),
      "Ninguna posición válida" (≤ 8 `next()`)
- [x] 2.3 `src/domain/wave/WaveDirector.ts`, acumulación y gasto: `budget60 += budgetPerSecond`, gasto si
      `budget60 ≥ cost × 60`, tipo pendiente con 1 `next()` siempre, varios spawns por tick. Test con un `place`
      falso que siempre acepta — `tests/domain/wave-director.test.ts` — ES "Ritmo constante con coste 1",
      "El coste retrasa la aparición", "Varios spawns en un tick", "Tramo sin presupuesto"
- [x] 2.4 `WaveDirector`: tope (sin acumular ni consumir azar si `vivos ≥ maxAlive`), aplazamiento (no gasta,
      mantiene el pendiente, termina el tick, sigue acumulando) y cambio de tramo (conserva presupuesto, vuelve a
      elegir el pendiente) — mismo fichero — ES "Se alcanza el tope", "El tope se mantiene", "Tope mínimo",
      "El presupuesto no se pierde al aplazar", "Cambio de tramo" (nivel director)

## 3. Dominio: `Run` y snapshot
- [ ] 3.1 `Run.start(config, random, setup?)` con `buildRunRules` y `RunSetup` (jugador y enemigos iniciales;
      tipos validados, posiciones recortadas); builders `aRunConfig`, `aWavesConfig(overrides)` y `rawContent()` en
      `tests/support/builders.ts`; `tests/domain/run.test.ts` actualizado (`enemies: []`) — SL "Partida recién
      creada sin enemigos", "Contador de ticks"
- [ ] 3.2 `Run.tick` con orden fijo jugador → persecución → director — `tests/domain/run-enemies.test.ts` —
      EB "Persigue la posición del jugador en el mismo tick", "Primer tick de vida", "Dos enemigos idénticos se
      superponen"
- [ ] 3.3 `RunSnapshot.enemies` (`id`, `type`, `x`, `y`, `radius`; array y elementos congelados; orden de
      aparición) — `tests/domain/run.test.ts` — SL "Enemigos en el snapshot", "Identificador estable",
      "Snapshot no mutable desde fuera" (con enemigos y lista)
- [ ] 3.4 Spawning de punta a punta a través de `Run` — `tests/domain/run-spawning.test.ts` — ES "Cambio de tramo",
      "Un solo tramo", "Jugador en una esquina", "Ninguna posición válida", "El presupuesto no se pierde al aplazar"
      (con `StubRandom` y el jugador en (16, 16) vía `RunSetup`), "Valores de cada tipo llegan al dominio"
- [ ] 3.5 Determinismo con semilla — `tests/domain/determinism.test.ts` — SL "Dos partidas idénticas" (semilla 42,
      `toStrictEqual` en cada tick), "Semillas distintas"
- [ ] 3.6 Partidas largas en un solo fichero que reutiliza la simulación (36.000 ticks, semilla 7, input de
      mulberry32 con semilla fija) — `tests/domain/long-run.test.ts` — ES "Partida larga sin spawns ilegales",
      "Mezcla de tipos"; EB "Partida larga"; SL "Partida larga reproducible". Anotar la duración: si pasa de ~5 s,
      comprobar solo los snapshots de los ticks con spawn

## 4. Aplicación
- [ ] 4.1 `StartRun.execute(config, random)`; `tests/application/loop.test.ts` usa
      `new Mulberry32RandomGenerator(2026)` — SL "Tiempo independiente del refresco" (sin regresión),
      "StartRun propaga el error de contenido"

## 5. Infraestructura
- [x] 5.1 `content/enemies.json`, `content/waves.json` y `view` en `content/arena.json` (valores del design);
      `src/infrastructure/content/schemas.ts` con zod `strictObject` y rangos por campo —
      `tests/infrastructure/content.test.ts` — ES "Velocidad cero", "Tope de vivos no entero", campos desconocidos
- [x] 5.2 `parseRunConfig({player, arena, enemies, waves})` con `superRefine` → `buildRunRules`
      (`path = field.split('.')`); `loadRunConfig()` con los 4 JSON — mismo fichero — ES "Oleada con un tipo
      inexistente" (menciona `segfault`, no arranca), "Radio que no cabe en la arena", "Radio en el límite exacto",
      "Identificador duplicado", "Primer tramo que no empieza en 0", "Tramos desordenados o repetidos",
      "Contenido por defecto", "Oleadas que crecen con el contenido por defecto"
- [ ] 5.3 `src/infrastructure/url/resolveSeed.ts` (`resolveSeed(search, fallback) → {seed, warning?}`, zod, valor
      truncado a 32 caracteres) — `tests/infrastructure/seed.test.ts` — SL "Semilla válida por URL",
      "Límites del rango", "Semilla inválida" (`-1`, `4294967296`, `1.5`, `abc`, vacío: 1 `warning` con `seed`),
      "Sin semilla en la URL"
- [ ] 5.4 `src/infrastructure/phaser/enemyPalette.ts` y `EnemyLayer.ts` (pool preasignado de `CircleSprite`, solo
      `import type` de Phaser) — `tests/infrastructure/enemy-layer.test.ts` con dobles: no crea tras preasignar,
      posiciona n, oculta sobrantes, cambia radio y color solo si cambia el tipo, color por defecto si el id no
      está en la paleta
- [ ] 5.5 `GameScene` recibe `maxEnemies`; crea el `EnemyLayer` antes que el círculo del jugador y lo sincroniza
      en `update()`. Antes, comprobar en `node_modules/phaser/types` que el `Arc` de 4.2.1 tiene `setRadius`,
      `setFillStyle` y `setVisible` — sin lógica, cubierto por E2E (bloque 8)

## 6. Composición
- [ ] 6.1 `main.ts`: `resolveSeed(location.search, () => crypto.getRandomValues(new Uint32Array(1))[0])`,
      `console.warn` si hay aviso, `new Mulberry32RandomGenerator(seed)`, `StartRun.execute(config, random)`, canvas
      de `arena.view`, `maxEnemies = waves.maxAlive`, `probe.seed` con `?e2e` — cubierto por E2E (8.1, 8.2) —
      SL "Semilla de la partida" (navegador)

## 7. Benchmark
- [ ] 7.1 Script `"bench": "vitest bench --run"`, `test.benchmark.include: ['tests/bench/**/*.bench.ts']` en
      `vite.config.ts` y `tests/bench/run.bench.ts`: contenido por defecto, semilla 7, avanzar hasta exactamente
      200 vivos y medir 600 ticks consecutivos con input (1, 0) usando la fixture `bench` de Vitest 5.1.1
      (`test(…, async ({ bench }) => …)`, comprobada en `node_modules`); medir también `snapshot()`. Comprobar que
      `npm test` no lo ejecuta y que `lint` y `typecheck` sí lo cubren — SL "Tope de vivos alcanzado".
      **Plan B** si la fixture falla: `vitest.bench.config.ts` con `include: ['tests/bench/**/*.perf.ts']` y
      medición con `performance.now` (permitido en `tests/`)
- [ ] 7.2 Ejecutar `npm run bench` y anotar la media y el p99 por tick y por `snapshot()`, la máquina, el SO y la
      versión de Node para el verify-report. Si la media supera 2 ms, parar y volver a *design* (struct of arrays
      según ADR-0003)

## 8. E2E
- [ ] 8.1 `tests/e2e/enemies.spec.ts`, `?e2e&seed=42`: `probe.seed === 42`; ≥ 1 enemigo en < 3 s; todos los centros
      en [radio, 960 − radio] × [radio, 540 − radio]; sin errores ni avisos de consola — SL "Semilla válida por URL";
      criterio de éxito "enemigos en el borde"
- [ ] 8.2 `?e2e&seed=abc`: exactamente 1 `warning` que menciona `seed`, `probe.seed` entero en [0, 4294967295] y la
      partida avanza; el smoke de 0001 sigue en verde — SL "Semilla inválida" (navegador)

## 9. Cierre
- [ ] 9.1 `npm run verify` y `npm run test:e2e` en verde; revisar a mano en `npm run dev` los 3 colores y tamaños
      (pasada la fase de 180 s o con una tabla de prueba local sin commitear) y que `?seed=42` sin input se repite
- [ ] 9.2 Actualizar `docs/adr/0003-inmutabilidad-y-rendimiento.md` a *aceptada*, con las cifras de 7.2 y la
      decisión concreta (estado escalar mutable interno en `Enemy`; struct of arrays solo si el bench lo exige);
      añadir `npm run bench` a la tabla de AGENTS.md §2 (no bloquea `verify` ni el CI)
- [ ] 9.3 Entrada en `docs/ai-log/` del change: decisiones del design contrastadas con la spec (`fromSecond`, `id`
      en el snapshot, sin regla `minDistance < ringRadius`, la acumulación sigue durante el aplazamiento), API bench
      de Vitest 5 y cualquier bloqueo de hook o ESLint
