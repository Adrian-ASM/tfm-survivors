# Design · 0030-pickup-visibility

## Resumen
Solo cambian el render y los datos de aspecto. Los cinco recogibles crecen (las escalas y el diámetro de la gema van
en `content/appearance.json`) y flotan con un desplazamiento vertical senoidal,
`d(id, R) = A · sen(2π · (R + id · s) / T)`. Ese desplazamiento es una función pura del reloj de render
(`AnimClock`) y del id, sin tweens ni azar. Oro, madera y carne reproducen una vez su hoja `*_Spawn` al aparecer,
sin flote, y después pasan a `idle` y flotan desde R_f (el reloj del primer frame fuera de la aparición), con
`d = A · sen(2π(R − R_f)/T)`, que vale 0 en R_f y por eso no salta. Los arranca `SlotPool.appearing` (una vez por id) y el cambio de hoja
se hace en el mismo sprite del pool (con `setTexture`, como la oveja). Los recogibles del primer pintado de la
partida (los montones) llevan un retardo de `id × e`. Un recogible con aspecto de reserva ni aparece ni flota. No se
tocan el núcleo, las firmas doradas, `BALANCE_BASELINE` ni los objetos del mapa.

> **Revisión tras las specs delta** (`asset-provenance`, `sprite-rendering`, `xp-gems`, `world-camera`): se adoptan
> la fórmula de fase por **paso en ms** (`s`), el flote nulo durante la aparición y su retardo, la reserva sin flote
> y `spawn` **opcional**. Ver «Contraste con las specs» al final.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Sin cambios: `pickupRadius` 128, `gemRadius` 5, topes y snapshot intactos. |
| application | — | — | Sin cambios. |
| infrastructure (contenido) | `appearanceSchema.ts` | Mod. | `SpawnSchema`, `ResourcePickupSchema` (oro/madera/carne), `diameter` en `XpShapeSchema` y `PickupMotionSchema` en la raíz (D1). |
| infrastructure (contenido) | `loadAppearance.ts` | Mod. | Nuevo `pickupSpawnSheetsOf(appearance)`: las 3 hojas `spawn` con su ruta de campo. Entra en la comprobación de la nota de procedencia de `parseAppearance`. |
| infrastructure (motor) | `bootPlan.ts` | Mod. | Carga también las hojas de `pickupSpawnSheetsOf`, deduplicadas por `file` como el resto. |
| infrastructure (render puro) | `art/pickupMotion.ts` | **Nueva** | `floatOffset`, `floatPhase`, `spawnDelay` y `spawnFrame`: funciones puras, sin motor (D2). |
| infrastructure (render puro) | `art/looks.ts` | Mod. | `PickupLook` gana `spawn: StillLook \| null` y `shapeRadius: number \| null`. `Looks` gana `pickupMotion` (D3). |
| infrastructure (motor) | `PickupLayer.ts` | Mod. | `sync(pickups, ms)`, estado de aparición por hueco, flote en `at()` y recuento `spawns` (D4). |
| infrastructure (motor) | `RenderLayers.ts`, `renderCounts.ts` | Mod. | Pasa `ms` a `PickupLayer.sync`. Nuevo `counts.pickupSpawns` y su cero en el menú (D5). |
| contenido | `content/appearance.json` | Mod. | Escalas 0,5 / 0,75, `diameter` 20, `spawn` en oro/madera/carne y `pickupMotion`. |
| contenido | `content/asset-provenance.json` | Mod. | 3 entradas nuevas (D6). |
| assets | `public/assets/tiny-swords/Resources/Resources/{G,W,M}_Spawn.png` | **Nuevas** | Copia byte a byte del pack Update 010, con sombra. |
| composition | — | — | Sin cambios: `Looks` llega igual que hoy. |
| tests/e2e | `probe.ts`, `gameplay.spec.ts` | Mod. | Tipo `pickupSpawns` y ampliación del test «Mapa real» (D7). |
| docs | `AGENTS.md` | Mod. | Árbol «0–3 a 4 fps» (D9). |

