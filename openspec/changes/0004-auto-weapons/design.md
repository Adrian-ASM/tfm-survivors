# Design · 0004-auto-weapons

## Resumen
El núcleo gana un modelo genérico de arma (ADR-0007): cada `WeaponType` es dato validado (cadencia, daño, criterio
de objetivo y tipo de ataque como uniones discriminadas) y un servicio de dominio con estado, `Arsenal`, propiedad de
`Run` como el `WaveDirector`, mueve los proyectiles, resuelve sus impactos, dispara las armas cargadas y aplica los
pulsos. Todo ocurre **antes** del contacto y del director, con un único `removeDead()` por tick, así que un enemigo
muerto no golpea en su tick de muerte y su hueco se repone en ese mismo tick. Proyectiles y pulsos visibles viven en
pools preasignados (ADR-0003, ADR-0006); el snapshot los expone junto con un indicador de enemigo dañado y el estado
de carga de cada arma. La vista añade dos capas de sprites preasignados. `Run.damageEnemy` desaparece. Sin
dependencias nuevas ni datos persistidos.

## Decisiones de la propuesta y la spec que concreta este diseño
| Tema | Decisión de diseño |
|---|---|
| Modelo de arma | Uniones discriminadas `targeting.mode` / `attack.type` + `switch` exhaustivo + tabla de compatibilidad (ADR-0007) |
| Cadencia | Tick absoluto `readyAt` por arma (como `invulnerableUntil` en 0003): sin contador por tick. Empieza en 1 (cargada en el tick 1). Al disparar en T: `readyAt = T + cooldownTicks` |
| Retención de carga | Si no hay objetivo, o el tope de proyectiles está lleno, `readyAt` no cambia |
| Orden de las armas | El de `weapons.json`; Linter antes que Tests con el contenido por defecto |
| Distancia del criterio `nearest-in-range` | Entre centros, `d² ≤ range²` (inclusiva, spec "Límite exacto del alcance"); empate: el primero de la lista (comparación estricta `<`) |
| Criterio `any-in-radius` y área del pulso | El mismo predicado `circlesOverlap(jugador, radius, enemigo)` (estricto): el pulso siempre alcanza al enemigo que lo activó |
| Proyectil en su tick de creación | Ni se mueve ni colisiona (spec); se mueve y colisiona en T + 1 … T + `lifetimeTicks` |
| Plazas del tope | Los proyectiles se procesan y compactan **antes** de disparar: las plazas liberadas sirven en el mismo tick (spec "Tope lleno") |
| Destello de dañado y duración del pulso | Reglas del dominio con duración en contenido (`hitFlashTicks`, `attack.visualTicks`, según la spec). El snapshot expone booleanos y pulsos ya filtrados |
| `Run.damageEnemy` (S4) | Se elimina. Los tests provocan bajas con armas y fijan la vida inicial con `RunSetup.enemies[i].health` |
| Rejilla espacial | Fuera: fuerza bruta (decisión abierta 3) |

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `weapon/WeaponType.ts`: `WeaponTypeConfig`, `TargetingConfig`, `AttackConfig`, `WeaponType` (VO), mensajes, `ATTACK_TARGETING` | nueva | Invariantes por arma y compatibilidad. Congelado |
| domain | `weapon/WeaponLoadout.ts` (VO) | nueva | Armas en orden, ids únicos, `maxProjectiles`, `hitFlashTicks`, `pulseCapacity` |
| domain | `weapon/Weapon.ts` (entidad mutable interna) | nueva | `type`, `readyAt`; `isChargedAt(n)`, `fireAt(n)` |
| domain | `weapon/targeting.ts` (funciones puras) | nueva | `selectTarget(targeting, px, py, targets): number` (índice o −1), `nearestInRange`, `firstInRadius` |
| domain | `weapon/Projectile.ts` (entidad mutable, reutilizable) | nueva | `launch(...)`, `advance()`, `spent`; escalares `x, y, vx, vy` |
| domain | `weapon/PulseEcho.ts` (registro mutable, reutilizable) | nueva | Pulso visible: `weaponId`, `firedAt`, `x`, `y`, `radius`, `until` |
| domain | `weapon/Arsenal.ts` (servicio de dominio con estado, lo posee `Run`) | nueva | Pools de proyectiles y ecos, ids de proyectil, pasos de armas del tick |
| domain | `weapon/WeaponTarget.ts` (interfaz estructural) | nueva | `x, y, radius, alive, takeDamage(amount, tick)`; `Enemy` la cumple |
| domain | `enemy/Enemy.ts` | mod. | `takeDamage(amount, tick)` guarda `lastHitTick`; `damagedAt(k, flashTicks)`; vida inicial opcional en `spawn` |
| domain | `run/Run.ts` | mod. | Nuevo orden del tick, `Arsenal`, snapshot ampliado; **fuera** `damageEnemy` y `EnemyDamageOutcome`; `RunSetup.enemies[i].health` |
| domain | `run/RunConfig.ts` | mod. | `RunConfig.weapons`, `RunRules.loadout`, `WeaponLoadout.create` dentro de `buildRunRules` |
| domain | `run/RunSnapshot.ts` | mod. | `projectiles`, `pulses`, `weapons`; `EnemySnapshot.damaged` |
| domain | `collision/contact.ts` | sin cambios | `circlesOverlap` se reutiliza; se actualiza el JSDoc que prometía rejilla en 0004 |
| application | `TickRun`, `StartRun`, `FixedStepLoop` | sin cambios | El tick sigue siendo `run.tick(input)` |
| infrastructure | `content/schemas.ts`: `WeaponsSchema` | mod. | `z.discriminatedUnion`, `strictObject`, `.min(1)` en `weapons` |
| infrastructure | `content/loadRunConfig.ts` | mod. | Importa `content/weapons.json`; `parseRunConfig` gana `weapons` |
| infrastructure | `phaser/SlotPool.ts` | nueva | Asociación hueco ↔ `id` extraída de `EnemyLayer` (tres pasadas, ADR-0006) |
| infrastructure | `phaser/EnemyLayer.ts` | mod. | Usa `SlotPool`; destello con color de vista `FLASH_COLOR` cuando `damaged` |
| infrastructure | `phaser/ProjectileLayer.ts` | nueva | Pool de `maxProjectiles` círculos sobre `SlotPool` |
| infrastructure | `phaser/PulseLayer.ts` | nueva | Pool de `pulseCapacity` anillos (`Arc` con trazo); alfa decreciente por edad |
| infrastructure | `phaser/GameScene.ts` | mod. | Recibe `SceneCapacity { enemies, projectiles, pulses }`; pinta las tres capas |
| composition | `main.ts` | mod. | Calcula `SceneCapacity` desde el `RunConfig` validado (`pulseCapacity` del dominio) |
| content | `content/weapons.json` | nueva | Ver abajo |

