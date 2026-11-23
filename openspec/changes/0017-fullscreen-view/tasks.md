# Tasks · 0017-fullscreen-view

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → contenido →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea.
     Rojo primero: escribe el test, compruébalo en rojo (`npm run verify:fast`), implementa, `npm run verify`.
     Excepciones justificadas: 2.1 (medición, sin test rojo) y 2.4 (cambio de mundo atómico, ~60 min: los tests
     de literales no pueden pasar a verde por separado sin dejar el repo en rojo). -->

## 1. Dominio (refactor que conserva el comportamiento)
- [x] 1.1 `SpawnRules` con `ringRadius` de contenido, sin `View` (design D3).
  - Rojo: `tests/domain/spawn-rules.test.ts` (nuevo o ampliado): `SpawnRules.create(config)` sin `View` usa
    `ringRadius`; 0, −1, `NaN` e `Infinity` → `RING_RADIUS_MUST_BE_POSITIVE` en `waves.spawn.ringRadius`;
    `minDistance ≥ ringRadius` es válido. `tests/domain/place-spawn.test.ts` con `ringRadius` explícito.
  - Código: `src/domain/wave/SpawnRules.ts`, `SpawnConfig` (`margin` → `ringRadius`), `WavesSchema.spawn`,
    `tests/support/builders.ts`, `tests/domain/run-weapons.test.ts` (de "vista pequeña + margin 0" a `ringRadius`
    pequeño, p. ej. 71).
  - `content/waves.json`: `ringRadius` **provisional 582.727** (el radio que hoy sale de vista + margen), para no
    mover el balance hasta 2.4. El literal vive solo en `content/`, nunca en `tests/`.
  - Escenarios: "Arena mayor que el anillo" (arena 4.000 × 4.000 y `ringRadius` 1.500 explícitos), "El presupuesto
    no se pierde al aplazar" (sigue en verde).
- [x] 1.2 La vista sale del núcleo (design D2, D3).
  - Rojo: `tests/infrastructure/content.test.ts`: con el contenido por defecto, `parseRunConfig` da
    `arena` = `{ width, height }` sin `view` y `waves.spawn` sin tamaño de vista; `buildRunRules` no expone `view`.
  - Código: borrar `src/domain/arena/View.ts` y `tests/domain/view.test.ts`; `RunRules` sin `view`; `RunConfig.arena`;
    `parseRunConfig` devuelve `ParsedContent` (sin `view` hacia el dominio). `SCENARIO_ARENA`, `piled-contact`,
    `policies` y `content.test` pierden `arena.view`. `ArenaSchema` conserva `view` hasta 2.2.
  - Escenarios: "Radio del anillo por defecto" (parte "ningún tamaño de vista ni de ventana"), "Contenido por
    defecto" de `world-camera` (parte "el núcleo no recibe el tope").

## 2. Contenido y balance
- [x] 2.1 **Calibración de la tabla de oleadas** (design D9). Tarea de medición: no toca `content/`.
  - Con `aDefaultConfig` sobreescrito (arena 3.840 × 2.160, `ringRadius` 1.500, mapa generado y mapa vacío) y el bot
    `referenceBot(config)`, mide para cada candidata, en orden: A 1,2/2,2/2,2/3,2/4,48 · B 1,2/2,0/2,0/3,2/4,48 ·
    C 1,2/2,2/2,2/3,0/4,2 · D 1,1/2,0/2,0/3,4/4,6, y como mucho 2 interpolaciones entre las dos mejores (≤ 6).
  - Por tabla: victorias del bot en 1..50; quietos vivos al tick 10.800 con mapa generado y con mapa vacío; tick de
    la primera oferta del quieto con la semilla 7.
  - **Criterio de salida**: la primera tabla **no decreciente** con 25–35 victorias, 0 quietos vivos (ambos mapas) y
    primera oferta ≤ 4.800 se anota aquí y en design D9. Si ninguna lo cumple, **para y reporta** las mediciones al
    orquestador (se vuelve a spec). Prohibido relajar la monotonía, la banda o el quieto, o tocar `player.speed`,
    `maxBudget`, `maxAlive` o `types`.
  - Herramienta: helper de medición en `tests/support/` reutilizable por `balance.test` (o script local que no se
    commitea). Tabla elegida: `1,2 / 2,4 / 2,4 / 3,0 / 4,2` (E1, 2.ª ronda autorizada por el usuario: tramo de 60 s en 2,4) ·
    victorias `25/50` · quietos vivos `0/0` · primera oferta (s7) tick `1.527`. Mediciones en el diario de IA.
  - Escenarios: "Tasa de victoria del bot de referencia", "Jugador quieto pierde con todas las semillas", "… también
    con el mapa vacío", "Oleadas que crecen con el contenido por defecto" (vivo).
