# Design · 0013-world-camera

## Resumen
El mundo pasa a 1920x1080 y la vista se queda en 960x540. Las dos medidas ya viven separadas en `content/arena.json`.
**El diff de `src/domain` y `src/application` es 0 líneas** (salvo D1b, opcional): `Arena` ya recorta jugador y enemigos,
y `placeSpawn` ya coloca en un anillo alrededor del jugador calculado desde `View`. Lo nuevo está en el adaptador
Phaser: una cámara que sigue al jugador, con límites iguales al mundo y sin suavizado, y un suelo del tamaño del mundo.
También cambia la sonda E2E. En los tests, todo lo que dice ser "el contenido por defecto" lee la arena de
`content/`, y el bot recibe la arena real. El renombrado medieval toca solo `name`/`description` de
`content/upgrades.json`.

**Vía de consulta de Phaser**: MCP `phaser-docs`, cuya doc publicada cita fuentes de v4.1.0. La confirman los tipos de
`node_modules/phaser/types/phaser.d.ts` (4.2.1, en este worktree): `startFollow(target: GameObject | object,
roundPixels?, lerpX?, lerpY?, offsetX?, offsetY?)`, `setBounds(x, y, width, height, centerOn?)` y `worldView`.
Páginas consultadas:
- https://phaser.io/oss/docs/api-documentation/class/cameras-scene2d-camera.md#startfollow (también `lerp` y
  `setDeadzone`, que no se usa)
- https://phaser.io/oss/docs/api-documentation/class/cameras-scene2d-basecamera.md#scrollx-number (`setBounds`,
  `worldView`, `useBounds`)

## Decisiones

### D1 · Mundo y vista en el contenido
- `content/arena.json`: `width` 1920 y `height` 1080 son el mundo; `view` sigue en 960x540. No se renombra
  `arena` a `world`: el término de dominio `Arena` ya significa "límites del mundo", y renombrarlo removería ~45
  ficheros sin cambiar el comportamiento. En la prosa de specs y docs, "arena" y "mundo" son sinónimos (se anota en
  `sprite-rendering`).
- `ArenaSchema` (zod) ya valida `width/height` enteros positivos y `view` positivo.
- **D1b (obligatoria, revisada tras el contraste con `world-camera`)**: la spec exige el invariante "el mundo es al
  menos tan grande como la vista" **en zod**, con un error que nombre `width` o `height`. Se añade un
  `superRefine` a `ArenaSchema` que emite el issue con `path: ['width']` si `width < view.width` y con
  `path: ['height']` si `height < view.height` (mensajes como constantes con nombre, igual que
  `VIEW_SIZE_MUST_BE_POSITIVE`). `loadRunConfig` ya convierte el primer issue en `arena.width`/`arena.height`, y el
  arranque (`content-boot`) ya impide menú y partida ante un error de contenido. No va a `buildRunRules`: el dominio
  no cambia y los `RunConfig` de escenario (`SCENARIO_ARENA` 960x540 con vista 960x540) cumplen igual. Protege la
  garantía de la cámara: con bounds menores que el viewport, Phaser deja de desplazar y se ve fuera del mundo.

### D2 · Cámara (adaptador, `src/infrastructure/phaser/CameraRig.ts`, nueva)
- Costura sin motor, como `GroundFactory`:
  `interface FollowCamera { setBounds(x, y, w, h): unknown; startFollow(target: object, roundPixels: boolean,
  lerpX: number, lerpY: number): unknown; readonly worldView: { x; y; width; height } }`.
- `CameraRig` guarda un objetivo plano `{ x, y }` que es suyo, no un sprite. En el constructor hace
  `setBounds(0, 0, world.width, world.height)` y `startFollow(target, false, 1, 1)`: lerp 1 es seguimiento directo,
  sin zona muerta ni offset. `track(player)` copia `snapshot.player.x/y` al objetivo. `view()` devuelve
  `worldView` (x, y, ancho y alto en coordenadas de mundo) para la sonda.
- Se sigue a un objeto plano y no al sprite del jugador por tres motivos: no hay que sacar el `Sprite` de
  `PlayerView`/`SpriteKit`, el parpadeo de invulnerabilidad (sprite oculto) no afecta, y el test unitario usa una
  cámara falsa.
