# Design · 0012-sprite-rendering

## Resumen
Todo ocurre en el adaptador salvo un campo de solo lectura, `weapon`, en `ProjectileSnapshot`. Así se resuelve:
- `content/appearance.json` se valida con zod en infraestructura y se cruza con el contenido en la composición.
- El arte vive en `art/` (ignorado por git) y se **descubre en build** con `import.meta.glob`. Un `BootScene` carga
  solo las hojas presentes con `imageLoadType: 'HTMLImageElement'`, que no usa `blob:`, y genera un placeholder
  por Canvas. Después arranca el menú o la partida (ADR-0012).
- Las capas pasan de `CircleSprite` a una costura `SpriteLike`. El frame de cada animación lo elige el adaptador con
  un reloj de render propio, así que se congela con el mundo detenido y se prueba sin motor.
- Los cadáveres salen del delta del snapshot. No hace falta un indicador en el dominio, porque la única salida de un
  enemigo dentro de una partida es su baja (lo fija un test de dominio). Van a un pool aparte de `maxCorpses`.

Vía de consulta de la API de Phaser: MCP `phaser-docs` y, para la 4.2.1, los tipos de
`node_modules/phaser/types/phaser.d.ts` (del worktree del spike). Páginas citadas en "Referencias de Phaser".

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `Projectile` (`weapon` público), `Arsenal.launch` | Mod. | `launch(..., weaponId)` asigna `weapon = weapon.type.id`. Escalar, sin azar ni efecto en la simulación |
| domain | `ProjectileSnapshot.weapon`, `toProjectileSnapshot` | Mod. | Campo `readonly weapon: string` (spec auto-weapons) |
| application | — | — | Sin cambios |
| infrastructure/content | `appearanceSchema.ts` | Nueva | Esquema zod estricto del manifiesto (ver abajo) y mensajes |
| infrastructure/content | `loadAppearance.ts` | Nueva | `parseAppearance(raw)`, `checkAppearanceRefs(app, config)` y `loadAppearance(config)` → `Result<Appearance, DomainError>` con la ruta del campo |
| infrastructure/phaser/art | `artFiles.ts` | Nueva | `import.meta.glob('@art/**/*.png', …)` y `indexArt(record)` puro: ruta relativa → URL |
| infrastructure/phaser/art | `looks.ts` | Nueva | Tipos `Look`, `Anim`, `LookBook`; `sheetKey(aspect)`, `sheetsToLoad(app, index)` y `resolveLooks(app, frames)` puros |
| infrastructure/phaser/art | `animation.ts` | Nueva | `AnimClock`, `frameAt(anim, ms)`, `animDone(anim, ms)` y `Motion` (Δ, umbral 0,001, orientación). Puros |
| infrastructure/phaser | `SpriteLike.ts` | Nueva | Costura que sustituye a `CircleSprite`; `TintModes` inyectados; `applyLook(sprite, look, radius)` |
| infrastructure/phaser | `BootScene.ts` | Nueva | `preload`: hojas presentes. `create`: filtro `NEAREST`, placeholder y `scene.start(next)` |
| infrastructure/phaser | `PlayerView.ts` | Nueva | Sustituye al `Arc`: idle, walk, death, volteo, parpadeo (`playerVisible`) y `reset()` |
| infrastructure/phaser | `CorpseLayer.ts` | Nueva | Pool de `maxCorpses`: `spawn()` devuelve `false` con el tope lleno; caduca por `animDone`; `clear()` |
| infrastructure/phaser | `EnemyLayer.ts` | Mod. | `SpriteLike` + `LookBook` + `Motion` + destello con tinte `FILL`; al liberar un hueco por baja, `corpses.spawn` |
| infrastructure/phaser | `ProjectileLayer.ts`, `GemLayer.ts` | Mod. | Aspecto por `weapon` y `gem`; rotación `atan2` del Δ (0 en el primer frame) |
| infrastructure/phaser | `PulseLayer.ts` | Mod. | Solo expone `visibleCount` para la sonda |
| infrastructure/phaser | `SlotPool.ts` | Mod. | `hide(slot, cleared)`; libera en el **orden del snapshot anterior**; `clear()` con `cleared = true` |
| infrastructure/phaser | `renderCounts.ts` | Nueva | `SpriteCounts` (6 tipos × {visibles, placeholder}), objeto reutilizado |
| infrastructure/phaser | `RenderLayers.ts` | Nueva | Agrupa capas, `PlayerView`, `CorpseLayer`, `AnimClock` y `SpriteCounts`. `render(snapshot, deltaMs, paused)` y `clear()`. Sin Phaser como valor: se prueba con `FakeSprite` (R, mundo detenido, recuentos) |
| infrastructure/phaser | `GameScene.ts` | Mod. | Crea el kit y `RenderLayers`, resuelve el `LookBook` y llama a `layers.render` / `layers.clear`; pasa `SpriteCounts` a `onRender` |
| infrastructure/phaser | `enemyPalette.ts` | Eliminada | El color pasa a `placeholderColor` del manifiesto |
| infrastructure/phaser | `sceneKeys.ts` | Mod. | `BOOT_SCENE_KEY` |
| composition | `contentBoot.ts` | Nueva | `bootContent(raw, report)`: valida el contenido y el manifiesto y los cruza. Con error llama a `report.show` y `report.log` (`console.error`) y devuelve `null`, sin motor ni DOM, así que se prueba en Node (spec "Manifiesto inválido en el arranque") |
| composition | `main.ts` | Mod. | Usa `bootContent`; añade `loader.imageLoadType`, `[boot, menu, game]`, `capacity.corpses` y `probe.sprites`. Si `bootContent` devuelve `null`, no crea `Phaser.Game` |
| config | `vite.config.ts` | Mod. | Alias `@art` (`SPRINT_ART_DIR` o `art/`) y `assetsInlineLimit` que no inlina el arte |
| content | `appearance.json` | Nueva | Manifiesto del repo: describe el pack provisional por nombre de fichero, sin incluirlo |
| repo | `.gitignore`, ESLint ignores, `playwright.config.ts`, `scripts/fixture-art.mjs`, `scripts/build-art-e2e.mjs` | Mod./Nueva | `art/`, `dist-art/` y `tests/e2e/.fixture-art/`; 2.ª build de E2E con arte sintético (ver E2E) |

