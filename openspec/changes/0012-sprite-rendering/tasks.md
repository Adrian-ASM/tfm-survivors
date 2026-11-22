# Tasks · 0012-sprite-rendering

<!-- Cada tarea ≤ ~30 min, con un test que se ve en ROJO antes de implementar y su criterio de hecho.
     Orden: renombrado mecánico → repo/guardarraíl → infraestructura → adaptadores → composición → E2E → docs.
     El implementer marca [x], ejecuta `npm run verify` (verde) y hace un commit por tarea (`refs: 0012-sprite-rendering`).
     Specs: SR sprite-rendering · AP asset-provenance · AW auto-weapons · MM main-menu · RR run-results ·
     SL simulation-loop · XG xp-gems · ES enemy-spawning · EB enemy-behavior · UP upgrades · RO run-outcome ·
     RS run-state. Mapeo (design D1): bug → goblin-torch, memory-leak → goblin-tnt, merge-conflict → goblin-barrel.
     `src/domain` y `src/application`: 0 líneas de diff en todo el change. -->

## 1. Renombrado de ids (mecánico, sin arte)
- [x] 1.1 Ids en el contenido. Rojo: `tests/infrastructure/content.test.ts` espera los ids `goblin-torch`,
  `goblin-tnt`, `goblin-barrel` en ese orden con los mismos stats (90/10/10/5/1, 45/22/45/15/4, 70/16/20/8/2).
  Cambiar `content/enemies.json` y `content/waves.json` in situ, **mismo orden** en `types` y en cada segmento.
  - Hecho: `npm run verify` verde, incluida la banda de `tests/domain/balance.test.ts` (25-35 victorias en semillas
    1..50, quieto pierde antes de 180 s) sin recalibrar; `determinism*.test.ts` verdes.
  - Escenarios: ES "Catálogo de tipos de enemigo" y "Contenido de enemigos y oleadas validado" (renombrados).
- [x] 1.2 Literales antiguos fuera del contenido. Rojo: `tests/guardrails/legacy-enemy-ids.test.ts` busca
  `'bug'`, `"bug"`, `'memory-leak'`, `"merge-conflict"`… en `src/**`, `tests/**` y `content/**` y espera 0.
  Renombrar en `tests/support/{builders,finishedRuns}.ts`, `tests/bench/run.bench.ts`, tests de dominio,
  aplicación e infraestructura y las claves de `src/infrastructure/phaser/enemyPalette.ts` (se borra en 5.2).
  Prosa con "bug" como "error" no se toca (R5: revisar `git diff --stat` por carpeta).
  - Hecho: verify y banda de balance verdes; `npm run bench` de control sin regresión apreciable.
  - Escenarios: deltas de renombrado de AW, EB, ES, SL, XG, UP, RO y RS (sin cambio de comportamiento).

## 2. Assets y procedencia (repo + guardarraíl)
- [x] 2.1 Reglas de la nota en `.claude/hooks/guard-assets.mjs`: `checkAssets({ files, provenance, digest })`
  pura; esta tarea cubre solo la cabecera y las entradas (pack, autor, `version: "Update 010"`, `license: "CC0"`,
  `confirmedOn`, `path`/`source`/`version` por entrada, `path` repetido). Test `tests/guardrails/assets.test.ts`.
  - Escenarios: AP "Nota incompleta", "Entrada repetida", "Origen del Free Pack".
- [x] 2.2 Reglas sobre la lista de ficheros: asset gráfico (9 extensiones, sin mayúsculas) sin entrada en cualquier
  carpeta, entrada sin fichero, prohibidos (`.DS_Store`, `Thumbs.db`, `desktop.ini`, `.aseprite`, comprimidos),
  `Free Pack`/`Free_Pack`/`FreePack` en la ruta, `sha256`/`bytes` distintos (digest inyectado como mapa).
  - Escenarios: AP "PNG sin registrar", "Asset gráfico fuera de la carpeta de assets", "Entrada sin fichero",
    "Ficheros prohibidos", "Mayúsculas en la extensión", "Ruta del Free Pack en el repositorio".
