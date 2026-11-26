# Proposal · 0030-pickup-visibility

- **Estado**: aprobado (2026-11-26). El autor aprueba también corregir en este change el escenario «Fases
  deterministas» de `sprite-rendering` (fase del árbol en [0, 3]).
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0030-pickup-visibility`

## Problema
En una pantalla grande los recogibles apenas se ven y no se mueven. Oro, madera y carne usan `G_Idle`/`W_Idle`/`M_Idle`
a escala 0,3 (unos 38 px de lienzo, y el dibujo ocupa menos). La piedra va a escala 0,5 de una hoja de 64 px y la gema
XP es un disco de 10 px (2 × `gemRadius`). Como no tienen animación de aparición ni movimiento, el jugador no ve que algo
acaba de caer y pierde oro, piedra o carne que tenía al alcance. Es la historia 0030 del GDD (Should).

## Objetivo
Los cinco tipos de recogible (`xp`, `gold`, `wood`, `meat`, `stone`) son más grandes y flotan con suavidad. Oro, madera
y carne reproducen una vez su hoja de aparición del pack al salir. El radio de recogida, la simulación y el balance no
cambian.

## Alcance
- **Dentro** (decisiones del autor, tal cual):
  - **Escala**: oro, madera y carne 0,5 (unos 64 px), piedra 0,75 y gema de unos 20 px de diámetro. Para la gema se
    añade un campo de tamaño nuevo a su esquema. Todos los valores van en `content/appearance.json`. El radio de
    recogida no cambia (`pickupRadius` 128, `gemRadius` 5).
  - **Flote en los cinco tipos**: desplazamiento vertical senoidal de 4 px de amplitud y 1,6 s de periodo, con una fase
    distinta para cada id. Lo mueve el reloj de render (`AnimClock`), sin tweens. Ese reloj se congela en pausa, con una
    oferta de mejora abierta, en la tienda, en la obra y con la partida terminada. No depende de los ticks salvo en modo
    manual (`?e2e&manual`, change 0014), donde avanza `n × TICK_MS` con cada `step(n)`. Amplitud, periodo y regla de
    fase se definen en el contenido.
  - **Aparición**: oro, madera y carne reproducen su hoja `*_Spawn` (`G_Spawn`, `W_Spawn`, `M_Spawn`; 7 fotogramas de
    128 px) una sola vez al aparecer y luego flotan. La piedra y la gema solo flotan, sin efecto extra. La sombra que
    trae la hoja se mueve con el objeto (no se pinta una sombra propia).
  - **Montones de madera del tick 0**: también reproducen `W_Spawn` al empezar la partida, con un desfase por id para
    que no aparezcan todos a la vez.
  - **Procedencia**: delta de la spec `asset-provenance`, que hoy prohíbe versionar `*_Spawn.png` y `M_Spawn.png`, para
    permitir exactamente `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png` de Update 010. Cada una lleva su entrada en
    `content/asset-provenance.json` (byte a byte la del pack, con sombra). Se actualizan los tests que vigilan esa
    prohibición (`resource-provenance`, `sheep-provenance`, `appearance-schema`, `appearance-hazards`). Siguen
    prohibidas las variantes `_(NoShadow)`, `HappySheep_All`, `GoldMine_Destroyed` y el Free Pack.
  - **Reserva**: si falla la hoja `*_Spawn` de un tipo, no hay aparición y se pasa directamente a su `idle`. Si falla
    la `idle`, se usa la reserva de siempre.
  - **Deuda de documentación**: corregir AGENTS.md. En el bloque de 0029 pone "Árbol con `idle` 0–5 a 6 fps", y desde
    el PR #77 es 0–3 a 4 fps. La torre goblin sigue en 0–3 a 5 fps.
  - Solo infraestructura (`PickupLayer`, `looks.ts`, esquema de aspecto, carga de hojas) y contenido de aspecto.
  - Tests: unitarios de capa y de esquema; como mucho **1 E2E** en modo manual, mejor ampliando uno de la suite de humo
    (e2e-lite).
- **Fuera**:
  - **Zoom de cámara por tamaño de ventana** (no-objetivo). Afecta a ADR-0014, a la cámara de UI, a `CameraRig`, al
    recorte de 0018, al HUD y al anillo de aparición. Queda como candidato a change propio.
  - Sombra elíptica propia que no flote (opción C de la exploración).
  - Destello o efecto de aparición en la piedra y la gema.
  - Cambios en el núcleo: `pickupRadius`, `gemRadius`, `magnetSpeed`, topes, recogida, flujos de azar y snapshot.
  - Recorte por cámara de los recogibles. Siguen fuera del plan del mapa y del total de objetos del mapa.
  - Iconos del HUD y de la guía. Siguen con `G_Idle`/`W_Idle`/`Deco/05`, sin flote ni escala nueva.

## Capacidades afectadas
Specs vivas con reglas que este change contradice o amplía:

- `openspec/specs/asset-provenance` (modificada):
  - "Procedencia de las hojas de los recursos": `MUST NOT versionarse … *_Spawn.png` y el escenario "Hojas de
    recursos no usadas" (busca `_Spawn` y espera 0 coincidencias).
  - "Procedencia de las hojas de las ovejas y de la carne": `MUST NOT versionarse … M_Spawn.png` y el escenario "Hojas
    de ovejas y carne no usadas" (busca `M_Spawn`).
  - Un escenario de la procedencia de peligros/estructuras ("Ninguna hoja de más") busca `W_Spawn.png` y espera 0
    coincidencias.
- `openspec/specs/sprite-rendering` (modificada):
  - "Arte de Tiny Swords Update 010 por elemento": el texto ("ni `M_Spawn`") y el escenario "Solo las hojas usadas"
    (ningún fichero con `M_Spawn`). El escenario "Hoja de cada elemento" debe nombrar las hojas `*_Spawn`.
  - "Aspectos de los recogibles y de las vetas": hoy solo hay hoja `idle` por tipo y la gema sin hoja no tiene tamaño
    propio. Hacen falta el aspecto de aparición en oro, madera y carne, el campo de tamaño de la gema, los parámetros
    del flote y los casos de datos inválidos. La reserva sigue siendo la forma de 10 px.
  - "Proyectiles, gemas, pulso y fondo": hoy los recogibles se pintan "en `idle`" y en su posición (error ≤ 0,001).
    Con el flote, la posición pintada pasa a ser la del snapshot más el desplazamiento vertical, y la aparición
    antecede a `idle`.
  - "Escala y origen": se aplica tal cual con las escalas nuevas. El caso nuevo es la gema sin hoja con tamaño de
    contenido.
  - "Limpieza de la vista al cambiar de partida": tras R o al volver al menú, las apariciones en curso se descartan.
    Los montones de la partida nueva vuelven a aparecer con su desfase.
  - "Sonda de render para E2E": los recuentos `sprites.pickups.<tipo>.visible/placeholder` mantienen su significado.
    Hay que dejar claro que aparición y flote no los cambian y que los recogibles siguen fuera de los objetos del mapa
    (820/904 en 42/123).
  - Espuma, árboles y torres comparten reloj con "Animación del arte del mapa". El requisito nuevo de animación de
    recogibles debe congelarse en los mismos estados.
- `openspec/specs/xp-gems` (modificada): en "Pintado de las gemas", la posición del sprite (error ≤ 0,001) pasa a
  incluir el flote. "El tamaño en pantalla lo fija el aspecto de su tipo, no `gemRadius`" sigue valiendo, ahora también
  para la gema. El modelo, la recogida y los topes no cambian.
- `openspec/specs/hud` (sin cambios): los iconos de "Oro y madera en el HUD" siguen usando `G_Idle`/`W_Idle`. Se cita
  para dejar claro que no heredan la escala ni el flote.
- `openspec/specs/resources` (sin cambios): ni las fuentes ni los montones del tick 0 cambian. El desfase de aparición
  por id es solo de render.

## Riesgos y dudas
- **Aparición fuera de cámara**: los recogibles no se recortan por cámara, así que la aparición de los lejanos se gasta
  sin que nadie la vea. Se acepta.
- **Tamaño frente a radio real**: con 64 px de dibujo y `gemRadius` 5, el jugador puede pensar que el radio de
  recogida es mayor que el real. Las escalas son moderadas a propósito y se pueden ajustar en contenido tras verlas.
- **Cuadrícula real de las hojas `*_Spawn`**: hay que confirmar al aplicar que son 7 × 128 px y que el último fotograma
  coincide con la pose de `idle`, para evitar un salto al pasar de una a otra.
- **Determinismo del render**: la fase por id y el desfase de los montones deben salir del id, sin
  `RandomGenerator` ni flujo de azar nuevo. Así no cambia ninguna firma dorada (`MAP_GOLDEN`, `STRUCTURE_GOLDEN`,
  `RESOURCE_GOLDEN`, `SHEEP_GOLDEN`, `STONE_GOLDEN`, `SITE_GOLDEN`) ni `BALANCE_BASELINE`. El change no toca contenido de
  juego ni la colocación por semilla (ovejas → solares → decoración), así que la cadena de colocación no varía.
- **Reciclado de huecos**: la aparición sale una vez por id. Como los ids no se reutilizan (ADR-0006), un hueco
  reciclado arranca la aparición del recogible nuevo y nunca repite la del anterior. Tras `clear()` (R, menú) se
  reinicia.
- **Deuda de spec observada, no incluida salvo que el autor lo pida**: en `sprite-rendering`, el escenario "Fases
  deterministas" sigue diciendo que la fase del árbol está "en [0, 5]" y "Frame de un árbol según su fase" usa una
  `idle` de 6 frames a 6 fps. Con los datos actuales (0–3 a 4 fps) la fase va en [0, 3]. El primero contradice los
  datos del repositorio. Se puede corregir en el mismo MODIFIED si se aprueba.
- **Duda menor**: si la sonda debe exponer un recuento de recogibles en aparición. Si basta con los recuentos actuales,
  no hace falta sonda nueva.

## Criterio de éxito
- Con los datos del repositorio, los sprites de oro, madera y carne miden 64 × 64 px (128 × 0,5), la piedra 0,75 × su
  frame y la gema 20 px de diámetro (error ≤ 0,001). `pickupRadius` sigue en 128 y `gemRadius` en 5.
- El desplazamiento vertical de un recogible es 4 × sen(2π × R / 1.600 + fase(id)) px, con R el reloj de render en ms
  (error ≤ 0,001). Dos ids con fases distintas dan desplazamientos distintos con el mismo R. En pausa, oferta, tienda,
  obra y fin, el desplazamiento no cambia a lo largo de 60 frames.
- Un recogible `gold`, `wood` o `meat` nuevo muestra los fotogramas de su hoja `*_Spawn` en orden una sola vez y después
  su `idle`. La piedra y la gema nunca usan una hoja de aparición.
- En el tick 0 del mapa real, los montones de madera reproducen `W_Spawn` con un desfase distinto por id.
- `npm run guard:all` pasa con `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png` versionadas y registradas. Ningún fichero
  `_(NoShadow)`, `HappySheep_All` ni `GoldMine_Destroyed` está versionado.
- `BALANCE_BASELINE` y todas las firmas doradas siguen idénticas. Los objetos del mapa siguen en 820/904 en 42/123 y
  los recuentos `sprites.pickups.*` no cambian para el mismo snapshot.
- `npm run verify` y `npm run test:e2e` en verde, con como mucho 1 E2E nuevo o ampliado, en modo manual.
- AGENTS.md dice "0–3 a 4 fps" para el árbol en el bloque de 0029.
