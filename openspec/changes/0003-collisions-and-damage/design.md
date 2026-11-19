# Design · 0003-collisions-and-damage

## Resumen
El núcleo puro gana vida, contacto y fin de partida. Cada tick, `Run` mueve al jugador, mueve a los enemigos, calcula
con una función pura el daño de contacto (círculo contra círculo, fuerza bruta) y, si el jugador no es invulnerable,
le aplica un golpe. Si su vida llega a 0, la partida pasa a `over` y los ticks siguientes no hacen nada. Los enemigos
tienen vida y una baja probada por tests (`Run.damageEnemy`), que compacta la lista en el sitio y sin asignar,
conservando el orden de aparición. El director acumula presupuesto también en el tope, pero solo guarda hasta
`waves.maxBudget`. `EnemyLayer` asocia cada sprite a un `id` de enemigo, así que una baja no repinta a los demás.
No hay dependencias nuevas ni datos persistidos.

## Decisiones de la propuesta que concreta este diseño
| Tema | Decisión de diseño |
|---|---|
| Duración de la invulnerabilidad | `player.invulnerabilityTicks` (entero ≥ 1) en ticks, no en segundos: es exacta y la spec la razona en ticks |
| Daño con varios contactos en un tick | Un golpe con el **mayor** `damage` de los enemigos en contacto (no depende del orden; spec `player-health`) |
| Tangencia | No es contacto: `d² < (r₁ + r₂)²` estricto (spec `player-health`) |
| Detección durante la invulnerabilidad | Se calcula igualmente cada tick: coste constante y benchmark honesto |
| Tick de la muerte | Cuenta (`tick` avanza) pero no ejecuta el director: no hay spawns en ese tick (spec `run-state`) |
| Presupuesto guardado | Tras sumar el del tick se recorta a `maxBudget` **antes de gastar** (spec `enemy-spawning`): también limita los spawns de un tick |
| Vida de los enemigos en el snapshot | `EnemySnapshot.health`: los escenarios de baja la observan ("vida 2", "vida intacta") |
| Bajas | Compactación estable en el sitio; `Run.damageEnemy(id, amount)` como único punto de entrada en 0003 |
| Sprites tras bajas | `EnemyLayer` asocia hueco ↔ `id` (no hueco ↔ índice) |

## Piezas por capa
| Pieza | Capa | Nuevo / modificado | Por qué ahí |
|---|---|---|---|
| `Health` (VO) | `domain/shared/Health.ts` | nuevo | Invariante 0 ≤ vida ≤ máximo y recorte a 0; sin dependencias |
| `Player` (entidad inmutable) | `domain/player` | modificado: `health`, `invulnerableUntil`, `hit` | La vida y las *i-frames* son estado del jugador |
| `EnemyType` (VO) | `domain/enemy` | modificado: `damage`, `health` | Datos del tipo, compartidos por sus enemigos |
| `EnemyCatalog` (VO) | `domain/enemy` | modificado: `maxCost` | Lo necesita la validación de `maxBudget` |
| `Enemy` (entidad mutable interna) | `domain/enemy` | modificado: `hp` escalar, `alive`, `takeDamage` | ADR-0003: estado escalar interno al agregado |
| `circlesOverlap`, `contactDamage` (funciones puras) | `domain/collision/contact.ts` | nuevo | Regla geométrica pura; la sustituirá una rejilla en 0004 |
| `RunStatus` (`'running' \| 'over'`) | `domain/run/RunStatus.ts` | nuevo | Estado del agregado expuesto en el snapshot |
| `Run` (aggregate root) | `domain/run` | modificado: orden del tick, `status`, `damageEnemy`, `removeDead` | Único punto de cambio del estado |
| `RunConfig`, `buildRunRules` | `domain/run` | modificado: vida, *i-frames*, `damage`/`health`, `maxBudget` | Una sola implementación de invariantes (zod la reutiliza) |
| `SpawnRules` (VO) | `domain/wave` | modificado: `maxBudget` | Parámetro de spawn, como `maxAlive` |
| `WaveDirector` | `domain/wave` | modificado: acumula en el tope y acota lo guardado | Política de presupuesto |
| `RunSnapshot` | `domain/run` | modificado: vida, máximo, invulnerable, `status` | DTO de salida hacia el motor |
| Esquemas zod | `infrastructure/content/schemas.ts` | modificado | Forma y rangos por campo |
| `EnemyLayer` | `infrastructure/phaser` | modificado: hueco por `id` | Sprites estables tras bajas |
| `GameScene`, `main.ts`, `TickRun`, `FixedStepLoop` | — | sin cambios | El fin de partida es estado del dominio; HUD y derrota son de 0006 |

