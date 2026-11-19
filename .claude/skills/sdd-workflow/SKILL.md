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
2. Worktree y rama: skill `worktree-flow` → `change/NNNN-…`.
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
- Fases pequeñas pueden fusionarse (`spec+design+tasks` en un paso) si el usuario lo pide: anótalo en la retrospectiva.

## 4. Plantillas

`references/proposal.md`, `references/spec.md`, `references/design.md`, `references/tasks.md`.
