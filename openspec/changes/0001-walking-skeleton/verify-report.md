# Verify report · 0001-walking-skeleton

- **Fecha**: 2026-11-19
- **Verificador**: agente independiente (Claude Opus 5.5), sin participación en la implementación.
- **Rama / worktree**: `change/0001-walking-skeleton` (`git status` limpio antes y después del verify; HEAD `68c2182`).
- **Comandos ejecutados y resultado real**:

| Comando | Resultado |
|---|---|
| `npm.cmd run verify` | ✅ exit 0. lint OK · typecheck OK · `guard:all`: 91 ficheros revisados · Vitest: 7 ficheros, **45 tests en verde** (4,64 s) |
| `npx.cmd playwright test` | ✅ exit 0. 1 test (chromium) en verde, 780 ms; build fresco (`dist/` regenerado en la ejecución, sin servidor previo en :4173) |
| Sonda de tiempo de `guard-staged.mjs` (repo git temporal fuera del worktree, 50 `.ts` + 4 hooks preparados, 3 ejecuciones) | 1.823 / 1.842 / 1.794 ms en una máquina de **16 núcleos** (límite de la spec: 2.000 ms) |
| Sondas de evasión de reglas en el dominio (hook vía `guard-staged.mjs` en repo temporal; ESLint vía `--stdin`, sin escribir en el worktree) | Ver hallazgo W2 |
| Tamaño del bundle (`dist/assets/*.js`) | 1.439.841 bytes, coincide con lo anotado en el design (1.439,84 kB) |

## Resumen
`C: 0 · W: 8 · S: 7`

La implementación cumple el comportamiento de las tres specs y respeta las capas de AGENTS.md §3 (ningún import
prohibido en `src/`, núcleo sin APIs impuras, contenido validado con zod, composition root único). Los Warnings
se concentran en los guardarraíles (margen de rendimiento, evasiones, CI sin verificar) y en tests más débiles que la spec.

## Matriz escenario → test

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

## Hallazgos

Numeración: W1–W8 (Warnings) y S9–S15 (Suggestions).

1. **W** · `tests/guardrails/guard-staged.test.ts:77` y `scripts/guard-staged.mjs:56` — **Margen de rendimiento
   insuficiente en "Commit limpio"; riesgo de CI rojo intermitente.** Medido fuera del test: 1,79–1,84 s para 54
   ficheros en un PC de 16 núcleos (el pool de workers es `cpus().length`). El script lanza un proceso `node` por
   fichero y hook (~100 procesos); los runners `ubuntu-latest` tienen 4 vCPU, así que el paralelismo cae a 4 y el test,
   que corre dentro de `npm run verify` en el job `quality`, puede superar los 2.000 ms. Además `contentOf` usa
   `execFileSync` (`git show`) dentro de los workers y bloquea el event loop, lo que serializa parte del trabajo.
   *Propuesta*: hacer que los hooks exporten una función pura `check({ file_path, content })` (manteniendo el wrapper
   stdin para Claude Code) y que `guard-staged.mjs` la importe en proceso; o, como mínimo, un único proceso por hook
   que reciba la lista completa de ficheros. Leer el índice con una sola llamada (`git cat-file --batch`).

2. **W** · `eslint.config.js:9-41` y `.claude/hooks/guard-architecture.mjs:6-25` — **Evasiones de las reglas de
   pureza y de capas que no detecta ninguna de las tres capas.** Sondas en `src/domain` (resultado hook / ESLint):
   - `await import('phaser')` → pasa / pasa (import dinámico del motor; `no-restricted-imports` no cubre `import()`).
   - `globalThis.localStorage` → pasa / pasa (`no-restricted-globals` no ve accesos vía `globalThis`/`self`).
   - `import 'phaser'` (import de efecto) → pasa el hook (su regex exige `from`) / ESLint lo bloquea.
   - `const { random } = Math; random()` → pasa el hook / ESLint lo bloquea.
   Las dos primeras violan AGENTS.md §3.1 y §3.3 sin que nada falle, ni en pre-commit ni en CI.
   *Propuesta*: añadir en `pureCore` un `no-restricted-syntax` para `ImportExpression` y para
   `MemberExpression[object.name=/^(globalThis|self)$/]`; en el hook, aceptar `import\s*\(` y `import\s+['"]`.
   Añadir estos casos a `tests/guardrails/`.

3. **W** · `tests/domain/player.test.ts:27-28` y `:80` — **Tolerancia más laxa que la spec.** "Diagonal a la misma
   velocidad que un eje" (posición) y "Deslizar por la pared" usan `toBeCloseTo(…, 2)` (error < 0,005 px) cuando la
   spec exige ≤ 0,001 px. El código cumple (error real ≈ 0,0004 px), pero el test no lo garantiza.
   *Propuesta*: usar `EPS` (3) o, mejor, comparar con `200 / Math.SQRT2` y `100 / Math.SQRT2` exactos con
   `Math.abs(diff) <= 0.001`.