No hay puertos nuevos: la detección es una función, no un puerto, porque no hay dos implementaciones previsibles en
paralelo (la rejilla de 0004 la **sustituirá**, no convivirá con ella).

## Contenido y validación

### Valores provisionales
```jsonc
// content/player.json
{ "speed": 200, "radius": 16, "maxHealth": 100, "invulnerabilityTicks": 30 }
// content/enemies.json (types)
{ "id": "bug",            "speed": 90, "radius": 10, "cost": 1, "damage": 5,  "health": 10 }
{ "id": "memory-leak",    "speed": 45, "radius": 22, "cost": 3, "damage": 15, "health": 45 }
{ "id": "merge-conflict", "speed": 70, "radius": 16, "cost": 2, "damage": 8,  "health": 20 }
// content/waves.json: se añade
"maxBudget": 10
```
Razonamiento de balance (provisional; el fino llega con armas y HUD):
- **Cota de daño**: con *i-frames* de 30 ticks (0,5 s) hay como mucho 2 golpes/s. Rodeado solo de `bug`, el jugador
  pierde 10 de vida/s: muere tras 20 golpes, unos 10 s de contacto continuo. Con un `memory-leak` encima pierde
  30/s: unos 3,3 s. Es el rango del género: castiga quedarse quieto, pero da tiempo a reaccionar.
- **El jugador escapa**: su velocidad (200) supera la de todos los tipos (90 como mucho). El daño premia moverse.
- **Daño y vida crecen con el coste** (1 : 2 : 3). `memory-leak` es lento y tanque (45 de vida, 15 de daño);
  `bug` muere de un impacto de 10, una referencia útil para el arma inicial de 0004.
- **`maxBudget` 10**: ≥ 3, el coste más caro. Es 1,4 s del presupuesto del último tramo (7/s) y 10 s del
  primero. Al abrirse huecos (0004) salen como mucho 10 `bug` o 3 `memory-leak` de golpe, una ráfaga acotada.
- **0,5 s de invulnerabilidad**: es lo bastante larga para que 200 enemigos apilados no hagan más daño que uno, y
  lo bastante corta para que el contacto siga siendo peligroso.

### Invariantes (dominio) y esquemas (zod)
Mismo patrón que 0002: el dominio define las constantes de mensaje, los factories las comprueban y zod las
reutiliza (campos estrictos).

| Campo | Regla | Mensaje (constante de dominio) | Dónde |
|---|---|---|---|
| `player.maxHealth` | número finito > 0 | `PLAYER_HEALTH_MUST_BE_POSITIVE` | `checkPlayer` (`RunConfig.ts`) + `PlayerSchema` |
| `player.invulnerabilityTicks` | entero ≥ 1 | `INVULNERABILITY_TICKS_MUST_BE_INTEGER` | `checkPlayer` + `PlayerSchema` (`Count`) |
| `enemies.types.i.damage` | número finito > 0 | `ENEMY_DAMAGE_MUST_BE_POSITIVE` | `EnemyType.create` + `EnemiesSchema` |
| `enemies.types.i.health` | número finito > 0 | `ENEMY_HEALTH_MUST_BE_POSITIVE` | `EnemyType.create` + `EnemiesSchema` |
| `waves.maxBudget` | número finito > 0 | `MAX_BUDGET_MUST_BE_POSITIVE` | `SpawnRules.create` + `WavesSchema` |
| `waves.maxBudget` | ≥ `catalog.maxCost` | `MAX_BUDGET_BELOW_MAX_COST` (con el coste y el id) | `buildRunRules` (regla cruzada) |