- [x] 2.2 `ArenaSchema` con `maxView` y fuera `view` (design D2).
  - Rojo: `tests/infrastructure/content.test.ts` con arenas explícitas: 2.559 × 2.160 con tope 2.560 × 1.440 → error
    en `width`; 3.840 × 1.439 → `height`; 2.560 × 1.440 igual al tope → éxito; `width` 0, `height` −1,
    `maxView.width` 0 → error con el campo; `view` extra → "clave desconocida" en `arena.view`.
    `tests/composition/content-boot.test.ts`: `BootedContent.maxView` existe.
  - Código: `src/infrastructure/content/schemas.ts` (mensajes "tope de vista"), `loadRunConfig`, `contentBoot`,
    `content/arena.json` (`view` → `maxView` con el valor actual 960 × 540, mundo aún 1.920 × 1.080), `main.ts` toma
    el tamaño fijo del lienzo de `maxView` (RESIZE llega en 4.1).
  - Escenarios: "Mundo más estrecho que el tope", "Mundo más bajo que el tope", "Mundo igual al tope", "Dimensiones
    no positivas", "Vista fija heredada".
- [x] 2.3 Regla cruzada del anillo frente al tope (design D2).
  - Rojo: `content.test.ts` con tope 2.560 × 1.440 explícito: `ringRadius` 0, −1, 1.468 y 1.468,6 y ausente →
    error que menciona `ringRadius`; 1.468,61 → éxito; `"margin": 32` en `spawn` → error que menciona `margin`.
  - Código: `superRefine` de `RunConfigSchema` con `ringRadius > hypot(maxView) / 2` (estricto) y
    `SPAWN_RING_INSIDE_MAX_VIEW` en `waves.spawn.ringRadius`. Con el contenido actual (582,727 > 550,7) sigue válido.
  - Escenarios: "Radio del anillo fuera de rango", "Radio del anillo en el límite", "Margen heredado".
