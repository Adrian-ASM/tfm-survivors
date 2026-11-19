# Verify report · 0001-walking-skeleton

- **Verificador**: agente independiente (Claude Opus 5.5), sin participación en la implementación.
- **Rama / worktree**: `change/0001-walking-skeleton`.

## Resumen actual (segunda pasada)
`C: 0 · W: 2 · S: 8`

**Veredicto: apto para revisión humana (C = 0).** La ronda 2 resuelve de verdad W1, W2, W3, W4, W6, W7, S10, S11,
S13 y S14; lo he comprobado con sondas propias, no con el diario. Siguen abiertos dos Warnings diferidos a propósito
(W5: CI real; W8: trailers en los commits antiguos) y Suggestions sin efecto en el comportamiento.

> **Anexo del orquestador (2026-11-19), evidencia de W5 / tarea 4.2.** CI real ejecutado:
> - PR #2 (`change/0001-walking-skeleton`, HEAD `9e4e3c8`): `setup`, `quality` y `e2e` en verde (run 44525211484).
> - PR #3 (rama desechable `test/w5-ci-violation`, `src/application/z.ts` con `Date.now()` subido con
>   `--no-verify`): `quality` en rojo, `error 'Date.now' is restricted… usa el puerto Clock` en
>   `src/application/z.ts` (run 44525411723). PR cerrado sin fusionar y rama borrada.
> W5 pasa a **Resuelto**. Recuento tras el anexo: `C: 0 · W: 1 · S: 8` (queda W8, registrado).

---

## Segunda pasada (2026-11-19, HEAD `2afaf2d`)

Alcance: diff `d25db21..HEAD` (commits `7c69a14..2afaf2d`, tareas 5.1–5.7). `git status` limpio antes y después.
No he tocado código: las sondas se han hecho en el scratchpad (repos git temporales, `ESLint.lintText`, `check()`
importado y los hooks lanzados por stdin).

### Comandos ejecutados y resultado real

