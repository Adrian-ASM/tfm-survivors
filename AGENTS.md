# AGENTS.md

> Contexto maestro para cualquier agente de IA (Claude Code, Copilot, Codex…).
> Es un **índice**: corto, con reglas no negociables y punteros. El detalle vive en skills, specs y ADRs
> y se carga solo cuando hace falta (*lazy loading*).

## 1. Visión general

**Greentide Vanguard** (antes *Sprint Survivors*): juego 2D *survivors-like* para navegador (TFM del Máster de Desarrollo con IA).
El jugador solo se mueve; las armas disparan solas; las oleadas crecen; al subir de nivel se elige 1 de 3 mejoras.

- **Stack**: TypeScript estricto · Vite · **Phaser 4.2.1** (ADR-0001) · Vitest · Playwright · zod.
- **Arquitectura**: Clean Architecture. El **núcleo de simulación es puro y determinista** (`src/domain`, `src/application`);
  el motor de juego es un **adaptador** (`src/infrastructure`). Ver `docs/adr/0002-nucleo-de-simulacion-puro.md`.
- **Estado del proyecto**: bucle de partida completo (changes 0001–0007: movimiento, oleadas, daño, armas,
  XP y mejoras, victoria/derrota, HUD y reinicio, guardado local de récords e historial con export/import JSON y
  CSP estricta). Los E2E aceleran la simulación con `?e2e&speed=N` (1..15, solo en el adaptador; change 0008).
  Menú de inicio (Jugar, Exportar, Importar, Borrar datos con confirmación propia), pausa con Esc y Volver al menú
  (change 0009, ADR-0011). `?e2e` salta el menú **solo al cargar**; Volver al menú sí lo muestra.
  Balance calibrado con el bot de referencia de `tests/support/` sobre las semillas 1..50 (entre 25 y 35
  victorias) e invariante "quieto pierde antes de 180 s" con todas ellas (change 0010).
  Publicado en `https://adrian-asm.github.io/tfm-survivors/` (job `deploy` de `ci.yml` tras `quality` y `e2e` en
  push a `main`); smoke remoto **a demanda**, nunca en push ni PR (change 0011). Backlog Must completo.
  Arte CC0 de Tiny Swords Update 010 (change 0012, ADR-0012): sprites animados del arquero y tres goblins
  (`goblin-torch`, `goblin-tnt`, `goblin-barrel`), cadáveres, flechas, gemas y suelo, con datos en
  `content/appearance.json` y aspecto de reserva si una hoja no carga. Guardarraíl de procedencia
  (`.claude/hooks/guard-assets.mjs` sobre `git ls-files`, nota en `content/asset-provenance.json`): ningún asset
  gráfico sin entrada ni nada del Free Pack. Sonda E2E `window.__sprint.sprites` con recuentos por tipo.
  Mundo de 1.920 × 1.080 con vista de 960 × 540 (change 0013, `content/arena.json`; zod exige mundo ≥ vista):
  cámara que sigue al jugador sin suavizado y recortada al mundo (`CameraRig`), suelo del tamaño del mundo, HUD y
  overlays fijos (`scrollFactor` 0). Sonda E2E con `camera` (rectángulo visible en mundo, null en el menú) y `world`.
  Textos medievales de las mejoras (solo `name`/`description`; ids sin cambios). Balance con el mundo 2x: **25/50**
  victorias, en el límite inferior de la banda, y 0 quietos; plazos de primera subida y pulso quieto a 4.800 ticks.
  Los tests leen el mundo de `content/` (`aDefaultConfig`, bot `referenceBot(config)`); `SCENARIO_ARENA` es solo
  geometría de escenario.
  Avance manual en E2E (change 0014): con `?e2e&manual` la simulación no avanza por reloj y los tests mandan ticks
  exactos con `window.__sprint.step(n)` (gana a `speed`). Playwright tiene dos proyectos: `logic` (suite de
  humo, ~12 tests, uno por flujo, en manual y sin esperas de reloj; lo vigila `tests/support/logicGuard.ts`; es
  lo único que corre `test:e2e` y el CI) y `realtime` (etiqueta `@realtime`: calibración de fps y `speed`; solo a
  demanda, fuera del CI; chore `e2e-lite`).
  Mapa procedural (change 0015, ADR-0013): rejilla de 32 × 18 celdas de 60 px (`content/map.json`) con troncos,
  un río con puentes y zona de inicio libre, generada por semilla con un flujo de azar propio
  (`seededRun`: oleadas con `Mulberry32(seed)`, mapa con `deriveSeed(seed, MAP_STREAM)`). Solo el jugador
  colisiona (barrido por ejes); las gemas que caen en celdas bloqueadas se recolocan; los enemigos lo ignoran.
  Se pinta con un rectángulo por tramo de celdas no-hierba, con colores de `appearance.json` (`terrain`); nunca
  una capa a pantalla completa (partía los fps en CI sin GPU). `player.speed` 210 (gate de balance: 29/50 con el
  bot v2, que esquiva troncos y agua). E2E: `gameUrl` añade `map=empty` por defecto
  (`map: 'real'` para los del mapa); sonda `window.__sprint.map` y `sprites.cells`; firma dorada en
  `tests/support/mapGolden.ts`.
  Arte del mapa y castillo (change 0016): celda `castle` (código 4, no caminable) con huella fija por contenido
  (`map.json` `castle` 5 × 4, columnas 14–18 × filas 6–9) solo en el mapa generado; la **salida es de cada mapa**
  (puerta del castillo, (990, 630); centro del mundo en `open`/`cells` salvo salida declarada) y la zona de inicio
  se centra en ella. Arte de Update 010 (agua, espuma animada, orillas por autotile de 4 vecinos sobre
  `Tilemap_Flat`, árboles con variedad por `DECOR_STREAM`, puentes orientados, `Castle_Blue`) planificado sin
  motor (`src/infrastructure/phaser/map/planMapArt.ts`) y pintado en dos `Layer`: la baja bajo las entidades y la
  alta (copas y tejado) sobre ellas y bajo el HUD; reserva de colores por elemento. Sonda `sprites.mapArt`
  (`painted`/`fallback` por elemento y `objects`), `sprites.cells.castle` y `map.castle`. `player.speed` 215:
  **27/50** victorias y 0 quietos; ≤ 300 objetos del mapa en 42 y 123 (test sin navegador en `verify`).
  Vista a ventana completa (change 0017, ADR-0014/0015/0016): lienzo `Scale.RESIZE` en `#game` con tope
  `arena.maxView` 2.560 × 1.440 (`scaleConfig`, `min`/`snap` 1 × 1, centrado por CSS) y zoom 1; el tope no llega
  al núcleo (`parseContent` → `{ config, maxView }`, `View` borrada). Mundo **3.840 × 2.160** (rejilla 64 × 36,
  castillo 30–34 × 15–18, salida (1.950, 1.170)). Anillo de aparición de contenido `waves.spawn.ringRadius` 1.500
  (zod exige > media diagonal del tope). Tabla de oleadas 1,2/2,4/2,4/3,0/4,2: **25/50** victorias, 0 quietos,
  primera oferta (s7) en el tick 1.527; ≤ 1.000 objetos del mapa. HUD y cartas con layout puro
  (`ScreenFrame`, escala de UI ×1/×2, `hudLayout`/`cardLayout`) recolocados por `watchScreen` en cada RESIZE;
  menú (título en `h1`), pausa, diálogo y resultados (5 líneas DOM) centrados y escalados con `--ui-scale`.
  Sonda E2E `window.__sprint.viewport` (ventana y `uiScale`, también en el menú); Playwright a 1.280 × 720.
  Recorte del arte del mapa por cámara (change 0018): en cada frame, cada caja del plan (`bounds`) se compara con
  la vista del frame que se va a pintar (`rig.nextView()`, sin el desfase de `worldView`) más 1 celda
  (`CULL_MARGIN_CELLS`); `MapCuller` solo llama a `setVisible` donde cambia el estado. Solo infraestructura.
  Sonda `sprites.mapArt.drawn` (0 en el menú; totales sin cambios): 106/667 y 67/750 en 42 y 123. Los tres E2E del
  mapa real conservan `test.slow()` (38,5 / 27,8 / 42,1 s en CI).
  Navegación por campo de flujo (change 0019, ADR-0017): `FlowField` (dominio, propiedad de `Run`) con BFS de
  4 vecinos desde la celda del jugador, perezosa y recalculada solo al cambiar de celda; orden de vecinos y
  empates fijos (parte del determinismo). Línea libre: persecución recta si el segmento entre centros solo cruza
  celdas caminables (en esquinas exactas, ambas laterales); si no, al centro del vecino con distancia − 1. Con
  mapa sin bloqueos la persecución es la de siempre. Las apariciones en celda bloqueada se recolocan en la
  caminable más cercana (1 valor de azar por intento). `waves.maxAlive` 300. Sin separación ni colisión de
  enemigos con el mapa (aplazadas). Balance recalibrado **solo con la curva de XP** (`baseXp` 9, `xpGrowth` 3;
  oleadas y `player.speed` intactos): **26/50** victorias y 0 quietos. Los tests con cifras de XP usan la curva
  de escenario 5/5 (`SCENARIO_PROGRESSION`, `withScenarioCurve`). GDD renumerado: Should 0020–0024.
  Comportamientos de enemigos, parte A (change 0020, ADR-0019): cada tipo declara en `enemies.json` un
  `behavior` con estados de clase cerrada (`chase` con salida por distancia, `fuse`, `charge`, `wait`) y los
  globales `hazards` (`maxDynamites` 24, `dynamiteRadius`, `blastTicks`); `damage` de contacto opcional (el barril
  no tiene). Barril kamikaze (mecha de 40 con aviso, explosión 64/25) y TNT artillero (carga a 100 px, dinamita con
  aviso en el objetivo, espera). `HazardField` en el núcleo: tick con armas → explosiones → segundo `removeDead` →
  lanzamientos → golpe único `max(contacto, explosión)`; fuego amigo, sin cadenas ni azar. Snapshot con
  `state`/`stateKind`, `dynamites`, `warnings` y `blasts`; capa de peligros sobre la capa alta del mapa (un
  `Graphics` y pools) y sonda `warnings`/`dynamites`/`explosions`/`enemyStates`. Arte `Dynamite.png` y
  `Explosions.png` (Update 010). Bot v3 (esquiva avisos) y balance **27/50**, 0 quietos, con curva **9/4**.
  Campamentos goblin (change 0021, ADR-0020): 4 casas y 3 torres por mapa generado (`content/structures.json`,
  huella 2 × 3, vida 60/90) colocadas con un tercer flujo de azar (`STRUCT_STREAM` 3), sin tocar las celdas
  (`MAP_GOLDEN` intacta; `STRUCTURE_GOLDEN` nueva). No bloquean; las armas las apuntan solo sin enemigos en su
  criterio y quedan en ruina al destruirse. Cada casa genera `goblin-tnt-guard` (tope 2, cada 900 ticks) con
  `patrol`/`alert`/`return` en torno a su puerta (`GuardPost`, campos fijos por punto). Barril A3 (activación 60,
  vida 25, radio 80). Arte `Goblin_House`, `Wood_Tower_Red` y sus ruinas (2 aspectos con máscara en el plan, ≤ 4
  objetos por estructura: 695/778 objetos en 42/123). Sonda `sprites.structures`, `map.structures` y
  `snapshot.structures`. Balance sin recalibrar: **27/50**, 0 quietos, **26,9 mechas** y 14,6 explosiones de barril
  por partida (base 16,3/6,6; test "Mechas por partida"), lote ~30 s local; bot v3.
  Recursos (change 0022, ADR-0021): todo lo que se recoge es un **recogible** `xp | gold | wood` en una sola lista
  (orden de creación, una secuencia de ids) con **tope por tipo** (`maxGems` 300, `maxGold` 32, `maxWood` 64 en
  `progression.json`; el relleno suma al más antiguo de su tipo), así que la XP no cambia. Oro y madera son contadores
  de la partida (`Stockpile`, no se guardan ni salen en resultados). Fuentes en `content/resources.json`: madera del
  barril abatido (no del que explota por su mecha, `Enemy.detonated`), oro de casas y torres al quedar en ruina,
  montones de madera (recogibles `wood` desde el tick 0, ids 0..N−1) y vetas de oro "al pasar" (paso 7.2, una vez).
  Montones y vetas los coloca un cuarto flujo `RESOURCE_STREAM` 4 por celdas candidatas (1 valor por recurso;
  `RESOURCE_GOLDEN`; `MAP_GOLDEN` y `STRUCTURE_GOLDEN` intactas). Snapshot con `pickups`, `resources`, `veins` y
  `gems` como vista de los `xp`. Render: `PickupLayer` (un pool de Σ topes, la gema como forma de color), vetas
  `GoldMine_Active/Inactive` en el plan del mapa con el recorte de 0018 y HUD con icono y número de oro y madera.
  Sondas `sprites.pickups`/`veins`, `map.veins`/`woodPiles` y `hud`. Balance **idéntico** a la línea base M0 semilla a
  semilla (`tests/support/balanceBaseline.ts`, 27/50, 26,88 mechas, 0 quietos) y huella del contenido de combate;
  M1: bench tres topes 0,27 ms, lote 28–32 s local; M2: 701/784 objetos del mapa en 42/123.
  Ovejas y carne (change 0023, ADR-0022): entidad neutral `Sheep` en un `Flock` propiedad de `Run`, fuera de
  `Horde`, del director y de `kills` (`content/sheep.json`, tope 5 en el mapa generado; los mapas declarados
  solo tienen las suyas). Paso 1, tras el jugador: huida estricta en recta (radio 200) o pasto/paseo con vuelta al
  origen, con el barrido por ejes del jugador. Las armas las apuntan como **tercer nivel** (enemigos → estructuras
  → ovejas; `Projectile.tier`) y las explosiones las dañan. Al morir (pasos 3.5 y 4.2) sueltan un recogible `meat`
  (cuarto tipo, `maxMeat` 8) que cura `valor × max(1, ⌊healPercent × máx / 100⌋)` (`resources.meat`, 20 %) y
  reaparecen en 9.2 tras `respawn.everyTicks` en otra celda a ≥ `minPlayerDistance`. Todo su azar sale de un quinto
  flujo `SHEEP_STREAM` 5 en orden fijo (colocación, primer pasto, paseos, reapariciones); `SHEEP_GOLDEN` nueva y las
  demás firmas intactas. Arte `HappySheep_Idle` + `HappySheep_Bouncing` (una hoja por animación) y `M_Idle`;
  sonda `sprites.sheep` (visibles, reserva y por estado) y `sprites.pickups.meat`. Balance M1 sin recalibrar:
  **28/50** con ovejas, **27/50** idéntico a la base con tope 0 (segundo lote del bot en `verify`) y 0 quietos.
  Escenarios con la oveja de prueba: `TEST_SHEEP`, `withSheep`, `declaredSheep` y `aSheepConfig`
  (`tests/support/sheep.ts`); `aRunConfig` lleva tope 0.
  Progresión separada y tienda del castillo (change 0024, ADR-0023): `upgrades.json` con dos catálogos en un solo
  vector de niveles, `character` (9, oferta 1 de 3 por XP; 6 stats nuevos de base 0: `regeneration`, `armor` con
  daño mínimo 1, `invulnerabilityTicks`, `xpBonusPercent`, `goldBonusPercent` y `meatHealPercent` con cota de la
  carne en [1, 100]) y `weapons` (6, solo en la tienda, `prices` por nivel). Subida sin mejoras disponibles: cura
  `levelUpHealPercent` (progression.json). Oro por baja por tipo (`resources.drops.goldPerKill`, tabla completa en
  el fichero; opcional en el dominio = 0), casas 15 y torres 25. Tienda = fase `shopping` de `Run`: paso 11 con la
  puerta (salida del castillo en el generado; `door` declarable en `open`/`cells`; `content/shop.json` radio 40 y
  re-armado 160), `Run.buy(id)`/`leaveShop()` sin azar (`BuyFromShop`, `LeaveShop`), `snapshot.shop` en todo
  estado. Overlay DOM `ShopPanel` + `ShopGate` antes de la pausa (Esc sale sin pausar); sonda `__sprint.shop` y
  `screens`. Escenarios: `aRunConfig` sin oro por baja (`withGoldPerKill`, `withExtraTypes`), política de tienda
  fija dentro de `chooseWhileOpen`, puerta de escenario en `tests/support/shop.ts`. Bot v4 (va a la puerta con un
  `FlowField`, cura bajo 0,5 y compra por `REFERENCE_SHOP_ORDER`): **30/50**, 0 quietos, línea base M2 en
  `balanceBaseline.ts` (un solo lote, ~35 s local).
  Piedra (change 0025, ADR-0024): quinto recogible `stone` (valor 1, tope `maxStone` 32, pool de 436) con
  **origen** (`source`, el tipo que la soltó; solo en piedras). Toda baja consume **1 valor** de un sexto flujo
  `STONE_STREAM` 6 que viaja en `RunSeeding.stoneRandom` (existe también con `map=empty`) y suelta si está abatida y
  `⌊u × 100⌋ < p` (`resources.drops.stoneChance`: torch 10, tnt 15, barril 5, guardia 25), tras su madera y su
  oro. `Stockpile.stone` sin bonificación; `snapshot.resources.stone`, HUD (tercera fila, `stoneY` 70) y sondas
  `hud.stone`/`sprites.pickups.stone`. Roca por tipo en `appearance.json` (`rock`: `Deco/04`–`06`, 64 × 64, un
  frame; reserva `medium`). Sin `stoneRandom` (`Run.start` de los escenarios) no hay piedra ni consumo.
  `STONE_GOLDEN` nueva; balance **idéntico** a `BALANCE_BASELINE` (30/50, 0 quietos) sin regenerarla.
  Solares de obra (change 0026, ADR-0025): `GameMap` separa el terreno inmutable (`typeAt`, vista y firmas) de una
  **capa de obra** (`BUILT` 5, `build`, `revision`); `isWalkable`, barridos y `nearestWalkable` leen la capa viva y
  `FlowField` (también los de `GuardPost`) se invalida al cambiar la revisión. 6 solares por mapa generado
  (`content/buildings.json`, huella 2 × 2, acceso a 1,5 celdas bajo la huella, radio 40 / re-armado 160) colocados
  con un séptimo flujo `SITE_STREAM` 7 (1 valor por solar, ruta 18–35 hasta la puerta; `SITE_GOLDEN` nueva, demás
  firmas intactas); `sites` declarables en `open`/`cells`. Fase `building` (paso 12 tras la tienda, armados al
  empezar, solo abre si algo es asequible): `Run.build(kind)`/`leaveSite()` sin azar (`BuildOnSite`, `LeaveSite`),
  `Stockpile.spendMaterials`, despeje de la huella (enemigos, recogibles, ovejas y su origen, puestos de guardia).
  Casa 15 madera, paga 1 oro cada 1.800 ticks (paso 7.4, ingreso con bonificación); torre 30 madera + 15 piedra,
  `TowerBattery` con reserva propia de 16 flechas (ids propios, solo enemigos, sin mejoras; `Arsenal` partido en
  `advance` + `fireAll`). Snapshot `sites`, `build` y `towerProjectiles`; `RunSetup.sites` para escenarios
  preparados. Render: `planMapArt.sites` (obra común `House_Construction`, `House_Blue`, `Tower_Blue`), `SiteArt`,
  segunda `ProjectileLayer`, `BuildPanel` + `BuildGate` (Shop → Build → Pause); sondas `__sprint.sites`, `map.sites`,
  `sprites.sites`/`towerArrows` y pantalla `build`. Bot v4 sale de la obra: `BALANCE_BASELINE` idéntica; bot v5
  (`builderBot`, torre si es asequible y si no casa) **29/50**; 737/820 objetos del mapa en 42/123.
  Oferta por contacto (change 0027, ADR-0026): sin punto de acceso. El solar libre es **celda de obra** (`BUILT` 5
  en la capa viva, marcado en `Run.start` sin azar) y bloquea a jugador, enemigos (`FlowField`) y `GuardPost` desde
  el tick 0; construir no cambia la caminabilidad (huellas iguales). Tocar = separación g (distancia del centro del
  jugador a la huella − radio) ≤ `CONTACT_EPS` 1 px; re-armado con g ≥ `contact.rearmDistance` 64
  (`buildings.json`). La oferta se abre **siempre** al tocar uno armado, con casa y torre (`affordable`, `missing`);
  `Run.build` rechaza lo no asequible. `MAP_SITE_OVERLAPS_PLAYER` (`map.sites.<i>`); oveja declarada sobre una
  huella es error. `BuildPanel` con iconos del HUD (`resourceIcons`: `W_Idle`, `Deco/05`), coste 0 omitido y «faltan
  N». Solo cambia `STONE_GOLDEN`; `BALANCE_BASELINE` regenerada (v4 **34/50**), `BUILDER_REFERENCE` 34/50, 0
  quietos. Lotes en CI 52 s (v4) y 89 s (v5, timeout propio 300 s por el invariante por tick).
  Guía «Cómo jugar» (change 0028): 5.º botón del menú en la 2.ª posición; modal DOM `GuideModal` de 7 páginas de
  `content/guide.json` (zod, ids fijos en orden, sin dígitos) con 14 marcadores `{clave}` que se interpolan al
  arrancar desde la `RunConfig` (`parseGuide`, el último paso de `bootContent`; error por `showContentError`).
  Anterior/Siguiente/Cerrar, Esc y flechas con un `keydown` en `document` solo mientras está abierto, foco en el
  recuadro y de vuelta en «Cómo jugar»; estado `guide` de `MenuController` bloquea el resto. Iconos de los cinco
  recursos (`ResourceIcons`; gema como SVG `data:` de su color). Sin núcleo ni sonda; balance intacto.
  Mapa vivo (change 0029, solo render y datos de aspecto): decoración no bloqueante del mapa generado
  (`appearance.json` `map.decor`: 11 hojas `Deco/01`–`03`, `07`–`11`, `16`–`18`, densidad 25, tope 120 objetos,
  margen del castillo 1; altas 16–18 partidas en base y parte alta) colocada en `map/decorChoices.ts` por hash de
  `decorSeed` y de la celda (sales `DECOR_PLACE_KEY`/`DECOR_KIND_KEY`, sin PRNG): hierba fuera de inicio, castillo
  ampliado, solares, campamentos, orilla y recursos; huella de base 1 celda (3 × 1 el espantapájaros). Árbol con
  `idle` 0–3 a 4 fps y fase `h mod n` por celda; torre goblin intacta `idle` 0–3 a 5 fps con fase por estructura
  (`TOWER_PHASE_KEY`). `MapArtPlan.animations` + `MapAnimator` (`setFrame` solo a lo dibujado, cebado al
  reaparecer) con el `AnimClock` de la espuma. Sonda `sprites.mapArt.decor` (`planned`/`painted`/`unpainted`).
  Objetos del mapa **820/904** en 42/123 (737/820 con tope 0), `drawn` 119/90 a 1.280 × 720 al empezar. Firmas y
  balance intactos.
  Recogibles visibles (change 0030, solo render y datos de aspecto): oro, madera y carne a escala 0,5 (64 px),
  rocas 0,75 y gema `shape` de 20 px (`diameter`; `gemRadius` y `pickupRadius` intactos). Flote
  d = A·sen(2π(R + id·s)/T) con el reloj de render (`pickupMotion`: A 4, T 1.600, s 989); la reserva no flota.
  Oro, madera y carne reproducen una vez por id su `spawn` opcional (`G_Spawn`/`W_Spawn`/`M_Spawn` de Update 010,
  7 frames a 10 fps, el 0 es un destello blanco) y después flotan desde R_f sin salto; los del primer pintado
  (montones) esperan invisibles id × e (`spawnStaggerMs` 120), también tras R. Si falla una hoja de aparición se
  pinta `idle` sin reserva. Funciones puras en `art/pickupMotion.ts`; sonda `sprites.pickupSpawns`. Firmas,
  `BALANCE_BASELINE` y 820/904 objetos del mapa intactos. Zoom de cámara por ventana: fuera (candidato propio).
  Números de daño y barras de vida (change 0031, ADR-0027): `HitLog` (dominio, propiedad de `Run`) por el que
  pasa todo el daño de `Arsenal`, `TowerBattery` y `HazardField` (`strike`) y el golpe del paso 5
  (`recordPlayer`); anota el **daño aplicado** (vida antes − después) sumado por objetivo y tick (búsqueda por
  referencia en un `Map` del tick), con ids propios desde 0 y tope `maxHitsPerTick` de no jugador (el del jugador
  aparte). `content/combat.json` (ventana 15 ≥ `MAX_TICKS_PER_FRAME`, tope 48); `WeaponTarget` gana `id`/`hp`.
  Snapshot `hits` (ticks k − N + 1 … k, vistas congeladas y lista cacheada por (tick, siguiente id)) y
  `StructureSnapshot.maxHealth` (= vida del tipo). Render en la capa 9, tras los peligros y bajo el HUD:
  `HealthBarLayer` (un `Graphics`, redibujo solo si cambia la vida o la ruina, relleno sin redondeo) y
  `DamageNumberLayer` (pool en anillo de 48 `Text` con tinte por clase, deduplicación por id, pose lineal con el
  reloj del frame); aspecto en `appearance.json` `combat` (colores distintos, `player` rojo). Sondas
  `sprites.damageNumbers` (por clase y `created`) y `sprites.healthBars`, a 0 en el menú. Escenarios:
  `tests/support/combat.ts` (enemigos quietos, salto del jugador) y `feedback.ts` (dobles de `Text`/`Graphics`).
  Balance y seis firmas idénticos; 820/904 objetos del mapa.
  Kit de UI (change 0032, ADR-0028): 8 piezas de `Tiny Swords (Update 010)/UI/` (`Carved_9Slides`, botones azul,
  hover, pulsado, desactivado, rojo y rojo pulsado, `Ribbon_Yellow_3Slides`) en `appearance.json` `ui` (8 roles
  cerrados, márgenes medidos: `panel` 16, botones 20/20/28/20, cabecera 48/48 y alto 64; contraste ≥ 4,5 de
  `text`/`muted`/`accent`; `danger` roja solo en `panel` y `buttonDisabled`) y fuente Departure Mono 1.500 (OFL 1.1,
  `public/assets/fonts/` con `OFL.txt`, lista `fonts[]` de la nota; `guard-assets` vigila `.woff2/.woff/.ttf/.otf`).
  `parseAppearance` recibe una sola lista de rutas registradas (`registeredPaths`: `files[]` + `fonts[]`). DOM:
  `uiKitVariables`/`applyUiKit` publican en `#game` relleno, tintas y familia siempre e imagen y márgenes solo de las
  piezas cargadas; `styles.css` viste los 7 paneles con `border-image` (estados por `--ui-b-*`, `Confirmar` rojo,
  cabecera 3-slice) sin URL ni cambios de DOM; tienda con lista desplazable. Fuente con `FontFace` y plazo
  `FONT_WAIT_MS` 3.000 (`BootScene` espera la fuente o el plazo y aplica `NEAREST` a las piezas). Phaser: un
  `NineSlice` de `button` por carta (zona de clic = `Rectangle` transparente) y 3 de `panel` en el HUD (`hudPanels`
  con textos de reserva), solo con WebGL y textura; reserva con el aspecto de antes. HUD desplazado (margen 24,
  filas 28/46/64/82) y `MONO_CHAR_RATIO` 0,64. Sin núcleo ni sonda; balance, firmas y 820/904 intactos.
  Modo móvil (change 0033, ADR-0029): se decide **una vez al cargar** (`resolveMobile`: `?mobile=1|0` gana,
  otro valor avisa, `?e2e` solo apaga la autodetección, si no `(pointer: coarse)`). Solo en móvil, `Scale.EXPAND`
  sobre `arena.mobile` (base 960 × 640, tope `maxView`; zod con reglas cruzadas, fuera de la `RunConfig`), HUD y
  cartas con k fraccionario (`mobileFrameRule`: k = min(k_max, max(1, k_min)), texto ≥ `minTextPx` 12 px CSS),
  `--ui-scale` 1, clase `is-mobile` (reglas CSS táctiles, safe areas, paneles desplazables) y `activePointers` 2.
  Joystick flotante en la mitad izquierda (`TouchJoystick`, px CSS, R 44 y zona muerta 0,15) con indicación en
  reposo, teclado con precedencia; barra DOM ⏸ ↻ ⛶ (⏸ = Esc, ↻ = R, ⛶ best effort) y aviso «Gira el móvil» como
  **retención** de `PauseGate` (`hold`/`halted`: 0 ticks, `step(n)` devuelve 0, el teclado conserva Esc/R/1–3).
  Sin modo móvil, la escena y la página son las de siempre. Sondas `viewport.mobile`/`domScale`/`displayScale`/
  `hint`; 2 E2E nuevos en `gameplay.spec` (móvil táctil por CDP y escritorio 600 × 900). Balance y firmas intactos.
  Iconos de mejora (change 0034, ADR-0030): un PNG de 64 × 64 por mejora (15) y por la curación, más las reservas
  `fallback-character` y `fallback-weapon` (la curación usa la de arma), en `public/assets/icons/` y ligados por id en
  `appearance.json` `icons` (`fallback` obligatorio, `byId`; obligatoria; el arranque cruza los ids con
  `upgrades.json` y `heal`: `ICON_UNKNOWN_ID`). Son la **única imagen IA** del juego: pixel art de Claude Code
  dibujado por un script determinista sin dependencias (`scripts/icons/draw-icons.mjs`, rejilla 32 × 32, reproduce
  los PNG byte a byte), con lista aparte `generated[]` en la nota (herramienta, fecha, términos, prompt,
  `postProcess` = el script, sha256/bytes) y `generatedPolicy` al ADR; `guard-assets` limita esa lista a la carpeta de
  iconos y la prohíbe en `files[]`, y `parseAppearance` recibe dos listas (`registeredPaths` y `generatedPaths`: una
  hoja nunca vale como icono ni al revés). `resolveIcon` puro (`painted | fallback | none`) e `IconBook` compartido por
  la carta (Phaser: carta de **240 × 240** con hueco de 64·k arriba, `cardContentLayout`, 3 `Image` preasignados que
  solo cambian de textura con la oferta) y la fila DOM de la tienda (`<img class="shop-panel__icon" alt="">`, 32 px ×
  `--ui-scale`, `pixelated`, `hidden` sin `src` en `none`); `NEAREST` con `applyNearest` en `BootScene`. Sondas
  `__sprint.offerIcons` y `shop.products[i].icon` (`products` vacío con la tienda cerrada). Tests con iconos: el
  tercer argumento `GENERATED_PATHS` (`tests/support/generated.ts`); forma de los PNG en `tests/support/pngProbe.ts`.
  Sin núcleo; balance, firmas y 820/904 intactos; E2E de la Tienda ampliado (7 filas y 3 cartas `painted`, 0 CSP).
  Audio (change 0035, ADR-0031): 11 ficheros del autor en `public/assets/audio/` (4.947.600 B, sin recodificar;
  7 CC0 y 4 CC-BY con su línea en `CREDITS.md`), `file` obligatorio en `audio.json`: todo en el adaptador. `AudioCues` saca las peticiones de los 12 tipos
  (`effectTypes.ts`) comparando cada snapshot pintado con el anterior (ids de golpes y explosiones, bajas,
  recogibles salvo en obra, por recurso con `PICKUP_EFFECT`: `pickupGold` oro/XP/carne, `pickupStone`,
  `pickupWood`; nivel, compra con la tienda abierta, solares; impacto de explosión > torre por `towerMatchPx` > arma);
  `EffectMixer` deja 1 por tipo y snapshot, con intervalo por el **reloj de render** (cuarto argumento de
  `onRender`), tope `maxVoices − sonando` por prioridad y descarte con pausa, retención, pestaña oculta o volumen 0;
  `musicState` + `AudioDirector` (stopped en menú y resultados, 0 con Jugar/R/↻). `SoundOut`: `PhaserSoundOut`
  (pools perezosos, bucle, `canPlay` = `!locked` y caché), muda con `?e2e` y no disponible sin Web Audio
  (`audio.noAudio`, `pauseOnBlur = false`); `AudioLoadScene` en paralelo desde `BootScene` (el menú no espera).
  `content/audio.json` (zod estricto, cruce `AUDIO_NOT_REGISTERED` en `bootContent` con `soundPaths`), ajustes en
  `sprint-survivors/audio` (`AudioSettingsStore`, 50/80/no, fuera de Exportar/Importar/Borrar). Panel DOM
  `SoundPanel` (3.er botón del menú, estado `sound`; en la pausa entre Reanudar y Volver, con `SoundPanelGate` en
  `GameScene`), tecla M y botón de silencio de la `TouchBar` vía `MuteRequests` (una vez por frame, `PRE_STEP`).
  Guardarraíl: lista `sounds[]` (CC0, CC-BY-3.0 o CC-BY-4.0 con su línea en `CREDITS.md`, enlazado desde el
  README; `kenney.nl`/`opengameart.org`/`freesound.org`, `public/assets/audio/`) y
  `tests/guardrails/audio-files.test.ts` (uso y ≤ 6 MiB; `.ogg/.mp3/.wav/.flac`). Sonda `__sprint.audio`; E2E de
  escritorio y de arranque ampliados. Núcleo, balance y firmas intactos.
  Pulido de la UI (change 0036, sin ADR): la tienda, la obra, la guía y Sonido se cierran con una **×**
  (`closeButton`, clase `ui-close`, texto `×`, `aria-label` `Salir` o `Cerrar`: los E2E siguen buscando por rol) en
  la esquina superior derecha, a margen de panel × k, con la pieza `button` y el mismo camino que Esc; los títulos
  dejan sitio con `--ui-close-room`. Botones de una sola etiqueta centrados (`text-align: center` común; las reglas
  de fila acotadas a `.shop-panel__product` y `.build-panel__option`); E2E con `faceCenterOffset` y `closeCorner`
  (`tests/e2e/probe.ts`). Barras de vida solo de las estructuras **dañadas** alguna vez y no en ruina (memoria por
  id en `HealthBarLayer`, se olvida con R/menú): `sprites.healthBars` vale 0 al empezar. HUD con 4 contadores a la
  derecha (bajas con calavera, oro, madera y piedra) con `appearance.json` `hud` (s 24, p 30, filas
  `healthY + i·p` desde 32, recorte cuadrado por icono con `setCrop` y `cropPose`, calavera = frame 5 de
  `Dead.png`); `HudMetrics` entra en `hudLayout` y en `mobileFrameRule`; bajas sin «Bajas: » (resultados igual).
  `.resource-icon` a 3em. Obra con imagen de `House_Blue`/`Tower_Blue` (`buildingIcons`) y explicación de
  `guide.json` `build` (interpolada, sin dígitos; ≤ 64 caracteres mostrados). Balance, firmas y 820/904 intactos.
  Fuente de verdad del comportamiento: `openspec/specs/`.

