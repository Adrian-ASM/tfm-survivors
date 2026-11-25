# Verify report · 0029-living-map

Verificador independiente. HEAD cfd3629, rama `change/0029-living-map`, diff frente a fabbd25.

## Ejecución
- `npm run verify`: lint, tsc, `guard:all` (1145 ficheros) y vitest en verde: 306 ficheros, 3.667 tests.
- `npm run test:e2e` (proyecto `logic`): 17 de 17 en verde (42,4 s).

## Comprobaciones pedidas
- Deco versionadas: exactamente `01`–`11` y `16`–`18`; ninguna de `12`–`15`. `Deco/04`–`06` siguen siendo solo roca.
  `asset-provenance.json` suma 11 entradas nuevas (las anteriores intactas, diff solo con adiciones).
- Núcleo: sin cambios en `src/domain`, `src/application`, `src/composition` ni en `content/` de juego. Sin diff en
  ninguna firma dorada ni en `BALANCE_BASELINE`. Sin `Math.random`, `Date.now` ni `performance.now` en `phaser/map`.
- Objetos del mapa: 820 (semilla 42) y 904 (123), ≤ 950. Fijados con `toBe` en `plan-map-fallback.test.ts`.
- Congelado en pausa, oferta, tienda, obra y fin, y reanudación: `render-layers.test.ts` (L728).
- Piezas altas (16, 17 y 18) partidas en el borde superior de su celda (error ≤ 1 px) y en capas baja y alta:
  `plan-decor.test.ts` ("Decoración en su sitio", "Decoración baja y alta").
- Arquitectura: infraestructura pura (plan y animador sin motor); datos en `appearance.json` validados con zod.
- Tasks: todas marcadas. Commits por grupo A, B, C y D, más docs.

## Escenario → Test → Estado
| Escenario | Test | Estado |
|---|---|---|
| Decoración de los mapas generados, Zonas excluidas, Junto a los troncos | `plan-decor.test.ts` (1..50) | OK |
| Misma semilla, misma decoración | `plan-decor.test.ts` L166 | Parcial (W1) |
| Otra semilla, otra decoración; Sin decoración en explícitos y vacío; Tope de decoración | `plan-decor.test.ts` | OK |
| Elegir la decoración no consume azar; Pintar la decoración no cambia la simulación | `plan-decor.test.ts`, `render-invariance.test.ts` | OK |
| Datos de la decoración inválidos; Rutas de hoja no admitidas | `appearance-decor.test.ts` | OK |
| Decoración en su sitio; Hoja de una decoración que no carga (18 y frame ausente) | `plan-decor.test.ts` | OK |
| Recuento sin una hoja; Partida nueva y menú; Mapa vacío; Recuento coherente (600 frames) | `render-invariance.test.ts` | OK |
| Frame de árbol y de torre según su fase | `animation.test.ts`, `map-animation.test.ts`, `plan-map-animation.test.ts` | OK |
| Fases deterministas (con R tras 600 frames) | `map-probe.test.ts` L79 | OK |
| Mismas fases con la misma semilla; Variedad; Otra semilla, otras fases | `tree-choices.test.ts` | OK |
| Congelados en pausa, oferta, tienda, obra y fin | `render-layers.test.ts` L728 | OK |
| Elementos estáticos | `map-animation.test.ts` L111, `plan-map-animation.test.ts` L71 | Parcial (S1) |
| Torre que cae en ruina; Árbol y torre al reaparecer; Espuma al reaparecer | `map-animation.test.ts`, `render-layers.test.ts` | OK |
| Reserva de árbol y torre; Reserva de cada elemento; Reserva de las estructuras | `tree-choices`, `map-looks`, `plan-map-*` | OK |
| Animar no cambia la simulación; Caja de los objetos animados | `plan-map-animation.test.ts` | OK |
| Tope de objetos (≤ 950), presupuesto con estructuras y vetas, totales con ventana y reloj | `plan-map-fallback`, `plan-map-structures`, `render-layers` | OK |
| `drawn` igual al recorte; Recorte con aspecto de reserva | `render-layers.test.ts` | OK |
| Datos del repositorio, Datos del mapa inválidos, Solo las hojas usadas | `appearance-repo`, `appearance-map`, `stone-provenance` | OK |
| Recuentos del mapa pintado y Hojas bloqueadas (E2E ampliados, 0 nuevos) | `gameplay.spec.ts` | OK |
| AP: hojas registradas, integridad, sin entrada, Free Pack, calabazas y huesos, solo rocas y decoración | `decor-provenance.test.ts`, `stone-provenance.test.ts` | OK |
| BS: Objetos del mapa sin cambios; Solares sin decoración | `plan-sites.test.ts`, `plan-decor.test.ts` L377 | OK |
| Ovejas fuera del plan del mapa | `sheep-layer.test.ts` L132 | OK |

## Hallazgos
- **Critical**: ninguno.
- **Warning**
  - W1. "Misma semilla, misma decoración" exige un tercer cálculo tras pintar 600 frames y pulsar R. El test solo
    compara dos cálculos de plan puro. No cubre el reinicio con pintado intermedio. "Fases deterministas" sí lo hace
    en `map-probe.test.ts`.
  - W2. No consta la medición `realtime` con `CI_LIKE=1` (tarea 4.2, opcional y a demanda). No bloquea.
- **Suggestion**
  - S1. "Elementos estáticos" se prueba como "sin grupo de animación" en el plan, no pintando 600 frames
    tras los cambios de ruina, veta y obra. Es equivalente, porque sin grupo el animador nunca llama a `frame`.
  - S2. Las decoraciones usan 63–71 piezas por mapa (76–95 objetos), muy por debajo del tope de 120. Es
    correcto. Se puede dejar documentada la holgura.

C: 0 · W: 2 · S: 2
