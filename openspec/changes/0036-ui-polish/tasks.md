# Tasks · 0036-ui-polish

<!-- Sin núcleo: no hay grupos de dominio ni de aplicación. Todo es infraestructura, composición o contenido, con
     test-after (ADR-0018): no hace falta ver el rojo. Usa `npm run verify:fast` tras cada tarea y, al cerrar cada
     grupo, `npm run verify` + un commit (`refs: 0036-ui-polish`, trailer `Assisted-by`). Ningún grupo se cierra en
     rojo. Cada tarea cita los escenarios de las specs delta (`specs/<capacidad>/spec.md`) y su test. Las referencias
     §Dn son del design. E2E: solo se amplían tests de humo, sin crear ninguno nuevo, en `?e2e&manual` y sin umbrales
     de tiempo. -->

## 1. Contenido y esquemas (infraestructura + contenido)
- [x] 1.1 Datos de los contadores del HUD (§D4, §D5).
  - Bloque obligatorio `hud` en `content/appearance.json`, en el esquema y en `rawAppearance()` de
    `tests/support/appearance.ts`: `iconSize` 24, `pitch` 30 e `icons.kills` (`frame` 5 + `crop`), más
    `gold`/`wood`/`stone` (`crop`).
  - Errores: `HUD_PITCH_BELOW_ICON`, `HUD_ICON_CROP_NOT_SQUARE` y `HUD_ICON_CROP_OUTSIDE` (cruce con el
    `frameWidth`/`frameHeight` de cada hoja).
  - Fija los recortes con la regla de §D5: cuadrado mínimo sobre la caja de píxeles con alfa > 0, + 2 px por lado.
  - Tests:
    - `tests/infrastructure/content/appearance-hud.test.ts` (nuevo): repositorio válido, s > 16, p > 18, p ≥ s; −1,
      2,5, s 0, p < s, sin p y `glow` nombran su campo; la nota de procedencia no cambia.
    - `tests/infrastructure/content/hud-icon-png.test.ts` (nuevo): con `tests/support/png.ts`, `Dead.png` mide
      896 × 256; el frame 5 está entre 0 y 13 y tiene alfa > 0; cada recorte contiene la caja con alfa y su lado es
      ≤ max(w, h) + 8.
  - Escenarios (`sprite-rendering`): «Datos de los contadores del repositorio», «Datos de los contadores inválidos».
- [x] 1.2 Textos de la obra y texto de la tienda en la guía (§D7).
  - En `content/guide.json`, bloque `build` (`house` y `tower` con los textos de la spec) y párrafo nuevo de la
    página 4.
  - En `GuideSchema`, `build` estricto, ≤ `BUILD_TEXT_MAX` y sin dígitos (`GUIDE_BUILD_DIGITS`).
  - `parseGuide` interpola `build` y devuelve `Guide.build` congelado; los errores usan el campo `guide.build.<tipo>`.
    No hay marcadores nuevos.
  - Tests:
    - `guide-schema.test.ts`, `guide-markers.test.ts` (l.176: los usados incluyen `build`) y `guide-boot.test.ts`.
    - Un caso «sin textos de la obra en `src/`» que busca `oro cada` y `Dispara flechas` en los ficheros de `src/`.
  - Escenarios (`build-sites`): «Textos de la obra por defecto», «Textos de la obra inválidos», «La explicación
    sigue al contenido» (4/2.400 → `+4 oro cada 40 s` y 1/1.350 → `+1 oro cada 22,5 s`), «Sin textos de la obra
    en el código».
  - Escenario (`menu-guide`): «Página de la tienda con la ×».

## 2. Paneles DOM (infraestructura + composición)
- [ ] 2.1 La × de los cuatro modales (§D1).
  - `closeButton()` en `dom/button.ts` y `MENU_LABELS.close`.
  - La × sustituye a `*__leave` en `ShopPanel`/`BuildPanel`, a `Cerrar` en `GuideModal` y a
    `.sound-panel__actions` en `SoundPanel`.
  - Tests:
    - `shop-panel.test.ts`, `build-panel.test.ts`, `guide-modal.test.ts` y `sound-panel.test.ts`.
    - `shop-gate`/`build-gate` (× frente a Esc: mismo snapshot campo a campo).
    - `dom-unchanged.test.ts` y su `.snap` regenerado: solo las diferencias que lista la spec.
  - Escenarios (`sprite-rendering`): «Cuatro modales con una ×», «× con la pieza en reserva», «DOM sin cambios».
  - Escenarios (`castle-shop`): «Overlay con oro justo», «Salir con Esc o con la ×», «La × con el teclado»,
    «Compra con las piezas en reserva».
  - Escenarios (`build-sites`): «Panel con una opción», «Salir con Esc o con la ×», «Panel sin nada asequible».
  - Escenarios (`menu-guide`): «Cerrar con el botón», «Una sola × en cada página», «La × y Esc dejan el mismo
    estado».
  - Escenarios (`audio`): «Abrir desde el menú y cerrar con Esc», «Cerrar con la × desde el menú y desde la
    pausa», «Una sola × y ningún Cerrar visible».
