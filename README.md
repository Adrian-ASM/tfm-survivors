# Sprint Survivors · TFM Máster de Desarrollo con IA

> Survivors-like 2D para navegador desarrollado con Spec-Driven Development, Clean Architecture y agentes de IA.

| | |
|---|---|
| **Jugar** | https://adrian-asm.github.io/tfm-survivors/ (se publica desde `main`) |
| **Slides** | _URL pública_ |
| **Vídeo** | _URL pública (con captura de pantalla)_ |
| **Usuario de prueba** | No aplica en la fase 1 (sin login). |

## 1. Descripción general
*Sprint Survivors*: una dev atrapada en un sprint infinito sobrevive a oleadas de *bugs*, *memory leaks* y
*merge conflicts* con armas automáticas (linter, tests, refactor). Metáfora del propio TFM. Ver `docs/gdd.md`.

## 2. Stack tecnológico
TypeScript 6 estricto · Vite 8 · Phaser 4.2.1 (ADR-0001) · Vitest · Playwright · zod · ESLint + husky ·
GitHub Actions + Pages · Claude (app de Claude y Claude Code: subagentes, skills, hooks).

## 3. Instalación y ejecución
Requisitos: Node ≥ 22 y Git. En Windows/PowerShell usa `npm.cmd` si la política de ejecución bloquea `npm`.

```bash
npm ci
npm run dev        # http://localhost:5173/tfm-survivors/  (WASD o flechas)
npm run verify     # lint + typecheck + guardarraíl + tests unitarios
npm run test:e2e   # build + preview + smoke E2E (primera vez: npx playwright install chromium)
npm run build      # producción en dist/
```

## 4. Estructura del proyecto
```text
AGENTS.md / CLAUDE.md     Contexto para agentes (índice + reglas)
.claude/                  Subagentes, skills y hooks (fuente única de las reglas de guardarraíl)
.husky/ · scripts/        pre-commit: lint-staged + guard-staged.mjs (mismas reglas para cualquier autor)
openspec/                 Specs vivas y changes SDD (+ archivo con retrospectivas)
docs/                     GDD, ADRs, diario de IA, exploración
content/                  Datos del juego (JSON validado con zod)
src/domain                Núcleo puro: Vector2, PlayerInput, Arena, Player, Run
src/application           Casos de uso y bucle de paso fijo: StartRun, TickRun, FixedStepLoop
src/infrastructure        Adaptadores: Phaser (input + render) y carga de contenido
src/composition           Composition root (main.ts)
tests/                    domain · application · infrastructure · guardrails · e2e
.github/                  CI/CD, Dependabot, plantillas de issues y PR
```

## 5. Funcionalidades principales
- Walking skeleton (change 0001): el jugador se mueve con WASD/flechas a velocidad constante, sin acelerar en
  diagonal y sin salir de la arena. Simulación determinista a 60 ticks/s independiente del monitor.

## 6. Cómo se ha usado la IA
- **SDD**: cada funcionalidad es un change en `openspec/changes/` con proposal, spec, design, tasks, verify y retrospectiva.
- **Multiagente**: un subagente por fase; el verificador nunca es quien implementa (`.claude/agents/`).
- **Guardarraíles**: las reglas de `.claude/hooks/` se aplican en Claude Code, en el pre-commit (cualquier autor)
  y en CI, junto con ESLint por capas. Evidencia de bloqueos en `docs/ai-log/`.
- **Skills y AGENTS.md**: contexto bajo demanda (*lazy loading*), ver `AGENTS.md` §7.
- Diario completo en `docs/ai-log/`.

## 7. Despliegue
GitHub Pages desde `main` mediante `.github/workflows/ci.yml` (requiere *Settings → Pages → Source: GitHub Actions*).

## Licencia y créditos
_Pendiente (incluir procedencia de assets generados con IA)._
