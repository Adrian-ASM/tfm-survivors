# Exploración 0031-combat-feedback

Intención: barras de vida sobre casas y torres goblin (fuera en ruina) y números de daño por golpe (enemigo,
estructura, oveja, jugador), con los golpes expuestos por tick en el snapshot, sin azar, y balance idéntico.

## Contexto actual
- **Dónde se aplica daño** (`src/domain`): `Arsenal.moveProjectiles` (l.149 enemigo, l.152 "pared" de reserva:
  estructura u oveja) y `Arsenal.pulse` (l.254, l.260); `TowerBattery.advance` (l.71, solo enemigos);
  `HazardField.strike` (l.181 enemigos, l.186 ovejas; no daña estructuras); `Run.applyHit` (l.600, jugador:
  `max(contacto, explosión)`, un golpe por tick, `Player.hit` aplica `max(1, daño − armor)` y fija
  invulnerabilidad). Los objetivos tienen `takeDamage` con recorte a 0: `Enemy` y `Sheep` (con tick),
  `Structure` (sin tick; interfaz `WeaponTarget.takeDamage(amount, tick): boolean` solo devuelve la baja).
  Un objetivo ya muerto no se daña (sin golpe). Hoy no existe registro de golpes: solo `lastHitTick`
  (`damaged`, ventana `hitFlashTicks` 4 en `content/weapons.json`).
- **Orden del tick** (`Run.tick`): jugador, ovejas, horda, 3.1 proyectiles y flechas, 3.2 disparos, bajas,
  `settle`, peligros (paso 4), `applyHit`. Un registro es un efecto lateral sin azar: no cambia el orden.
- **Snapshot**: `StructureSnapshot` trae `health`, `destroyed`, `x`, `y`, `radius`, `type`, pero **no la vida
  máxima** (está en `content/structures.json`: casa 60, torre 90). Enemigos, ovejas y jugador traen `health`
  (jugador también `maxHealth`). No hay lista de golpes. `Run.snapshot()` se llama por frame, no por tick, y
  puede cubrir hasta 15 ticks por `execute` (×`speed` en E2E); las puertas de tienda/obra y la pausa vuelven a
  llamar a `render` con el mismo snapshot.
- **Render** (`src/infrastructure/phaser`): `RenderLayers` crea capas en orden (anillos, recogibles, ovejas,
  cadáveres, enemigos, proyectiles, jugador), el arte de estructuras va dentro del plan del mapa
  (`StructureArt` + `MapCuller`, capas baja/alta), después `createHazards` (capa 8, un `Graphics` + pools) y
  el HUD (`HUD_DEPTH` 100, `scrollFactor` 0). `SlotPool` asocia hueco↔id; `AnimClock` (`renderMs`) se congela
  en pausa/elección/fin. Nada pinta barras de vida de enemigos ni ovejas (`SheepLayer` lo dice); la vida del
  jugador está en el HUD. Sondas: `window.__sprint.sprites` (`SpriteCounts`, `renderCounts.ts`), `map`, `hud`.
- Colores y datos visuales: `content/appearance.json` (zod en `src/infrastructure/content/schemas.ts`);
  duraciones de simulación en `content/*.json` (p. ej. `blastTicks` en `enemies.json`).

## Specs afectadas
`goblin-structures` (barra y snapshot de estructura), `auto-weapons`/`enemy-hazards`/`player-health`/`sheep`
(solo si exponen el daño aplicado), `simulation-loop` (snapshot, sin azar), `sprite-rendering` (capas, pools,
sonda), `world-camera` (mundo vs pantalla), `hud` (no se toca). Intactos: `BALANCE_BASELINE`, las seis
`*_GOLDEN`, 820/904 objetos del mapa en 42/123 (las barras no entran en el plan del mapa).

## Opciones
1. **Registro central en `Run`** (`HitLog` de tamaño fijo, ids propios, inyectado a `Arsenal`, `TowerBattery`
   y `HazardField`; `Run.applyHit` anota el del jugador). Pro: incluye el golpe letal, no asigna, explícito.
   Contra: toca 5 puntos y los constructores/tests de escenario.
2. **Los objetivos acumulan `lastHit{tick, daño}`** y `Run` los recoge. Pro: casi sin cambiar firmas. Contra:
   pierde el golpe letal (el enemigo sale de la lista en `removeDead`) y varios golpes en un tick; poco fiel.
3. **Derivar en render por diferencia de `health` entre snapshots.** Pro: cero núcleo. Contra: incumple "golpes
   del tick en el snapshot", sin golpe letal, agrega ticks de un frame, la curación lo enmascara.

## Riesgos e incógnitas
- Un snapshot por frame cubre varios ticks: "golpes del tick" literal perdería golpes. Hace falta ventana
  (estilo `blastTicks`/`visualTicks`) o acumulación desde el último snapshot, con ids únicos y dedupe en render.
- Tope y orden del registro deterministas (un tick con 300 enemigos y un pulso → cientos de golpes).
- Coste de render: `Text` de Phaser regenera textura al `setText`; pool fijo y texto solo al aparecer.
- Pausa/tienda re-renderizan el mismo snapshot: la aparición debe ser por id, no por frame.
- Partida terminada: el reloj de render se congela; el último golpe quedaría a medias bajo el velo.
- Vida máxima de estructura ausente del snapshot (campo nuevo en núcleo o leer `structures.json` en render).
- Hot path: M1/bench; el registro no debe asignar ni cambiar el consumo de azar.
- Procedencia: con formas (rectángulos/`Graphics`/`Text`) no hay assets nuevos; barras de Update 010 exigirían
  entrada en `content/asset-provenance.json` y el guardarraíl (no verificado qué hay en el pack).

## Mediciones previas
Solo balance: no se requieren cifras nuevas. Umbral: lote del bot sobre semillas 1..50 idéntico a
`BALANCE_BASELINE` semilla a semilla (30/50 de partida, 34/50 v4 vigente, 0 quietos) y firmas intactas; el
registro no consume azar ni altera el estado. Bench M1 (`npm run bench`) sin regresión apreciable.

## Preguntas para el usuario
Ver la lista numerada devuelta al orquestador (daño aplicado vs nominal, golpe letal, ventana del snapshot,
agrupación, tope, colores, ficheros de contenido, pausa/fin, `speed`, formas vs arte).