| Comando / sonda | Resultado |
|---|---|
| `npm.cmd run verify` | ✅ exit 0. lint OK · typecheck OK · `guard:all`: 95 ficheros · Vitest: **10 ficheros, 83 tests en verde** (3,90 s) |
| `npm.cmd run test:e2e` | ✅ exit 0. 1 test (chromium) en verde, 783 ms |
| Tiempo de "Commit limpio" (`guard-staged.mjs` en un repo temporal, 50 `.ts` + 3 hooks preparados, 3 ejecuciones, 16 núcleos) | **150 / 144 / 147 ms**, antes 1.794–1.842 ms. Con 500 ficheros, 190 ms. Corre en un solo proceso, así que ya no depende del número de núcleos |
| "Se evalúa lo preparado" (repo temporal: `Math.random()` preparado y después corregido en disco) | exit 1, nombra `src/domain/x.ts` y `RandomGenerator` ✅ |
| Hook por stdin, como lo invoca `.claude/settings.json` (`node <ruta>/guard-architecture.mjs` con JSON de Write/Edit/MultiEdit) | Write con violación → **2**; Write limpio → **0**; MultiEdit que importa infraestructura → 2; script lanzado con ruta `/`, con `\`, relativa o con la letra de unidad en minúscula → 2; `CLAUDE_PROJECT_DIR` en forma `/c/…` (Git Bash) → 2 |
| `guard-secrets.mjs` por stdin | `.env.local` → 2; `README.md` → 0; token en `.claude/hooks/notas.mjs` → 2; token en `.Claude/Hooks/guard-secrets.mjs`, `src/../.claude/hooks/guard-secrets.mjs` u otro worktree → 2; token **en** `.claude/hooks/guard-secrets.mjs` → 0 (exención, ver N2) |
| `parseRunConfig` con entradas límite (`player`/`arena` ausentes, `radius` de tipo string, `speed` negativa con radio enorme, clave extra, `speed` = 1e308) | Ningún caso lanza excepción. Todos devuelven `Result` con el campo correcto, salvo `speed` = 1e308, que se acepta (ver S12) |

### Estado de los hallazgos de la primera pasada

| # | Hallazgo | Estado | Evidencia de la segunda pasada |
|---|---|---|---|
| W1 | Margen de rendimiento en "Commit limpio" | **Resuelto** | Los hooks exportan `check()` y `guard-staged.mjs` los importa en proceso. El índice se lee con un único `git cat-file --batch`. Medido: ~150 ms con 50 ficheros y 190 ms con 500 (límite: 2.000 ms) |
| W2 | Evasiones de capas y pureza | **Resuelto** | Repetí las 4 sondas: `await import('phaser')`, `globalThis.localStorage`, `import 'phaser'` y `const { random } = Math`. Las 4 quedan **bloqueadas por el hook y por ESLint**. También bloquean ambos `export * from 'phaser'`, `export { … } from '../infrastructure/…'` e `import type … from 'phaser'`. Quedan evasiones más rebuscadas (N1) |
| W3 | Tolerancia más laxa que la spec | **Resuelto** | `expectWithinSpec` comprueba `≤ 0.001` en la diagonal (posición y distancia) y en el deslizamiento |
| W4 | Spec de "Radio que no cabe" no cumplida al cargar | **Resuelto** | `RunConfigSchema.superRefine` usa `Arena.fits` del dominio, y la **carga** falla en `player.radius`. Test: `content.test.ts` › Radio que no cabe en la arena. `Run.start` mantiene la invariante como defensa (también con test). La spec queda alineada sin tocarla |
| W5 | Tarea 4.2 / CI real | **Diferido** | Sigue `[ ]` en `tasks.md:44`. Se cerrará al abrir el PR |
| W6 | `paths-ignore: '.claude/**'` | **Resuelto** | Ahora solo se ignoran `.claude/agents/**` y `.claude/skills/**`. `tests/guardrails/ci.test.ts` lo fija |
| W7 | Pre-commit sin `git commit` real | **Resuelto** | `pre-commit.test.ts` ejecuta `git commit` en un repo temporal con copias de `.husky/pre-commit`, `scripts/` y `.claude/hooks/`. Comprueba código ≠ 0 y que no se crea HEAD. Si se borra la línea del guard, el commit sucio se crearía y los tests fallarían. Hay matices en N5 |
| W8 | Trailers `Assisted-by` | **Diferido** | Los 8 commits nuevos llevan `refs:` y `Assisted-by:`. Los 6 anteriores siguen sin el trailer; se puede resolver en el squash del PR |
| S9 | Tests de contenido sobre el parseo, no sobre el dominio | **Diferido** | Sin cambios |
| S10 | Snapshot con `PlayerInput.NONE` | **Resuelto** | El test usa input (1, 0), intenta mutar `x` y `tick` y comprueba `tick = 11` y `x = 480 + 11·200/60` |
| S11 | ESLint escribía en `src/` | **Resuelto** | Ahora usa `lintText` sobre la ruta de un fichero real, con `severity === 2` y sin mensajes `fatal`. Un test comprueba que `src/domain` no cambia |
| S12 | Sin tope en `speed`/`radius`; `speed = 0` | **Parcial** | `speed > 0` queda alineado entre zod y el dominio, con el mismo mensaje (`SPEED_MUST_BE_POSITIVE`) y un test que compara los dos errores. No se añadió `.max()`. Riesgo bajo: con 1e308 la posición sigue siendo finita y se recorta a la arena |
| S13 | Exención de secretos en toda la carpeta `.claude/hooks/` | **Resuelto** | La exención se limita a los dos ficheros de reglas, por coincidencia exacta de ruta. No se amplía con traversal, cambio de mayúsculas ni otro worktree (sondas arriba). El residuo está en N2 |
| S14 | `ENOENT` en `--all` | **Resuelto** | `git ls-files --deleted`: aviso y se omite el fichero, sin traza (con test) |
| S15 | `design.md` desactualizado | **Diferido** | Se hará en archive. Ahora hay más deriva: el design describe un `node` por fichero y la validación del radio solo en `StartRun` |

### Revisión del diff `d25db21..HEAD` (regresiones)

- **Capas (§3)**: `loadRunConfig` (infraestructura) importa `Arena` y constantes del dominio, lo que está permitido. El dominio
  solo añade constantes de mensaje. Sin imports prohibidos ni APIs impuras nuevas en `src/`.
- **Hook en modo Claude Code**: `runAsHook` + `isEntryPoint` funcionan con todas las formas de ruta probadas en Windows.
  Importar el módulo no lee stdin ni termina el proceso (con test).
- **Tests de pre-commit con stubs**: siguen probando algo real. El stub de `npx` solo sustituye a lint-staged/ESLint. El
  guardarraíl real (`node scripts/guard-staged.mjs` con los `check()` copiados) sí se ejecuta dentro de `git commit`.
  El shim de `core.hooksPath` replica `sh -e .husky/pre-commit` de `.husky/_/h`. Matices en N5.
- **Lectura del índice**: el parseo por bytes es correcto con multibyte, espacios y ficheros sin salto final (con test).
  Un objeto `missing` hace fallar el guardarraíl (no lo deja pasar). Un fichero enorme provoca `ENOBUFS`, que también hace
  fallar el guardarraíl. El único caso que lo deja pasar está en N3 (solo POSIX).
- **Validación zod**: `superRefine` no se ejecuta con forma inválida y no lanza con entradas ausentes (sondas arriba).
- **Secretos**: sin secretos ni `.env*` en el diff. El token de los tests se construye en tiempo de ejecución.

### Hallazgos nuevos

Numeración: N1–N5 (todos Suggestion).

N1. **S** · `eslint.config.js:35-51` y `.claude/hooks/guard-architecture.mjs:31-59`. **Evasiones residuales que
    pasan las tres capas** (sonda en `src/domain`, hook / ESLint):
    - `const M = Math; M.random()` → pasa / pasa.
    - `Date()` sin `new`, que devuelve la hora actual como string → pasa / pasa. Es el hermano de `new Date()`, que sí se bloquea.
    - `Reflect.get(Math, 'random')()` → pasa / pasa.
    - Fuera de la lista literal de §3.3 pero con el mismo espíritu: `crypto.randomUUID()`, `navigator`, `location` y
      `setTimeout` → pasan / pasan.

    Lo cubren otras reglas: `eval(…)` lo bloquea el hook, `new Function(…)` lo bloquea `no-implied-eval` y
    `Math['ran'+'dom']()` lo bloquean las reglas `no-unsafe-*`. El hook no ve una línea con `'//'` dentro de un string,
    pero ESLint sí la bloquea.

    *Propuesta*: añadir `no-restricted-syntax` para `CallExpression[callee.name='Date']` y
    `VariableDeclarator[init.name=/^(Math|Date|performance|Reflect)$/]`, y `crypto`/`navigator`/`location` a
    `PURE_GLOBALS`. Registrar en el design que el análisis estático no es exhaustivo.

N2. **S** · `.claude/hooks/guard-secrets.mjs:14-17,31`. **La exención es innecesaria y deja un hueco.** Sonda: un token
    `ghp_…` escrito **en** `.claude/hooks/guard-secrets.mjs` o en `guard-architecture.mjs` pasa el hook (exit 0) y, por
    tanto, también `guard-staged` y `guard:all`. Además he comprobado que el contenido real de ambos ficheros **no**
    coincide con ningún patrón fuera de `src/`: `service_role` es `onlyIn: 'src/'` y el resto de regex no se
    autocoinciden. *Propuesta*: eliminar `RULE_FILES` y mantener el test "no se auto-bloquea con el contenido real",
    que seguiría en verde y avisaría si un patrón futuro se autocoincide.

N3. **S** · `scripts/guard-staged.mjs:47-60`. **`git cat-file --batch` se basa en una consulta por línea sin
    verificar a qué ruta corresponde cada respuesta.** En POSIX, una ruta preparada con `\n` en el nombre (Git la admite)
    parte la consulta en dos. A partir de ahí cada contenido se asigna a la ruta siguiente: una violación en
    `src/domain/` podría evaluarse con el nombre de un fichero ajeno a las reglas, y el guardarraíl la dejaría pasar. No se
    puede reproducir en Windows (NTFS no admite `\n`). `--all`/CI no se ve afectado porque lee del disco.
    *Propuesta*: obtener `<sha> <ruta>` con `git ls-files -s -z`, pedir por sha a `cat-file --batch` y comprobar que la
    cabecera devuelve ese sha. Otra opción es rechazar rutas con `\n`.

N4. **S** · `.claude/hooks/lib.mjs:44-65`. **El hook deja pasar la escritura en dos situaciones.**
    - Si `isEntryPoint` da `false` (p. ej. un lanzador que pase otra ruta canónica), el hook termina con 0 sin evaluar nada.
    - Un JSON de stdin inválido termina con código 1, que Claude Code no trata como bloqueo. Esto ya ocurría antes de la ronda 2.

    Con la configuración actual funciona (sondas arriba).
    *Propuesta*: separar las reglas (`.claude/hooks/rules/*.mjs`, que exportan `check`) de los entry points finos
    (`guard-*.mjs`, que siempre leen stdin), lo que elimina la detección de entry point. Y capturar el error de parseo con
    `block([...])` (código 2).

N5. **S** · `tests/guardrails/pre-commit.test.ts:93-99`. **Dos huecos en los tests de pre-commit.**
    - "Commit limpio" solo comprueba que existe `npx.log`, no que se llamó a `lint-staged`. Si se cambia
      `npx lint-staged` por otra orden, ningún test falla.
    - "El dominio importa el motor" y "Se evalúa lo preparado" no se prueban con `git commit` real, solo con el script.
      El cableado sí está cubierto por los otros tres.

    *Propuesta*: `expect(readFileSync(log)).toContain('lint-staged')` y añadir esos dos casos al `describe` de
    `git commit`.

### Matriz escenario → test (segunda pasada)

| Capacidad | Escenario | Test que lo cubre | Estado |
|---|---|---|---|
| player-movement | Movimiento horizontal durante un segundo | `tests/domain/player.test.ts` › Movimiento horizontal… | ✅ |
| player-movement | Sin input no hay movimiento | `player.test.ts` › Sin input no hay movimiento | ✅ |
| player-movement | Movimiento vertical hacia arriba | `player.test.ts` › Movimiento vertical hacia arriba | ✅ |
| player-movement | Diagonal a la misma velocidad que un eje | `player.test.ts` › Diagonal… (`≤ 0.001` en distancia y posición) | ✅ |
| player-movement | Input fuera de rango | `player.test.ts` › Input fuera de rango | ✅ |
| player-movement | Input analógico menor que 1 no se amplifica | `player.test.ts` › Input analógico… | ✅ |
| player-movement | Choque con el borde derecho | `player.test.ts` › Choque con el borde derecho | ✅ |
| player-movement | Esquina superior izquierda | `player.test.ts` › Esquina superior izquierda | ✅ |
| player-movement | Deslizar por la pared | `player.test.ts` › Deslizar por la pared (`≤ 0.001`) | ✅ |
| player-movement | Contenido válido | `tests/infrastructure/content.test.ts` › Contenido válido | ✅ (S9) |
| player-movement | Velocidad negativa | `content.test.ts` › Velocidad negativa (falta "no se crea ninguna partida") | ⚠️ S9 |
| player-movement | Radio que no cabe en la arena | `content.test.ts` › Radio que no cabe… (la **carga** falla en `player.radius`) | ✅ |
| simulation-loop | Un frame de 1/60 s | `tests/application/loop.test.ts` › Un frame de 1/60 s | ✅ |
| simulation-loop | Monitor de 120 Hz | `loop.test.ts` › Monitor de 120 Hz | ✅ |
| simulation-loop | Monitor de 30 Hz | `loop.test.ts` › Monitor de 30 Hz | ✅ |
| simulation-loop | Tiempo independiente del refresco | `loop.test.ts` › Tiempo independiente del refresco | ✅ |
| simulation-loop | Pestaña en segundo plano | `loop.test.ts` › Pestaña en segundo plano | ✅ |
| simulation-loop | Tiempo negativo o no numérico | `loop.test.ts` › Tiempo negativo o no numérico | ✅ |
| simulation-loop | Dos partidas idénticas | `loop.test.ts` › Dos partidas idénticas | ✅ |
| simulation-loop | Snapshot no mutable desde fuera | `tests/domain/run.test.ts` › Snapshot no mutable… (input (1, 0), muta `x` y `tick`) | ✅ |
| simulation-loop | Contador de ticks | `run.test.ts` › Contador de ticks | ✅ |
| architecture-guardrails | Aleatoriedad global en el dominio | `tests/guardrails/pre-commit.test.ts` (`git commit` real) + `guard-staged.test.ts` | ✅ |
| architecture-guardrails | El dominio importa el motor | `guard-staged.test.ts` › El dominio importa el motor (cableado probado en `pre-commit.test.ts`) | ✅ (N5) |
| architecture-guardrails | Fichero de secretos | `pre-commit.test.ts` (`git commit` real) + `guard-staged.test.ts` | ✅ |
| architecture-guardrails | Se evalúa lo preparado, no el disco | `guard-staged.test.ts` › Se evalúa lo preparado… (y sonda manual) | ✅ (N5) |
| architecture-guardrails | Commit limpio | `pre-commit.test.ts` › Commit limpio (`git commit` real) + `guard-staged.test.ts` › Commit limpio (< 2 s; medido ~150 ms) | ✅ |
| architecture-guardrails | Violación subida sin pre-commit | `guard-staged.test.ts` › `--all` (sin ejecución real del CI) | ⚠️ W5 |
| architecture-guardrails | Aplicación importa infraestructura | `tests/guardrails/eslint.test.ts` › Aplicación importa infraestructura (`severity 2`) | ✅ |
| architecture-guardrails | Infraestructura importa el motor | `eslint.test.ts` › Infraestructura importa el motor | ✅ |

Todos los escenarios tienen test (29 de 29). `tasks.md`: todo marcado salvo 4.2 (diferida). Los commits de la ronda 2
llevan `refs:` y `Assisted-by:`.

### Recuento de la segunda pasada (hallazgos abiertos)
`C: 0 · W: 2 · S: 8`
- **W**: W5 (diferido), W8 (diferido).
- **S**: S9 (diferido), S12 (parcial), S15 (diferido), N1, N2, N3, N4, N5.

### Veredicto
**Apto para revisión humana** (C = 0). Antes de archivar:
1. **W5**: abrir el PR, comprobar que `quality` falla con una violación subida con `--no-verify`, enlazar el log y
   marcar 4.2.
2. **W8**: añadir `Assisted-by` en el squash del PR, o registrar que los 6 commits iniciales no lo llevan.
3. **S15**: actualizar `design.md` en archive (guardarraíl en proceso con `cat-file --batch` y validación del radio en
   `loadRunConfig`).
4. Recomendado y barato: N2 (quitar la exención) y N5 (dos aserciones). N1, N3 y N4 pueden registrarse como deuda.

---

## Primera pasada (histórico, 2026-11-19, HEAD `68c2182`)

- **Comandos ejecutados y resultado real**:

| Comando | Resultado |
|---|---|
| `npm.cmd run verify` | ✅ exit 0. lint OK · typecheck OK · `guard:all`: 91 ficheros revisados · Vitest: 7 ficheros, **45 tests en verde** (4,64 s) |
| `npx.cmd playwright test` | ✅ exit 0. 1 test (chromium) en verde, 780 ms; build fresco (`dist/` regenerado en la ejecución, sin servidor previo en :4173) |
| Sonda de tiempo de `guard-staged.mjs` (repo git temporal fuera del worktree, 50 `.ts` + 4 hooks preparados, 3 ejecuciones) | 1.823 / 1.842 / 1.794 ms en una máquina de **16 núcleos** (límite de la spec: 2.000 ms) |
| Sondas de evasión de reglas en el dominio (hook vía `guard-staged.mjs` en repo temporal; ESLint vía `--stdin`, sin escribir en el worktree) | Ver hallazgo W2 |
| Tamaño del bundle (`dist/assets/*.js`) | 1.439.841 bytes, coincide con lo anotado en el design (1.439,84 kB) |

### Resumen (primera pasada)
`C: 0 · W: 8 · S: 7`

La implementación cumple el comportamiento de las tres specs y respeta las capas de AGENTS.md §3: ningún import
prohibido en `src/`, núcleo sin APIs impuras, contenido validado con zod y un único composition root. Los Warnings
se concentran en los guardarraíles (margen de rendimiento, evasiones, CI sin verificar) y en tests más débiles que la spec.

### Matriz escenario → test (primera pasada)

| Capacidad | Escenario | Test que lo cubre | Estado |
|---|---|---|---|
| player-movement | Movimiento horizontal durante un segundo | `tests/domain/player.test.ts` › Movimiento horizontal durante un segundo | ✅ |
| player-movement | Sin input no hay movimiento | `player.test.ts` › Sin input no hay movimiento (igualdad exacta) | ✅ |
| player-movement | Movimiento vertical hacia arriba | `player.test.ts` › Movimiento vertical hacia arriba | ✅ |
| player-movement | Diagonal a la misma velocidad que un eje | `player.test.ts` › Diagonal… (posición con tolerancia 0,005, no 0,001) | ⚠️ W3 |
| player-movement | Input fuera de rango | `player.test.ts` › Input fuera de rango | ✅ |
| player-movement | Input analógico menor que 1 no se amplifica | `player.test.ts` › Input analógico… | ✅ |
| player-movement | Choque con el borde derecho | `player.test.ts` › Choque con el borde derecho (igualdad exacta) | ✅ |
| player-movement | Esquina superior izquierda | `player.test.ts` › Esquina superior izquierda | ✅ |
| player-movement | Deslizar por la pared | `player.test.ts` › Deslizar por la pared (tolerancia 0,005, no 0,001) | ⚠️ W3 |
| player-movement | Contenido válido | `tests/infrastructure/content.test.ts` › Contenido válido (comprueba el parseo, no lo que recibe el dominio) | ✅ (S9) |
| player-movement | Velocidad negativa | `content.test.ts` › Velocidad negativa (no comprueba "no se crea ninguna partida") | ⚠️ S9 |
| player-movement | Radio que no cabe en la arena | `content.test.ts` › Radio que no cabe… (la carga **tiene éxito**; falla `StartRun`) | ⚠️ W4 |
| simulation-loop | Un frame de 1/60 s | `tests/application/loop.test.ts` › Un frame de 1/60 s | ✅ |
| simulation-loop | Monitor de 120 Hz | `loop.test.ts` › Monitor de 120 Hz (`[0, 1]`) | ✅ |
| simulation-loop | Monitor de 30 Hz | `loop.test.ts` › Monitor de 30 Hz | ✅ |
| simulation-loop | Tiempo independiente del refresco | `loop.test.ts` › Tiempo independiente del refresco (60 ticks, ±1, ≤ 3,4 px) | ✅ |
| simulation-loop | Pestaña en segundo plano | `loop.test.ts` › Pestaña en segundo plano (15 ticks) | ✅ |
| simulation-loop | Tiempo negativo o no numérico | `loop.test.ts` › Tiempo negativo o no numérico (0 ticks, acumulador 0) | ✅ |
| simulation-loop | Dos partidas idénticas | `loop.test.ts` › Dos partidas idénticas (600 inputs, seed fija, `toStrictEqual`) | ✅ |
| simulation-loop | Snapshot no mutable desde fuera | `tests/domain/run.test.ts` › Snapshot no mutable desde fuera | ✅ (S10) |
| simulation-loop | Contador de ticks | `run.test.ts` › Contador de ticks (90) | ✅ |
| architecture-guardrails | Aleatoriedad global en el dominio | `tests/guardrails/guard-staged.test.ts` › Aleatoriedad… (invoca el script, no `git commit`) | ⚠️ W7 |
| architecture-guardrails | El dominio importa el motor | `guard-staged.test.ts` › El dominio importa el motor (ídem) | ⚠️ W7 |
| architecture-guardrails | Fichero de secretos | `guard-staged.test.ts` › Fichero de secretos (ídem) | ⚠️ W7 |
| architecture-guardrails | Se evalúa lo preparado, no el disco | `guard-staged.test.ts` › Se evalúa lo preparado… (ídem) | ⚠️ W7 |
| architecture-guardrails | Commit limpio | `guard-staged.test.ts` › Commit limpio (< 2 s con 50 ficheros, margen ~10 %) | ⚠️ W1, W7 |
| architecture-guardrails | Violación subida sin pre-commit | `guard-staged.test.ts` › Violación subida sin pre-commit (`--all` local; sin ejecución real del CI, tarea 4.2 abierta) | ⚠️ W5 |
| architecture-guardrails | Aplicación importa infraestructura | `tests/guardrails/eslint.test.ts` › Aplicación importa infraestructura (API de ESLint, no `npm run lint`) | ✅ (S11) |
| architecture-guardrails | Infraestructura importa el motor | `eslint.test.ts` › Infraestructura importa el motor | ✅ |

Todos los escenarios tienen test (29 escenarios, 0 sin test).

### Hallazgos (primera pasada)

Numeración: W1–W8 (Warnings) y S9–S15 (Suggestions).

1. **W** · `tests/guardrails/guard-staged.test.ts:77` y `scripts/guard-staged.mjs:56`. **Margen de rendimiento
   insuficiente en "Commit limpio"; riesgo de CI rojo intermitente.** Medido fuera del test: 1,79–1,84 s para 54
   ficheros en un PC de 16 núcleos (el pool de workers es `cpus().length`). El script lanza un proceso `node` por
   fichero y hook (~100 procesos). Los runners `ubuntu-latest` tienen 4 vCPU, así que el paralelismo cae a 4 y el test,
   que corre dentro de `npm run verify` en el job `quality`, puede superar los 2.000 ms. Además `contentOf` usa
   `execFileSync` (`git show`) dentro de los workers y bloquea el event loop, lo que serializa parte del trabajo.
   *Propuesta*: hacer que los hooks exporten una función pura `check({ file_path, content })` (manteniendo el wrapper
   stdin para Claude Code) y que `guard-staged.mjs` la importe en proceso. Como mínimo, un único proceso por hook
   que reciba la lista completa de ficheros. Leer el índice con una sola llamada (`git cat-file --batch`).

2. **W** · `eslint.config.js:9-41` y `.claude/hooks/guard-architecture.mjs:6-25`. **Evasiones de las reglas de
   pureza y de capas que no detecta ninguna de las tres capas.** Sondas en `src/domain` (resultado hook / ESLint):
   - `await import('phaser')` → pasa / pasa (import dinámico del motor; `no-restricted-imports` no cubre `import()`).
   - `globalThis.localStorage` → pasa / pasa (`no-restricted-globals` no ve accesos vía `globalThis`/`self`).
   - `import 'phaser'` (import de efecto) → pasa el hook (su regex exige `from`) / ESLint lo bloquea.
   - `const { random } = Math; random()` → pasa el hook / ESLint lo bloquea.

   Las dos primeras violan AGENTS.md §3.1 y §3.3 sin que nada falle, ni en pre-commit ni en CI.
   *Propuesta*: añadir en `pureCore` un `no-restricted-syntax` para `ImportExpression` y para
   `MemberExpression[object.name=/^(globalThis|self)$/]`. En el hook, aceptar `import\s*\(` y `import\s+['"]`.
   Añadir estos casos a `tests/guardrails/`.

3. **W** · `tests/domain/player.test.ts:27-28` y `:80`. **Tolerancia más laxa que la spec.** "Diagonal a la misma
   velocidad que un eje" (posición) y "Deslizar por la pared" usan `toBeCloseTo(…, 2)` (error < 0,005 px) cuando la
   spec exige ≤ 0,001 px. El código cumple (error real ≈ 0,0004 px), pero el test no lo garantiza.
   *Propuesta*: usar `EPS` (3) o, mejor, comparar con `200 / Math.SQRT2` y `100 / Math.SQRT2` exactos con
   `Math.abs(diff) <= 0.001`.

4. **W** · `openspec/changes/0001-walking-skeleton/specs/player-movement/spec.md:82-86`,
   `src/infrastructure/content/loadRunConfig.ts:39` y `tests/infrastructure/content.test.ts:24-31`. **El escenario
   "Radio que no cabe en la arena" no se cumple tal como está escrito.** La spec dice "WHEN se carga el contenido THEN
   la carga falla", pero `parseRunConfig` devuelve `ok` (el test lo afirma explícitamente) y el fallo llega en
   `StartRun`. El design lo documenta en "Cambios en apply", pero la spec (fuente de verdad, nivel Spec-Anchored) no
   se ha actualizado. El requisito observable sí se cumple: la partida no arranca y el error nombra `player.radius`.
   *Propuesta*: antes de archivar, reescribir el escenario ("WHEN se arranca la partida… THEN falla con un error que
   menciona `radius`") o validar el invariante en `loadRunConfig` con un `superRefine` sobre el conjunto
   jugador+arena. Si se archiva con la spec sin tocar, este hallazgo pasa a Critical.

5. **W** · `openspec/changes/0001-walking-skeleton/tasks.md:44`. **Tarea 4.2 sin cerrar: "Violación subida sin
   pre-commit" no está verificada en CI real.** El test local (`guard --all` en un repo temporal) es un buen sustituto
   y `ci.yml` ejecuta `npm run verify` (que incluye `lint` y `guard:all`) en `quality`. Pero no hay ninguna ejecución del
   workflow que lo pruebe (la rama no tiene PR) y el verificador no puede hacer push. Nota: en CI el primer paso que
   falla será `lint` (ESLint nombra el fichero y "usa el puerto Clock"), no `guard:all`, porque `verify` es una
   cadena `&&`. La spec se cumple igualmente.
   *Propuesta*: abrir el PR, empujar en una rama de prueba `src/application/z.ts` con `Date.now()` y `--no-verify`,
   adjuntar el enlace al log fallido en este informe y marcar 4.2.

6. **W** · `.github/workflows/ci.yml:9` y `:11`. **`paths-ignore: '.claude/**'` deja sin CI los cambios a la única
   fuente de reglas.** Un PR que solo debilite `.claude/hooks/guard-architecture.mjs` no ejecuta `quality`. Si `quality`
   es un check obligatorio (paso manual 2 del design), el PR queda bloqueado en "Expected — waiting", lo que invita a
   desactivar la protección de rama.
   *Propuesta*: quitar `.claude/**` de `paths-ignore` (o excluir solo `.claude/agents/**` y `.claude/skills/**`),
   y añadir un job ligero que siempre informe `quality` para cambios solo de documentación.

7. **W** · `tests/guardrails/guard-staged.test.ts:40-78`. **Los escenarios de pre-commit no ejecutan `git commit`.**
   La spec dice "WHEN se ejecuta `git commit` THEN el commit se aborta", pero los tests invocan
   `scripts/guard-staged.mjs` directamente. El cableado `.husky/pre-commit` → `lint-staged` → `guard-staged` solo
   está probado a mano (diario de IA). Si alguien borra la segunda línea de `.husky/pre-commit`, ningún test falla.
   *Propuesta*: un test que, en el repo temporal, copie `.husky/pre-commit`, configure
   `core.hooksPath` y compruebe que `git commit` termina con código ≠ 0 y no crea commit (`git rev-parse HEAD` falla).

8. **W** · Historial `main..HEAD` (6 commits). **Convenciones de commit de AGENTS.md §4 incompletas.** Ningún commit
   lleva el trailer `Assisted-by: <herramienta/modelo>` (solo `Co-Authored-By`/`Claude-Session`), y hay un commit
   por bloque en lugar de uno por tarea (desviación sí anotada en `docs/ai-log/2026-11-19-0001-apply.md`). Es evidencia
   de trazabilidad del TFM.
   *Propuesta*: añadir `Assisted-by` en los próximos commits (o en el squash del PR) y aclarar en AGENTS.md si
   `Co-Authored-By` lo sustituye.

9. **S** · `tests/infrastructure/content.test.ts:7-22`. "Contenido válido" comprueba la salida del parseo, no lo que
   recibe el dominio. "Velocidad negativa" no comprueba la cláusula "no se crea ninguna partida": solo se deduce de
   leer `src/composition/main.ts:28-37`, sin test. *Propuesta*: extraer en composición una función pura
   `bootstrapRun(raw) → Result<TickRun>` y probar ambos escenarios sobre ella.

10. **S** · `tests/domain/run.test.ts:23-32`. "Snapshot no mutable desde fuera" usa `PlayerInput.NONE`, así que la
    comprobación "el siguiente tick parte del estado interno" es trivial (la x no cambiaría en ningún caso).
    *Propuesta*: usar input (1, 0) y comprobar `x ≈ 480 + 11 × 200/60` tras el intento de mutación; mutar también `tick`.

11. **S** · `tests/guardrails/eslint.test.ts:12-18`. El test escribe ficheros temporales en `src/` real: si el
    proceso muere entre `writeFileSync` y `afterEach`, quedan ficheros que romperían `lint`/`guard:all`. Tampoco
    comprueba el código de salida de `npm run lint` ni la severidad `error`. *Propuesta*: `new ESLint().lintText(code,
    { filePath })` sin escribir en disco y comprobar `severity === 2`.

12. **S** · `src/infrastructure/content/loadRunConfig.ts:9-12` y `src/domain/run/Run.ts:29`. Sin tope superior en
    `speed`/`radius`: un `speed` enorme produce `Infinity` y `Vector2.of` lanza `RangeError` dentro de
    `GameScene.update` en cada frame. Además `Run.start` acepta `speed = 0` mientras zod lo rechaza (mensaje "no puede
    ser negativa"). *Propuesta*: `.max()` razonable en zod y alinear la invariante de dominio (`speed > 0`).

13. **S** · `.claude/hooks/guard-secrets.mjs:22`. La exención `path.startsWith('.claude/hooks/')` hace que un secreto
    real en cualquier fichero bajo esa carpeta pase las tres capas. *Propuesta*: eximir solo las líneas que definen
    `SECRET_PATTERNS` o los dos ficheros concretos de hooks.

14. **S** · `scripts/guard-staged.mjs:30-31`. En `--all`, un fichero versionado borrado del disco sin preparar
    provoca un `ENOENT` no capturado (rechazo de `Promise.all`, traza de pila en vez de mensaje). En CI no ocurre.
    *Propuesta*: `try/catch` en `contentOf` o filtrar con `git ls-files --deleted`.

15. **S** · `openspec/changes/0001-walking-skeleton/design.md` (tabla de piezas). Deriva menor del diseño:
    `Vector2.normalizedIfLong` no existe (la normalización vive en `PlayerInput.of`) y
    `FixedStepLoop.advance(elapsedMs, step)` recibe un callback en lugar de `input` (`src/application/FixedStepLoop.ts:23`).
    Ambas decisiones son razonables. *Propuesta*: actualizar el design en el archive.

#### Revisión sin hallazgos (comprobado en la primera pasada)
- **Capas (§3.1–3.2, 3.4)**: `src/domain` solo importa de `domain` y `src/application` solo de `domain`. Phaser solo
  aparece en `src/infrastructure/phaser`. `src/composition/main.ts` es el único que instancia adaptadores y casos de uso.
- **Pureza (§3.3)**: sin `Math.random`, `Date.now`, `performance.now`, `window`, `document` ni `localStorage` en el núcleo.
- **Contenido (§3.5–3.6)**: `content/*.json` se validan con `z.strictObject` antes de llegar al dominio. Sin números
  mágicos de juego en `src/` (solo color y fondo, que son de render).
- **Seguridad (§6)**: sin secretos, sin `.env*` y sin red. `window.__sprint` solo existe con `?e2e`, es de solo lectura
  (`defineProperty` no escribible) y expone un snapshot congelado.
- **CI Linux**:
  - Todo el código, `.husky/pre-commit` y `scripts/` están en LF en índice y disco (`git ls-files --eol`).
  - `.husky/pre-commit` está en modo `100644`, lo que es correcto con husky 9 (se ejecuta vía `sh`).
  - Las rutas usan `path.join` y se normalizan a `/` en `lib.mjs`.
  - `ci.yml` ejecuta `npm run verify` en `quality`.
  - El único riesgo de CI identificado es el de W1.
- **Pre-commit**: `.husky/pre-commit` ejecuta `npx lint-staged` y `node scripts/guard-staged.mjs`. El modo por
  defecto lee el índice (`git show :<ruta>`), así que se evalúa lo preparado (confirmado también por el test).
- **Bundle**: 1.439.841 bytes, coincide con el design.

#### Veredicto (primera pasada)
**Apto para revisión humana** (C = 0). Antes de archivar conviene resolver o registrar como deuda:
- W1: riesgo de CI intermitente.
- W2: evasiones de reglas no negociables.
- W4: alinear la spec con la implementación.
- W5: cerrar la tarea 4.2 con una ejecución real del CI.
