# ADR-0003 · Inmutabilidad frente a rendimiento

- **Estado**: propuesta (se valida con benchmark en el change de colisiones)
- **Fecha**: 2026-11-19

## Contexto
DDD recomienda VOs inmutables, pero crear miles de objetos por tick con cientos de enemigos presiona al recolector de
basura y provoca tirones.

## Decisión propuesta
- VOs inmutables en reglas y configuración (camino frío).
- En el camino caliente, el aggregate root `Run` puede usar arrays y pools mutables **internos y no expuestos**; las
  invariantes siguen protegidas por el agregado.
- Presupuesto de ms por tick fijado en la spec y medido con `vitest bench`.

## Consecuencias
Se confirmará con datos del benchmark.