### Por qué cada capa
- **Dominio**: solo `weapon`, porque el arma no se puede deducir desde fuera (decisión 5 de la propuesta). No se
  añade un indicador de muerte (ver "Muerte frente a desaparición").
- **Esquema y cruce en infraestructura, no en `buildRunRules`**: el manifiesto es presentación. Si el cruce
  estuviera en el dominio, un manifiesto podría invalidar una partida, y la spec dice que "la comprobación no forma
  parte de las reglas de la partida". `checkAppearanceRefs` lee un `RunConfig` ya validado (infraestructura → dominio
  es una dependencia permitida) y lo llama la composición. Así, "El manifiesto no cambia la simulación" se cumple
  por construcción.
- **Todo lo de render en `infrastructure/phaser`**, con lógica pura (`looks`, `animation`, `SlotPool`) separada de
  los adaptadores finos (`BootScene`, `GameScene`). La lógica pura se prueba en Node sin el motor.
- **No hay puertos nuevos**: `SpriteLike` es una costura de testabilidad dentro de infraestructura, como lo era
  `CircleSprite`, y no un puerto de dominio.

## Manifiesto `content/appearance.json`
El esquema es el de la spec `sprite-rendering` y no se añade nada que no exija este alcance.
`z.strictObject` en todos los niveles:
```
Appearance = { maxCorpses: int ≥ 1, default: Aspect, player?: Aspect, gem?: Aspect,
               enemies?: Record<EnemyId, Aspect>, projectiles?: Record<string, Aspect> }
Aspect     = { sheet: SheetPath, frameWidth: int ≥ 1, frameHeight: int ≥ 1, scale: > 0,
               origin?: { x: [0,1], y: [0,1] }, facing?: 'right' | 'left', tint?: Hex,
               placeholderColor: Hex,
               animations: { idle: Anim, walk?: Anim, death?: Anim & { loop: false } } }
Anim       = { frames: int ≥ 0 [] (≥ 1), fps: > 0, loop: boolean }
SheetPath  = /^(?!.*(^|\/)\.\.(\/|$))[A-Za-z0-9_-][A-Za-z0-9_./-]*\.png$/  (sin '/' inicial, sin esquema)
Hex        = /^#[0-9a-fA-F]{6}$/  → number
```
- Cada aspecto tiene su `sheet`: vale para packs de una tira por animación (el provisional) y de una hoja por
  personaje (Tiny Swords), porque `frames` son índices de la hoja. No asume el pack provisional.