No hay puertos nuevos: no existen dos implementaciones previsibles de ninguna pieza.

## Contenido y validación

```jsonc
// content/weapons.json (valores provisionales de la spec)
{
  "maxProjectiles": 32,
  "hitFlashTicks": 4,
  "weapons": [
    { "id": "linter", "cooldownTicks": 30, "damage": 6,
      "targeting": { "mode": "nearest-in-range", "range": 400 },
      "attack": { "type": "projectile", "speed": 480, "radius": 4, "lifetimeTicks": 60 } },
    { "id": "tests", "cooldownTicks": 90, "damage": 4,
      "targeting": { "mode": "any-in-radius", "radius": 90 },
      "attack": { "type": "pulse", "visualTicks": 8 } }
  ]
}
```

```ts
// domain/weapon/WeaponType.ts
type TargetingConfig =
  | { readonly mode: 'nearest-in-range'; readonly range: number }
  | { readonly mode: 'any-in-radius'; readonly radius: number };
type AttackConfig =
  | { readonly type: 'projectile'; readonly speed: number; readonly radius: number;
      readonly lifetimeTicks: number }
  | { readonly type: 'pulse'; readonly visualTicks: number };
interface WeaponTypeConfig { readonly id: string; readonly cooldownTicks: number; readonly damage: number;
                             readonly targeting: TargetingConfig; readonly attack: AttackConfig }
/** Qué criterios admite cada ataque. El tipo mapeado obliga a dar entrada a cada ataque nuevo. */
export const ATTACK_TARGETING: { readonly [K in AttackConfig['type']]: readonly TargetingConfig['mode'][] } =
  { projectile: ['nearest-in-range'], pulse: ['any-in-radius'] };

// domain/run/RunConfig.ts
interface RunConfig { /* … */ readonly weapons: WeaponsConfig }
interface WeaponsConfig { readonly maxProjectiles: number; readonly hitFlashTicks: number;
                          readonly weapons: readonly WeaponTypeConfig[] }
interface RunRules { /* … */ readonly loadout: WeaponLoadout }
```