- `GameScene.create()` crea el `CameraRig` sobre `this.cameras.main` en cada entrada, porque Volver al menú destruye
  y recrea la cámara de la escena. `GameScene.render(snapshot)` llama a `rig.track(snapshot.player)` antes de
  `onRender`. Phaser aplica el seguimiento y el recorte a los bounds en el `preRender` de la cámara, dentro del mismo
  frame y después de `update`. Así, lo pintado y la sonda leída entre frames son coherentes.
- `roundPixels: false`, como hoy: sin `pixelArt` (design 0012 D2), con sprites a escala < 1 y suelo a escala 1. Si
  aparece temblor con la cámara en movimiento, el arreglo es `true` en una línea (riesgo R4).
- Descartados: `centerOn` en cada render, porque el orquestador fijó `startFollow`, aunque funcionaría igual. Lerp y
  zona muerta quedan fuera de alcance.

### D3 · Suelo del tamaño del mundo
- `GroundView`: `ViewSize` pasa a `WorldSize`, y `createGround`/`createPlayfield` reciben el mundo, no `this.scale`.
  Siguen siendo un único `tileSprite(0, 0, 1920, 1080)` con origen (0, 0), o un único `rectangle` de reserva del
  mismo tamaño. La sonda mantiene `ground.visible === 1`.
- `GameSceneDeps` gana `world: { width; height }`. La composición (`main.ts`) lo pasa desde `config.value.arena` y
  el lienzo sigue creándose con `view`.
- Coste: un solo quad. El fragment shader trabaja solo sobre el viewport (960x540), así que no hay mosaico por
  cámara ni troceado. No se usa `setScrollFactor` en el suelo: se mueve con el mundo.

### D4 · HUD y overlays fijos
- Sin cambios de código. `sceneWidgets.ts` ya crea HUD, velo, cartas y resultados con `setScrollFactor(0)` y
  coordenadas de pantalla (`scene.scale`, la vista). El clic en las cartas usa la cámara y el `scrollFactor` del
  objeto, así que sigue funcionando con la cámara desplazada. Lo demuestra un E2E (tarea), no código nuevo.
- Los overlays DOM (pausa, panel de resultados y menú) no dependen de la cámara.

### D5 · Sondas E2E en coordenadas de mundo
- `snapshot` sigue en coordenadas de mundo, sin conversión. La sonda gana `camera: { x, y, width, height } | null`
  (`worldView` del último frame), un getter enumerable como `progress`, y `null` en el menú. La composición lo
  conecta a un `GameScene.cameraView()` que devuelve `rig?.view() ?? null`. Getter y no copia en `onRender`:
  `onRender` corre en `update`, antes del `preRender` de la cámara, y copiaría el `worldView` del frame anterior.
- La spec `world-camera` ("Sonda de cámara para E2E") pide también el tamaño del mundo: la sonda gana
  `world: { width, height }`, constante desde la carga (el `config.value.arena` que ya tiene `main.ts`).
- `tests/e2e/probe.ts`: `SnapshotView.player` gana `x` e `y` (ya están en el snapshot, faltaban en el tipo) y la
  interfaz de la sonda gana `camera` y `world`. Se añaden un muestreador por `requestAnimationFrame` de cámara
  (`startCameraSampler`, mismo patrón que `startSpriteSampler`: rectángulo dentro del mundo, fórmula de seguimiento
  con error ≤ 1 px, fondo visible y primeras posiciones de cada id de enemigo) y un helper `walkToCorners` que lleva
  al jugador a las cuatro esquinas con el teclado. `watchNextRun` copia también `camera`.
- Para comprobar algo en pantalla, la conversión es `screen = world - camera.{x,y}`. Hoy ninguna spec E2E lo hace:
  `smoke.spec` lee `player.x` en mundo y los clics en el lienzo van a (5, 5), sobre el velo o en el menú.
- Los E2E leen las dimensiones del mundo con `import arena from '../../content/arena.json'` (`resolveJsonModule` ya
  activo). `enemies.spec.ts` pierde su `ARENA`.

### D6 · Una sola fuente de las dimensiones en tests y bot
- `tests/support/policies.ts`: se elimina `DEFAULT_ARENA`. `fleeInput(snapshot, arena: Bounds)` exige la arena (sin
  valor por defecto), así que el compilador impide volver a una geometría fija.
