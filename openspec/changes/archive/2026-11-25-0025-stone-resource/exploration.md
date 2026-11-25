# Exploración 0025 · stone-resource

Intención: recogible `stone` (quinto tipo) que sueltan los enemigos al morir con probabilidad por tipo, tirada de un
flujo de azar propio, contador e icono en el HUD, sin uso aún. Fuente: `docs/gdd.md` (historia 0025, fila 0025).

## Contexto actual

- **Recogibles**: `src/domain/pickup/PickupKind.ts` (unión `xp|gold|wood|meat` + `PICKUP_KINDS`), `PickupField.ts`
  (`PickupGain` con un campo por tipo, `counts` por tipo, una lista y una secuencia de ids, pool de `Σ topes`),
  `PickupRules.ts` (`maxGems/maxGold/maxWood/maxMeat`, `capacity`, `max(kind)`). Tope y relleno al más antiguo ya son
  genéricos por tipo.
- **Contadores**: `src/domain/resource/Stockpile.ts` (`add(gold, wood, bonus)`, solo oro y madera);
  `RunSnapshot.ts` `ResourcesSnapshot {gold, wood}`. Run los alimenta en `collect()` (paso 7.1).
- **Drops por baja**: `Run.onDeath` (`Run.ts` ~443) suelta xp, y si `!dead.detonated` madera y oro
  (`ResourceRules.woodFor/goldForEnemy`; `content/resources.json`, esquema en `infrastructure/content/schemas.ts`
  ~516). `onDeath` es el único punto por el que pasan **todas** las bajas: lo llaman `removeDead` tras las armas
  (paso 3, línea 320) y tras explosiones (paso 4, línea 405). No hay otra ruta de muerte de enemigo.
- **Azar**: `Run.random` (oleadas y ofertas), y flujos derivados `MAP/DECOR/STRUCT/RESOURCE/SHEEP_STREAM` 1..5
  (`infrastructure/random/deriveSeed.ts`) que `composition/seedSource.ts` (`seededRun`) mete en
  `TerrainSource.generated` (`random, structureRandom, resourceRandom, sheepRandom`); las ovejas llegan a `Flock` por
  `SheepSites.random` (RunSetup). `RunSeeding` (`application/StartRun.ts`) = `{random, terrain}`.
- **Render/HUD**: `PickupLayer.ts` (pool por tipo, contadores `visible/placeholder`), `art/looks.ts`
  (aspectos por tipo), `renderCounts.ts` (sonda `sprites.pickups` por tipo), `Hud.ts` + `sceneWidgets.ts` +
  `ui/uiLayout.ts` (contadores oro/madera, `HUD_BASE.woodY`), `GameScene.hudView()`; contenido visual en
  `content/appearance.json` (`pickups.gold/wood/meat`, hojas 128 × 128 escala 0,3) con esquema
  `appearanceSchema.ts` (tipos exactos, colores de reserva distintos dos a dos, ficheros distintos) y
  `loadAppearance.ts`.
- **Tests de soporte**: `tests/support/balanceBaseline.ts`, `balanceMeasure.ts` (filtra `kind === 'gold'` por id),
  bot de referencia: **no lee recogibles** (sin `gems/pickups` en `policies.ts`), así que su trayectoria no depende
  de lo que haya en el suelo.