- `SheetPath` nunca se convierte en URL directamente: solo se busca en el índice del glob. Una ruta que no está en
  el índice da placeholder, nunca una petición.
- Errores: `parseAppearance` devuelve `invalidConfig(path, message)` con la ruta zod unida por `.` (p. ej.
  `enemies.bug.animations.walk.fps`). `checkAppearanceRefs` devuelve `enemies.<id>` o `projectiles.<id>` si el id no
  existe o el arma no es `projectile`.
- Un error del contenido o del manifiesto lo trata `bootContent` (composición): llama a `showContentError` y a
  `console.error` con el campo, y `main.ts` no crea `Phaser.Game`. Así no hay menú ni partida, con o sin `?e2e`.
- El manifiesto del repo tiene `maxCorpses: 64` y siete aspectos con `placeholderColor` distintos. Los colores salen
  de los de hoy (`PLAYER_COLOR`, `enemyPalette`, `PROJECTILE_COLOR`, color de gema), así que sin pack el juego se ve
  como ahora.
- **`pixelArt`**: no se activa globalmente. `BootScene` aplica `texture.setFilter(FilterMode.NEAREST)` solo a las
  hojas del pack. El HUD (`Text` a escala 1) y el placeholder (disco suavizado) conservan `LINEAR`. Si el pack final
  no es pixel art, ese change añadirá un campo al manifiesto. Hoy la spec lo prohibiría: rechaza campos desconocidos.

## Arte local, placeholders y carga
- **Ruta**: `art/` en la raíz (`/art/` en `.gitignore`). `sheet` es relativa a ella (p. ej.
  `tiny-rpg/Orc_Walk.png`). No va en `public/`, porque Vite lo copiaría entero a `dist/`.
- **Detección de ausencia en build**: `indexArt` convierte el resultado del glob en
  `ReadonlyMap<ruta relativa, url>`. `sheetsToLoad(appearance, index)` devuelve `{ key, url, frameWidth,
  frameHeight }` de las hojas presentes, sin duplicados por `sheetKey = art:<sheet>:<w>x<h>`. Sin pack la lista está
  vacía: no hay peticiones, ni 404 en consola, ni espera.
- **Fallos en runtime**: una hoja presente que falla al cargar (`FILE_LOAD_ERROR`) no entra en el
  `TextureManager`. `resolveLooks` recibe `frames(key) => number | null` (`textures.exists` y `frameTotal − 1`) y
  da placeholder al aspecto si la hoja no existe o algún índice de `frames` es ≥ al número de frames. La decisión es
  por aspecto (spec "Pack parcial" y "Frame fuera de la hoja").
- **Placeholder**: una sola textura `placeholder:disc`, un disco blanco de `PLACEHOLDER_PX` = 64 generado con
  `make.graphics(…, false).fillCircle(…).generateTexture(key, 64, 64)` y destruido después. Usa la Canvas API: ni
  `blob:` ni `data:` ni ficheros. Por elemento: `scale = 2r / 64`, origen (0,5, 0,5), tinte `placeholderColor`
  (`MULTIPLY` sobre blanco), `flipX` `false` y rotación 0. Conserva la temporización de las animaciones del aspecto,
  así que con placeholder hay cadáver durante `frames.length / fps`.
- **CSP**: `loader: { imageLoadType: 'HTMLImageElement' }` en el `GameConfig`. Las imágenes son `<img src>` de
  `'self'` y no se toca `index.html`. Los PNG de arte no se inlinan; si alguno se inlinara, `data:` también está
  permitido.