- [ ] 2.2 Hoja de estilos (§D1, §D2, §D4).
  - Regla `.ui-close` (top/right 16k, 48k, padding de margen × k, `unsafe center`, 44 × 44 en móvil) y reservas de
    cabecera de 56k (h2 de la tienda y la obra; `padding` de las cabeceras de la guía y Sonido).
  - Reglas de fila acotadas a `.shop-panel__product` y `.build-panel__option`, y `text-align: center` en la regla
    común.
  - `.resource-icon` a 3em; `.build-panel__icon` y `__about`.
  - Tests: `styles-ui.test.ts` (fuera `.shop-panel__leave`, ningún `space-between`/`flex-start`/`left` en botones de
    una sola etiqueta, padding = margen × k, la × con las piezas de botón).
  - Escenarios (`sprite-rendering`): «Reglas de centrado», «Los siete paneles con la pieza de panel».
  - Escenarios (`menu-guide`): «Iconos de la guía mayores», «Controles de la guía con piezas de botón», «Guía
    dentro del marco a ×1 y a ×2».
  - Escenarios (`build-sites`): «Iconos de recurso mayores», «Panel entero dentro del marco».
  - Escenarios (`castle-shop`): «Tienda con desplazamiento interno a ×1 en 1.280 × 720» (reglas), «Tienda entera
    a ×2».
- [ ] 2.3 Filas de la obra con edificio y explicación (§D6).
  - `buildingIcons()` en `resourceIcons.ts`.
  - 4.º parámetro `BuildAbout` de `BuildPanel`: imagen con `width`/`height` del frame, `alt=""` y `hidden` con
    `error`; explicación en `.build-panel__about`.
  - Cableado en `main.ts` con `booted.guide.build`.
  - Tests:
    - `build-panel.test.ts` y `resource-icons.test.ts`.
    - `build-tower-regression.test.ts` (composición: el panel real lleva imagen y texto).
  - Escenarios (`build-sites`): «Filas con icono y explicación», «Proporción del icono del edificio» (proporción
    por atributos y alto 3,5em ≥ 3em en CSS), «Explicación en una fila no asequible», «Clic en el icono de la casa»,
    «Imagen de edificio que no carga», «Nombre y coste separados», «Panel con dos opciones», «Panel con las dos
    opciones asequibles», «Panel con la torre no asequible», «Torre no asequible con piezas», «Panel sin atributo
    style», «Construir con las piezas en reserva».

## 3. HUD (infraestructura + composición)
- [ ] 3.1 Layout del HUD con métricas de datos (§D4).
  - `HUD_BASE` nuevo (`healthY` 32, `xpY` 50, `iconGap` 6) y `hudLayout(frame, metrics)` con 4 filas
    `healthY + i·p`.
  - `kills` como `CounterAnchor`, `HUD_RESERVE_TEXTS.kills = '12345'`, `killsLabel` = `String(n)`.
  - `HudMetrics` en `mobileFrame.ts` (cableado en `wireMobile`).
  - Tests:
    - `ui-layout.test.ts`, `hud-panels.test.ts` y `hud-format.test.ts`.
    - `mobile-frame.test.ts`, que debe conservar k_max = 1385/768 y 1,4066.
    - `dom-results-lines.test.ts`, sin cambios.
  - Escenarios (`hud`): «Filas más separadas y sin solapes», «HUD entero y sin solapes» (5 ventanas), «Mismo
    anclaje con dos ventanas», «Esquina opuesta que sigue a la ventana», «Ventana menor que 960 × 540», «Tres
    paneles con su contenido», «Paneles independientes del snapshot», «Iconos del HUD en modo móvil», «Sin bajas»,
    «Muchas bajas», «Resultados sin cambios».
