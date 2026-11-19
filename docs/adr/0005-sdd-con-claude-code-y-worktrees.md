# ADR-0005 · SDD con Claude Code, subagentes y git worktrees

- **Estado**: aceptada
- **Fecha**: 2026-11-19

## Contexto
El temario propone SDD con orquestador + subagentes por fase, specs vivas y archivado con evidencia. La hoja de ruta
inicial contemplaba Copilot en VS Code + OpenSpec CLI + gentle-ai/Engram. Se trabaja con Claude Code directamente.

## Decisión
- **Layout OpenSpec** (`openspec/specs` + `openspec/changes` + `archive`) como contrato de ficheros.
- **Orquestación propia** en el repo: skill `sdd-workflow` (orquestador = sesión principal) y un subagente por fase en
  `.claude/agents/`. El verificador es siempre un subagente distinto del implementador.
- **Retrospectiva** obligatoria al archivar (`sdd-archive`): el histórico de decisiones queda en el propio repo.
- CLI de OpenSpec **opcional** (p. ej. para `validate`); no se adopta gentle-ai/Engram para reducir piezas.
- **Un change = una rama `change/*` = un worktree**, lo que permite varias sesiones de Claude en paralelo sin pisarse.
- `AGENTS.md` es la fuente de verdad; `CLAUDE.md` la importa.

## Consecuencias
- Todo el proceso es visible y versionado; sirve como "kit reutilizable" para la memoria.
- Mantener las skills es trabajo propio (no hay actualizaciones de terceros).
- Cada worktree necesita su `npm ci` (más disco).