- **`maxBudget` ≥ el coste más caro del catálogo**, no solo de los tipos usados en tramos. Es más simple y más
  conservador. Con un máximo menor, el tipo más caro nunca reuniría su coste y quedaría pendiente para siempre,
  bloqueando al director (el tipo pendiente no se vuelve a sortear).
- La regla cruzada va en `buildRunRules` después de crear catálogo y `SpawnRules`, y zod la recoge por el
  `superRefine` existente. Así el error de contenido dice `waves.maxBudget` y cuál es el coste mínimo.
- **Vida y daño no se exigen enteros**: la propuesta pide "positivos" y las mejoras futuras pueden escalar el daño
  con multiplicadores. El recorte a 0 de `Health` evita vidas negativas con decimales.

## Simulación

### `Health` (VO)
```ts
class Health {
  static full(max: number): Health;      // max ya validado en buildRunRules
  readonly current: number; readonly max: number;
  damage(amount: number): Health;        // new Health(max(0, current − amount), max)
  get isDepleted(): boolean;             // current === 0
}
```
Es inmutable y congelado. Solo asigna al recibir un golpe (como mucho uno cada 31 ticks), nunca por tick.

### `Player`
- Gana `health: Health`, `invulnerabilityTicks` (N, de las reglas) e `invulnerableUntil` (el último tick
  protegido; vale 0 al empezar).
- `Player.spawn(position, rules.player)` recibe las reglas del jugador en lugar de tres escalares.
- `move` conserva vida e *i-frames*.
- `canBeHitAt(n)` es `n > invulnerableUntil`. `hit(damage, n)` devuelve un `Player` con
  `health.damage(damage)` e `invulnerableUntil = n + N`.
- El snapshot del tick k marca `invulnerable = k < invulnerableUntil`. Equivale a "un contacto en k + 1 no
  dañaría", que es la definición de la spec. Con un golpe en t = 1 y N = 30, el snapshot dice `true` en los ticks
  1 a 30 y `false` en el 31, y en el tick 32 se puede volver a golpear.
- Con un tick absoluto no hace falta decrementar ningún contador por tick, y `Player` sigue siendo inmutable.

### `Enemy`
- Gana `private hp` (empieza en `type.health`), `get alive()` (`hp > 0`) y `get damage()` (el del tipo).
- `takeDamage(amount): boolean` resta el daño, recorta a 0 y devuelve `true` si este golpe lo mató. Sobre un enemigo
  ya muerto no hace nada.
- La vida del enemigo es un escalar mutable, no un `Health` (ADR-0003). En 0004 habrá muchos impactos por tick, y
  un VO por impacto sería una asignación innecesaria en el camino caliente. La regla de recorte a 0 es la misma.

### Contacto: `domain/collision/contact.ts`
```ts
export interface ContactTarget { readonly x: number; readonly y: number;
                                 readonly radius: number; readonly damage: number }
export function circlesOverlap(ax, ay, ar, bx, by, br): boolean   // dx² + dy² < (ar + br)²
/** Mayor damage entre los objetivos que solapan el círculo (px, py, pr); 0 si ninguno. */
export function contactDamage(px, py, pr, targets: readonly ContactTarget[]): number
```
- La función es pura, O(n) por fuerza bruta y sin asignaciones (bucle `for` indexado). `Enemy` cumple
  `ContactTarget` de forma estructural, así que el dominio no necesita una copia.
- Compara con cuadrados, sin `Math.sqrt`, así que la tangencia exacta (26 = 16 + 10) da `false` sin errores de
  redondeo.
- El máximo no depende del orden de la lista, así que las bajas y la compactación no cambian el resultado.
- Se recorren todos los objetivos, sin salida anticipada: hace falta el máximo, y el coste es constante.
- **Reemplazable**: en 0004, una rejilla espacial podrá ofrecer la misma firma sobre los candidatos de una celda.
  `Run` solo depende de "daño de contacto en este tick".