- **Preload en `BootScene`**: es la primera escena en los dos arranques (`scene: [boot, menu, game]`) y recibe de la
  composición la lista de hojas y la escena siguiente (`e2e ? GAME : MENU`). Las texturas son globales al juego:
  sobreviven a **Volver al menú** y a cada **Jugar**, y se cargan una vez por carga de página. Sin pack, la cola
  está vacía y `create` arranca la siguiente escena en el mismo paso. El arranque `?e2e` solo se retrasa un paso
  del motor antes de que `GameScene` cree la partida, así que "Carga en modo E2E" no cambia; lo vigila un E2E
  existente. `probe.screen` conserva su valor inicial.

## Costuras de testabilidad y capas
```ts
interface SpriteLike {
  setPosition(x: number, y: number): unknown;  setVisible(v: boolean): unknown;
  setTexture(key: string, frame?: number): unknown;  setFrame(frame: number): unknown;
  setScale(s: number): unknown;  setOrigin(x: number, y: number): unknown;
  setFlipX(f: boolean): unknown;  setRotation(rad: number): unknown;
  setTint(color: number): unknown;  setTintMode(mode: number): unknown;
}
interface SpriteKit { create(): SpriteLike; readonly tint: { multiply: number; fill: number } }
```
- `Phaser.GameObjects.Sprite` cumple `SpriteLike`. `GameScene` crea el kit con `this.add.sprite(0, 0,
  PLACEHOLDER_KEY).setVisible(false)` y con `Phaser.TintModes`. Las capas no importan Phaser como valor: siguen
  cargando en Node.
- Los tests usan un **fake** `tests/infrastructure/doubles/FakeSprite.ts`, que guarda el estado final (textura,
  frame, escala, flip, rotación, tinte, modo, visible). Se comprueba el estado, no la secuencia de llamadas, así que
  el test no se rompe si la capa cambia el orden de las llamadas. Se reescriben `enemy-`, `projectile-`, `gem-`,
  `layers-clear` y `player-blink`, y se añaden `slot-pool`, `corpse-layer`, `player-view`, `animation`, `looks`,
  `appearance-content` y `art-files`.
- **Estado por hueco**: `Motion { lastX, lastY, facingLeft, moving }` y `{ anim, startMs }`. Se reinician al
  aparecer (`appearing`) y en `PlayerView.reset()`, que se llama en `create` y tras R: primer frame en `idle` y sin
  voltear (spec "Hueco reutilizado", "Primer frame sin desplazamiento").
- **Animación** (`animation.ts`):
  - `frameAt`: con bucle, `frames[⌊ms·fps/1000⌋ mod n]`; sin bucle, `frames[min(n − 1, ⌊ms·fps/1000⌋)]`.
  - `animDone(anim, ms) = ms ≥ n·1000/fps`.
  - Al cambiar de estado, `startMs = clock.ms`.
  - `setFrame` solo cuando cambia el índice.
- **`AnimClock`**: `advance(deltaMs, frozen)` suma el `delta` del frame (tiempo de render, sin multiplicar por
  `speed`) salvo si `frozen = gate.paused || status === 'choosing'`. Con el mundo detenido, las capas tampoco
  recalculan estado ni orientación: cada sprite conserva su frame (spec "Mundo detenido"). Con `over`, el reloj
  sigue: el jugador hace `death` una vez y los cadáveres terminan.
- **Movimiento en frames sin tick**: con refrescos > 60 Hz hay frames que no ejecutan ningún tick (Δ = 0). Si se
  aplicara Δ sin más, `walk` e `idle` parpadearían (en el spike, a 165 Hz). `Motion` solo se actualiza cuando el
  `tick` del snapshot cambia respecto al último pintado, y en el resto de frames conserva estado y orientación. La
  spec ya lo recoge (escenario "Frames sin tick", a 120 Hz).
- **Destello**: dañado → `setTint(FLASH_COLOR).setTintMode(fill)`; no dañado → `setTint(tint ?? 0xffffff)
  .setTintMode(multiply)` (el `placeholderColor` si es placeholder). No toca el frame: la animación sigue (delta de
  auto-weapons). `TintModes` solo funciona en WebGL. `Phaser.AUTO` lo elige y Chromium headless usa WebGL por
  software (ver `probe.ts`).
