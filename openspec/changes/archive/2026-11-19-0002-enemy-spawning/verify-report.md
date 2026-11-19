# Verify report · 0002-enemy-spawning

Verificador independiente (no ha escrito ni corregido código). Rama `change/0002-enemy-spawning`, 12 commits sobre `origin/main`.

## Resultado de las ejecuciones

| Comando | Resultado |
|---|---|
| `npm run verify` | Verde: lint, typecheck, `guard:all` (147 ficheros) y 26 ficheros / 263 tests |
| `npm run test:e2e` | Verde: 3 tests (smoke de 0001, `?seed=42`, `?seed=abc`) |
| `npm run bench` | Verde: `Run.tick` con 200 vivos, media 0,0071 ms, p99 0,0110 ms (umbral 2 ms); `Run.snapshot` media 0,0043 ms. Ryzen 7 9800X3D, Windows 11, Node 26.13.1. Coincide con el diario de IA (0,0069 ms) |

## Escenario → Test → Estado

Todos los tests están en `tests/`. OK = el test prueba el escenario de verdad.

### enemy-behavior

| Escenario | Test | Estado |
|---|---|---|
| Persecución horizontal durante un segundo | `domain/enemy.test.ts:24`, `domain/run-enemies.test.ts:33` | OK |
| Persecución en diagonal | `domain/enemy.test.ts:31` | OK |
| Llegada sin sobrepasar | `domain/enemy.test.ts:38` | OK |
| Persigue la posición del jugador en el mismo tick | `domain/run-enemies.test.ts:40` | OK |
| Dos tipos, dos velocidades | `domain/enemy.test.ts:52` | OK |
| Enemigo más grande que el jugador junto a un borde | `domain/enemy.test.ts:61` | OK |
| Partida larga | `domain/long-run.test.ts:72` | OK |
| Dos enemigos idénticos se superponen | `domain/run-enemies.test.ts:49` | OK |
| Primer tick de vida | `domain/run-enemies.test.ts:58` | Parcial (W1) |

### enemy-spawning

| Escenario | Test | Estado |
|---|---|---|
| Contenido por defecto | `infrastructure/content.test.ts:167` | OK |
| Valores de cada tipo llegan al dominio | `domain/run-spawning.test.ts:132` | OK |
| Oleada con un tipo inexistente | `domain/wave-table.test.ts:55`, `infrastructure/content.test.ts:116` | OK |
| Velocidad cero | `domain/enemy-catalog.test.ts:38`, `infrastructure/content.test.ts:55` | OK |
| Radio que no cabe en la arena | `domain/enemy-catalog.test.ts:56`, `infrastructure/content.test.ts:124` | OK |
| Radio en el límite exacto | `domain/enemy-catalog.test.ts:65`, `infrastructure/content.test.ts:130` | OK |
| Identificador duplicado | `domain/enemy-catalog.test.ts:69`, `infrastructure/content.test.ts:136` | OK |
| Primer tramo que no empieza en 0 | `domain/wave-table.test.ts:62`, `infrastructure/content.test.ts:142` | OK |
| Tramos desordenados o repetidos | `domain/wave-table.test.ts:71`, `infrastructure/content.test.ts:148` | OK |
| Tope de vivos no entero | `domain/run-config.test.ts:44`, `infrastructure/content.test.ts:65` | OK |
| Cambio de tramo | `domain/wave-director.test.ts:161`, `domain/run-spawning.test.ts:61` | OK |
| Un solo tramo | `domain/run-spawning.test.ts:72` | OK |
| Tramo sin presupuesto | `domain/wave-director.test.ts:74` | OK |
| Ritmo constante con coste 1 | `domain/wave-director.test.ts:52` | OK |
| El coste retrasa la aparición | `domain/wave-director.test.ts:59` | OK |
| Varios spawns en un tick | `domain/wave-director.test.ts:68` | OK |
| Mezcla de tipos | `domain/long-run.test.ts:81` | OK |
| Oleadas que crecen con el contenido por defecto | `infrastructure/content.test.ts:175` | OK |
| Se alcanza el tope | `domain/wave-director.test.ts:102` | OK |
| El tope se mantiene | `domain/wave-director.test.ts:108` (comprueba que no hay llamadas a `next()`) | OK |
| Tope mínimo | `domain/wave-director.test.ts:118` | OK |
| Arena mayor que la vista | `domain/place-spawn.test.ts:23` | OK |
| Arena igual a la vista | `domain/place-spawn.test.ts:36` | OK |
| Jugador en una esquina | `domain/place-spawn.test.ts:54`, `domain/run-spawning.test.ts:80` | OK |
| Ninguna posición válida | `domain/place-spawn.test.ts:69`, `domain/run-spawning.test.ts:91` (cuenta 8 `next()` por tick) | OK |
| El presupuesto no se pierde al aplazar | `domain/wave-director.test.ts:126`, `domain/run-spawning.test.ts:115` | OK |
| Partida larga sin spawns ilegales | `domain/long-run.test.ts:66` | OK |

