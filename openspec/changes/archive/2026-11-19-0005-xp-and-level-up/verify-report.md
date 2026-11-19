# Verify report · 0005-xp-and-level-up

- **Verificador**: sdd-verifier (independiente del implementer) · **Fecha**: 2026-11-19
- **Diff revisado**: `origin/main..HEAD` (49 commits, 105 ficheros)

## Resultado de la ejecución

| Comando | Resultado |
|---|---|
| `npm run verify` | OK: lint, typecheck, `guard:all` (284 ficheros) y 64 ficheros / **801 tests** en verde |
| `npm run test:e2e` | OK: **6/6** (smoke, enemies x2, weapons, level-up 57,6 s, health 1,2 min) |
| `npm run bench` | OK: 5/5. 200 vivos + 32 proyectiles + 300 gemas: media 0,129 ms, p99 0,137 ms (presupuesto 2 ms); `snapshot()` 0,008 ms |

No hay `.skip`, `.todo` ni `.only` en `tests/`.

## Cobertura de escenarios (9 specs delta, 210 escenarios con nombre único)

Método: cada título `#### Scenario:` de `specs/**` se buscó literalmente en `tests/**` (los tests llevan el
título, a veces con prefijo `Scenario:` y sufijo con los datos). 205 coinciden literalmente; los 5 restantes
están cubiertos con otro título (revisados a mano):

| Escenario (spec) | Test | Estado |
|---|---|---|
| auto-weapons · Cadencia mejorada sin reiniciar la carga (upgrades) | `run-choosing.test.ts` "Mejora de cadencia a mitad de recarga (fast-ci en la oferta del tick 10: 1, 31, 57, 83)" y `weapon.test.ts` | Cubierto |
| enemy-spawning · Daño cero o ausente | `enemy-catalog.test.ts` "Daño cero (%s)" y `content.test.ts` "Daño cero" | Cubierto |
| enemy-spawning · Vida por defecto de cada tipo | `enemy-catalog.test.ts` "Contenido por defecto: vida, daño > 0 y XP ≥ 1 en los 3 tipos" (10 / 45 / 20) | Cubierto |
| run-state · Eligiendo mejora y vuelta a en curso | `run-choosing.test.ts` "Elección válida (… vuelve a en curso)" más `balance.test.ts` (estado `choosing`) | Cubierto |
| simulation-loop · Una baja libera el hueco antes del director | `run-weapons.test.ts` "Reposición en el mismo tick (maxAlive 1 …)" (1 vivo, id distinto del muerto) | Cubierto |

Escenarios de la spec por capacidad: leveling, xp-gems, upgrades, run-state, simulation-loop, player-health,
player-movement, enemy-spawning y auto-weapons tienen test; no se encontró ninguno sin evidencia. Los escenarios
de navegador ("Primer golpe en el navegador", "Comprobación en el navegador", recorrido de subida de nivel) los
cubren `health.spec.ts`, `weapons.spec.ts` y `level-up.spec.ts`. Los de rendimiento ("Peor caso con gemas",
"200 enemigos encima del jugador", "Tope de vivos alcanzado") los cubre `tests/bench/run.bench.ts`.

Tests revisados por muestreo (`run-choosing`, `run-gems`, `run-offer`, `run-state`, `run-weapons`,
`enemy-catalog`): aserciones sobre el snapshot o el valor observable, no tautológicas.

## Diseño, ADR y reglas de AGENTS.md §3

- `src/domain` y `src/application` no importan infraestructura, composición ni Phaser (grep sobre el diff: sin
  coincidencias). Sin `Math.random`, `Date.now`, `performance.now` ni `import *` en el diff de `src/`.
- Contenido (XP por tipo, `pickupRadius`, curva, catálogo de mejoras) en `content/*.json` validado con zod
  (`schemas.ts`, `loadRunConfig.ts`) con reglas cruzadas en el dominio (`UpgradeCatalog`, build de peor caso).
- Mejoras como modificadores aditivos sobre datos base inmutables (`upgradeStats.ts`, `UpgradeBoard`), conforme
  a ADR-0008 (estado "aceptada", con sección de aplicación). ADR-0003 y ADR-0006 actualizadas.
- Las "Desviaciones del apply" están justificadas y medidas: adelantos de esquemas/JSON por compilación,
  extracción de `PlayerRules`, `RunSetup` y `snapshotParts` (ciclos y tamaño de `Run`), `ChoiceKeys` por evento
  `down` (causa documentada: `Key.onUp` borra `_justDown` en Phaser 4.2.1) y cambio de `pickupRadius` 64 a 128
  por decisión del usuario, con mediciones antes y después en `design.md` §0.3.

## Convenciones (§4) y tasks

- `tasks.md`: 46 casillas marcadas, 0 pendientes.
- Los 49 commits llevan `refs: 0005-xp-and-level-up` y `Assisted-by`. Conventional Commits en todos. Los
  commits de `pickupRadius` (2c0eb92, cc8b8a2) están trazados.
- Se detectan **2 `git commit --amend` locales** en el reflog (`53d8e90` radio de recogida base y `0360381` vida
  máxima mejorable), previos a la indicación del usuario. No viola reglas escritas; se anota como evidencia.

## Hallazgos

### Critical

Ninguno.

### Warning

Ninguno.

### Suggestion

- **S1 · design.md con nota obsoleta**: en la sección "0.3 · Decisión y nueva medición" queda el párrafo
  "Pendiente de spec (no lo cambia el apply)" sobre escenarios del imán sin radio en el GIVEN y cabecera de
  `player-movement` en 64. El commit `cc8b8a2` ya lo corrigió en las specs; conviene marcarlo como resuelto antes
  de archivar para no dejar una deuda falsa.
- **S2 · `Run.ts` mide 307 líneas** tras extraer `snapshotParts.ts`; el riesgo del design era pasar de 300.
  Aceptable (AGENTS.md solo limita 100 columnas), pero es el siguiente candidato a dividir en 0006.
- **S3 · Trazabilidad por título**: cinco escenarios se cubren con un test de otro título (tabla de arriba).
  Renombrar esos tests con el título exacto de la spec facilitaría la comprobación mecánica.
- **S4 · Duración de los E2E**: `level-up.spec` (57,6 s) y `health.spec` (1,2 min) dominan el tiempo de
  `test:e2e`. Margen de la primera oferta con semilla 7: 268 ticks (3.332 frente a 3.600): cualquier retoque de
  balance puede romperlo; los tests de aceptación de `balance.test.ts` lo vigilan.
- **S5 · Bench**: las armas del bench dejan fuera las mejoras de cadencia (peor caso deliberado, documentado).
  Sin acción, solo recordarlo si cambia el catálogo.

## Recuento

C: 0 · W: 0 · S: 5

**Veredicto**: apto para el gate humano de archivado.
