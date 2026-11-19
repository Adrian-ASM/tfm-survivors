# Verify report · 0003-collisions-and-damage

Verificador independiente (no ha escrito ni corregido código). Rama `change/0003-collisions-and-damage`, 10 commits sobre `a22b5e3` (`c8559ec`..`7bd7e78`). Árbol de trabajo limpio.

## Resultado de las ejecuciones

| Comando | Resultado |
|---|---|
| `npm run verify` | Verde: lint, typecheck, `guard:all` (173 ficheros) y 31 ficheros / 383 tests (4,1 s) |
| `npm run test:e2e` | Verde: 4 tests (smoke, `?seed=42`, daño por contacto, `?seed=abc`) |
| `npm run bench` | Verde. `Run.tick` con 200 vivos: media 0,0078 ms, p99 0,0121 ms (anotado: 0,0081 / 0,0132). `Run.tick` con 200 encima: media 0,0056 ms, p99 0,0078 ms (anotado: 0,0079 / 0,0105). `Run.snapshot`: media 0,0042 ms, p99 0,0047 ms (anotado: 0,0037 / 0,0040). Todo dentro del ruido y unas 250 veces por debajo del umbral de 2 ms |

### Evidencia manual del orquestador (no repetida por el verificador)
En `npm run dev` con `?e2e&seed=42` y sin input: la vida bajó 100 → 95 (tick 362) → 60 → 20 → 0, `status` pasó a `'over'` en el tick 948 y el snapshot quedó idéntico 4 s después, sin errores de consola. Coincide con el modelo (daño 5 del `bug`, 15 del `memory-leak`, 8 del `merge-conflict`, invulnerabilidad de 30 ticks) y con el escenario "Jugador quieto…". **No se probó a mano esquivar moviéndose** (ver W2).

## Escenario → Test → Estado

Rutas en `tests/`. OK = el test prueba el escenario de verdad (se han leído los cuerpos de los dudosos).

### player-health

| Escenario | Test | Estado |
|---|---|---|
| Partida recién creada | `domain/run.test.ts:16`, `domain/run-state.test.ts:14` | OK |
| Sin contacto no hay daño | `domain/run-contact.test.ts:23` | OK |
| Tangencia exacta no es contacto | `domain/contact.test.ts:16`, `domain/run-contact.test.ts:10` | OK |
| Solapamiento tras la persecución | `domain/run-contact.test.ts:17` | OK |
| Un enemigo dado de baja no hace contacto | `domain/run-removal.test.ts:67` | OK |
| Un golpe de un enemigo | `domain/run-contact.test.ts:31` | OK |
| Varios contactos en el mismo tick | `domain/run-contact.test.ts:38` | OK |
| Contactos simultáneos de daño distinto | `domain/contact.test.ts:35`, `domain/run-contact.test.ts:43` (los dos órdenes) | OK |
| Contacto continuo con un enemigo | `domain/run-contact.test.ts:63` | OK |
| Fin de la invulnerabilidad justo en el tick N | `domain/player.test.ts:114`, `domain/run-contact.test.ts:68` | OK |
| Contacto nuevo que llega justo al expirar | `domain/run-contact.test.ts:75` | OK |
| Un enemigo más fuerte no rompe la invulnerabilidad | `domain/run-contact.test.ts:87` | OK |
| 200 enemigos encima del jugador | `domain/run-contact.test.ts:98`, `bench/run.bench.ts:82` | OK |
| Daño exactamente igual a la vida restante | `domain/health.test.ts:10` | OK |
| Daño mayor que la vida restante | `domain/health.test.ts:16` | OK |
| Vida que no llega a 0 | `domain/health.test.ts:22` | OK |
| Duración cero / negativa | `domain/run-config.test.ts:131`, `infrastructure/content.test.ts:70` | OK |
| Contenido por defecto (invulnerabilidad) | `infrastructure/content.test.ts:303` | OK |

### player-movement

