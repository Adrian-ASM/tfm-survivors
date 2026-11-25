# Proposal · 0026-build-sites

- **Estado**: aprobada (2026-11-25)
- **Issue**: (opcional)
- **Rama / worktree**: `change/0026-build-sites`

## Problema
La madera (0022) y la piedra (0025) se recogen pero no se gastan: no tienen sumidero y el jugador no tiene motivo
para buscarlas. El GDD les da destino (madera a casas, madera + piedra a torres) y deja pendiente un criterio que
salió de 0019: que el campo de flujo se recalcule cuando aparece un obstáculo nuevo y los enemigos lo rodeen. Hoy el
mapa es inmutable durante la partida, así que ese criterio no se puede cumplir.

## Objetivo
En el mapa generado hay **6 solares de obra** por semilla. Si el jugador llega a la zona de acceso de un solar con
recursos para al menos una opción, la partida se pausa y se elige entre **casa** (madera) y **torre de caballeros**
(madera + piedra); solo se ofrecen las asequibles. Lo construido bloquea el paso al jugador y a los enemigos, que
lo rodean por el campo de flujo recalculado. La casa da oro de forma periódica; la torre dispara flechas sola a los
enemigos.

## Decisiones tomadas (usuario)
1. **Bloqueo**: los edificios construidos **bloquean** sus celdas para jugador y enemigos. El campo de flujo se
   recalcula al construir y los enemigos los rodean. La oferta se dispara en una puerta o zona de acceso **fuera
   de la huella**, para no emparedar al jugador.
2. **Elección modal**: fase `building` de `Run` con el patrón de la tienda (0024, ADR-0023). Pausa, panel DOM con
   casa y torre, solo las asequibles, Esc para salir sin construir y re-armado por distancia. Si no hay ninguna
   opción asequible, el solar no se arma. Construir no consume azar.
3. **Balance**: el bot v4 **no construye**, así que `BALANCE_BASELINE` queda idéntico (30/50, 0 quietos). Un lote
   aparte con un bot que construye (v5) debe dar entre 25 y 35 victorias y 0 quietos. Si sale de la banda, se
   recalibra **por la torre** (su arma o su coste), no por el mapa.
4. **Solares**: 6 por semilla en el mapa generado, colocados con un **séptimo flujo de azar `SITE_STREAM` 7**
   después de estructuras, recursos y ovejas, sin tocar ninguna firma dorada (`MAP_GOLDEN`, `STRUCTURE_GOLDEN`,
   `RESOURCE_GOLDEN`, `SHEEP_GOLDEN`, `STONE_GOLDEN`). Van lejos de agua, puentes y castillo, a una distancia
   mínima entre ellos y a **18–35 celdas de ruta** de la puerta del castillo. Los mapas declarados (`open`/`cells`)
   solo tienen los solares que declaren.
5. **Huella ocupada al construir**: los enemigos, recogibles y ovejas que estén en las celdas de la huella se
   recolocan en la celda caminable más cercana, de forma determinista y sin consumir azar.
6. **Oro de la casa**: va directo al contador (`Stockpile`) con `goldBonusPercent`, sin recogible (no ocupa el
   tope `maxGold`).
7. **Proyectiles de las torres**: tienen una reserva propia, con tope en `content/buildings.json`, separada del
   tope 32 del jugador. El jugador nunca pierde disparos por culpa de las torres.
8. **Pausa**: la fase `building` congela la simulación igual que la tienda (no avanzan ticks, reloj ni ingresos).
9. **Huella y acceso** de casa y torre: los decide el design, midiendo las hojas de Knights.

## Base numérica (medición previa, bot v4, semillas 1..50)
- Madera recogida (mediana): 0 a 60 s, 17 a 120 s, 63 a 240 s y 82 a 600 s. Piedra: 3, 9, 19 y 27.
- Oro gastado en la tienda por partida: mediana 135, así que el tope del oro de casas es ≈ 34 por partida (25 %).
- Ruta desde la puerta del castillo: p25 18, p50 27 y p75 35 celdas (5–10 s a pie).
- Costes que se derivan:
  - **Casa: 15 madera** (asequible hacia los 115 s en la mediana).
  - **Torre: 30 madera + 15 piedra** (hacia los 190 s).
- Oro de la casa: **1 oro cada 1.800 ticks (30 s) por casa construida**, con `goldBonusPercent` aplicado igual que al
  resto del oro. Una casa construida hacia los 115 s da ≈ 16 oro, y 2 casas ≈ 32, por debajo del tope de 34.

## Alcance
- **Dentro**:
  - Solares en el mapa generado (6, flujo `SITE_STREAM` 7, restricciones de la decisión 4) y solares declarables en
    los mapas `open`/`cells`.
  - Fase `building` con oferta, `build(kind)` y salida sin construir, re-armado por distancia y `snapshot` del
    estado de los solares en todo momento. Panel DOM con Esc (mismo orden de gates que la tienda).
  - Gasto de madera y piedra en `Stockpile`. Sin recursos suficientes no se ofrece la opción, y si no hay ninguna
    opción el solar no se arma.
  - Celda construida no caminable: colisión del jugador, campo de flujo recalculado (también los campos de los
    `GuardPost`), línea libre, recolocación de apariciones, gemas y ovejas.
  - Recolocación determinista, en la celda caminable más cercana, de lo que esté en la huella al construir.
  - Casa: ingreso periódico de oro (1 cada 1.800 ticks, con `goldBonusPercent`) directo al `Stockpile`.
  - Torre: arma propia con el esquema de `weapons.json` (flecha, rango ≈ 350, daño bajo) disparada desde la torre.
    No hereda las mejoras de arma y solo apunta a enemigos (sin estructuras ni ovejas). Usa una reserva de
    proyectiles propia, con tope en `buildings.json`, separada del tope 32 del jugador. Sus bajas cuentan como las
    demás (XP, oro, piedra y `kills`).
  - Edificios indestructibles: ni las explosiones ni el contacto les hacen daño.
  - Contenido: `content/buildings.json` nuevo validado con zod (costes, oro de la casa, arma de la torre, radios de
    oferta y re-armado). El número de solares (6) y su espaciado van en `map.json` o en la sección propia que elija
    el design. El aspecto va en `appearance.json`.
  - Arte de Knights (Update 010): `House_Construction`, `House_Blue`, `Tower_Construction` y `Tower_Blue`, con
    entrada en `content/asset-provenance.json` y aspecto de reserva si no cargan. Los solares se ven en estado de
    obra y los edificios en estado construido.
  - Sonda E2E `window.__sprint.sites` y recuentos de sprites. El HUD no cambia: solo se añade el panel.
  - Bot v5 que construye, con su lote de balance aparte, y test de conectividad con todos los solares construidos.
