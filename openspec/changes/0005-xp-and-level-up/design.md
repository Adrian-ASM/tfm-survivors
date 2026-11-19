# Design · 0005-xp-and-level-up

## Resumen
El agregado `Run` gana tres piezas de dominio que posee como al `Arsenal` y al `WaveDirector`: un campo de gemas
(`GemField`, pool preasignado de `maxGems` con compactación estable), la experiencia del jugador (`Experience`, nivel,
XP y subidas pendientes) y el estado de las mejoras (`UpgradeBoard`, niveles por mejora y oferta abierta). Las bajas
**no cambian la firma de `Arsenal.step`**: los enemigos muertos siguen en la lista con su posición y su tipo hasta el
`removeDead()` del tick, y es esa compactación la que suelta una gema por cada muerto, en orden de la lista y sin
asignar. Las mejoras son niveles; las estadísticas efectivas se derivan en frío desde la base de contenido
(ADR-0008). `RunStatus` gana `'choosing'`: con una oferta abierta `tick()` no hace nada y el bucle de paso fijo
descarta el tiempo acumulado. Un caso de uso `ChooseUpgrade` aplica la elección por índice con `Result`. La vista
añade una capa de gemas, una barra de XP y un overlay de cartas, todo preasignado. Sin dependencias nuevas.