- **Revisado tras el contraste con `run-outcome`** ("El bot huye de las paredes del mundo real": el bot calcula el
  input "sin recibir ningún otro dato de tamaño" que la partida): el bot se construye **ligado a la configuración
  con la que se crea la partida**, `referenceBot(config: RunConfig): { input(snapshot): PlayerInput;
  pick(offer): number }`, que toma `config.arena`. `playReferenceBot(run, bot, maxTicks)`. Quien juega con el bot
  crea partida y bot desde el mismo `RunConfig`, sin pasar dimensiones sueltas. No se añade la arena al
  `RunSnapshot` ni un getter a `Run`: cambiaría el dominio y todas las comparaciones de snapshots por un helper de
  test.
- `tests/support/builders.ts`:
  - `aDefaultConfig()` ("lo que carga el juego") toma `arena` de `content/arena.json` (import del JSON). La
    igualdad `loadRunConfig() == aDefaultConfig()` de `content.test.ts` sigue siendo el contrato.
  - `aRunConfig()` mantiene su **geometría de escenario** fija como constante con nombre `SCENARIO_ARENA` (960x540 y
    vista 960x540), documentada como "geometría de los escenarios unitarios, no el mundo del juego". Hay ~340
    números de escenario (480, 270, 944…) en ~45 ficheros que dependen de ella. Moverla con el contenido rompería
    escenarios que prueban reglas ("recorte a una arena de W×H"), no el mundo. Lo mismo vale para los
    `Arena.create(960, 540)` de los tests de VOs.
  - Los tests que usan `aDefaultConfig()` y razonan con posiciones (`policies.test.ts`, `long-run.test.ts`
    `inside()`, `ground-view.test.ts`) pasan a leer `config.arena` o el centro del snapshot.
- Guardarraíl ligero (`tests/infrastructure/single-arena-source.test.ts`, como `legacy-enemy-ids` de 0012): ningún
  `DEFAULT_ARENA` en `tests/`, y ningún literal `960`/`540` en `tests/e2e/**`, `tests/bench/**`,
  `tests/support/policies.ts` ni `tests/support/runs.ts`. `builders.ts` queda excluido por `SCENARIO_ARENA`.
- **Para el spec-writer**: el criterio "ninguna dimensión 960x540 del mundo fuera de `content/`" se interpreta como
  "del mundo del juego". Los escenarios unitarios que fijan su propia arena (p. ej. "Arena igual a la vista") son
  entradas del escenario y se quedan.

### D7 · Bench "200 enemigos encima del jugador" y demás casos con geometría
- `run.bench.ts` toma `const { arena } = benchConfig()` (ya viene de `loadRunConfig`) y deriva todo de ella:
  - `runPiledOnPlayer`: los 200 `goblin-torch` en `(arena.width / 2, arena.height / 2)`, el mismo punto en que nace
    el jugador (`arena.center`), con cualquier tamaño de arena.
  - **Revisado tras el contraste con `simulation-loop`**: la spec pide "≥ 1 enemigo en contacto en cada tick
    medido" y un escenario "Contacto con cualquier tamaño de mundo" (mundo por defecto y arena explícita de
    4.000 × 4.000). La aserción `health < BENCH_HEALTH` no basta. La preparación pasa a un helper compartido
    `pileOnPlayer(config)` en `tests/support/runs.ts` (enemigos en el `arena.center` de la configuración dada) y un
    test unitario determinista (`tests/domain/piled-contact.test.ts`, dentro de `verify`) ejecuta 600 ticks con
    cada arena y comprueba en cada tick que algún enemigo está a ≤ `r_jugador + r_enemigo` del jugador. El bench
    reutiliza el helper.
  - `runWorstCase` y `runWorstCaseWithGems`: enemigos en `x = 10` y `x = arena.width - 10`, con la `y` repartida
    sobre `arena.height`. Gemas en las esquinas inferiores `(5, H - 5)` y `(W - 5, H - 5)`, y jugador en
    `(W / 2, 16)`. Alcance de las armas de bench: `Math.ceil(Math.hypot(W, H))`, que sigue siendo "mayor que la
    diagonal". Las gemelas deterministas ya comprueban los topes (32 proyectiles y 300 gemas).
- El bench sigue fuera de `verify`. La tarea debe ejecutarlo una vez (`npm run bench`) y anotar los ms/tick.

### D8 · Protección del balance
- `balance.test.ts` no cambia de umbrales: `WIN_BAND` sigue en 25–35, `STILL_LIMIT_TICKS` en 180 s y las semillas en
  1..50. Lo que cambia es la entrada: `aDefaultConfig()` con el mundo real y el bot con `fleeInput(…, arena)`. Es
  exactamente la configuración de la medición previa (25/50 y 0 quietos supervivientes).