- **Fuera**:
  - Destrucción, reparación o mejora de edificios. También su vida y su barra.
  - Colocación libre de edificios (es un Could del GDD) y edificios distintos de casa y torre.
  - Que el bot v4 construya o recalibrar `BALANCE_BASELINE`.
  - Colisión de enemigos entre sí o con el mapa (sigue aplazada desde 0019).
  - Arqueros goblin y barras de vida de las estructuras goblin (0027).
  - Cambios del HUD aparte del panel, guardado de edificios entre partidas y resultados.

## Capacidades afectadas
- `openspec/specs/build-sites` (nueva)
- `openspec/specs/procedural-map` (modificada: solares, celda construida, flujo 7)
- `openspec/specs/run-state` (modificada: fase `building`)
- `openspec/specs/simulation-loop` (modificada: paso de solares, ingreso de casas, disparo de torres)
- `openspec/specs/resources` (modificada: gasto de madera y piedra, oro de casas)
- `openspec/specs/auto-weapons` (modificada: arma con origen fijo en la torre)
- `openspec/specs/enemy-behavior` (modificada: recálculo del campo y rodeo)
- `openspec/specs/player-movement` (modificada: colisión con lo construido)
- `openspec/specs/castle-shop` (modificada: convivencia de gates y fases)
- `openspec/specs/goblin-structures` (modificada si hace falta: campos de guardia con celdas construidas)
- `openspec/specs/sprite-rendering` y `openspec/specs/asset-provenance` (modificadas: 4 PNG nuevos)
- `openspec/specs/hud` (solo si el panel se especifica allí; si no, va en `build-sites`)

## Riesgos y dudas
- **Mapa mutable**: hoy `GameMap` y la copia de `FlowField` son inmutables y la comparten los `GuardPost`. Hay que
  rehacer unos 6 lectores sin romper el determinismo ni las firmas. El cómo es del design.
- **Recolocación al construir**: el empate entre varias celdas igual de cercanas debe tener un orden fijo (lo fija
  el design).
- **Conectividad**: un edificio puede aislar zonas o tapar un acceso. Se cubre con las restricciones de colocación
  y con el test de las 50 semillas con todo construido.
- **Coste por tick**: recálculo del campo (como máximo 6 veces por partida, más los campos de guardia) y 6 torres
  apuntando. Hay que medirlo con el bench.
- **Reserva de proyectiles de las torres**: si el tope es bajo, las 6 torres pierden disparos (no el jugador).
- **Balance del bot v5**: las torres son DPS gratis. La palanca acordada es la torre.
- **Presupuesto de objetos del mapa** (701/784 frente a 1.000): 6 solares suman pocos objetos, pero hay que medirlo.
- **Arte**: los tamaños de hoja de Knights están por medir. Hay que comprobar que `Tower_Construction` de
  caballeros no choca con el veto de `Wood_Tower_InConstruction` goblin.

## Criterio de éxito
- GDD 0026: dado un edificio nuevo, al construirse el campo se recalcula y un enemigo que antes cruzaba esas celdas
  las rodea (test de dominio con celdas y ticks concretos).
- GDD 0026: dado un solar con madera ≥ 30 y piedra < 15, la torre no se ofrece. Con madera < 15 el solar no se arma.
- Construir descuenta exactamente el coste: casa −15 madera; torre −30 madera y −15 piedra.
- Una casa construida suma 1 oro (más el bono) al contador cada 1.800 ticks. Una torre abate enemigos dentro de su
  rango.
- Con las torres disparando y su reserva llena, el jugador conserva su tope de 32 proyectiles.
- Al construir, ningún enemigo, recogible ni oveja queda en una celda de la huella.
- Durante la fase `building` no avanza ningún tick.
- Firmas doradas intactas: `MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`, `SHEEP_GOLDEN` y `STONE_GOLDEN`.
  `SITE_GOLDEN` es nueva.
- Las 50 semillas tienen exactamente 6 solares a 18–35 celdas de ruta de la puerta del castillo.
- Conectividad: 0 zonas caminables aisladas en las semillas 1..50 con los 6 solares construidos.
- Balance: `BALANCE_BASELINE` idéntico con el bot v4 (30/50, 0 quietos). Lote con el bot v5: entre 25 y 35
  victorias y 0 quietos.
- Bench de `Run.tick` con 300 enemigos, 6 edificios y 6 torres: coste añadido < 0,5 ms por tick.
- Objetos del mapa ≤ 1.000 en las semillas 42 y 123.
- `npm run verify` y `npm run test:e2e` en verde, con como mucho 1–2 E2E nuevos (regla `e2e-lite`), en modo manual.
