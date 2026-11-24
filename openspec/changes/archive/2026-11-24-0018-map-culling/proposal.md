# Proposal · 0018-map-culling

- **Estado**: alcance aprobado por el usuario el 2026-11-23 como change propio (el flow-field pasa a 0019);
  preguntas 2–4 abiertas
- **Issue**: (opcional)
- **Rama / worktree**: `change/0018-map-culling`

## Problema
Desde el change 0017 (mundo de 3.840 × 2.160 y vista a ventana completa) el arte del mapa tiene de 2 a 3 veces más
objetos. Cada frame se mandan a dibujar **todos**, también los que quedan fuera de la cámara: Phaser 4.2.1 no
descarta por objeto en los `Layer`, y un objeto visible fuera de pantalla se transforma y entra en el lote igual
(ver `exploration.md`). Consecuencias medidas:

- En CI los tres E2E del mapa real tardan casi el doble que en 0016 y hubo que marcarlos con `test.slow()`
  (`slowMapRealOnCi`). Cámara 29,0 s → 56,2 s, Sprites 17,5 s → 33,7 s, Mapa real 20,7 s → 55,4 s, suite
  54,9 s → 1,8 min.
- En local con `CI_LIKE=1` el mapa real va a 14,1 / 12,9 fps de mediana (semillas 42 / 123), el 65 % / 59 % de la
  base de rectángulos (21,6 / 21,9 fps), con 667 / 750 objetos del mapa pintados en todo momento.

Para el jugador esto supone menos margen de frame en máquinas modestas, y el próximo change (flow-field, cientos de
enemigos) añadirá carga sobre ese presupuesto ya justo.

## Objetivo
Que solo se dibujen los objetos de arte del mapa que se ven en la cámara (más un margen), sin que cambie lo que ve el
jugador. Resultado observable:

- La sonda E2E informa de cuántos objetos del mapa se dibujaron en el último frame (`drawn`) junto a los totales
  actuales, y `drawn` queda claramente por debajo de `objects` con la ventana de 1.280 × 720.
- El mapa se ve igual que antes al moverse, reiniciar (R), cambiar el tamaño de la ventana y volver al menú: sin
  huecos, parpadeos en el borde ni espuma desincronizada al reaparecer.
- Los E2E del mapa real tardan menos en CI y los fps de `CI_LIKE` suben respecto a la línea base de 0017.

## Alcance
- **Dentro**:
  - Recorte por cámara de todos los objetos de arte del mapa de las dos capas: agua, orillas, espuma, árboles
    (troncos y copas), puentes y castillo (fachada y tejado), incluido el aspecto de reserva.
  - La visibilidad se mantiene correcta al moverse la cámara, en las esquinas del mundo, con la vista variable
    (960 × 540 a 2.560 × 1.440), tras reiniciar, al cambiar el tamaño de la ventana y al salir al menú.
  - Sonda: nuevo recuento de objetos del mapa dibujados (`drawn`, 0 en el menú). Los recuentos actuales
    (`painted`/`fallback` por elemento, `objects`, `sprites.cells`) **no cambian de significado ni de valor**.
  - Tests unitarios de la regla de visibilidad y ampliación del E2E de "Cámara" existente (regla e2e-lite: 0 E2E
    nuevos). `realtime [map]` informa de `drawn` además de `objects`.
  - Medición antes/después (informativa) rellenando la sección Mediciones de `exploration.md`: duración en CI de
    los tres E2E del mapa real (Cámara, Sprites, Mapa real) y suite total, y la medida local `CI_LIKE=1`
    (`--project=realtime --grep "calibration|\[map\]"`).
- **Fuera**:
  - Flow-field y cualquier cambio de dominio o aplicación (`src/domain`, `src/application`), incluido el mapa
    generado y su firma dorada (`mapGolden.ts`).
  - Cambios de balance o de contenido de juego (`player.speed`, oleadas, armas, mapa).
  - Recorte de enemigos, proyectiles, gemas u otras entidades.
  - Coste de relleno de píxeles de la ventana grande (resolución, escala de render, `Tilemap` nativo,
    `RenderTexture` por trozos).
  - Cambios visuales del arte del mapa.
  - Umbrales de fps o de tiempo en el gate (`verify`/CI).