### Baja de enemigos: compactación estable en el sitio (ADR-0006)
```ts
private removeDead(): void {
  let w = 0;
  for (let r = 0; r < this.enemies.length; r++) {
    const e = this.enemies[r]!;
    if (e.alive) { if (w !== r) this.enemies[w] = e; w++; }
  }
  this.enemies.length = w;   // acortar no asigna
}
```
- Es O(n), no asigna nada y conserva el orden relativo de los vivos. La spec puede seguir prometiendo "orden de
  aparición".
- `splice` queda descartado porque devuelve un array (asigna), y el swap-remove porque rompe el orden.
- Lo único que se convierte en basura es el `Enemy` muerto: 1 objeto por baja, no por tick.
- **Punto de entrada en 0003**: `Run.damageEnemy(id: number, amount: number): EnemyDamageOutcome`, que devuelve
  `'missing' | 'ignored' | 'damaged' | 'killed'`:
  - Busca el enemigo por `id` (O(n): solo lo usan los tests en este change).
  - Con la partida terminada devuelve `'ignored'` sin cambiar nada (spec `run-state`).
  - Si `amount` no es finito o es ≤ 0, lanza `RangeError`: es un error de programación, con la misma política que
    `Vector2.of`.
  - Si el golpe mata al enemigo, llama a `removeDead()` **en ese momento**, así que el snapshot siguiente ya no lo
    lista y deja de contar para `maxAlive`.
- **En 0004** las armas dañarán enemigos *dentro* del tick y llamarán a `removeDead()` una sola vez, en el paso 5 del
  tick (ver abajo). Ese paso ya está reservado en el orden, pero en 0003 no se ejecuta porque ningún tick mata
  enemigos: no se añade código muerto.

### Orden del tick (contrato de determinismo)
```mermaid
sequenceDiagram
  participant R as Run.tick(input)
  participant P as Player
  participant E as Enemy[] (vivos, orden de aparición)
  participant C as contactDamage
  participant D as WaveDirector
  R->>R: 0. status = over → return (nada cambia, tick incluido)
  R->>P: 1. move(input)
  R->>E: 2. chase(posición nueva del jugador)
  R->>C: 3. d = contactDamage(jugador, enemigos)
  R->>P: 4. d > 0 y canBeHitAt(n) → hit(d, n); vida 0 → status = over
  Note over R,E: 5. (0004) daño de armas + removeDead()
  R->>D: 6. solo si running: step(n, enemies.length)
  R->>R: 7. tickCount += 1
```
- n = `tickCount + 1`, el mismo valor que ya usa el director y que mostrará `snapshot.tick`.
- **El contacto va después de la persecución**: usa las posiciones finales del tick, como pide la spec. Los enemigos
  que nacen en el paso 6 no golpean en su tick de aparición (además nacen a ≥ 200 unidades).
- **Tick de la muerte**: cuenta (`tick` = n, `status = 'over'`), pero el director no corre. No hay spawns ni
  consumo de azar ese tick (spec "Sin spawns en el tick de la muerte").
- **Efecto en el determinismo**: el contacto no consume azar. Hasta la primera muerte del jugador, el flujo del
  `RandomGenerator` y los spawns solo cambian respecto a 0002 por el recorte de `maxBudget` (ver director). Desde la
  muerte no se consume nada más. Los tests de determinismo comparan dos ejecuciones, no valores fijos, así que
  siguen siendo válidos sin tocarlos.

### `WaveDirector`: presupuesto acumulado con máximo
```
step(n, alive, place):
  advanceSegment(n)
  budget60 = min(budget60 + segment.budgetPerSecond, maxBudget × 60)   // también en el tope
  if alive >= maxAlive: return                   // sin sortear: no consume azar
  gastar como en 0002 (sin cambios: pendiente, coste, aplazamiento)
```
- **En el tope** se acumula hasta el máximo **sin consumir azar**: el sorteo del pendiente solo ocurre dentro del
  bucle de gasto, como antes.
