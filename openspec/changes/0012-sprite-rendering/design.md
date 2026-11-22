# Design · 0012-sprite-rendering

## Resumen
Todo ocurre en el adaptador Phaser, en el contenido y en el repo. **El diff de `src/domain` y `src/application` es
0 líneas**: los ids de enemigo solo viven en `content/` y en `enemyPalette.ts`, que se elimina. `run.json` no cambia.
- Arte CC0 de Tiny Swords Update 010 versionado en `public/assets/tiny-swords/` (8 PNG) con `PROVENANCE.json`
  y un guardarraíl de licencia sobre `git ls-files` (ADR-0012 nuevo).
- `content/appearance.json` (zod) describe hojas, frames, escala y origen. Se cruza con los ids de enemigo al
  arrancar.
- `BootScene` carga las hojas con `imageLoadType: 'HTMLImageElement'` (CSP intacta) y arranca menú o partida.
- Capas sobre una costura `SpriteLike` (sustituye a `CircleSprite`); frames elegidos por un reloj de render propio
  que se congela con el mundo detenido.
- Cadáveres por delta del snapshot en un pool aparte; sonda `sprites` para cerrar 0009 · W2.

Reutilizado de la planificación aparcada: `frameAt`/`AnimClock`, `Motion` (volteo por Δ y "frames sin tick"),
`SpriteLike` + `FakeSprite`, muerte por delta y su test de dominio, `CorpseLayer`, sonda de recuentos,
`imageLoadType`, `BootScene`, placeholder por Canvas. Obsoleto y retirado: `import.meta.glob`, `@art`, `art/`,
`SPRINT_ART_DIR`, segunda build E2E con fixtures y `weapon` en `ProjectileSnapshot` (ya no se toca el núcleo).

**Vía de consulta de Phaser**: MCP `phaser-docs` (la doc publicada cita fuentes de v4.1.0). En este worktree no hay
`node_modules` legible desde la fase de design: los tipos de `node_modules/phaser` (4.2.1) se confirman en la
primera tarea de infraestructura y mandan si discrepan. Páginas en "Referencias de Phaser".

## Decisiones

### D1 · Mapeo de ids (sin tocar stats)
| Id actual | Stats (vel / radio / vida / daño / xp) | Id nuevo | Por qué |
|---|---|---|---|
| `bug` | 90 / 10 / 10 / 5 / 1 | `goblin-torch` | Enemigo base, rápido y frágil, el más numeroso. El goblin de antorcha es la unidad básica cuerpo a cuerpo del pack y la silueta más pequeña |
| `memory-leak` | 45 / 22 / 45 / 15 / 4 | `goblin-tnt` | Tanque lento de golpe fuerte y hitbox grande. El TNT carga una mochila de dinamita: silueta ancha y "explosiva", y en 0016 será el guardia lento |
| `merge-conflict` | 70 / 16 / 20 / 8 / 2 | `goblin-barrel` | Intermedio. El barril encaja con un tamaño medio y en 0016 será el kamikaze que corre hacia el jugador |

- Renombrado **in situ**: mismo orden de `types` en `enemies.json` y en cada segmento de `waves.json`. El sorteo
  de tipo usa índices sobre esas listas, así que conservar el orden mantiene el determinismo y la banda 25-35 de 0010
  sin recalibrar. `EnemyCatalog` usa `Map` (orden de inserción) y no ordena por id.
- Afecta a `content/`, `tests/support/{builders,finishedRuns}.ts`, `tests/bench/run.bench.ts`, tests de dominio y
  capas y, mediante deltas, a las specs vivas. En la prosa, "bug" como "error" no se toca: la búsqueda es por
  literal entre comillas (`'bug'`, `"bug"`) y por `bug` en tablas de escenarios.

### D2 · Ubicación y carga de los assets
- **`public/assets/tiny-swords/<ruta original del pack>`** (ADR-0012, opción 1). Frente a importarlos con Vite: URL
  estables que el manifiesto expresa como datos, sin `assetsInlineLimit` (que convertiría `Arrow.png` en `data:`) y
  sin `import` por PNG. El coste (todo `public/` se publica) lo cubre el guardarraíl.
- URL = `import.meta.env.BASE_URL + 'assets/tiny-swords/' + file`. La compone la **composición** (`assetUrl`) y la
  pasa a `BootScene`: funciona igual en `vite dev`, `vite preview` y Pages (`/tfm-survivors/`).
