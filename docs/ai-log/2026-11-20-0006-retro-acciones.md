# 2026-11-20 · Acciones de la retrospectiva de 0006

- **Herramienta / modelo**: Claude Code (claude-opus-5-5) como orquestador, a petición del usuario. Son ediciones
  pequeñas de proceso y documentación (AGENTS.md §5), sin change SDD y sin subagente.
- **Lecciones aplicadas** (ver `openspec/changes/archive/2026-11-20-0006-run-lifecycle-hud/retrospective.md`):
  1. **Medir el balance en explore.** `sdd-explorer` añade a su informe un apartado *Mediciones previas* (qué
     medir, cómo y con qué umbral). `sdd-workflow` §3 manda ejecutarlas antes de *propose*. El explorador no
     tiene Bash: las lanza el orquestador.
  2. **Contraste final del design.** `sdd-workflow` §3 y `sdd-architect` piden contrastar el design con todas las
     specs delta antes de escribir tasks.
  3. **Tareas que no ponen nada en rojo.** `sdd-architect` junta en una sola tarea las que se cumplen a la vez.
  4. **Deuda W1 y W2.** Se registran en `docs/gdd.md`, en la tabla *Deuda registrada*.
- **Desviación de rol**: la tabla de deuda del GDD la escribió el orquestador y no `game-designer`, porque solo
  registra hallazgos del verify y no decide diseño de juego.
