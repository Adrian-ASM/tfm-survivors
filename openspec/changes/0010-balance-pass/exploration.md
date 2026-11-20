# Exploración 0010-balance-pass

Intención: partida ganable con el bot de referencia y tests de balance que no caduquen (`content/*.json`; sin contenido nuevo ni meta-progresión).

## Contexto actual
- Simulación: `Run` (`src/domain/run/Run.ts`), 60 ticks/s (`src/domain/shared/Tick.ts`); victoria = 36.000 ticks (`content/run.json`, 600 s). Headless: `Run.start(config, new Mulberry32RandomGenerator(seed))`, `chooseUpgrade(i)`, `tick(input)`.
- Bot de referencia: `fleeInput` (`tests/support/policies.ts`: repulsión 1/d² de enemigos a <150 px y paredes a <64 px, 8 direcciones) + política de elección fija `chooseFirstWhileOpen` (`tests/support/runs.ts`: siempre opción 0 de la oferta). La oferta son 3 mejoras al azar (Fisher-Yates parcial con el RNG de la partida, `UpgradeBoard.open`), así que "opción 0" equivale a mejoras aleatorias: el bot no tiene estrategia de build.
- `tests/domain/balance.test.ts` fija: semilla 7 (primera oferta <=3.600 ticks, pulso <=1.800), semilla 42 (primer golpe <=4.800), semilla 90 sin input pierde en <=4.560 ticks (0007·S2), semilla 2 con `fleeInput` gana (`WIN_SEED`, 0006·W1). Otros ficheros que usan `fleeInput`/`chooseFirstWhileOpen`: `long-run`, `run-outcome-long`, `determinism-progression`, `policies`, `layers-clear`.
- E2E con semilla 90: `tests/e2e/progress.spec.ts:207` y `menu-progress.spec.ts:30` (`FAST_DEFEAT_SEED`, almacenamiento bloqueado, plazo 76 s de juego a `speed=E2E_SPEED`). Semilla 42 (derrota/primer golpe/reinicio en results, health, enemies, pause, menu, progress) y 7 (weapons, level-up, pause) se usan como escenarios sin input, no por balance fino, pero dependen de plazos medidos (primer golpe <=80 s, oferta <=3.600 ticks).
- HALLAZGO importante: los tests unitarios NO leen `content/*.json`; usan espejos en `tests/support/builders.ts` (`DEFAULT_WAVES`, `DEFAULT_ENEMY_TYPES`, `DEFAULT_WEAPONS`, `DEFAULT_UPGRADE_LIST`, `DEFAULT_PROGRESSION`, `aRunConfig`). `weapons-content.test.ts` compara JSON con el espejo (`toEqual(DEFAULT_WEAPONS)`); conviene verificar que existe igual para waves/enemies/upgrades/player. Cambiar el JSON exige sincronizar el espejo, y el balance medido en tests es el del espejo.
- Números clave: jugador 100 HP, vel. 200, invulnerabilidad 30 ticks, pickup 128. Enemigos (vel/daño/vida/xp/coste): bug 90/5/10/1/1; merge-conflict 70/8/20/2/2; memory-leak 45/15/45/4/3. Oleadas (presupuesto/s): 0 s 1 (bug); 60 s 2 (+merge); 180 s 2,5 (+leak); 300 s 5; 480 s 7; maxBudget 10, maxAlive 200. Armas: linter cd 30, daño 6, rango 400, proyectil; tests cd 90, daño 4, pulso radio 90. Mejoras: 9 (daño/cadencia/alcance por arma, +20 vida, +20 velocidad, +32 imán), maxLevel 5, ya con perLevel fijo. XP: baseXp 5, +5 por nivel.

## Capacidades/specs afectadas
`openspec/specs/` de run-outcome, enemy-spawning, auto-weapons, upgrades, leveling, player-health (solo si cambian números citados en escenarios, p. ej. plazos 4.800/1.800/3.600 o el tramo 2,5/s). Revisar al crear el change qué escenarios fijan números concretos.