- `loader: { imageLoadType: 'HTMLImageElement' }` en el `GameConfig`. Sin `blob:`; la CSP de `index.html` no cambia.
- `file` del manifiesto: regex `^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_./-]*\.png$` (sin `/` inicial, sin `..`, sin
  esquema). Nunca llega a la URL sin pasar por ella. Además, `public/assets/tiny-swords/` + `file` MUST figurar en
  `files[].path` de `PROVENANCE.json`: `parseAppearance(raw, registered)` recibe esa lista y la composición la
  obtiene importando el JSON (R6).
- **Sin `pixelArt`** ni cambio de filtro: todos los sprites se dibujan a escala < 1 y el `NEAREST` en reducción da
  dientes de sierra y parpadeo. El suelo va a escala 1 (idéntico con cualquier filtro). El HUD no se ve afectado.

### D3 · Preload común (menú y `?e2e`)
- `scene: [boot, menu, game]`. Phaser arranca la primera de la lista; `BootScene.create` hace
  `scene.start(e2e ? GAME_SCENE_KEY : MENU_SCENE_KEY)`. El modo de arranque de ADR-0011 no cambia: solo se antepone
  una escena técnica. Volver al menú no pasa por `BootScene` (las texturas siguen en el `TextureManager`).
- `preload`: `load.spritesheet(key, url, { frameWidth, frameHeight })` por `file` distinto (clave = `file`), y
  `FILE_LOAD_ERROR` solo anota la clave fallida (sin lanzar). `create`: genera `placeholder:disc` (disco blanco de
  64 px con `Graphics.generateTexture`, sin URL) y arranca la escena siguiente.
- Coste: 8 PNG del mismo origen, decenas de ms en local y CI. `probe.screen` conserva su valor inicial; la sonda de
  snapshot sigue a `null` hasta el primer render de `GameScene`, que es lo que esperan los E2E existentes. No se toca
  ningún `goto`.