| Escenario | Test | Estado |
|---|---|---|
| Contenido válido | `infrastructure/content.test.ts:36` | OK |
| Velocidad negativa | `infrastructure/content.test.ts:156` | OK |
| Radio que no cabe en la arena | `infrastructure/content.test.ts:171` | OK |
| Vida máxima cero o negativa | `domain/run-config.test.ts:120`, `infrastructure/content.test.ts:46` | OK |
| Vida máxima ausente | `infrastructure/content.test.ts:56` | OK |
| Vida máxima mínima válida | `domain/run.test.ts:25`, `infrastructure/content.test.ts:61` | OK |

### run-state

| Escenario | Test | Estado |
|---|---|---|
| Partida recién creada | `domain/run-state.test.ts:14` | OK |
| Partida con vida restante | `domain/run-state.test.ts:18` | OK |
| Golpe que deja la vida en 0 | `domain/run-state.test.ts:27` | OK |
| Varios contactos en el tick de la muerte | `domain/run-state.test.ts:36` | OK |
| Sin spawns en el tick de la muerte | `domain/run-state.test.ts:46` (con partida de control en la que sí nace el del tick 60) | OK |
| 600 ticks después de terminar | `domain/run-state.test.ts:72`, `application/loop.test.ts:98` | OK |
| La terminación no consume azar | `domain/run-state.test.ts:82` (contador de `next()`) | OK |
| Una partida terminada no vuelve a en curso | `domain/run-state.test.ts:91` | OK |
| Jugador quieto con el contenido por defecto | `domain/long-run.test.ts:89` | OK |

### enemy-behavior

| Escenario | Test | Estado |
|---|---|---|
| Persecución horizontal / diagonal / llegada sin sobrepasar | `domain/enemy.test.ts:56,63,70`, `domain/run-enemies.test.ts:34` | OK |
| Persigue la posición del jugador en el mismo tick | `domain/run-enemies.test.ts:41` | OK |
| Sigue hasta el centro tras golpear | `domain/run-removal.test.ts:148` | OK |
| Un enemigo dado de baja deja de perseguir | `domain/run-removal.test.ts:130` | OK |
| Sin persecución con la partida terminada | `domain/run-state.test.ts:97` | OK |
| Dos enemigos idénticos se superponen | `domain/run-enemies.test.ts:50` | OK |
| El contacto no empuja al jugador | `domain/run-removal.test.ts:156` | OK |
| Vida inicial del tipo | `domain/enemy.test.ts:26` | OK |
| Daño que no mata | `domain/enemy.test.ts:31`, `domain/run-removal.test.ts:17` | OK |
| Daño exactamente igual a la vida / mayor que la vida | `domain/enemy.test.ts:37`, `domain/run-removal.test.ts:24` | OK |
| Daño a un enemigo ya dado de baja | `domain/enemy.test.ts:43`, `domain/run-removal.test.ts:31` | OK |
| Identificador no reutilizado | `domain/run-removal.test.ts:54` | OK |
| Golpear al jugador no quita vida al enemigo | `domain/run-removal.test.ts:120` (vida 5 tras 600 ticks) | OK |

### enemy-spawning

