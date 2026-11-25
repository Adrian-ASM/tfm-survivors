# Verify report · 0024-split-progression-castle

Commit revisado: HEAD 94495bc (diff 096754a..HEAD, 6 commits por grupo).

## Resultados

- `npm run verify`: verde (guard 988 ficheros; 257 ficheros de test, 3077 tests).
- `npm run test:e2e`: 16/16 en verde (proyecto `logic`).
- Sin `.skip`/`.only` en los tests del change (solo los pre-existentes en `tests/remote/public.spec.ts`).
- `tasks.md`: 13 tareas marcadas, ninguna pendiente; un commit por grupo.
- Firmas doradas MAP/STRUCTURE/RESOURCE/SHEEP intactas: ningún fichero dorado modificado;
  `tests/support/map-golden.test.ts` añade el test "Firmas intactas con la economía del oro (0024)" (semillas 42 y 123).
- Balance: 30/50 victorias, 0 quietos.

## Escenario -> Test -> Estado

Revisión por muestreo de los ficheros de test del diff (tienda, oro por baja, armadura, regeneración,
curación al subir de nivel, bonus de experiencia, catálogos de upgrades, puerta del castillo, bot v4,
determinismo de tienda, overlay DOM, contenido). Los escenarios de las 12 specs delta tienen test asociado
salvo lo indicado en los hallazgos.

| Escenario | Test | Estado |
|---|---|---|
| Firmas intactas (resources) | tests/support/map-golden.test.ts | OK (S1) |
| Límites válidos (resources, carne 100) | tests/infrastructure/progression-content.test.ts / content-schemas | Parcial (W2) |
| Lote de balance en objetivo de tiempo (castle-shop/run-outcome) | tests/domain/balance.test.ts | Parcial (W1) |
| Compra, puerta, Esc, overlay de tienda | run-shop-buy, run-shop-door, shop-panel, shop-gate, gameplay.spec | OK |
| Oro por baja, armadura, regeneración, XP, curación al subir | run-gold-drops, run-armor, run-regeneration, experience-bonus, run-levelup-heal | OK |
| Catálogos de upgrades / bot v4 / determinismo | upgrade-catalog, reference-bot-shop, determinism-shop | OK |

## Hallazgos

**Critical**: ninguno.

**Warning**
- W1: el lote de balance tarda 34,7–35,8 s local (~97–100 s estimados en CI), por encima del objetivo de 90 s
  (y del margen de 81 s) de las specs `castle-shop` y `run-outcome`. El timeout del test sigue en 180 s, lo que
  no corrige el exceso. Optimizar el lote o registrar la desviación en `design.md`/ADR.
- W2: el escenario "Límites válidos" de `resources` (carne 100 por defecto) choca con la cota efectiva de carne
  de upgrades (100 + máximo de `hunter` > 100). El test solo pasa quitando `hunter`. Reconciliar la spec con el
  diseño o documentarlo como desviación.

**Suggestion**
- S1: en `map-golden.test.ts` la comprobación `goldPerKill ?? {}` con `not.toHaveLength(0)` es una precondición
  débil; mejorable, no bloquea.

C: 0 · W: 2 · S: 1