- **Orden de pintado** (orden de creación): anillos, gemas, cadáveres, enemigos, proyectiles, jugador, HUD y
  overlays.

## Muerte frente a desaparición
- **Decisión: el delta del snapshot basta.** Dentro de una partida, un enemigo solo sale de `RunSnapshot.enemies`
  por `Horde.removeDead`, que suma una baja: no hay despawn ni compactación por fin de partida (`Run.step` no
  modifica la horda en `over`). Las salidas que no son bajas pasan por caminos explícitos del adaptador:
  - **R**: `GameScene.restart` → `EnemyLayer.clear()`, que no genera cadáveres.
  - **Volver al menú**: `SHUTDOWN` destruye los objetos.

  Añadir un indicador al dominio sería un cambio en el núcleo sin otro uso.
- **Lo que protege la suposición**: un test de dominio nuevo (spec "Salidas iguales a bajas") comprueba que, para la semilla 42 y 1.200 ticks
  agrupados como frames (1 y 8 ticks por grupo), el número de ids que salen entre dos snapshots consecutivos es igual
  al aumento de `kills`. Si un change futuro añade otra salida (p. ej. despawn por distancia), este test falla y
  obliga a revisar la decisión.
- `SlotPool.sync` libera los huecos no vistos **en el orden de la lista del snapshot anterior** (guarda los ids del
  último `sync` en un array reutilizado de capacidad fija) y llama a `hide(slot, false)`. `EnemyLayer` intenta
  entonces `corpses.spawn(lastX, lastY, facingLeft, look, radius)` si el aspecto tiene `death`. `clear()` llama a
  `hide(slot, true)` y no genera cadáveres. Así se cumplen el orden de llenado del tope (spec "Tope de cadáveres")
  y "Salida sin baja". Un enemigo que nunca tuvo hueco no se libera y no deja cadáver.
- **`CorpseLayer`**:
  - `maxCorpses` sprites preasignados (desde el manifiesto, vía `SceneCapacity.corpses`).
  - `spawn` toma un hueco libre o devuelve `false`: con el tope lleno no muestra la muerte sobrante y no recicla
    cadáveres en curso.
  - `sync(clockMs)` oculta los que cumplen `animDone` y elige su frame con `frameAt`.
  - `clear()` oculta todos sin terminar.

  No hay eventos ni tweens: al apagar la escena no queda ninguna animación en curso (spec "Limpieza de la vista").
- R limpia jugador, enemigos, cadáveres, proyectiles, pulsos y gemas antes del primer render de la partida nueva.
  En **Volver al menú**, `onScreen('menu')` pone a 0 `probe.sprites`.

## Sonda de render
- `onRender(snapshot, results, sprites: SpriteCounts)`. `SpriteCounts` es un objeto que la escena reutiliza
  (`{ player, enemies, corpses, projectiles, pulses, gems }`, cada uno `{ visible, placeholder }`; `player` y
  `enemies` añaden `walking`, necesario para "CSP con arte y con e2e": "reproducen `walk`"). Cada capa lleva
  sus contadores incrementales, sin recorrer los huecos por frame. El jugador cuenta como no visible cuando
  `playerVisible` es `false`.
- La composición lo asigna a `probe.sprites`. La sonda sigue existiendo solo con `?e2e` (`defineProperty` actual) y
  leerla no cambia nada. `tests/e2e/probe.ts` añade `weapon` a los proyectiles y el tipo `sprites`.

## Flujo de un frame
```
GameScene.update(delta)
  esc/R/elección → PauseGate (sin cambios)
  snapshot = gate.frame(tickRun, delta, input, speed)            // núcleo, 0..speed ticks
  layers.render(snapshot, delta, paused):                         // RenderLayers
    clock.advance(delta, paused || snapshot.status === 'choosing')
    newTick = snapshot.tick !== lastTick
    pulses.sync · gems.sync · enemies.sync(→ corpses.spawn) · corpses.sync(clock)
    projectiles.sync · player.sync(snapshot, clock, newTick) · hud/overlays (sin cambios)
    counts → onRender(snapshot, results, counts)
```