- **Punto de control al empezar apply** (primera tarea, antes de tocar el adaptador): cambiar `arena.json` y el bot,
  y ejecutar `balance.test.ts`. Si salen 25 victorias y 0 quietos, se sigue. Si sale otra cifra, se para y se vuelve
  al gate humano: el usuario aceptó 25, no "lo que salga". El mensaje del test ya imprime `victorias: N/50`.
- Los **plazos** del mismo fichero ("Primera subida" ≤ 3.600 con la semilla 7, "Primer golpe" ≤ 4.800 con la
  semilla 42, "Jugador quieto" con baja ≤ 600 y pulso ≤ 1.800) se midieron con la arena 960x540. En 2x los enemigos
  nacen sin recortar, a ~582 px en lugar de pegados al borde (≤ ~480 px), y llegan más tarde. Se miden en el mismo
  punto de control. Si alguno falla, se vuelve al gate: el alcance prohíbe tocar stats y los plazos los fijó el
  usuario (riesgo R1).
- La fragilidad (25 en el límite) queda escrita en `run-outcome`, donde la registra el spec-writer, y en el diario
  de IA. Cualquier change de contenido posterior debe volver a ejecutar el balance.

### D9 · Garantía real de "fuera de la vista" (aviso a spec)
Con el dominio actual, el anillo (radio ≈ 582,7, mayor que la media diagonal de 551) queda siempre fuera del
rectángulo de la vista centrado en el jugador. Pero si la cámara está pegada a un borde del mundo (jugador a menos de
media vista del borde), un punto del anillo que cae fuera del mundo se recorta **sobre ese borde**, que está dentro
de la pantalla. Pasa ya hoy, donde todos los spawns tocan un borde ("Arena igual a la vista"). La propiedad que sí se
cumple sin tocar el dominio, y que deben fijar los escenarios y el E2E, es esta: en el tick de su aparición, cada
enemigo está fuera de `camera` **o** toca un borde del mundo (centro a `radio` de él). La alternativa de filtrar en
`placeSpawn` los candidatos visibles se descarta en este change porque cambia el consumo del `RandomGenerator` e
invalida la medición 25/50. Si se quiere, va a un change propio con recalibración.

**Resuelto en la spec delta `enemy-spawning`**: se acepta la aparición dentro de la vista cuando el recorte actúa y
solo se garantizan el mundo y `minDistance`. El E2E "Fuera de pantalla" fija el jugador quieto en el centro, donde
los únicos recortes caen en `y = radio` o `y = alto − radio`, fuera de (270..810). **Choca con el criterio de éxito
de `proposal.md`** ("Ningún enemigo aparece dentro del rectángulo de la vista … en el tick de su aparición"): ese
criterio debe leerse como el de la spec o corregirse en la propuesta antes de verify.