- [x] 2.3 Ejecución en `scripts/guard-staged.mjs` (pre-commit y `guard:all`): una pasada global sobre
  `git ls-files -z`, contenido leído del índice (`git cat-file blob :<ruta>`, `node:crypto`). Añadir
  `*.png binary` a `.gitattributes`. Rojo: `tests/guardrails/guard-staged.test.ts` con lister y lector inyectados
  y un PNG sin entrada → código ≠ 0 y salida que nombra el PNG.
  - Hecho: sin red ni acceso a la carpeta original del pack.
  - Escenarios: AP "Verify en rojo", "Sin red ni pack".
- [x] 2.4 Copiar los 8 PNG de D4 a `public/assets/tiny-swords/<ruta del pack>` (sin `.aseprite`, `.DS_Store` ni
  zip) y crear `PROVENANCE.json` (autor Pixel Frog, `confirmedOn: "2026-11-22"`, `source` con prefijo
  `Tiny Swords (Update 010)/`, `sha256` y `bytes` medidos). Rojo: test "estado real" de `assets.test.ts` (lee el
  repo real) falla sin la nota.
  - Hecho: `npm run guard:all` verde; peso total anotado en el design (D4) y en el diario.
  - Escenarios: AP "Nota del repositorio", "Estado real del repositorio".

## 3. Infraestructura · datos de aspecto
- [x] 3.1 `src/infrastructure/content/appearanceSchema.ts` + `loadAppearance.ts` (`parseAppearance(raw,
  registered)` → `Result` con la ruta del campo unida por `.`). `z.strictObject` en todos los niveles; hoja en
  línea, `facing`, `loop`, `death.loop` literal `false`, `walk` obligatorio en jugador y enemigos.
  Test `tests/infrastructure/appearance-content.test.ts` con un fixture válido mínimo.
  - Escenarios: SR "Valores fuera de rango", "Animaciones obligatorias y campos desconocidos".
- [x] 3.2 Rutas de hoja: regex de D2 y pertenencia a `registered` (`public/assets/tiny-swords/` + `file`).
  - Escenarios: SR "Rutas de hoja no admitidas" (7 casos, el error nombra la hoja de `goblin-torch`).
- [x] 3.3 `content/appearance.json` del repo (índices de D4, escalas y orígenes de D5, `maxCorpses` 64,
  `placeholderColor` desde los colores actuales). Test de contenido: cabecera IHDR de cada PNG → rejilla exacta e
  índices ≤ `cols × rows − 1`; cada `file` en la nota y cada entrada usada (sin peso muerto); `source` de cada
  aspecto contiene `Archer`/`Torch`/`TNT`/`Barrel`/`Dead.png`/`Arrow.png` y empieza por `Tiny Swords (Update 010)/`.
  - Hecho: R1 abierto hasta 5.2 (fila del Barrel a ojo).
  - Escenarios: SR "Datos del repositorio", "Hoja de cada elemento".

## 4. Infraestructura · render puro (sin Phaser como valor)
- [x] 4.1 `src/infrastructure/phaser/art/animation.ts`: `AnimClock.advance(deltaMs, frozen)`, `frameAt`
  (bucle / sin bucle), `animDone`. Test `tests/infrastructure/animation.test.ts`.
  - Escenarios: SR "Avance de la animación" (fórmula ±1 frame), "Mundo detenido" (reloj congelado).
- [x] 4.2 `Motion` en `animation.ts`: Δ con umbral 0,001, orientación con `facing`, solo se actualiza con tick nuevo,
  `reset()` a `idle` sin voltear.
  - Escenarios: SR "Umbral de movimiento", "Jugador que gira", "Dibujo que mira a la izquierda", "Frames sin tick".
- [x] 4.3 `art/looks.ts`: `resolveLooks(appearance, frames)`; hoja ausente o índice fuera de rango → reserva
  `placeholder:disc` con `scale = 2r / 64` por elemento, origen (0,5; 0,5), sin volteo ni rotación.
  - Escenarios: SR "Frame fuera de la hoja", "Tamaño del aspecto de reserva".
- [x] 4.4 `SlotPool`: `hide(slot, cleared)` y liberación en el orden del snapshot anterior (array preasignado).
  Test en `tests/infrastructure/slot-pool.test.ts` (o el de capas existente).
  - Escenarios: SR "Tope de cadáveres" (orden e1..e7, base), SL "Bajas en medio de la lista".