| Escenario | Test | Estado |
|---|---|---|
| Contenido por defecto | `domain/enemy-catalog.test.ts:107`, `infrastructure/content.test.ts:303` | OK |
| Valores de cada tipo llegan al dominio | `domain/run-spawning.test.ts:133`, `infrastructure/content.test.ts:139` | OK |
| Oleada con un tipo inexistente | `domain/wave-table.test.ts:55`, `infrastructure/content.test.ts:252` | OK |
| Velocidad cero | `domain/enemy-catalog.test.ts:48`, `infrastructure/content.test.ts:191` | OK |
| Vida cero o negativa | `domain/enemy-catalog.test.ts:89`, `infrastructure/content.test.ts:91` | OK |
| Daño cero o ausente | `domain/enemy-catalog.test.ts:98`, `infrastructure/content.test.ts:101,111` | OK |
| Radio que no cabe / en el límite exacto | `domain/enemy-catalog.test.ts:66,75`, `infrastructure/content.test.ts:260,266` | OK |
| Identificador duplicado | `domain/enemy-catalog.test.ts:79`, `infrastructure/content.test.ts:272` | OK |
| Primer tramo que no empieza en 0 | `domain/wave-table.test.ts:62`, `infrastructure/content.test.ts:278` | OK |
| Tramos desordenados o repetidos | `domain/wave-table.test.ts:71`, `infrastructure/content.test.ts:284` | OK |
| Tope de vivos no entero | `domain/run-config.test.ts:48`, `infrastructure/content.test.ts:201` | OK |
| Máximo de presupuesto no positivo | `domain/run-config.test.ts:94`, `infrastructure/content.test.ts:116` | OK |
| Máximo menor que el coste más caro | `domain/run-config.test.ts:102`, `infrastructure/content.test.ts:131` | OK |
| Máximo igual al coste más caro | `domain/run-config.test.ts:110`, `domain/wave-director.test.ts:173` (185 ticks) | OK |
| Ritmo constante con coste 1 | `domain/wave-director.test.ts:66` | OK |
| El coste retrasa la aparición | `domain/wave-director.test.ts:73` | OK |
| Varios spawns en un tick | `domain/wave-director.test.ts:82` | OK |
| El máximo acota los spawns de un tick | `domain/wave-director.test.ts:167` | OK |
| Mezcla de tipos | `domain/long-run.test.ts:108` | OK (W1 resuelto) |
| Oleadas que crecen con el contenido por defecto | `infrastructure/content.test.ts:311` | OK |
| Se alcanza el tope | `domain/wave-director.test.ts:116` | OK |
| El tope se mantiene | `domain/wave-director.test.ts:122` (sin llamadas a `next()`) | OK |
| Tope mínimo | `domain/wave-director.test.ts:132` | OK |
| Reposición de una baja sin superar el tope | `domain/run-removal.test.ts:102` (aparece 1, id 200) | OK |
| Presupuesto en el máximo al abrirse varios huecos | `domain/wave-director.test.ts:138` | OK |
| Huecos sin presupuesto suficiente | `domain/wave-director.test.ts:149` | OK |

### simulation-loop

| Escenario | Test | Estado |
|---|---|---|
| El contacto usa las posiciones tras moverse ambos | `domain/run-contact.test.ts:117` | OK |
| Solo el movimiento del jugador no basta | `domain/run-contact.test.ts:124` | OK |
| Un enemigo recién aparecido no golpea en su tick de aparición | `domain/run-removal.test.ts:171` | OK |
| Bajas en medio de la lista | `infrastructure/enemy-layer.test.ts:124` | OK |
| Todos dados de baja | `infrastructure/enemy-layer.test.ts:136` | OK |
| Reposición tras bajas | `infrastructure/enemy-layer.test.ts:143` (150 + 50 en el mismo frame) | OK |
| Dos partidas idénticas | `domain/determinism.test.ts:26`, `application/loop.test.ts:61` | OK |
| Semillas distintas | `domain/determinism.test.ts:45` | OK |
| Partida con contactos reproducible | `domain/determinism.test.ts:37` | OK |
| Partida larga reproducible | `domain/long-run.test.ts:103` | OK |
| Snapshot no mutable desde fuera | `domain/run.test.ts:99` (incluye health, invulnerable, status) | OK |
| Contador de ticks / Partida recién creada / Enemigos en el snapshot / Identificador estable | `domain/run.test.ts:35,16,78,88` | OK |
| Bajas sin reordenar / Reposición al final / Baja del primero y del último | `domain/run-removal.test.ts:75,82,93` | OK |
| Tope de vivos alcanzado | `bench/run.bench.ts:69` (falla si `over` antes del tope) | OK |
| 200 enemigos encima del jugador | `bench/run.bench.ts:82`, `domain/run-contact.test.ts:98` | OK |

