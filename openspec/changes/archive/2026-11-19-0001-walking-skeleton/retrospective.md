# Retrospectiva · 0001-walking-skeleton

- **Fechas**: inicio 2026-11-19 → archivado 2026-11-19
- **PR**: #2 (comprobación de CI con la rama desechable del PR #3)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 28 / 28 (19 del plan + 9 de las rondas de corrección 5.1–5.9) |
| Commits (asistidos por IA) | 19 sin contar merges (19) |
| Tests añadidos | 87 unitarios/contrato en 10 ficheros + 1 smoke E2E (45 tras el primer apply) |
| Escenarios de spec cubiertos por test | 29 / 29 |
| Hallazgos verify (C / W / S) | 1.ª pasada 0 / 8 / 7 · 2.ª pasada 0 / 2 / 8 · tras el CI real 0 / 1 / 8 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 1 / 1 (más 1 del guard en pre-commit; los tres intencionados) |
| Rondas de apply | 3 (plan inicial, correcciones del verify, N2 + N5) |
| "Commit limpio" (50 ficheros) | ~2.030 ms → ~145 ms |
| Bundle | 1.439,84 kB (378,90 kB gzip) |

## Qué fue bien
- Los escenarios con números concretos detectaron un error de la propia spec antes de implementar (120 Hz con
  2 × 8,333 ms no llegaba a un tick).
- El verificador independiente encontró problemas reales que el implementador no vio: evasiones de las reglas
  (`import()` dinámico, `globalThis.localStorage`), margen de rendimiento casi nulo y una spec que no se cumplía
  tal como estaba escrita.
- Una sola fuente de reglas para hook, pre-commit y CI: la violación subida con `--no-verify` la paró el CI real.
- El estado del change vivía en el repo (`tasks.md`, `verify-report.md`, diario), así que la migración del chat a
  Claude Code no perdió contexto.

## Qué fue mal / dónde falló la IA
- En el chat no había subagentes: el orquestador escribió spec, design, tasks y código (separación de roles rota).
- Tests más laxos que la spec (tolerancias de 0,005 px frente a 0,001) y tests que no ejecutaban `git commit`.
- Los heredocs de Git Bash alteraron `\` y rompieron ficheros; se detectó al ejecutar y costó reintentos.
- **Falso positivo del verificador (W8)**: dijo que los 6 commits iniciales no llevaban `Assisted-by`. Sí lo
  llevan, pero separado de los demás trailers por una línea en blanco, y no se reconoce como trailer de git.
- Un subagente se cortó al reiniciarse la sesión; se retomó desde su historial sin perder trabajo.

## Desviaciones respecto a spec o diseño
- TypeScript 6.0.3 en lugar de 7.0.2 (compatibilidad con typescript-eslint).
- `no-restricted-imports` por capa en lugar de `eslint-plugin-boundaries`.
- `guard-staged.mjs` pasó de un proceso por fichero a ejecutar los hooks en proceso (ronda 2).
- La validación del radio pasó de `StartRun` a la carga del contenido para cumplir la spec tal como está escrita.
- Commits por bloque de tareas en el primer apply en lugar de uno por tarea.
- Todo quedó reflejado en `design.md` antes de archivar.

## Lecciones → acciones
- Los guardarraíles que viven en un solo agente no protegen el repo → reglas compartidas en pre-commit y CI (hecho).
- Cada subagente arranca en frío y es caro → modelo por agente y reglas de coste en AGENTS.md §8.1 y la skill
  `sdd-workflow` §3.1 (PR #4).
- Los hooks de Claude Code son los de la carpeta de la sesión → una sesión por worktree de change.
- Heredocs en Windows → Edit/Write para código (AGENTS.md §8.1).
- Trailers de commit → escribir `Assisted-by` en el mismo bloque que `Co-Authored-By`, sin línea en blanco entre ellos.
- Pendiente: reporters escuetos en Vitest (`dot`) y Playwright (`line`), ahora que la configuración llega a `main`.
- Deuda registrada en el verify-report: N1, N3, N4 (evasiones rebuscadas y casos límite del hook), S9 y S12.