### D4 · Subconjunto exacto de PNG (8 ficheros)
Origen: `C:\Users\Adri\TFM\Tiny Swords (Update 010)\`. Destino: la misma ruta bajo `public/assets/tiny-swords/`.
Dimensiones leídas de la imagen en esta fase; las fija un test (D9) leyendo la cabecera IHDR.

| # | Ruta | Frame | Rejilla | Uso (índices) |
|---|---|---|---|---|
| 1 | `Factions/Knights/Troops/Archer/Blue/Archer_Blue.png` | 192 | 8 × 7 | jugador: idle 0-5, walk 8-13 |
| 2 | `Factions/Knights/Troops/Archer/Arrow/Arrow.png` | 64 | 1 × 2 | proyectil: frame 0 |
| 3 | `Factions/Knights/Troops/Dead/Dead.png` | 128 | 7 × 2 | cadáver: 1-13, sin bucle (el 0 está vacío) |
| 4 | `Factions/Goblins/Troops/Torch/Red/Torch_Red.png` | 192 | 7 × 5 | `goblin-torch`: idle 0-6, walk 7-12 |
| 5 | `Factions/Goblins/Troops/TNT/Red/TNT_Red.png` | 192 | 7 × 3 | `goblin-tnt`: idle 0-5, walk 7-12 |
| 6 | `Factions/Goblins/Troops/Barrel/Red/Barrel_Red.png` | **128** | 6 × 6 | `goblin-barrel`: idle 0, walk 18-23 (fila "move"; se confirma a ojo en apply) |
| 7 | `Resources/Resources/G_Idle.png` | 128 | 1 × 1 | gema de XP: frame 0 (saco de oro) |
| 8 | `Terrain/Ground/Tilemap_Flat.png` | 64 | 10 × 4 | suelo: frame 11 (centro del bloque de hierba 3 × 3) |

- Gema: `G_Idle` (oro) se lee como "recompensa" y contrasta con la hierba; `M_Idle`/`W_Idle` se descartan.
- Hierba: un solo tile interior de `Tilemap_Flat` repetido con `TileSprite` del tamaño de la vista (960 × 540).
  Sin bordes ni autotiling (0014).
- Color: Arquero azul contra goblins rojos (contraste de bando). Los tres goblins se distinguen por silueta.
- No entran: `.aseprite`, `.DS_Store` (hay en todas las carpetas del pack), `Archer + Bow.zip`, otros colores,
  `Warrior`, `Pawn`, `HappySheep`, `Buildings`, `UI`, `Effects`, `Deco`.
- **Peso medido en apply (tarea 2.4): 219.672 bytes (≈ 0,21 MB) los 8 PNG**; dimensiones IHDR iguales a la
  tabla. Texto original de la fase de design: no medido (esta fase no tiene shell). Estimación por dimensiones y paleta: 0,1-0,3 MB en total. La
  tarea de copia lo mide (`Get-Item`/`fs.statSync`) y lo escribe en `bytes` de `PROVENANCE.json`, que el
  guardarraíl comprueba; el verify-report anota el peso de `dist/`. Memoria de GPU: ~20 MB (RGBA de las 8 hojas;
  la del Arquero, 1536 × 1344, es la mayor con ~8 MB).

### D5 · Escala y origen frente a la hitbox
- La hitbox no cambia (radios: jugador 16, torch 10, tnt 22, barrel 16, flecha 4, gema 5).
- `scale` y `origin` van por aspecto en `appearance.json`, sin constantes en código. Criterio: el **cuerpo visible**
  (sin sombra) mide ≈ el diámetro de la hitbox.

| Aspecto | Cuerpo en la hoja | `scale` | Cuerpo en pantalla | Diámetro hitbox |
|---|---|---|---|---|
| Arquero | ~55 px / 192 | 0.6 | ~33 | 32 |
| `goblin-torch` | ~50 / 192 | 0.45 | ~23 | 20 |
| `goblin-tnt` | ~60 / 192 | 0.75 | ~45 | 44 |
| `goblin-barrel` | ~45 / 128 | 0.7 | ~32 | 32 |
| Flecha | ~60 de largo / 64 | 0.5 | ~30 de largo | 8 |
| Gema | ~40 / 128 | 0.3 | ~12 | 10 |
| Cadáver | ~40 / 128 | 0.5 | ~20 | — |

- **Origen en el centro del cuerpo, no en los pies**: la posición del snapshot es el centro del círculo de colisión.
  Con el ancla en los pies el contacto se vería en la sombra. En las hojas de 192 px el cuerpo está centrado
  (≈ 0,5; 0,5) y la sombra queda por debajo; el valor por aspecto permite corregir cualquier hoja. El ancla en los
  pies tiene sentido con orden por `y`, que llega con el mundo de 0013.
- La flecha usa origen (0,5; 0,5) y rotación `atan2(dy, dx)` (+π si `facing = 'left'`). **En su primer frame la
  rotación es 0** (π si mira a la izquierda), como fija la spec; no se usa el vector jugador → proyectil.
- Cada `Look` declara `facing: 'right' | 'left'` (orientación del dibujo sin voltear). Todas las hojas de Update 010
  miran a la derecha; `flipX = (mirar a la izquierda) !== (facing === 'left')`.

### D6 · Pool de cadáveres
- **Muerte = salida del snapshot**. Dentro de una partida, un enemigo solo sale de `enemies` por
  `Horde.removeDead`, que suma una baja. R (`GameScene.restart` → `clear()`) y Volver al menú (`SHUTDOWN`) son
  caminos explícitos del adaptador que no generan cadáveres. Un test de dominio nuevo (solo en `tests/`) fija la
  suposición: semilla 42, 1.200 ticks agrupados de 1 y de 8 en 8, ids salientes = aumento de `kills`.
- `SlotPool`: `hide(slot, cleared)`; libera los no vistos **en el orden del snapshot anterior** (array de ids
  preasignado de capacidad fija) y `clear()` pasa `cleared = true`.
- `CorpseLayer`: `maxCorpses` sprites preasignados (`appearance.json`: **64**). `spawn(x, y, facingLeft)` toma un
  hueco libre o devuelve `false`: con el tope lleno la muerte sobrante no se muestra y no se reciclan cadáveres en
  curso. `sync(clockMs)` elige el frame con `frameAt` y oculta los que cumplen `animDone`. `clear()` oculta todos.
- Dimensionado: muerte de 13 frames a 12 fps ≈ 1,08 s. 64 cubre ráfagas de pulso de varias decenas de bajas en
  un segundo; el ritmo medio a los 480 s ronda 6 bajas/s.
- Sin tweens ni eventos: al apagar la escena no queda nada pendiente.

### D7 · Sonda E2E de sprites (cierra 0009 · W2)
- `onRender(snapshot, results, sprites)`. `SpriteCounts` es un objeto reutilizado:
  `{ ground, player, enemies, corpses, projectiles, pulses, gems }`, cada uno `{ visible, placeholder }`, más
  `enemyPlaceholders: Record<EnemyId, number>` (claves preasignadas con los ids de `enemies.json`). Sin `walking`:
  la animación se prueba en unitarios. Cada capa lleva contadores incrementales (sin recorrer huecos). El jugador
  cuenta como no visible si `playerVisible` es `false`. Los pulsos nunca son placeholder (anillo).
- La composición lo asigna a `probe.sprites` (solo con `?e2e`, como hoy). `onScreen('menu')` lo pone a 0.
- `snapshot` y `sprites` se asignan en la misma llamada síncrona, así que cualquier lectura ve un par coherente. El
  E2E "Cinco ciclos" instala un muestreador con `requestAnimationFrame` en la página que acumula discrepancias entre
  `sprites.*.visible` y el snapshot (enemigos, proyectiles, pulsos, gemas) y comprueba `corpses.visible = 0` tras
  cada Volver al menú y cada R. La aserción es al final, sin `page.evaluate` por frame.
- `tests/e2e/probe.ts` añade el tipo `sprites`.

### D8 · Guardarraíl de licencia
- **Regla en `.claude/hooks/guard-assets.mjs`** (fuente única de reglas, AGENTS.md §3): exporta
  `checkAssets({ files, provenance, digest }) → string[]`, pura. `digest(path)` devuelve `{ sha256, bytes }` y se
  inyecta (en tests, un mapa).
- **Ejecución en `scripts/guard-staged.mjs`**: hoy filtra binarios y revisa fichero a fichero; se añade una pasada
  global, una sola vez, en los dos modos, sobre `git ls-files -z` (el índice: en pre-commit incluye lo preparado; en
  CI, lo versionado). El contenido de las imágenes se lee del índice como `Buffer` (`git cat-file blob :<ruta>`), así
  que el hash coincide en Windows y Linux (`*.png binary` en `.gitattributes`). Así entra en `guard:all` → `verify`
  → CI y en pre-commit sin script nuevo.
- Alcance: **todo** asset gráfico del repo (`.png .jpg .jpeg .gif .webp .svg .ico .bmp .aseprite`, sin distinguir
  mayúsculas), en cualquier carpeta. Hoy no hay ninguno fuera de los 8 PNG.
- Reglas (cada mensaje nombra la ruta o el campo): ficheros prohibidos en cualquier carpeta (`.DS_Store`,
  `Thumbs.db`, `desktop.ini`, `.aseprite`, `.zip .rar .7z .tar .gz`); `Free Pack`/`Free_Pack`/`FreePack` (sin
  mayúsculas) en una ruta versionada o en `source`; asset sin entrada; entrada sin fichero; `path` repetido;
  `sha256`/`bytes` distintos; cabecera o entrada incompleta; `license` ≠ `CC0`; `version` ≠ `Update 010`.
- `PROVENANCE.json` en `public/assets/tiny-swords/` (machine-readable; el texto humano va en `note`):
  `{ pack: "Tiny Swords", author: "Pixel Frog", version: "Update 010", license: "CC0",
  confirmedOn: "2026-11-22", homepage: <URL de itch.io>, note,
  files: [{ path, source, version: "Update 010", sha256, bytes }] }`. `path` relativo a la raíz del repo; `source`
  es la ruta dentro del pack con prefijo `Tiny Swords (Update 010)/`. **Sin captura ni enlace a prueba** de la
  confirmación: basta la fecha (spec `asset-provenance`).
- Test `tests/guardrails/assets.test.ts` con listas simuladas (escenarios de `asset-provenance`); pasa con el
  estado real del repo.
- El modo hook (`check(toolInput)`) solo aplica las reglas de ruta. Las copias de PNG se hacen por shell, que el hook
  de escritura no ve: la barrera real es commit + CI.

### D9 · Manifiesto `content/appearance.json`
`z.strictObject` en todos los niveles; esquema en `src/infrastructure/content/appearanceSchema.ts`.
```
Appearance = { maxCorpses: int ≥ 1,
               player: Moving, enemies: Record<EnemyId, Moving>, projectile: Still, gem: Still,
               ground: Still, corpse: Base & { death: Anim (loop: false) } }