## 2. Comandos

> En Windows con PowerShell usa `npm.cmd` si la política de ejecución bloquea `npm.ps1`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (`http://localhost:5173/tfm-survivors/`) |
| `npm run verify` | lint + typecheck + guardarraíl sobre todo el repo + tests unitarios. **Ejecútalo al cerrar cada grupo de tareas y antes de cada commit. No cierres un grupo en rojo.** |
| `npm run verify:fast` | Bucle rojo → verde: lint con caché + typecheck + solo los tests afectados por los cambios sin commitear (`vitest --changed`), sin el test de balance. No sustituye a `verify` |
| `npm run test:e2e` | Build + `vite preview` + Playwright (chromium), solo el proyecto `logic`: la suite de humo (`smoke`, `progress` y `gameplay`.spec), la misma que el CI. Para una sola: `npm run test:e2e -- gameplay.spec` (filtro por ruta: con `.spec`, porque el nombre del worktree también casa) o `-- --grep "<título>"` |
| `npm run test:e2e:realtime` | Proyecto `realtime` (calibración de fps y `speed`). A demanda: fuera de `test:e2e` y del CI; en Actions, workflow `e2e-realtime` (`workflow_dispatch`). Diagnóstico opcional, nunca obligatorio antes de push: `CI_LIKE=1` (sin GPU, CPU frenada por CDP con `CPU_THROTTLE`, 25 por defecto, sin reintentos) |
| `npm run smoke:public` | Smoke de Playwright contra la URL pública (o `SMOKE_URL`). A demanda: fuera de `verify` y de CI; en Actions, workflow `smoke-public` (`workflow_dispatch`) |
| `npm run bench` | Benchmark del núcleo (Vitest bench). Depende de la máquina: no bloquea `verify` ni CI |
| `npm run build` | Build de producción (`dist/`) |
| `npm run guard:all` | Reglas de `.claude/hooks/` sobre todos los ficheros versionados (lo que hace el CI) |