4. **W** · `openspec/changes/0001-walking-skeleton/specs/player-movement/spec.md:82-86`,
   `src/infrastructure/content/loadRunConfig.ts:39` y `tests/infrastructure/content.test.ts:24-31` — **El escenario
   "Radio que no cabe en la arena" no se cumple tal como está escrito**: la spec dice "WHEN se carga el contenido THEN
   la carga falla", pero `parseRunConfig` devuelve `ok` (el test lo afirma explícitamente) y el fallo llega en
   `StartRun`. El design lo documenta en "Cambios en apply", pero la spec (fuente de verdad, nivel Spec-Anchored) no
   se ha actualizado. El requisito observable (la partida no arranca y el error nombra `player.radius`) sí se cumple.
   *Propuesta*: antes de archivar, reescribir el escenario ("WHEN se arranca la partida… THEN falla con un error que
   menciona `radius`") o validar el invariante en `loadRunConfig` con un `superRefine` sobre el conjunto
   jugador+arena. Si se archiva con la spec sin tocar, este hallazgo pasa a Critical.

5. **W** · `openspec/changes/0001-walking-skeleton/tasks.md:44` — **Tarea 4.2 sin cerrar: "Violación subida sin
   pre-commit" no está verificada en CI real.** El test local (`guard --all` en un repo temporal) es un buen sustituto
   y `ci.yml` ejecuta `npm run verify` (que incluye `lint` y `guard:all`) en `quality`, pero no hay ninguna ejecución del
   workflow que lo pruebe (la rama no tiene PR) y el verificador no puede hacer push. Notas: en CI el primer paso que
   falla será `lint` (ESLint nombra el fichero y "usa el puerto Clock"), no `guard:all`, porque `verify` es una
   cadena `&&`; la spec se cumple igualmente.
   *Propuesta*: abrir el PR, empujar en una rama de prueba `src/application/z.ts` con `Date.now()` y `--no-verify`,
   adjuntar el enlace al log fallido en este informe y marcar 4.2.

6. **W** · `.github/workflows/ci.yml:9` y `:11` — **`paths-ignore: '.claude/**'` deja sin CI los cambios a la única
   fuente de reglas.** Un PR que solo debilite `.claude/hooks/guard-architecture.mjs` no ejecuta `quality`; si `quality`
   es un check obligatorio (paso manual 2 del design), el PR queda bloqueado en "Expected — waiting", lo que invita a
   desactivar la protección de rama.
   *Propuesta*: quitar `.claude/**` de `paths-ignore` (o excluir solo `.claude/agents/**` y `.claude/skills/**`),
   y añadir un job ligero que siempre informe `quality` para cambios solo de documentación.

7. **W** · `tests/guardrails/guard-staged.test.ts:40-78` — **Los escenarios de pre-commit no ejecutan `git commit`.**
   La spec dice "WHEN se ejecuta `git commit` THEN el commit se aborta", pero los tests invocan
   `scripts/guard-staged.mjs` directamente; el cableado `.husky/pre-commit` → `lint-staged` → `guard-staged` solo
   está probado a mano (diario de IA). Si alguien borra la segunda línea de `.husky/pre-commit`, ningún test falla.
   *Propuesta*: un test que, en el repo temporal, copie `.husky/pre-commit`, configure
   `core.hooksPath` y compruebe que `git commit` termina con código ≠ 0 y no crea commit (`git rev-parse HEAD` falla).

8. **W** · Historial `main..HEAD` (6 commits) — **Convenciones de commit de AGENTS.md §4 incompletas.** Ningún commit
   lleva el trailer `Assisted-by: <herramienta/modelo>` (solo `Co-Authored-By`/`Claude-Session`), y hay un commit
   por bloque en lugar de uno por tarea (desviación sí anotada en `docs/ai-log/2026-11-19-0001-apply.md`). Es evidencia
   de trazabilidad del TFM.
   *Propuesta*: añadir `Assisted-by` en los próximos commits (o en el squash del PR) y aclarar en AGENTS.md si
   `Co-Authored-By` lo sustituye.

9. **S** · `tests/infrastructure/content.test.ts:7-22` — "Contenido válido" comprueba la salida del parseo, no lo que
   recibe el dominio, y "Velocidad negativa" no comprueba la cláusula "no se crea ninguna partida" (solo se deduce de
   leer `src/composition/main.ts:28-37`, sin test). *Propuesta*: extraer en composición una función pura
   `bootstrapRun(raw) → Result<TickRun>` y probar ambos escenarios sobre ella.

10. **S** · `tests/domain/run.test.ts:23-32` — "Snapshot no mutable desde fuera" usa `PlayerInput.NONE`, así que la
    comprobación "el siguiente tick parte del estado interno" es trivial (la x no cambiaría en ningún caso).
    *Propuesta*: usar input (1, 0) y comprobar `x ≈ 480 + 11 × 200/60` tras el intento de mutación; mutar también `tick`.

11. **S** · `tests/guardrails/eslint.test.ts:12-18` — el test escribe ficheros temporales en `src/` real (si el
    proceso muere entre `writeFileSync` y `afterEach`, quedan ficheros que romperían `lint`/`guard:all`) y no comprueba
    el código de salida de `npm run lint` ni la severidad `error`. *Propuesta*: `new ESLint().lintText(code,
    { filePath })` sin escribir en disco y comprobar `severity === 2`.

12. **S** · `src/infrastructure/content/loadRunConfig.ts:9-12` y `src/domain/run/Run.ts:29` — sin tope superior en
    `speed`/`radius`: un `speed` enorme produce `Infinity` y `Vector2.of` lanza `RangeError` dentro de
    `GameScene.update` en cada frame. Además `Run.start` acepta `speed = 0` mientras zod lo rechaza (mensaje "no puede
    ser negativa"). *Propuesta*: `.max()` razonable en zod y alinear la invariante de dominio (`speed > 0`).

13. **S** · `.claude/hooks/guard-secrets.mjs:22` — la exención `path.startsWith('.claude/hooks/')` hace que un secreto
    real en cualquier fichero bajo esa carpeta pase las tres capas. *Propuesta*: eximir solo las líneas que definen
    `SECRET_PATTERNS` o los dos ficheros concretos de hooks.

14. **S** · `scripts/guard-staged.mjs:30-31` — en `--all`, un fichero versionado borrado del disco sin preparar
    provoca un `ENOENT` no capturado (rechazo de `Promise.all`, traza de pila en vez de mensaje). En CI no ocurre.
    *Propuesta*: `try/catch` en `contentOf` o filtrar con `git ls-files --deleted`.

15. **S** · `openspec/changes/0001-walking-skeleton/design.md` (tabla de piezas) — deriva menor del diseño:
    `Vector2.normalizedIfLong` no existe (la normalización vive en `PlayerInput.of`) y
    `FixedStepLoop.advance(elapsedMs, step)` recibe un callback en lugar de `input` (`src/application/FixedStepLoop.ts:23`).
    Ambas decisiones son razonables. *Propuesta*: actualizar el design en el archive.

### Revisión sin hallazgos (comprobado)
- **Capas (§3.1–3.2, 3.4)**: `src/domain` solo importa de `domain`; `src/application` solo de `domain`; Phaser solo en
  `src/infrastructure/phaser`; `src/composition/main.ts` es el único que instancia adaptadores y casos de uso.
- **Pureza (§3.3)**: sin `Math.random`, `Date.now`, `performance.now`, `window`, `document` ni `localStorage` en el núcleo.
- **Contenido (§3.5–3.6)**: `content/*.json` validados con `z.strictObject` antes de llegar al dominio; sin números
  mágicos de juego en `src/` (solo color y fondo, que son de render).
- **Seguridad (§6)**: sin secretos, sin `.env*`, sin red; `window.__sprint` solo con `?e2e`, de solo lectura
  (`defineProperty` no escribible) y expone un snapshot congelado.
- **CI Linux**: todo el código, `.husky/pre-commit` y `scripts/` están en LF en índice y disco (`git ls-files --eol`);
  `.husky/pre-commit` está en modo `100644`, lo que es correcto con husky 9 (se ejecuta vía `sh`); rutas con
  `path.join` y normalización `/` en `lib.mjs`; `ci.yml` ejecuta `npm run verify` en `quality`. El único riesgo de CI
  identificado es el de W1.
- **Pre-commit**: `.husky/pre-commit` ejecuta `npx lint-staged` y `node scripts/guard-staged.mjs`; el modo por
  defecto lee el índice (`git show :<ruta>`), así que se evalúa lo preparado (confirmado también por el test).
- **Bundle**: 1.439.841 bytes, coincide con el design.

## Veredicto
**Apto para revisión humana** (C = 0). Antes de archivar conviene resolver o registrar como deuda W1 (riesgo de CI
intermitente), W2 (evasiones de reglas no negociables), W4 (alinear la spec con la implementación) y W5 (cerrar la
tarea 4.2 con una ejecución real del CI).
