# Exploración 0026 · build-sites

Intención: solares de obra en el mapa generado; al pasar con recursos suficientes se elige casa (madera) o torre
de caballeros (madera + piedra) con pausa; la casa da oro cada X s, la torre dispara flechas; indestructibles; si
bloquean, el campo de flujo se recalcula (criterio movido desde 0019).

## Contexto actual (rutas del worktree)
- `Run` (`src/domain/run/Run.ts`): fases `running|choosing|shopping|over` (`RunPhase.ts`); `shopping` es el patrón
  a copiar: paso 11 (`CastleGate.step`) abre la fase, `buy`/`leaveShop` sin azar, re-armado por distancia
  (`content/shop.json`), `snapshot.shop` siempre presente, DOM `ShopPanel` + `ShopGate` (`phaser/ShopGate.ts`).
- Recursos: `Stockpile` (oro, madera, piedra; solo `spend` baja el oro; madera y piedra **no tienen gasto aún**).
  Fuentes de madera: montones (8 × 3) y barril (1). Piedra: tirada por baja (0025).
- Mapa **inmutable**: `GameMap` congelado con `Uint8Array` privada; `FlowField` copia los códigos al construirse
  (`codesOf`) y calcula `blocked` una vez; esa copia se comparte con los campos de los `GuardPost` (ADR-0020);
  `hasClearLine`, `overlapsBlocked`, barrido del jugador, `placeSpawn`, `nearestWalkable` y ovejas leen
  `GameMap.isWalkable`. `MapSnapshot` se construye una vez y no cambia.
- Estructuras goblin (`placeStructures`, `StructureField`): no bloquean, destructibles, huella 2 × 3, flujo propio
  `STRUCT_STREAM` 3, 2 valores por intento. Casas con puerta, guardias.
- Armas: `Arsenal.step` dispara **desde el jugador** (`px, py`); `Projectile` con pool (`maxProjectiles` 32) y
  `tier` 0..2. `WeaponType` validado desde `content/weapons.json` (puntería `nearest-in-range`).
- Flujos: `MAP 1, DECOR 2 (solo render), STRUCT 3, RESOURCE 4, SHEEP 5, STONE 6` (`infrastructure/random/deriveSeed.ts`,
  `composition/seedSource.ts`). Firmas: `MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`, `SHEEP_GOLDEN`,
  `STONE_GOLDEN`, `BALANCE_BASELINE` (30/50, 0 quietos; partida 36.000 ticks).