No hay escenarios sin test. Los tests no son tautológicos: comprueban valores concretos y fronteras, y los de bajas, contacto y fin de partida llevan partida de control o contador de azar. Las pruebas de mutación manuales del implementador (diario, punto 8) cubren los tests que salieron en verde a la primera.

## Contraste con reglas de AGENTS.md y con el design

- **Capas y pureza (§3.1-3.4)**: `guard:all` y ESLint en verde. `grep` de `Math.random|Date.now|performance.now|window|document|localStorage` en `src/domain` y `src/application`: sin resultados. `Player`, `Run`, `contact.ts` y `Health.ts` no importan nada de fuera del dominio. `EnemyLayer` solo importa tipos del dominio.
- **Contenido y zod (§3.5-3.6)**: `damage`, `health`, `maxHealth`, `invulnerabilityTicks` y `maxBudget` están en `content/*.json` y en `schemas.ts` con los mensajes del dominio; las reglas cruzadas viven en `buildRunRules` (`MAX_BUDGET_BELOW_MAX_COST` con coste e id). No hay números mágicos en dominio ni aplicación.
- **Orden del tick (design)**: `Run.tick` hace jugador → persecución → contacto → (si no ha muerto) director → `tickCount++`, tal y como pide el design. El director no corre en el tick de la muerte.
- **Sin asignaciones por tick en el camino caliente (ADR-0003)**: `contactDamage` es un bucle indexado con escalares; `Enemy.takeDamage` y `removeDead` (compactación en el sitio con `length = w`) no asignan; `Player.hit` solo asigna al golpear (como mucho una vez cada 31 ticks). `Player.move` crea un `Player` y un `Vector2` por tick, pero es herencia de 0001/0002 y está dentro del presupuesto medido. `snapshot()` sigue creando unos 200 objetos congelados por frame (no por tick; 0,004 ms).
- **Nombres y capas del design**: `Health`, `contact.ts`, `RunStatus`, `Run.damageEnemy` y `EnemyDamageOutcome` coinciden con el design. `Player.spawn(position, rules)` y `PlayerRules` se ajustan a lo previsto.
- **Código muerto**: `Run.damageEnemy` (búsqueda O(n)), `Enemy.takeDamage` y `removeDead` solo se usan desde los tests hasta que 0004 añada armas; está declarado en el design y en el JSDoc. No es un defecto.
- **Secretos**: ninguno. Sin dependencias nuevas. Las coincidencias de `token|secret|password` en `tests/guardrails/*` son fixtures de los hooks.

### Desviaciones declaradas por el implementador

1. **7.1 adelantado al bloque 1** — Aceptable. Al ampliar `RunConfig`, el `superRefine` de `loadRunConfig` no compilaba y `loadRunConfig()` fallaba. Sigue siendo un commit por bloque con `verify` en verde y el cambio está en el diario. Mejora: reflejarlo en `tasks.md` (S1).
2. **5.1 y "Cambio de tramo" pasados a `LONG_RUN_HEALTH`** — Aceptable en lo técnico: con la vida por defecto el jugador quieto muere hacia el segundo 16 y el tramo 2 (segundo 30) nunca llega, así que esos tests probarían otra cosa que el spawn. La muerte con contenido por defecto queda cubierta por dos escenarios nuevos. Deja un desajuste con el texto de las specs (W1).
3. **`EnemyLayer.sync` en tres pasadas** — Justificada y correcta: con `capacity = maxAlive`, asignar antes de liberar deja sin hueco a las reposiciones del mismo frame (150 + 50 con 200 huecos), y el test lo demuestra. Sigue sin asignar (`Map` con claves enteras y pila preasignada) y registrada en ADR-0006. Sin embargo `design.md` sigue describiendo el orden de dos pasadas (S2).
4. **`EnemyCatalog.mostExpensive`** — Aceptable: es lo que permite el mensaje `…: 3 (memory-leak)` que pide el design; es un campo calculado una vez en el constructor del VO, congelado, y `maxCost` queda como getter. Es API pública no prevista, pero mínima y cubierta (`enemy-catalog.test.ts:120`).
5. **Getter `hp` en `Enemy`** — Aceptable: TypeScript no permite un campo privado `hp` con un getter del mismo nombre; el campo es `life` y la API pública es `hp`, como en el design. Sin impacto.

