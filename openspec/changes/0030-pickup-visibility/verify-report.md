# Verify · 0030-pickup-visibility

Resultado: `npm run verify` en verde (313 ficheros, 3.756 tests) y `npm run test:e2e` en verde (17/17, proyecto `logic`).
Tasks: todas marcadas, 6 grupos con commit (6ecf999, 8b72bdc, de17143, 7ced8d9, 7a18e15, 4442580).

## Comprobaciones transversales
- Diff vacío en `src/domain`, `src/application`, `tests/support/mapGolden.ts`, `tests/support/balanceBaseline.ts` y `.claude/hooks/`.
  `BALANCE_BASELINE` no se regeneró. Los cambios en `content/` son solo `appearance.json` y `asset-provenance.json`.
- E2E-lite: ningún E2E nuevo; solo se amplió `gameplay.spec.ts` («Mapa real») con la sonda `pickupSpawns`.
- Procedencia: las 3 hojas `*_Spawn.png` tienen entrada con sha256 y bytes. Lo cubre `spawn-provenance.test.ts`, que se
  suma a los tests de prohibición actualizados (`resource-provenance`, `sheep-provenance`, `appearance-schema`,
  `appearance-hazards`). Pasa `guard:all` dentro de `verify`.
- Sonda: `pickup-spawn.test.ts` comprueba que `visible` excluye el retardo y que `pickupSpawns` cuenta aparición más
  retardo (wood 8 en R0+350 con 4 visibles).
- Flote sin salto (R_f) y fase por id: cubiertos en `pickup-motion.test.ts` y `pickup-layer.test.ts`.
- `pickupMotion.ts` es puro y no usa `Math.random` ni `Date.now`. Los tests pasan con ESLint (límite de 100 caracteres).

## Escenario → Test → Estado
| Escenario | Test | Estado |
|---|---|---|
| asset-provenance (5 nuevos y 9 modificados) | `spawn-provenance`, `resource-provenance`, `sheep-provenance`, `appearance-hazards`, `appearance-schema` | OK |
| Flote (desplazamiento, fases, atraído, hueco reutilizado, congelado, manual, sin salto, fallida, reserva, invariancia) | `pickup-motion`, `pickup-clock`, `pickup-layer`, `pickup-invariance` | OK |
| Aparición (idle, una vez por id, reutilizado, valor sumado, recogido, congelada, manual, piedra y gema, fallos de hoja y frame) | `pickup-spawn`, `pickup-layer`, `pickup-repo` | OK |
| Aparición escalonada (montones, recoger en retardo, posterior sin retardo, repositorio, desfase 0) | `pickup-spawn`, `pickup-repo` | OK |
| Iconos sin aparición ni flote; escala y tamaños; limpieza (R con apariciones) | `resource-icons`, `hud`, `layers-clear`, `appearance-pickups` | OK |
| Reserva de árbol y torre | `map-looks`, `plan-map-animation` | OK |
| Recuentos de recogibles sin depender de la aparición ni del flote | `pickup-spawn.test.ts:327` | Parcial (ver W1) |
| Recuento en aparición (`pickupSpawns`) | `pickup-spawn.test.ts` | OK |
| Mapa real en el navegador (`pickupSpawns`) | `gameplay.spec.ts` ampliado | OK |

## Hallazgos
- W1 (Warning) El escenario «Recuentos de recogibles…» pide un único snapshot con 3 xp, 2 gold, 8 wood, 1 meat y 2 stone. El test
  hace llegar el oro y la carne en un pintado posterior. Con ids únicos, oro y carne del primer pintado caerían en retardo
  y los visibles no darían 3, 2, 4, 1, 2. La spec es inalcanzable tal como está escrita. El test sí comprueba la intención
  (el recuento no depende de aparición ni flote). Hay que retocar la spec antes de archivar: oro y carne llegan después.
  No es Critical: el comportamiento es correcto y el test no es tautológico.
- S1 (Suggestion) Un solo test grande por escenario (`pickup-spawn.test.ts`, 415 líneas). Se podría dividir, pero no es necesario.
- S2 (Suggestion) AGENTS.md aún menciona «0–5/6 fps» para el árbol en la nota de memoria. En el repo ya está corregido a 0–3/4 fps (d96303b).

Resumen: C: 0 · W: 1 · S: 2

## Seguimiento (orquestador, 2026-11-26)

- W1 resuelto: el sdd-spec-writer reescribió «Recuentos de recogibles sin depender de la aparición ni del flote» según `tests/infrastructure/pickup-spawn.test.ts` (madera en R0, oro y carne en R0 + 50). Sin cambios de código.
- S2 resuelto: nota de memoria obsoleta borrada.