**E2E ligeros (regla de proceso, chore `e2e-lite`)**: un escenario de spec se cubre por defecto con un test
unitario o de aplicación. Un E2E solo si el escenario exige navegador (DOM, render, almacenamiento real), en
modo manual (`?e2e&manual` + `step(n)`) y como **máximo 1–2 E2E nuevos por change**, preferiblemente ampliando un
test de la suite de humo. Nada de umbrales de fps ni de tiempo real en el gate. Un escenario vivo que solo cubría
un E2E retirado en `e2e-lite` se acepta sin test automático (no es hallazgo de verify).

## 3. Reglas de arquitectura (no negociables)

1. `src/domain` no importa nada de `application`, `infrastructure`, `composition` ni del motor.
2. `src/application` no importa `infrastructure`, `composition` ni el motor.
3. `domain` y `application` **no** usan `Math.random`, `Date.now`, `performance.now`, `window`, `document` ni `localStorage`.
   Usan los puertos `RandomGenerator` y `Clock`.
4. Solo `src/composition/` conoce las implementaciones concretas (composition root).
5. El contenido del juego (armas, enemigos, mejoras, oleadas) vive en `content/*.json` validado con zod. Sin números mágicos.
6. Toda entrada externa (fichero importado, `localStorage`, red) se valida con zod antes de llegar al dominio.