| Campo | Regla | Dónde |
|---|---|---|
| `weapons.weapons.i.id` | texto no vacío; único | zod (`min(1)`) + `WeaponLoadout.create` (`WEAPON_ID_MUST_BE_UNIQUE`) |
| `cooldownTicks`, `damage` | entero ≥ 1 | `WeaponType.create` + zod (`Count`) |
| `targeting.range`, `targeting.radius` | finito > 0 | `WeaponType.create` + zod |
| `attack.speed`, `attack.radius` (proyectil) | finito > 0 | `WeaponType.create` + zod |
| `attack.lifetimeTicks`, `attack.visualTicks` | entero ≥ 1 | `WeaponType.create` + zod |
| `targeting.mode` ↔ `attack.type` | según `ATTACK_TARGETING` (`WEAPON_TARGETING_INCOMPATIBLE`, con ambos nombres) | `WeaponType.create` (regla cruzada; zod la recoge por `superRefine`) |
| `maxProjectiles`, `hitFlashTicks` | entero ≥ 1 | `WeaponLoadout.create` + zod |
| `weapons.weapons` | ≥ 1 arma (`WEAPONS_REQUIRED`) | **solo zod** (ver abajo) |
| campos y variantes desconocidos | rechazo | zod: `strictObject` en cada variante; `discriminatedUnion` rechaza `mode`/`type` no admitidos |

- Mensajes como constantes de dominio reutilizadas por zod (patrón 0002/0003). Rutas de error con índice:
  `weapons.weapons.1.attack.lifetimeTicks`.
- **Lista vacía**: el contenido la rechaza (spec), pero `buildRunRules` la acepta. Así los tests de dominio de
  0001–0003 que prueban spawn, persecución o contacto aislados construyen un `RunConfig` sin armas (`NO_WEAPONS`)
  sin trucos de alcance. Es una regla de forma del fichero, no una invariante del agregado.
- `damage ≥ vida de un enemigo` es válido: no hay regla cruzada con el catálogo (spec).
- `pulseCapacity(loadout)` = Σ sobre armas de pulso de ⌈`visualTicks` / `cooldownTicks`⌉: cota exacta de pulsos
  visibles a la vez (con el contenido por defecto, 1). Lo usan `Arsenal` y la composición.

## Simulación