- **Se recorta antes de gastar** (spec "El máximo acota los spawns de un tick": 630/s con máximo 5 da 5). Así, el
  presupuesto nunca supera `maxBudget` y en un tick aparecen como mucho ⌊`maxBudget` / coste⌋ enemigos. Los
  escenarios de alto ritmo de 0002 declaran ahora un `maxBudget` suficiente: 20 para 1.000/s (16,7 por tick) y
  para 630/s (10,5 por tick).
- Con el contenido por defecto (como mucho 7/s, es decir, 0,117 por tick, y máximo 10) el recorte nunca limita el
  ritmo normal. Solo limita la ráfaga al abrirse huecos o tras un aplazamiento largo, que era el riesgo anotado en
  0002. El escenario "no se pierde al aplazar" (2 de presupuesto en el tick 121) queda por debajo de 10, así que
  se mantiene.
- Como `maxBudget ≥ maxCost`, lo guardado siempre alcanza para el pendiente más caro. Nunca se supera `maxAlive`,
  porque el bucle sigue limitado por `count < maxAlive`.
- Unidades × 60 como en 0002: `maxBudget × 60` es exacto con valores enteros.

### `RunSnapshot`
```ts
interface RunSnapshot {
  readonly tick: number;
  readonly status: RunStatus;                     // 'running' | 'over'
  readonly player: { x; y; radius; health; maxHealth; invulnerable: boolean };
  readonly enemies: readonly EnemySnapshot[];     // solo vivos, en orden de aparición (sin cambios)
}
interface EnemySnapshot { id; type; x; y; radius; readonly health: number }   // + vida actual
```
- Sigue congelado (el objeto raíz, `player`, el array y cada elemento).
- Coste: los mismos objetos por frame que en 0002 (raíz, `player`, array y uno por enemigo). Los campos nuevos
  son escalares.
- **La vida de cada enemigo sí se expone** (`health`): los escenarios "Daño que no mata", "Un golpe de un
  enemigo" y "Golpear al jugador no quita vida al enemigo" la observan desde fuera. Es un escalar más por enemigo,
  y en 0004 servirá para barras de vida. El render la ignora en 0003.
- Las bajas se ven porque el enemigo desaparece del array.

## Render: `EnemyLayer` asocia hueco ↔ `id`
- Con la compactación, todos los enemigos posteriores a una baja bajan un índice. Con asociación por índice, cada
  baja repintaría (`setRadius` + `setFillStyle`) a todos los enemigos de detrás si cambia el tipo del hueco.
  `setRadius` regenera la geometría del `Arc`. En 0004 habrá varias bajas por segundo.
- **Diseño** (sin asignaciones en régimen):
  - Estado preasignado en `create`:
    - `slots[capacity]`, cada hueco con `{sprite, id, type, visible, seen}`;
    - `free: Slot[]`, una pila con todos los huecos;
    - `byId: Map<number, Slot>`;
    - un contador `frame`.
  - `sync(enemies)` hace tres pasadas (orden implementado, ver ADR-0006):
    1. **Actualizar conocidos**: `frame++`. Para cada enemigo con `byId.get(id)`: `setPosition`, el repintado solo
       si cambia el tipo, la visibilidad y `slot.seen = frame`.
    2. **Liberar no vistos**: recorre `slots`. Los visibles con `seen ≠ frame` se ocultan, salen de `byId` y vuelven
       a `free`.
    3. **Asignar nuevos**: a cada enemigo sin hueco le da `free.pop()` y hace `byId.set(id, slot)`, y después lo
       pinta como en la pasada 1.
  - **Por qué liberar antes de asignar**: con `capacity = maxAlive`, en un mismo frame pueden convivir bajas y
    reposiciones (spec "Reposición tras bajas": 150 conocidos y 50 nuevos con 200 huecos). Si se asignara antes de
    liberar, la pila `free` estaría vacía y los 50 nuevos se quedarían sin sprite. La primera versión de este
    design, en dos pasadas, tenía ese defecto, y el test del apply lo detectó.
