# 2026-11-20 · CI para los PR de solo documentación (PR #22 y su arreglo)

- **Problema**: con `paths-ignore` en `pull_request`, los PR de solo documentación (como el archivo de 0010, PR #21)
  no lanzaban el workflow y el check `quality` no llegaba a informar.
- **Cambio (PR #22)**: el workflow corre en todos los PR. `setup` detecta los PR de solo documentación con la API
  de GitHub, y en ese caso `quality` salta sus pasos y `e2e` se omite.
- **Fallo de la IA**: el orquestador cambió `ci.yml` y no ejecutó `npm run verify` antes del push, en contra de
  AGENTS.md §2. El guardarraíl `tests/guardrails/ci.test.ts`, que exige el `paths-ignore` en los dos triggers,
  falló en CI. El PR se fusionó con `quality` en rojo y `main` quedó en rojo.
- **Arreglo**: el test se reescribe para el diseño nuevo, en el que solo el push tiene `paths-ignore`. Sigue
  vigilando que `.claude/hooks/**` y `.claude/settings.json` no cuenten como documentación, tanto en el
  `paths-ignore` como en la expresión de `setup`. Esta vez se pasó `verify` en local (1169 tests) antes del push.
- **Configuración del repo**: a la vez se vio que los rulesets `general-1` y `general-2` apuntaban a
  `refs/heads/general`, y que `main` no tenía protección. El usuario los cambió a `~DEFAULT_BRANCH`, puso 0
  aprobaciones y añadió `quality` como check obligatorio. El bypass del rol admin se mantiene.
- **Lección**: un cambio en `.github/` también es un cambio de código a efectos de `verify`, porque hay tests que
  leen el workflow.
