# Verify report · 0027-site-contact

Rama `change/0027-site-contact`, commits 92bc5f1..345f68a.

## Ejecución
- `npm run verify`: lint, typecheck y guard:all (1102 ficheros) en verde; Vitest 295 ficheros, 3492 tests en verde (~70 s).
- E2E: no repetido (17/17 logic en apply, según el orquestador). 0 E2E nuevos; se amplía el de "Construir una casa en el juego real".
- Reglas de AGENTS.md §3: sin `Math.random`/`Date.now`/`performance.now` en domain/application; sin restos de `access`/`TEST_ACCESS`/`checkAccess` en `src` ni `tests` (solo la aserción de contenido inválido `buildings.access`). Contenido en `content/buildings.json` (`contact.rearmDistance` 64) validado con zod.
- Tareas: 1.1–4.2 marcadas; 4.3 pendiente (es de archive, no es hallazgo). Commits por grupo con las desviaciones aceptadas (G1+G2 juntos; E2E 4.1 y GDD en commits propios).

## Balance (gate)
| Medida | Resultado | Estado |
|---|---|---|
| Bot v4 | 34/50, idéntico a la línea base regenerada (`BALANCE_BASELINE`), ningún solar construido | OK (25–35) |
| Bot v5 | 34/50 (`BUILDER_REFERENCE`), 1,30 casas y 1,10 torres por partida | OK (25–35, ≥ 1 casa y ≥ 1 torre) |
| Quieto | 0 victorias, mapa generado y vacío (tests en verde) | OK |
| Firmas | Solo cambia `STONE_GOLDEN` (diff: `stoneGolden.ts`, `balanceBaseline.ts`, `buildings.json`, schemas) | OK |
| Tiempo lote v4 | ~40 s local, ×2,8 ≈ 112 s | OK (< 180 s) |
| Tiempo lote v5 | 62–63 s local, ×2,8 ≈ 174–176 s | Warning |

## Escenario → Test → Estado
112 escenarios únicos en las 7 specs delta; búsqueda del título en `tests/` para cada uno. 110 tienen test con título literal
(p. ej. `tests/domain/run-sites-open.test.ts`, `run-build.test.ts`, `run-build-clearance.test.ts`, `determinism-sites.test.ts`,
`map/game-map-build.test.ts`, `balance.test.ts`, `balance-builder.test.ts`, `infrastructure/dom/build-panel.test.ts`,
`e2e/gameplay.spec.ts`). No se auditó una a una la solidez de cada aserción; se comprobó una muestra (balance, firmas, apertura, despeje).

| Escenario | Test | Estado |
|---|---|---|
| Marcar no consume azar [build-sites] | Ninguno: no hay test que compare el estado de los tres `RandomGenerator` (partida, ovejas, piedra) con y sin solar en mapa vacío, semilla 7. Lo más cercano (`Colocar solares no consume el azar`, `Abrir no consume azar`, `Despejar no consume azar`) cubre otros escenarios | Critical |
| Firma de la piedra regenerada [procedural-map] | `determinism-stone.test.ts` "Firma dorada de las piedras (42/123)" + "Firmas anteriores intactas" (sin el título literal) | OK |
| Bot v4 en banda y línea base / Victorias del bot v5 / Quieto pierde con los solares | `balance.test.ts`, `balance-builder.test.ts` | OK |
| Construir una casa en el juego real [E2E] | `tests/e2e/gameplay.spec.ts` (ampliado; sin umbrales de tiempo) | OK |
| Resto (108 escenarios) | Título localizado en tests | OK |

## Hallazgos
**Critical**
- C1. Escenario "Marcar no consume azar" (build-sites) sin test. Falta un test de dominio: dos `Run.start` con semilla 7 y mapa vacío, uno con el solar de prueba y otro con `withoutSites`, y el estado de los `RandomGenerator` igual.

**Warning**
- W1. El lote del bot v5 tarda 62–63 s en local (el design preveía 43,9 s, +41 %). Proyectado a CI (×2,8) son ~175 s frente al timeout de 180 s (`BOT_BATCH_TIMEOUT_MS` en `balance-builder.test.ts`): 3 % de margen y el timeout no se debe subir. Hay riesgo real de fallo intermitente en CI. Conviene reducir el coste del bot v5 (p. ej. la búsqueda de ruta al solar) o registrar la deuda en el diario/ADR-0026 antes de archivar. Los números del design §5 (43,9 s) quedan desactualizados.

**Suggestion**
- S1. "Firma de la piedra regenerada" no lleva su título de spec en el test; renombrar un `it` de `determinism-stone.test.ts` ayuda a la trazabilidad.
- S2. En el archive (4.3), anotar las cifras finales: v4 34/50, v5 34/50 (1,30 casas, 1,10 torres), tiempos de lote y la corrección de §1.3 del design.

C: 1 · W: 1 · S: 2

## Re-verify (commit 05d7b41)
- `npm run verify`: guard 1102 ficheros, Vitest 295 ficheros, 3493 tests en verde (+1 respecto a antes: el test de C1).
- C1 resuelto: `run-sites-open.test.ts`, "Marcar no consume azar" (semilla 7, mapa vacío, con y sin solar). Compara llamadas consumidas y siguiente valor de los tres generadores (partida, ovejas, piedra) y comprueba que el solar existe en el snapshot. No es tautológico. Rojo comprobado según el implementer; yo no lo repetí.
- S1 resuelto: título "Firma de la piedra regenerada" literal en `determinism-stone.test.ts`.
- W1 pasa a deuda, no resuelto. Cifra corregida del lote v5: 62,6 y 65,4 s aislado en local, ~175-183 s en CI (x2,8). El 43,2 s anterior se midió sin la comprobación por tick de celdas de obra. El timeout sube de 180 a 300 s solo en `balance-builder.test.ts`; el margen en CI es ~1,6x. Se oculta el síntoma, pero el coste del bot v5 no baja. Deuda: el lote tarda ~+45 % sobre lo previsto en el design §5; registrarla en el diario de IA o ADR-0026.
- La "comprobación por tick de celdas de obra" es solo de test: el invariante "Nada en las celdas de obra" en `balance-builder.test.ts`, que mira cada tick de las 50 partidas. No afecta al coste del juego real; en producción `Run.ts:252` marca las huellas una sola vez al crear la partida.
- S2 sigue abierta (es de archive).

C: 0 · W: 1 (deuda: lote v5 ~63-65 s local, timeout 300 s) · S: 1
