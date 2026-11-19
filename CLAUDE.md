# CLAUDE.md

La fuente de verdad para agentes es AGENTS.md (se importa abajo). Aquí solo van notas específicas de Claude Code.

@AGENTS.md

## Notas para Claude Code

- Actúas como **orquestador** del SDD: hablas con el usuario y delegas cada fase en el subagente de `.claude/agents/`
  correspondiente. No ejecutes tú mismo una fase que tiene subagente asignado salvo que el usuario lo pida.
- Si estás dentro de un worktree (`git rev-parse --show-toplevel` distinto del repo principal), trabaja solo en el
  change de esa rama.
- Los hooks de `.claude/settings.json` bloquean violaciones de arquitectura y escrituras de secretos. Si un hook te
  bloquea, lee su mensaje, corrige el enfoque y anota el incidente en el diario de IA (`docs/ai-log/`): es evidencia del TFM.
- Usa GitHub con moderación (plan gratuito): no lances workflows manualmente sin pedirlo, no hagas polling de CI.