## Decisiones de la propuesta y la spec que concreta este diseño
| Tema | Decisión de diseño |
|---|---|
| Quién murió y dónde | `Run.removeDead()` ya recorre la lista: por cada enemigo con `alive === false` llama a `gems.drop(e.x, e.y, e.type.xp)` antes de descartarlo. `Arsenal.step` sigue devolviendo el número de bajas (solo decide si compactar) |
| Orden de las gemas nuevas | Orden de la lista de enemigos (spec xp-gems "Varias bajas en el mismo tick"). Ids de gema: contador desde 0, nunca reutilizado |
| Tope lleno | `active.length === maxGems` ⇒ no se crea gema; `active[0].value += xp` (la más antigua en el suelo: la compactación estable conserva el orden de creación) |
| Gema en su tick de suelta | **Participa en el paso de gemas de ese mismo tick** (spec xp-gems, "Gema de una baja junto al jugador"): puede atraerse, moverse y recogerse |
| Orden del tick | El de la spec simulation-loop: armas (+ bajas y suelta) → **contacto** (la muerte corta el tick) → **gemas** → director → apertura de oferta. Ver "Orden del tick" |
| Imán | Distancia entre centros al jugador ya movido `d² ≤ pickupRadius²` (inclusiva) ⇒ `attracted = true` hasta recogerse. Una atraída avanza `magnetSpeed / 60` hacia el jugador **en ese mismo tick**, sin sobrepasarlo |
| Recogida | Tras el imán, `circlesOverlap(gema, jugador)` (estricto: distancia < 16 + 5), atraída o no ⇒ desaparece y suma su XP en ese tick |
| XP del tick | Suma de las gemas recogidas aplicada una vez a `Experience.gain(total)`: idéntico a aplicarlas una a una porque la curva solo depende del total |
| Curva | `toNext(n) = baseXp + xpGrowth · (n − 1)`, enteros. `gain` arrastra el sobrante y cuenta todas las subidas en un bucle |
| Subidas pendientes | `pendingLevelUps` **incluye la de la oferta abierta** (spec leveling: "2 subidas pendientes y la primera oferta abierta"). Baja en 1 al elegir; se pone a 0 si no queda ninguna mejora disponible. Se expone en el snapshot |
| Nivel en el snapshot | Sube en cuanto se alcanza el umbral, aunque la oferta esté pendiente (spec "Una gema que da dos niveles") |
| Punto de azar de la oferta | **Último paso del tick**, después del director, solo si la partida sigue en curso. Las ofertas encoladas se abren **al elegir**, sin tick de por medio. Elecciones = input del determinismo |
| Sorteo | Fisher–Yates parcial sobre los índices disponibles (en orden del catálogo) en un array de trabajo preasignado: `k = min(3, m)` extracciones, `j = i + ⌊random.next() · (m − i)⌋`. Consume exactamente `k` valores (también con `m < 3`). El orden de la oferta es el de extracción |
| Tamaño de la oferta | Constante del dominio `OFFER_SIZE = 3` (regla del juego "1 de 3" que la spec fija como "exactamente 3"; no es un número de equilibrio, así que no va a contenido) |
| 0 disponibles | Las subidas se registran (nivel ya subido), `pendingLevelUps = 0`, sin oferta, sin pausa y sin consumir azar |
| Muerte en el tick | El contacto corta el tick: no hay paso de gemas, director ni oferta. Las gemas soltadas en el paso de armas de ese tick sí quedan en el suelo (spec run-state) |
| Congelado | `tick()` sale si `status !== 'running'`. `TickRun` no avanza el bucle con la partida pausada o terminada y pone el acumulador a 0; si un tick abre la oferta a mitad de frame, el bucle corta y descarta el resto |
| Mejoras | Niveles como fuente de verdad; `WeaponType` / `PlayerRules` efectivos derivados desde la base en cada elección y validados por las mismas fábricas (ADR-0008) |
| Rango a nivel máximo | Se valida la **build de peor caso**: `base + Σ min(0, perLevel · maxLevel)` por estadística. Todas las estadísticas solo tienen cota inferior, así que si el peor caso es válido lo es cualquier combinación alcanzable, incluida "todas al máximo" que pide la spec |
| Cadencia mejorada | Se cambia el tipo del `Weapon`; `readyAt` no se toca: el nuevo intervalo rige desde el siguiente disparo (spec "Mejora de cadencia a mitad de recarga": 1, 31, 57, 83) |
| Proyectil en vuelo / pulso visible | El proyectil conserva el daño que copió en `launch`; el `PulseEcho` conserva el radio con que se disparó. Ninguno lee el tipo del arma después |
| Vida máxima | `Health.raise(d)`: `max += d`, `current += d`. Con `d > 0` (todo el catálogo por defecto) nunca supera el máximo. Si un contenido usara `d < 0` (la spec lo permite: `perLevel ≠ 0`), `current` se recorta a `[1, max]`: una elección no puede matar fuera de un tick |
| Elección | `Run.chooseUpgrade(index): Result<void, UpgradeChoiceError>`; sin oferta (en curso o terminada) ⇒ `no-offer`; índice no entero o fuera de `0..k−1` ⇒ `choice-out-of-range`. Sin efectos ni azar en ambos casos |

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `progression/XpCurve.ts` (VO) | nueva | `baseXp` entero ≥ 1, `xpGrowth` entero ≥ 0; `toNext(level)` |
| domain | `progression/Experience.ts` (entidad mutable interna a `Run`) | nueva | `level` (desde 1), `xp`, `pendingLevelUps`; `gain(amount)`, `resolveOne()`, `clearPending()`. Escalares |
| domain | `progression/XpGem.ts` (entidad mutable reutilizable) | nueva | `id, x, y, value, attracted, collected`; `set(...)`, `pull(px, py, step)` |
| domain | `progression/GemRules.ts` (VO) | nueva | `gemRadius` > 0, `magnetSpeed` > 0, `maxGems` entero ≥ 1 |
| domain | `progression/GemField.ts` (servicio de dominio con estado, lo posee `Run`) | nueva | Pool de `maxGems`, lista activa en orden de creación, pila libre, `nextGemId`; `drop(x, y, xp)`, `step(px, py, playerRadius, pickupRadius): number` (XP recogida), `gems` (vista de solo lectura) |
| domain | `upgrade/UpgradeType.ts` (VO + config + mensajes) | nueva | `id, name, description, target, stat, perLevel, maxLevel`; `UpgradeTarget` = `{ kind: 'weapon'; weapon }` \| `{ kind: 'player' }`; `WEAPON_STATS`, `PLAYER_STATS`, `TARGETING_STAT` |
| domain | `upgrade/UpgradeCatalog.ts` (VO) | nueva | Orden del contenido; reglas cruzadas (ver Contenido); `worstCaseWeapons(loadout)`, `worstCasePlayer(rules)` |
| domain | `upgrade/upgradeStats.ts` (funciones puras) | nueva | `upgradedWeapon(base, catalog, levels): WeaponTypeConfig`, `upgradedPlayer(base, catalog, levels): PlayerRules`. Siempre desde la base |
| domain | `upgrade/UpgradeBoard.ts` (servicio de dominio con estado, lo posee `Run`) | nueva | `levels: number[]` por índice del catálogo; oferta (array reutilizado de ≤ 3); array de trabajo; `open(random): boolean`, `pick(index): Result<UpgradeType, UpgradeChoiceError>`, `isOpen`, `OFFER_SIZE` |
| domain | `upgrade/UpgradeChoiceError.ts` | nueva | `{ code: 'no-offer' } \| { code: 'choice-out-of-range'; index; size }` |
| domain | `enemy/EnemyType.ts` | mod. | Campo `xp` (entero ≥ 1) y su mensaje |
| domain | `shared/Health.ts` | mod. | `raise(amount)` |
| domain | `player/Player.ts` | mod. | `pickupRadius` en `PlayerRules`; `withRules(rules, maxHealthGain)` devuelve un `Player` nuevo (camino frío) conservando posición e invulnerabilidad |
| domain | `weapon/Weapon.ts` | mod. | `type` con getter y `retune(type)` sin tocar `readyAt` |
| domain | `weapon/Arsenal.ts` | mod. | `retune(weaponId, type)`. **`step` no cambia de firma**; `weapon.type.*` ya es el tipo efectivo |
| domain | `run/RunStatus.ts` | mod. | `'running' \| 'choosing' \| 'over'` |
| domain | `run/RunConfig.ts` | mod. | `RunConfig.progression`, `RunConfig.upgrades`, `player.pickupRadius`, `enemies.types[].xp`; `RunRules.curve`, `gems`, `upgrades`, `pulseCapacity` (de la build de peor caso) |
| domain | `run/Run.ts` | mod. | Posee `GemField`, `Experience`, `UpgradeBoard`; orden del tick; `removeDead` suelta gemas; `chooseUpgrade`; `RunSetup.gems?` y `RunSetup.experience?` (tests); snapshot ampliado |
| domain | `run/RunSnapshot.ts` | mod. | `gems`, `progression`, `offer`, `upgrades` (ver Snapshot) |
| application | `FixedStepLoop.ts` | mod. | `step: () => boolean` (false ⇒ cortar y acumulador a 0); `reset()` |
| application | `TickRun.ts` | mod. | No avanza con `status !== 'running'` y resetea el bucle |
| application | `ChooseUpgrade.ts` | nueva | `execute(index): Result<RunSnapshot, UpgradeChoiceError>` |
| application | `StartRun.ts` | mod. | Devuelve `{ tickRun, chooseUpgrade }` sobre la misma `Run` |
| infrastructure | `content/schemas.ts` | mod. | `xp` en `EnemiesSchema`, `pickupRadius` en `PlayerSchema`, `ProgressionSchema`, `UpgradesSchema` |
| infrastructure | `content/loadRunConfig.ts` | mod. | Importa `progression.json` y `upgrades.json`; `parseRunConfig` gana ambos |
| infrastructure | `phaser/GemLayer.ts` | nueva | `SlotPool` con capacidad `maxGems`, círculos de un color, `setRadius` solo al ocupar |
| infrastructure | `phaser/XpBar.ts` + `xpBarFill.ts` (pura) | nueva | Fondo + relleno (`Rectangle`) y `Text` de nivel; repinta solo si cambian valores |
| infrastructure | `phaser/UpgradeOverlay.ts` + `cardLayout.ts` (pura) | nueva | Velo + 3 cartas preasignadas (rectángulo interactivo + textos); se rellena solo cuando cambia la oferta; guarda el índice clicado |
| infrastructure | `phaser/ChoiceKeys.ts` | nueva | Teclas 1–3 (fila y teclado numérico) con `JustDown` → índice o −1 |
| infrastructure | `phaser/GameScene.ts` | mod. | Capas nuevas, orden de pintado, elección en `update` |
| composition | `main.ts` | mod. | `SceneCapacity` gana `gems`; `pulses` sale de `rules.pulseCapacity`; pasa `chooseUpgrade` a la escena |
| content | `progression.json`, `upgrades.json` | nuevos | Ver Contenido |
| content | `enemies.json`, `player.json` | mod. | `xp` por tipo; `pickupRadius` |

