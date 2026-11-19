# ADR-0003 · Inmutabilidad frente a rendimiento

- **Estado**: aceptada (validada con benchmark en el change 0002-enemy-spawning y revalidada en 0003)
- **Fecha**: 2026-11-19

## Contexto
DDD recomienda VOs inmutables, pero crear miles de objetos por tick con cientos de enemigos presiona al recolector de
basura y provoca tirones.

## Decisión
- VOs inmutables en reglas y configuración (camino frío).
- En el camino caliente, el aggregate root `Run` puede usar arrays y pools mutables **internos y no expuestos**; las
  invariantes siguen protegidas por el agregado.
- Presupuesto de ms por tick fijado en la spec y medido con `vitest bench` (`npm run bench`).
- *Struct of arrays* solo si el benchmark lo exige (media por tick > 2 ms con el tope de vivos).

## Aplicación (change 0002-enemy-spawning)
- **Dominio**: `Enemy` guarda su posición como escalares `x`/`y` mutables internos y `chase` los actualiza sin
  crear objetos; hacia fuera solo se expone el `RunSnapshot` congelado.
- **Infraestructura**: `EnemyLayer` preasigna un pool de `CircleSprite` (tamaño `waves.maxAlive`) y lo reutiliza
  en cada frame; no crea objetos del motor por frame.
- No se ha necesitado *struct of arrays*.

## Datos del benchmark
`tests/bench/run.bench.ts`: contenido por defecto, semilla 7, 200 enemigos vivos, 600 ticks consecutivos.
Máquina: Ryzen 7 9800X3D, Node 26.13.1.

| Medida | Media | p99 |
|---|---|---|
| `Run.tick` | 0,0069 ms | 0,0110 ms |
| `Run.snapshot()` | 0,0043 ms | — |

## Aplicación (change 0003-collisions-and-damage)
- **Dominio**: la vida del jugador es un VO `Health` inmutable, que solo asigna al recibir un golpe (como mucho
  uno cada N + 1 ticks). La invulnerabilidad es un tick absoluto (`invulnerableUntil`), sin contador por tick. La
  vida de cada `Enemy` es un escalar mutable interno. `contactDamage` recorre los enemigos con un bucle indexado y
  sin asignar. Las bajas compactan la lista en el sitio (ADR-0006).
- **Bench**: con el contenido por defecto el jugador quieto muere antes de llegar a 200 vivos, así que el bench usa
  `player.maxHealth = 1e9` (`BENCH_HEALTH`) y falla con un error si la partida termina antes del tope. Se añade el
  caso de 200 `bug` encima del jugador (contacto en todos los ticks).

| Medida (600 ticks, Ryzen 7 9800X3D, Windows 11, Node 26.13.1) | Media | p99 |
|---|---|---|
| `Run.tick`, 200 vivos, input (1, 0) | 0,0081 ms | 0,0132 ms |
| `Run.tick`, 200 `bug` encima del jugador | 0,0079 ms | 0,0105 ms |
| `Run.snapshot()`, 200 vivos | 0,0037 ms | 0,0040 ms |

- El contacto por fuerza bruta cuesta unos 0,001 ms por tick con 200 enemigos. El margen sigue siendo de unas
  250 veces respecto a los 2 ms, así que no hace falta rejilla espacial ni *struct of arrays* en este change.

## Consecuencias
- Margen de unas 290 veces respecto al umbral de 2 ms por tick: el diseño actual basta para el tope de vivos.
- Hay que volver a medir cuando se añadan colisiones y armas (más trabajo por tick).
- La mutabilidad queda confinada al agregado; los tests de snapshot congelado protegen que no se filtre.
