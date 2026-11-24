# Verify report · 0023-sheep-meat

## Resultados
- `npm run verify`: verde (guard 939 ficheros; 241 ficheros, 2.851 tests, 68 s).
- `npm run test:e2e` (proyecto `logic`): 15/15 en verde (20 s). El change amplía 2 tests E2E existentes (ovejas y
  carne en la sonda; ≤ 2 nuevos, en manual, sin umbrales de fps ni de tiempo real).
- `tasks.md`: 0 tareas sin marcar; 7 commits de apply (`4a22e77..d533e9b`), uno por grupo.
- Cobertura de escenarios: de 258 títulos únicos de `specs/**`, 253 aparecen literalmente en `tests/`. De los 5
  restantes, 3 son escenarios [E2E] heredados que se cubren ampliando `gameplay.spec.ts`, 1 es "Sin sonda fuera de E2E"
  (heredado) y 1 es nuevo y sin test propio (ver W2).

## Escenarios → Test → Estado (resumen por capacidad)
| Capacidad | Test | Estado |
|---|---|---|
| sheep (comportamiento, colocación, reaparición, determinismo) | `run-sheep`, `sheep-flock`, `sheep-placement`, `determinism-sheep` | OK |
| sheep · Balance con las ovejas y la carne | `balance.test.ts` (28/50, 0 quietos) | OK |
| sheep · Resultados sin ovejas | ninguno que use ovejas muertas y carne recogida | Sin test directo (W2) |
| resources / xp-gems (carne, tope, huella) | `combat-content`, `balance.test.ts` (línea base idéntica con tope 0) | OK |
| player-health (curación) | `Health.heal` y `Player.heal` en tests de dominio | OK |
| auto-weapons / enemy-hazards (ovejas como reserva) | `run-sheep`, test del barril con oveja | OK |
| asset-provenance / sprite-rendering (arte) | `sheep-provenance`, `appearance-schema`, `resource-provenance` | OK |
| sprite-rendering [E2E] sonda de ovejas y carne | `gameplay.spec.ts` (ampliado) | OK |
| 3 [E2E] heredados y "Sin sonda fuera de E2E" | suite de humo existente | Aceptado (sin cambios de comportamiento) |

## Hallazgos

### Critical
Ninguno.

### Warning
- W1. Coste del lote. Las ovejas suben el lote un 7,5 %, por encima del 5 % de `sheep` (líneas 425–426). La spec
  dice "una subida de más del 5 % se justifica", no que la prohíba. Los topes duros se cumplen: local 28,8–29,1 s
  (referencia ≤ 35 s) y ×2,8 ≈ 81 s (tope 90 s). La causa está justificada en `tasks.md` §5 (paso 1 de la flota y
  nivel 2 de las armas en cada tick sin enemigos ni estructuras). Por eso es Warning y no Critical. El margen frente
  a 90 s es del 10 %, así que cualquier crecimiento posterior lo agota. `balance.test.ts` pasa de 31,5 a 63 s porque
  la spec de `resources` pide el segundo lote con tope 0; es esperado, pero hay que vigilar que ningún timeout del
  fichero quede cerca.
- W2. "Resultados sin ovejas" (`sheep`) no tiene test propio. `results-text.test.ts` cubre solo "sin oro ni madera".
  Ningún test arma una partida con 6 ovejas muertas y 3 carnes recogidas, comprueba las 5 líneas de resultados ni
  que el récord y el historial no lleven campos de ovejas. Hoy es probable que se cumpla por construcción, pero la
  regla exige test por escenario. Hay que añadir un test de aplicación o de infraestructura.
- W3. Desviación sin documentar: se quitó el cruce `sheep.radius ≤ cellSize / 2`. `design.md` (líneas 26 y 83) sigue
  exigiéndolo, y el comentario de `src/infrastructure/content/schemas.ts:528` afirma que `SheepRules` lo comprueba,
  lo cual es falso. El radio 18 cumple, pero un contenido con radio > 30 haría ilegal el centro de las celdas de
  colocación y reaparición. Hay que actualizar `design.md` (o registrar la desviación) y corregir el comentario, o
  restaurar la regla.

### Suggestion
- S1. Desviaciones declaradas que el código cumple: `Arsenal.step` con estructuras y ovejas como dos parámetros,
  escala 0,6 (justificada por el tamaño visible), oveja de radio de huida 50 en el escenario del barril y arte de la
  carne en el grupo 1 (`asset-provenance` en el mismo commit). Conviene reflejarlas en `design.md` para que el
  archivo no quede desfasado.
- S2. Registrar el 7,5 % y los 81 s en el retro/ADR-0022 como línea base nueva del lote para futuros changes.

## Recuento
C: 0 · W: 3 · S: 2
