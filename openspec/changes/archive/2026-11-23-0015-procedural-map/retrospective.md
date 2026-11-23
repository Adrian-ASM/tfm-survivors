# Retrospectiva · 0015-procedural-map

- **Fechas**: inicio 2026-11-23 → archivado 2026-11-23
- **PR**: #36

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 22 / 22 |
| Commits (asistidos por IA) | 25 (25) en la rama, fusionados en squash (`028b1b7`) |
| Tests añadidos | ~131 casos (`it`/`test`) nuevos; unitarios de 1.554 (main) a 1.720; E2E de 113 a 130 |
| Hallazgos verify (C / W / S) | 0 / 5 / 4 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 1 (job `e2e` cancelado por timeout de 10 min en el primer CI del PR) |
| Iteraciones de prompt relevantes | 1 `sdd-explorer`, 1 `sdd-implementer` de mediciones previas, 2 `sdd-spec-writer` (propose, spec), 2 `sdd-architect` (design, design rev. 2 + tasks), 3 rondas del `sdd-implementer` de apply (1–3.2, 3.3–7, fix de render), 1 `sdd-verifier` |

Rendimiento: generación 0,36 ms/mapa (spec < 20 ms); tick con 200 enemigos sobre el mapa 0,005 ms. Balance final
29/50 con `player.speed` 210 y 0 quietos vivos a 180 s.

## Qué fue bien
- **Mediciones previas antes de propose** (lección de 0006/0010): un prototipo temporal sin versionar mostró que el
  bot actual quedaba fuera de banda (12–19/50) con cualquier densidad y que hacía falta el bot que esquiva. La
  propuesta llegó al gate con números, no con suposiciones.
- **Partición en el gate** (lección de 0012): mapa puro + colisión + balance con colores de reserva en 0015, y el arte
  en 0016. 22 tareas frente a las 33 de 0012; el riesgo visual (autotile) no bloqueó la lógica.
- **Flujo de azar propio del mapa** (ADR-0013): el mapa no desplazó las oleadas de las 50 semillas; la referencia sin
  mapa siguió en 25/50.
- **Puerta de balance como checkpoint temprano**: el usuario eligió `speed` 210 con la tabla delante.

## Qué fue mal / dónde falló la IA
- **Regresión de rendimiento invisible en local**: la capa del terreno del tamaño del mundo (CanvasTexture ×60,
  transparente en la hierba) bajó la calibración en CI de 14,7 a 7,3 fps; dos E2E de 600 frames agotaron su minuto y
  el job `e2e` se canceló. La pasada `CI_LIKE` local frena la CPU pero la GPU sigue dibujando, así que no lo cazó.
  Se midió A/B en local sin vsync (150 → 202 fps) y se corrigió pintando solo los tramos no-hierba.
- **El design predijo mal el balance**: esperaba que el mapa bajara las victorias y las subió (25 → 27 con 200).
- **Primera estimación de agua errónea** (design rev. 1: 2–4 %; real 3,4–6,4 %) por no contar las celdas de enlace
  de los meandros.
- **Hooks de commit sin ejecutar** en 1.1–1.4: `core.hooksPath` del worktree apuntaba a una ruta inexistente (igual
  que en 0014). `verify` en verde antes de cada commit, pero sin pre-commit.
- **TDD sin rojo visto** en 4.2, 5.1 y 5.2 (W5).
- El verifier afirmó que `b2c43c0` no tenía trailers; sí los tenía. Hay que contrastar sus hallazgos de proceso.

## Desviaciones respecto a spec o diseño
- Regla "resto del mundo 0 o ≥ 2r" retirada (W3, deuda aceptada): la spec exige aceptar celdas de 32 px con 1.080 de
  alto. Anotado en design §12; las specs vivas no la prometen.
- Render del mapa: de CanvasTexture escalada a rectángulos por tramo en una `Layer` (design §12, `7704b2b`).
- Zona de inicio: las 36 celdas del bloque 13..18 × 6..11, sin quitar esquinas.
- `gameUrl` de los E2E usa `map=empty` por defecto; los del mapa piden `map: 'real'`.
- GDD renumerado dentro del PR (`b2c43c0`): 0016 map-art, 0017 fullscreen-view, 0018 flow-field, Should 0019–0023.

## Deuda que queda
- W1: `throttle.spec` falló 3/138 en `CI_LIKE` antes del fix de render y pasó tras él; sin pasada base en main.
- W3: regla del resto de celda (ver arriba).
- S: ver `verify-report.md`.

## Lecciones → acciones
- Los E2E de tiempo real y la pasada `CI_LIKE` cuestan más de lo que aportan en un TFM y no reproducen el runner sin
  GPU → PR `chore(tooling)` tras este archivo: E2E de humo (10–15), `realtime` fuera del gate del PR (a demanda),
  `CI_LIKE` opcional y regla en AGENTS.md / skills `test-writer` y `sdd-workflow` de máximo 1–2 E2E por change.
- Una capa del tamaño del mundo cuesta relleno por frame sin GPU → en `design` de render, preferir dibujar solo lo
  visible/no vacío; nota en la skill de diseño o en AGENTS.md si se repite.
- `core.hooksPath` roto en worktrees creados por la app (0014 y 0015) → comprobarlo en la skill `worktree-flow` al
  empezar cada change (`git config --worktree --get core.hooksPath`).
