# Retrospectiva · 0012-sprite-rendering

- **Fechas**: planificado y aparcado 2026-11-20 → retomado tras el GDD v2.0 y archivado 2026-11-22
- **PR**: #28 (squash `280e89a`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 33 / 33 (8.2, el GDD, la hizo el orquestador con el `game-designer`) |
| Commits (asistidos por IA) | 27 (27) en la rama, más el commit de planificación aparcada |
| Tests añadidos | 186 unitarios y de guardarraíl (1199 → 1385) y 15 E2E (48 → 63) |
| Hallazgos verify (C / W / S) | 0 / 7 / 5 → re-verify 0 / 0 / 5 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 2 (dos runs de `e2e` en rojo en el PR) |
| Iteraciones de prompt relevantes | 4 (preguntas de alcance antes de *propose*, ronda de warnings y dos arreglos de E2E en CI) |

Apply: unos 46 minutos y 310 llamadas a herramientas. Verify: 4 minutos. `dist/` pesa 1,76 MB, de los que los
8 PNG son 220 KB. CI del PR: verde al tercer run.

## Qué fue bien
- **La planificación aparcada se aprovechó.** El rebase sobre el GDD v2.0 solo chocó en `docs/gdd.md`. La
  exploración separó lo reutilizable (render puro, costura `SpriteLike`, `imageLoadType` para la CSP, sonda) de
  lo obsoleto (arte local descubierto en build y placeholders por defecto).
- **Las preguntas antes de *propose* fijaron el alcance en una sola vuelta:** jugador Arquero, ids por unidad del
  pack, renombrado dentro del change y el arte concreto que entraba.
- **El núcleo no cambió:** `src/domain`, `src/application` y `run.json` sin diff, y la banda de balance 25–35 en
  verde sin recalibrar.
- **La procedencia se comprueba, no solo se documenta:** la nota guarda sha256 y bytes de cada imagen, así que un
  PNG del Free Pack renombrado no pasa el guardarraíl.
- **El fallo de E2E en CI se reprodujo en local antes del último push:** `CI_LIKE=1` con la CPU saturada dio los
  mismos fallos que el runner.

## Qué fue mal / dónde falló la IA
- **Hooks de commit inactivos otra vez** (como en 0011): el worktree reutilizado no tenía `node_modules` y su
  `core.hooksPath` apuntaba a una ruta que no existe. La planificación y 6 commits del apply entraron sin
  pre-commit, y hizo falta un commit `style: prettier`. La skill ya avisaba de este fallo y se pasó por alto al
  reutilizar el worktree.
- **El orquestador trabajó fuera del worktree del change**, porque la sesión se abrió en otro. Funcionó con rutas
  absolutas, pero obligó a que cada comando hiciera `cd` y a coordinar los subagentes a mano.
- **Hubo que retocar las specs a mano:** spec y design en paralelo dejaron marcadores `{ex-*}` y notas
  redundantes que el orquestador tuvo que sustituir y limpiar.
- **Los E2E suponían ~60 fps.** Esperas de reloj real (tick 120 en 5 s, enemigo en 3 s, derrota en ≤ 12 s) y una
  carrera tras R (leer "cuando llegue" con 480 ticks de margen) funcionaban con círculos. Con sprites en el runner
  sin GPU fallaron, cada vez tests distintos. El primer diagnóstico del orquestador (la GPU) era incompleto: el
  render por software solo no lo reproducía y hubo que saturar la CPU. Esa explicación llegó al usuario antes de
  estar confirmada.
- **TDD saltado** en las tareas 4.1 y 4.3 (test y código en el mismo paso), según el diario del apply.

## Desviaciones respecto a spec o diseño
- La nota de procedencia vive en `content/asset-provenance.json` y no en `public/`, porque `vite dev` rechaza
  importarla desde allí (riesgo R6 previsto).
- El andar del Barrel son los frames 24–26 y no los 18–23 del design (que son la secuencia de esconderse).
  Se comprobó en la hoja y en `vite dev`.
- El origen del sprite está en el centro de la hitbox y no en los pies (design D5 frente a la proposal).
- El límite de 12 s de la derrota acelerada (criterio de la propuesta 0008, no de una spec viva) solo se comprueba
  fuera de CI. En CI se anota.

## Lecciones → acciones
- Reutilizar un worktree sin dependencias desactiva los hooks → `worktree-flow`, `sdd-workflow` y
  `sdd-implementer` piden `npm ci` y comprobar `core.hooksPath` antes del primer commit (PR #27).
- Los E2E no pueden depender de los fps de la máquina → la config de Playwright da márgenes de CI (`expect` 15 s
  y test 60 s), existe `CI_LIKE=1` y AGENTS.md pide reproducir en local antes de hacer push cuando el change toca
  render o E2E. Nunca se itera con pushes a ciegas.
- Un change que mezcla renombrado, guardarraíl, arte y E2E da 33 tareas y unos 46 minutos de apply → partir los
  changes Must siguientes (0013–0015) en piezas más pequeñas. El renombrado mecánico puede ir por prompt directo.
- El bucle TDD no necesita la suite completa en cada vuelta → `verify:fast` y E2E selectivos durante apply (PR #27).
- Los textos de mejoras y armas siguen siendo del tema anterior ("Linter", "Tests", "Ventana de contexto") →
  change pequeño de textos medievales (arco, tajo…) antes o junto a 0013.
- Riesgo que queda: "Modo E2E con velocidad" (`pause.spec.ts`) midió una vez 0 ticks por frame con una carga
  extrema en local. Vigilarlo en CI.
