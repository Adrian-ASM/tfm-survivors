# Proposal · 0017-fullscreen-view

- **Estado**: aprobada (2026-11-23)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0017-fullscreen-view`

## Problema
El juego se ve en un lienzo fijo de 960 × 540 aunque la ventana del navegador sea mucho mayor: en un monitor de
escritorio queda una franja pequeña y se ve poco mapa alrededor del jugador (historia 0017 del GDD: "quiero que el
juego ocupe todo el monitor para ver más mapa a mi alrededor").

Además, la distancia de aparición de los enemigos depende hoy del tamaño de la vista (`ringRadius` = media diagonal
de la vista + `margin` = 582,7). Si la vista pasara a ser la ventana sin más, la misma semilla daría partidas
distintas en monitores distintos: se perdería el determinismo por semilla y el balance calibrado (ADR-0002). Y un
mundo de 1.920 × 1.080 es menor que muchos monitores, así que una vista a ventana completa enseñaría el mundo entero
o zonas fuera de él.

## Objetivo
Con el change hecho, el jugador observa que:
- El juego ocupa toda la ventana del navegador, a zoom 1 (pixel art nítido, sin barras ni reescalado borroso). En
  ventanas grandes se ve más mapa, hasta un **tope de área visible de 2.560 × 1.440**; por encima de ese tamaño de
  ventana el área de mundo visible no crece (cómo se resuelve el espacio sobrante es del design).
- Redimensionar la ventana en mitad de partida (y en el menú, la pausa, la oferta y los resultados) funciona: la
  vista, el HUD y los overlays se adaptan sin reiniciar ni alterar la partida. F11 del navegador basta para
  pantalla completa.
- El mundo es de **3.840 × 2.160** (rejilla de **64 × 36** celdas de 60 px), mayor que el tope de vista, con el
  castillo centrado en el mundo y la salida ante su puerta (≈ (1.950, 1.170); la cifra exacta la fija la spec).
- La misma semilla produce la **misma partida, tick a tick, en cualquier tamaño de ventana**: el radio del anillo de
  aparición es un valor de contenido fijo (≈ 1.500 = media diagonal del tope, 1.468,7, + 32) y no depende de la
  pantalla.
- El HUD y los overlays (oferta de mejoras, pausa, resultados, menú) quedan anclados a bordes, esquinas o centro de
  la ventana, se reubican al redimensionar y el HUD **adapta su tamaño** a la ventana (crece en pantallas grandes
  para no quedar minúsculo, por escalones para mantener la nitidez).
- El balance sigue dentro de la banda: **25–35 victorias de 50** con el bot de referencia y **0 quietos** (quieto
  pierde antes de 180 s), con los plazos de primera subida y pulso quieto ≤ 4.800 ticks.

## Alcance
- **Dentro**:
  - Vista a ventana completa, zoom 1, con tope de área visible de 2.560 × 1.440 y respuesta al redimensionado
    durante cualquier pantalla del juego.
  - Desacoplar la aparición de enemigos de la vista: radio del anillo como parámetro de contenido validado con zod
    (≈ 1.500). La vista deja de entrar en el núcleo de simulación.
  - Mundo de 3.840 × 2.160 y rejilla de 64 × 36; castillo centrado en el mundo, salida y zona de inicio en
    consecuencia. Firma dorada del mapa (`tests/support/mapGolden.ts`) regenerada.
  - Tope de objetos de arte del mapa elevado de 300 a un valor en torno a 900–1.000 (medido: 667 y 750 en las
    semillas 42 y 123).
  - HUD y overlays anclados, reubicados al redimensionar, con tamaño del HUD escalado por escalones según la
    ventana; zonas de clic que siguen a lo pintado.
  - Recalibración del balance por oleadas (no por `player.speed`); actualización de constantes y escenarios que hoy
    usan 1.920 × 1.080, 960 × 540, 582,7 o (990, 630).
  - Sonda E2E de cámara con el área visible real; tamaño de ventana fijo en Playwright para que las sondas sean
    reproducibles.
- **Fuera**:
  - Fullscreen API, botón o tecla propia de pantalla completa.
  - Zoom de cámara no entero o visión acotada por zoom (opción B de la exploración) y resolución virtual fija con
    reescalado (opción C).
  - Navegación de enemigos por campo de flujo (change 0018); los enemigos siguen atravesando obstáculos.
  - Minimapa.
  - Arte nuevo (hojas, elementos o animaciones que no existan ya).
  - Mundo proporcional a la ventana: el mundo es fijo por contenido.

## Capacidades afectadas
- `openspec/specs/world-camera` (modificada): la vista pasa a ser la ventana con tope; el contenido ya no fija una
  vista de 960 × 540; mundo por defecto 3.840 × 2.160; escenarios de cámara, sonda y HUD fijo reescritos; nuevo
  comportamiento ante el redimensionado.
- `openspec/specs/enemy-spawning` (modificada): "Posición de aparición fuera de la vista" deja de depender de la
  vista; radio del anillo de contenido; escenarios con el mundo nuevo; nuevo escenario de igualdad entre tamaños de
  ventana.
- `openspec/specs/procedural-map` (modificada): rejilla de 64 × 36, castillo centrado, salida y zona de inicio,
  conectividad, firma dorada; posible cambio de `rivers` (ver decisiones abiertas).
- `openspec/specs/sprite-rendering` (modificada): tope de objetos del mapa en las semillas 42 y 123; pintado del
  suelo y del mapa para el mundo mayor.
- `openspec/specs/hud` (modificada): anclaje a la ventana, reubicación al redimensionar y escala por escalones.
- `openspec/specs/upgrades` (modificada): overlay de elección centrado en la ventana y reubicado al redimensionar,
  con zonas de clic coherentes.
- `openspec/specs/main-menu` (modificada): menú y overlay de pausa centrados en la ventana y reubicados.
- `openspec/specs/run-results` (modificada): overlay de resultados centrado y reubicado.
- `openspec/specs/player-movement` (modificada): salida por defecto, recorte al mundo y plazo de primera subida con
  el mundo nuevo.
- `openspec/specs/run-outcome` (modificada): balance recalibrado con el mundo y el anillo nuevos; fuente única del
  tamaño del mundo en tests.
- `openspec/specs/auto-weapons` (modificada, añadida en apply el 2026-11-23 por decisión del usuario): en
  "Armas observables en el juego", la ventana de la primera baja del jugador quieto pasa de 600 a 900 ticks por el
  anillo de 1.500 y la tabla de oleadas nueva.

ADRs previstos (los redacta el architect): modelo de escalado y tope de vista; aparición desacoplada de la vista
(revisa la parte de ADR-0002 que hoy liga el anillo a la vista); tamaño de mundo y rejilla (extiende ADR-0013).

## Datos de partida (mediciones previas con arnés temporal, ya retirado)
- **Balance** (semillas 1..50, bot de referencia):
  - Mundo 3.840 × 2.160 con el anillo actual (582,7): **16/50**, fuera de banda.
  - Mundo 3.840 × 2.160 con anillo 1.500 sin más ajustes: **7/50 y 3 quietos sobreviven** (rompe el invariante).
  - Anillo ≈ 1.500, `player.speed` 215 sin cambios, oleadas tempranas (tramos de 0 y 60 s) × 1,2 y tardías
    (180, 300 y 480 s) × 0,8: **27/50 y 0 quietos**; configuraciones vecinas entre 25 y 33 (robusta). Plazos del
    quieto: 1.527 ticks (oferta) y 1.939 (golpe), dentro de 4.800.
  - Calibrar por oleadas: la respuesta a `player.speed` no es monótona.
- **Mapa 64 × 36**: 667 y 750 objetos de arte en las semillas 42 y 123; generación ≤ 2,3 ms; 0/200 fallos de
  conectividad; zona de inicio libre. Rejilla de 128 × 72 descartada (> 2.400 objetos, ≈ 24 ms).
- Con `rivers` 1, el mapa de 64 × 36 tiene proporcionalmente la mitad de agua que hoy.

## Riesgos y dudas
- **Spawns visibles cerca de los bordes**: el anillo se recorta al mundo; con un anillo de 1.500 en un mundo de
  3.840 × 2.160 el recorte actúa más a menudo y el enemigo puede nacer dentro del área visible. Ya se acepta hoy
  (solo se garantizan mundo y `minDistance`); será más frecuente. Decisión de producto: se mantiene aceptado.
- **Ritmo**: los enemigos nacen a ≈ 1.500 en lugar de ≈ 583 y tardan más en llegar; la recalibración de oleadas lo
  compensa en el bot, pero la sensación de juego puede cambiar.
- **Rendimiento en CI sin GPU**: lienzo mayor y ≈ 2,5 veces más objetos de mapa. El gate E2E corre en modo manual y
  sin umbrales de fps, pero puede volverse más lento; el tamaño de ventana de Playwright se fija para acotarlo.
- **Equidad entre monitores**: hasta el tope, una ventana mayor ve más mapa (ventaja informativa); se acepta por
  decisión del usuario, el tope la limita.
- **Redimensionado**: eventos frecuentes al arrastrar la ventana y al volver al menú; riesgo de widgets duplicados o
  zonas de clic desfasadas.
- **Nitidez**: con densidad de píxeles > 1 o tamaños impares pueden aparecer costuras entre baldosas.
- **Coste de migración de tests**: firma dorada regenerada y muchas constantes y escenarios con 1.920 × 1.080,
  960 × 540, 582,7 y (990, 630).

## Decisiones del gate humano (2026-11-23)
Aprobadas las opciones propuestas: `rivers` 1; tope de objetos del mapa 1.000; ventana de Playwright 1.280 × 720;
HUD escalado por escalones enteros (× 1, × 2…), sin escalado continuo; sin mínimo de ventana (una ventana menor que
960 × 540 ve menos mapa, con el HUD a su escala mínima).

## Decisiones abiertas para el gate humano (texto original)
1. **`rivers`**: mantener 1 (mitad de agua proporcional, medido) o pasar a 2 (sin medir; exigiría repetir balance,
   conectividad y conteo de objetos). Propuesta por defecto: mantener 1.
2. **Tope de objetos del mapa**: valor concreto en 900–1.000 (propuesta: 1.000).
3. **Tamaño de ventana de las sondas E2E**: propuesta 1.280 × 720 fijado en Playwright (por debajo del tope).
4. **Escalones de escala del HUD**: umbrales y factores los propone el design; se pide confirmar que bastan
   escalones enteros (p. ej. × 1 y × 2) frente a escalado continuo.
5. **Ventana menor que 960 × 540**: propuesta, se sigue ocupando la ventana y se ve menos mapa (sin mínimo), con el
   HUD a su escala mínima.

## Criterio de éxito
- En una ventana de W × H, el área de mundo visible es min(W, 2.560) × min(H, 1.440) (salvo el espacio sobrante del
  tope, que define el design), a zoom 1, recortada al mundo de 3.840 × 2.160.
- Dos partidas con la misma semilla e inputs, simuladas con tamaños de ventana distintos (p. ej. 960 × 540 y
  2.560 × 1.440), tienen snapshots iguales tick a tick durante 3.600 ticks.
- Tras redimensionar en mitad de partida, la siguiente sonda informa del área visible nueva y el HUD y los overlays
  están en su anclaje nuevo con zonas de clic coherentes; la partida no cambia.
- Balance: entre 25 y 35 victorias de 50 (semillas 1..50) y 0 quietos sobreviven 180 s; plazos de primera subida
  y pulso quieto ≤ 4.800 ticks.
- Mapa: ≤ tope de objetos en las semillas 42 y 123; 100 % de conectividad en las semillas de test; zona de inicio
  libre; firma dorada regenerada y estable.
- `npm run verify` y `npm run test:e2e` en verde; como máximo 1–2 E2E nuevos o ampliados (regla `e2e-lite`).