- [x] 4.5 `SpriteLike.ts` (sustituye a `CircleSprite`) + `SpriteKit` con `TintModes` inyectados + `FakeSprite` en
  `tests/support/`, y `PlayerView` (idle/walk, volteo, parpadeo con `playerVisible`, `idle` con `over`, `reset()`).
  - Escenarios: SR "Quieto y andando", "Parpadeo con sprite animado", "Partida terminada", "Primer frame de una
    partida nueva"; RR "Primer frame tras reiniciar" (parte del jugador).
- [x] 4.6 `EnemyLayer`: `SpriteLike` + `Look` por tipo + `Motion` por hueco (reinicio al aparecer); destello
  `setTint(0xffffff)` + `FILL`, normal `MULTIPLY` o `placeholderColor`; escala y origen del aspecto.
  - Escenarios: SR "Hueco reutilizado", "Escala independiente de la hitbox"; SL "Aspecto por tipo", "Reposición
    tras bajas", "Todos dados de baja"; AW "Indicación de daño fiel al snapshot", "Indicación de daño con aspecto de
    reserva".
- [x] 4.7 `CorpseLayer`: `maxCorpses` preasignados, `spawn(x, y, facingLeft, radius)` → `false` con el tope lleno,
  `sync(clockMs)` con `frameAt`/`animDone`, `clear()`.
  - Escenarios: SR "Muerte y desaparición", "Tope de cadáveres", "Tope de un cadáver", "Muerte con aspecto de
    reserva".
- [x] 4.8 `ProjectileLayer`: flecha, rotación `atan2(Δy, Δx)` (+π con `facing: 'left'`), 0 en el primer frame.
  - Escenarios: SR "Rotación de la flecha", "Flechas y gemas" (parte flechas); AW "Sprites de proyectiles".
- [x] 4.9 `GemLayer` con el aspecto de la gema (frame fijo, tamaño por aspecto, no por `gemRadius`).
  - Escenarios: XG "Recogidas y nuevas", "Tope de gemas pintado", "Todas recogidas"; SR "Flechas y gemas" (gemas).
- [x] 4.10 `RenderLayers.advance/render`: un `advance` por `update`; `frozen` con pausa, `choosing` y `over`; muerte
  por delta del snapshot → `corpses.spawn` en el orden anterior; nada de cadáveres por enemigos nunca pintados.
  Test de caracterización en `tests/domain/` (solo tests): semilla 42, 1.200 ticks de 1 y de 8 en 8, ids salientes
  = aumento de `kills`.
  - Escenarios: SR "Pulso que mata a varios en el mismo tick", "Fin de la partida", "Muerte a velocidad acelerada",
    "Cadáver con el mundo detenido", "Mundo detenido", "Salidas iguales a bajas".
- [x] 4.11 `RenderLayers.clear()` + `renderCounts.ts` (`SpriteCounts` reutilizado con `ground`,
  `enemyPlaceholders` por tipo; contadores incrementales; menú → todo a 0).
  - Escenarios: SR "R con cadáveres en curso", "Pulso sin sprite", "Recuento coherente con el snapshot" (unitario),
    "Sonda en el menú" (unitario); RR "Primer frame tras reiniciar".
- [x] 4.12 Título en `src/infrastructure/dom/{menuText,resultsPanelText}.ts` y en el aviso de datos dañados.
  Rojo: `results-panel-text.test.ts`/`menu-controller.test.ts` esperan `Greentide Vanguard` y ningún
  `Sprint Survivors`; los fragmentos `importado`, `no válido`, `64 KiB`, `borrado`, `progress` se conservan.
  - Escenarios: RR "Import rechazado", "Aviso de datos dañados"; MM "Título en el menú y en el documento" (menú).

## 5. Infraestructura · adaptadores Phaser
- [x] 5.1 R7: confirmar en `node_modules/phaser` (4.2.1) `imageLoadType`, `load.spritesheet`, `FILE_LOAD_ERROR`,
  `TintModes`/`setTintMode`, `TileSprite`, `Graphics#generateTexture`; anotar discrepancias en el design.
  `BootScene` + `BOOT_SCENE_KEY`: lógica pura `sheetsToLoad(appearance)` (un load por `file` distinto) y
  `nextSceneKey(e2e)`, probadas; la escena solo llama al motor.
  - Escenarios: SR "Con e2e" (no se ve el menú; parte unitaria), "Hoja que no carga" (`FILE_LOAD_ERROR` solo anota).
