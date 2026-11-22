# Verify report · 0012-sprite-rendering

Commit verificado: `978ac43` (rama `change/0012-sprite-rendering`, 18 commits sobre `afb5fb0`). Árbol limpio.

## Resultados de los comandos

| Comando | Resultado |
|---|---|
| `npm run verify` | Verde: lint, typecheck, `guard:all` (548 ficheros) y Vitest con 122 ficheros / 1374 tests |
| `npm run test:e2e` | Verde: 63 de 63 (Playwright, chromium, 2,3 min) |
| `npm run build` | Verde: 231 módulos, bundle JS 1541 kB (409 kB gzip) |
| `tests/remote/public.spec.ts` | No ejecutado (a demanda, por indicación del orquestador) |

## Comprobaciones pedidas

| Comprobación | Estado |
|---|---|
| Diff 0 en `src/domain` y `src/application` | OK, el diff está vacío |
| `content/run.json` intacto | OK, el diff está vacío |
| Banda de balance (25..35 victorias, `tests/domain/balance.test.ts`) | OK, en verde dentro de `verify` |
| `git ls-files` solo con assets de la nota | OK, 8 PNG en `public/assets/tiny-swords/**`, las mismas 8 rutas de `content/asset-provenance.json`. Ningún fichero que no sea PNG bajo `public/`. Nada de "Free Pack" en las rutas |
| sha256 y bytes coherentes | OK, recalculados los 8 y coinciden con la nota |
| CSP sin cambios | OK. En `index.html` solo cambia `<title>`; la `<meta>` CSP es idéntica. `config/`, `vite.config.ts` y `.claude/settings.json` sin diff |
| Ids antiguos fuera de lo permitido | OK. `tests/guardrails/legacy-enemy-ids.test.ts` está en verde; en `enemies.json` solo existen `goblin-*` |
| Claves técnicas `sprint-survivors` | OK. `package.json#name`, `sprint-survivors/progress`, `sprint-survivors-progress.json` y `sprint-survivors:dev-csp` conservados. Hay un guardarraíl nuevo que fija el `name` |
| Tarea 8.2 (GDD) | Pendiente a propósito, es del orquestador. Es la única tarea sin marcar |

## Escenarios frente a tests

Los 218 escenarios únicos de `specs/**` (46 en sprite-rendering, 13 en asset-provenance, más los de armas,
enemigos, mejoras, gemas, menú, resultados, run-state, simulation-loop y run-outcome) se cruzaron por título
con `tests/**`. 204 aparecen con su título o con una referencia clara. Los 14 restantes no coinciden por título
y se revisaron a mano.

| Escenario | Test | Estado |
|---|---|---|
| Animaciones obligatorias y campos desconocidos | `appearance-content.test.ts` (describe en línea 93) | Cubierto |
| Asset gráfico fuera de la carpeta de assets | `guardrails/assets.test.ts` | Cubierto |
| Mayúsculas en la extensión | `guardrails/assets.test.ts` (`Tree.PNG`) | Cubierto |
| Daño cero o ausente | `enemy-catalog.test.ts`, `content.test.ts` | Cubierto |
| Linter mata a un goblin-torch en 2 impactos / Tests en 3 pulsos / Ningún arma de un impacto / Pulso mejorado de un golpe | `run-damage.test.ts`, `run-upgrades.test.ts`, `run-outcome.test.ts` | Cubierto (título distinto) |
| Un goblin-torch abatido suelta una gema | `run-gems.test.ts` | Cubierto |
| Vida por defecto de cada tipo | `enemy.test.ts:60`, `enemy-catalog.test.ts:133` | Cubierto (título distinto) |
| Cadencia mejorada sin reiniciar la carga | Sin título coincidente; solo se localizó cobertura de cadencia en `arsenal.test.ts` y `run-choosing.test.ts` | Sin confirmar (ver W2) |
| Stats heredados sin cambios | Sin título coincidente; `enemy-catalog.test.ts` compara el catálogo | Sin confirmar (ver W2) |
| Varios proyectiles sobre el mismo goblin-torch en un tick | Sin título coincidente; `run-damage.test.ts` | Sin confirmar (ver W2) |
| Oleada con un id antiguo (`["bug"]` falla mencionando `bug`) | Ninguno directo. Hay un test con un id desconocido (`segfault`) en `run-config.test.ts:116` y `loop.test.ts:109`. El guardarraíl de ids antiguos impide escribir `'bug'` en los tests | Parcial (ver W1) |