## Tasks

Las tareas 1.1 a 11.3 están marcadas `[x]` y cada bloque tiene su commit (`fa275c0` bloque 1, `3d484b5` 2, `b3901d9` 3, `0e58129` 4, `615da6d` 5, `d7dd92a` 6, `58e8467` 7.2, `bd76d91` 9, `668580a` 10, `7bd7e78` 11; 7.1 en `fa275c0`; 8.1 sin cambios de código), con `refs` y `Assisted-by`. El diario `docs/ai-log/2026-11-19-0003-apply.md` está completo y coherente con el código. ADR-0006 pasa a aceptada y ADR-0003 gana la sección "Aplicación (change 0003)". `AGENTS.md` §1 no se ha tocado (condicionado en 11.2 a que lo pida el orquestador).

## Hallazgos

### Critical

Ninguno.

### Warning

Ninguno abierto tras la re-verificación.

- **W1 · RESUELTO.** Los escenarios largos de `specs/enemy-spawning/spec.md` (líneas 169, 176, 226, 303 y 322) y de `specs/enemy-behavior/spec.md` (línea 68) declaran ahora "una vida máxima suficiente para no llegar a 0 en 36.000 ticks", igual que los tests con `LONG_RUN_HEALTH`. "Mezcla de tipos" pasa de Parcial a OK. El escenario "Jugador quieto con el contenido por defecto" sigue con la vida por defecto.
- **W2 · RESUELTO en automático, la prueba manual sigue pendiente.** El commit `4d8d322` añade en `tests/domain/run-contact.test.ts:23-39` dos tests: el jugador que huye a 200 u/s de un enemigo de 60 u/s durante 120 ticks conserva la vida y no es invulnerable (con distancia final > 50), y el control quieto sí recibe daño. Prueban la esquiva de verdad (la pareja descarta un test que pase en vacío). La revisión manual en navegador no fue concluyente (pestaña en segundo plano, unos 40 ticks en 30 s) y queda para el usuario; no bloquea.

### Suggestion

- **S1 · RESUELTA.** `tasks.md` tiene ahora una sección "Desviaciones (verify-report)" con 7.1 y 5.1.
- **S2 · RESUELTA.** `design.md` describe el orden real de `EnemyLayer.sync` y añade "Desviaciones aceptadas en el apply".
- **S3 · RESUELTA.** ADR-0003 reformulado a lo medido (`git diff 4d8d322`, 5 líneas).
- **S4 · Abierta (informativa).** `damageEnemy` por id es O(n) y solo la usan los tests; sustituirla y llamar a `removeDead()` una vez por tick en 0004.
- **S5 · Abierta (informativa).** `Run.snapshot()` asigna unos 200 objetos por frame (0,004 ms); vigilar con proyectiles en 0004.
- **S6 · Abierta (informativa).** El E2E no espera a `'over'`; la evidencia manual del orquestador (tick 948) lo cubre una vez. Valorar un E2E cuando haya pantalla de derrota (0006).

## Veredicto

Sin Critical ni Warning abiertos. Los escenarios de las seis specs tienen test que los prueba (con "Mezcla de tipos" ya en OK), y las cinco desviaciones declaradas son aceptables. Pendiente no bloqueante: prueba manual de esquiva en navegador (a cargo del usuario).

**Re-verificación 2026-11-19**: `npm run verify` verde tras las correcciones (31 ficheros, 385 tests: +2 de esquiva); cambios en specs, design, tasks y ADR-0003 revisados (sin commitear salvo `4d8d322`).

**C: 0 · W: 0 · S: 3**