Base       = { sheet: { file: AssetPath, frameWidth: int ≥ 1, frameHeight: int ≥ 1 },
               scale: > 0, origin: { x: [0,1], y: [0,1] }, facing: 'right' | 'left',
               placeholderColor: Hex }
Still      = Base & { idle: Anim }            Moving = Still & { walk: Anim }
Anim       = { frames: int ≥ 0 [] (≥ 1), fps: > 0, loop: boolean }
```
- La hoja va **en línea en cada aspecto** (antes, un mapa `sheets` aparte): así el error nombra
  `enemies.goblin-torch.sheet.frameWidth`, como piden los escenarios. La clave de textura es `file`.
- El suelo es un aspecto más (`idle` de 1 frame; `TileSprite` con `tileScale = scale`, origen (0, 0)).
- `checkAppearanceRefs(appearance, config)` (composición, en `bootContent`): cada id de `enemies.json` tiene `Look`
  y no sobra ninguno (el error nombra el id). Un error muestra `showContentError` y no crea `Phaser.Game`.
- Test de contenido (Node, sin dependencias): lee la cabecera IHDR de cada PNG (ancho y alto en los bytes 16-23) y
  comprueba que la rejilla es exacta y que ningún índice supera `cols × rows − 1`. Además, que cada `file` está en
  `PROVENANCE.json` y que toda entrada de `PROVENANCE.json` la usa el manifiesto (nada de peso muerto).
- `placeholderColor` sale de los colores actuales (`PLAYER_COLOR`, `enemyPalette`, color de proyectil y de gema).

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain / application | — | — | **Sin cambios** |
| content | `enemies.json`, `waves.json` | Mod. | Solo ids (D1), mismo orden |
| content | `appearance.json` | Nueva | D9 |
| infrastructure/content | `appearanceSchema.ts`, `loadAppearance.ts` | Nueva | `parseAppearance` → `Result<Appearance, DomainError>` con ruta del campo |
| infrastructure/phaser/art | `animation.ts` | Nueva | `AnimClock`, `frameAt`, `animDone`, `Motion` (Δ, umbral 0,001, orientación). Puros |
| infrastructure/phaser/art | `looks.ts` | Nueva | `resolveLooks(appearance, frames)` puro: textura cargada y frames dentro de la hoja, o placeholder por aspecto |
| infrastructure/phaser | `SpriteLike.ts` | Nueva | Costura (`setPosition`, `setVisible`, `setTexture`, `setFrame`, `setScale`, `setOrigin`, `setFlipX`, `setRotation`, `setTint`, `setTintMode`); `SpriteKit` con `TintModes` inyectados |
| infrastructure/phaser | `BootScene.ts` | Nueva | D3 |
| infrastructure/phaser | `PlayerView.ts` | Nueva | Sustituye al `Arc`: idle/walk, volteo, parpadeo (`playerVisible`), `reset()` |
| infrastructure/phaser | `CorpseLayer.ts` | Nueva | D6 |
| infrastructure/phaser | `EnemyLayer.ts` | Mod. | `SpriteLike` + `Look` por tipo + `Motion`; destello `setTint(0xffffff)` + `FILL`; baja → `corpses.spawn` |
| infrastructure/phaser | `ProjectileLayer.ts` | Mod. | Flecha; rotación por Δ; 0 (o π) en el primer frame |
| infrastructure/phaser | `GemLayer.ts` | Mod. | Sprite de gema (frame fijo) |
| infrastructure/phaser | `PulseLayer.ts` | Mod. | Solo `visibleCount` para la sonda |
| infrastructure/phaser | `SlotPool.ts` | Mod. | `hide(slot, cleared)` y orden del snapshot anterior |
| infrastructure/phaser | `renderCounts.ts`, `RenderLayers.ts` | Nueva | `RenderLayers` agrupa capas, `PlayerView`, `CorpseLayer`, `AnimClock` y `SpriteCounts`; `advance(deltaMs, frozen)`, `render(snapshot)`, `clear()`. Sin Phaser como valor |
| infrastructure/phaser | `GameScene.ts` | Mod. | Suelo (`TileSprite`, o nada si falta la textura), kit de sprites, `RenderLayers`; `advance` una vez por `update` |
| infrastructure/phaser | `enemyPalette.ts` | Eliminada | Color de reserva en `placeholderColor` |
| infrastructure/phaser | `sceneKeys.ts` | Mod. | `BOOT_SCENE_KEY` |
| infrastructure/dom | `menuText.ts`, `resultsPanelText.ts` | Mod. | "Greentide Vanguard" |
| composition | `contentBoot.ts` | Nueva | `bootContent(raw, report)`: contenido + manifiesto + cruce; sin motor ni DOM, se prueba en Node |
| composition | `main.ts` | Mod. | `TITLE`, `assetUrl`, `imageLoadType`, `[boot, menu, game]`, `capacity.corpses`, `probe.sprites` |
| repo | `public/assets/tiny-swords/**` + `PROVENANCE.json` | Nueva | D4, D8 |
| repo | `.claude/hooks/guard-assets.mjs`, `scripts/guard-staged.mjs` | Nueva / Mod. | D8 |
| repo | `index.html` (`<title>`), `README.md`, `AGENTS.md`, `package.json` (`description`) | Mod. | Título. `name`, `sprint-survivors/progress`, el fichero de export y `window.__sprint` no cambian |
| docs | ADR-0012 nuevo | Nueva | Ver "ADRs" |

**Por qué cada capa**: el aspecto es presentación, así que esquema y resolución viven en infraestructura y el cruce
con el contenido lo hace la composición; un manifiesto no puede invalidar una partida. La lógica de render es pura
(`animation`, `looks`, `SlotPool`, `RenderLayers`) y los adaptadores finos (`BootScene`, `GameScene`) solo crean
objetos del motor. **No hay puertos nuevos**: `SpriteLike` es una costura de testabilidad, como lo era
`CircleSprite`, y no hay dos implementaciones de dominio previsibles.

## Comportamiento de las capas
- **Estado por hueco**: `Motion { lastX, lastY, facingLeft, moving }` y `{ anim, startMs }`. Se reinician al
  aparecer (`appearing`) y en `PlayerView.reset()` (en `create` y tras R): primer frame en `idle`, sin voltear.
- **Frames sin tick**: `Motion` solo se actualiza cuando cambia `snapshot.tick`; con refresco > 60 Hz no parpadea
  entre `walk` e `idle` (hallazgo del spike a 165 Hz).
- **`AnimClock`**: `advance(deltaMs, frozen)` suma el `delta` real del frame (sin multiplicar por `speed`) salvo con
  `frozen = gate.paused || status === 'choosing' || status === 'over'` (mundo detenido de la spec: los cadáveres
  quedan congelados hasta R o Volver al menú). Se llama **una vez por `update`**, aunque haya dos renders en el
  frame (elección + avance). Con `over` el jugador se pinta en `idle`.
- `frameAt`: con bucle `frames[⌊ms·fps/1000⌋ mod n]`; sin bucle `frames[min(n−1, ⌊ms·fps/1000⌋)]`.
  `animDone = ms ≥ n·1000/fps`. `setFrame`, `setFlipX` y `setTint` solo cuando cambian.
- **Destello**: dañado → `setTint(0xffffff).setTintMode(FILL)` (silueta blanca); no dañado → `setTint(0xffffff)
  .setTintMode(MULTIPLY)` o `placeholderColor` si es placeholder. La animación sigue. `TintModes` requiere WebGL:
  `Phaser.AUTO` lo elige y Chromium headless usa WebGL por software.
- **Fallback**: `resolveLooks` recibe `frames(key) => number | null` (`textures.exists` y `frameTotal − 1`). Si la
  hoja falta o un índice no existe, ese aspecto usa `placeholder:disc` con `scale = 2r / 64` (r = radio de **cada**
  elemento en el snapshot; el cadáver usa el último radio pintado del enemigo), origen (0,5; 0,5), tinte
  `placeholderColor`, sin volteo ni rotación. El suelo sin textura es un `Rectangle` 960 × 540 de
  `placeholderColor` (cuenta como `ground.placeholder = 1`).
- **Orden de pintado** (orden de creación): suelo, anillos, gemas, cadáveres, enemigos, proyectiles, jugador, HUD y
  overlays.

## Flujo de un frame
```
GameScene.update(delta)
  esc / R / elección → PauseGate (sin cambios)
  layers.advance(delta, paused || last.status === 'choosing')        // una vez por frame
  [chosen?] render(chosen)                                           // igual que hoy
  snapshot = gate.frame(tickRun, delta, input, speed)                // núcleo, 0..speed ticks
  render(snapshot):
    newTick = snapshot.tick !== lastTick
    pulses · gems · enemies(→ corpses.spawn) · corpses(clock) · projectiles · player(newTick)
    hud · overlays · progress.sync (sin cambios)
    onRender(snapshot, results, counts)
```

## E2E
- Una sola build (la de siempre) con el arte real. Sin segunda build ni fixtures sintéticas.
- `smoke.spec.ts` amplía: 0 violaciones de CSP y 0 errores en consola **desde el menú y con `?e2e`**, y
  `placeholder = 0` en todos los tipos tras el primer render.
- Nuevos o ampliados: "Recuento coherente", "Sonda en el menú", "Cinco ciclos menú-partida" (D7), "Cinco reinicios
  seguidos" y "Volver al menú con cadáveres en curso" (`menu-flow.spec.ts`, `results.spec.ts`).
- "Hoja que no carga": `page.route(...).abort()` sobre la hoja de `goblin-torch`; se espera
  `enemyPlaceholders['goblin-torch'] = enemies.placeholder` y 0 en el resto. El colector ignora solo el
  "Failed to load resource" de esa URL (R3); errores no capturados, 0.
- `public.spec.ts` (smoke remoto): cada `file` del manifiesto responde 200 `image/png` bajo `/tfm-survivors/`.
- Animación, volteo, tope de cadáveres, escala, orientación de la flecha y primer frame tras R son **unitarios** con
  `FakeSprite` (no son deterministas frame a frame en navegador).
- `smoke:public` (a demanda) verifica lo mismo en Pages tras el merge.

## Dependencias nuevas
| Paquete | Versión | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. SHA-256 con `node:crypto`; cabecera PNG leída a mano (24 bytes); placeholder con la Canvas API de Phaser | `pngjs`/`image-size` (innecesarios para leer ancho y alto); `sharp` (nativo y pesado) |

## Rendimiento y seguridad
- **Núcleo**: intacto; presupuesto de `TickRun` sin cambios (`npm run bench` de control).
- **Adaptador**: peor caso 200 enemigos + 64 cadáveres + 32 proyectiles + 300 gemas + jugador. Por sprite y frame:
  `setPosition`, un `frameAt` aritmético y `setFrame`/`setFlipX`/`setTint` solo si cambian. Objetivo < 1 ms/frame
  de sincronización en la máquina de desarrollo (el spike pintó 200 animados a ~165 fps). Sin asignaciones por
  frame: pools, `Motion`, `SpriteCounts` y el array de orden de `SlotPool` se preasignan. Todos los sprites
  comparten 8 texturas, así que el *batching* de WebGL agrupa por hoja. Bench opcional con `FakeSprite`.
- **Carga**: ~0,1-0,3 MB de PNG una vez por página; GPU ~20 MB.
- **Seguridad**: imágenes del mismo origen, CSP sin cambios, sin `blob:`. `file` del manifiesto con regex
  restrictiva y prefijo fijo. No se persiste nada nuevo; el documento de progreso no guarda ids de enemigo, así que
  guardados y exports antiguos siguen siendo válidos. Licencia: guardarraíl con hash (D8).

## Referencias de Phaser (MCP `phaser-docs`; confirmar con los tipos 4.2.1 en apply)
- `LoaderPlugin#imageLoadType` y `LoaderPlugin#image` (sin XHR ni Blob con `HTMLImageElement`) —
  `/api-documentation/class/loader-loaderplugin.md#imageloadtype-string`; `Types.Core.LoaderConfig` —
  `/api-documentation/typedef/types-core.md#static-loaderconfig`; `ImageFile#onProcess` —
  `/api-documentation/class/loader-filetypes-imagefile.md#instance-onprocess`.
- `LoaderPlugin#spritesheet` — `/api-documentation/class/loader-loaderplugin.md#spritesheet`;
  `Loader.Events.FILE_LOAD_ERROR` — `/api-documentation/event/loader-events.md#file_load_error`.
- `TileSprite` (frame opcional; en v4 sin restricción de potencia de dos) —
  `/api-documentation/class/gameobjects-tilesprite.md`.
- `Tint#setTint` y `setTintMode` (en v4 el modo es independiente; `setTintFill` no hace nada) —
  `/api-documentation/namespace/gameobjects-components-tint.md#instance-settinttopleft-topright-bottomleft-bottomright`,
  `…#instance-settintfill`.
- `Graphics#generateTexture` — `/api-documentation/class/gameobjects-graphics.md#generatetexture`.

## ADRs
- **ADR-0012 nuevo**: `docs/adr/0012-arte-cc0-versionado-con-procedencia.md` (arte en `public/`, `PROVENANCE.json`,
  guardarraíl con hash, `imageLoadType`, `BootScene`, reloj de render).
- `docs/adr/0012-arte-local-descubierto-en-build.md` **ya está borrado** (`git rm` del orquestador). Motivo: nunca
  fue aceptado ni llegó a `main`; dejarlo "rechazado" daría dos ADR-0012. El nuevo lo registra en "Sustituye a".
- ADR-0006 se aplica con dos notas: el pool de cadáveres es aparte y `SlotPool` libera en el orden del snapshot
  anterior. ADR-0011 se mantiene: `BootScene` es una escena técnica previa que no cambia los modos de arranque.

## Contraste con las specs finales (fase tasks, 2026-11-22)
Contrastado con todas las deltas (`sprite-rendering` reescrita, `asset-provenance` nueva, título en `main-menu` y
`run-results`, renombrados). Ninguna conserva `weapon` en el snapshot. Cambios aplicados a este design:
- D9: hoja en línea por aspecto (sin mapa `sheets`), `facing` y `loop` por animación, suelo como aspecto con `idle`.
- D2: la hoja debe figurar en `PROVENANCE.json` también al cargar el contenido (`parseAppearance(raw, registered)`).
- D5/Orientación: la flecha rota 0 en su primer frame (antes, vector jugador → proyectil).
- Reloj: `over` también congela la animación y los cadáveres (antes seguían); jugador en `idle` con `over`.
- Reserva: diámetro con el radio de cada elemento; suelo de reserva como relleno liso.
- D7: sonda con `ground` y `enemyPlaceholders` por tipo; se quita `walking`.
- D8: `license: "CC0"`, `source` y `version` por entrada, `confirmedOn` sin captura; alcance a todo asset gráfico del
  repo y lista de prohibidos ampliada (`Thumbs.db`, `desktop.ini`, `.rar`, `.7z`, `.tar`, `.gz`, variantes de
  "Free Pack").
- E2E: la hoja rota se simula con `route.abort()`; el smoke remoto comprueba 200 `image/png` por hoja.

## Riesgos que se vigilan en apply
- **R1 · Filas de las hojas**: los índices de D4 salen de mirar la hoja. El test IHDR atrapa rejillas e índices
  fuera de rango, no una fila equivocada. El Barrel (frames de 128 px y fila "move" 18-23) es el más dudoso: se
  revisa a ojo en `vite dev` antes de cerrar la tarea.
- **R2 · Hash y finales de línea**: el guardarraíl lee del índice y `*.png binary` evita conversión. Si un PNG entra
  sin esa regla (otra extensión), el hash difiere entre plataformas: el guardarraíl trata toda imagen como binaria.
- **R3 · "Textura rota" en consola**: si Chromium registra un error por la imagen no decodificable, se filtra solo
  esa URL; si Phaser lanza, el fallo es real y se corrige el fallback.
- **R4 · Arranque de E2E**: si `BootScene` alarga el arranque hasta rozar timeouts, se mide en CI; 8 PNG locales no
  deberían notarse.
- **R5 · Prosa con "bug"**: el renombrado es por literal; una revisión de `git diff --stat` por carpeta evita tocar
  specs ajenas.
- **R6 · Importar `PROVENANCE.json` desde `public/`**: Vite puede rechazar o advertir al importar desde `publicDir`.
  Se prueba en la tarea de composición con `npm run build` y `vite dev`. Si falla, la nota pasa a
  `content/asset-provenance.json` (versionada, mismo formato) y se anota aquí; la spec deja la ubicación al design.
- **R7 · API 4.2.1**: `imageLoadType`, `TintModes`/`setTintMode`, `TileSprite`, `generateTexture` se confirman en
  los tipos de `node_modules/phaser` en la primera tarea de infraestructura con motor; si discrepan, mandan los tipos.