- Un enemigo conserva su sprite toda su vida, y una baja solo oculta un hueco. Las operaciones `pop`/`push` dentro
  de la capacidad ya reservada y las de `Map` con claves enteras no asignan en régimen.
- Si llegaran más enemigos que huecos (no debería pasar, porque `capacity = maxAlive`), los sobrantes no se
  pintan y no hay error.
- Tests con dobles:
  - una baja en medio no repinta a los demás (`restyles` sin cambios);
  - el hueco liberado se oculta y lo reutiliza el siguiente enemigo nuevo;
  - no se crean sprites tras `create`.
- `GameScene` no cambia: no hay HUD ni pantalla de derrota (0006). La partida "se congela" porque el núcleo deja
  de avanzar. El probe E2E expone ya `status` y `health` a través del snapshot.

## Rendimiento y GC (ADR-0003)
| Medida | Presupuesto | Estimación | Dónde |
|---|---|---|---|
| `Run.tick`, 200 vivos con contacto activo | ≤ 2 ms de media | ≈ 0,008 ms (0,0069 hoy + ~200 comparaciones) | `tests/bench/run.bench.ts` |
| `Run.snapshot()`, 200 vivos | ≤ 0,3 ms (informativo) | sin cambio apreciable | mismo bench |
| `removeDead` | — | O(n) por llamada, 0 asignaciones; solo con bajas | test unitario |
| `EnemyLayer.sync` | sin asignaciones; < 0,5 ms | igual que hoy | test con dobles |

- **Asignaciones nuevas por tick**: ninguna. `contactDamage` trabaja con escalares. `Player.hit` asigna un
  `Player` y un `Health` como mucho una vez cada N + 1 ticks.
- **El bench debe cambiar**: con el contenido por defecto, el jugador quieto muere antes de llegar a 200 vivos y
  `runAtCap()` no terminaría nunca, porque la partida se congela.
  - El bench usará el contenido por defecto con `player.maxHealth` sustituido por una vida muy grande (constante
    `BENCH_HEALTH = 1e9`, finita y válida).
  - Así mide 200 vivos **con el contacto calculado en cada tick** y golpes reales cada 31 ticks.
  - Además, `runAtCap` debe fallar con un error claro si la partida termina antes del tope, en lugar de quedarse
    en un bucle infinito.
  - El bench gana un segundo caso (spec "200 enemigos encima del jugador"): 200 `bug` colocados con `RunSetup` en
    el centro del jugador y `BENCH_HEALTH`. Al acabar se comprueba que `status` sigue en `'running'`.
- **Estimación del escenario de run-state "jugador quieto, contenido por defecto, semilla 7"**: el primer `bug`
  nace en el tick 60 sobre un borde, a 270–480 unidades, y llega al centro en 3–5 s. Allí se queda en contacto
  continuo y golpea cada 31 ticks con daño 5, así que hacen falta 20 golpes, unos 620 ticks. La muerte llega hacia
  el tick 1.000, muy por debajo de 36.000.
- El dato medido se anota en `verify-report.md` y en una sección "Aplicación (change 0003)" de ADR-0003 cuando se
  archive el change.

## Impacto en tests existentes
- `tests/support/builders.ts`:
  - `DEFAULT_ENEMY_TYPES` con `damage` y `health` del contenido.
  - `DEFAULT_WAVES.maxBudget = 10`.
  - `aRunConfig` acepta `maxHealth` e `invulnerabilityTicks` (por defecto 100 y 30).
  - `RawContent` y los tipos mutables crecen.
  - Constante `LONG_RUN_HEALTH` (p. ej. 1e9).
- `long-run.test.ts`: con vida por defecto, el jugador muere y nunca llegarían a nacer los 200 enemigos. Los
  escenarios de legalidad de spawns, arena y reproducibilidad usan `LONG_RUN_HEALTH`, porque prueban el
  spawn, no el daño. Los escenarios de "una partida sin defensa termina" y de 36.000 ticks tras terminar se añaden
  con la vida por defecto.
