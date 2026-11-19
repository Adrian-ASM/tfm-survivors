# <Nombre del juego> · TFM Máster de Desarrollo con IA

> Survivors-like 2D para navegador desarrollado con Spec-Driven Development, Clean Architecture y agentes de IA.

| | |
|---|---|
| **Jugar** | _URL de GitHub Pages (tras el change 0001)_ |
| **Slides** | _URL pública_ |
| **Vídeo** | _URL pública (con captura de pantalla)_ |
| **Usuario de prueba** | No aplica en la fase 1 (sin login). |

## 1. Descripción general
_Pendiente: concepto, temática y qué demuestra el proyecto. Ver `docs/gdd.md`._

## 2. Stack tecnológico
TypeScript estricto · Vite · motor 2D (ADR-0001) · Vitest · Playwright · zod · GitHub Actions + Pages ·
Claude Code (subagentes, skills, hooks).

## 3. Instalación y ejecución
_Pendiente (change 0001)._
```bash
npm ci
npm run dev      # desarrollo
npm run verify   # lint + typecheck + tests
npm run build    # producción
```

## 4. Estructura del proyecto
```text
AGENTS.md / CLAUDE.md     Contexto para agentes (índice + reglas)
.claude/                  Subagentes, skills y hooks (guardarraíles)
openspec/                 Specs vivas y changes SDD (+ archivo con retrospectivas)
docs/                     GDD, ADRs, diario de IA, exploración
src/                      domain · application · infrastructure · composition   (change 0001)
tests/                    domain · application · contracts · e2e               (change 0001)
.github/                  CI/CD, Dependabot, plantillas de issues y PR
```

## 5. Funcionalidades principales
_Pendiente._

## 6. Cómo se ha usado la IA
- **SDD**: cada funcionalidad es un change en `openspec/changes/` con proposal, spec, design, tasks, verify y retrospectiva.
- **Multiagente**: un subagente por fase; el verificador nunca es quien implementa (`.claude/agents/`).
- **Guardarraíles**: hooks de Claude Code + ESLint + CI impiden romper la arquitectura o filtrar secretos.
- **Skills y AGENTS.md**: contexto bajo demanda (*lazy loading*), ver `AGENTS.md` §7.
- Diario completo en `docs/ai-log/`.

## 7. Despliegue
GitHub Pages desde `main` mediante `.github/workflows/ci.yml`.

## Licencia y créditos
_Pendiente (incluir procedencia de assets generados con IA)._
