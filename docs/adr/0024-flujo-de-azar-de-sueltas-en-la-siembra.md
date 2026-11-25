# ADR-0024 · Flujo de azar de sueltas en la siembra de la partida (STONE_STREAM 6)

- **Estado**: aceptada (apply de 0025, 2026-11-25)
- **Fecha**: 2026-11-25

## Contexto
El change 0025 hace que un enemigo abatido suelte una piedra con una probabilidad por tipo. Es la primera tirada de azar
**por baja**. Hay cuatro fuerzas:
- El balance de 0024 (30/50, 0 quietos) tiene que quedar idéntico semilla a semilla, así que la tirada no puede
  consumir `Run.random` (oleadas y ofertas). Las firmas `MAP_`, `STRUCTURE_`, `RESOURCE_` y `SHEEP_GOLDEN` tampoco
  pueden moverse.
- Los flujos derivados existentes viajan en `TerrainSource.generated` (ADR-0013, 0020, 0021, 0022). Con `open`/`cells`
  (y `?e2e&map=empty`, el modo por defecto de los E2E) no existen salvo que el escenario los declare.
- Unos 110 sitios de los tests montan la partida con `Run.start(config, random, setup, terrain)` y no deben cambiar.
- La regla de consumo forma parte del contrato de determinismo y fija la firma dorada nueva.

## Opciones
1. **Dónde viaja el flujo**: (a) en `TerrainSource` como las ovejas; (b) en `RunSeeding` y como parámetro opcional de
   `Run.start`; (c) sin flujo, tirada determinista por contador de bajas.
2. **Consumo**: (a) 1 valor por baja de tipo con probabilidad > 0 y no detonada; (b) 1 valor por baja, siempre.
3. **Sin flujo** (llamadas antiguas a `Run.start`): (a) error de arranque; (b) la piedra no cae y no se consume nada.

## Decisión
**1b + 2b + 3b.**
- **1b**: `RunSeeding = { random, terrain, stoneRandom }`, con `stoneRandom = Mulberry32(deriveSeed(seed, 6))`
  creado por `seededRun` en **todos** los modos de mapa. `Run.start` y `StartRun.execute` lo reciben como quinto
  parámetro opcional. Se descarta (a) porque no es azar del terreno y no existiría con el mapa vacío. Se descarta (c)
  porque la propuesta pide probabilidad por tipo con un flujo propio y se notaría mecánico.
- **2b**: la k-ésima baja procesada (orden de `removeDead` en los pasos 3 y 4) consume el k-ésimo valor, también con
  probabilidad 0 y con el barril detonado; suelta si no está detonada y `⌊next × 100⌋ < stoneChance`. La posición en
  el flujo depende solo de la secuencia de bajas: cambiar la probabilidad de un tipo no desplaza las tiradas de los
  demás. Se descarta (a) porque cualquier ajuste de contenido movería toda la firma.
- **3b**: sin generador, `StoneDrops` no suelta ni consume. Los escenarios existentes no cambian y los de la piedra
  pasan el flujo de forma explícita. Se descarta (a) porque rompería decenas de tests sin ganar nada.

## Consecuencias
- **Positivas**:
  - Balance, oleadas, ofertas y firmas existentes quedan intactos por construcción. El lote de balance lo comprueba
    con la piedra activa.
  - Los E2E con `map=empty` ven piedras.
  - Las futuras sueltas por baja (si las hay) tienen un sitio claro: la siembra, no el terreno.
- **Negativas / costes**:
  - `Run.start` crece a cinco parámetros posicionales. Si aparece otro flujo de partida, conviene agruparlos en un
    objeto.
  - Se consumen valores que no deciden nada (bajas con probabilidad 0 o detonadas): unos cientos de `next()` por
    partida.
  - Cambiar `STONE_STREAM`, la regla de consumo o `stoneChance` cambia `STONE_GOLDEN`, pero no el balance.
- **Cómo revertirla**: no pasar `stoneRandom` (o poner `stoneChance` a 0) deja la partida bit a bit como en 0024. Quitar
  el flujo no toca ningún otro.

## Addendum (apply de 0025, 2026-11-25)
- Implementada tal cual: `StoneDrops` en el dominio (1 valor por baja, también con probabilidad 0 o barril
  detonado), `STONE_STREAM` 6, `RunSeeding.stoneRandom` obligatorio y `Run.start(..., stoneRandom?)` opcional.
- Hojas medidas: `Deco/04.png`, `05.png` y `06.png` de Update 010 son de **64 × 64 px con un solo frame** (cabecera
  IHDR), así que el `appearance.json` del design (frame 64 × 64, escala 0,5, `idle [0]`) no cambió.
- Balance: el lote del bot v4 juega con la piedra y coincide con `BALANCE_BASELINE` semilla a semilla (30/50, 0
  quietos con los dos mapas) sin regenerarla. Piedra por partida del lote: **48,2 soltadas** (cota inferior: no cuenta
  las que se crean y se recogen en el mismo tick) y **30,7 recogidas**; lote 35,5 s en local.
- Bench del núcleo (local, informativo): cinco topes llenos + 300 vivos + 32 proyectiles + ovejas en huida
  **0,254 ms/tick** (cuatro topes 0,252–0,279; tres topes 0,247–0,255 frente a 0,27 de 0022; gemas 0,176–0,187).
- `STONE_GOLDEN` (quieto, 3.600 ticks o hasta morir): 3 piedras en la 42 y 2 en la 123, todas de `goblin-torch`.