Estas reglas se aplican en tres capas, con **una sola fuente** (`.claude/hooks/`) para todos los autores:
1. **Agente**: hooks de Claude Code al escribir (solo dentro de Claude Code).
2. **Commit** (cualquier autor: persona, Claude desde la app, otros agentes): `.husky/pre-commit` ejecuta
   lint-staged (ESLint con reglas de capas y pureza) y `scripts/guard-staged.mjs`, que lanza los mismos hooks
   sobre el contenido preparado.
3. **CI**: `npm run verify` incluye `guard:all` y ESLint sobre todo el repo.

Si un guardarraíl te bloquea, **corrige el diseño; no desactives la regla**. Prohibido `git commit --no-verify`
y escribir en `main` sin PR (también con la API de GitHub): los cambios entran por PR con el check `quality` verde.

## 4. Convenciones

- Entidades y VOs en PascalCase (`Run`, `Health`); casos de uso con verbo (`StartRun`, `ChooseUpgrade`).
- Puertos con nombre de dominio (`ProgressRepository`); adaptadores con prefijo técnico (`LocalStorageProgressRepository`).
- Errores de dominio tipados; `Result` en lugar de excepciones para fallos esperables.
- Líneas ≤ 100, indentación 2, sin `import *` salvo el motor en infraestructura (equivalencias del `checkstyle.xml` del curso).
- Commits: Conventional Commits, `refs: <change-id>` y trailer `Assisted-by: <herramienta/modelo>` si interviene la IA.

