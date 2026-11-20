# Tasks · 0011-public-deploy

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. El change no toca src/: no hay grupos de
     dominio ni de aplicación. Orden: soporte puro del smoke → guardarraíles estáticos → config, workflow y E2E
     remoto → docs → cierre. El implementer marca [x] y hace un commit por tarea (refs: 0011-public-deploy,
     Assisted-by). Ningún paso modifica .github/workflows/ci.yml ni tests/guardrails/ci.test.ts. -->

## 1. Soporte puro del smoke (`tests/remote/target.ts`, unitarios en Vitest sin red)
- [x] 1.1 `resolveTargetUrl(raw)` → `Result<URL, string>` e `isPublicTarget(url)`. Sin valor o con valor vacío,
  la URL pública. Añade la `/` final si falta. Si no es una URL `http:` o `https:` (`ftp://ejemplo`,
  `no-es-una-url`), devuelve `err` con un mensaje que contiene el texto indicado. Test:
  `tests/remote/target.test.ts`. Escenarios: "URL objetivo inválida", "Barra final opcional" y "Smoke en verde
  contra la URL pública" (valor por defecto).
- [x] 1.2 `checkReachable(url, fetchFn, { attempts, timeoutMs, gapMs, sleep })` con `fetch` y `sleep`
  inyectados. Devuelve `ok` al primer 200. Con 404 o error de red en todos los intentos, devuelve `err` con
  "no llegó a estado 200" y la URL. Hace exactamente `attempts` llamadas, cada una con `AbortSignal.timeout`.
  Test con un fetch falso, sin red. Escenario: "URL objetivo que no responde".
- [ ] 1.3 `localAssetRefs(html)` y `metaCspDirectives(html)` sobre el HTML como texto. En `csp.test.ts`, añadir
  `report-to` a las directivas prohibidas. Tests con HTML de ejemplo: refs `/tfm-survivors/…` válidas; refs con
  `/src/`, `https:` o `//` detectadas; meta con `frame-ancestors` o `report-to` detectada. Escenarios: "Rutas del
  index.html construido" y "Directivas que la meta ignora".

## 2. Guardarraíles estáticos (Vitest, dentro de `verify`)
- [ ] 2.1 `tests/guardrails/deploy.test.ts`: helpers `jobBlock(yaml, name)` y `triggersOf(yaml)` sobre el texto,
  más aserciones sobre el `ci.yml` real: `deploy` con `needs: [quality, e2e]` e `if` de push a
  `refs/heads/main`, `upload-pages-artifact` con la misma condición y `path: dist`, y `paths-ignore` del push con
  las 5 rutas de documentación. Es caracterización: el rojo se demuestra con variantes mutadas del texto (sin
  `e2e` en `needs`, sin la condición de push). `ci.yml` no se toca. Escenarios: "Push a main con código y CI en
  verde", "Pull request en verde", "Push a main solo de documentación" y "Push a main con e2e en rojo".
- [ ] 2.2 `tests/guardrails/smoke-isolation.test.ts` (parte de scripts y configs), primero en rojo. Comprueba:
  - `test:e2e` no contiene `--config` ni `remote`;
  - la cadena de `verify`, expandida por `npm run X`, no invoca `playwright` ni `smoke:public`;
  - `smoke:public` usa `--config playwright.remote.config.ts`;
  - la config remota tiene `testDir: 'tests/remote'` y no tiene `webServer`, y `playwright.config.ts` tiene
    `testDir: 'tests/e2e'`;
  - ningún fichero de `tests/e2e/` importa de `tests/remote/`.

  Para ponerlo en verde: script `smoke:public` en `package.json`, `playwright.remote.config.ts` (usa
  `resolveTargetUrl`, `globalSetup` y los tiempos del design: `globalTimeout` 130 s, test 60 s, `retries` 1,
  `workers` 1, `navigationTimeout` 20 s, `expect` 10 s, informe en `playwright-report/smoke`),
  `tests/remote/preflight.ts` (usa `checkReachable` con el `fetch` real) y `tsconfig.json` (`include`).
  Escenarios: "test:e2e no incluye el smoke remoto" y "verify no incluye el smoke remoto".
- [ ] 2.3 `smoke-isolation.test.ts` (parte de workflows), primero en rojo, y después
  `.github/workflows/smoke-public.yml`. Comprueba:
  - solo ese workflow contiene `smoke:public`;
  - sus disparadores son exactamente `[workflow_dispatch]`, con un input `url` opcional cuyo valor por defecto es
    la URL pública;
  - `permissions` es `contents: read`, sin `pages`, `id-token` ni `write`;
  - `timeout-minutes` ≤ 10;
  - `SMOKE_URL` llega por `env` y no se interpola `inputs.url` en `run:`;
  - `ci.yml` no contiene `smoke`.

  Escenarios: "Workflow manual" y "Ningún disparador automático".

## 3. Smoke remoto (`tests/remote/public.spec.ts`, Playwright con la config remota)
<!-- Rojo de 3.1–3.3: antes de escribir el spec, `npm run smoke:public` termina con "No tests found" (exit ≠ 0).
     Cada test se ejecuta primero contra la URL pública y después contra vite preview en localhost. -->
