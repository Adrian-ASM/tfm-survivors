# Retrospectiva · 0007-local-save-export

- **Fechas**: inicio 2026-11-20 → archivado 2026-11-20
- **PR**: #14 (squash `450bcca`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 23 / 23 (0.1–4.5; 4.2 y 4.3 en un mismo commit) + 5 correcciones tras verify |
| Commits (asistidos por IA) | 27 (27) en la rama, fusionados por squash |
| Tests añadidos | +116 unitarios (930 → 1046) · +6 E2E (7 → 13; `progress.spec.ts` y casos en `results.spec.ts`) |
| Hallazgos verify (C / W / S) | 0 / 3 / 4 → tras una ronda de correcciones 0 / 0 / 2 (S2 y S4, deuda aprobada) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 2 (consulta de Phaser por HTTP al no cargar el MCP; ronda única de correcciones) |

## Qué fue bien
- Cuatro preguntas de alcance resueltas por el usuario antes de la propuesta (alcance B, datos del historial,
  importar fusionando, CSP en este change): la propuesta pasó el gate a la primera.
- La lección de 0006 sobre spec ∥ design funcionó: el arquitecto dejó la cobertura pendiente y la cerró en tasks
  con las specs definitivas; encontró 4 huecos (interfaz `FinishedRunSource`, aviso de carga dañada, `pickedFile`,
  reinicio inmediato en navegador) antes de implementar.
- La medición se hizo antes de especificar el coste (tareas 0.1/0.2, lección de 0006): 163 s reales frente a 170 s
  estimados y bajo el umbral de parada de 240 s.
- Fusión determinista (orden total sobre los 6 campos): idempotente y conmutativa, probada como propiedad.
- CSP estricta sin `'unsafe-*'`; la violación de zod 4 (`eval` del JIT) la detectó el E2E que escucha
  `securitypolicyviolation`, no un usuario.
- Re-verify acotado al diff de la ronda de correcciones: 3 llamadas a herramientas frente a 19 del verify completo.

## Qué fue mal / dónde falló la IA
- El MCP `phaser-docs` no cargó en la sesión de la app: el `main` local estaba 4 commits por detrás y la app
  registra los conectores con un id interno, así que los subagentes (frontmatter `mcp__phaser-docs__*`) no los ven.
  Se suplió llamando al mismo servidor por HTTP con `curl`.
- La documentación publicada de Phaser no cubre CSP ni texturas por defecto: hubo que ir a `node_modules/phaser`.
- TDD sin rojo propio en 4.1–4.4 (E2E que ya pasaban por la 3.7) y código antes del rojo en la 1.3.
- El implementador escribió `tests/e2e/probe.ts` con un heredoc, prohibido en AGENTS.md §8.1 (W3; el fichero no
  se dañó).
- La desviación de zod (`jitless`) no se documentó en design/ADR hasta el verify (W2).
- La suite E2E pasó de ~1,5 a ~4,2 min: cada derrota espera ~78 s reales.

## Desviaciones respecto a spec o diseño
- `z.config({ jitless: true })` en `src/infrastructure/validation/cspSafeZod.ts`, primer import de `main.ts`,
  protegido por `tests/guardrails/csp-zod-import.test.ts`. Recogido en design.md y nota en ADR-0004.
- `allowImportingTsExtensions` en `tsconfig.json` (import de `config/csp.ts` desde Vite).
- `readProgressFile` trata un fallo de lectura como "no válido"; la URL de descarga se revoca 1 s después del clic;
  `place-content: center` en `#game`; campo `shown` nuevo en el probe.
- Semilla 90 fijada como regresión en `balance.test.ts` (tope 4.560 ticks) para el E2E de almacenamiento bloqueado.
- La rama la creó la app como `claude/…` en el worktree `enemy-spawning-0002-…`; el orquestador la renombró a
  `change/0007-local-save-export`.

## Lecciones → acciones
- Los subagentes no ven los conectores MCP de la app → añadir a `sdd-implementer` y `sdd-architect` el plan B por
  HTTP (JSON-RPC con `curl`) contra `https://phaser.io/oss/docs/mcp` (hecho al archivar).
- E2E lentos por esperar derrotas en tiempo real → change 0008 `e2e-fast-sim` (GDD v1.1, "Próximos changes").
- Desviaciones técnicas que cambian una decisión de seguridad (CSP) → el implementador las anota en design.md en la
  misma tarea, no solo en el diario de IA.
- Antes de abrir una sesión de change, `git pull --ff-only` en `main` para que la configuración del proyecto
  (`.mcp.json`, agentes, hooks) esté al día.
- Deuda S2 (semilla 90) y S4 (semilla del historial desde el probe) → GDD, changes 0009/0010.
