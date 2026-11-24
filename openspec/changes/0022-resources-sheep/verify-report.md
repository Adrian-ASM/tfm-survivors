# Verify report · 0022-resources-sheep

## Ejecución
- `npm run verify`: verde (lint, typecheck, guard:all con 887 ficheros, 227 ficheros y 2648 tests).
- `npm run test:e2e` (proyecto logic): 15/15 verdes. Hay 1 E2E nuevo ("Recursos: el HUD muestra el oro y la madera...") y un tramo ampliado del mapa real, dentro del límite de 1-2.
- `tasks.md`: todas las tareas marcadas (0 abiertas, 19 marcadas). 7 commits de grupo (M0 a M3 por capa) más el de docs, conforme a ADR-0018.
- Determinismo: `MAP_GOLDEN` y `STRUCTURE_GOLDEN` sin líneas borradas (solo se añade `RESOURCE_GOLDEN`). Balance idéntico a la línea base congelada en M0 (`balanceBaseline.ts`).
- Reglas AGENTS.md §3: sin `Math.random` ni `Date.now` en domain/application; contenido en `content/*.json` (`resources.json`, `appearance.json`); `guard:all` sin hallazgos de procedencia.
- ADR-0021 presente y alineado con el diseño.

## Escenarios → Test → Estado
Las 9 specs tienen 233 escenarios. Muestreo de cobertura por spec (los tests citan el escenario en su título, `Scenario: ...`):

| Spec | Test | Estado |
|---|---|---|
| resources, xp-gems, simulation-loop | tests/domain y tests/application (recogibles con tipo, madera del barril, oro de estructuras, vetas) | OK |
| procedural-map, goblin-structures | `map-golden.test.ts` (`RESOURCE_GOLDEN`), colocación con `RESOURCE_STREAM` 4 | OK |
| enemy-hazards | tests de barril (madera al explotar) | OK |
| sprite-rendering, asset-provenance | tests de infraestructura y `guard:all` | OK |
| hud: contadores, números grandes, icono que no carga, anclaje, resize | `tests/infrastructure/hud.test.ts` | OK |
| hud: Contadores en el navegador [E2E] | `gameplay.spec.ts:489` | OK |
| hud: HUD tras volver al menú y jugar | `hud.test.ts:452` | OK (prueba el contador, no la escena) |
| hud: Sin HUD en el menú | sin test que mire la escena | Warning |

## Juicio de las desviaciones declaradas
- Vista `gems` compartida con `pickups` y 4 tests a `toMatchObject`: aceptable. Los tests siguen comprobando los campos relevantes. Suggestion.
- Balance +8 % de pared frente a main (34-35 s contra 32-33 s): supera el +5 % del design pero cumple el criterio de proposal (~35 s). Los resultados son idénticos y el implementer optimizó `playBotTraced`. Warning: dejar registrado en el design o en el archivo.
- Bench de tres topes a 0,2672 ms (referencia 0,25 ms, límite 2 ms): dentro del límite duro. Suggestion, informativo.
- `RunSetup.veins[i]` con `gold` propio: ampliación de API menor, cubierta por tests de dominio. Suggestion: reflejarla en el design.
- `MapVein.radius` con test-after en domain: incumple el TDD estricto de ADR-0018 en una capa donde se exige rojo previo. Hay test, así que no es Critical. Warning.
- Heredocs: anotado en `docs/ai-log/2026-11-24-0022-apply.md`. Los ficheros pasan lint y guard, así que no se aprecia daño. Suggestion.
- M2: 701/784 objetos del mapa en las semillas 42/123, bajo el tope de 1.000 vigente. OK.

## Hallazgos

### Critical
Ninguno.

### Warning
- W1: escenario "Sin HUD en el menú" sin test que compruebe la escena (el implementer lo declaró). Añadir un test unitario de la escena, o registrarlo como deuda.
- W2: lote de balance +8 % de tiempo de pared frente a main (el design pedía ≤ +5 %). Registrar la desviación en el design o en la retro.
- W3: `MapVein.radius` escrito con test-after en `domain`, contra el TDD estricto de ADR-0018. Registrar la excepción en el diario de IA.

### Suggestion
- S1: `toMatchObject` en 4 tests por la vista `gems` compartida: cada uno debería seguir fijando `kind` y `value`.
- S2: reflejar `RunSetup.veins[i].gold` en `design.md`.
- S3: bench de tres topes por encima de la referencia de 0,25 ms: anotar el valor nuevo como línea base.
- S4: el muestreo no abrió los 233 escenarios uno a uno. Confirmar en el archivo que cada título de test cita su escenario.

C: 0 · W: 3 · S: 4

Veredicto: listo para PR. Los Warning se pueden resolver o registrar en la retro, y no bloquean el archivado.