- **Assets**: en el repo solo hay `public/assets/tiny-swords/**` (copiados del pack local
  `C:\Users\Adri\TFM\Tiny Swords (Update 010)\`). `Deco/04.png`, `05.png`, `06.png` **existen en el pack local pero no
  en el repo**: hay que copiarlos a `public/assets/tiny-swords/Deco/` y añadir 3 entradas (`path`, `source`,
  `version`, `sha256`, `bytes`) en `content/asset-provenance.json`; `guard-assets.mjs` (sobre `git ls-files`) rechaza
  un gráfico sin entrada, un sha/bytes inválido y orígenes del Free Pack. Hay que comprobar que el origen no sea del
  Free Pack y medir sha256/bytes al copiar. Las hojas son rocas sueltas (64 × 64 según el GDD; verificar tamaño real
  y si son 1 o varios fotogramas) frente a las 128 × 128 de los demás recogibles.

## Capacidades/specs afectadas (`openspec/specs/`)

`resources` (principal: nuevo requisito "Piedra por enemigo abatido" junto a "Oro por enemigo abatido"; contador de
piedra; contenido validado; "Recursos sin efecto en el combate"), `xp-gems` (recogibles con tipo: quinto tipo,
topes), `simulation-loop` (azar: flujo nuevo y orden de consumo; paso 7.1 con cinco tipos), `hud` (contador de
piedra), `sprite-rendering` (aspecto y sonda de recogibles), `asset-provenance` (3 entradas), y por contraste
`enemy-spawning`/`procedural-map` (firmas doradas intactas) y `run-results`/`progress-persistence` (la piedra no se
guarda ni sale).

## Dónde engancharía la tirada

- Sitio natural: `Run.onDeath`, tras madera y oro, en el mismo orden de bajas que ya es determinista
  (`removeDead` recorre en orden de lista; armas en paso 3, explosiones en paso 4).
- Pregunta de diseño: ¿la piedra cae también con `detonated` (barril que explota por su mecha)? Madera no, oro por
  baja sí (solo cae dentro de `!detonated` hoy: ambos). Hay que decidirlo; las explosiones que matan a otros tipos
  sí pasan por `onDeath` sin `detonated`.
- Consumo de azar (afecta a determinismo, no al balance): 1 valor por muerte con probabilidad > 0, o 1 por muerte
  de cualquier tipo. Más simple y estable ante cambios de contenido: uno por muerte con p > 0 (o siempre); fijarlo en
  el spec.
- Línea base: la piedra no toca `Run.random`, ni los otros flujos, ni al bot (no lee el suelo), ni al jugador (no
  cura, no suma oro). Ocupa ids de la secuencia única y plazas del pool: puede desplazar los ids de recogibles
  posteriores (xp/oro) respecto a la base; `balanceMeasure` filtra por `kind==='gold'` y por id > último, así que
  conviene comprobar que no depende de ids contiguos. Tests que fijen ids absolutos de recogibles en escenarios con
  piedra declarada podrían romperse; con p = 0 (escenarios `aRunConfig`) nada cambia. Efecto colateral: más
  objetos en pantalla y más trabajo por tick del `PickupField` (pool + topes).
- El flujo propio no puede colgar de `TerrainSource.generated` solo: con `?e2e&map=empty` (`OPEN_TERRAIN`) no hay
  `sheepRandom`/`stoneRandom`, y los E2E usan mapa vacío por defecto.

## Opciones

**A. Flujo en `RunSeeding` (`stoneRandom`) + `STONE_STREAM` 6.** `seededRun` lo crea siempre (también en
`map=empty`); `Run.start` lo recibe como parámetro opcional y lo guarda; tirada en `onDeath`.
Pros: independiente del mapa, vale con mapa vacío, un único punto. Contras: cambia la firma de `RunSeeding` y de
`Run.start` (tests de escenario que lo construyen a mano necesitan un valor por defecto; sin él, p efectiva 0).

**B. Flujo dentro de `TerrainSource` (como `sheepRandom`).** Pros: patrón ya conocido (ADR-0022). Contras: no existe
en `open`/`cells` sin declararlo (hay que añadir `DeclaredStone.random` o similar), mezcla azar de suelta con el
terreno; el mapa vacío E2E no soltaría piedra salvo trabajo extra.

**C. Sin flujo nuevo: tirada sin azar** (p. ej. cada N bajas del tipo, determinista por contador). Pros: cero azar,
cero riesgo para las firmas. Contras: incumple lo pedido ("probabilidad por tipo", "flujo de azar propio") y se nota
mecánico.

**Recomendación: A** (nuevo ADR corto o addendum a ADR-0021/0022 con `STONE_STREAM` = 6 y el orden de consumo).
Esquema: `resources.drops.stoneChance` por tipo de enemigo, patrón de `goldPerKill` (tabla completa del catálogo,
valores validados), con una probabilidad en rango [0, 1] o porcentaje entero 0..100 (preferible entero: evita coma
flotante en el contenido; decidir) y un valor de piedra por pieza (`resources.stone.perDrop`, entero ≥ 1) y
`progression.maxStone`. Arte: `stone` como recogible estático con 3 tamaños (04/05/06) elegidos por **valor o por
id determinista** sin consumir azar (si no, la elección de aspecto tendría su propio flujo); HUD reutiliza una.

## Riesgos e incógnitas

- Que la tirada se haga también para tipos con p = 0 consume azar innecesario; definir el orden y escribir una firma
  dorada nueva `STONE_DROP_GOLDEN` (secuencia de caídas de una semilla) para blindar el determinismo.
- Esquema de `appearance.json` hoy asume recogibles de hoja 128 × 128 con frame 0, ficheros distintos y 4 tipos
  exactos: ampliarlo a 5 tipos y quizá a 3 variantes por tipo toca esquema, looks, `PickupLayer` y sonda.
- Pool de recogibles: añadir `maxStone` (propuesta 16–32, comparable a `maxGold`) aumenta `capacity`; revisar
  objetos totales y bench (M1 de 0022: 0,27 ms) y tope de objetos del mapa.
- HUD: tercera fila de contador en `uiLayout` (`HUD_BASE`) en escala ×1/×2 y `ScreenFrame`; tests de layout.
- Bonificaciones: la piedra no debe heredar `goldBonusPercent`; `Stockpile.add(gold, wood)` cambia de firma
  (conviene un tercer parámetro o un objeto). `RunSetup` puede traer contadores iniciales (piedra = 0).
- `Run.ts` ya es muy grande; evitar añadir lógica allí (extraer un colaborador `StoneDrops` en dominio puro).
- Assets: copiar con cuidado (no Free Pack), sha256/bytes reales, y comprobar que la licencia de Deco es la CC0 de
  Update 010 ya confirmada. CSP/build no cambian.
- Sin incógnitas de motor: la API de Phaser usada es la existente.

## Mediciones previas

Probablemente **ninguna**: el objetivo "balance idéntico" se cumple por construcción (la piedra no altera ni
`Run.random` ni al bot ni la vida/oro) y se comprueba en `verify` comparando el lote de las semillas 1..50 con
`tests/support/balanceBaseline.ts` semilla a semilla (30/50, 0 quietos). Si el orquestador quiere un dato antes de
proponer: (1) un lote del bot v4 sobre 1..50 con la piedra simulada (medición de control de que la línea base no
cambia: umbral = idéntica semilla a semilla), (2) piedra media por partida con las probabilidades candidatas, para
fijar `maxStone` y el valor por pieza (umbral: que el tope no sature en una partida típica de 180 s), y (3) coste del
pool a tres/cuatro topes (umbral M1: ≤ 0,3 ms/tick, como 0022). No las ejecuto yo.

## Preguntas para el usuario

1. ¿Probabilidad como porcentaje entero 0..100 o fracción 0..1? ¿Valores iniciales por tipo (p. ej. goblin-torch 10 %,
   tnt 15 %, barrel 5 %, guardia 20 %)?
2. ¿Una piedra por baja con valor 1, o el valor depende del tamaño (04 pequeña = 1, 05 = 2, 06 = 3) y entonces cómo
   se elige el tamaño sin consumir azar adicional (por tipo de enemigo declarado en contenido)?
3. ¿Suelta piedra el barril que explota por su mecha (`detonated`)? Madera no; el oro por baja hoy tampoco.
4. ¿Se mantiene la tirada también con mapa vacío en E2E (opción A) para poder cubrirla con el E2E de humo?