### Orden del tick (contrato de determinismo)
```mermaid
sequenceDiagram
  participant R as Run.tick(input)
  participant A as Arsenal
  participant E as Enemy[] (orden de aparición)
  participant D as WaveDirector
  R->>R: 0. status = over → return
  R->>R: 1. jugador se mueve
  R->>E: 2. persecución hacia la nueva posición
  R->>A: 3. step(n, px, py, enemies)
  Note over A: 3a. ecos de pulso caducados (n ≥ until) → pool
  Note over A: 3b. cada proyectil (orden de creación): advance; primer enemigo vivo solapado → takeDamage, spent; si no, n ≥ firedAt + lifetime → spent
  Note over A: 3c. compactar proyectiles (spent → pool libre)
  Note over A: 3d. cada arma (orden de weapons.json) cargada: selectTarget; sin objetivo o tope lleno → retiene; si no, ataca y readyAt = n + cooldown
  A-->>R: bajas del tick (número)
  R->>R: 4. bajas > 0 → removeDead() (una vez)
  R->>R: 5. contacto (sin los muertos); vida 0 → over
  R->>D: 6. solo si sigue en curso: step(n, enemies.length)
  R->>R: 7. tickCount = n
```
- **Armas antes del contacto**: un enemigo muerto en el paso 3 ya no está en la lista en el paso 5 (spec "La baja
  impide el contacto en ese tick"). **Antes del director**: `enemies.length` ya descuenta las bajas y el hueco se
  repone en el mismo tick (spec "Reposición en el mismo tick").
- Los enemigos que nacen en el paso 6 no reciben disparos en su tick de aparición (como no golpean, 0003).
- **Azar**: las armas no consumen azar. Las partidas de una semilla cambian respecto a 0003 solo porque las bajas
  cambian `alive` y, con ello, cuándo sortea el director. Los tests de determinismo comparan ejecuciones, no valores
  fijos.
- **Tick de la muerte**: las armas ya han actuado; el snapshot muestra sus proyectiles y pulsos y luego se congela.
  Con `over` no se ejecuta ningún paso (spec run-state, 600 ticks con snapshot idéntico).

### `Weapon` y cadencia
- `readyAt` empieza en 0. `isChargedAt(n)` ⇔ `n ≥ readyAt`. `fireAt(n)` ⇔ `readyAt = n + cooldownTicks`.
- Cadencia del escenario "La retención reinicia la cadencia": dispara en 1 (`readyAt` 31), sin objetivo de 31 a 40,
  dispara en 41 (`readyAt` 71), 71, 101.
- El snapshot del tick k marca `ready = k ≥ readyAt` (spec "Carga de las armas en el snapshot": Linter disparado en
  1 figura no cargado en 1–30 y cargado desde 31; Tests desde 91). Antes del primer tick (k = 0, `readyAt` 0):
  ambas cargadas.

### Criterios de objetivo (`targeting.ts`)
```ts
/** Índice del enemigo que activa el disparo, o −1. Ignora los muertos (vida 0 aún no compactados). */
export function selectTarget(t: TargetingConfig, px: number, py: number,
                             targets: readonly WeaponTarget[]): number {
  switch (t.mode) {
    case 'nearest-in-range': return nearestInRange(px, py, t.range, targets);
    case 'any-in-radius': return firstInRadius(px, py, t.radius, targets);
    default: return assertNever(t);
  }
}
```
- `nearestInRange`: bucle indexado, `d²` sin raíz, acepta `d² ≤ range²` y sustituye solo con `d² < mejor`: el empate
  se queda con el primero de la lista. O(E), sin asignar.
- `firstInRadius`: primer `i` vivo con `circlesOverlap(px, py, radius, …)`; salida anticipada. O(E) peor caso.
- Con un arma cargada y sin objetivo, el barrido se repite cada tick (retención). Coste acotado: O(E) por arma.

### Ataques
- **`projectile`**: si `projectiles.length ≥ maxProjectiles`, retiene. Si no, toma un `Projectile` del pool libre y
  lo lanza desde (px, py) con `id = nextProjectileId++`, el `radius` y `damage` del arma, `firedAt = n` y velocidad
  por tick `(dx/d, dy/d) × speed × TICK_SECONDS` hacia la posición del objetivo; con d = 0, dirección (1, 0). No se
  mueve ni colisiona en el tick n (3b ya pasó). No está limitado por la arena: lo acota `lifetimeTicks`.
- **`pulse`**: recorre los enemigos y aplica `takeDamage(damage, n)` a cada vivo que solape el círculo del criterio,
  y nada más. Toma un `PulseEcho` del pool con `firedAt = n`, centro (px, py), `radius` del criterio y
  `until = n + visualTicks`. No crea entidades que dañen después.
- Un arma de pulso y otra de proyectil en el mismo tick: el orden de la lista decide quién golpea antes; un enemigo
  que llega a 0 deja de ser objetivo y de recibir impactos en ese tick (comprobación `alive`).

### Proyectiles: pool y bajas (ADR-0003, ADR-0006)
- `Arsenal` preasigna `maxProjectiles` objetos `Projectile` en `Run.start` (camino frío) en una pila `free`. La lista
  `active` se compacta en el sitio en 3c (copia hacia delante los no gastados y devuelve los gastados a `free`;
  `length = w`). Orden de creación conservado; cero asignaciones por disparo o baja de proyectil.
- `id` nuevo en cada lanzamiento aunque el objeto se reutilice: la vista asocia sprites por `id` (ADR-0006).
- Cronología con `lifetimeTicks` L = 60 y 8 px/tick: aparece en los snapshots T … T + 59 (en T + 59 en
  480 + 59 × 8 = 952) y en el tick T + 60 avanza, comprueba impacto y desaparece (spec "Agota su vida").
- Impacto: primer enemigo vivo de la lista con `circlesOverlap` estricto; el proyectil queda gastado. Varios
  proyectiles sobre el mismo bug en un tick: los dos primeros lo matan; el tercero no lo ve vivo y sigue en vuelo.
- `PulseEcho` sigue el mismo patrón con capacidad `pulseCapacity`; los ecos caducados salen en 3a, así que el pulso
  de T se ve en T … T + `visualTicks` − 1.

### `Enemy`
- `takeDamage(amount, tick)`: recorta a 0, guarda `lastHitTick = tick` y devuelve si mata. Sigue sin hacer nada
  sobre un muerto.
- `damagedAt(k, flashTicks)` ⇔ `lastHitTick > 0 && k − lastHitTick < flashTicks` (`lastHitTick` 0 = nunca; los
  ticks empiezan en 1). Spec "Duración del destello" y "Destello renovado".
- `Enemy.spawn(id, type, x, y, arena, health = type.health)`: vida inicial opcional, solo desde `RunSetup`.

### `Run`
- `RunSetup.enemies[i].health?`: finito, 0 < h ≤ `type.health` (`SETUP_HEALTH_OUT_OF_RANGE`). Lo necesitan los
  escenarios de la spec ("un bug con vida 4") y sustituye a `damageEnemy` en los tests de bajas.
- `damageEnemy` y `EnemyDamageOutcome` se eliminan (decisión abierta 2). El JSDoc de clase y ADR-0006 citan el
  nuevo orden; ADR-0006 se completa al archivar con la sección "Aplicación (0004)".
- `removeDead()` sigue igual, llamado solo si el paso 3 informa de bajas.

### `RunSnapshot`
```ts
interface EnemySnapshot { id; type; x; y; radius; health; readonly damaged: boolean }
interface ProjectileSnapshot { readonly id: number; readonly x: number; readonly y: number;
                               readonly radius: number }
interface PulseSnapshot { readonly weapon: string; readonly firedAt: number; readonly x: number;
                          readonly y: number; readonly radius: number }
interface WeaponSnapshot { readonly id: string; readonly ready: boolean }
interface RunSnapshot { /* … */ readonly projectiles: readonly ProjectileSnapshot[];  // orden de creación
                        readonly pulses: readonly PulseSnapshot[];      // visibles, orden de disparo
                        readonly weapons: readonly WeaponSnapshot[] }   // orden de weapons.json
```
- Todo congelado (raíz, arrays y elementos), como en 0003. `firedAt` permite a la vista desvanecer el anillo.
- Los escenarios "creó proyectiles en los ticks …" se comprueban con ids nuevos entre snapshots consecutivos; los
  de pulso, con `pulses[i].firedAt === snapshot.tick`.

## Render
- **`SlotPool<T extends { id: number }>`** (infraestructura, sin Phaser): las tres pasadas de `EnemyLayer.sync`
  (actualizar conocidos, liberar no vistos, asignar nuevos) con `Map<id, slot>`, pila libre y marca `seen`. Se
  extrae para no duplicarla en proyectiles; los tests actuales de `enemy-layer.test.ts` son la red de seguridad.
- **`EnemyLayer`**: además del tipo, el hueco recuerda `flash`; repinta (`setFillStyle`) solo si cambia el tipo o
  `damaged`. `FLASH_COLOR` es constante de vista (como `PLAYER_COLOR`).
- **`ProjectileLayer`**: capacidad `maxProjectiles`, un color fijo, `setRadius` solo al ocupar un hueco.
- **`PulseLayer`**: `pulseCapacity` anillos `Arc` sin relleno y con trazo, asignados por índice (sin `id`: son
  efímeros y no se mueven). Visible si está en el snapshot; alfa `1 − (tick − firedAt) / visualTicks` mediante una
  función pura `pulseAlpha` (probada en Node como `playerBlink`).
- **Orden de creación en `GameScene.create`**: anillos, enemigos, proyectiles y jugador (encima de todo). Sin
  objetos del motor por frame.
- **Probe E2E**: sin cambios de código; el snapshot ya lleva `projectiles` y `pulses`. La E2E con `?e2e&seed=7`
  sondea hasta ver ≥ 1 proyectil y detecta una baja como un `id` de enemigo visto antes que deja de estar en la lista
  con la partida en curso (solo las armas dan de baja).

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. `z.discriminatedUnion` ya está en zod 4.6.7 | Física Arcade de Phaser para proyectiles: sacaría la regla del núcleo (ADR-0002) |

## Rendimiento y seguridad
- **Presupuesto**: `Run.tick` ≤ 2 ms de media en el peor caso. Estimación con 200 enemigos y 32 proyectiles:
  3b ≤ 32 × 200 = 6.400 comparaciones con cuadrados, 3d ≤ 2 barridos O(200) y un pulso O(200), en total unas
  7.000 operaciones simples: del orden de 0,02–0,05 ms sobre los 0,008 ms de 0003. Margen > 40 veces. Sin rejilla.
- **Asignaciones**: cero por tick en régimen (pools de proyectiles y ecos, `readyAt` absoluto, despacho por `switch`,
  escalares). `snapshot()` (una vez por frame) añade como mucho 32 + `pulseCapacity` + nº de armas objetos
  congelados a los ~200 de S5: se vigila con el bench, sin cambiar el diseño.
- **Bench** (`tests/bench/run.bench.ts`), caso nuevo de peor caso: 200 enemigos colocados con `RunSetup` en el
  perímetro de la arena, de un tipo de bench lento (velocidad mínima) y con vida 1e9, `BENCH_HEALTH`, y armas de
  bench: proyectil con `cooldownTicks` 1 y `range` mayor que la diagonal (el tope de 32 se llena: vuelo ≥ 32 ticks a
  ≥ 270 px) y pulso con `cooldownTicks` 1 y radio que cubre toda la arena (200 impactos por tick). El bench comprueba
  que hay 32 proyectiles vivos y la partida sigue en curso. Los casos de 0003 pasan a usar el contenido por defecto
  con armas; `runAtCap` mantiene su error si no llega al tope (con armas, el tope puede tardar más o no llegar:
  si no llega en 36.000 ticks se usa la vida 1e9 también para los enemigos del bench).
- **Entradas externas**: solo `content/weapons.json`, versionado y validado con zod estricto antes del dominio. Sin
  datos persistidos ni formatos de guardado. El probe `window.__sprint` (solo `?e2e`) expone datos congelados.

## Impacto en tests existentes
- `tests/support/builders.ts`: `NO_WEAPONS` (`{ maxProjectiles: 32, hitFlashTicks: 4, weapons: [] }`) por defecto en
  `aRunConfig`/`aContactConfig`, para que los escenarios de 0001–0003 sigan aislados; `DEFAULT_WEAPONS` (el
  contenido) y `withWeapons(config, …)`. `rawContent()` lleva `DEFAULT_WEAPONS` (el fichero exige ≥ 1).
- `run-removal.test.ts`: reescrito con `RunSetup.health` + un arma de pulso de prueba (p. ej. vida 1 en a3 y a7 y
  vida completa en el resto) en lugar de `damageEnemy`.
- `determinism.test.ts`, `long-run.test.ts`: casos nuevos con `DEFAULT_WEAPONS`; los existentes siguen como están.
- `content.test.ts`, `run-config.test.ts`: un caso por regla de la tabla de validación.
- E2E `enemies.spec.ts` "la vida baja en ≤ 20 s": pasa a la spec `player-health` "Primer golpe en el navegador"
  (≤ 60 s). Se mide en el núcleo al principio del apply; si no se cumple, se para y se vuelve a la spec.

## Riesgos
- Escenarios largos heredados con el contenido por defecto: las deltas ya retiran "Una partida sin defensa
  termina" y ajustan "Enemigos en el snapshot"; el resto se revisa en apply contra el contenido con armas.
- Balance: con Linter + Tests el jugador quieto quizá sobreviva mucho; se mide en apply, no se ajusta en 0004.

## Contraste con las specs delta
Contrastado con `auto-weapons`, `simulation-loop`, `run-state`, `enemy-spawning` y `enemy-behavior`: orden del
tick, sub-orden de armas, tope con plazas liberadas en el mismo tick, alcance inclusivo, pulso estricto, primer
enemigo de la lista, sin azar y congelado al terminar coinciden con este diseño. Tras la segunda revisión de las
specs quedan resueltas las discrepancias de la primera versión:
- `snapshot.weapons[{ id, ready }]` está en `simulation-loop` ("Carga de las armas en el snapshot"); para cumplir
  "no cargada de 1 a 30, cargada desde 31" y "ambas cargadas antes del primer tick", `readyAt` empieza en 0 y
  `ready = k ≥ readyAt` (ver Cadencia).
- Los pulsos llevan `weapon` y `firedAt` ("Pulso identificado en el snapshot").
- La partida sin armas es válida en el dominio (`NO_WEAPONS`) y el fichero exige ≥ 1 arma; los escenarios de daño
  usan "vida inicial N + un arma con daño d" (`RunSetup.enemies[i].health` + armas de prueba).
- El E2E de vida de 0003 se sustituye por `player-health` "Contacto observable con las armas activas" (semilla 42,
  primer golpe ≤ 3.600 ticks en el núcleo y ≤ 60 s en E2E). **Sin medir**: se mide al principio del apply; si no
  se cumple, es un hallazgo de equilibrio que vuelve a la spec, no un test relajado.

Sin discrepancias abiertas.

## ADRs
- **ADR-0007 (nueva)**: `docs/adr/0007-modelo-generico-de-armas.md`, el modelo de arma con uniones discriminadas
  en contenido.
- ADR-0006 y ADR-0003: al archivar, sección "Aplicación (0004)" (pools de proyectiles y ecos, medición del bench).
