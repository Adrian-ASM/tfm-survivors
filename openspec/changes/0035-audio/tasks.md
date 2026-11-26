# Tasks · 0035-audio

<!-- Orden: lógica pura → contenido/ajustes/guardarraíl → DOM → motor y composición → E2E y cierre → assets.
     Todo es infraestructura, composición o contenido (ADR-0018: test-after). La excepción es el grupo 1, que es
     lógica pura sin motor ni DOM y se hace con TDD (rojo comprobado). Cada grupo es una unidad de commit con
     `npm run verify` completo; `verify:fast` por tarea. Sin cambios en src/domain ni src/application.
     Todo se implementa con `file: null` en content/audio.json salvo el grupo 6, que está BLOQUEADO hasta que el
     autor entregue los ficheros CC0 (fichero, URL, autor y fecha). Design: openspec/changes/0035-audio/design.md. -->

## 1. Lógica pura de audio (TDD)
- [x] 1.1 `AudioCues` (`src/infrastructure/audio/audioCues.ts`): peticiones por tipo y origen del impacto (design
  D2/D3) — escenarios de `audio`: "Un golpe suena una vez en toda su ventana", "Golpe al jugador", "Bajas y mechas",
  "Recogidas y despeje", "Relleno al tope no es recogida", "Varias subidas en un step", "Explosión visible varios
  ticks", "Compra en la tienda", "Partida nueva como referencia", "Snapshot sin cambios", "Impacto de explosión",
  "Explosión de otro tick", "Impacto de torre", "Flecha de torre lejos del golpe", "Explosión gana a torre" y "El
  jugador en una explosión". Test: `tests/infrastructure/audio/audio-cues.test.ts`, con snapshots `{ ...run.snapshot(),
  ... }` armados a mano.
- [x] 1.2 `EffectMixer` (`audio/EffectMixer.ts`): 1 por tipo y snapshot, intervalo con el reloj de render, tope sobre
  los efectos que suenan, prioridad y descarte con el mundo detenido, la pestaña oculta, el volumen 0 o `!canPlay`
  (D4) — escenarios: "Avalancha de impactos", "Intervalo mínimo con el reloj de render en modo manual", "Tope con voces
  ocupadas", "Tope lleno", "Efectos a 0" y "Fichero que no carga" (parte del mezclador). Test:
  `tests/infrastructure/audio/effect-mixer.test.ts`.
- [x] 1.3 `musicState` + `AudioDirector` con un `SoundOut` falso (posición simulada con el reloj de render) (D6) —
  escenarios: "Menú mudo", "Jugar arranca la música", "Oferta, tienda y obra no paran la música", "Fin de partida y
  reinicio", "Volver al menú", "Bucle", "Pausa con Esc", "Retención por orientación", "Pestaña oculta sobre la pausa",
  "Pestaña oculta en curso", "Pestaña oculta en el menú", "Volúmenes efectivos", "Silencio y vuelta" (volúmenes y
  posición) y "Cambio al instante". Test: `tests/infrastructure/audio/audio-director.test.ts`.
- [x] 1.4 Integración sin navegador con partidas reales (test-after: lo cubren 1.1–1.3) — escenarios: "Cuentas
  cuadran" (semilla 42, `referenceBot`, 3.600 ticks en bloques de 60), "Contadores coherentes con el snapshot"
  (`enemyDeath` = bajas, salida muda) y "Misma partida con y sin audio" (M en los ticks 100 y 900). Test:
  `tests/infrastructure/audio/audio-run.test.ts`.

## 2. Contenido, ajustes y procedencia (test-after)
- [x] 2.1 `content/audio.json` (10 tipos, `file: null` transitorio, defaults 50/80/no), `audioSchema.ts` +
  `loadAudio.ts` (`parseAudio`, `soundPaths`) y cruce `AUDIO_NOT_REGISTERED` en `bootContent` (D5) — escenarios:
  "Tipo de efecto ausente o desconocido", "Valores fuera de rango", "Fichero sin procedencia" y "Campo desconocido".
  Test: `tests/infrastructure/content/audio-content.test.ts` (+ `contentBoot` sin errores con el repositorio).
- [x] 2.2 `audioSettingsSchema`, `LocalStorageAudioSettingsRepository` y `AudioSettingsStore` (D9) — escenarios:
  "Sin ajustes guardados" (valores y 0 escrituras), "Ajustes dañados" (4 casos, 1 aviso `audio`, valor intacto y
  sobrescritura al cambiar), "Almacenamiento que lanza", "Silencio y vuelta" (ajustes guardados 50/80) e
  "Independiente del progreso" (Exportar, Importar y Borrar datos no tocan la clave; el export sin `music`/`muted`).
  Test: `tests/infrastructure/audio/audio-settings.test.ts`, con un `Storage` falso.
- [x] 2.3 Guardarraíl: lista `sounds[]` en `guard-assets.mjs` (D13) y `audioFileProblems` (D14), con `sounds: []` en
  la nota — escenarios de `asset-provenance`: "Audio sin registrar", "Registro de audio incompleto o incorrecto" (9
  casos), "Registro de audio sin fichero", "Audio en otra lista", "Audio fuera de su carpeta", "Audio sin red",
  "Entrada repetida" (lista de audio), "Ficheros prohibidos" (zip de audio), "Mayúsculas en la extensión" (`Hit.WAV`)
  y "Audio sin versión del pack"; de `audio`: "Fichero de audio de más" y "Tope de peso" (lista simulada con
  2.097.153 bytes). Tests: `tests/guardrails/assets.test.ts` y `tests/guardrails/audio-files.test.ts` (nuevo).

## 3. Panel Sonido, tecla M y barra táctil (test-after, DOM falso)
- [x] 3.1 `SoundPanel` + estado `sound` de `MenuController` + 3.er botón `Sonido` de `MenuPanel` (D10, menú) —
  escenarios: "Abrir desde el menú y cerrar con Esc", "Botones de debajo bloqueados" (menú), "Límites del
  deslizador", "Una escritura por cambio"; de `main-menu`: "Carga sin parámetros" (6 botones en orden) y "Opciones
  bloqueadas con el diálogo abierto"; de `menu-guide`: "Pulsaciones del menú con la guía abierta", "Cómo jugar con el
  panel Sonido abierto" y "Esc mantenido". Tests: `tests/infrastructure/dom/sound-panel.test.ts`,
  `menu-controller` y `menu-panel` (ampliados).
- [x] 3.2 Botón `Sonido` de `PausePanel` + puerta del panel en `GameScene` (Esc/⏸ cierran, acción, R y elección
  descartadas, captura global apagada mientras está abierto; extraer `soundPanelGate` puro con el patrón de
  `PauseGate`) — escenarios: "Abrir desde la pausa", "Botones de debajo bloqueados" (pausa); de `main-menu`: "Esc con
  el panel Sonido abierto", "Volver al menú bloqueado con el panel Sonido" y "Pausar y reanudar con Esc" (orden
  `Reanudar`, `Sonido`, `Volver al menú`); de `touch-controls`: "⏸ con el panel Sonido abierto". Tests:
  `tests/infrastructure/sound-panel-gate.test.ts` y `pause-panel` (ampliado).
- [x] 3.3 `MuteKey` + `MuteRequests` (una vez por frame) + botón de silencio de `TouchBar` con iconos, etiqueta y
  `aria-pressed` (D11) — escenarios: "M en partida" (1 cambio con repeticiones y 1 escritura), "M en el menú con la
  guía abierta", "M con el panel abierto", "M con modificador"; de `main-menu`: "M en el menú"; de
  `touch-controls`: "Silenciar con la barra", "Silencio y M en el mismo frame", "Barra en el menú", "M con el joystick
  activo" y "M con el aviso visible"; de `simulation-loop`: "Silencio sin step" (parte sin navegador). Tests:
  `tests/infrastructure/dom/mute-key.test.ts` y `touch-bar` (ampliado).
- [x] 3.4 Estilos `.sound-panel` en `styles.css` (piezas del kit, centrado en la ventana, escala 1, desplazable con
  `is-mobile`, controles ≥ 44 px) — escenarios: "Panel centrado"; de `main-menu`: "Panel Sonido abierto al
  redimensionar"; de `world-camera`: "Redimensionado con el panel Sonido abierto"; de `mobile-display`: "Paneles en un
  móvil horizontal" (panel `Sonido`) y "Deslizador táctil del panel Sonido". Test: guardarraíl de CSS sin navegador
  (el selector está en las reglas de paneles centrados y de controles ≥ 44 px móviles, sin `style` en el DOM). El
  centrado y el arrastre se comprueban a mano en verify (regla `e2e-lite`: sin E2E nuevo).

## 4. Motor y composición (test-after, dobles del motor)
- [x] 4.1 `PhaserSoundOut` (pools perezosos, bucle, volúmenes, `canPlay` con `locked`/caché, `stopEffects`), salidas
  muda y no disponible, `audioMode(e2e, hasWebAudio)` → `noAudio`, `AudioLoadScene` lanzada en paralelo desde
  `BootScene` y `audioUrl` (D1, D7, D8) — escenarios: "Fichero que no carga", "Navegador sin Web Audio",
  "Desbloqueo rechazado", "Menú sin esperar al audio" y "Bucle" (`loop: true`). Tests:
  `tests/infrastructure/audio/phaser-sound-out.test.ts` (`sound` falso) y `tests/infrastructure/boot-audio.test.ts`.
- [x] 4.2 `audioWiring` + `main.ts` (cuarto argumento `renderMs` de `onRender`, `started` → `newRun`, `onScreen`,
  `hold`, `HIDDEN`/`VISIBLE`, `PRE_STEP` → `MuteRequests`, `pauseOnBlur = false`) y sonda `__sprint.audio` (D12) —
  escenarios: "Sonda en el menú"; de `main-menu`: "Sin sonda fuera de E2E" (también sin `audio`), "Menú tras Volver
  al menú en modo E2E" (panel cerrado) y "Carga en modo E2E" (sin cambios). Test:
  `tests/composition/audio-wiring.test.ts` (dependencias falsas: juego, ventana y almacenamiento).

## 5. E2E, regresión y documentación
- [x] 5.1 E2E: ampliar el test de humo de partida de `gameplay.spec` (`?e2e&manual&seed=42`) — escenario: "Audio en
  la partida E2E [E2E]" (`playing` → `paused` → `playing`, M con volúmenes a 0, invariante de contadores, 0 peticiones
  `.ogg/.mp3/.wav`, 0 errores y 0 CSP). Cubre también "Silencio sin step" en el navegador.
- [x] 5.2 E2E: ampliar el test de humo del menú sin `?e2e` — escenario: "Panel Sonido sin sonda [E2E]", sin
  `waitForTimeout` (esperar a que el menú se oculte; `logicGuard`), más las cuentas de 5 a 6 botones de "Menú con
  piezas en el navegador [E2E]" y "Recorrido de la guía en el smoke [E2E]". No es un test nuevo.
- [x] 5.3 Regresión y cierre — escenario: "Balance y firmas". `BALANCE_BASELINE` y las 6 firmas doradas pasan sin
  regenerarlas, y `git diff --stat main -- src/domain src/application` sale vacío. Actualizar AGENTS.md §1 (estado
  0035) y la entrada del diario de IA.

## 6. Assets CC0 del autor (ficheros entregados; spec rev. e45b9dd, design rev. 3)
<!-- Un commit y `verify` completo por tarea. 6.0 va antes que 6.1: los ficheros reales usan los 12 tipos y FLAC. -->
- [ ] 6.0 Retoque por los cambios tras el gate (design D2, D5, D13, D14). TDD en `AudioCues` y `EffectMixer`;
  test-after en el resto.
  - `effectTypes.ts`: `pickup` se sustituye por `pickupGold`, `pickupStone` y `pickupWood`, en el orden de la spec
    (12 tipos), con la constante `PICKUP_EFFECT` (clase → tipo).
  - `AudioCues`: el anterior guarda `Map<id, PickupKind>` y cuenta por tipo de recogida.
  - `content/audio.json`: 12 entradas (`file: null` hasta 6.1). Revisar sonda y `byType`.
  - `audio-files.test.ts`: `AUDIO_MAX_BYTES` = 6.291.456 y `.flac`.
  - `guard-assets.mjs`: `AUDIO` con `.flac`. `audioSchema`: `AUDIO_FILE` con `flac`.
  - Filtro de peticiones de red del E2E de 5.1 con `.flac`.

  Escenarios de `audio`: "Recogidas y despeje" (rev.), "Una recogida por tipo de recurso", "Relleno al tope no es
  recogida" (rev.), "Recogidas a igual prioridad con una voz libre", "Tope con voces ocupadas" (rev.), "Fichero que no
  carga" (rev., `pickupStone`), "Valores fuera de rango" (`pickupWood`), "Tipo de efecto ausente o desconocido" (12
  tipos) y "Tope de peso" (simulado: 6.291.457 falla y exactamente 6.291.456 pasa). De `asset-provenance`: "Audio sin
  registrar" y "Mayúsculas en la extensión" con un `.flac`/`.FLAC`.

  Tests: `audio-cues`, `effect-mixer`, `audio-content`, `audio-files`, `assets` y `gameplay.spec` (filtro).
- [ ] 6.1 Ficheros reales (design D16).
  - Copiar los 11 ficheros de `C:\Users\Adri\TFM\` a `public/assets/audio/` con los nombres kebab-case de D16, sin
    recodificar.
  - Añadir 11 entradas `sounds[]` con título, autor, URL `https` de `kenney.nl`, `opengameart.org` o `freesound.org`,
    `CC0`, fecha de descarga, sha256 y bytes medidos. Los datos de procedencia los da el autor; si falta alguno,
    preguntar y no inventarlo.
  - Rellenar los `file` de `audio.json`: compartidos `arrow-impact.mp3` (`impactWeapon` e `impactTower`) y
    `explosion.wav` (`explosion` e `impactBlast`).
  - **Endurecer el esquema** (`file` obligatorio; test «null inválido»).

  Escenarios: de `audio`: "Contenido por defecto válido" (12 entradas y 11 ficheros distintos), "Fichero compartido"
  (se pide 1 vez, ganancia propia), "Fichero compartido que no carga", "Todos usados" y "Tope de peso" (real:
  5.093.480 ≤ 6.291.456). De `asset-provenance`: "Audio del repositorio registrado", "Nota del repositorio" (lista de
  audio ≥ 1), "Estado real del repositorio" y "Audio registrado solo como audio".

  Tests: `audio-content`, `audio-plan` (`audioFilesToLoad`), `phaser-sound-out` (compartido que falla), `assets` y
  `audio-files` sobre el repositorio, y `npm run guard:all`. Comprobar de nuevo que `BALANCE_BASELINE` y las firmas
  quedan idénticas y que `src/domain` y `src/application` no cambian.
- [ ] 6.2 Comprobación a mano en `npm run build` + `vite preview` sin `?e2e` (Chromium y, si se puede, Firefox):
  - la música (`song.mp3`) suena al pulsar Jugar y en bucle;
  - cada efecto suena en su suceso, con FLAC para `playerHurt`, WAV de 24 bits para `enemyDeath` y WAV con chunks
    extra para `explosion`;
  - el panel `Sonido` y M actúan;
  - la consola sale sin violaciones de CSP ni errores (requisito "Audio observable en el navegador", criterio de éxito
    del proposal).

  Se anota en el verify-report con navegador y versión. Actualizar AGENTS.md §1 (ficheros, 12 tipos y tope de 6 MB).