## 5. Flujo de trabajo: Spec-Driven Development

Nivel **Spec-Anchored**: las specs viven y evolucionan con el código.

| Situación | Enfoque |
|---|---|
| Pequeño y claro (texto, color, constante) | Prompt directo + test si aplica. Sin change. |
| Mediano/grande y claro (mecánica, guardado…) | **SDD completo** → skill `sdd-workflow` |
| Incierto ("¿es divertido?", "¿qué motor?") | **Spike** desechable en rama `spike/*`; si funciona, SDD |
| Grande y confuso ("hazlo más divertido") | Volver al GDD (`docs/gdd.md`) antes de especificar |

Fases: `explore → propose → [gate humano] → spec ∥ design → tasks → apply (TDD) → verify → [gate humano] → archive`.

**TDD por capa** (ADR-0018): TDD estricto (rojo comprobado) en `domain` y `application`; *test-after* en
infraestructura, composición y contenido. Tareas por escenario, agrupadas por capa; `verify:fast` por tarea y
`verify` completo + commit por grupo. Todo escenario sigue necesitando su test (el verifier lo exige).
Cada change trabaja en **su propio git worktree y rama** (`change/<id>`). Ver skill `worktree-flow`.

Gates humanos: **nunca** avances de *propose* a *spec/design* ni de *verify* a *archive* sin aprobación explícita del usuario.

