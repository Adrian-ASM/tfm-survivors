# Tasks · 0013-world-camera

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: punto de control de balance →
     dominio/tests de soporte → infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit
     por tarea. "E2E afectados" = specs de Playwright que hay que ejecutar en esa tarea
     (`npm run test:e2e -- <nombres>`); "—" = ninguna. La suite E2E entera solo en 6.2. -->

## 0. Punto de control de balance (design D8). Si falla, PARAR y volver al gate humano
- [x] 0.1 Bot ligado a la configuración (D6): `referenceBot(config)` en `tests/support/policies.ts`, que toma
  `config.arena`; `playReferenceBot(run, bot, maxTicks)` en `runs.ts`; `fleeInput(snapshot, arena)` sin valor por
  defecto y sin `DEFAULT_ARENA`. Rojo primero en `tests/domain/policies.test.ts` con arena explícita 4.000 × 4.000.
  Con el mundo aún en 960 × 540, `balance.test.ts` debe seguir dando 30/50.
  Escenarios: run-outcome "El bot huye de las paredes del mundo real", "Sin arena por defecto duplicada".
  Test: `tests/domain/policies.test.ts`, `tests/domain/balance.test.ts`. E2E afectados: —
- [x] 0.2 Mundo 1.920 × 1.080 y medición. Rojo primero: `content.test.ts` (mundo 1.920 × 1.080, vista 960 × 540),
  `player.test.ts` (posición inicial (960, 540) con el contenido por defecto, "El borde de la vista no es una pared"
  (940, 270) → (1.140, 270)), `policies.test.ts` (paredes a 1.900, 940/270, 64, esquina (1.904, 1.064)) y
  `place-spawn.test.ts` ("Jugador en el centro del mundo por defecto"). Después: `content/arena.json` a 1.920 × 1.080,
  `aDefaultConfig()` toma `arena` de `content/arena.json` y `aRunConfig()` usa `SCENARIO_ARENA` (D6). Ejecutar
  `balance.test.ts` y anotar en `docs/ai-log/` victorias/50, quietos supervivientes y los cuatro plazos ("Primera
  subida" semilla 7, "Primer golpe" semilla 42, "Jugador quieto" baja y pulso). **Seguir solo si salen 25/50, 0
  quietos y los plazos en verde.** Si no, parar sin tocar umbrales ni stats (R1).
  Escenarios: world-camera "Contenido por defecto"; player-movement "Partida nueva con el mundo por defecto", "El
  borde de la vista no es una pared"; run-outcome "Huida sin amenazas", "Huida de un enemigo", "Enemigo fuera de
  rango", "Repulsión de la pared derecha del mundo", "El borde de la vista no es una pared", "Pared a exactamente
  64 px", "Esquina del mundo", "Contenido de los tests igual al del juego", y la banda 25..35 y los 180 s sin cambios;
  enemy-spawning "Jugador en el centro del mundo por defecto".
  Test: los citados + `tests/domain/balance.test.ts`. E2E afectados: —

## 1. Dominio (solo números de escenario; el código de `src/domain` no cambia)
- [ ] 1.1 Ajustar los tests con `aDefaultConfig()` que asumían 960 × 540 (R7): ejecutar la suite, corregir solo
  números de escenario (posiciones, ticks de los ejemplos) en `finishedRuns`, `run-outcome-long`,
  `exits-equal-kills`, `run-state` y los que fallen. Actualizar los escenarios con arena explícita 1.920 × 1.080 y
  las partidas largas de 36.000 ticks, que leen `config.arena` (`long-run.test.ts` `inside()`). Rojo: las partidas
  largas con el rango [16, 1.904] × [16, 1.064] escrito desde `config.arena` fallan si `inside()` sigue en 960.
  Escenarios: player-movement "Choque con el borde derecho", "Choque con el borde inferior", "Esquina superior
  izquierda", "Esquina inferior derecha", "Deslizar por la pared", "Partida larga dentro del mundo"; enemy-behavior
  "Enemigo más grande que el jugador junto a un borde", "Enemigo junto al borde inferior", "Persecución más allá del
  borde de la vista", "Partida larga"; enemy-spawning "Arena mayor que la vista", "Arena igual a la vista"
  (`SCENARIO_ARENA`), "Jugador en una esquina", "Jugador en la esquina opuesta", "Ninguna posición válida", "El
  presupuesto no se pierde al aplazar", "Partida larga sin spawns ilegales"; run-outcome "Bot reproducible".
  Test: `tests/domain/player.test.ts`, `enemy.test.ts`, `place-spawn.test.ts`, `long-run.test.ts`,
  `determinism-progression.test.ts`. E2E afectados: —
- [ ] 1.2 Contacto con cualquier tamaño de mundo (D7): helper `pileOnPlayer(config)` en `tests/support/runs.ts`
  (enemigos en `arena.center`) y test determinista de 600 ticks con el mundo por defecto y con 4.000 × 4.000, que
  comprueba en cada tick ≥ 1 enemigo a ≤ `r_jugador + r_enemigo` y la partida en curso. Rojo: con el punto fijo
  actual, la arena 4.000 × 4.000 no tiene contacto. Después, `run.bench.ts` usa el helper y deriva de `arena` las
  posiciones de `runWorstCase*` y el alcance `Math.ceil(Math.hypot(W, H))`. Ejecutar `npm run bench` una vez y
  anotar los ms/tick en `docs/ai-log/`.
  Escenarios: simulation-loop "200 enemigos encima del jugador", "Contacto con cualquier tamaño de mundo", "Tope de
  vivos alcanzado", "Peor caso con proyectiles", "Peor caso con gemas".
  Test: `tests/domain/piled-contact.test.ts` (nuevo), `tests/bench/run.bench.ts`. E2E afectados: —

## 2. Contenido e infraestructura sin motor
- [ ] 2.1 Mundo ≥ vista en zod (D1b): `superRefine` en `ArenaSchema` con issues en `width` y `height` y mensajes
  como constantes. Rojo: 959 × 1.080 y 1.920 × 539 cargan hoy sin error.
  Escenarios: world-camera "Mundo más estrecho que la vista", "Mundo más bajo que la vista", "Mundo igual a la
  vista", "Dimensiones no positivas" (los tres casos).
  Test: `tests/infrastructure/content.test.ts`, `tests/composition/content-boot.test.ts` (sin menú ni partida con
  el contenido inválido). E2E afectados: —
- [ ] 2.2 Textos medievales (D10): test con la tabla de 9 pares id → `name`/`description` y con la lista de palabras
  del tema anterior (rojo), una copia congelada en el test de ids, objetivo, `stat`, `perLevel` y `maxLevel` de
  `main` (debe seguir verde) y una partida con semilla 42 con los textos viejos y con los nuevos (snapshots iguales
  salvo `name`/`description` de la oferta). Después, `content/upgrades.json`, `DEFAULT_UPGRADES` de `builders.ts` y
  el caso de `upgrade-overlay.test.ts` con `strict-rules`, `guardrail` y `shortcuts`.
  Escenarios: upgrades "Textos del catálogo por defecto", "Sin textos del tema anterior", "Ids y números sin
  cambios", "La carta muestra el texto nuevo", "Misma partida con los textos nuevos".
  Test: `tests/infrastructure/upgrades-text.test.ts` (nuevo), `tests/infrastructure/upgrade-overlay.test.ts`,
  `tests/domain/upgrades-rename-determinism.test.ts` (nuevo). E2E afectados: `level-up`
- [ ] 2.3 `CameraRig` + `FollowCamera` (D2) con cámara falsa: `setBounds(0, 0, W, H)` una vez, `startFollow` con
  `roundPixels` false y lerp 1, `track(player)` copia x/y al objetivo propio, `view()` devuelve `worldView`. La
  cámara falsa aplica la fórmula de `startFollow` + bounds para fijar el contrato. Rojo: la clase no existe. Incluye
  un test con semilla 7 y 3.600 ticks, con y sin `track` en cada snapshot, que compara snapshots tick a tick y
  comprueba que `track` no muta el snapshot.
  Escenarios: world-camera "Jugador en el centro del mundo", "Las cuatro esquinas", "Límite exacto del recorte",
  "Recorte en un solo eje", "Seguimiento sin retraso", "Mundo igual a la vista", "Misma partida con y sin pintar".
  Test: `tests/infrastructure/camera-rig.test.ts` (nuevo). E2E afectados: —
- [ ] 2.4 Suelo del tamaño del mundo (D3): `GroundView` recibe `WorldSize`; `tiles`/`rect` de reserva con el mundo,
  no con la vista. Rojo: `ground-view.test.ts` con mundo 1.920 × 1.080 y vista 960 × 540 espera 1.920 × 1.080 y recibe
  960 × 540.
  Escenarios: sprite-rendering "Fondo de hierba en el mundo entero", "Fondo de reserva en el mundo entero" (parte
  unitaria: relleno liso (0, 0)–(W, H)).
  Test: `tests/infrastructure/ground-view.test.ts`. E2E afectados: —
- [ ] 2.5 HUD y overlay de elección con `scrollFactor` 0 (D4): test con escena falsa que comprueba que todos los
  widgets de `sceneWidgets.ts` (HUD, velo, cartas y resultados) se crean con `setScrollFactor(0)` y en coordenadas
  de la vista. Rojo: quitar temporalmente el `setScrollFactor` de un widget y ver que el test lo detecta (anotar en
  el commit); no hay código de producción nuevo.
  Escenarios: world-camera "HUD con la cámara movida" (parte unitaria).
  Test: `tests/infrastructure/hud.test.ts`. E2E afectados: —

## 3. Composición y adaptador Phaser
- [ ] 3.1 `GameSceneDeps.world`, `CameraRig` sobre `this.cameras.main` en cada `create()`, `rig.track` en `render`
  antes de `onRender`, `GameScene.cameraView()`, y en `main.ts` el `world` desde `config.value.arena` y la sonda con
  getter `camera` (null en el menú) y `world`. `tests/e2e/probe.ts`: `player.x/y`, `camera`, `world`,
  `startCameraSampler` y `watchNextRun` con `camera` (D5). Rojo: E2E nuevo `camera.spec.ts` "Rectángulo coherente con
  el jugador" (`?e2e&seed=42`, 600 frames: 960 × 540, mundo 1.920 × 1.080 y fórmula con error ≤ 1 px).
  Escenarios: world-camera "Rectángulo coherente con el jugador", "Sin sonda fuera de E2E", "Jugador en el centro del
  mundo" (en el navegador).
  Test: `tests/e2e/camera.spec.ts` (nuevo), `tests/composition/run-launcher.test.ts` si cambia la firma.
  E2E afectados: `camera`, `smoke`, `sprites`, `menu-flow`

## 4. E2E
- [ ] 4.1 Cuatro esquinas: helper `walkToCorners(page)` (teclado, `?e2e&seed=7`, `E2E_SPEED`) y muestreo de cámara y
  sprites en todos los frames del recorrido: rectángulo dentro de (0, 0)–(1.920, 1.080), dentro del rectángulo del
  fondo y `ground.visible` 1; y lo mismo con la hoja del suelo abortada (fondo en reserva). Rojo: falla hasta que el
  suelo cubre el mundo en el navegador (si 2.4 y 3.1 ya lo dejan verde, se junta con 3.1).
  Escenarios: world-camera "Nada fuera del mundo en una partida real"; sprite-rendering "Fondo en las cuatro
  esquinas", "Fondo de reserva en el mundo entero".
  Test: `tests/e2e/camera.spec.ts`, `tests/e2e/sprites.spec.ts`. E2E afectados: `camera`, `sprites`
- [ ] 4.2 Partida nueva tras acabar en una esquina: ir a (1.904, 1.064), quedarse quieto hasta la derrota, pulsar R
  y leer con `watchNextRun` el primer frame (jugador en (960, 540), cámara en (480, 270)); lo mismo con `Volver al
  menú` + `Jugar`. Rojo: sin `CameraRig` recreado en `create()` la cámara hereda el scroll anterior.
  Escenarios: world-camera "Partida nueva tras acabar en una esquina"; player-movement "Partida nueva tras acabar en
  una esquina".
  Test: `tests/e2e/camera.spec.ts`. E2E afectados: `camera`, `results`, `menu-flow`
- [ ] 4.3 HUD y overlays con la cámara movida: con el jugador en (1.904, 1.064) y una oferta abierta, clic en la
  tercera carta en su posición de pantalla (`cardLayout`) → índice 2, y cartas en la misma posición que con el
  jugador en (480, 270); pausa y resultados (DOM) con la misma caja de pantalla en (1.904, 16) y en (480, 270), y
  `Volver al menú` responde al clic. Rojo: clic en la carta calculada en coordenadas de mundo en vez de pantalla.
  Escenarios: world-camera "Overlay de elección con la cámara movida", "Resultados y pausa con la cámara movida",
  "HUD con la cámara movida" (en el navegador, posición del lienzo).
  Test: `tests/e2e/camera.spec.ts`. E2E afectados: `camera`, `pause`, `level-up`
- [ ] 4.4 Enemigos en coordenadas de mundo y aparición fuera de pantalla: `enemies.spec.ts` pierde `ARENA` y lee
  `content/arena.json`; nuevo caso `?e2e&seed=42` sin input, 600 frames, primera posición de cada id fuera del
  rectángulo visible (480, 270)–(1.440, 810); conversión de pantalla (x − izquierda, y − arriba) para el enemigo y el
  jugador junto a una esquina. Guardarraíl `single-arena-source.test.ts` (D6): sin `DEFAULT_ARENA` en `tests/` y
  sin literales 960/540 en `tests/e2e/**`, `tests/bench/**`, `policies.ts` y `runs.ts`. Rojo: el guardarraíl falla
  con la `ARENA` de `enemies.spec.ts`.
  Escenarios: enemy-spawning "Fuera de pantalla en una partida real"; world-camera "Enemigo a la derecha del
  jugador", "Jugador junto a una esquina"; run-outcome "Sin arena por defecto duplicada".
  Test: `tests/e2e/enemies.spec.ts`, `tests/e2e/camera.spec.ts`,
  `tests/infrastructure/single-arena-source.test.ts` (nuevo). E2E afectados: `enemies`, `camera`
- [ ] 4.5 Esperas de ritmo con el mundo 2x (R3): ejecutar `health`, `level-up`, `weapons`, `results` y `speed`;
  ajustar solo esperas y timeouts de reloj, nunca umbrales de spec. Comprobar la derrota con `?e2e&seed=42` ≤ 180 s.
  Escenarios: run-outcome "Derrota E2E con una semilla del conjunto".
  Test: `tests/e2e/results.spec.ts` y los citados. E2E afectados: `health`, `level-up`, `weapons`, `results`,
  `speed`

## 5. Rendimiento
- [ ] 5.1 Suite E2E con `CI_LIKE=1 --workers=12 --repeat-each=3` sobre `camera`, `sprites`, `smoke` y `menu-flow`;
  si aparece temblor visible con la cámara en movimiento, `roundPixels` true (R4) con su test en
  `camera-rig.test.ts`. Escenario: sprite-rendering "Fondo en las cuatro esquinas" (sin fallos intermitentes).
  E2E afectados: `camera`, `sprites`, `smoke`, `menu-flow`

## 6. Documentación y cierre
- [ ] 6.1 `AGENTS.md` §1 (mundo 1.920 × 1.080, cámara, sonda `camera`/`world`, textos medievales, balance 25/50 en el
  límite), diario de IA con las mediciones de 0.2 y 1.2, y nota en el design si el criterio de éxito de la
  propuesta sobre spawns en la vista se ha corregido (D9). Sin test; `npm run verify` en verde.
- [ ] 6.2 `npm run verify` y suite E2E completa (también con `CI_LIKE=1`). E2E afectados: todas
