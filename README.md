# Greentide Vanguard · TFM Máster de Desarrollo con IA

> Survivors-like 2D para navegador desarrollado con Spec-Driven Development, Clean Architecture y agentes de IA.

| | |
|---|---|
| **Jugar** | [https://adrian-asm.github.io/tfm-survivors/](https://adrian-asm.github.io/tfm-survivors/) (se publica desde `main`) |
| **Slides** | _URL pública_ |
| **Vídeo** | _URL pública (con captura de pantalla)_ |
| **Usuario de prueba** | No aplica en la fase 1 (sin login). |

## 1. Descripción general
*Greentide Vanguard*: un arquero sobrevive a oleadas de goblins (antorcha, TNT y barril) con armas automáticas.
Arte pixel de Tiny Swords (Update 010, CC0) desde el change 0012. Ver `docs/gdd.md`.

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
El job `deploy` solo corre en un push a `main` con `quality` y `e2e` en verde; los PR y los push solo de
documentación no publican. URL pública: <https://adrian-asm.github.io/tfm-survivors/>.

### Smoke contra la URL publicada (a demanda)
Comprueba que la build publicada carga sin violaciones de CSP ni recursos rotos y que jugar, guardar, exportar,
importar y recargar funcionan (change 0011). No forma parte de `verify` ni de `test:e2e`, y no construye la app ni
levanta ningún servidor.

```bash
npm run smoke:public                                                  # contra la URL pública
SMOKE_URL=https://adrian-asm.github.io/tfm-survivors npm run smoke:public   # otra URL objetivo
```

En PowerShell: `$env:SMOKE_URL='http://localhost:4173/tfm-survivors/'; npm.cmd run smoke:public`.
Para un objetivo en `localhost`, levanta antes la build: `npm run build && npm run preview` (puerto 4173). Contra
`localhost` se saltan los tests de 404 y de HTTP→HTTPS, que solo tienen sentido en GitHub Pages. Si la URL no
responde con 200, el smoke falla en menos de un minuto con el mensaje "no llegó a estado 200".

Desde GitHub Actions: workflow `smoke-public` (*Actions → smoke-public → Run workflow*). Solo se dispara con
`workflow_dispatch` y tiene un input opcional `url` (por defecto, la URL pública). Si falla, sube el informe
`playwright-report/smoke` como artefacto.

## Licencia y créditos
- Arte: *Tiny Swords* (Update 010) de Pixel Frog, **CC0** (confirmado por el autor el 2026-11-22). Solo los 8 PNG
  que usa el juego, en `public/assets/tiny-swords/`, con su procedencia (ruta en el pack, `sha256` y bytes) en
  `content/asset-provenance.json`. Nada del *Free Pack* (no es CC0): lo impide un guardarraíl en pre-commit y CI
  (ADR-0012).
- Audio: CC0, CC-BY-3.0 o CC-BY-4.0, registrado en `content/asset-provenance.json`; la atribución de los CC-BY,
  en [CREDITS.md](CREDITS.md).
- Código: _pendiente_.