## Contenido y validación
Todos los números son **provisionales, a medir en apply** (proposal y specs).

`content/player.json` gana `"pickupRadius": 128` (64 en el design original; ver "Desviaciones del apply"). `content/enemies.json` gana `"xp"`: bug 1, merge-conflict 2,
memory-leak 4.

`content/progression.json` (plano, con los nombres de las specs `leveling` y `xp-gems`):
```json
{ "baseXp": 5, "xpGrowth": 5, "gemRadius": 5, "magnetSpeed": 360, "maxGems": 300 }
```

`content/upgrades.json` (extracto; las 9 de la spec con `maxLevel` 5):
```json
{
  "upgrades": [
    {
      "id": "strict-rules",
      "name": "Skill: reglas estrictas",
      "description": "El Linter hace más daño.",
      "target": { "kind": "weapon", "weapon": "linter" },
      "stat": "damage",
      "perLevel": 3,
      "maxLevel": 5
    },
    {
      "id": "fast-ci",
      "name": "Skill: CI rápido",
      "description": "El Linter dispara más a menudo.",
      "target": { "kind": "weapon", "weapon": "linter" },
      "stat": "cooldownTicks",
      "perLevel": -4,
      "maxLevel": 5
    },
    {
      "id": "guardrail",
      "name": "Guardrail",
      "description": "Más vida máxima (y la misma cantidad de vida actual).",
      "target": { "kind": "player" },
      "stat": "maxHealth",
      "perLevel": 20,
      "maxLevel": 5
    }
  ]
}
```
`stat` es un campo propio de la mejora (como lo lista la spec) con los 7 valores posibles; la compatibilidad
estadística ↔ objetivo es regla cruzada del dominio, para que el error **nombre la mejora** (spec "Estadística
incompatible").

Esquemas zod (todos `strictObject`, mensajes del dominio):
```ts
const UpgradeTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('weapon'), weapon: z.string().min(1, { error: WEAPON_ID_REQUIRED }) }),
  z.strictObject({ kind: z.literal('player') }),
]);
export const UpgradesSchema = z.strictObject({
  upgrades: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z][a-z0-9-]*$/, { error: UPGRADE_ID_FORMAT }),
        name: z.string().trim().min(1, { error: UPGRADE_TEXT_REQUIRED }).max(UPGRADE_NAME_MAX),
        description: z.string().trim().min(1, { error: UPGRADE_TEXT_REQUIRED }).max(UPGRADE_DESCRIPTION_MAX),
        target: UpgradeTargetSchema,
        stat: z.enum(UPGRADE_STATS),
        perLevel: z.number().finite().refine((v) => v !== 0, { error: UPGRADE_STEP_MUST_NOT_BE_ZERO }),
        maxLevel: Count(UPGRADE_MAX_LEVEL_MUST_BE_INTEGER),
      }),
    )
    .min(1, { error: UPGRADES_REQUIRED }),
});
export const ProgressionSchema = z.strictObject({
  baseXp: Count(BASE_XP_MUST_BE_INTEGER),
  xpGrowth: z.number().int({ error: XP_GROWTH_MUST_BE_INTEGER }).min(0, { error: XP_GROWTH_MUST_BE_INTEGER }),
  gemRadius: Positive(GEM_RADIUS_MUST_BE_POSITIVE),
  magnetSpeed: Positive(MAGNET_SPEED_MUST_BE_POSITIVE),
  maxGems: Count(MAX_GEMS_MUST_BE_INTEGER),
});
```
- Longitudes máximas de texto (`UPGRADE_NAME_MAX` 40, `UPGRADE_DESCRIPTION_MAX` 120): caben en la carta.
- `xp` del enemigo: `Count(ENEMY_XP_MUST_BE_INTEGER)`. `pickupRadius`: `Positive(PICKUP_RADIUS_MUST_BE_POSITIVE)`.
- El fichero exige ≥ 1 mejora (forma); el dominio acepta un catálogo vacío (`NO_UPGRADES` en tests), como `weapons`.

Reglas cruzadas en `buildRunRules` (una sola implementación, también defensa en `Run.start`), en este orden, con
ruta `upgrades.upgrades.<i>.<campo>` y el `id` de la mejora en el mensaje:
1. Ids únicos (`…id`).
2. `target.weapon` existe en el loadout (`…target.weapon`, el mensaje menciona el id del arma, p. ej. `refactor`).
3. Estadística compatible (`…stat`): de jugador solo con `kind: 'player'`; de arma solo con `kind: 'weapon'`;
   `range` solo con `nearest-in-range` y `radius` solo con `any-in-radius`
   (`TARGETING_STAT: { [K in TargetingMode]: 'range' | 'radius' }`, tipo mapeado como `ATTACK_TARGETING`).
4. `perLevel` entero si `stat` es `damage` o `cooldownTicks` (`…perLevel`).
5. **Build de peor caso**: cada estadística a `base + Σ min(0, perLevel · maxLevel)`; cada arma pasa por
   `WeaponType.create` y el jugador por `checkPlayer`. Un fallo se informa en `…perLevel` de la primera mejora (en
   orden del catálogo) que baja esa estadística, con un mensaje que nombra la estadística y las mejoras que la
   bajan, p. ej. `upgrades.upgrades.1.perLevel: Estadística fuera de rango con las mejoras al máximo:
   linter.cooldownTicks = 0 (fast-ci)` (spec "Nivel máximo que saca la cadencia de rango" y "Suma de varias").
6. `pulseCapacity` = la del loadout de peor caso (`Σ ⌈visualTicks / cooldownMínimo⌉`): una mejora de cadencia del
   pulso no puede dejar sin eco a un pulso.

## Simulación

### Orden del tick (contrato de determinismo, spec simulation-loop)
```mermaid
sequenceDiagram
  participant R as Run.tick(input)
  participant A as Arsenal
  participant G as GemField
  participant X as Experience
  participant D as WaveDirector
  participant U as UpgradeBoard
  R->>R: 0. status ≠ running → return (ni pasos ni azar)
  R->>R: 1. jugador se mueve (velocidad efectiva)
  R->>R: 2. persecución
  R->>A: 3. step(n, px, py, enemies) (3a–3d sin cambios)
  A-->>R: nº de bajas
  R->>G: 3e. bajas > 0 → removeDead(): por cada muerto, en orden de la lista, drop(x, y, type.xp)
  R->>R: 4. contacto; vida 0 → over, tickCount = n, return
  R->>G: 5. step(px, py, radio jugador, pickupRadius efectivo) → XP recogida
  R->>X: 5b. XP > 0 → gain(XP): nivel, sobrante, subidas pendientes
  R->>D: 6. director
  R->>R: 7. tickCount = n
  R->>U: 8. pendientes > 0 y sin oferta → openNextOffer()
```
- **Paso 5, por gema en orden de creación** (incluidas las soltadas en el paso 3 de este tick): si no está atraída y
  `d² ≤ pickupRadius²`, pasa a atraída; si está atraída, avanza hacia el jugador; si su círculo solapa el del
  jugador, se marca recogida y suma `value`. Después, compactación estable (recogidas → pool libre). Las plazas
  liberadas sirven a las bajas de ticks siguientes (las de este tick ya se soltaron en el paso 3).
- **Azar**: armas, bajas, gemas y XP no lo consumen. El único consumo nuevo es el sorteo de la oferta (paso 8 o
  elección). Las partidas de una semilla cambian respecto a 0004 en cuanto hay una subida con oferta.
- `openNextOffer()` (en `Run`): si `pending > 0`: `board.open(random)` ⇒ `status = choosing`; si no hay disponibles
  ⇒ `experience.clearPending()` y sigue en curso.

### `Run.chooseUpgrade(index)`
1. `status !== 'choosing'` ⇒ `err({ code: 'no-offer' })` (también con la partida terminada).
2. `board.pick(index)`: `Number.isInteger(index) && 0 ≤ index < offer.length`; si no, `choice-out-of-range` y nada
   cambia. Si es válido sube `levels[i]` y cierra la oferta.
3. Aplica el efecto según `target.kind`:
   - `weapon`: `arsenal.retune(id, WeaponType.create(upgradedWeapon(base, catalog, levels)))`. El `Result` no puede
     fallar (peor caso validado); si fallara es un error de programación y se lanza un `Error` de invariante.
   - `player`: `player = player.withRules(upgradedPlayer(base, catalog, levels), gananciaDeVidaMáxima)`.
4. `experience.resolveOne()` (pendientes − 1), `status = running` y `openNextOffer()`: la siguiente subida encolada
   abre su oferta ya, con la disponibilidad recalculada (spec "La disponibilidad se recalcula entre ofertas").

Las bases salen de `RunRules` (`loadout.weapons`, `player`), nunca del estado mutado.

### Gemas: pool y bajas (ADR-0003, ADR-0006)
- `GemField` preasigna `maxGems` `XpGem` al empezar; `drop` hace `pop` de la pila libre y `push` a la lista activa;
  la compactación del paso 5 devuelve las recogidas a la pila. Cero asignaciones por tick en régimen.
- `removeDead()` sigue siendo un solo pase O(n): a la vez que compacta, suelta la gema de cada muerto. El `Enemy`
  muerto conserva `x`, `y` y `type` hasta ese pase, así que no hace falta registro de bajas ni cambiar `Arsenal` ni
  `WeaponTarget`. La posición es la del paso de armas (spec "Suelta de gema por baja").
- `RunSetup.gems?: { x, y, value, attracted? }[]` y `RunSetup.experience?: { level, xp }` (tests y bench),
  validados como el resto de `RunSetup` (finitos, `value` entero ≥ 1, ≤ `maxGems` gemas, `xp < toNext(level)`).

### `Experience` y `XpCurve`
- `gain(amount)`: `xp += amount; while (xp ≥ toNext(level)) { xp −= toNext(level); level += 1; pending += 1 }`.
  Sin nivel máximo; con enteros no hay error de coma flotante.

### Oferta (`UpgradeBoard.open`)
- Recorre el catálogo en orden y copia en el array de trabajo los índices con `levels[i] < maxLevel` (`m`).
- `m === 0` ⇒ false, sin consumir azar. Si no, `k = min(OFFER_SIZE, m)` extracciones de Fisher–Yates parcial; la
  oferta guarda los `UpgradeType` en el orden extraído. Arrays preasignados: sin asignar al sortear.

### `RunSnapshot`
Se añade, todo congelado:
```ts
gems: readonly { id: number; x: number; y: number; radius: number }[];   // orden de creación
progression: { level: number; xp: number; xpToNext: number; pendingLevelUps: number };
offer: readonly { id: string; name: string; description: string; level: number; nextLevel: number }[]; // [] sin oferta
upgrades: readonly { id: string; level: number }[];                      // nivel ≥ 1, orden del catálogo
```
`status` puede valer `'choosing'`; `player.maxHealth` es la efectiva.

## Aplicación (casos de uso)
- **`FixedStepLoop.advance(elapsedMs, step: () => boolean)`**: si `step()` devuelve false, `accumulator = 0` y sale
  del bucle. `reset()` pone el acumulador a 0.
- **`TickRun.execute`**: si `run.status !== 'running'` ⇒ `loop.reset()` y devuelve el snapshot; si no,
  `advance(elapsed, () => { run.tick(input); return run.status === 'running'; })`. Spec "Oferta a mitad de frame":
  50 ms ⇒ 1 tick y acumulador 0; tras elegir, 8,334 ms ⇒ 0 ticks.
- **`ChooseUpgrade.execute(index)`**: `run.chooseUpgrade(index)` y, si va bien, `ok(run.snapshot())`.
- **`StartRun.execute`** devuelve `Result<{ tickRun, chooseUpgrade }, DomainError>`.

## Render
- **Orden de creación en `GameScene.create`**: anillos, **gemas**, enemigos, proyectiles, jugador, **barra de XP**,
  **overlay** (`setDepth` alto y `setScrollFactor(0)` en barra y overlay, pensando en la cámara de 0006).
- **`GemLayer`**: como `ProjectileLayer` (`SlotPool`, capacidad `maxGems`, color constante de vista).
- **`XpBar`**: dos `Rectangle` y un `Text` creados una vez; `xpBarFill(xp, xpToNext)` (pura, en [0, 1]) da el
  relleno. Solo llama a `setSize`/`setText` si cambian los valores.
- **`UpgradeOverlay`**: velo semitransparente y 3 cartas (rectángulo `setInteractive()` y tres `Text`: `[1] nombre`,
  descripción con `wordWrap`, `Nv a → b`). `cardLayout(view, count)` (pura) centra 1–3 cartas. Visible solo con
  oferta; rellena textos solo cuando cambia la oferta (clave `id:level` concatenada). `pointerdown` en una carta
  guarda su índice en `clicked`. Probado en Node con dobles como `EnemyLayer`.
- **`ChoiceKeys`**: `ONE..THREE` y `NUMPAD_ONE..THREE` con `Phaser.Input.Keyboard.JustDown`, así que mantener
  pulsada una tecla no elige también en la oferta siguiente.
- **`GameScene.update`**: si el último snapshot tiene oferta, lee `ChoiceKeys` u `overlay.clicked`; con un índice
  `0 ≤ i < offer.length` llama a `chooseUpgrade.execute(i)` y pinta su snapshot (una tecla sin carta no llama a
  nada). Sin oferta, las teclas 1–3 se descartan. Después, `tickRun.execute(deltaMs, input)`, que no avanza si sigue
  eligiendo (el input de movimiento no llega a la simulación). Sin reglas de juego en la escena.
- **Probe E2E**: sin cambios de código; `tests/e2e/probe.ts` amplía `SnapshotView` y gana un ayudante que pulsa
  `1` cada vez que el snapshot tiene oferta (política de elección fija en el navegador).

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. `Text`/`Rectangle` y eventos de puntero vienen en Phaser 4.2.1; `z.discriminatedUnion`/`z.enum` en zod 4.6.7 | Overlay DOM/HTML (exploración B2): primer uso de DOM, nuevo adaptador y guardarraíles; plugin de UI (rexUI): dependencia grande para 3 cartas |

## Rendimiento y seguridad
- **Presupuesto**: `Run.tick` ≤ 2 ms de media en el peor caso (ADR-0003). Paso de gemas: ≤ 300 × (un `d²` + como mucho
  un `hypot` y un solape) ≈ 1.500 operaciones; `removeDead` sigue siendo un pase. Estimación < 0,01 ms sobre lo
  medido en 0004. Sin rejilla espacial.
- **Asignaciones**: cero por tick en régimen (pool de gemas, escalares, arrays de trabajo). Asignan solo la elección
  (un `WeaponType` o un `Player`/`Health`) y el `snapshot()` por frame (+ ≤ 300 gemas, ≤ 3 opciones y ≤ 9 mejoras).
- **Bench** (spec "Peor caso con gemas"): el caso de 0004 (200 `bench` + 32 proyectiles) más 300 gemas con
  `RunSetup.gems`, todas `attracted: true` y a ≥ 400 px del jugador, 60 ticks medidos con el `magnetSpeed` por
  defecto (360 px < 400: ninguna se recoge). Los casos existentes eligen la opción 0 si se abre una oferta (la
  elección entra en el tiempo medido, spec "Rendimiento con el tope de enemigos").
- **Entradas externas**: `upgrades.json` y `progression.json`, versionados y validados con zod estricto. Los textos se
  pintan con `Phaser.Text` (canvas, no HTML): no hay inyección. Sin datos persistidos; los niveles (`levels`) son lo
  que guardará 0007.

## Impacto en tests existentes
- `tests/support/builders.ts`: `xp: 1` en los tipos de prueba, `pickupRadius` en el jugador, `DEFAULT_PROGRESSION`
  y `NO_UPGRADES` por defecto en `aRunConfig`/`aContactConfig` (los escenarios de 0001–0004 no se pausan: con
  catálogo vacío las subidas se registran sin oferta). `DEFAULT_UPGRADES` y `withUpgrades(...)`.
- `tests/support/runs.ts`: `advance(run, ticks, input)` con la **política de elección fija** de simulation-loop
  (opción 0 cada vez que se abre una oferta; "N ticks" son N ticks ejecutados).
- `determinism.test.ts`, `long-run.test.ts`, `balance.test.ts`, escenarios largos de `auto-weapons`: con contenido
  por defecto pasan a `advance`. Los plazos heredados (primer golpe ≤ 4.800 con semilla 42; bajas ≤ 600 y pulso
  ≤ 1.800 con semilla 7) se **revalidan** en la tarea de medición.
- "Ningún arma mata a un bug de un impacto sin mejoras": sigue valiendo sin mejoras (la spec ya lo acota).
- `loop.test.ts`: firma de `step` con retorno booleano; casos nuevos de corte y `reset`.
- `content.test.ts`, `run-config.test.ts`: un caso por regla de la tabla de validación.
- E2E existentes de `?seed=42` y `?seed=7` (`health.spec.ts`, armas): pulsan `1` cuando aparece el overlay.

## Riesgos
- **Plazos sin medir**: primera oferta ≤ 3.600 ticks con semilla 7 y jugador quieto (el Linter mata lejos y las gemas
  pueden quedar fuera de los 64 px) y plazos heredados. Se miden al principio del apply; si no se cumplen con
  valores razonables, se vuelve a la spec.
- **Equilibrio** (curva, XP, incrementos, frecuencia de pausas): provisional; al cambiar un valor se busca en todas
  las specs (retros 0003/0004).
- **Peor caso más estricto que la spec**: con incrementos de signos mezclados sobre una misma estadística, la build
  de peor caso rechaza contenidos que "todas al máximo" aceptaría. No pasa con el catálogo por defecto y garantiza
  que ninguna combinación alcanzable salga de rango.
- `Run` crece (tres servicios más y `chooseUpgrade`); si pasa de ~300 líneas, extraer el ensamblado del snapshot a
  `runSnapshot.ts`.

## Contraste con las specs delta
Contrastado con `xp-gems`, `leveling`, `upgrades`, `run-state`, `simulation-loop`, `auto-weapons`, `enemy-spawning`,
`player-health` y `player-movement`. Cambios respecto a la primera versión de este design:
- **Orden del tick**: gemas y XP pasan a **después del contacto** (spec simulation-loop y run-state). No hay razón
  técnica en contra: el paso de gemas no depende del contacto y el corte por muerte ya existía.
- **Gema en su tick de suelta**: participa en el paso de gemas de ese tick (antes se saltaba con `droppedAt`).
- **Nombres de contenido**: `pickupRadius` (player.json); `baseXp`, `xpGrowth`, `gemRadius`, `magnetSpeed`,
  `maxGems` en un `progression.json` plano; `stat`, `perLevel`, `maxLevel` como campos de la mejora.
- **Tamaño de la oferta**: constante de dominio (la spec fija "exactamente 3"), no campo de contenido.
- **Signo del incremento**: la spec solo exige `perLevel ≠ 0`; se sustituye el "signo fijo" por la build de peor
  caso (ADR-0008 actualizada).
- **Subidas pendientes**: cuentan la de la oferta abierta y se exponen en el snapshot.
- **Snapshot de la oferta**: `id, name, description, level, nextLevel` (sin `maxLevel`); sin `player.pickupRadius`.
- **Bench de gemas**: 300 atraídas a ≥ 400 px y 60 ticks con el imán por defecto (sin `magnetSpeed` de bench).
- **Proyectil y pulso** conservan daño y radio de su creación: ya lo garantizaba el modelo (`launch` copia el daño,
  `PulseEcho` guarda el radio).
- **Política de elección fija** (opción 0) en tests, bench y E2E.

Sin discrepancias abiertas.

## ADRs
- `docs/adr/0008-mejoras-como-modificadores-aditivos.md` (nueva): niveles como fuente de verdad, estadísticas
  efectivas derivadas desde la base y validadas con las mismas fábricas, build de peor caso.
- `docs/adr/0007-modelo-generico-de-armas.md` (matizada): estado y consecuencia remiten a ADR-0008.
- ADR-0003 y ADR-0006: sin cambio de decisión; en apply se añade su sección "Aplicación (0005)" (pool de gemas,
  suelta dentro de `removeDead`, datos del bench).

## Desviaciones del apply

### 0.1 · Línea base sin progresión (código de 0004)
Contenido por defecto con armas, input (0, 0), en el núcleo (test temporal, ya retirado). "Baja cercana" = enemigo
que desaparece a ≤ 64 px del jugador (posición del snapshot anterior). Como gemas y XP no consumen azar, hasta la
primera oferta la partida de 0005 es idéntica a la de 0004, así que la "primera oferta estimada" (primer tick en que
la XP de las bajas cercanas, con bug 1 / merge-conflict 2 / memory-leak 4, llega a 5) predice la real.

| Semilla | Primer golpe | Primera baja | Primer pulso | Fin | Bajas (6.000 ticks) | Cercanas | Primera oferta estimada |
|---|---|---|---|---|---|---|---|
| 42 | 4100 | 185 | 1177 | 4815 | 80 | 16 | 4145 |
| 7 | 4098 | 179 | 950 | 4629 | 74 | 12 | 4234 |
| 1 | 3899 | 173 | 712 | 4589 | 73 | 10 | 4158 |
| 2 | 4126 | 124 | 2022 | 4583 | 72 | 8 | 4307 |
| 3 | 4077 | 187 | 786 | 4577 | 74 | 14 | 4143 |

- Con semilla 7, ninguna baja de los primeros 3.600 ticks ocurre a ≤ 64 px (la más cercana, a 73 px): el Linter
  (alcance 400) y Tests (radio 90) matan lejos del jugador quieto. **Riesgo confirmado**: con los valores
  provisionales, "Primera subida en el núcleo" (≤ 3.600 ticks) no se cumplirá. Se mide de nuevo con el código real
  en el punto de control 0.3.

### 0.3 · Punto de control tras 1.25 (código real, política de elección fija) — PARADO, pendiente de decisión
Contenido por defecto de 0005 (armas, mejoras, curva 5/5, imán 64 px), input (0, 0), 18.000 ticks como mucho:

| Semilla | Primer golpe | Primera baja | Primer pulso | Primera gema | Primera oferta | Ofertas (por min, 5 min) | Fin |
|---|---|---|---|---|---|---|---|
| 7 | 4098 | 179 | 950 | 4076 | **4236** | 2 (0, 2, 0, 0, 0) | 4607 |
| 42 | 4100 | 185 | 1177 | 3368 | **4146** | 2 (0, 2, 0, 0, 0) | 4760 |
| 1 | 3899 | 173 | 712 | 3918 | 4158 | 2 | 4640 |
| 2 | 4126 | 124 | 2022 | 4128 | 4307 | 2 | 4676 |
| 3 | 4077 | 187 | 786 | 1003 | 4143 | 2 | 4577 |

- **No cumplen**: "Primera subida en el núcleo" (oferta ≤ 3.600 con semilla 7: llega en 4.236) y "Partida con
  progresión reproducible" (≥ 1 gema y ≥ 1 oferta en 3.600 con semilla 7: primera gema en 4.076). Sí cumplen: primer
  golpe ≤ 4.800 (semilla 42: 4.100), ≥ 1 baja en 600 (179) y pulso ≤ 1.800 (950). Los tests de 0.2 siguen en
  `.skip`; con el `.skip` quitado fallan exactamente los dos primeros.
- Causa: con el jugador quieto casi todas las bajas ocurren a 100–300 px (Linter alcance 400, Tests radio 90), fuera
  del imán de 64 px; la primera recogida coincide con la llegada de los enemigos al jugador (~68 s). La partida
  quieta muere hacia el segundo 77 con 2 ofertas.
- Sensibilidad informativa (sin cambiar contenido ni specs), primera oferta con semillas 7, 42, 1, 2, 3:
  `pickupRadius` 96 → 4143–4307 (no basta); 128 → 3332, 1773, 1368, 2785, 1003; 160 → 1506, 1499, 1009, 2008, 865;
  200 → 725–1036. `baseXp` 3, 2 o 1 con imán 64 → 3553–4307 (no basta). `pickupRadius` 128 + `baseXp` 3 → 838–2516.
  El primer golpe sigue ≤ 4.800 en todas las variantes (3899–4424).
- Borrador del bench "Peor caso con gemas" (200 `bench`, 32 proyectiles, 300 gemas atraídas a ≥ 400 px, 60 ticks,
  `performance.now` en un test temporal): mediana 0,063 ms y máximo 0,080 ms por tick (≤ 2 ms). Dos hallazgos para
  3.9: (1) con las armas de bench (cadencia 1) el catálogo por defecto no pasa la build de peor caso (`fast-ci`
  deja `cooldownTicks` en −19): el bench debe quitar las mejoras de cadencia; (2) con el jugador en el centro de la
  arena no caben 40 ticks de calentamiento + 60 medidos a 6 px/tick (máx. 551 px): el borrador pone al jugador en
  (480, 16) y las gemas en las esquinas inferiores (≥ 650 px).

### 0.3 · Decisión y nueva medición con `pickupRadius` 128
**Decisión del usuario** tras el punto de control: se mantiene el plazo de 3.600 ticks y `pickupRadius` por defecto
pasa de 64 a 128 (`content/player.json`, specs `player-movement` y `xp-gems`, proposal). Medido de nuevo con el
código real, misma política:

| Semilla | Primer golpe | Primera baja | Primer pulso | Primera gema | Primera oferta | Ofertas (por min, 5 min) | Fin |
|---|---|---|---|---|---|---|---|
| 7 | 4083 | 179 | 950 | 957 | **3332** | 3 (1, 2, 0, 0, 0) | 4769 |
| 42 | **4122** | 185 | 1177 | 1190 | 1773 | 2 (1, 1, 0, 0, 0) | 4682 |
| 1 | 4172 | 173 | 712 | 375 | 1368 | 3 | 4963 |
| 2 | 4097 | 124 | 2022 | 2008 | 2785 | 4 | 4895 |
| 3 | 4110 | 187 | 786 | 750 | 1003 | 4 | 5178 |

- Cumplen todos los plazos del grupo 0: primera oferta ≤ 3.600 (semilla 7: 3.332), primer golpe ≤ 4.800 (semilla
  42: 4.122), ≥ 1 baja en 600 (179), pulso ≤ 1.800 (950) y ≥ 1 gema y ≥ 1 oferta en 3.600 (semilla 7: 957 y 3.332).
  Los 4 tests de 0.2 quedan activos y en verde. Margen justo con la semilla 7 (268 ticks).
- Borrador del bench con gemas: mediana 0,059 ms, máximo 0,080 ms por tick.
- Los tests usan dos valores a propósito: `aRunConfig` sigue con 64, la geometría con la que están escritos los
  escenarios del imán ("Límite exacto del radio" a 64, "Gema fuera del radio" a 65, "Más radio de recogida" = 96,
  "El imán usa la posición del jugador ya movido" con 66 > 64…); `aDefaultConfig` (contenido real) usa
  `DEFAULT_PICKUP_RADIUS` = 128. **Pendiente de spec (no lo cambia el apply)**: esos escenarios no fijan el radio en
  su GIVEN, así que con el contenido por defecto (128) dejan de ser literales: p. ej. "Más radio de recogida" da 160
  con `context-window` en nivel 1, no 96; y la cabecera de la spec `player-movement` sigue diciendo 64.
