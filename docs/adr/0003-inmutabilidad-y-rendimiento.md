# ADR-0003 · Inmutabilidad frente a rendimiento

- **Estado**: aceptada (validada con benchmark en el change 0002-enemy-spawning)
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

## Consecuencias
- Margen de unas 290 veces respecto al umbral de 2 ms por tick: el diseño actual basta para el tope de vivos.
- Hay que volver a medir cuando se añadan colisiones y armas (más trabajo por tick).
- La mutabilidad queda confinada al agregado; los tests de snapshot congelado protegen que no se filtre.