## Opciones
Para la ganabilidad (palanca):
- A. Solo oleadas/enemigos (suavizar presupuesto de 300-600 s, daño o vida de enemigos). Pro: pocos ficheros, efecto predecible. Contra: no toca la falta de estrategia del bot; riesgo de partida trivial para un humano.
- B. Solo jugador/armas/mejoras (más vida o daño, mejoras más fuertes, curva de XP más rápida). Pro: más subidas de nivel, build más impactante. Contra: el bot elige al azar, así que el efecto medio depende de la dispersión; interacciona con plazos de la oferta.
- C. Mixta y/o bot de referencia mejorado (elección con prioridad de mejoras en vez de opción 0). Pro: mide ganabilidad "razonable", menos sobreajuste a un azar concreto. Contra: cambia la política documentada en specs (`simulation-loop` define opción 0 fija) y amplía alcance.

Para tests no frágiles:
- T1. Tasa de victoria sobre un conjunto de semillas (p. ej. 1..N) con umbral mínimo. Pro: no caduca por una semilla; refleja el objetivo. Contra: coste (cada partida 36.000 ticks; medir ms/partida), umbral ajustado al bot (sobreajuste).
- T2. Elegir semillas por derivación (la test calcula "la semilla que antes pierde" de un conjunto en vez de hardcodear 90). Pro: sin número mágico. Contra: el coste de buscar en cada ejecución; el E2E no puede calcularlo en el navegador (habría que pasarlo por fixture/global setup).
- T3. E2E de almacenamiento bloqueado que fuerce la derrota por otra vía (parámetro solo `?e2e`, p. ej. vida inicial baja, o `?e2e&speed` con semilla cualquiera esperando un timeout mayor). Pro: independiente del balance. Contra: añade superficie en el adaptador y spec; si es un parámetro de dominio rompe la pureza (debe vivir en adaptador/composición).

## Riesgos e incógnitas
- Sobreajustar al bot de `fleeInput` (huida determinista) y no al humano; no hay playtest humano.
- Cambiar balance mueve los plazos de 0004/0005/0007 (semillas 7, 42, 90) y puede romper E2E con timeouts calibrados (0008·W3, 0009·W6).
- Dos fuentes de contenido (JSON y espejo en builders): riesgo de deriva si no hay test de igualdad para todos.
- Coste de tiempo del test de N semillas en `npm run verify` (no medido).
- Objetivo de ganabilidad sin definir.

## Mediciones previas (las lanza el orquestador antes de la propuesta)
Fichero temporal NO versionado, p. ej. `tests/domain/tmp-measure.test.ts` (o script fuera del repo ejecutado con vitest; borrar al acabar; no hacer commit). API: `Run.start(aDefaultConfig(), new Mulberry32RandomGenerator(seed))`, `chooseFirstWhileOpen`, `run.tick(input)`, `run.snapshot()` (`status`, `outcome`, `tick`, `progression.level`, `player.health`). Contenido: `aDefaultConfig()` (espejo; comprobar antes que coincide con `content/*.json`).
- Experimento 1 (línea base): semillas 1..50 (mejor 1..100 si el coste lo permite; medir ms/partida), estrategias: (a) `fleeInput` + opción 0 (bot actual); (b) sin input + opción 0; (c) `fleeInput` + política de elección sesgada (priorizar guardrail, strict-rules, fast-ci, hard-asserts, watch-mode sobre el resto; si no está en la oferta, opción 0). Parar cada partida al terminar (`status==='over'`).
- Salida por estrategia: nº de victorias / N (tasa), tick medio y mediano de muerte en derrotas (percentiles 10/50/90), nivel medio alcanzado, mejoras elegidas (conteo por id, agregado), tiempo de pared por partida. Tabla por semilla: `seed, outcome, tick, level`.
- Experimento 2 (sensibilidad, tras fijar palancas candidatas): repetir con 1-2 variantes del contenido (p. ej. presupuesto 300-600 s reducido; +vida del jugador) clonando `aDefaultConfig()`, para ver la elasticidad de la tasa de victoria.
- Experimento 3 (semillas de tests): con la configuración final, tick de primer golpe, primera oferta y derrota sin input para las semillas 7, 42, 90 y 1..50 (para recalcular plazos y elegir un E2E de derrota independiente).
- Umbral "bueno" (provisional, a confirmar con el usuario): estrategia (a) gana >=X% de 50 semillas (propuesta de partida: 50-70%, ver preguntas), (b) sin input no gana nunca, y la mediana de muerte sin input queda entre 2 y 5 min; ms/partida tal que el test de N semillas cueste <=10-15 s en `verify`.