Todo vive en infraestructura porque es presentación: no cambia ninguna regla de juego, y el núcleo no sabe que los
recogibles flotan (ADR-0002). Las funciones de tiempo y fase van en `art/` junto a `animation.ts`, igual que
`phasedFrameAt` en 0029, para poder probarlas sin motor.

## D1 · Datos de aspecto (`content/appearance.json` y zod)

```jsonc
"pickups": {
  "xp":   { "shape": true, "placeholderColor": "#4fd1c5", "diameter": 20 },
  "gold": { "sheet": { "file": "Resources/Resources/G_Idle.png", "frameWidth": 128, "frameHeight": 128 },
            "scale": 0.5, "origin": {...}, "facing": "right", "placeholderColor": "#e8c547",
            "idle": { "frames": [0], "fps": 1, "loop": true },
            "spawn": { "sheet": { "file": "Resources/Resources/G_Spawn.png",
                                  "frameWidth": 128, "frameHeight": 128 },
                       "frames": [0, 1, 2, 3, 4, 5, 6], "fps": 10, "loop": false } },
  "wood": { … "W_Idle.png", "scale": 0.5, "spawn": { "W_Spawn.png", mismas cifras } },
  "meat": { … "M_Idle.png", "scale": 0.5, "spawn": { "M_Spawn.png", mismas cifras } },
  "stone": { … las tres rocas con "scale": 0.75 … }
},
"pickupMotion": {
  "float": { "amplitude": 4, "periodMs": 1600, "phaseStepMs": 989 },
  "spawnStaggerMs": 120
}
```

- **Cuadrícula de las hojas `*_Spawn`**: las tres hojas del pack, vistas como imagen, tienen 7 celdas de 128 px. La
  **celda 0 no está vacía**: en apply se vio un disco blanco de unos 44 px, el destello inicial (la vista previa a
  escala lo ocultaba). En la 1 sale el objeto con un anillo de su color, en la 2 el anillo se abre, en la 3 cae, en
  la 4 rebota y en la 5 y la 6 se asienta. La 6 coincide a simple vista con `*_Idle`, sombra incluida. El autor
  decide la **aparición completa 0–6** a 10 fps (700 ms), con el destello incluido. Como la celda 0 no vale de
  espera, durante el retardo el recogible está **oculto** (D4). Al aplicar hay que confirmar `frameTotal − 1 = 7` y
  que el frame 6 sea igual a `idle` (riesgo R1).
- **`SpawnSchema`** = `strictObject({ sheet: SheetSchema, frames: Frames, fps: Fps, loop: literal(false) })`, con el
  error nuevo `SPAWN_MUST_NOT_LOOP`. Sigue el patrón de `SheetAnimSchema` de la oveja: la animación trae su hoja.
- **`ResourcePickupSchema`** = `strictObject({ ...BaseShape, idle: AnimSchema, spawn: SpawnSchema.optional() })`
  para `gold`, `wood` y `meat`. `spawn` es **opcional**, como pide el escenario «Aparición opcional»: sin él, el tipo
  flota desde su primer frame. Los datos del repositorio lo traen en los tres. La gema con hoja (`StillSchema`) y las
  rocas (`RockAspectSchema`) siguen estrictas y sin `spawn`, así que un `spawn` en ellas da `unrecognized_keys`, y el
  error nombra `spawn` y la ruta `pickups.xp` / `pickups.stone…`. En la gema sin hoja (`XpShapeSchema`, estricto)
  pasa lo mismo. No se añade un refinamiento de tamaño de frame igual al de `idle`: la spec no lo pide, y con los
  datos del repositorio los dos son de 128 × 128.
- **`XpShapeSchema`** gana `diameter: number > 0` (obligatorio, error `GEM_DIAMETER_MUST_BE_POSITIVE`). Es el
  diámetro en px de la forma pintada. `gemRadius` sigue siendo solo lógica.