- `wave-director.test.ts`:
  - El `harness` acepta `maxBudget`.
  - "Se alcanza el tope" y "Varios spawns en un tick" pasan a usar `maxBudget` 20.
  - "El tope se mantiene, sin acumular ni consumir azar" pasa a "sin consumir azar".
  - Nuevos: "El máximo acota los spawns de un tick", huecos con el presupuesto en el máximo, y huecos sin
    presupuesto.
- `run.test.ts`: el snapshot del tick 0 incluye `status: 'running'`, `health`, `maxHealth` e
  `invulnerable: false`. Los `toEqual` sobre `snapshot().player` se ajustan.
- `content.test.ts`, `run-config.test.ts` y `enemy-catalog.test.ts`: un caso por campo nuevo inválido, más
  `maxBudget` < `maxCost`.
- `enemy-layer.test.ts`: los existentes siguen valiendo. Se añaden los de bajas (ver Render).
- `determinism.test.ts`, `loop.test.ts` y `run-enemies.test.ts`: sin cambios esperados. Los escenarios de
  persecución duran ≤ 60 ticks y el jugador recibe como mucho 2 golpes de 5, así que no muere.

## Seguridad y datos
- No hay entrada externa nueva: los campos nuevos de `content/*.json` son contenido versionado y validado con zod
  (campos estrictos).
- **Sin datos persistidos**: el snapshot no se guarda en ningún sitio. No cambia ningún formato de guardado,
  porque aún no existe.
- El probe `window.__sprint` (solo con `?e2e`) expone además `status` y la vida, que son de solo lectura y están
  congelados.

## Dependencias nuevas
Ninguna. Una librería de colisiones (p. ej. `detect-collisions`, o la física Arcade de Phaser) queda descartada,
porque comparar círculos son 3 líneas puras, y porque usar la física del motor sacaría la regla del núcleo
(ADR-0002).

## Estrategia de tests (pirámide)
| Nivel | Qué | Specs |
|---|---|---|
| Unit dominio | `Health` (recorte a 0, invariantes); `circlesOverlap` (tangencia, solape, d = 0); `contactDamage` (0 si nadie, máximo, sin depender del orden) | player-health |
| Unit dominio | `Player.hit` / `canBeHitAt` / `invulnerable` en los ticks frontera t, t + N − 1, t + N, t + N + 1 | player-health |
| Unit dominio | `Enemy.takeDamage`; `EnemyType`, `EnemyCatalog.maxCost`, `SpawnRules.maxBudget`, `buildRunRules` (campos y mensajes) | enemy-spawning |
| Unit dominio | `WaveDirector`: acumulación en el tope sin azar, recorte de lo guardado, ráfaga acotada, escenarios de 0002 intactos | enemy-spawning |
| Integración `Run` | Orden del tick, contacto, golpe único, *i-frames*, muerte, congelación (600 y 36.000 ticks), sin spawns en el tick de la muerte, `damageEnemy` (orden conservado, deja de perseguir y de contar en el tope, reposición), snapshot congelado | player-health, run-state, enemy-behavior, simulation-loop |
| Integración larga | `long-run.test.ts` (ver arriba) | enemy-spawning, run-state |
| Unit infraestructura | `parseRunConfig` por campo nuevo; `loadRunConfig()` válido; `EnemyLayer` con bajas | enemy-spawning, player-movement |
| E2E | `?e2e&seed=42` sin input: la vida del snapshot baja de 100 en ≤ 20 s, y sin errores. No se espera a `over` en E2E (con los valores provisionales tarda decenas de segundos); la congelación se prueba en unidad | player-health |
| Bench | `npm run bench` con `BENCH_HEALTH` | simulation-loop |

## Reglas de capas y pureza
- `domain/collision` y `domain/shared/Health` no importan nada fuera de `domain`. No hay azar nuevo ni reloj.
- Las únicas llamadas nuevas a `Math` son `Math.max` y `Math.min`, que son puras.
- `EnemyLayer` sigue sin importar el motor más allá de `import type`.
- Los guardarraíles no cambian (spec `architecture-guardrails` sin cambios).