## Capacidades afectadas
- `openspec/specs/sprite-rendering` (modificada): sonda de render (`drawn`), pintado del mapa / capas (solo se
  dibuja lo que está en cámara, mismo aspecto), "Coste de render del mapa (a demanda)" (informa de `drawn`).
- `openspec/specs/world-camera` (sin cambio previsto; referencia por la vista variable y el recorte al mundo).
- `openspec/specs/procedural-map` (sin cambios).

## Riesgos y dudas
- **Dos causas de la lentitud**: más objetos (lo que ataca este change) y más píxeles (1.280 × 720 son 1,78 veces
  los de 960 × 540). El relleno queda; puede no volverse a las cifras de 0016.
- **Ganancia dependiente de la ventana**: a 1.280 × 720 se ve ~11 % del mundo; a 2.560 × 1.440 ~44 %. Los tramos
  largos de agua y orilla (el río de punta a punta) casi siempre intersectan la vista y no se recortan.
- **Parpadeo en el borde**: la vista de la cámara va un frame por detrás del estado; hace falta margen o calcular la
  vista desde el estado del jugador. El cómo es del diseño.
- **Reutilización de objetos entre partidas**: reiniciar, cambiar el tamaño y salir al menú deben restablecer la
  visibilidad; la espuma debe tener el frame vigente al reaparecer.
- **Sonda**: los E2E comparan los totales con `map.counts`; por eso `drawn` es un campo nuevo y no se redefine nada.
- **Incógnita de medida**: no se conoce aún el reparto de objetos por rol (espuma, orilla, árbol) en 42/123 ni qué
  parte del frame es CPU de lote frente a relleno; el diseño puede medirlo sin navegador antes de comprometerse.

## Preguntas abiertas para el gate humano
1. **Decidido (usuario, 2026-11-23): change propio**, previo al flow-field, que pasa a ser el 0019. Solo toca
   infraestructura y se mide por separado.
2. ¿Se retira `test.slow()` de `slowMapRealOnCi` si la duración en CI lo permite tras este change, o se mantiene
   hasta ver varias ejecuciones en CI?
3. ¿Basta con **mejorar** respecto a 0017, sin exigir volver a las cifras de 0016 (dado el relleno de píxeles de
   1.280 × 720)? Propuesta: sí.
4. ¿Margen de visibilidad fijo (p. ej. 1 celda) o proporcional al tamaño de la vista? (Puede dejarse al diseño.)

## Criterio de éxito
- `npm run verify` y `npm run test:e2e` (proyecto `logic`) en verde, con los totales de la sonda (`painted`,
  `fallback`, `objects`, `sprites.cells`) iguales a los de antes del change para las mismas semillas.
- Con el mapa real y la vista de 1.280 × 720, en el E2E de "Cámara": `0 < drawn < objects` al empezar la partida y
  `drawn` cambia tras cruzar el mapa; `drawn` = 0 en el menú.
- Tests unitarios de visibilidad en verde: objeto dentro, fuera, tocando el borde, con margen, vista que crece con la
  ventana y vista recortada al mundo en las esquinas; la unión de lo visible desde todas las posiciones de cámara
  cubre el plan entero (ningún objeto queda sin poder verse).
- Medición informativa (sin umbral en el gate), comparada con la línea base:
  - CI, duración por test: Cámara < 56,2 s, Sprites < 33,7 s, Mapa real < 55,4 s, suite < 1,8 min
    (referencia 0016: 29,0 / 17,5 / 20,7 s y 54,9 s; alcanzarla no es requisito salvo que el gate decida otra cosa).
  - Local `CI_LIKE=1`: fps mediana semillas 42 / 123 por encima de 14,1 / 12,9; calibración por encima de 16,5 fps
    y p95 de frame por debajo de 133,3 ms; `drawn` claramente por debajo de 667 / 750 con 1.280 × 720.
- Sin cambios en `src/domain`, `src/application`, `content/` de balance ni en la firma dorada del mapa.