**Cerrado en apply (2026-11-23)**: la propuesta ya se corrigió con aprobación del usuario ("lejos de los bordes
fuera de la vista; cerca de un borde se acepta dentro de la vista a `minDistance` o más"). El E2E "Fuera de pantalla
en una partida real" lo comprueba con el jugador quieto en el centro.

### D10 · Renombrado medieval (solo textos)
- `content/upgrades.json`: los 9 `name`/`description` de la tabla aprobada en la propuesta. Los ids y el orden no
  cambian.
- `tests/support/builders.ts` (`DEFAULT_UPGRADES`) se actualiza a la vez, por el contrato de `content.test.ts`. Antes
  se escribe un test con la tabla de la spec (9 pares id → nombre/descripción) que falla en rojo.
- `run-snapshot.test.ts` (`name: 'Guardrail'`) es un dato de escenario: se actualiza solo si compara con el
  contenido. Los nombres de builders de armas (`aLinter`) y la prosa de tests con "Linter"/"Tests" (ids) no se tocan
  (renombrado de ids fuera de alcance). `Progress` no guarda nombres: sin impacto en `localStorage` ni en el JSON.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| content | `arena.json` | Mod. | Mundo 1920x1080 y vista 960x540 |
| content | `upgrades.json` | Mod. | 9 `name`/`description` (D10) |
| domain | — | — | Sin cambios |
| application | — | — | Sin cambios |
| infrastructure | `ArenaSchema` | Mod. | D1b: `superRefine` mundo ≥ vista (`width`/`height`) |
| infrastructure | `CameraRig` + `FollowCamera` | Nueva | D2; test con cámara falsa |
| infrastructure | `GroundView` (`WorldSize`) | Mod. | D3; suelo del mundo |
| infrastructure | `GameScene` | Mod. | `deps.world`, crea `CameraRig`, `track` en `render`, `cameraView()` |
| composition | `main.ts` | Mod. | Pasa `world`; sonda `camera` (getter) y `world` |
| tests | `policies`, `runs`, `builders`, `run.bench`, E2E | Mod. | D6 (`referenceBot(config)`), D7 (`pileOnPlayer`); guardarraíl `single-arena-source` |

No hay puertos ni eventos de dominio nuevos. `FollowCamera` es una costura interna del adaptador (como
`GroundFactory`/`SpriteKit`) para probar sin motor, no un puerto de dominio.

## Flujo de un frame (cambios en negrita)
1. `GameScene.update` hace lo de siempre: `PauseGate`, `TickRun` N ticks y `render(snapshot)`.
2. `render`: capas, **`rig.track(snapshot.player)`**, HUD/overlays (scrollFactor 0), progreso y `onRender` de la
   sonda.
3. Fase de render del motor: **la cámara, en `preRender`, centra el objetivo y recorta el scroll a
   `[0, W - 960] × [0, H - 540]`**. Pinta el mundo desplazado y el HUD fijo.
4. Lectura E2E entre frames: `snapshot` (mundo) y **`camera` (`worldView`)** del mismo frame.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna (cámara y `tileSprite` de Phaser 4.2.1 ya instalado) | — |

## Rendimiento y seguridad
- Núcleo: sin cambios de código. Medición previa: 0,110 ms/tick (base) frente a 0,119 (4x) en el peor caso. En 2x
  se espera ≤ 0,12, muy por debajo del presupuesto de 2 ms de media del bench.
- Render: un `tileSprite` de mundo (un quad, con fragmentos limitados al viewport) y un seguimiento O(1) por frame.
  No se crean objetos por frame: `CameraRig` y su objetivo se crean una vez en `create()`. Se verifica con la suite
  E2E con `CI_LIKE=1` (aplazado a 0014 por decisión del usuario: throttling por CDP).
- Datos persistidos: sin cambios. `Progress` no guarda ids ni nombres de mejoras. Entradas externas: `arena.json` y
  `upgrades.json` siguen pasando por zod y `buildRunRules`. La sonda `camera` solo existe con `?e2e` (spec
  main-menu, "Sin sonda fuera de E2E").

## Riesgos
- **R1 · Plazos de `balance.test.ts` con el mundo 2x** (D8): no se midieron en la exploración. Si fallan, se vuelve
  al gate antes de seguir con el resto.
- **R2 · Banda de balance en el límite** (25/50): cualquier cambio de contenido futuro puede sacarla. Está
  documentado y no se mitiga en este change (decisión del usuario).
- **R3 · Tiempos E2E**: la derrota con `STILL_DEFEAT_SEED`, la primera oferta y los enemigos visibles cambian de
  ritmo en 2x. Con la cámara, el jugador ya no ve todo el mundo. Hay que revisar las esperas, no los umbrales de la
  sonda.
- **R4 · Temblor sub-píxel** con `roundPixels: false` y la cámara en movimiento (doc de `startFollow`). Se mitiga en
  una línea si aparece.
- **R5 · Spawns visibles en el borde** (D9): con la cámara pegada a un borde, los enemigos pueden aparecer sobre el
  borde del mundo dentro de la pantalla. La spec `enemy-spawning` ya lo dice así; el criterio de éxito de la
  propuesta no (ver D9).
- **R7 · Tests con `aDefaultConfig()` que asumen 960x540**: 27 ficheros usan el contenido por defecto (p. ej.
  `finishedRuns`, `run-outcome-long`, `exits-equal-kills`, `run-state`). Con el mundo 2x cambian tiempos y
  posiciones. La tarea 1.2 los ejecuta todos y ajusta solo los números de escenario, nunca umbrales de spec.
- **R6 · Proyectiles fuera del suelo** cerca de los bordes: aceptado por la propuesta.

## ADRs
Ninguno. El tamaño del mundo es contenido, la cámara es un detalle del adaptador ya cubierto por ADR-0002 y
revertir el change supone un fichero de contenido y una clase del adaptador. La convención "geometría de escenario
frente a contenido" de los builders es de tests y queda en este design.
