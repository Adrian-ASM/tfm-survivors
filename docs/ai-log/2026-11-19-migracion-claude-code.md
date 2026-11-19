# 2026-11-19 · Migración del chat de Claude a Claude Code (app de escritorio)

- **Herramienta / modelo**: Claude Code (Opus 5.5), pestaña Code de la app de escritorio.
- **Motivo**: en el chat no había subagentes ni hooks; el orquestador redactaba fases que tienen agente propio
  (desviación anotada en `2026-11-19-0001-apply.md`). En Code, `.claude/agents/` y `.claude/settings.json` se aplican.
- **Continuidad**: la sesión retomó el change 0001 desde los ficheros (`tasks.md`, `verify-report.md`, diario),
  sin historial de chat. Bastó con que el estado viviera en el repo.
- **Coste medido (orientativo)**: ronda 2 de apply ≈ 167k tokens / 125 herramientas / 18 min; segunda pasada de verify
  ≈ 100k tokens; ronda 3 (dos tareas pequeñas) ≈ 37k tokens, la mayoría en el arranque en frío del subagente.
- **Optimización aplicada**:
  - Modelo por subagente: Opus para `sdd-spec-writer`, `sdd-architect` y `sdd-implementer`; Sonnet para
    `sdd-explorer`, `sdd-verifier` y `game-designer`.
  - AGENTS.md §8.1: salidas cortas, Edit/Write en lugar de heredocs en Windows, resúmenes al orquestador.
  - Skill `sdd-workflow` §3.1: agrupar correcciones, re-verify acotado al diff, retomar subagentes cortados.
- **Incidencias**:
  - Los hooks de Claude Code que se ejecutan son los del directorio de la sesión: trabajando desde otro worktree,
    las reglas por ruta relativa (exención de `guard-secrets`) no se aplicaban. Lección: una sesión por worktree.
  - Un subagente se cortó al reiniciarse la sesión; se retomó por mensaje desde su historial sin perder trabajo.
- **Pendiente**: reporter `dot` en Vitest y `line` en Playwright cuando la configuración de tests llegue a `main`
  (hoy vive solo en la rama del change 0001).