## 6. Seguridad

- Fase 1 **local-first**: sin backend, sin cuentas, sin secretos. Guardado en el navegador + exportar/importar JSON.
- Todo lo que empiece por `VITE_` acaba en el bundle: **es público**. Nunca pongas claves privadas en el cliente.
- Fase 2 (opcional): Supabase + login con Google. Solo `anon key` en el cliente y **RLS obligatoria** en todas las tablas.
- No leas ni escribas `.env*` (salvo `.env.example`). No añadas dependencias sin justificarlo en el design del change.
- Ver `docs/adr/0004-seguridad-local-first.md`.

## 7. Registro de skills (cárgalas solo cuando apliquen)

| Skill | Cuándo (triggers ES / EN) |
|---|---|
| `sdd-workflow` | nueva funcionalidad, mecánica, change, spec, propuesta / feature, proposal |
| `sdd-archive` | archivar, cerrar change, retrospectiva / archive, retro, close change |
| `worktree-flow` | worktree, rama de change, trabajo en paralelo / branch, parallel |
| `domain-modeling` | entidad, value object, invariante, agregado, evento de dominio / entity, aggregate |
| `test-writer` | test, TDD, cobertura, doble, contrato / coverage, mock, fake |

## 8. Subagentes (`.claude/agents/`)