- Arte: pack local `C:\Users\Adri\TFM\Tiny Swords (Update 010)\Factions\Knights\Buildings\`: `House/House_Construction.png`,
  `House/House_Blue.png`, `Tower/Tower_Construction.png`, `Tower/Tower_Blue.png` (+ `_Destroyed`, innecesarios) y
  `Castle_Construction`. Ninguno está en el repo ni en `content/asset-provenance.json` (30 entradas, solo Update 010).
  El guardarraíl (`guard-assets.mjs`) exige entrada con sha256/bytes por fichero. Los tests solo vetan
  `Wood_Tower_InConstruction` (goblin) y `Fire`; `Tower_Construction` de caballeros no choca. Tamaños de hoja: por medir.
- Presupuesto de objetos del mapa: 701/784 (semillas 42/123) frente a tope 1.000; culling de 0018 en `MapCuller`.

## Specs vivas afectadas (`openspec/specs/`)
`procedural-map` (solares, celda construida, `door`/huella), `simulation-loop` (paso nuevo y fase), `run-state`
(nueva fase), `resources` (gasto de madera y piedra; ingreso de oro de casas), `auto-weapons` (arma con origen
fijo), `enemy-behavior` (recálculo del campo, línea libre), `player-movement` (colisión con lo construido),
`hud` (aviso/estado), `sprite-rendering` y `asset-provenance` (4 PNG nuevos), `goblin-structures` (convivencia),
`castle-shop` (patrón de pausa). Nueva: `build-sites`.

## Opciones
**A. Elección modal tipo tienda (fase `building`).** Solar armado + jugador a < radio + algo asequible ⇒ pausa con
panel DOM (1/2, Esc sale); `Run.build(kind)` / `declineBuild()`; re-armado por distancia. Pros: copia ADR-0023, test
sin azar, fácil de sondear. Contras: otra fase en `RunPhase`, snapshot, `advanceFrame`, `PauseGate`, `playerBlink`.
**B. Construcción inmediata sin pausa** (la opción más cara asequible, o casa por defecto). Pros: sin fase ni UI.
Contras: incumple "se elige" del GDD; el jugador no controla el gasto.
**C. Híbrida:** si solo es asequible una opción, se construye al pasar (sin pausa); con dos, modal. Pros: menos
interrupciones. Contras: dos caminos que especificar y probar.

Bloqueo (ortogonal): **1.** el edificio bloquea (celda `building`, no caminable) para jugador y enemigos vía capa
mutable `buildings` sobre `GameMap` (o `GameMap.withBlocked` + `FlowField.invalidate`; además guardias y
`MapSnapshot`): cumple el criterio del GDD; coste: rompe la inmutabilidad, toca ~6 lectores. **2.** No bloquea
(como las estructuras goblin): trivial, pero el criterio "los enemigos lo rodean" se descarta. **3.** Bloquea solo
a enemigos: asimetría que no existe hoy (solo el jugador colisiona).

## Riesgos e incógnitas
- Construir sobre el jugador o un enemigo: disparar al salir del radio y exigir la puerta fuera de la huella; qué
  pasa con enemigos dentro (BFS con distancia −1 usa línea recta; aceptable o recolocar con `nearestWalkable`).
- Conectividad: un bloque puede aislar zonas o un puente; hay que colocar solares lejos de agua/puentes/castillo y
  comprobar conectividad con y sin todos construidos (`connectivity.ts`).
- Azar: los solares no deben alterar ninguna firma: flujo nuevo `SITE_STREAM` 7 y colocarlos **después** de
  estructuras, recursos y ovejas (evitando sus celdas). Construir no consume azar (todo determinista por tick).
- Torre: pool de proyectiles compartido (tope 32) y su aportación al balance (DPS de torres ≈ nuevo daño gratis);
  tier 0 solo (enemigos); bajas de torre deben pasar por `horde.removeDead`.
- Coste de `FlowField`: recalcular una vez por edificio (máx. N) más los campos de guardia; hoy 0,27 ms/tick de
  bench de tres topes: medir.
- `blocked` del `FlowField` cacheado: hoy un mapa sin bloqueos es "persecución recta"; con construcciones debe ser
  dinámico.
- Recursos sin sumidero previo: balance cambia solo si el bot construye.

## Mediciones previas (las lanza el orquestador antes de la propuesta)
1. Madera, piedra y oro acumulados por el bot v4 en las semillas 1..50 a los 60, 120, 240 y 600 s (mediana y
   mínimo): fija costes (objetivo: ≥ 1 casa hacia el minuto 2 y torre hacia el minuto 4 en la mediana, sin
   sobrar > 3 edificios) y el oro por casa (oro de tienda por partida hoy como referencia, no inflarlo > 25 %).
2. Longitud de recorrido: cuántos solares (N=3..6) quedan a ≤ 30 s de ruta del castillo con el generador actual.
3. Bench de `Run.tick` con 300 enemigos, 6 edificios bloqueantes y 6 torres: umbral < 0,5 ms/tick de coste añadido.
4. Conectividad de las 50 semillas con todos los solares construidos: 0 componentes aisladas.
5. Si el bot construye: lote 1..50 (~35 s) con umbral 25–35 victorias y 0 quietos (invariante de 180 s);
   `BALANCE_BASELINE` idéntico con el bot actual (sin construir).

## Preguntas para el usuario
Ver decisiones abiertas en el resumen del orquestador (nº y colocación de solares; bloqueo; costes; oro de la
casa; torre y su arma; fase o inmediata; flujo de azar; ficheros de contenido; bot y balance).