- **`PickupMotionSchema`** (raíz, estricto y obligatorio; si falta, el error nombra `pickupMotion`). Va fuera de
  `pickups` para no romper la regla «`pickups` tiene exactamente los tipos de la unión»:
  - `float.amplitude` (A): número ≥ 0 en px.
  - `float.periodMs` (T): número > 0.
  - `float.phaseStepMs` (s): número ≥ 0. Con 0 todos los ids comparten fase. Se usa **989 ms**, ≈ T × 0,618 (la
    conjugada áurea): los valores `(id · 989) mod 1.600` de los ids 0 a 7 son 0, 989, 378, 1.367, 756, 145, 1.134 y
    523, distintos dos a dos (escenario «Datos del repositorio»), y los ids siguientes siguen repartidos sin
    agruparse.
  - `spawnStaggerMs` (e): número ≥ 0.
- La hoja `spawn` pasa por la comprobación `SHEET_NOT_REGISTERED` con la ruta `pickups.<tipo>.spawn.sheet.file`.
- La reserva de color de oro, madera y carne no cambia, así que `checkResourceColors` queda igual. Su
  `XP_SHEET_MUST_DIFFER` añade las tres hojas `spawn` a `others`: la gema con hoja no puede usar una hoja de
  aparición.

## D2 · Funciones puras (`art/pickupMotion.ts`)

```ts
export interface FloatSpec { amplitude: number; periodMs: number; phaseStepMs: number }
/** Flote con fase por id (piedra, gema y tipos sin aparición o con `spawn` fallida): A · sin(2π · (ms + id · s) / T). */
export function floatOffset(f: FloatSpec, id: number, ms: number): number;
/** Flote sin salto tras una aparición: A · sin(2π · (ms − floatFrom) / T), con floatFrom = R_f (0 en R_f). */
export function floatOffsetFrom(f: FloatSpec, floatFrom: number, ms: number): number;
/** Retardo de la aparición: id · e en el primer pintado de la partida, 0 después. */
export function spawnDelay(staggerMs: number, id: number, initial: boolean): number;
/** Frame de hoja de la aparición a `elapsed` = R − R_a ms de su inicio, o null si terminó (k ≥ n). */
export function spawnFrame(spawn: AnimSpec, elapsed: number): number | null;
```

- `spawnFrame`: con `k = ⌊elapsed · fps / 1.000⌋`, si `k < 0` devuelve la constante `SPAWN_HIDDEN` (−1; retardo,
  sprite oculto),
  si `k ≥ n` devuelve `null` y en otro caso `frames[k]`. Es la regla de la spec, y para `elapsed ≥ 0` coincide con
  `frameAt` / `animDone` de `animation.ts`, que se reutilizan.
- El resultado depende solo de los argumentos, así que dos llamadas iguales dan lo mismo (sin `Math.random` ni reloj
  del sistema).
- **Flote sin salto** (spec «Flote de los recogibles», ajuste aprobado por el autor): mientras `spawnFrame` no es
  null, d = 0. En el primer frame pintado con `spawnFrame` = null se fija **R_f = R** y a partir de ahí d =
  `floatOffsetFrom(f, R_f, R)`, que vale 0 en R_f, así que no hay salto. Estos recogibles no llevan fase por id: los
  desfasa su propio R_f. Un recogible sin aparición (piedra, gema, tipo sin `spawn` o con `spawn` = null por fallo
  de la hoja) usa `floatOffset` con fase por id desde su primer frame.

## D3 · Aspectos resueltos (`looks.ts`)

- `PickupLook` pasa a ser `StillLook & { shape; spawn: StillLook | null; shapeRadius: number | null }`.
- `spawn` se resuelve como la vista de la oveja: `texture` = la hoja `spawn`, y escala, origen y color = los de
  `idle`. Sus frames van en el campo `idle` del `StillLook` (el mismo truco que `SheepLook.bounce`). Es **null** si
  `idle` cayó a reserva, si la hoja `spawn` no cargó o si algún índice de `spawn.frames` no cabe en ella. En ese
  caso va directo a `idle`, como pide la proposal. Un fallo de `spawn` **no** cuenta como reserva en la sonda,
  porque `idle` se pinta bien.