| Agente | Fase | Puede escribir | Modelo |
|---|---|---|---|
| `game-designer` | GDD, backlog MoSCoW, historias | `docs/gdd.md` | sonnet |
| `sdd-explorer` | explore | solo `openspec/changes/<id>/exploration.md` | sonnet |
| `sdd-spec-writer` | propose + spec | `proposal.md`, `specs/**` del change | opus |
| `sdd-architect` | design + tasks | `design.md`, `tasks.md`, ADRs | opus |
| `sdd-implementer` | apply (TDD) | `src/**`, `tests/**`, `content/**` | opus |
| `sdd-verifier` | verify | solo `verify-report.md` | sonnet |

Quien explora no diseña; quien implementa no verifica. El modelo se fija en el frontmatter de cada agente:
Opus donde se decide o se escribe código; Sonnet en lectura, contraste y diseño de juego (ahorro de créditos;
además, verificar con un modelo distinto del que implementa refuerza la independencia).

## 8.1 Uso eficiente del contexto (créditos)

- Salidas cortas: `npm run verify 2>&1 | tail -20`; abre el log completo solo si algo falla.
- En Windows (Git Bash), escribe código y JSON con Edit/Write, **nunca con heredocs**: alteran `\` y rompen ficheros.
- Devuelve al orquestador resúmenes, no volcados de ficheros ni de comandos.

## 9. Documentación clave

- Plan y decisiones de arranque: `docs/exploration/2026-11-19-kickoff.md`
- GDD: `docs/gdd.md` · ADRs: `docs/adr/` · Diario de IA: `docs/ai-log/`
- API de Phaser: MCP `phaser-docs` (`.mcp.json`, público y sin token) o `https://phaser.io/llms.txt`.
  Su API publicada puede ir por detrás de la 4.2.1 instalada: en caso de duda mandan los tipos de `node_modules/phaser`.