## E2E
- **Build principal sin pack**, como hoy. La suite existente no cambia ningún `goto`. Los nuevos E2E de la sonda
  (recuentos, "Cinco ciclos", R y **Volver al menú** con cadáveres) corren aquí con placeholders, y cierran 0009 · W2.
- **Build con arte sintético** (decisión del usuario, 2026-11-20: sí, con pocos E2E):
  - `scripts/fixture-art.mjs` (Node con `node:zlib`, sin dependencias) lee `content/appearance.json` y genera, por
    hoja, un PNG propio de colores planos de `frameWidth × (máx. índice + 1)` por `frameHeight` (una fila, con un
    color por frame) en `tests/e2e/.fixture-art/`, ignorado por git. Si una misma hoja aparece con dos tamaños de
    frame, el script falla.
  - `scripts/build-art-e2e.mjs` genera las hojas, fija `process.env.SPRINT_ART_DIR` y llama a `build()` de Vite con
    `outDir: 'dist-art'`. Es multiplataforma: no hay variables de entorno en la línea de comandos de Windows.
  - `playwright.config.ts`: dos `webServer` (4173 sin arte; 4174 con `node scripts/build-art-e2e.mjs && vite
    preview --outDir dist-art --port 4174 --strictPort`) y dos proyectos. `chromium` ignora `art-*.spec.ts`;
    `chromium-art` solo ejecuta `art-*.spec.ts`, con `baseURL` en el puerto 4174.
  - Contiene **4 tests**: "CSP con arte desde el menú", "CSP con arte y con e2e" (0 placeholders y `walking` > 0),
    "Pack parcial" (la prueba intercepta las hojas de `player` y `memory-leak` y responde 200 con bytes no
    decodificables) y "Frame fuera de la hoja" (intercepta la hoja de `bug` y sirve una imagen de un solo frame).
    El ejemplo literal de la spec ([0, 1, 2, 7] con 128 × 32) se cubre en el unitario de `resolveLooks`.
  - Las fixtures son arte propio generado: no infringen "ningún PNG versionado bajo la carpeta de arte" ni la
    licencia del pack.
- **Por qué no se intercepta en la build sin arte**: con la detección en build, una hoja ausente no se pide (spec
  "Sin pack": "no se ha pedido ninguna hoja"), y pedirla siempre daría 404 en consola (ADR-0012, opción 1).
- **"Manifiesto inválido en el arranque"**: sin navegador, con `bootContent` (composición) y dobles de `report` y de
  la creación del juego.
- **Reparto en la build sin arte**:
  - Nuevos E2E de la sonda: "Sin pack", "CSP sin pack" (se amplía `smoke.spec.ts`), "Recuento coherente",
    "Sonda en el menú", "Volver al menú con cadáveres en curso", "Cinco ciclos menú-partida" y "Cinco reinicios
    seguidos".
  - Ajustes en `menu-flow.spec.ts` y `results.spec.ts` para leer `sprites`.
  - Lo demás (animación, orientación, tope de cadáveres, escala, fin de partida) es unitario con `FakeSprite`,
    porque en navegador no es determinista frame a frame.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. PNG de fixtures con `node:zlib` (Node ≥ 22); placeholder con la Canvas API de Phaser | `pngjs` u otro codificador: innecesario para hojas de color plano |

## Rendimiento y seguridad
- **Núcleo**: solo se copia un string por proyectil al ensamblar el snapshot (una vez por frame). El presupuesto de
  `TickRun` no cambia y `npm run bench` sirve de control.
- **Adaptador**: el peor caso es 200 enemigos + 64 cadáveres + `maxProjectiles` + `maxGems`. Por sprite y frame
  cuesta `setPosition`, un `frameAt` aritmético y `setFrame`/`setFlipX`/`setTint` solo si cambian. Objetivo:
  < 1 ms/frame de sync en la máquina de desarrollo (el spike pintó 200 a ~165 fps). Sin asignaciones por frame:
  pools, `Motion` y `SpriteCounts` se reutilizan, y el orden de `SlotPool` va en un array preasignado. Hay un bench
  opcional, no bloqueante, de 200 enemigos animados en las capas con `FakeSprite`.