- La gema `shape`: `shapeRadius = diameter / 2` (10). `PickupLayer` llama a `painted.look(look, look.shapeRadius ??
  p.radius)`. Así `lookScale` (reserva: `2r / 64`) da 20 / 64 = 0,3125 para la gema, y el disco de reserva de los
  demás tipos sigue saliendo de su radio lógico (10 px). No cambia `lookScale` ni `PaintedSprite`.
- `Looks.pickupMotion` lleva `{ float, spawnStaggerMs }` tal cual del esquema (sin motor).
- Los iconos del HUD y de la guía (`counterIcon`, `ResourceIcons`) siguen usando `looks.pickups.<tipo>` con su hoja
  `idle`. Su tamaño lo fija `hudLayout`, no `scale`, así que no heredan escala, flote ni aparición. Al aplicar hay
  que comprobar que `counterIcon` no lea `scale` (riesgo R4).

## D4 · `PickupLayer` y `SlotPool`

`SlotPool` **no cambia**: su `appearing` ya es «true solo la primera vez que el id entra en un hueco, o tras
`clear()`». Los ids no se reutilizan (ADR-0006), así que un hueco reciclado arranca la aparición del recogible nuevo
y nunca repite la del anterior.

`PickupSlot` gana `spawnStart: number`, `spawnDelay: number`, `spawning: boolean` y `floatFrom: number | null`
(R_f; null si el recogible no tuvo aparición). Todo se reinicia al aparecer, así que es estado **por id**: un hueco
reutilizado no hereda nada del anterior. `PickupLayer` gana
`private initial = true` y `readonly spawns: Record<PickupKind, number>`.

```
sync(pickups, ms):
  this.ms = ms
  pool.sync(pickups)
  this.initial = false                 // solo el primer sync tras crear la capa o tras clear()

show(slot, p, appearing):
  if appearing:
    look = (stone ? stones.of(source) : looks[kind]); slot.kind/look = …; count(kind, look, +1)
    slot.floatFrom = null
    if look.spawn: slot.spawning = true; spawnStart = this.ms
                   spawnDelay = spawnDelay(stagger, p.id, this.initial); spawns[kind] += 1
    else:          slot.spawning = false
  view = look
  if slot.spawning:
    frame = spawnFrame(look.spawn.idle, this.ms − spawnStart − spawnDelay)
    if frame === null: slot.spawning = false; spawns[kind] −= 1; slot.floatFrom = this.ms   // R_f
    else view = look.spawn
  dy = slot.spawning || (look.placeholder && !look.shape) ? 0
     : slot.floatFrom !== null ? floatOffsetFrom(float, slot.floatFrom, this.ms)
     : floatOffset(float, p.id, this.ms)
  hidden = slot.spawning && frame === SPAWN_HIDDEN          // retardo: oculto
  painted.look(view, look.shapeRadius ?? p.radius)
         .setFrame(view, slot.spawning && !hidden ? frame : (slot.spawning ? look.spawn.idle.frames[0]
                                                                          : look.idle.frames[0] ?? 0))
         .paint(view, false)
         .at(p.x, p.y + dy).show(!hidden)

hide(slot):  … como hoy; if slot.spawning: spawns[kind] −= 1; slot.spawning = false

clear():  pool.clear(); this.initial = true
```

- **Reloj**: `ms` es `RenderLayers.clock.ms`, el mismo de la espuma, los árboles y las ovejas. Se congela con pausa,
  oferta, tienda, obra y fin (`advance(delta, paused || status !== 'running')`). En `?e2e&manual` avanza
  `ticks × TICK_MS` con cada `step(n)`. Con el reloj congelado, ni la aparición ni el flote se mueven, y no hace
  falta ninguna rama propia. El reloj no se reinicia con R. Da igual, porque la aparición mide desde `spawnStart` y
  la fase del flote es absoluta pero determinista.
