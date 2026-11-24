# Retrospectiva · 0018-map-culling

- **Fechas**: inicio 2026-11-23 → archivado 2026-11-24
- **PR**: #43 (squash `b68068b`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 10 / 10 casillas de `tasks.md` (1 sin trabajo de dominio y aplicación; 5.2 hecha por el orquestador) |
| Commits (asistidos por IA) | 15 (15) en la rama, fusionados en squash |
| Tests añadidos | +36 / −1 casos (`it`/`test`) en el diff de `src` y `tests`; unitarios de 1.925 a 1.991 (170 → 171 ficheros); E2E `logic` siguen en 13 (0 nuevos, "Cámara" ampliado) |
| Hallazgos verify (C / W / S) | 0 / 4 / 3 (W1 lo resolvió el orquestador; W4 = 5.2 al archivar; W2, W3 y S1–S3 quedan como deuda) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 1 `sdd-explorer`, 2 `sdd-spec-writer` (propose, spec), 2 `sdd-architect` (design; contraste + tasks), 1 `sdd-implementer`, 1 `sdd-verifier` |

Mediciones antes (0017) → después (0018):
- Local `CI_LIKE=1`: fps 14,1 → 19,8 (42) y 12,9 → 22,8 (123); calibración 16,5 → 18,0 fps con p95 133,3 → 83,4 ms;
  `drawn`/`objects` 106/667 y 67/750.
- CI, run del PR: Cámara 56,2 → 38,5 s; Sprites 33,7 → 27,8 s; Mapa real 55,4 → 42,1 s; suite 1,8 → 1,4 min.
  G1 no se cumple, porque Cámara y Mapa real siguen por encima de 30 s, así que se mantiene `test.slow()`.

## Qué fue bien
- Medir primero dio una línea base comparable (mismo comando y misma máquina) y sacó a la luz pronto el riesgo del
  relleno de píxeles. La exploración lo anticipó y el resultado de CI lo confirmó: mejora, pero no se vuelve a 0016.
- La regla de recorte es pura y la vista se calcula sin el desfase de `worldView`, así que casi todo se probó con
  unitarios. No hizo falta ningún E2E nuevo.
- Contrastar la spec con el design antes de tasks destapó una incoherencia en el margen (vista ampliada a celdas
  enteras en el design, margen exacto en la spec). El usuario la resolvió en el gate y no llegó a apply.
- Una sola ronda de apply y de verify, sin Critical.

## Qué fue mal / dónde falló la IA
- El implementer editó código desde la shell tres veces con `node -e` y una con heredoc, contra AGENTS.md §8.1.
  Las de `node -e` borraron trozos de comentarios y de un lienzo de test. Lo arregló antes del commit (W3).
- `npm.cmd run …` desde Git Bash fallaba con "no se encuentra la ruta". Se usó `npx npm run` / `npx playwright`.
- La estimación del design para `drawn` (un cuarto o un tercio de `objects`) se quedó corta: en la práctica es entre
  el 9 % y el 16 %.

## Desviaciones respecto a spec o diseño
- Spec y design en paralelo: el design ampliaba la vista a celdas enteras y la spec exigía un margen M exacto. Se
  resolvió a favor de la spec: regla exacta en cada frame y `setVisible` solo donde cambia el estado.
- Las cajas de los sprites se redondean a 1/1024 px (error en coma flotante de la fila 0). Está anotado en el design.
- `show` del adaptador entró en 3.1 y no en 4.1, porque el typecheck lo exigía.

## Lecciones → acciones
- El recorte por objetos no compensa el relleno de píxeles de una ventana más grande → si la duración de CI vuelve a
  molestar, valorar bajar la ventana de los E2E del mapa real (anotado como alternativa en la conversación del
  gate; sin acción todavía).
- Los subagentes siguen editando con la shell pese a §8.1 → reforzarlo en el prompt de `sdd-implementer` (deuda de
  proceso; candidata a chore).
- Con spec y design en paralelo, el orquestador debe buscar choques de reglas cuantitativas (márgenes, bordes,
  redondeos) antes de tasks → ya lo pide `sdd-workflow` §3 ("Contraste final del design"), y aquí funcionó.