## Alternativas descartadas
- **Swap-remove** para las bajas: es O(1), pero rompe el orden de aparición que promete la spec, y con asociación
  por índice forzaría repintados.
- **Marca `alive` con huecos reutilizables**: sin compactar, cada recorrido (persecución, contacto, snapshot,
  director) tendría que saltar muertos y contar los vivos aparte. Añade complejidad en cuatro sitios.
- **`filter` por tick**: asigna un array cada tick (ADR-0003).
- **Contador de *i-frames* decreciente por tick**: obliga a crear un `Player` nuevo o a mutar estado cada tick
  aunque no pase nada. El tick absoluto `invulnerableUntil` evita las dos cosas.
- **Invulnerabilidad en segundos**: `segundos × 60` puede no ser entero y la frontera dejaría de ser exacta.
- **Daño del primer enemigo en contacto**: dependería del orden de la lista, así que lo descarta la spec.
- **Saltar la detección mientras hay invulnerabilidad**: ahorra ~0,5 µs, pero el bench mediría el tick barato el
  97 % de las veces.
- **Acotar solo lo guardado al final del tick** (primera versión de este design): conservaba sin tocar los
  escenarios de alto ritmo de 0002. Se descarta para alinearse con la spec: "el presupuesto nunca vale más que
  `maxBudget`" es una invariante más simple de razonar y acota también la ráfaga dentro del tick.
- **`Run.damageEnemy` sin compactar al momento** (baja diferida al tick): el snapshot listaría enemigos muertos
  entre ticks, o habría que filtrarlos al copiar.
- **Asociación de sprites por índice** (la de 0002): es correcta, pero con bajas repinta en cascada.
- **Cola de eventos de dominio** (`PlayerDied`, `EnemyDied`): aplazada por la propuesta. `status` y
  `EnemyDamageOutcome` bastan en 0003.

## Riesgos
- **Partidas muy cortas** con los valores provisionales y sin armas (10 s de contacto continuo con `bug`). Es
  aceptable porque el balance fino llega con 0004 y 0006.
- **`damageEnemy` con búsqueda O(n) por `id`**: vale para tests. 0004 dañará por referencia dentro del tick.
- **E2E dependiente del ritmo real**: solo comprueba que la vida baja, con margen de tiempo amplio.
- **Golden values**: ningún test fija posiciones por semilla, así que el recorte de `maxBudget` no rompe
  expectativas fijas. Si en apply apareciera alguna, se actualiza documentándolo.

## Desviaciones aceptadas en el apply (verify-report)
- **`EnemyLayer.sync` en tres pasadas**: ver la sección Render y ADR-0006.
- **`EnemyCatalog.mostExpensive`**: el VO calcula una vez, en el constructor, el tipo más caro (congelado), y
  `maxCost` queda como getter derivado. Así el mensaje `MAX_BUDGET_BELOW_MAX_COST` puede nombrar el coste y el id
  (`…: 3 (memory-leak)`). Es una API pública mínima y está cubierta por test.
- **Vida del enemigo**: el campo privado se llama `life` y la API pública es el getter `hp`, porque TypeScript no
  admite un campo privado y un getter con el mismo nombre. La semántica es la del design.
- **`LONG_RUN_HEALTH` también en "Cambio de tramo"**: con la vida por defecto, el jugador quieto muere hacia el
  segundo 16 y el tramo 2 (segundo 30) no llegaría nunca. El test usa vida 1e9 para probar el spawn y no el daño.
  "Mezcla de tipos" (`long-run.test.ts`) también la usa. La spec delta de enemy-spawning debe recoger ese GIVEN
  (verify-report W1; corresponde al spec-writer).

## ADRs
- **ADR-0006 (nueva)**: bajas de entidades en el camino caliente con compactación estable en el sitio, y
  asociación de sprites por `id`. Es estructural porque 0004 (proyectiles) y 0005 (gemas) reutilizarán el mismo
  patrón.
- ADR-0003: al archivar se le añade la medición con colisiones, como en 0002.
