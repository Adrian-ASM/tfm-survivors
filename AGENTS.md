# AGENTS.md

> Contexto maestro para cualquier agente de IA (Claude Code, Copilot, Codex…).
> Es un **índice**: corto, con reglas no negociables y punteros. El detalle vive en skills, specs y ADRs
> y se carga solo cuando hace falta (*lazy loading*).

## 1. Visión general

**Sprint Survivors**: juego 2D *survivors-like* para navegador (TFM del Máster de Desarrollo con IA).
El jugador solo se mueve; las armas disparan solas; las oleadas crecen; al subir de nivel se elige 1 de 3 mejoras.

- **Stack**: TypeScript estricto · Vite · **Phaser 4.2.1** (ADR-0001) · Vitest · Playwright · zod.
- **Arquitectura**: Clean Architecture. El **núcleo de simulación es puro y determinista** (`src/domain`, `src/application`);
  el motor de juego es un **adaptador** (`src/infrastructure`). Ver `docs/adr/0002-nucleo-de-simulacion-puro.md`.
- **Estado del proyecto**: fase de cimientos. Fuente de verdad del comportamiento: `openspec/specs/`.

## 2. Comandos

> Disponibles a partir del change `0001-walking-skeleton`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run verify` | lint + typecheck + tests unitarios. **Ejecútalo tras cualquier cambio de código. No cierres una tarea en rojo.** |
| `npm run test:e2e` | Playwright (chromium) |
| `npm run build` | Build de producción (`dist/`) |

## 3. Reglas de arquitectura (no negociables)

1. `src/domain` no importa nada de `application`, `infrastructure`, `composition` ni del motor.
2. `src/application` no importa `infrastructure`, `composition` ni el motor.
3. `domain` y `application` **no** usan `Math.random`, `Date.now`, `performance.now`, `window`, `document` ni `localStorage`.
   Usan los puertos `RandomGenerator` y `Clock`.
4. Solo `src/composition/` conoce las implementaciones concretas (composition root).
5. El contenido del juego (armas, enemigos, mejoras, oleadas) vive en `content/*.json` validado con zod. Sin números mágicos.
6. Toda entrada externa (fichero importado, `localStorage`, red) se valida con zod antes de llegar al dominio.

Estas reglas se aplican en tres capas: hook de Claude Code (`.claude/hooks/guard-architecture.mjs`),
ESLint (IDE + pre-commit) y CI. Si un guardarraíl te bloquea, **corrige el diseño; no desactives la regla**.

## 4. Convenciones

- Entidades y VOs en PascalCase (`Run`, `Health`); casos de uso con verbo (`StartRun`, `ChooseUpgrade`).
- Puertos con nombre de dominio (`ProgressRepository`); adaptadores con prefijo técnico (`LocalStorageProgressRepository`).
- Errores de dominio tipados; `Result` en lugar de excepciones para fallos esperables.
- Líneas ≤ 100, indentación 2, sin `import *` salvo el motor en infraestructura (equivalencias del `checkstyle.xml` del curso).
- Commits: Conventional Commits, `refs: <change-id>` y trailer `Assisted-by: <herramienta/modelo>` si interviene la IA.

## 5. Flujo de trabajo: Spec-Driven Development

Nivel **Spec-Anchored**: las specs viven y evolucionan con el código.

| Situación | Enfoque |
|---|---|
| Pequeño y claro (texto, color, constante) | Prompt directo + test si aplica. Sin change. |
| Mediano/grande y claro (mecánica, guardado…) | **SDD completo** → skill `sdd-workflow` |
| Incierto ("¿es divertido?", "¿qué motor?") | **Spike** desechable en rama `spike/*`; si funciona, SDD |
| Grande y confuso ("hazlo más divertido") | Volver al GDD (`docs/gdd.md`) antes de especificar |

Fases: `explore → propose → [gate humano] → spec ∥ design → tasks → apply (TDD) → verify → [gate humano] → archive`.
Cada change trabaja en **su propio git worktree y rama** (`change/<id>`). Ver skill `worktree-flow`.

Gates humanos: **nunca** avances de *propose* a *spec/design* ni de *verify* a *archive* sin aprobación explícita del usuario.

## 6. Seguridad

- Fase 1 **local-first**: sin backend, sin cuentas, sin secretos. Guardado en el navegador + exportar/importar JSON.
- Todo lo que empiece por `VITE_` acaba en el bundle: **es público**. Nunca pongas claves privadas en el cliente.
- Fase 2 (opcional): Supabase + login con Google. Solo `anon key` en el cliente y **RLS obligatoria** en todas las tablas.
- No leas ni escribas `.env*` (salvo `.env.example`). No añadas dependencias sin justificarlo en el design del change.
- Ver `docs/adr/0004-seguridad-local-first.md`.

## 7. Registro de skills (cárgalas solo cuando apliquen)

| Skill | Cuándo (triggers ES / EN) |
|---|---|
| `sdd-workflow` | nueva funcionalidad, mecánica, change, spec, propuesta / feature, proposal |
| `sdd-archive` | archivar, cerrar change, retrospectiva / archive, retro, close change |
| `worktree-flow` | worktree, rama de change, trabajo en paralelo / branch, parallel |
| `domain-modeling` | entidad, value object, invariante, agregado, evento de dominio / entity, aggregate |
| `test-writer` | test, TDD, cobertura, doble, contrato / coverage, mock, fake |

## 8. Subagentes (`.claude/agents/`)

| Agente | Fase | Puede escribir |
|---|---|---|
| `game-designer` | GDD, backlog MoSCoW, historias | `docs/gdd.md` |
| `sdd-explorer` | explore | solo `openspec/changes/<id>/exploration.md` |
| `sdd-spec-writer` | propose + spec | `proposal.md`, `specs/**` del change |
| `sdd-architect` | design + tasks | `design.md`, `tasks.md`, ADRs |
| `sdd-implementer` | apply (TDD) | `src/**`, `tests/**`, `content/**` |
| `sdd-verifier` | verify | solo `verify-report.md` |

Quien explora no diseña; quien implementa no verifica.

## 9. Documentación clave

- Plan y decisiones de arranque: `docs/exploration/2026-11-19-kickoff.md`
- GDD: `docs/gdd.md` · ADRs: `docs/adr/` · Diario de IA: `docs/ai-log/`