- **Bundle**: +1 JSON (~3 KB) y un esquema zod. Sin pack, ningún PNG. La build de CI que se despliega no tiene pack
  (job `quality`). Una build local con pack lleva el arte en `dist/` y no se publica.
- **Entradas externas**: el manifiesto es contenido versionado validado con zod (regla 5). `sheet` no admite `..`,
  rutas absolutas ni esquemas, y nunca se usa como URL: solo como clave del índice del glob, que contiene las URL de
  Vite del mismo origen. No se persiste nada nuevo ni se toca `localStorage`. La CSP no cambia.

## Referencias de Phaser (MCP `phaser-docs` + tipos 4.2.1)
- `LoaderPlugin#image`: `loader.imageLoadType: "HTMLImageElement"` —
  `/api-documentation/class/loader-loaderplugin.md#instance-imagekey-url-xhrsettings`. Tipos:
  `Types.Core.LoaderConfig.imageLoadType`, `ImageFile.onProcess` (crea una URL de objeto con XHR).
- `LoaderPlugin#spritesheet` (`frameWidth`/`frameHeight`) — `/api-documentation/class/loader-loaderplugin.md#spritesheet`.
- `Loader.Events.FILE_LOAD_ERROR` — `/api-documentation/event/loader-events.md#file_load_error`.
- `Graphics#generateTexture` (Canvas API) — `/api-documentation/class/gameobjects-graphics.md#generatetexture`.
- `Texture#setFilter` (`NEAREST` para toda la textura) — `/api-documentation/class/textures-texture.md#instance-setfilterfiltermode`.
- Tipos 4.2.1: `Phaser.TintModes` (`MULTIPLY`, `FILL`; solo WebGL), `Sprite#setFrame`, `Texture#frameTotal`
  (incluye `__BASE`).

## ADRs
- `docs/adr/0012-arte-local-descubierto-en-build.md` (nuevo, *propuesta*): arte descubierto en build en `art/`,
  `imageLoadType`, `BootScene`, placeholder por Canvas y animación por reloj de render.
- ADR-0006: se aplica tal cual, con la anotación de que el pool de cadáveres es aparte y de que `SlotPool` libera en
  el orden del snapshot anterior.
- ADR-0011: se mantiene. `BootScene` es una escena técnica previa que no cambia los modos de arranque.

## Contraste con las specs definitivas (cerrado antes de `tasks`)
- `sprite-rendering`:
  - Recoge "último snapshot de un tick distinto" ("Frames sin tick"), la build con arte sintético, "Manifiesto
    inválido en el arranque" sin navegador y "Salidas iguales a bajas".
  - El design solo ajusta tres cosas: `bootContent` en la composición, `walking` en la sonda y el reparto de E2E.
- `main-menu`: los recuentos a 0 desde el primer frame del menú salen de `onScreen('menu')`. "Cinco ciclos" usa
  `probe.runs`, que ya existe.
- `run-results`: "Primer frame tras reiniciar" con 200/32/1/300/10 se cubre en unitario (`clear()` de cada capa y
  `PlayerView.reset()`). "Cinco reinicios seguidos" va en E2E.
- `auto-weapons`: `weapon` en el dominio. Destello y tinte, `projectiles.<weapon>` y "Sprites de proyectiles" en
  las capas.
- Sin preguntas abiertas.

## Riesgos que se vigilan en apply
- **Claves del glob con alias**: se comprueba la forma real de las claves de `import.meta.glob('@art/…')` en Vite 8
  con un test de `artFiles` sobre las fixtures. Si el alias no sirve en el patrón, se usa una ruta relativa fija y
  `SPRINT_ART_DIR` copia las fixtures a una carpeta ignorada.
- **Imagen no decodificable**: se comprueba que Chromium no la registra como `console.error` y que Phaser solo emite
  `FILE_LOAD_ERROR` o un `warn`. Si Chromium la registrara, "Pack parcial" filtraría por la URL interceptada.
- **Tiempo de CI**: la 2.ª build corre en paralelo con la 1.ª (dos `webServer`). Si el job `e2e` se acerca a su
  límite de 6 min, se sube a 8 min sin añadir más tests a `chromium-art`.
