# 0020-enemy-behaviors · Mediciones previas

Medido el 2026-11-24 sobre `change/0020-enemy-behaviors` (base `53e67c9`, contenido de 0019), sin tocar `src/`.
Instrumentación: un test de Vitest temporal (`tests/domain/zz-measure-0020.test.ts`, ya borrado) con
`aDefaultConfig()`, `startSeededRun(config, seed)` (mapa generado), `referenceBot(config, run.map)` y el mismo
bucle que `playReferenceBot` (elegir las ofertas abiertas y luego `tick(bot.input(snapshot))`), hasta 36.000 ticks
o el final. Cada tick se lee `run.snapshot()`.

## 1. Línea base de balance

| Medida | Valor | Cómo |
|---|---|---|
| Victorias del bot (semillas 1..50) | **26/50** (24 derrotas) | `measureBalance(config).wins` |
| Quietos vivos en el tick 10.799 | **0** (mapa generado) y **0** (vacío) | `measureBalance().stillGenerated/stillEmpty` |
| Primera oferta, semilla 7 (quieto) | **tick 2.082** | `measureBalance().firstOffer` |

Corrección a la exploración (§6.1): la primera oferta es **2.082**, no 1.527 (1.527 era la de 0017; 0019 cambió
la curva de XP a 9/3, como ya dice el comentario de `tests/domain/balance.test.ts`). 26/50 se confirma.
Derrotas: 15 de las 24 antes del tick 10.800 (antes de que entre el TNT); ticks entre 6.157 y 34.295.

## 2. Apariciones y vivos simultáneos por tipo (bot, semillas 1..50)

Apariciones = ids distintos vistos en los snapshots; pico = máximo de vivos del tipo en un mismo tick.

| Tipo | Apariciones (50 partidas) media · min · max | Apariciones (26 ganadas) media · min · max | Pico vivos media · max | Primera aparición |
|---|---|---|---|---|
| goblin-torch | 282,2 · 107 · 427 | 390,3 · 355 · 427 | 27,9 · 41 | tick 50 |
| goblin-barrel | 209,6 · 33 · 338 | 312,7 · 281 · 338 | 32,7 · 64 | tick 3.625–3.750 |
| goblin-tnt | 127,7 · 0 · 241 | 224,8 · 204 · 241 | 18,5 · 42 (ganadas: 29,5) | tick 10.850–11.275 |

En las partidas completas (600 s) salen ~313 barriles y ~225 TNT; mediana de 0 TNT en las derrotas tempranas.

## 3. Daño recibido por contacto (bot, semillas 1..50)

Cada bajada de vida del jugador (sin cambio de `maxHealth`) se atribuye al tipo cuyo `damage` coincide con la
bajada (5 torch, 8 barrel, 15 tnt; son distintos y `applyContact` da un golpe por tick con el mayor daño). Las
bajadas que no casan (1–14) son el golpe final recortado a 0 en las derrotas (≤ 1 por partida) y no se atribuyen.

| Tipo | Daño medio/partida (todas · ganadas) | Golpes medios/partida (todas · ganadas) | Max daño |
|---|---|---|---|
| goblin-torch | 20,6 · 14,8 | 4,1 · 3,0 | 60 |
| goblin-barrel | **85,9 · 60,6** | **10,7 · 7,6** | 168 |
| goblin-tnt | 16,5 · 23,1 (mediana 0) | 1,1 · 1,5 | 90 |
| Total (incl. golpe final) | 124,8 · 98,5 (vida máx. 100 + mejoras) | | 200 |

El barril es hoy la fuente principal de daño (~70 % en todas las partidas, ~62 % en las ganadas).

## 4. Coste del núcleo (`npm run bench`, 16 hilos, 2.ª ejecución sin carga)

| Caso | Media ms/tick | p99 |
|---|---|---|
| 300 vivos (contenido por defecto, semilla 7) | 0,0229 | 0,0581 |
| 300 vivos con mapa generado | 0,0242 | 0,0646 |
| 300 vivos + 32 proyectiles (peor caso) | **0,2060** | 0,2625 |
| 300 vivos + 32 proyectiles + 300 gemas | 0,1942 | 0,2726 |
| 300 sin línea libre (campo de flujo) | 0,1103 | 0,1223 |
| 300 vivos, jugador cambia de celda cada tick | 0,1706 | 0,1786 |
| `Run.snapshot` 300 vivos | 0,0126 | 0,0154 |

Máximo actual 0,206 ms (presupuesto del bench 2 ms). Con +20 % el objetivo sería ≤ 0,25 ms en el peor caso.

## 5. Hojas del pack local `C:\Users\Adri\TFM\Tiny Swords (Update 010)` (no copiadas)

Leídas con un script de Node en el scratchpad (cabecera IHDR + descompresión zlib para contar celdas con algún
píxel opaco por fila); las filas de TNT y barril se identificaron mirando las hojas.

| Hoja | Tamaño px | Rejilla (celda) | Fotogramas útiles |
|---|---|---|---|
| `Troops/TNT/Red/TNT_Red.png` | 1.344 × 576 | 7 × 3 (192 × 192) | fila 0 idle 6, fila 1 carrera 6, **fila 2 lanzamiento 7** (frames 14–20) |
| `Troops/Barrel/Red/Barrel_Red.png` | 768 × 768 | 6 × 6 (128 × 128) | f0 escondido 1, f1 asomarse 6, f2 asomado 1, f3 esconderse 6, f4 andar 3 (24–26), **f5 mecha encendida 3** (30–32); sin explosión propia |
| `Troops/TNT/Dynamite/Dynamite.png` | 384 × 64 | 6 × 1 (64 × 64) | 6 (giro en vuelo) |
| `Effects/Explosion/Explosions.png` | 1.728 × 192 | 9 × 1 (192 × 192) | 9 |
| `Effects/Fire/Fire.png` | 896 × 128 | 7 × 1 (128 × 128) | 7 |
| `Buildings/Wood_House/Goblin_House.png` · `_Destroyed` | 128 × 192 · 128 × 192 | 1 fotograma | 1 · 1 |
| `Buildings/Wood_Tower/Wood_Tower_{Red,Blue,Purple,Yellow}.png` | 1.024 × 192 | 4 × 1 (256 × 192) | 4 |
| `Wood_Tower_Destroyed` · `_InConstruction` | 256 × 192 | 1 fotograma | 1 · 1 |