- [x] 2.4 **Mundo 3.840 × 2.160, tope 2.560 × 1.440, `ringRadius` 1.500 y tabla de 2.1** (design D8, D9; atómica).
  - Rojo primero (con los literales nuevos de las specs): rejilla 64 × 36 = 2.304; celda de (1.919,9; 1.079,9),
    (1.920, 1.080), (0, 0) y (3.840, 2.160); castillo 30–34 × 15–18 y salida (1.950, 1.170) con semillas 42, 1..1.000,
    0 y 4.294.967.295; arena 4.000 × 4.000 → 67 × 67, castillo 31–35 × 30–33, salida (2.010, 2.070); zona de inicio
    (35, 19)/(32, 22) dentro y (36, 19)/(32, 23) fuera; mapa vacío salida (1.920, 1.080); mapa de 32 × 18 rechazado;
    `ringRadius` por defecto 1.500; tabla no decreciente; balance en banda.
  - Contenido: `arena.json` `{ 3840, 2160, maxView 2560 × 1440 }`; `waves.json` `ringRadius` 1.500 y la tabla de 2.1.
  - Migración en el mismo commit: `MAP_GOLDEN` regenerada con `map-golden.test` (36 filas × 64 por semilla; revisar
    a mano 20 `C` en 30–34 × 15–18 y ningún `~`/`=` en la zona de inicio); `MAX_MAP_OBJECTS` 300 → 1.000 (test sin
    navegador de `planMapArt` con 42 y 123); (990, 630) → (1.950, 1.170); 14–18 × 6–9 → 30–34 × 15–18; tolerancia de
    troncos 231–322 y caminables ≥ 1.613; `FIRST_OFFER_LIMIT` 4.800 con el tick medido; escenarios de
    `player-movement` (bordes 3.824 / 2.144, fachada (1.950, 1.156), "El borde de la vista no es una pared" en
    (1.270, 270)) y del bot (salida ante la puerta → (0, 1), paredes del mundo 3.840 × 2.160, arena 4.000 × 4.000).
  - Ficheros: `content/arena.json`, `content/waves.json`, `tests/support/mapGolden.ts`, `tests/domain/**`
    (`generate-castle`, `connectivity`, `start-zone`, `map-grid`, `player-*`, `run-spawning`, `balance`),
    `tests/support/**`, test de `planMapArt`.
  - Escenarios: `procedural-map` ("Rejilla por defecto", "Mundo no múltiplo de la celda", "Celda de un punto",
    "Huella y salida por defecto", "Misma huella con todas las semillas", "Huella en un mundo mayor", "Celdas dentro
    y fuera de la zona", "Zona libre con todas las semillas", "Todas las celdas caminables alcanzables", "Celdas tras
    el castillo alcanzables", "Composición con las semillas del conjunto", "Sin río ni troncos", "Firma de referencia
    del mundo nuevo", "Mapa de dimensiones incorrectas", "Mismos spawns con y sin mapa"); `enemy-spawning`
    ("Jugador en el centro del mundo por defecto", "Jugador ante la puerta del castillo", "Arena menor que el anillo",
    "Jugador en una esquina", "… opuesta", "Ninguna posición válida", "Partida larga sin spawns ilegales");
    `player-movement` (todos los de "Límites de la arena", "Posición inicial…", fachada del castillo); `run-outcome`
    (banda, quietos, bot); `upgrades` "Primera subida en el núcleo"; `sprite-rendering` "Objetos del mapa"
    (test sin navegador, ≤ 1.000).
- [x] 2.5 Guardarraíl de una sola fuente (design § Migración).
  - Rojo: `tests/infrastructure/single-arena-source.test.ts`: `LITERAL_SIZE` pasa a `\b(3840|2160|2560|1440)\b`
    (mundo y tope) en E2E, bench, `policies` y `runs`; nuevo caso sin `582.7` ni `582.727` en `tests/`; contenido de
    los tests igual campo a campo al JSON (incluidos `maxView` y `ringRadius`). Rojo si queda algún `WORLD`/tope
    escrito a mano en `tests/e2e` (p. ej. cámara [510, 360]): se lee de `content/arena.json`.
  - Escenarios: "Sin arena por defecto duplicada", "Sin radio del anillo derivado de la vista", "Contenido de los
    tests igual al del juego".

## 3. Infraestructura de presentación (pura o con dobles)
- [x] 3.1 `screenFrame(width, height)` (design D5). Fichero: `src/infrastructure/phaser/ui/screenFrame.ts`.
  - Rojo: tabla en `tests/infrastructure/screen-frame.test.ts`: 320 × 180, 640 × 360, 959 × 539, 960 × 540,
    1.280 × 720 → ×1; 1.919 × 1.080 → ×1; 1.920 × 1.080, 2.560 × 1.440 → ×2; 1.280,5 → 1.280; 0 × 0 y `NaN` → 1 × 1,
    ×1; secuencia 960 × 540 … 3.840 × 2.160 (recortada al tope) no decreciente.
  - Escenarios: "Escala mínima", "Escala en pantallas grandes", "Monotonía", "Ventana minimizada" (saneado).
- [x] 3.2 `hudLayout(frame)` (design D5). Fichero: `ui/uiLayout.ts`; constantes de `sceneWidgets` se mueven aquí.
  - Rojo: `tests/infrastructure/ui-layout.test.ts`: vida/XP a la izquierda, reloj en `width / 2`, bajas a
    `width − margin`; distancias al anclaje iguales en 960 × 540 y 1.280 × 720; tras 1.280 → 1.000 el borde derecho
    se mueve 280 px; con ×2 medidas y distancias dobles; cajas reservadas (con el ancho máximo de `120/120`, `10:00`,
    nivel 99 y 12.345 bajas) enteras y sin solapes en 960 × 540, 1.280 × 720, 1.920 × 1.080 y 2.560 × 1.440.
  - Escenarios: "Mismo anclaje con dos ventanas", "Esquina opuesta que sigue a la ventana", "HUD entero y sin
    solapes", "Ventana menor que 960 × 540" (hud), "Tamaños proporcionales al factor".
- [x] 3.3 `cardLayout(frame, n)` y `veilLayout(frame)` (design D5). Ficheros: `cardLayout.ts` (modificado),
  `ui/uiLayout.ts`.
  - Rojo: `tests/infrastructure/card-layout.test.ts`: centro del rectángulo de 3 cartas en (640, 360) con
    1.280 × 720 y la de índice 1 lo contiene; 2 y 1 cartas centradas en (480, 270) con 960 × 540; enteras y sin
    solapes en 960 × 540 y en el frame de 3.840 × 2.160 (×2); con 640 × 360 centrado en (320, 180); velo
    `width × height` centrado.
  - Escenarios: "Tres cartas centradas", "Dos cartas y una carta", "Ventana mínima con cartas enteras", "Ventana
    menor que 960 × 540" (upgrades, parte geométrica).
- [x] 3.4 `Hud.relayout` y `XpBar.relayout` (design D6). Ficheros: `Hud.ts`, `XpBar.ts`, `sceneWidgets.ts`.
  - Rojo: `tests/infrastructure/hud.test.ts`: tras `relayout` con otro ancho de barra el relleno se recalcula (caché
    invalidada); 50 `relayout` alternos no crean elementos (exactamente 1 de cada uno) y acaban en el último frame;
    `relayout` con el mismo frame no cambia posiciones ni tamaños; cambiar de ×1 a ×2 vuelve a pintar el texto
    (`setFontSize`) con los mismos valores.
  - Escenarios: "Muchos cambios seguidos", "Mismo tamaño", "Cambio de escalón al redimensionar".
- [x] 3.5 `UpgradeOverlay.relayout` con la oferta abierta (design D6). Fichero: `UpgradeOverlay.ts`.
  - Rojo: `tests/infrastructure/upgrade-overlay.test.ts`: con la oferta abierta, `relayout` a 1.000 × 600 recoloca
    las cartas (`setPosition`/`setSize`) sin cerrar ni cambiar la oferta, y el `pointerdown` de la tercera da índice 2;
    el velo no elige nada; posiciones iguales con dos rectángulos de cámara distintos.
  - Escenarios: "Clic tras redimensionar", "Overlay de elección con la cámara movida".
- [x] 3.6 `CameraRig.resize(frame)` y misma partida con ventanas distintas (design D4). Ficheros: `CameraRig.ts`
  (`FollowCamera.setSize`), `tests/infrastructure/camera-rig.test.ts`.
  - Rojo: `FakeCamera` de tamaño parametrizable con `setSize`; esquinas, límites exactos, recorte en un eje y
    seguimiento sin retraso con 1.280 × 720 en el mundo por defecto; vista 2.560 × 1.440 (ventana 3.840 × 2.160) en
    (1.920, 1.080) y (16, 16); 960 × 540; mundo 2.560 × 1.440 = tope; `resize` a 800 × 450 con el jugador en
    (1.920, 1.080) → esquina (1.520, 855); 0 × 0 → vista saneada y vuelta a 1.280 × 720 correcta; primera partida
    tras R desde (3.824, 2.144) → (1.280, 720)–(2.560, 1.440).
  - Ampliación (verde esperado, va en la misma tarea): "Misma partida con ventanas distintas" (960 × 540,
    2.560 × 1.440 y alternancia cada 60 ticks 320 × 180 / 1.280 × 720 / 3.840 × 2.160 recortada al tope, semilla 7,
    3.600 ticks) y "Mismas apariciones con cualquier ventana" (semilla 42, 1.200 ticks).
  - Escenarios: todos los de "Cámara que sigue al jugador dentro del mundo" salvo el E2E, "Redimensionado en mitad de
    la partida", "Ventana minimizada", "Misma partida con y sin pintar", "Misma partida con ventanas distintas",
    "Mismas apariciones con cualquier ventana", "Fondo con la ventana en el tope".
- [x] 3.7 `watchScreen(scale, sceneEvents, apply)` (design D6). Fichero: `ui/watchScreen.ts`.
  - Rojo: `tests/infrastructure/watch-screen.test.ts` con dobles `ScaleLike`/`SceneEventsLike`: llamada inicial con
    `screenFrame(gameSize)`; una llamada por RESIZE; ninguna tras SHUTDOWN; tras dos entradas en la escena, una sola
    escucha activa.
  - Escenarios: "Muchos cambios seguidos" (sin escuchas duplicadas), "Redimensionado en el menú y con resultados"
    (sin partida nueva al reentrar).
- [x] 3.8 Líneas de resultados en el DOM (design D11). Ficheros: `src/infrastructure/dom/DomResultsLines.ts`,
  `dom/ResultsPanel.ts` (cabecera), `sceneWidgets.ts` (`createResultsOverlay` solo con velo).
  - Rojo: `tests/infrastructure/dom-results-lines.test.ts` con dobles `{ textContent, hidden }`: `ResultsOverlay`
    sobre `DomResultsLines` rellena título, tiempo, nivel, bajas e indicación de R al terminar y las oculta al
    volver a `playing`; `results-overlay.test.ts` sigue en verde.
  - Escenarios: "Resultados centrados" (estructura: un único bloque), "Botones tras redimensionar" (la partida
    terminada no cambia).
- [x] 3.9 `applyUiScale` y CSS (design D6, D11). Ficheros: `src/infrastructure/dom/applyUiScale.ts`, `src/styles.css`.
  - Rojo: `tests/infrastructure/apply-ui-scale.test.ts` con un doble de `style.setProperty`: pone `--ui-scale` 1 y 2
    según el frame y no escribe si no cambia.
  - CSS: `body { overflow: hidden }`, `#game > canvas { display: block }`, `.results-panel` centrado (fuera
    `align-self: end`), tamaños de `.menu-panel`, `.pause-panel`, `.confirm-dialog` y `.results-panel` con
    `calc(<base> * var(--ui-scale, 1))` y medidas internas en `em`.
  - Escenarios: "Pausa centrada y operativa tras redimensionar", "Diálogo abierto al redimensionar", "Contenido
    máximo en la ventana mínima" (comprobación manual en 6.2).

## 4. Composición y E2E
- [x] 4.1 Configuración de escalado (design D1). Fichero: `src/composition/scaleConfig.ts` (puro) y `main.ts`.
  - Rojo: `tests/composition/scale-config.test.ts`: `scaleConfig(maxView)` da `RESIZE`, `min` 1 × 1,
    `max` = `maxView`, `snap` 1 × 1, `NO_CENTER` y tamaño inicial `maxView`.
  - `main.ts`: `scale: scaleConfig(booted.maxView)`; escucha única de `phaserGame.scale` RESIZE → `applyUiScale`.
  - Escenarios: "Ventana de las pruebas", "Ventana igual al tope", "Ventana mayor que el tope", "… en un solo eje",
    "Ventana pequeña", "Densidad de píxeles 2" (zoom 1, sin reescalado: manual en 6.2).
- [x] 4.2 Sonda `viewport` (design D10). Ficheros: `src/infrastructure/e2e/viewportProbe.ts` (puro), `main.ts`.
  - Rojo: `tests/infrastructure/viewport-probe.test.ts`: `viewportProbe(parentSize, gameSize)` da ancho y alto de
    ventana redondeados hacia abajo y el `uiScale` del lienzo (3.840 × 2.160 → ventana 3.840 × 2.160, ×2).
  - `main.ts`: `probe.viewport` (getter), también en el menú. `screen` (`'menu' | 'playing'`) no cambia.
  - Escenarios: "Sonda en el menú" (world-camera), "Sin sonda fuera de E2E" (sigue en verde).
- [x] 4.3 Cableado del redimensionado + E2E nuevo (design D6, D11; regla `e2e-lite`: 1 E2E nuevo).
  - Rojo: nuevo test en `tests/e2e/gameplay.spec.ts`, "Redimensionado con la oferta abierta"
    (`?e2e&manual&seed=7`, 1.280 × 720): `step(60)` hasta la oferta en el tick n; `page.setViewportSize(1000, 600)`;
    esperar `camera.width === 1000`; `viewport` 1.000 × 600; esquina con la fórmula y el jugador del snapshot
    (≤ 1 px); tick n; clic en (500, 300) → mejora elegida `offer[1]`.
  - Código: `GameScene.create` registra `watchScreen` con `relayout(frame)` (`rig.resize`, `hud.relayout`,
    `offer.relayout`, velos); `GameScene` recibe `DomResultsLines` por dependencias; `MenuPanel` con `h1` del título
    y `MenuScene` sin texto ni título; `main.ts` pasa las líneas y el título.
  - Escenarios: "Redimensionado con la oferta abierta [E2E]", "Redimensionado en pausa", "Jugar tras redimensionar el
    menú", "Capas tras redimensionar", "Mapa intacto al redimensionar" (lógica: `relayout` no toca el mapa).
- [x] 4.4 E2E ampliados (sin tests nuevos).
  - Rojo: `playwright.config.ts` con `viewport: { width: 1280, height: 720 }` en `logic` y `realtime`;
    `gameplay.spec` "Cámara" (`?e2e&manual&seed=42`): `viewport` 1.280 × 720 y `uiScale` 1, mundo de
    `content/arena.json` (3.840 × 2.160), rectángulo 1.280 × 720 con la fórmula y primera esquina (1.310, 810);
    sonda del mapa con 64 × 36, 20 `castle`, huella 30–34 × 15–18, salida (1.950, 1.170); `smoke.spec` comprueba el
    título del menú en el `h1` y la sonda `viewport` en el menú.
  - Escenarios: "Rectángulo coherente con el jugador [E2E]", "Sonda en el menú", "Sonda con castillo y salida [E2E]",
    "Recuentos del mapa pintado [E2E]" (recuentos con la rejilla nueva), "Nada fuera del mundo con el mapa real".

## 5. Documentación y cierre
- [x] 5.1 Documentación.
  - `AGENTS.md` §1 (lienzo RESIZE con tope 2.560 × 1.440, mundo 3.840 × 2.160 y rejilla 64 × 36, castillo 30–34 ×
    15–18 y salida (1.950, 1.170), `ringRadius` 1.500, tabla y victorias de 2.1, sonda `viewport`, overlays DOM con
    `--ui-scale`).
  - `design.md` D9 con la tabla final y los ticks medidos; specs delta con los valores definitivos si apply cambió
    alguno (castillo, tolerancia de troncos, tick de primera subida); ADR-0014/0015/0016 siguen en "propuesta" hasta
    archive.
  - Diario de IA (`docs/ai-log/`): contraste spec ↔ design (anillo estricto, balance monótono, overlays DOM, sonda
    `viewport`) y resultado de la calibración.
- [x] 5.2 Cierre: `npm run verify` y `npm run test:e2e` en verde; `npm run bench` (mapa) a título informativo.
  - Revisión manual para verify (escenarios sin E2E por `e2e-lite`): ventana 3.840 × 2.160 (bandas sin mundo, vista
    2.560 × 1.440, HUD ×2), 2.561 × 1.441, 3.000 × 800, 800 × 450 y 320 × 180; DPR 2 (zoom del navegador 200 %);
    minimizar y restaurar; menú, diálogo, pausa y resultados centrados en 960 × 540, 1.280 × 720 y 1.920 × 1.080;
    resultados con los dos avisos y el mensaje de import a la vez en 960 × 540; `Exportar` tras redimensionar.
