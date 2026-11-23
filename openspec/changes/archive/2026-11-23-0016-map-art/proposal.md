# Proposal · 0016-map-art

- **Estado**: aprobada por el usuario (2026-11-23), con las resoluciones de "Decisiones del gate"
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0016-map-art`
- **Fuente**: `openspec/changes/0016-map-art/exploration.md` (mandan "Decisiones del usuario" y "Mediciones previas",
  2026-11-23) y la historia 0016 de `docs/gdd.md`.

## Problema
El mapa procedural de 0015 se pinta con rectángulos de color de reserva (troncos, agua y puentes). Funciona, pero
no se lee de un vistazo: no hay orillas, el tronco y la copa no se distinguen, no se ve qué es un puente y la zona de
inicio es un hueco de hierba sin castillo. El GDD (historia 0016) pide el arte del pack y el castillo sólido en el
punto de inicio; el backlog lo tiene como Must.

## Objetivo
Al jugar con el mapa real, cada partida muestra con arte de Tiny Swords Update 010 (CC0):
- agua con espuma animada y orillas resueltas por autotile de 4 vecinos;
- árboles cuya base (tronco) bloquea al jugador como hoy y cuya copa se pinta por encima de jugador, enemigos y
  proyectiles; el modelo de árbol de cada celda se elige por semilla, siempre el mismo para la misma semilla;
- puentes del pack orientados según el río;
- un castillo Blue **sólido** en la zona de inicio: el jugador no lo atraviesa y empieza ante su puerta.

Si una hoja no carga, el elemento afectado vuelve a los colores de 0015 sin errores. El balance con el contenido por
defecto sigue en banda tras el castillo y el ajuste de `player.speed` a 215.

## Alcance
- **Dentro**:
  - **Render del mapa (opción C de las mediciones)**: agua como `TileSprite` por tramo de celdas de agua; orillas,
    espuma animada (8 frames), árboles (tronco + copa), puentes y castillo como sprites. Escala de baldosa 0,9375
    (64 px del pack → celda de 60 px), también en el suelo de hierba.
  - **Autotile de orillas de 4 vecinos** (16 casos) como función pura del adaptador sobre el snapshot del mapa;
    `Tilemap_Flat` no trae esquinas cóncavas, se acepta la muesca en los meandros diagonales.
  - **Capas**: copa por encima de jugador, enemigos, cadáveres, proyectiles, pulsos y gemas, y por debajo del HUD y
    los overlays.
  - **Variedad de árboles por semilla**, decidida en el adaptador con un flujo derivado de la semilla: no consume el
    azar de la partida ni el del mapa y no cambia la simulación.
  - **Castillo sólido (dominio)**: tipo de celda nuevo, no caminable, con huella de 5 × 4 celdas (columnas 14–18,
    filas 6–9 con la rejilla por defecto; valor del prototipo, definitivo en apply); código propio en la rejilla y en
    la firma dorada; generador que veta el río en la unión de zona de inicio y huella; punto de salida desplazado
    ante la puerta ((990, 630) en el prototipo) y zona de inicio centrada en él. Lo que hoy depende de "no caminable"
    (colisión del jugador, recolocación de gemas, conectividad, bot de referencia) trata el castillo igual que un
    tronco o el agua, sin lógica nueva en el bot.
  - **Balance**: `player.speed` 210 → 215 en `content/`; re-medida con el bot de referencia en las semillas 1..50
    (banda 25..35 victorias) e invariante "quieto pierde antes de 180 s" con las 50, con la huella definitiva.
    Firma dorada (`tests/support/mapGolden.ts`, semillas 42 y 123) regenerada y revisada.
  - **Datos de aspecto**: hojas y marcos nuevos en `content/appearance.json` validados con zod (incluidos los marcos
    de `Bridge_All.png`, recortados a mano porque la hoja no es regular); los colores de `terrain` de 0015 se
    conservan como reserva y se amplían con uno para el castillo.
  - **Procedencia**: una entrada con sha256 y bytes en `content/asset-provenance.json` por cada PNG nuevo
    (`Water.png`, `Foam.png`, `Tree.png`, `Bridge_All.png`, `Castle_Blue.png`); nada del Free Pack. Solo se copian las
    hojas usadas (no el resto de colores del castillo ni `Rocks`).
  - **Sonda E2E** ampliada: recuentos por elemento nuevo del mapa (orillas, árboles/copas, puentes, castillo) y de
    cuántos usan reserva; el castillo aparece en la sonda del mapa.
  - **Tests**: escenarios cubiertos con tests unitarios y de aplicación por defecto; como máximo 1–2 E2E nuevos, en
    modo manual (`?e2e&manual` + `step(n)`), preferiblemente ampliando la suite de humo (regla e2e-lite).
  - **Puerta visual del GDD** al inicio del apply: capturas de las semillas 42, 123 y dos más con orillas, puentes,
    copas y castillo, revisadas por el usuario antes de seguir.
  - **Documentación**: addendum a ADR-0013 (render del mapa con sprites y castillo en dominio) y actualización de la
    historia 0016 del GDD, cuyo criterio "el núcleo no cambia" deja de ser cierto por el castillo sólido.
- **Fuera**:
  - **0017 fullscreen-view**: la vista sigue siendo de 960 × 540.
  - **0018 flow-field**: los enemigos **siguen ignorando el mapa, también el castillo**: lo atraviesan y se pintan
    sobre él como hoy sobre troncos y agua (ver Riesgos).
  - Castillo-tienda e interacción con el castillo (0022); castillo destruible o con vida.
  - Rocas del agua, otros colores de castillo, esquinas cóncavas dibujadas a mano, animación del viento en árboles,
    talar árboles.
  - Cambiar la celda (60 px) o el tamaño del mundo para evitar la escala 0,9375.
  - Umbrales de fps o de tiempo real en el gate (el fps se mide a demanda en `realtime`/`CI_LIKE`).

## Capacidades afectadas
- `openspec/specs/procedural-map` (modificada): tipo `castle` en "Rejilla de celdas tipadas" y caminabilidad;
  "Zona de inicio" (centrada en la salida, con castillo; hoy dice "no hay castillo"); "Composición del mapa"
  (castillo único con huella fija; veto del río); "Conectividad" (desde la salida); "Mapa explícito y mapa vacío" y
  "Sonda del mapa para E2E".
- `openspec/specs/player-movement` (modificada): "Posición inicial en el centro del mundo" pasa a la salida ante la
  puerta; "Colisión con el mapa" incluye el castillo; `player.speed` 215 si algún escenario fija el valor.
- `openspec/specs/sprite-rendering` (modificada): "Pintado del mapa" (de rectángulos a arte con reserva por colores),
  "Datos de aspecto validados", "Aspecto de reserva ante un fallo de carga", "Escala y origen" (0,9375 del suelo) y
  "Sonda de render para E2E".
- `openspec/specs/run-outcome` (modificada): "Bot de referencia para el balance" y "Partida ganable y perdible con el
  contenido por defecto", re-medidos con castillo y velocidad 215.
- `openspec/specs/xp-gems` (modificada si hace falta): "Recolocación de gemas en celdas no caminables" con el castillo.
- `openspec/specs/asset-provenance` (sin cambio de requisitos previsto): solo entradas nuevas en la nota.
- `openspec/specs/enemy-behavior` (sin cambio): "Los enemigos ignoran el mapa" sigue vigente y cubre el castillo.

## Riesgos y dudas
- **Rendimiento en CI sin GPU**: la opción C midió 86 % de la base (19,0 / 18,6 fps frente a 21,6 / 21,9), justo en
  el umbral del 85 % y con ruido de ±2 fps; con la espuma fija bajó al 80 % en la semilla 123, así que el margen es
  ruido. La implementación definitiva puede quedar por debajo. Mitigación: medir de nuevo en apply y, si cae, reducir
  objetos (agrupar orillas por tramo, menos sprites de espuma) antes de tocar el diseño.
- **Objetos de escena cerca del tope**: ~270 en la semilla 123 frente al orientativo de 300; la copa separada del
  tronco puede sumar ~70 más si se implementa como dos objetos por árbol.
- **Balance frágil con el castillo**: 24/50 con 210, 28/50 con 215; una fila de huella más arriba bajó a 18/50. Si la
  huella definitiva cambia, el 215 puede dejar de valer; la banda 25..35 manda sobre el valor de la velocidad.
- **Enemigos que atraviesan el castillo** (hasta 0018): un enemigo puede salir del muro y golpear al jugador
  pegado a él, o quedarse dentro del castillo, pintado encima de un edificio sólido. Al nacer junto a la puerta, el
  jugador empieza con un muro a la espalda por el que también llegan enemigos. Es aceptable para el TFM (mismo
  comportamiento que con troncos y agua) pero se anota como deuda visible para 0018, y la sonda/escenarios no deben
  suponer que no hay enemigos sobre celdas `castle`.
- **Contradicción con el GDD**: la historia 0016 dice "el núcleo no cambia" y la de 0015 que el castillo va "en el
  punto de inicio"; el castillo sólido cambia dominio, firma dorada, bot y spawn. Hay que actualizar el GDD (agente
  `game-designer`) para que spec y GDD no se contradigan.
- **Escala 0,9375**: píxel algo suavizado; sin costuras en el prototipo, se valida en la puerta visual.
- **Orillas sin esquinas cóncavas**: muesca de espuma repetitiva en ríos en escalera (semilla 123). Se acepta; si la
  puerta visual lo rechaza, el apply se para y se replantea.
- **Marcos de `Bridge_All.png` a mano**: el prototipo dejaba un poste suelto; los marcos son datos validados, no
  números mágicos en código.
- **Modo manual y animación**: en E2E manual el reloj de render no avanza la espuma; ningún escenario debe depender
  del frame de animación.
- **Firma dorada**: cambian 135/576 (semilla 42) y 95/576 (123) caracteres más las 20 celdas del castillo; el cambio
  debe revisarse a mano, no regenerarse a ciegas.
- **Abierto para spec/design**: si el castillo aparece con `map=empty` (los E2E lo usan por defecto) y en los mapas explícitos de tests (y, si no,
  dónde nace el jugador en ellos); si el tejado del castillo tapa a las entidades como la copa; huella y salida
  definitivas; nombre del flujo derivado de la variedad de árboles.

## Criterio de éxito
- Todos los escenarios de las specs delta del change en verde con `npm run verify`, y `npm run test:e2e` en verde
  con ≤ 2 E2E nuevos, en modo manual.
- **Balance**: con el contenido por defecto (`player.speed` 215 y la huella definitiva), el bot de referencia gana
  entre 25 y 35 de las semillas 1..50, y el jugador quieto pierde antes de 180 s en las 50.
- **Mapa**: con las semillas 1..50, 1..1.000, 0 y 4.294.967.295, el mapa tiene exactamente 1 castillo de 20 celdas
  (5 × 4), la salida no solapa ninguna celda no caminable y el 100 % de las celdas caminables es alcanzable desde ella.
- **Render**: con `?e2e&manual&seed=42` y `seed=123`, los recuentos de la sonda de render por elemento del mapa
  coinciden con los del mapa de la sonda; con la hoja de cada elemento bloqueada, ese elemento usa los colores de
  reserva y no hay errores no capturados.
- **Rendimiento (a demanda, no gate)**: fps con `CI_LIKE=1` (frenado 25, 1 worker, mediana de 3 pasadas) en las
  semillas 42 y 123 ≥ 85 % de la base de rectángulos de 0015 (21,6 / 21,9 fps → ≥ 18,4 / 18,6); ≤ 300 objetos de
  escena del mapa en ambas semillas.
- **Procedencia**: `npm run guard:all` en verde; cada PNG nuevo tiene entrada con sha256 y bytes, y ninguno viene del
  Free Pack.
- **Puerta visual**: el usuario aprueba las capturas de 4 semillas (42, 123 y dos más) antes de pasar del primer
  bloque de tareas del apply.
- **Simulación intacta salvo el castillo**: con `map=empty`, misma semilla e input, la partida es idéntica tick a tick
  a la de antes del change salvo por la velocidad 215 y, si spec decide moverlo también sin mapa, el punto de salida
  (la variedad de árboles y el arte no cambian el snapshot).

## Decisiones del gate (2026-11-23)

1. El `game-designer` corrige la historia 0016 del GDD: el castillo sólido sí cambia el núcleo (dominio, generador,
   firma dorada, bot y punto de salida).
2. Enemigos que atraviesan el castillo: riesgo aceptado y deuda anotada para 0018 flow-field.
3. El castillo solo existe con el mapa real. Con `map=empty` y en los mapas explícitos de los tests no hay castillo
   y el jugador nace en el centro como hoy: la simulación sin mapa no cambia.
4. El tejado del castillo tapa a jugador, enemigos y proyectiles, igual que las copas.
5. Huella exacta, margen de fps y objetos, marcos de `Bridge_All.png` y flujo de azar de los árboles se cierran en
   spec y design; si la huella cambia, se re-mide el balance.