- [ ] 3.2 Contadores con icono recortado y calavera (§D5).
  - `cropPose()` puro en `phaser/ui/hudIconPose.ts`.
  - `counterIcon` con recorte; icono de bajas desde `looks.corpse` + `hud.icons.kills`, con reserva si la hoja no
    cargó o `frame ≥ FrameCount`.
  - `createHud`/`placement` con 4 contadores (`setCrop` al crear y `setPosition` + `setScale` en RESIZE).
  - Cableado en `GameScene`.
  - Tests:
    - `hud-icon-pose.test.ts` (nuevo).
    - `hud.test.ts` (dobles de Phaser: s·k a ×1 y a ×2, mismo x, orden, textura `Dead.png` y frame 5 sin animación,
      reserva `#b0b4ba`, 600 frames sin objetos nuevos).
    - Test de composición: dos partidas con la semilla 42 y `hud` distinto dan snapshots iguales y 820/904 objetos
      del mapa.
  - Escenarios (`hud`): «Iconos mayores a ×1 y a ×2», «Bajas que cambian entre snapshots», «Calavera de la hoja del
    cadáver», «Calavera que no carga», «Contadores reubicados al redimensionar», «Seiscientos frames sin crear
    objetos», «Fuente pixel en los textos del HUD».
  - Escenario (`sprite-rendering`): «Los datos del HUD no cambian la simulación ni el mapa».

## 4. Barras de vida (infraestructura)
- [ ] 4.1 Memoria de «estructura dañada» en `HealthBarLayer` (§D3).
  - `damaged: Set<number>` por id, que se borra en `forget()` (`clear` y `setCellSize`).
  - `drawn` = dañadas y no en ruina.
  - Tests:
    - `health-bar-layer.test.ts` (doble de `Graphics`).
    - `render-layers-feedback.test.ts` (l.146, 158, 176: «intactas» → «dañadas y no en ruina»; semilla 42 con 7 → 0
      en el primer frame; R y menú → Jugar a 0).
  - Escenarios (`sprite-rendering`): «Barra al 50 %», «Sin barras al empezar», «La barra aparece con el primer
    daño», «La barra se conserva hasta la ruina», «Dañada aunque vuelva a la vida máxima», «Golpe que deja la
    estructura en ruina», «Torre dañada y sin barras en otros objetivos», «Partida nueva sin barras», «Barras con
    reserva y fuera del plan del mapa», «Recuentos coherentes con el snapshot», «R y menú con números de daño y
    barras».

## 5. E2E ampliados y documentación
- [ ] 5.1 Se amplían los E2E de humo, sin crear ninguno nuevo. Primero, el helper `faceCenterOffset` en
  `tests/e2e/probe.ts` (§D2).
  - `smoke.spec`, recorrido de la guía y Sonido:
    - 5 iconos de la página 3 > 32 px y sin solapes.
    - × de la guía en su esquina, sin pisar el título ni el indicador, a 960 × 540 y a 1.920 × 1.080.
    - Centrado de los 6 botones del menú, de `Siguiente` y de la × de la guía.
    - × de Sonido por rol `Cerrar`.
  - `gameplay.spec`, Tienda:
    - Clic en la × frente a Esc: misma salida, pausa no vista, `step(1)` = 1 y el foco fuera del panel.
    - Centrado de la ×.
    - A 960 × 540, la × no se solapa con el título, el oro ni la lista.
  - `gameplay.spec`, obra (l.860–876):
    - Iconos de recurso > 28 px.
    - Imagen de edificio con `naturalWidth` > 0 y la explicación visible.
    - 1 botón `Salir` con el texto `×`, en la misma esquina que en la tienda, centrado.
  - Un test del mapa real: `sprites.healthBars` 0 y 7 estructuras en el primer frame.
  - Escenarios:
    - `sprite-rendering`: «× en la esquina en el navegador», «Centrado medido en el navegador», «Barras a 0 al
      empezar en el navegador».
    - `menu-guide`: «Iconos mayores en el navegador», «Recorrido de la guía en el smoke».
    - `castle-shop`: «La × no pisa el título en la ventana mínima».
    - `build-sites`: «Construir una casa en el juego real».
  - Sin test automático propio, aceptados por la regla `e2e-lite`, salvo que los cubran los dobles de 2.2:
    «× en móvil» (lo cubre la regla CSS de 2.2), «Panel centrado» de audio y los escenarios de `main-menu`, cuyas
    reglas ya existen con la × añadida a la lista.
  - Ejecuta `npm run test:e2e` completo.
- [ ] 5.2 Documentación.
  - `AGENTS.md` §1: un párrafo de 0036 con:
    - la × y su nombre accesible;
    - el centrado;
    - las barras desde el primer daño (`healthBars` = dañadas);
    - `hud` en `appearance.json` (s 24, p 30, recortes, calavera `Dead.png` frame 5);
    - `guide.json` `build`;
    - el icono y la explicación de la obra;
    - balance, firmas y 820/904 intactos.
  - Entrada del diario en `docs/ai-log/` con los ajustes del design tras contrastar con las specs y los incidentes
    de hooks, si los hay.
