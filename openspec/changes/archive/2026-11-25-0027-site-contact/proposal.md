# Proposal · 0027-site-contact

- **Estado**: aprobada por el usuario (2026-11-25)
- **Rama / worktree**: `change/0027-site-contact`

## Problema
Con 0026 la oferta de obra se abre en un **punto de acceso** invisible (1,5 celdas bajo la huella, radio 40), que el
jugador tiene que encontrar. El solar libre es hierba: el jugador y los enemigos lo cruzan, así que no se lee como un
lugar del mapa. Si no puede pagar ninguna opción, al llegar no pasa nada y no sabe por qué. Además, el `BuildPanel`
pega los textos ("Casa15 Madera · 0 Piedra"), escribe Madera/Piedra en vez de usar los iconos del HUD y esconde la
torre si no se puede pagar, así que el jugador no sabe que existe ni cuánto le falta.

## Objetivo
- La oferta de obra se abre al **tocar** un solar armado por cualquiera de sus lados, se pueda pagar algo o no.
- Un solar libre es un **obstáculo** desde el tick 0 para el jugador y para los enemigos.
- El panel de obra se lee bien: textos separados, iconos de recurso y siempre las dos opciones, con la que no se puede
  pagar atenuada y con lo que falta.

## Alcance
- **Dentro**:
  1. **Oferta por contacto**:
     - **Tocar** = la distancia del centro del jugador al rectángulo de la huella del solar es ≤ radio del jugador + ε.
       ε es una **constante de dominio** pequeña (p. ej. 1 px) y no va en el contenido. Vale igual en caras y esquinas
       y no consume azar.
     - Se elimina el **punto de acceso** del contenido (`access.radius`, `access.rearmDistance` y su regla cruzada con
       el radio del jugador), del dominio, del snapshot y de la sonda E2E (`access`). El `ProximityGate` de la tienda
       se queda como está.
     - **Re-armado con histéresis**: tras salir sin construir, el solar vuelve a armarse cuando el jugador se aleja
       al menos X px del **borde de la huella**. X es un parámetro nuevo de `content/buildings.json`, validado con
       zod (> ε). Valor por defecto propuesto: **64 px** (una celda), ajustable.
     - La oferta se abre **siempre** al tocar un solar armado, aunque no se pueda pagar ninguna opción. Esto sustituye
       la regla "solo si algo es asequible". Salir (Esc o botón) deja la partida como estaba, salvo el solar desarmado.
     - Se mantiene el resto: como mucho un solar por tick, prioridad de la mejora y de la tienda en el mismo tick, sin
       oferta en el tick final y sin azar.
  2. **Solar libre bloqueante**:
     - La huella del solar libre es no caminable desde el tick 0 para todo lo que depende de la caminabilidad: colisión
       del jugador, línea libre, `FlowField` (también el de `GuardPost`), recolocación de apariciones, recogibles y
       puntos de patrulla, ovejas y bot.
     - No cambian `typeAt` ni la colocación de solares (`placeSites` y `SITE_STREAM` intactos). Construir sigue
       marcando la huella del tipo elegido; si queda libre alguna celda del solar que no ocupa el edificio, el design
       decide qué pasa con ella.
  3. **BuildPanel**:
     - Nombre y coste separados (se acaba el "Casa15 Madera · 0 Piedra").
     - Costes y saldo con los **iconos de recurso del HUD** (madera, piedra) a un tamaño legible, en lugar de los
       literales, cumpliendo la CSP (sin estilos inline).
     - Siempre se ven **casa y torre**, en ese orden. La que no se puede pagar sale atenuada y desactivada, con el coste
       insuficiente en rojo y «faltan N» por recurso. `Run.build` sigue rechazando lo que no se puede pagar.
  4. **Bots y balance**: el bot v5 (`builderBot`) va a una celda caminable junto a la huella y la toca. El v4 sale de
     cada oferta sin construir. Se regenera `BALANCE_BASELINE` (v4) y la referencia del v5.
  5. **Firmas**: solo se regenera `STONE_GOLDEN`. La piedra depende de qué bajas ocurren y en qué orden, y eso cambia
     cuando los enemigos rodean las huellas. `MAP`, `STRUCTURE`, `RESOURCE`, `SHEEP` y `SITE_GOLDEN` quedan intactas.
  6. **GDD**: nueva entrada 0027 `site-contact`. Se renumeran `goblin-tower-archers` → 0028 y `characters` → 0029, con
     las referencias de `balance-pass-2` y la mención "bloque 0020-0028" (líneas señaladas en `exploration.md`).
