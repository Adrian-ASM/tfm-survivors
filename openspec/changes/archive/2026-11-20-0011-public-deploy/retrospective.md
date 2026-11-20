# Retrospectiva · 0011-public-deploy

- **Fechas**: inicio 2026-11-20 → archivado 2026-11-20
- **PR**: #24 (squash `a6a7ba9`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 15 / 15 (3.4 marcada como "no aplica": no hubo 404 de favicon) |
| Commits (asistidos por IA) | 13 (13) |
| Tests añadidos | 27 unitarios/guardarraíl (1169 → 1196) + 4 de smoke remoto (`tests/remote/public.spec.ts`) |
| Hallazgos verify (C / W / S) | 0 / 4 / 3 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 2 (contraste design ↔ spec antes de tasks; corrección de la spec con 3 puntos) |

Smoke contra la URL pública: 4/4 en ~8 s (presupuesto 180 s). CI del PR: `setup`, `quality` y `e2e` en verde.

## Qué fue bien
- La exploración descubrió que el despliegue **ya existía** y funcionaba (run `44796176861` con `deploy` verde).
  El orquestador lo confirmó con `gh api .../pages` y `curl` antes de proponer, y el alcance se redujo a contrato y
  evidencia en lugar de construir un despliegue nuevo.
- Las preguntas al usuario antes de *propose* (smoke a demanda frente a automático; aceptar `frame-ancestors`
  inaplicable) fijaron el alcance y evitaron gastar minutos de CI en cada push.
- El contraste design ↔ spec antes de *tasks* (acción de la retro de 0006) detectó a tiempo `speed` 8 frente a 15,
  el presupuesto de 180 s incompatible con `retries: 2` y escenarios sin diseño (404, HTTP→HTTPS).
- `ci.yml` y `ci.test.ts` quedaron intactos: el smoke vive en config, carpeta y workflow propios, y un guardarraíl
  estático lo aísla.

## Qué fue mal / dónde falló la IA
- **Hooks desactivados en el worktree**: el `config.worktree` fijaba `core.hooksPath` en una ruta absoluta del
  checkout principal que no existe. Cinco commits del apply entraron sin lint-staged ni `guard-staged`. Lo detectó
  el implementer porque prettier no había formateado los ficheros nuevos; el orquestador lo corrigió tras el apply
  (verify W1/W3).
- **La spec pidió cosas no comprobables de forma permanente**: un test en `verify` de "ci.yml sin diff con main" y
  "mismo nº de E2E" rompería cualquier change futuro, y `git diff main` no funciona en el checkout de Actions. El
  arquitecto lo señaló y pasaron a comprobaciones del verifier.
- **Dato inventado en la spec**: `outcome` `defeat` cuando el historial guarda `'won' | 'lost'`. El spec-writer
  no contrastó el esquema de `progress-persistence`.

## Desviaciones respecto a spec o diseño
- `testMatch: '*.spec.ts'` en la config remota (no estaba en el design): sin él Playwright cargaba el
  `target.test.ts` de Vitest.
- Helper `misplacedRefs` añadido al análisis del HTML servido.
- `timeout-minutes` exactamente 8 (spec) en lugar del "≤ 10" de la tarea.
- Escenarios de CI (PR, solo docs, e2e en rojo) solo con análisis estático de `ci.yml` (verify W4).

## Lecciones → acciones
- Un worktree creado por la app puede heredar un `core.hooksPath` absoluto roto → al preparar el change, comprobar
  `git config --get core.hooksPath` y que la carpeta existe (añadirlo a la skill `worktree-flow`).
- Los escenarios con valores de dominio deben citar el esquema real → el `sdd-spec-writer` contrasta enumeraciones
  y nombres de campo con las specs vivas antes de escribirlos.
- "Sin cambios respecto a main" es una comprobación de un change, no un requisito permanente → redactarlo como
  tarea del verifier, no como escenario de `verify`.
