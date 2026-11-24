---
name: sdd-workflow
description: Orquesta un change de Spec-Driven Development de principio a fin (explore, propose, spec, design, tasks, apply, verify, archive) delegando cada fase en su subagente y respetando los gates humanos. Úsala para nueva funcionalidad, mecánica, change, spec, propuesta (EN feature, proposal, new mechanic). NO la uses para cambios triviales (texto, color, constante) ni para spikes.
---

# SDD workflow (orquestador)

Tú eres el orquestador: hablas con el usuario, decides la fase y delegas. Mantén tu contexto limpio: pide a los
subagentes resúmenes cortos, no volcados de ficheros.

## 0. Decidir si aplica

Consulta la matriz de AGENTS.md §5. Si es trivial → prompt directo. Si es incierto → propone un spike `spike/<tema>`.

## 1. Preparar el change

1. Id: `NNNN-kebab-case` (siguiente número libre en `openspec/changes/` y `openspec/changes/archive/`).
2. Worktree y rama: skill `worktree-flow` → `change/NNNN-…`. Si el worktree ya existía, comprueba que tiene
   `node_modules` (si no, `npm ci`) antes del primer commit, también el de los artefactos de planificación.
3. Crea `openspec/changes/<id>/` y, si existe una issue en GitHub, anota su número en `proposal.md`.

## 2. Fases

| # | Fase | Subagente | Artefacto | Gate |
|---|---|---|---|---|
| 1 | explore | `sdd-explorer` | `exploration.md` | — |
| 2 | propose | `sdd-spec-writer` | `proposal.md` | **Humano: aprobar alcance** |
| 3 | spec ∥ design | `sdd-spec-writer` ∥ `sdd-architect` | `specs/**/spec.md`, `design.md` | — (lánzalos en paralelo) |
| 4 | tasks | `sdd-architect` | `tasks.md` | Humano (rápido): revisar tareas |
| 5 | apply | `sdd-implementer` | código + tests + commits | — |
| 6 | verify | `sdd-verifier` | `verify-report.md` | Critical > 0 → volver a 5 |
| 7 | revisión | usuario | PR en GitHub | **Humano: aprobar** |
| 8 | archive | tú, con skill `sdd-archive` | specs vivas + retrospectiva | — |

Tras cada fase, resume al usuario en ≤ 5 líneas: qué se produjo, decisiones abiertas y siguiente paso.

## 3. Reglas

- Nunca saltes un gate humano, aunque el usuario esté ausente: deja el trabajo preparado y para.
- El `sdd-verifier` no puede ser el mismo agente que implementó. Lánzalo siempre como subagente nuevo.
- Si en apply aparece un requisito nuevo, vuelve a spec (no lo cueles en el código).
- **E2E ligeros** (AGENTS.md §2, chore `e2e-lite`): pide al `sdd-architect` que en `tasks.md` cubra cada escenario
  con test unitario o de aplicación y reserve el E2E para lo que exige navegador (DOM, render, almacenamiento
  real): máximo 1–2 E2E nuevos por change, en modo manual y sin umbrales de fps ni de tiempo real en el gate.
- En apply, al cerrar cada sección de `tasks.md`, haz `git fetch` y mira si `origin/main` avanzó; si avanzó,
  rebasa antes de seguir (0014).
- Fases pequeñas pueden fusionarse (`spec+design+tasks` en un paso) si el usuario lo pide: anótalo en la retrospectiva.
- **Mediciones previas**: si `exploration.md` las pide, ejecútalas antes de *propose* (test temporal fuera del
  repo o un `sdd-implementer` acotado que no versiona nada) y pasa los números al `sdd-spec-writer`. Un objetivo
  de balance no entra en la propuesta sin datos (0006: el design previó ajustes que no servían). Antes de pasar
  la configuración medida, contrástala con las specs vivas que la restringen (monotonía de oleadas, escenarios
  con ticks fijos): en 0017 una tabla medida incumplía "Oleadas que crecen" y dos escenarios rompieron en apply.
- **Contraste final del design**: spec y design van en paralelo, así que al pedir *tasks* indica al
  `sdd-architect` las specs delta que no existían cuando escribió el design y que las contraste antes de
  descomponer (0006: dos specs llegaron tarde y obligaron a reabrir el design). Pide también que contraste los
  criterios de éxito de `proposal.md` con las specs (0013: uno contradecía la spec de spawn).

## 3.1 Coste (créditos)

Cada subagente arranca en frío y vuelve a leer design, specs y skills: ese arranque es el gasto fijo.
- **Agrupa correcciones**: tras un verify, una sola ronda de apply con todos los hallazgos que se vayan a resolver.
  Las Suggestions que no compensen una ronda se registran como deuda en el verify-report.
- **Correcciones triviales** (una línea, un texto, un trailer) las hace el orquestador si el usuario lo pide, sin
  lanzar subagente; anótalo en el diario de IA.
- **Re-verify acotado**: la segunda pasada del `sdd-verifier` revisa solo los hallazgos previos y el diff
  `<commit del informe>..HEAD`, no el change entero.
- Para retomar un subagente cortado, envíale un mensaje (conserva su contexto) en vez de lanzar uno nuevo.
- Cierra la sesión al archivar: el siguiente change empieza en una sesión nueva en su worktree; el estado vive en
  `tasks.md`, `verify-report.md` y `docs/ai-log/`.

## 4. Plantillas

`references/proposal.md`, `references/spec.md`, `references/design.md`, `references/tasks.md`.