- **Fuera**:
  - Nueva colocación de solares o cambios en su huella. Se quita la fila de acceso de la zona libre solo si el design
    demuestra que no cambia `SITE_GOLDEN`; si la cambia, queda fuera.
  - Recalibrar el contenido de combate, de oleadas o de edificios.
  - Colisión de enemigos con el mapa o separación entre enemigos (siguen aplazadas).
  - Cambios en la tienda o en su `ProximityGate`.
  - Arte nuevo del solar; solo se reutilizan los iconos existentes del HUD en el panel.

## Capacidades afectadas
- `openspec/specs/build-sites` (modificada): vocabulario sin acceso, contenido (re-armado X), solares de la partida
  (el solar libre bloquea), apertura por contacto con re-armado por distancia al borde, oferta con las dos opciones y
  si se pueden pagar, construcción (rechazo de lo que no se puede pagar), bloqueo, despeje, panel, sonda y balance.
- `openspec/specs/procedural-map` (modificada): capa de obra con huellas libres no caminables desde el tick 0;
  conectividad.
- `openspec/specs/enemy-behavior` (modificada si recoge la navegación): `FlowField` y `GuardPost` rodean el solar libre.
- `openspec/specs/sheep` (modificada si hace falta): las ovejas respetan la huella libre (filtro de reapariciones).
- `openspec/specs/simulation-loop` (modificada si cambia la redacción del paso de solares).
- `openspec/specs/hud` / `sprite-rendering` (revisar): iconos de recurso reutilizados en el panel DOM.

## Riesgos y dudas
- **v4 cerca del techo de la banda**: la medición previa da 34/50 con la banda en 25–35. Un ajuste pequeño en apply
  podría sacarlo de banda.
- **Unos 92 tests a reescribir** por quitar el acceso: `run-sites-open`, `run-build*`, `building-rules`, `place-sites`,
  `tests/support/sites.ts`, `policies.ts`, `buildings-content`, E2E `gameplay.spec` y `probe.ts`. A eso se suman los
  tests "con y sin X" (ovejas, solares, mapa, piedra, recursos, política de obra), que hay que reformular porque las
  huellas bloqueantes desde el tick 0 cambian la partida.
- **Tiempo de los lotes en CI**: unos 105 s (v4) y 123 s (v5) proyectados con un tope de 180 s. Queda poco margen si
  el BFS de los solares bloqueados sale más caro de lo medido.
- **Modal al rozar**: con bloqueo y apertura siempre, pasar rozando un solar congela la partida. La histéresis de X px
  lo mitiga; si en la práctica molesta, X se ajusta en el contenido.
- Iconos en DOM: los del HUD son texturas Phaser. El design elige cómo llevarlos al panel (recorte CSS de la hoja o
  `data:` URL) dentro de la CSP `img-src 'self' data:`, y revisa la procedencia del icono de piedra.
- Orden de creación y escenarios: falta decidir si es error que la salida o el jugador inicial queden dentro de un
  solar declarado. También hay que revisar el filtro `revision > 0` de `Flock` (decisión del design).

## Criterio de éxito
- Todos los escenarios del delta en verde y `npm run verify` en verde.
- Balance **sin recalibrar**, semillas 1..50 con el mapa generado:
  - bot v4 entre **25 y 35** victorias (medición previa 34/50);
  - bot v5 entre **25 y 35** (previa 34/50), con ≥ 1 casa y ≥ 1 torre construidas en el lote;
  - quieto: **0 victorias** y derrota antes de 180 s (tick < 10.800) en las 50 semillas (previa: la muerte más tardía
    en el tick 6.067).
- Si apply saca al v4 o al v5 de la banda, se **vuelve a propose**.
- Objetos del mapa de 42/123 sin cambios (737/820, ≤ 1.000). Ninguna semilla de 1..50 aísla celdas caminables ni
  encierra la salida.
- Firmas: solo cambia `STONE_GOLDEN`; las otras cinco, idénticas.
- Cada lote de balance cabe en 180 s; el verify-report anota el tiempo local y su equivalente ×2,8 de CI (previa:
  37,7 s y 43,9 s en local).
- La sonda E2E ya no expone `access`. El E2E de construir en el juego real llega tocando el solar.
- El panel muestra siempre casa y torre, con iconos y «faltan N» en la que no se puede pagar.
- Con el contenido real, 30 de madera y 15 de piedra, tocar un solar permite construir una torre de extremo a
  extremo (dominio → sonda → panel → construcción). Regresión del informe del usuario: en `main` tras 0026 solo pudo
  construir casas (tasks 3.4).
