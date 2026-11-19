# Tasks · 0001-walking-skeleton

<!-- Cada tarea ≈ 30 min, con test asociado y escenario de la spec. Orden: tooling → dominio → aplicación →
     infraestructura → composición → E2E → docs. Un commit por tarea (Conventional Commits + refs + Assisted-by). -->

## 0. Tooling y guardarraíles (primero, para que todo lo demás nazca dentro del carril)
- [x] 0.1 Scaffold: `package.json` (versiones exactas del design), `tsconfig.json` estricto, `vite.config.ts` con
      `base`, `index.html`, `.prettierrc`; scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`,
      `guard:all`, `verify` — test: `npm run typecheck` en verde sobre un `src/main.ts` vacío
- [x] 0.2 `eslint.config.js` con capas (no-restricted-imports) y pureza — escenarios: "Aplicación importa infraestructura",
      "Infraestructura importa el motor" (fixtures en `tests/guardrails/fixtures/`)
- [x] 0.3 `scripts/guard-staged.mjs` (modo staged y `--all`) reutilizando `.claude/hooks/` — escenarios:
      "Aleatoriedad global en el dominio", "El dominio importa el motor", "Fichero de secretos",
      "Se evalúa lo preparado, no el disco", "Commit limpio" (test en repo git temporal)
- [x] 0.4 husky + lint-staged (`.husky/pre-commit`) y `prepare` en `package.json` — escenario: "Commit limpio"
      ejecutado de verdad con un commit en el worktree
- [x] 0.5 Evidencia: intentar commitear `src/domain/x.ts` con `Math.random()` y capturar el bloqueo (pre-commit y
      ESLint) en `docs/ai-log/` — escenario: "Aleatoriedad global en el dominio"

## 1. Dominio
- [x] 1.1 `Vector2` y `Result` — tests unitarios de operaciones e inmutabilidad
- [x] 1.2 `PlayerInput` — escenarios: "Diagonal a la misma velocidad que un eje", "Input fuera de rango",
      "Input analógico menor que 1 no se amplifica"
- [x] 1.3 `Arena.clampCircle` — escenarios: "Choque con el borde derecho", "Esquina superior izquierda"
- [x] 1.4 `Player.move` — escenarios: "Movimiento horizontal durante un segundo", "Sin input no hay movimiento",
      "Movimiento vertical hacia arriba", "Deslizar por la pared"
- [x] 1.5 `Run` + `RunSnapshot` — escenarios: "Contador de ticks", "Snapshot no mutable desde fuera"

## 2. Aplicación
- [x] 2.1 `FixedStepLoop` — escenarios: "Un frame de 1/60 s", "Monitor de 120 Hz", "Monitor de 30 Hz",
      "Pestaña en segundo plano", "Tiempo negativo o no numérico"
- [x] 2.2 `StartRun` + `TickRun` — escenarios: "Tiempo independiente del refresco", "Dos partidas idénticas"

## 3. Infraestructura y composición
- [x] 3.1 `content/player.json`, `content/arena.json` y `loadRunConfig` (zod) — escenarios: "Contenido válido",
      "Velocidad negativa", "Radio que no cabe en la arena"
- [x] 3.2 `KeyboardInput` y `GameScene` (Phaser 4.2.1; verificar APIs en la documentación oficial) — sin lógica,
      cubierto por E2E
- [x] 3.3 `main.ts` (composition root), error de contenido en pantalla y `window.__sprint` con `?e2e`

## 4. E2E, CI y documentación
- [x] 4.1 Smoke E2E (Playwright, chromium, contra `vite preview`): carga sin errores de consola, existe el canvas
      y mantener la flecha derecha 500 ms aumenta `snapshot.player.x`
- [ ] 4.2 CI: `guard:all` dentro de `verify`; comprobar que el workflow detecta `package.json` y pasa en el PR —
      escenario: "Violación subida sin pre-commit" (se verifica en el verify-report con una rama de prueba)
- [x] 4.3 README (instalación, ejecución, estructura), AGENTS.md §2 (comandos) y §3 (guardarraíl en pre-commit/CI,
      prohibido `--no-verify`, cambios en `main` solo por PR)
- [x] 4.4 Medir tamaño del bundle y anotarlo para el verify-report