- [ ] 3.1 Fixture común (`watchCsp`, `collect`, respuestas ≥ 400, `requestfailed` y mensajes de CSP del mismo
  origen, y origen de cada petición `document`) y **T1 · carga limpia**:
  - el documento responde 200 y el menú es visible;
  - la URL final empieza por `https://` si el objetivo es la URL pública;
  - `cspState` es `{ violations: [], metas: 1 }`, con 0 `pageerror`;
  - `localAssetRefs` del HTML servido está bajo la base y su meta no contiene directivas prohibidas;
  - 0 recursos rotos.

  Escenarios: "Sin recursos rotos en la URL objetivo", "Carga limpia", "URL objetivo alternativa" y la parte
  servida de "Rutas del index.html construido" y "Directivas que la meta ignora".
- [ ] 3.2 **T2 · ruta inexistente** (`./no-existe`: estado 404 y 0 `#game canvas`) y **T3 · HTTP→HTTPS**
  (`request.get('http://…')`: 200 con la URL final en la URL pública). Ambos llevan `test.skip` si el objetivo no
  es la URL pública. Escenarios: "Ruta inexistente bajo la base" y "HTTP redirige a HTTPS".
- [ ] 3.3 **T4 · bucle**:
  - `gameUrl({ seed: 42, speed: 15 })` y `expectSpeed(15)`, quieto hasta la derrota;
  - se ve el overlay de resultados y lo guardado pasa `decodeProgress`, con 1 entrada `seed` 42 y
    `outcome` `'lost'`;
  - hay 1 descarga, `sprint-survivors-progress.json`, igual a lo guardado;
  - al importar ese mismo fichero se ve "importado" y sigue habiendo 1 entrada;
  - 0 violaciones de CSP y 0 `pageerror`;
  - tras `reload()`, el progreso es igual al de antes y no hay avisos con `progress`.

  Escenarios: "Jugar, guardar, exportar e importar en producción" y "Persistencia tras recargar en producción".
- [ ] 3.4 *(Condicional: solo si 3.1 falla por un 404 de `/favicon.ico`)* Añadir `public/favicon.svg` y
  `<link rel="icon" href="/favicon.svg">` en `index.html`. Test: T1 en verde contra `vite preview`. Tras el
  merge y el despliegue, T1 en verde contra la URL pública. `test:e2e` sigue en verde. Escenario: "Sin recursos
  rotos en la URL objetivo".
- [ ] 3.5 Ejecuciones de aceptación del smoke, anotadas en el diario de IA con su duración:
  - `npm run smoke:public` contra la URL pública: exit 0 y ≤ 180 s;
  - `SMOKE_URL=http://localhost:4173/tfm-survivors/` tras `build` y `preview`: verde, con T2 y T3 saltados;
  - `SMOKE_URL=ftp://ejemplo`: exit ≠ 0, sin abrir páginas y con la URL en el mensaje;
  - `SMOKE_URL=https://adrian-asm.github.io/tfm-survivors-no-existe/`: exit ≠ 0 en ≤ 180 s, con "no llegó a
    estado 200".

  Ninguna ejecución lanza `build` ni `preview` por sí misma. Escenarios: "Smoke en verde contra la URL pública",
  "URL objetivo alternativa", "URL objetivo inválida" y "URL objetivo que no responde".

## 4. Documentación
- [ ] 4.1 `tests/guardrails/deploy-docs.test.ts`, primero en rojo por el README. Comprueba que `README.md`
  contiene `https://adrian-asm.github.io/tfm-survivors/`, `npm run smoke:public`, `smoke-public` y
  `workflow_dispatch`, y que ADR-0004 nombra `frame-ancestors`, `report-uri` y `sandbox` y menciona el
  clickjacking (el apartado ya está escrito en design). Para ponerlo en verde, en el README: enlace a la URL
  pública, el smoke en local con `SMOKE_URL` y el aviso de levantar `preview` para `localhost`, y el smoke desde
  Actions con el workflow `smoke-public` y su input `url`. Escenarios: "README con URL e instrucciones" y "Riesgo
  aceptado documentado".
- [ ] 4.2 Diario de IA `docs/ai-log/2026-11-20-0011-apply.md`: resultado, mediciones de 3.5 e incidentes de
  hooks si los hay. **Desviación de `worktree-flow`**: el change se trabaja en el worktree
  `.claude/worktrees/migracion-formato-code-4b86d6`, con la rama renombrada a `change/0011-public-deploy`, y no en
  `tfm-survivors.worktrees/0011-public-deploy`. Sin test (documentación). `npm run verify` en verde al cerrar el
  apply.

## 5. Verificación y cierre (no los hace el implementer)
- [ ] 5.1 *(sdd-verifier)* En `verify-report.md`, registrar:
  - `git diff --quiet main -- .github/workflows/ci.yml tests/guardrails/ci.test.ts` (exit 0);
  - `npx playwright test --list` con el mismo número de tests que en `main` (48);
  - el identificador de la última ejecución de `ci` en `main` con `setup`, `quality`, `e2e` y `deploy` en verde;
  - la duración de una ejecución de `npm run smoke:public` contra la URL pública;
  - una lectura de `dist/index.html` tras `npm run build`: rutas con base y meta sin directivas prohibidas.

  Escenarios: "ci.yml intacto", "test:e2e no incluye el smoke remoto" (recuento), "Evidencia del despliegue
  vigente" y "Rutas del index.html construido".
- [ ] 5.2 *(sdd-archive, tras el gate humano)* AGENTS.md §1, estado del proyecto: despliegue público y smoke a
  demanda (change 0011). `docs/gdd.md`: el Must "0011 public-deploy" queda cerrado. Hay que pasar la spec viva a
  `openspec/specs/public-deploy/spec.md`, con la corrección de `outcome` a `'lost'` (ver la discrepancia 1 del
  design).