## Preguntas para el usuario
1. Porcentaje objetivo de victoria con el bot de referencia (propuesta: 50-70%) y N semillas del test (10 como en el GDD, o 20-30 con umbral más holgado).
2. ¿La ganabilidad se mide solo con el bot (`fleeInput` + opción 0) o se admite una política de elección mejor como referencia?
3. ¿Quieres que un jugador quieto pueda ganar alguna vez? (propuesta: nunca).
4. Para el E2E de la semilla 90: ¿parámetro de URL solo `?e2e` para forzar derrota (T3), o semilla derivada de una medición (T2)?
5. ¿Hay playtest humano disponible para validar la dificultad, o nos quedamos con la medición del bot?
6. ¿Se pueden tocar los plazos de las specs ya archivadas (4.800/1.800/3.600) si cambia el balance?

## Resultados de las mediciones previas (orquestador, 2026-11-20)

Test temporal `tests/domain/tmp-measure.test.ts` (no versionado; borrado al acabar), con `loadRunConfig()`
(contenido real; coincide con el espejo `aDefaultConfig()` salvo el orden de claves). Semillas 1..100, 600 s.
Estrategias: `flee-first` = `fleeInput` + opción 0 (bot de 0006); `flee-prio` = `fleeInput` + elige la primera
mejora de la oferta según la prioridad guardrail > strict-rules > fast-ci > hard-asserts > watch-mode (si no
hay ninguna, la opción 0); `none-first` = quieto + opción 0. Las variantes multiplican `budgetPerSecond` de los
tramos con `fromSecond ≥ N` (`fNxP` = ×P/100) o fijan la vida máxima (`hpN`).

| Variante | flee-first | flee-prio | quieto | Muerte de flee-prio (s, p10/50/90) | Muerte quieto (s, p50/p90) |
|---|---|---|---|---|---|
| base (contenido actual) | 5 % | 34 % | 0 % | 178/323/364 | 80/87 |
| hp150 | 7 % | 43 % | 0 % | 201/327/363 | 85/101 |
| f60x80 | 8 % | 53 % | 0 % | 275/350/379 | 97/215 |
| f60x70 | 10 % | 65 % | 0 % | 296/351/377 | 195/318 |
| f60x80 + hp150 | 11 % | 67 % | 0 % | 281/359/393 | 120/228 |
| f60x80 + f300x70 | 33 % | 93 % | 0 % | 197/235/406 | 97/215 |
| f60x70 + f300x70 + hp150 | 44 % | 96 % | 4 % | 253/296/333 | 206/338 |

Otras (solo flee-first/quieto): late70 (×0,7 desde 300 s) 11 %/0 %; late50 17 %/0 %; hp200 9 %/0 %; mid80 7 %/0 %.

Conclusiones:
- La **política de elección** es la palanca dominante (×7 sobre el contenido actual). El bot de opción 0 no
  representa a un humano.
- Las muertes se concentran entre 2 y 6 min: el tramo desde 60 s pesa más que el final. La vida sola apenas mueve.
- Quieto nunca gana salvo en la variante más generosa; con el contenido actual muere en 75–90 s con cualquier
  semilla. Si se suaviza desde 60 s, la muerte sin input se retrasa y se dispersa (p90 hasta 318 s).
- Coste: 35–190 ms por partida (flee-prio es la más cara) ⇒ 50 semillas ≈ 2–10 s.
- Semillas de los tests con el contenido actual: flee-first gana con la 2 y pierde con la 7, la 42 y la 90; quieto
  pierde con la 2, la 7, la 42 y la 90 entre los ticks 4.501 y 4.895.

