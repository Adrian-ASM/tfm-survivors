# Proposal · 0031-combat-feedback

- **Estado**: aprobada (2026-11-26)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0031-combat-feedback`

## Problema
El jugador no sabe cuánto le falta para destruir una casa o una torre goblin: el snapshot no trae su vida máxima y nada
la pinta. Tampoco ve cuánto daño hace cada golpe (flecha, pulso, torre propia, explosión) ni cuánto recibe. Solo hay un
destello de `hitFlashTicks` 4, sin cifra. Es la historia 0031 del GDD (Should). Los dos criterios de barra de vida se
movieron aquí desde 0032.

## Objetivo
Las casas y torres goblin intactas llevan una barra que refleja su vida actual y que desaparece en ruina. Cada golpe que
daña a un enemigo, una estructura, una oveja o al jugador muestra un número con el daño aplicado en la posición del
objetivo, que sube y se desvanece. Los golpes de cada tick salen del núcleo sin azar, idénticos para la misma semilla y
las mismas entradas, y el balance no cambia.

## Alcance
- **Dentro**. Decisiones del autor (cerradas):
  1. **Daño mostrado = daño aplicado**. Es lo que baja la vida: tras `armor` y el mínimo 1 (jugador) y recortado a la
     vida restante. El golpe letal cuenta (enemigo abatido, oveja muerta, estructura que pasa a ruina, jugador a 0). Un
     golpe que no daña no da número: jugador invulnerable, objetivo ya muerto o en ruina.
  2. **Agrupación**: los golpes del mismo tick sobre el mismo objetivo se suman en el núcleo. Sale un único número por
     objetivo y tick, con la suma de lo aplicado.
  3. **Cuatro clases de objetivo**: `enemy`, `structure`, `sheep` y `player`. Cada una tiene su color en
     `content/appearance.json`, y el del jugador es rojo. El render usa un pool fijo de **48** números y, si está lleno,
     recicla el más antiguo. El núcleo pone además un **tope por tick** al registro.
  4. **Solo formas y `Text` de Phaser** para barras y números. Sin assets nuevos y sin tocar
     `content/asset-provenance.json`.
- **Dentro**. Recomendaciones de la exploración que el orquestador adopta por defecto (revisables en el gate):
  5. **Registro central en `Run`**, sin azar y sin asignar en el bucle caliente. Lo alimentan los puntos donde hoy se
     aplica daño: `Arsenal` (proyectiles y pulso), `TowerBattery`, `HazardField` y `Run.applyHit`. Cada golpe tiene un
     **id único** de una secuencia propia de la partida, en orden de registro. Registrar no cambia el orden del tick ni el
     consumo de ningún flujo de azar.
  6. **Snapshot con los golpes de los últimos N ticks**. Cada uno lleva id, tick, clase, posición del objetivo al
     golpear y daño. El render **deduplica por id**: un golpe se pinta una sola vez aunque aparezca en varios snapshots.
     Esto cubre los frames que avanzan varios ticks y los re-render de pausa, tienda y obra.
  7. **Ventana N y tope por tick en un bloque o fichero de contenido de juego propio, `combat`** (no en
     `content/weapons.json`; cerrado por el autor en el gate), validados con zod. Colores por clase, duración, ascenso y
     medidas de la barra van en un bloque de aspecto del combate de `content/appearance.json`, también con zod.
  8. **`maxHealth` en `StructureSnapshot`**, tomada de `content/structures.json` (casa 60, torre 90). El render no lee el
     contenido de juego para la barra.
  9. **Posición fijada al golpe**. El número no sigue al objetivo; nace donde estaba al recibir el golpe. Su ascenso y
     desvanecido los mueve el **reloj de render** (`AnimClock`). Ese reloj no depende de los ticks salvo en modo manual
     (`?e2e&manual`, change 0014), donde avanza `n × TICK_MS` con cada `step(n)`. Los E2E de este change cuentan con
     eso.
  10. **Congelados en pausa, oferta, tienda, obra y fin**: el reloj de render se para y los números visibles se quedan a
      medias. Se acepta.
  11. **Barras solo en casas y torres goblin**. Ni enemigos, ni ovejas, ni edificios propios (solares). La vida del
      jugador sigue solo en el HUD.
  - Solo hay núcleo donde hace falta registrar y exponer: el registro, `Run`, el snapshot y `StructureSnapshot`. Lo
    demás es infraestructura (capa de números, barras y sonda) y contenido.
  - Tests: unitarios y de aplicación para el registro, la suma, el recorte, el tope, la ventana y el determinismo.
    Unitarios de capa y de esquema para el render. **Como mucho 1–2 E2E** nuevos o ampliados, en modo manual
    (`step(n)`) y sin esperas de reloj (e2e-lite).
- **Fuera**:
  - Números de curación: regeneración, carne, cura al subir de nivel y cura de la tienda.
  - Números de recursos recogidos (oro, madera, piedra, XP).
  - Barras de vida de enemigos, ovejas, jugador en el mundo y edificios propios.
  - Críticos, colores por tipo de arma, tamaño del número según el daño y agrupación entre ticks distintos.
  - Arte del pack para barras o números, fuentes bitmap y cambios en `asset-provenance.json`.
  - Cambios de balance o de contenido de combate: daños, vidas, `armor`, `hitFlashTicks` y oleadas.
  - Que `HazardField` dañe estructuras o que `TowerBattery` dañe algo más que enemigos. Se muestra solo lo que ya
    ocurre.
  - Recorte por cámara de números y barras. No entran en el plan del mapa ni en su total de objetos.
  - Arqueros de las torres goblin (0032).

## Capacidades afectadas
- `openspec/specs/simulation-loop` (modificada): el snapshot expone los golpes de la ventana, con ids únicos, orden
  fijo y tope. Determinismo: misma semilla y entradas, mismos golpes. Registrar no consume azar.
- `openspec/specs/goblin-structures` (modificada): `maxHealth` en el snapshot de estructura, barra sobre las intactas y
  sin barra en ruina. Número al dañarlas, golpe que la deja en ruina incluido.
- `openspec/specs/sprite-rendering` (modificada): capa de números en coordenadas de mundo, por encima de entidades y
  capa alta del mapa y por debajo del HUD. Pool de 48 con reciclado del más antiguo, deduplicación por id, color por
  clase, ascenso y desvanecido con el reloj de render, barras y limpieza al cambiar de partida (R, menú). También la
  sonda E2E y que los objetos del mapa siguen en 820/904.
- `openspec/specs/auto-weapons`, `enemy-hazards`, `player-health` y `sheep` (posible MODIFIED solo para citar que su
  daño aplicado entra en el registro). La regla de daño de cada una no cambia. Lo concreta la fase spec.
- `openspec/specs/hud` y `world-camera` (sin cambios): se citan para dejar claro que el HUD no cambia y que números y
  barras van en mundo (`scrollFactor` 1), no fijos a pantalla.

## Riesgos y dudas
Decisiones cerradas por el autor en el gate (2026-11-26):
- **Ventana frente a ticks por frame**: un `execute` cubre hasta 15 ticks, y más con `?e2e&speed=N`. **N ≥ 15** (el
  máximo de ticks por `execute` a velocidad 1) y se acepta perder números con `speed` > 1 (solo E2E de tiempo real).
- **Tope por tick y orden**: con 300 enemigos vivos y un pulso, un tick puede tener cientos de golpes. Al superar el tope
  se **descartan los últimos registrados**: se conservan los primeros en orden de registro, de forma determinista
  (siempre los mismos para la misma semilla y las mismas entradas).
- **Ubicación del tope y de la ventana**: en un bloque o fichero de contenido de juego propio, **`combat`**, validado
  con zod; no en `content/weapons.json`, que es solo de armas.

Riesgos abiertos:
- **Coste en el bucle caliente**: el registro no debe asignar por golpe (búfer fijo). Bench M1 sin regresión apreciable.
  Lo mide el diseño.
- **Coste de `Text`**: `setText` regenera la textura. El texto se fija solo al ocupar un hueco del pool, nunca por frame.
- **Invariancias**: el change no toca contenido de juego ni la colocación por semilla (ovejas → solares → decoración).
  `maxHealth` sale de un dato que ya existe y el registro no consume azar, así que la cadena de colocación no varía y las
  firmas tampoco.
- **Sonda E2E**: hará falta un recuento de números visibles por clase y de barras visibles para cubrir los escenarios
  de render. La forma exacta la fija la spec o el diseño.

## Criterio de éxito
- Con la misma semilla y las mismas entradas, dos simulaciones dan la misma lista de golpes en cada tick (id, tick,
  clase, posición, daño).
- Un golpe de 10 a un enemigo con 4 de vida da un número de 4. Al jugador con `armor` 3, un golpe de 2 da 1. Si es
  invulnerable, no hay número. Dos flechas de 5 al mismo enemigo en el mismo tick dan un único número de 10.
- Una casa goblin con 30/60 de vida muestra una barra al 50 %. Tras el golpe que la deja en ruina, sale su número y la
  barra deja de verse.
- Con más golpes por tick que el tope, el snapshot trae exactamente el tope y siempre los mismos. Con más de 48 números
  vivos en el render, se recicla el de id más bajo.
- Un mismo snapshot renderizado varias veces (pausa, tienda) no crea números nuevos.
- `BALANCE_BASELINE` idéntico semilla a semilla. Las seis firmas doradas (`MAP_GOLDEN`, `STRUCTURE_GOLDEN`,
  `RESOURCE_GOLDEN`, `SHEEP_GOLDEN`, `STONE_GOLDEN`, `SITE_GOLDEN`) intactas. Objetos del mapa en 820/904 en 42/123.
- `npm run guard:all` sin entradas nuevas en `asset-provenance.json`. `npm run verify` y `npm run test:e2e` en verde,
  con como mucho 1–2 E2E nuevos o ampliados en modo manual.