### simulation-loop

| Escenario | Test | Estado |
|---|---|---|
| Semilla válida por URL | `infrastructure/seed.test.ts:8`, `e2e/enemies.spec.ts:40` | OK |
| Límites del rango | `infrastructure/seed.test.ts:13` | OK |
| Semilla inválida | `infrastructure/seed.test.ts:20` (7 valores), `e2e/enemies.spec.ts:63` | OK |
| Sin semilla en la URL | `infrastructure/seed.test.ts:26` | OK |
| Tope de vivos alcanzado | `bench/run.bench.ts:30` (`npm run bench`, fuera de `verify`) | OK |
| Dos partidas idénticas | `domain/determinism.test.ts:26`, `application/loop.test.ts:60` | OK |
| Semillas distintas | `domain/determinism.test.ts:33` | OK |
| Partida larga reproducible | `domain/long-run.test.ts:77` | OK |
| Snapshot no mutable desde fuera | `domain/run.test.ts:88` | OK |
| Contador de ticks | `domain/run.test.ts:24` | OK |
| Partida recién creada sin enemigos | `domain/run.test.ts:16` | OK |
| Enemigos en el snapshot | `domain/run.test.ts:67` | OK |
| Identificador estable | `domain/run.test.ts:77` | OK |

No hay escenarios sin test.

## Contraste con reglas de AGENTS.md y con el design

- **Capas y pureza**: `guard:all` y ESLint en verde. Un `grep` de `Math.random|Date.now|performance.now|window|document|localStorage` en `src/domain` y `src/application` no encuentra nada. La aleatoriedad entra por el puerto `RandomGenerator` (`src/domain/shared/RandomGenerator.ts`). `Mulberry32RandomGenerator` y `resolveSeed` están en infraestructura. Solo `src/composition/main.ts` los une.
- **Contenido y zod**: `content/enemies.json`, `content/waves.json` y `content/arena.json` (con `view`) se validan con `z.strictObject` (`src/infrastructure/content/schemas.ts:32-73`). Las reglas cruzadas viven en `buildRunRules` y zod las reutiliza por `superRefine` (`src/infrastructure/content/loadRunConfig.ts:13-24`), así que no hay duplicación. `?seed` se valida con zod (`src/infrastructure/url/resolveSeed.ts:70-74`).
- **Números mágicos**: no hay en dominio ni aplicación. `TICKS_PER_SECOND` y `FULL_TURN` son constantes con nombre. La paleta tiene un comentario que la justifica como presentación (S1).
- **Determinismo con semilla**: el orden del tick (jugador, persecución, director) está fijo en `src/domain/run/Run.ts:105-111`. El director consume exactamente 1 `next()` por tipo pendiente y `placeSpawn` 1 por intento. Con el tope alcanzado no consume azar. Los tests lo cubren. `main.ts:136-138` crea el generador con la semilla resuelta y la expone en `probe.seed`. Una semilla inválida da 1 aviso y una semilla aleatoria vía `crypto`, solo en composición. `resolveSeed` acepta `^\d+$`: `?seed=007` da 7 y `1e3` y ` 7` se rechazan, con test.
- **Rendimiento**:
  - `EnemyLayer` (`src/infrastructure/phaser/EnemyLayer.ts:29-35`) preasigna el pool y solo cambia radio y color si cambia el tipo. El test comprueba que no crea objetos tras preasignar.
  - `Enemy.chase` (`src/domain/enemy/Enemy.ts:185-199`) usa escalares mutables y no asigna objetos. `Run.tick` recorre con `for...of` sobre un array.
  - El bench lo confirma: 0,007 ms por tick, unas 280 veces por debajo del umbral.
- **Desviaciones declaradas**, todas justificadas y documentadas en el diario:
  1. Adelanto de 5.1 y 5.2 al bloque 3: justificado, porque `Run.start` exige la configuración completa y el build quedaba en rojo.
  2. `TICK_SECONDS` en `src/domain/shared/Tick.ts`: justificado, evita el ciclo `WaveTable → Run`. `Run.ts:22` lo re-exporta y no rompe a los consumidores.
  3. `buildRunRules` valida al jugador (`src/domain/run/RunConfig.ts:79-85`): justificado, deja una sola fuente de reglas. Los mensajes son los mismos que en 0001 y hay test (`run-config.test.ts:87`, `content.test.ts:26`).
  4. Reporter verbose del bench (`package.json:21`): justificado, el reporter por defecto no muestra los resultados. No afecta a `verify`.
  5. Filtro de avisos WebGL en el E2E (`tests/e2e/enemies.spec.ts:191`): aceptable. La regex está anclada a `^\[\.WebGL-0x…\]GL Driver Message`, un prefijo que el juego no emite. Los `pageerror` no se filtran y el aviso real de `?seed=abc` ("Parámetro seed inválido…") no coincide con el patrón, así que sigue contando. Si el driver cambia el texto, el test falla en rojo, que es el modo seguro.
