# Exploración 0013-world-camera

## Contexto actual
- Arena y vista viven en `content/arena.json` (`width/height` 960x540 y `view` 960x540); `Arena` (`src/domain/arena/Arena.ts`)
  hace el clamp (`clampCircle`) para jugador (`Player.move`), enemigos (`Enemy.spawn/chase`) y spawn; `View` solo aporta
  `halfDiagonal` a `SpawnRules` (anillo = media diagonal + margen ≈ 582,7).
- El dominio ya soporta arena > vista: `placeSpawn` coloca en un anillo alrededor del jugador y recorta a la arena; la spec
  enemy-spawning ya tiene "Arena mayor que la vista" (4000x4000). Jugador nace en `arena.center`.
- Adaptador: `GameScene.create` pinta suelo con un `tileSprite` (0,0,view) sin cámara; HUD/overlays ya usan
  `setScrollFactor(0)` (`sceneWidgets.ts`). El lienzo se crea con `view` en `src/composition/main.ts:181`.
  `GroundView.createGround` y su sonda (`ground.visible === 1`) asumen un único sprite de suelo.
- Bot de referencia: `tests/support/policies.ts` `fleeInput` usa `DEFAULT_ARENA` 960x540 fijo (repulsión de paredes).
- Guardado/historial (`Progress`: seed, outcome, tiempo, nivel, bajas) NO guarda ids de armas ni mejoras: el renombrado no
  afecta a localStorage ni al JSON exportado/importado.
- Phaser 4.2.1 fijado; `Cameras.Scene2D.Camera` expone `startFollow`, `setBounds`, `setRoundPixels` (tipos presentes).

## Specs afectadas
player-movement (límites de la arena: números 960x540), enemy-behavior (enemigos dentro de la arena), enemy-spawning
(escenarios con 960x540 y "arena igual a la vista"), sprite-rendering (requisito del fondo: "no hay mundo mayor ni cámara",
líneas ~363-381), run-outcome (bot/paredes 960x540), simulation-loop (si se cita el mundo). Renombrado: auto-weapons (39
menciones de `linter/tests`) y upgrades (36).

## Opciones
A. Mínimo: subir `arena.width/height` en contenido (p. ej. 3x), cámara `startFollow` + `setBounds`, suelo único del tamaño
   del mundo, bot recibe la arena real. Pros: dominio intacto, spawn "alrededor de la vista" ya resuelto. Contras: el balance
   cambia (menos paredes que acorralen al bot; el quieto tarda más en recibir enemigos si antes el recorte los pegaba).
B. A + cámara con zona muerta/lerp y `roundPixels` para evitar parpadeo de sprites. Pros: sensación mejor. Contras: más
   superficie de E2E y de ajuste visual; no imprescindible.
C. A + extras (orden por y, minimapa, suelo con variación). Pros: valor visual. Contras: contradicen la retro de 0012
   (changes pequeños); el minimapa es Could y el mapa real llega en 0014.

Renombrado medieval (decisión independiente):
- R1 solo textos: cambiar `name`/`description` en `content/upgrades.json` (único sitio que se muestra al jugador; los ids de arma
  no se pintan), ids intactos. Footprint mínimo, 0 impacto en tests/bot/E2E/specs de IDs.
- R2 textos + ids (`linter`→`arco`, `tests`→`tajo`, `strict-rules`…): ~65 ficheros con ocurrencias (builders, políticas del bot
  `REFERENCE_UPGRADE_PRIORITY`, `health.spec.ts` con `['linter','tests']`, specs, ADR-0007/0008, mensajes de
  `UpgradeCatalog`). Precedente: 0012 hizo esto para enemigos con un guardarraíl `legacy-enemy-ids.test.ts`. Mecánico pero
  ruidoso; mezclarlo con la cámara dificulta revisar el diff.

## Riesgos e incógnitas
- Balance: `fleeInput` con arena fija sería incorrecto en un mundo mayor; la banda 25-35/50 victorias y el invariante "quieto
  pierde antes de 180 s" (`stillSurvivors`) se recalculan con otra geometría. Cambia el punto de aparición (sin recorte) y la
  distancia de recorrido de los enemigos.
- `tileSprite` de 3-4k px: coste de render y límites de textura en Phaser 4 sin verificar; alternativa de mosaico por cámara.
- `enemies.spec.ts` tiene `ARENA` 960x540 hardcodeado; `smoke.spec` lee `player.x`. Coordenadas del snapshot son de mundo, no de
  pantalla: ninguna sonda convierte a pantalla (hoy coinciden).
- Proyectiles no limitados por la arena (spec auto-weapons): se ven fuera del suelo si la cámara se acerca al borde.
- Fuentes duplicadas de dimensiones (contenido, `builders.ts:200`, `DEFAULT_ARENA`, `ARENA` de E2E): conviene una sola.
- Pulsos y anillos están en coordenadas de mundo: ok con cámara. HUD ya fijo.

## Mediciones previas (el change fija objetivo de balance; las lanza el orquestador antes de la propuesta)
- Con arena candidata (p. ej. 2880x1620 y 3840x2160) y `fleeInput` parametrizado con la arena: victorias del bot en semillas
  1..50; umbral: 25-35 (si sale de banda, se propone ajuste de contenido o de tamaño, no de stats).
- `stillSurvivors` en semillas 1..50 con `STILL_LIMIT_TICKS` 180 s; umbral: lista vacía. Anotar tiempo medio de muerte.
- `npm run bench`: ms/tick (informativo, no bloquea).
- Spike visual breve: suelo 3840x2160 a 60 fps con `CI_LIKE=1`.

## Preguntas para el usuario
1. Tamaño del mundo (múltiplo de la vista: 2x, 3x, 4x)?
2. Renombrado: R1 (solo textos, recomendado) o R2 (ids también) en 0013, o R2 en un change aparte?
3. Nombres medievales para las 9 mejoras y las 2 armas (arco y tajo)?
4. Se difieren orden por y, minimapa, zona muerta/lerp de cámara?
