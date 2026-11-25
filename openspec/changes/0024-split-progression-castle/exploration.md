# Exploración · 0024-split-progression-castle

Intención (GDD): progresión separada. XP da mejoras de personaje (1 de 3 al subir de nivel); oro da mejoras de arma, que se compran en el castillo-tienda (entrar abre la tienda con pausa; tienda única de mejoras de arma y curación).

## Contexto actual
- `content/upgrades.json`: 9 mejoras, todas con `maxLevel` 5. Seis con `target` arma (`strict-rules`, `fast-ci`, `wide-analysis`, `hard-asserts`, `watch-mode`, `coverage`) y tres de jugador (`guardrail`, `shortcuts`, `context-window`).
- Dominio: `src/domain/upgrade/UpgradeCatalog.ts` valida el catálogo contra el loadout y el jugador, con build de peor caso. `Run.chooseUpgrade` y `src/application/ChooseUpgrade.ts` sirven una oferta de 3 con el azar de la partida.
- `src/domain/run/RunPhase.ts` tiene tres estados: `running`, `choosing` y `over`.
- Infraestructura: `UpgradeOverlay.ts` y `GameScene.ts`. La pausa del menú es `Screen = menu | playing | paused`.
- `Stockpile` (oro y madera) existe desde 0022. La carne cura desde 0023.
- Castillo: `src/domain/map/CastleSite.ts`. Es sólido y no caminable. La salida es la puerta, en (1.950, 1.170), y el jugador nace ahí.
- Tests: bot de referencia en `tests/support/policies.ts` (`referenceBot`). `tests/support/balanceBaseline.ts` congela el hash de `upgrades` (línea 72). `tests/support/builders.ts` lee `upgrades.json`.

## Capacidades y specs afectadas
- `upgrades` (catálogo, oferta, overlay).
- `resources` (gasto de oro).
- `run-state` (fase nueva).
- `simulation-loop` (orden del tick).
- `procedural-map` (castillo como disparador).
- `player-health` (curación de pago).
- `run-results`.
- Probable spec nueva `castle-shop`.
- ADR nuevo para el modelo de tienda y la fase.

## Opciones
- **A. Dos catálogos** (personaje por XP; tienda de arma por oro con coste por nivel) más fase `shopping` en `Run`.
  - Pros: fiel al GDD, modelo limpio.
  - Contras: toca dominio, specs y render; es el más caro.
- **B. Un catálogo con campo `currency: xp | gold`.**
  - Pros: reutiliza `UpgradeBoard`; es lo más barato.
  - Contras: mezcla dos modelos; la tienda no es una "oferta de 3".
- **C. Dos changes.** El primero separa contenido y modelo, con la tienda como menú fijo y sin castillo. El segundo abre la tienda en el castillo.
  - Pros: menos riesgo de balance por paso.
  - Contras: más ceremonia SDD.

## Riesgos e incógnitas
1. El jugador nace en la puerta, así que "entrar" no puede ser pisar esa celda: la tienda se abriría en el tick 0. Hace falta un disparador (radio de interacción con re-armado al alejarse, o botón) y una regla para no reabrirla al salir.
2. Balance. El bot v3 no compra, y las seis mejoras de arma saldrían de su pool de XP. Con 28/50 de partida, la ofensiva baja y la tasa de victorias cae. Con solo 3 mejoras de personaje (15 subidas máximas), la oferta de XP se agota. Hay que decidir si el bot compra o si se acepta otra línea base.
3. Determinismo. Cambia la oferta de XP y se desplaza el azar de las ofertas. El gasto debe ir por un caso de uso sin azar, con catálogo fijo.
4. Lecciones de 0022 y 0023:
   - Cerrar el alcance con el usuario antes de propose.
   - Pasar al architect las restricciones de las specs vivas.
   - `balance.test.ts` está en ~63 s; el tope de CI es 90 s.
   - Los MODIFIED deben citar los escenarios en lugar de copiarlos.
   - Reflejar las desviaciones del apply en el design en el mismo commit.
   - E2E: máximo 1–2 nuevos (e2e-lite).
5. El Guerrero (0027) necesitará que el formato admita varias armas por personaje.

## Mediciones previas (las lanza el orquestador antes de propose)
- Oro medio por partida y tick en que se alcanza 10, 25 y 50 de oro, con el bot v3 sobre las semillas 1..50.
- Victorias del bot con compras simuladas para cada candidato de precios. Umbral: 25–35/50 y 0 quietos.
- Número de subidas de nivel de XP por partida frente a las 15 que caben con 3 mejoras de personaje.
- Tiempo del lote con compras. Umbral: ≤ ~81 s en CI.

## Preguntas para el usuario (con recomendación)
1. Reparto de mejoras. Recomendado: las 6 de arma a la tienda por oro y las 3 de personaje por XP; añadir 1–2 mejoras de personaje nuevas o subir `maxLevel`.
2. Entrada y salida. Recomendado: radio de interacción en la puerta con re-armado al alejarse, y salir con Esc o botón.
3. Precios. Recomendado: coste creciente por nivel en el JSON, medido con el oro real.
4. Curación de pago. Recomendado: precio fijo por vida, con tope en la vida máxima. La tienda es el único gasto de oro por ahora.
5. Pausa. Recomendado: pausa total, como el overlay de mejoras.
6. ¿El bot compra? Recomendado: sí, con regla simple (comprar al llegar a la puerta con oro suficiente).
7. Objetivo de balance. Recomendado: 25–35/50, 0 quietos, lote ≤ 90 s en CI.
8. Opción A, B o C. Recomendado: C si se prefiere iterar; si no, A.