El resto de escenarios (sprite-rendering, asset-provenance, E2E de sonda, hoja rota, cadáveres, reinicios y
`Partida con arte`) tienen test con su propio título y no son tautológicos en lo revisado. Los E2E
`sprites.spec.ts` y `smoke.spec.ts` verifican la sonda frente al snapshot.

## Hallazgos

### Critical
Ninguno.

### Warning
- **W1. "Oleada con un id antiguo" sin test directo.** La spec exige que `["bug"]` falle mencionando `bug`. Solo se
  prueba con `segfault`, que ejerce el mismo camino de código. Añadir un test que construya el id por concatenación
  (para no violar el guardarraíl) o corregir el escenario en la spec.
- **W2. Trazabilidad de 3 escenarios en la capa de dominio** (Cadencia mejorada, Stats heredados, Varios
  proyectiles sobre el mismo goblin-torch). No se encontró un test con título equivalente. Como el dominio no
  cambió y los tests existentes pasaron con los ids renombrados, el riesgo es bajo. Hay que confirmar la
  equivalencia o nombrar los tests con el título de la spec.
- **W3. ADR-0012 sigue en "propuesta"** (desviación 6). Debe pasar a "aceptada" antes de archivar.
- **W4. Walk del Barrel 24–26 sin comprobar en el navegador** (desviación 2). Los tests unitarios y E2E no detectan
  un rango de frames incorrecto. Revisar la animación a ojo antes de archivar o anotar la deuda.
- **W5. El modo hook de `guard-assets.mjs` no está registrado en `.claude/settings.json`** (desviación 5). Solo la
  pasada de commit y CI protege los assets; la capa de agente de AGENTS.md §3 queda sin cubrir para las rutas
  de `public/assets`. `design.md` D8 lo describe como previsto. Registrarlo o dejar constancia de la deuda.
- **W6. Seis commits iniciales sin pre-commit** (`core.hooksPath` roto, desviación 8). Compensado con
  `fab4a15 style:`, y `guard:all` y el lint pasan sobre el HEAD, así que no queda residuo. Aun así incumple la
  regla de no saltarse el commit hook, aunque no fuese deliberado. Anotarlo en el diario de IA como incidente.
- **W7. Tests y código en el mismo paso en las tareas 4.1 y 4.3** (desviación 7). Rompe la secuencia TDD
  rojo-verde del flujo. No se puede demostrar el rojo previo. Declararlo en el diario.

### Suggestion
- **S1.** Desviación 1 (nota de procedencia en `content/asset-provenance.json` en vez de `public/`): coherente
  con R6, porque el contenido validado vive en `content/` y la nota no se publica. Se confirma que la spec y el
  design ya la nombran con esa ruta. Sin acción.
- **S2.** Desviación 3 (sprite sin voltear hasta el primer desplazamiento horizontal): aceptable y con test
  ("Primer frame de una partida nueva"). Mantenerlo documentado.
- **S3.** Desviación 4 (`console.error` al arrancar con contenido inválido): es de composición
  (`src/composition/main.ts`), por lo que respeta las capas. Considerar una pantalla de error visible en un
  change futuro.
- **S4.** El bundle JS supera los 1,5 MB (el aviso ya existía con Phaser). Sin acción en este change.
- **S5.** No se encontraron secretos, `TODO`/`FIXME` en `src`, ni usos de `Math.random`, `Date.now` o
  `performance.now` en la capa de render.

## Arquitectura (design.md frente al código)
Sin incumplimientos: dominio y aplicación sin diff; las capas de render viven en infraestructura; el
cableado, en composición; el contenido, validado con zod y en `content/`; los assets, registrados por la regla
de procedencia, que además está activa en CI mediante `guard:all`.

## Tareas
Todas marcadas salvo 8.2, que es del orquestador y está pendiente a propósito. Los 18 commits cubren las tareas
de los grupos 1 a 8.

C: 0 · W: 7 · S: 5