- **Montones del tick 0**: el «primer pintado» es el primer `sync` tras crear la capa o tras `clear()` (R o Volver
  al menú; en una partida nueva se crea la escena entera). No se usa `snapshot.tick === 0`: tras R, el primer
  render puede llegar ya en el tick ≥ 1 (en `GameScene.update`, `restart` → `gate.frame` avanza antes de pintar).
  En ese primer pintado solo están los montones (ids 0..N−1, spec `resources`). Con `woodPiles.count` = 8 (el único
  valor del contenido; los mapas declarados de escenario traen menos o ninguno), el retardo `id × 120` los reparte
  en [0, 840] ms, y el último termina con R0 + 840 + 700 = **R0 + 1.540 ≤ R0 + 3.000** (escenario «Montones del
  repositorio»). El margen deja subir `count` hasta 20 sin romperlo (19 × 120 + 700 = 2.980). Con `map=empty` el primer
  `sync` está vacío y no hay desfase para nadie. **Durante el retardo el sprite está oculto** (`setVisible(false)`
  a través de `PaintedSprite.show`, sin objetos nuevos). Ya tiene preparados la hoja `spawn` y el frame 0, así que en
  el primer frame con k ≥ 0 se muestra el destello sin parpadeos.
  - **Recuentos (decisión del design, a alinear con el spec-writer)**: el recogible en retardo **sigue contando** en
    `sprites.pickups.<tipo>.visible` y en `sprites.pickupSpawns`, porque esos recuentos son de recogibles pintados por
    la capa, iguales al snapshot y sin depender del reloj (spec «Recuentos de recogibles sin depender de la
    aparición ni del flote»). Así el E2E de D7 (`wood.visible` = montones y `pickupSpawns.wood` = montones en la
    primera lectura) no cambia. Si la spec prefiriera contarlo como no visible, habría que cambiar el recuento y esa
    aserción del E2E.
- **`PaintedSprite` ya evita llamadas repetidas**: `setTexture` solo se llama al cambiar de hoja (dos veces por
  recogible con aparición) y `setFrame` solo al cambiar de frame. Lo único nuevo por frame es un `Math.sin`, porque
  `setPosition` ya se llamaba en cada frame. No se crean objetos por frame.
- **Fuera de cámara** la aparición se gasta (los recogibles no se recortan). Se acepta (proposal).

## D5 · Sonda E2E: `sprites.pickupSpawns`

La spec deja el recuento opcional («Recuento en aparición [opcional, según design]»). **Se fija: sí.** Se añade
`sprites.pickupSpawns: Record<'xp' | 'gold' | 'wood' | 'meat' | 'stone', number>`, con los recogibles que muestran un
frame de `spawn` por tipo, incluidos los que están en su retardo. Va en una clave **aparte** y no como campo de
`sprites.pickups.<tipo>`, por dos motivos:
1. `sprites.pickups.<tipo>` y su alias `sprites.gems` conservan exactamente su forma `{ visible, placeholder }`, así
   que los `toEqual` existentes y el criterio «los recuentos `sprites.pickups.*` no cambian» quedan intactos.
2. Es lo único que demuestra **en el navegador** que las hojas `*_Spawn` cargan de verdad (texturas reales,
   `frameTotal`). Un fallo de carga deja `spawn = null` sin tocar `placeholder` (D3) y no se vería en ninguna otra
   sonda. Los tests unitarios con doble de `FrameCount` no lo cubren.

`xp` y `stone` valen siempre 0, lo que también comprueba «la gema y la piedra nunca aparecen». En el menú, el cero de
`renderCounts` lleva los cinco a 0.

## D6 · Procedencia