- [x] 5.2 `GameScene`: suelo `TileSprite` 960 × 540 (o `Rectangle` de reserva), orden de pintado de design,
  `RenderLayers`; borrar `enemyPalette.ts`. Test del suelo con una costura (`GroundView`): cubre (0,0)–(960,540),
  primero en profundidad, posición fija.
  - Hecho: R1 cerrado en `vite dev` (fila de andar del Barrel confirmada o corregida en `appearance.json`).
  - Escenarios: SR "Fondo de hierba".

## 6. Composición
- [x] 6.1 `src/composition/contentBoot.ts`: `bootContent(raw, report, registered)` = contenido + manifiesto +
  `checkAppearanceRefs`; sin motor ni DOM. Test `tests/composition/content-boot.test.ts`.
  - Escenarios: SR "Tipos de enemigo y aspectos desalineados", "Datos inválidos en el arranque" (con y sin
    `?e2e`), "Los aspectos no cambian la simulación" (protección: escalas × 2, 1.200 ticks, semilla 42).
- [x] 6.2 `main.ts`: `assetUrl` (`BASE_URL` + `assets/tiny-swords/` + `file`), `loader.imageLoadType`,
  `[boot, menu, game]`, `capacity.corpses`, `probe.sprites`, `TITLE`, import de `PROVENANCE.json` (R6: probar
  `npm run build` y `vite dev`; si falla, mover la nota a `content/` y anotarlo). `index.html` `<title>` y
  `package.json` `description`. Rojo: test de `assetUrl`; además test que congela las directivas CSP de
  `index.html` (protección).
  - Escenarios: SR "Directivas sin cambios"; MM "Título en el menú y en el documento" (documento).

## 7. E2E (`npm run test:e2e`)
- [x] 7.1 `tests/e2e/probe.ts` con el tipo `sprites`; `smoke.spec.ts`: CSP y consola desde el menú y con `?e2e`,
  0 placeholders, muestreador `requestAnimationFrame` de 600 frames; título del documento y del menú.
  - Escenarios: SR "Partida con arte", "Desde el menú", "Con e2e"; MM "Título en el menú y en el documento".
- [x] 7.2 Hoja rota: `page.route(...).abort()` sobre la hoja de `goblin-torch` (R3: ignorar solo su
  "Failed to load resource").
  - Escenarios: SR "Hoja que no carga".
- [x] 7.3 Sonda: recuento coherente durante 600 frames, menú tras Volver al menú, sin sonda sin `?e2e`.
  - Escenarios: SR "Recuento coherente con el snapshot", "Sonda en el menú", "Sin sonda fuera de E2E".
- [x] 7.4 `menu-flow.spec.ts`: volver al menú desde la pausa y con cadáveres en curso (semilla 7), cinco ciclos con
  muestreador y aserción final.
  - Escenarios: MM "Volver al menú desde la pausa", "Volver al menú con cadáveres en curso", "Cinco ciclos
    menú-partida"; SR "Volver al menú con cadáveres en curso".
- [x] 7.5 `results.spec.ts` y progreso: cinco reinicios con la sonda; claves técnicas sin cambios y export antiguo
  importable; ningún texto visible ni aviso con `Sprint Survivors`.
  - Escenarios: RR "Cinco reinicios seguidos", "Import rechazado", "Aviso de datos dañados"; MM "Claves técnicas sin
    cambios", "Export antiguo importable".
- [x] 7.6 `tests/remote/public.spec.ts`: cada hoja del manifiesto responde 200 `image/png` bajo `/tfm-survivors/`,
  0 violaciones de CSP. Solo se compila/lista en apply; se ejecuta a demanda tras el merge.
  - Escenarios: SR "Arte en la URL pública".

## 8. Docs
- [ ] 8.1 `docs/adr/0012-arte-cc0-versionado-con-procedencia.md` (plantilla 0000; "Sustituye a" el aparcado ya
  borrado), `README.md` y `AGENTS.md` (título y estado: arte, guardarraíl de procedencia, sonda `sprites`), diario
  de IA del apply. Hecho: `npm run verify` verde y `legacy-enemy-ids` verde.
- [ ] 8.2 (Orquestador, antes de archivar) Pedir al `game-designer` que actualice `docs/gdd.md` con el título
  `Greentide Vanguard` y los ids `goblin-torch`/`goblin-tnt`/`goblin-barrel`; comprobar que ninguna delta conserva
  marcadores `{ex-*}`.