## Decisiones del usuario (2026-11-20, tras las mediciones)
1. Bot de referencia: `fleeInput` + **elección priorizada** (no la opción 0).
2. Objetivo: el bot de referencia gana entre el **50 % y el 70 %** de las semillas.
3. E2E de la semilla 90: depender del invariante **"quieto pierde"** (con cualquier semilla, en un plazo medido),
   protegido por un test unitario sobre N semillas; sin parámetro `?e2e` nuevo.

## Gate de propuesta (2026-11-20): aprobada, con estas respuestas a las preguntas abiertas
- Banda: el bot de referencia gana **25–35 de las semillas 1..50**.
- "Quieto pierde" pasa a ser **objetivo de balance**: con input (0, 0) pierde en las 50 semillas **antes de 180 s**.
- El test de tasa de victoria va en `npm run verify`.
- Apply puede reescribir en las specs delta los plazos archivados que la medición mueva (4.800 ticks, 80 s,
  120 s del E2E) y combinar `budgetPerSecond` con otra palanca de contenido (p. ej. vida del jugador),
  documentándolo.
- E2E de derrota: semilla fija **42** del conjunto (pierde quieta), sin parámetro nuevo.

## Medición complementaria tras el gate (semillas 1..50, flee-prio / quieto)
| Variante | flee-prio | quieto: victorias / muerte máx. | semilla 42 quieta |
|---|---|---|---|
| base | 17/50 | 0 / 94 s | pierde a 78 s |
| f120x70 | 34/50 | 0 / 94 s | 78 s |
| f180x70 | 34/50 | 0 / 94 s | 78 s |
| f180x60 | 39/50 | 0 / 94 s | 78 s |
| f300x60 | 37/50 | 0 / 94 s | 78 s |
| f300x50 | 38/50 | 0 / 94 s | 78 s |
| f180x80 + f300x70 | 40/50 | 0 / 94 s | 78 s |
| hp150 + f300x60 | 41/50 | 0 / 322 s ✗ | 82 s |

Conclusión: suavizar **solo desde 180 s** (o 120 s) no toca la muerte sin input (≤ 94 s, todas antes del primer
tramo modificado) y cumple la banda con ×0,7 (34/50, en el borde superior; apply afina p. ej. ×0,75–0,8).
Suavizar desde 60 s o subir la vida rompe el objetivo "quieto < 180 s". Como los primeros 180 s no cambian, los
plazos archivados de primer golpe (semilla 42), oferta (semilla 7) y pulso deberían mantenerse; apply lo confirma.

## Medición 3: variantes que respetan "el presupuesto no baja de un tramo al siguiente"
Con ×0,7 desde 180 s, el tramo de 180 s (2,5 → 1,75) baja por debajo del de 60 s (2), lo que rompe
`enemy-spawning`. Variantes monótonas (semillas 1..50):

| Variante | Presupuesto por tramo (0/60/180/300/480) | flee-prio | quieto: muerte máx. |
|---|---|---|---|
| f180x80 | 1 / 2 / 2 / 4 / 5,6 | 24/50 | 94 s |
| f300x65 | 1 / 2 / 2,5 / 3,25 / 4,55 | 37/50 | 94 s |
| f300x70 | 1 / 2 / 2,5 / 3,5 / 4,9 | 35/50 | 94 s |
| f300x75 | 1 / 2 / 2,5 / 3,75 / 5,25 | 32/50 | 94 s |
| **f300x80** | **1 / 2 / 2,5 / 4 / 5,6** | **30/50** | **94 s** |
| f180x80 + f300x85 | 1 / 2 / 2 / 3,4 / 4,76 | 36/50 | 94 s |
| f180x80 + f300x90 | 1 / 2 / 2 / 3,6 / 5,04 | 28/50 | 94 s |

Conclusión: **×0,8 solo en los tramos de 300 s y 480 s** (5 → 4 y 7 → 5,6) da 30/50, en el centro de la banda.
Es monótono, no toca los primeros 300 s (ni los plazos archivados ni la muerte sin input) y es la opción más
simple. La tasa es ruidosa (±3–4 de un factor a otro, y no es monótona en las combinaciones), así que la banda de ±5
alrededor de 30 es el margen mínimo razonable.