- Se copian `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png` desde
  `C:\Users\Adri\TFM\Tiny Swords (Update 010)\Resources\Resources\` a
  `public/assets/tiny-swords/Resources/Resources/` **sin recomprimir**. Los tres llevan sombra; las variantes
  `_(NoShadow)` no se tocan.
- Tres entradas en `content/asset-provenance.json` con el formato de `G_Idle.png`: `path`, `source` = `Tiny Swords
  (Update 010)/Resources/Resources/<X>_Spawn.png`, `version` «Update 010», `sha256` y `bytes`. **El sha256 y los
  bytes se calculan al aplicar** (`Get-FileHash -Algorithm SHA256` y `(Get-Item).Length`) sobre el fichero del pack,
  y deben ser iguales a los del fichero copiado. Esta fase no tiene shell y no los inventa.
- `guard-assets.mjs` **no cambia**: no prohíbe `_Spawn` por nombre, solo exige la entrada.
- Tests que hay que actualizar (sus escenarios cambian con el delta de `asset-provenance` y `sprite-rendering`):
  - `resource-provenance.test.ts` «Hojas de recursos no usadas»: quitar `_Spawn` de la regex y añadir `_(NoShadow)`
    explícito. Caso nuevo: cada `{G,W,M}_Spawn.png` está versionado exactamente una vez, con entrada.
  - `sheep-provenance.test.ts`: quitar `M_Spawn` de la regex (siguen `HappySheep_All` y `M_Idle_(NoShadow)`).
  - `appearance-schema.test.ts` «Solo las hojas usadas»: quitar `M_Spawn` (siguen `GoldMine_Destroyed`,
    `NoShadow`, `HappySheep_All`, `Fire` y `Rocks`).
  - `appearance-hazards.test.ts:217`: quitar `W_Spawn\.png` (siguen `Fire`, `W_Idle_(NoShadow)` y
    `Wood_Tower_InConstruction`).
  - Si algún test cuenta el total de entradas de la nota o de ficheros bajo `public/assets`, sube en 3.

## D7 · E2E (e2e-lite: 0 nuevos, 1 ampliado)

Se amplía el escenario de la spec **«Estructuras y guardias en el navegador» [E2E]**. En el código está dentro del
test de humo «Mapa real…» de `gameplay.spec.ts` (semilla 42, mapa real, modo manual, bloque «0021»), que ya hace las
dos lecturas: al arrancar y tras `step(everyTicks + 1)`. Es el mismo test, así que no hay elección entre dos: se
añaden aserciones sin pasos nuevos.
- En `first` (primer pintado, sin `step`): `sprites.pickupSpawns.wood` = `m.woodPiles.length`, `gold` = `meat` = `xp`
  = `stone` = 0, y `pickups.wood.visible` sigue igual a `m.woodPiles.length` (ya está).
- En `later` (tras `step(everyTicks + 1)`, ≥ 900 ticks ≈ 15 s de reloj ≫ 1.540 ms): `pickupSpawns.wood` = 0 y
  `resourceMisses(later)` = [], ya existente.

Lo demás va con tests unitarios sin navegador (`pickup-layer.test.ts` con el doble de `SpriteKit`, el nuevo
`pickup-motion.test.ts` y los de esquema): escalas en pantalla, fórmula del flote, fases distintas, congelado en 60
frames con el reloj quieto, aparición en orden una sola vez, reciclado de hueco, `clear()` y desfase, reserva de
`spawn` y de `idle`, y gema de 20 px. Para «congelado en pausa, oferta, tienda, obra y fin» basta con un test de
`RenderLayers` que llame a `advance(…, frozen)` por cada `status` y compare las posiciones pintadas: el congelado lo
decide `RenderLayers.advance` y es el mismo para todos.

## D8 · Invariancias

- El **núcleo** no cambia: `src/domain` y `src/application` sin diff. Por tanto no cambian `MAP_GOLDEN`,
  `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`, `SHEEP_GOLDEN`, `STONE_GOLDEN` ni `SITE_GOLDEN`, ni `BALANCE_BASELINE`
  (el lote del bot en `verify` lo confirma sin regenerarla).
- **Objetos del mapa** 820/904 en 42/123: los recogibles no están en `MapArtPlan` y `planMapArt` no cambia.
  `decorChoices` tampoco: la decoración no esquiva recogibles por su aspecto.
- **Sin azar nuevo**: fase y desfase salen solo del id. No hay `RandomGenerator` ni flujo `*_STREAM` nuevo.
- **Pools**: el de recogibles sigue en Σ topes = 436 sprites. No hay `Graphics` ni pools nuevos.

## D9 · Deuda de documentación
- `AGENTS.md`, bloque de 0029: «Árbol con `idle` 0–5 a 6 fps» → «0–3 a 4 fps». La torre goblin sigue en 0–3 a
  5 fps. Esta línea no la toca el implementer (solo escribe en `src/**`, `tests/**` y `content/**`): la hace el
  orquestador en la tarea de docs.
- Spec `sprite-rendering`, «Fases deterministas»: «en [0, 5] (árbol)» → «en [0, 3] (árbol)». Va en el MODIFIED del
  spec-writer (el autor lo aprobó). El test `map-probe.test.ts` ya comprueba [0, 3] y **no cambia**.
- «Frame de un árbol según su fase» usa una `idle` de escenario de 6 frames a 6 fps. Es un GIVEN propio del
  escenario, no los datos del repositorio, y su test (`map-animation.test.ts`) construye ese grupo, así que no
  contradice nada. Se deja salvo que el spec-writer lo cambie.
- La línea que añada este change a AGENTS.md, sección 1, la escribe el archive.

## Flujo de un frame (recogibles)
```
GameScene.update → layers.advance(Δ | ticks·TICK_MS, congelado?) → layers.render(snapshot)
  → PickupLayer.sync(snapshot.pickups, clock.ms)
      SlotPool: actualizar → liberar (hide) → nuevos (appearing ⇒ spawnStart, desfase si es el primer sync)
      por hueco: spawnFrame(…) ? hoja spawn + frame : hoja idle
                 y = p.y + floatOffset(float, id, ms)
```

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. | Tweens y `anims` de Phaser (opción B de la exploración): no se congelan con el `AnimClock`, no siguen `step(n)` y no se pueden probar sin motor. |

## API de Phaser consultada
Vía: MCP `phaser-docs` (`search_phaser_docs` «Sprite setTexture setFrame») sobre
`https://phaser.io/oss/docs/api-documentation/class/gameobjects-sprite.md#inherited-methods`. `Sprite` hereda
`setTexture(key, frame?)` y `setFrame` (componentes `Texture`/`TextureCrop`), `setPosition` y `setVisible`. Son los
mismos métodos que ya declara `SpriteLike` y que usa `SheepLayer` para cambiar de hoja en el mismo sprite. No se usa
ninguna API nueva del motor. Ante cualquier duda, mandan los tipos de `node_modules/phaser` (4.2.1).

## Rendimiento y seguridad
- **Presupuesto**: el núcleo no varía (0 ms/tick). En render, por frame y con el peor caso de 436 recogibles
  visibles: 436 `Math.sin` y restas (< 0,05 ms). `setPosition` ya se llamaba. `setTexture` solo 2 veces por recogible
  con aparición en toda su vida. Memoria de texturas: +3 hojas de 896 × 128 (≈ 0,45 MB en GPU cada una sin
  comprimir, con un tamaño de fichero de pocos KB). Bundle JS: unas decenas de líneas. Sin umbrales de fps en el gate.
- **Datos persistidos**: ninguno. Ni guardado ni export/import cambian.
- **Entradas externas**: `appearance.json` es contenido del repo validado con zod estricto (D1). Las hojas solo
  valen si figuran en la nota de procedencia (`SHEET_NOT_REGISTERED`) y el guardarraíl de assets lo exige sobre
  `git ls-files`.

## Riesgos
- **R1 · Cuadrícula**: si `frameTotal` de alguna hoja `*_Spawn` no es 7 o el frame 6 no coincide con `idle`, habrá
  salto o reserva de `spawn`. Hay que comprobarlo al copiar las hojas: test de carga con `frameTotal` en el E2E (D5)
  y revisión visual.
- **R2 · Sombra que flota**: la sombra incluida en la hoja sube y baja 4 px con el objeto. Se acepta (proposal); si
  estorba, se baja `amplitude` en el contenido.
- **R3 · Tamaño frente a radio**: 64 px de dibujo frente a `gemRadius` 5 puede hacer creer que el radio de recogida es
  mayor. Se ajusta en el contenido.
- **R4 · Iconos**: si `counterIcon` o `ResourceIcons` derivan el tamaño de `scale`, el HUD crecería. Hay que
  comprobarlo al aplicar y fijar el tamaño en su layout si hace falta (la spec `hud` no cambia).
- **R5 · Salto al pasar a idle**: resuelto con R_f (D2), así que d = 0 en el primer frame de `idle`. El coste es que
  R_f depende del frame de render en que termina la aparición: en tiempo real puede variar ±1 frame, y en modo manual
  es determinista.

## Ajustes aprobados tras tasks (autor)
- Flote sin salto con R_f para los recogibles que han tenido aparición (D2, D4). Escenarios nuevos: «Flote sin salto
  al terminar la aparición» y «Aparición fallida con fase por id»; «Aparición y paso a idle» ajustado.
- «Reserva de árbol y torre» (MODIFIED): la hoja del árbol **sin el frame 3** cae a reserva. `map-looks.test.ts`
  simulaba la hoja con `FrameCount` 5 («sin el frame 5»), así que hay que pasarlo a 3 frames (0–2), porque con la
  `idle` 0–3 una hoja de 5 frames ya cabe. Solo cambia el test; `resolveMapLooks` ya comprueba todos los frames
  usados.

## Contraste con las specs delta
- **Alineado con la spec**:
  - Fórmula `A · sen(2π(R + id·s)/T)` con `phaseStepMs` 989.
  - d = 0 durante la aparición y su retardo, y después flote desde R_f sin fase por id.
  - La reserva no flota y la gema `shape` sí.
  - `spawn` opcional, y `spawn` en `xp`/`stone` es error.
  - Rangos A ≥ 0, T > 0, s ≥ 0, e ≥ 0, y `diameter` > 0 obligatorio.
  - Retardo solo en el primer snapshot pintado, que se reinicia con `clear()`.
  - Durante el retardo, primer frame de `spawn`.
  - Fallo de `spawn`: `idle` sin reserva. Fallo de `idle`: reserva sin aparición.
  - Los recuentos `sprites.pickups.*` no cambian.
- **`world-camera`** (nueva respecto a la proposal): la posición pintada de un recogible incluye el flote. Ningún
  código de cámara cambia. El escenario «Gema que flota» (R = 400, id 0 → d = 4 → pantalla (880, 424)) se cubre con
  un test de la capa de recogibles y la conversión mundo → pantalla del test de cámara existente.
- **Desajuste menor para el spec-writer**: «Montones del repositorio» exige «inicios distintos dos a dos», pero no
  dice que el retardo solo afecta a `gold`, `wood` y `meat`. El requisito sí lo dice, así que es coherente y **no hace
  falta cambio**. No he encontrado contradicciones que obliguen a tocar la spec.
- **Criterios de la proposal frente a las specs**:
  - La proposal pide flote «en los cinco» y «4·sen(2π·R/1.600 + fase(id))». La spec lo concreta con la fase por paso
    en ms y con d = 0 durante la aparición y con reserva: es compatible, más preciso.
  - El resto de criterios tienen su escenario: tamaños 64 px / 0,75 / 20 px, una sola vez por id, montones
    escalonados, `guard:all` con 3 hojas, firmas y `BALANCE_BASELINE` intactas, 820/904 y ≤ 1 E2E.
  - El de AGENTS.md no es de spec y va en tasks.

## ADRs
- Ninguno. La decisión es de presentación, local a `PickupLayer` y a los datos de aspecto, y se revierte con un diff
  pequeño. No cambia capas, puertos, determinismo del núcleo ni formato persistido. Sigue los patrones de ADR-0012
  (aspecto por datos y reserva) y de 0029 (animación por reloj de render con fase determinista).