- **Secretos**: no hay. No se añaden dependencias nuevas (`package.json` solo añade el script `bench`).

## Tasks

Las tareas 0.1 a 8.2 y 9.3 están marcadas `[x]`. Siguen abiertas 9.1 y 9.2, que se dan por pendientes de humano o de cierre (ver W3). El diario `docs/ai-log/2026-11-19-0002-apply.md` está completo y es coherente con el código.

## Hallazgos

### Critical

Ninguno.

### Warning

- **W1 · "Primer tick de vida" no prueba su primera cláusula** (`tests/domain/run-enemies.test.ts:58-74`). El test toma como P la posición del snapshot del tick n (`born`) y solo comprueba que el tick siguiente se mueve `velocidad/60`. Si `Run.tick` moviera al enemigo también en el tick de aparición (director antes que persecución), `born` ya sería la posición movida y el test seguiría en verde. El escenario exige "exactamente en P" con P independiente. Hace falta comparar con la posición que devuelve `placeSpawn`, por ejemplo con un `place` espía o un `RandomGenerator` cuyo ángulo se conozca.
- **W2 · No se cumple "un commit por tarea"** (`openspec/changes/0002-enemy-spawning/tasks.md:7`). Hay 12 commits para unas 35 tareas, agrupados por bloque (el diario lo admite: "commits por bloque"). Los 12 llevan `refs` y `Assisted-by`. Pierde trazabilidad tarea→commit, y 5.1/5.2 van dentro del commit de dominio/contenido. Hay que registrar la desviación en `tasks.md` o en la retro.
- **W3 · Tareas 9.1 y 9.2 pendientes** (`tasks.md:134` y `tasks.md:136`). Bloquean el archivado.
  - 9.1: revisión visual humana en `npm run dev` (3 colores y tamaños, y que `?seed=42` sin input se repite). Ningún test automático cubre la repetición en navegador de punta a punta.
  - 9.2: `docs/adr/0003-inmutabilidad-y-rendimiento.md:3` sigue en "propuesta" y `npm run bench` no está en la tabla de AGENTS.md §2. Cifras para el ADR: media 0,0071 ms, p99 0,0110 ms por tick con 200 vivos; `snapshot()` 0,0043 ms; decisión = estado escalar mutable interno en `Enemy`, sin struct of arrays.

### Suggestion

- **S1** · `src/infrastructure/phaser/enemyPalette.ts:3-7` acopla ids de contenido (`bug`, `memory-leak`, `merge-conflict`) al código. Está justificado como presentación y tiene color por defecto, pero un tipo nuevo en `enemies.json` sale gris. Se podría mover el color a un `content/*.json` cuando llegue el arte.
- **S2** · `src/infrastructure/phaser/EnemyLayer.ts:38` usa `for (const [i, slot] of this.slots.entries())`, que crea una tupla por hueco y frame (200 pequeñas asignaciones por frame). Un `for` indexado evita la basura. Es compatible con la regla de no crear objetos del motor, y el impacto es mínimo.
- **S3** · `src/domain/run/Run.ts:132-139`: `snapshot()` asigna unos 200 objetos congelados por frame. Medido a 0,004 ms, así que es aceptable. Conviene vigilarlo en 0003.
- **S4** · El presupuesto de 2 ms solo se vigila con `npm run bench` (`tests/bench/run.bench.ts:39`), que queda fuera de `verify` y del CI, como dice el design. Una regresión de rendimiento no rompe ningún check. Valorar un job manual de bench cuando el plan de GitHub lo permita.
- **S5** · `src/infrastructure/phaser/GameScene.ts` y `src/composition/main.ts:149-151` fijan el canvas al tamaño de la vista sin cámara que siga al jugador. Con arena = vista (contenido actual) es correcto. Si una arena futura es mayor que la vista, solo se vería una parte. Registrarlo para el change que lo cambie.
- **S6** · El diario admite que los tests de 3.4, 4.1 y 5.2 salieron en verde a la primera, sin rojo previo (mitigado con pruebas de mutación manuales). Es una desviación del TDD que merece una línea en la retro.
- **S7** · El filtro WebGL (`tests/e2e/enemies.spec.ts:191`) podría restringirse a `m.type() === 'warning'` y documentar en el test la versión de Chromium observada. Hoy se aplica también a `error`, aunque con una regex tan estrecha el riesgo es bajo.

## Veredicto

Sin Critical. Todos los escenarios de las tres specs tienen test que los cubre, con la salvedad parcial de W1. Verify, E2E y bench en verde. Apto para pasar a archivo cuando se resuelvan W1 (o se acepte), 9.1 y 9.2 (W3) y se anote W2.

**C: 0 · W: 3 · S: 7**
