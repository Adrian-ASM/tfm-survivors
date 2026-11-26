# Retrospectiva · 0031-combat-feedback

- **Fechas**: inicio 2026-11-26 → archivado 2026-11-26
- **PR**: #80

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 12 / 12 |
| Commits (asistidos por IA) | 6 (6) |
| Tests añadidos | 98 (3.756 → 3.854 en `verify`); 1 E2E ampliado, ninguno nuevo |
| Hallazgos verify (C / W / S) | 0 / 2 / 3 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 2 rondas de preguntas al autor (antes de propose y en el gate) |

## Qué fue bien
- Las decisiones abiertas (daño aplicado, suma por tick, colores, tope, arte y dónde vive el contenido) se
  cerraron con el autor **antes** de propose y en el gate, así que spec y design en paralelo coincidieron en lo
  esencial (golpe del jugador fuera del tope incluido).
- El registro de golpes devuelve lo mismo que `takeDamage`: balance, `BUILDER_REFERENCE` y las seis firmas
  intactas sin regenerar; objetos del mapa 820/904 intactos.
- La medición alterna `main`/change en la misma máquina detectó a tiempo el sobrecoste de la búsqueda lineal.

## Qué fue mal / dónde falló la IA
- El design estimó el coste del tick (< 0,01 ms) sin medir; la búsqueda lineal real subía el tick +12–16 % por los
  golpes descartados con el tope lleno.
- El architect no pudo hacer `git fetch` (sin Bash) para numerar el ADR; lo comprobó el orquestador.
- Comprobar el tinte en el navegador integrado costó varias vueltas: con el panel oculto `requestAnimationFrame`
  no avanza y `step(n)` no se consume; los eventos de teclado sintéticos no mueven al jugador.

## Desviaciones respecto a spec o diseño
- D1: suma por objetivo con un `Map` por tick (solo consulta por clave) en lugar de búsqueda lineal; `HitRecord` sin
  objetivo. Recogido en `design.md` tras el W1.
- `content/combat.json` y su esquema entraron en el commit del dominio (los necesitaba `loadRunConfig`).
- Escenario de determinismo con `heldInputs` (seed 10): `randomInputs` con seed 42 no golpea en 600 ticks.
- `JUMP_PX` en los escenarios de pulso y proyectil en el mismo tick.

## Lecciones → acciones
- Un coste por golpe con tope lleno es el peor caso, no el típico → el `sdd-architect` estima el peor caso con el
  tope saturado y lo mide en apply antes de cerrar el grupo de dominio (nota «Coste por tick con tope» en `sdd-workflow`).
- Para comprobar render a mano en el navegador integrado → mostrar el panel antes de `step(n)` y, para un color,
  cambiar temporalmente el dato de aspecto a uno inconfundible (anotado en el diario de IA).
