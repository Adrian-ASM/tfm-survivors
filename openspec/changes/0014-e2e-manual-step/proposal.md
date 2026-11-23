# Proposal · 0014-e2e-manual-step

- **Estado**: aprobada (2026-11-23)
- **Ampliación aprobada 2026-11-23**: frenado de CPU con CDP
- **Numeración**: el id 0014 se mantiene aunque el GDD lo reserve para `procedural-map`; al archivar este change
  se renumera el GDD (`procedural-map` pasa a 0015 y los siguientes se desplazan uno).
- **Issue**: sin issue de GitHub
- **Rama / worktree**: `change/0014-e2e-manual-step`

## Problema
Los E2E que comprueban reglas (subida de nivel, golpes, armas, resultados, guardado, enemigos, pausa) dependen del
reloj real: avanzan la partida con `?e2e&speed=N` y esperan con `expect.poll` sobre el tick, `waitForTimeout` y el
bucle de 100 ms de `playChoosingFirst` (unas 35-45 de las ~150 esperas de 16 specs, según la exploración). Con la CPU
cargada (pasada `CI_LIKE=1 --workers=12 --repeat-each=3`, o el runner de Actions con WebGL por software) los frames
se alargan y estos tests fallan por tiempo, aunque la regla esté bien. El fallo no distingue un bug de un equipo lento,
y además la pasada local con 12 workers (≈1,3 hilos por worker) es más dura que CI (≈2 hilos por worker) y da falsos
fallos.

## Objetivo
Los E2E de reglas avanzan la simulación **a mano**, un número exacto de ticks, sin depender del reloj ni de la CPU:
con `?e2e&manual` el mundo no avanza solo y el test llama a `window.__sprint.step(n)` para ejecutar n ticks y pintar
el resultado. Los E2E que sí deben probar el reloj real (velocidad, carga, render, navegación, una partida completa)
siguen en tiempo real y son los únicos que se someten a la pasada pesada `CI_LIKE`. Esa pasada reproduce la
lentitud del runner frenando la CPU de cada página (no saturando el PC con workers): usa 2 workers, como CI, y el PC
sigue siendo usable mientras corre.

## Alcance
- **Dentro**:
  - Parámetro de URL `manual`, **efectivo solo si también está `?e2e`**; sin `?e2e` se ignora sin avisos (no altera
    partidas, récords ni historial del jugador), igual que `speed`.
  - Con `?e2e&manual`, el mundo no ejecuta ticks por el paso del tiempo real: solo avanza con `step(n)`. El resto del
    adaptador sigue vivo (teclado, Esc, R, clics de pausa y de elección, menú, resultados, guardado).
  - `window.__sprint.step(n)` (solo existe con `?e2e`): ejecuta hasta n ticks con el input vigente, pinta el frame
    y termina cuando ese frame está pintado, indicando cuántos ticks se ejecutaron.
  - `step` respeta los estados de la partida: en pausa, eligiendo mejora o terminada ejecuta 0 ticks; si a mitad de
    `step(n)` se abre una oferta o la partida termina, los ticks restantes se descartan (no se salta ninguna elección
    ni se sigue jugando tras el fin). Mismo desenlace que en tiempo real para la misma semilla, input y elecciones.
  - `manual` excluye `speed`: si la URL trae los dos, gana `manual` y `speed` no se aplica. `?e2e&speed=N` sin
    `manual` se comporta exactamente como hoy (change 0008).
  - El modo manual vale para todas las partidas de la carga (primera, tras R y tras `Volver al menú` + `Jugar`).
  - Migrar a avance manual las specs E2E de reglas: level-up, health, weapons, results, progress, enemies y las partes
    de pausa, clear-progress y menu-progress que juegan hasta un evento. Se quedan en tiempo real: speed, smoke,
    sprites, menu, menu-flow, la pausa con velocidad 8 y `ticksPerFrame`, y al menos una partida completa con
    `speed=8`.
  - Playwright con dos proyectos, `logic` (avance manual) y `realtime` (tiempo real). La pasada `CI_LIKE=1
    --repeat-each=3` pasa a ejecutarse solo sobre `realtime` y con 2 workers (como CI). `retries` sigue en 0 con
    `CI_LIKE` y en 1 solo con `CI`.
  - Frenado de CPU con CDP: con `CI_LIKE`, un fixture común a todas las specs frena la CPU de cada página con
    `Emulation.setCPUThrottlingRate` (solo chromium; en otros navegadores no se aplica). El rate se mide contra el
    runner de Actions (p. ej., comparando `ticksPerFrame` o frames/s de la misma spec) y se fija como constante
    documentada. Sustituye a subir los workers para simular carga (12 workers cuelgan el PC).
  - Actualizar la tabla de comandos de AGENTS.md con la nueva forma de lanzar la pasada pesada.
  - Delta de la spec viva `simulation-loop`.
- **Fuera**:
  - Cualquier cambio en `src/domain` y `src/application`: el núcleo no conoce `manual` ni `step`.
  - Cambiar el tope de 250 ms por frame, el paso fijo o las reglas del tick.
  - `manual` o `step` fuera de `?e2e`, o disponibles para el jugador.
  - Combinar `manual` con `speed` (multiplicar `step` por la velocidad).
  - Change 0013-world-camera (en apply en otra rama), cambios de balance y cambios en los workflows de CI.
  - Dependencias nuevas.

## Capacidades afectadas
- `openspec/specs/simulation-loop` (modificada): nuevo requisito de avance manual en modo E2E; "Velocidad de
  simulación en modo E2E" y "Velocidad en todas las partidas de la carga" se modifican para recoger que `manual`
  anula `speed`.
- `main-menu`, `run-results`, `progress-persistence`, `pause`: sin cambio de comportamiento; solo se reescriben sus
  E2E. La sonda sigue sin existir fuera de `?e2e`.

## Riesgos y dudas
- **Falsa seguridad**: las specs manuales no ejercitan el acumulador con frames irregulares, el tope de 250 ms, el
  rAF real ni el render bajo carga. Mitigación: esos casos quedan cubiertos por los tests unitarios del bucle
  (spec viva) y por el proyecto `realtime` (speed, smoke, sprites, partida completa a velocidad 8), que es justo el
  que pasa por `CI_LIKE`.
- **Pulsaciones entre `step`**: una tecla pulsada y soltada sin `step` entre medias no llega a ningún tick. La spec
  fijará el orden observable (pulsar → `step` → soltar) y que el input leído al empezar un `step` vale para todos
  sus ticks, como ya ocurre con `speed`.
- **Valores de n**: hay que fijar qué pasa con n = 0, negativo, no entero o muy grande (rango válido y respuesta
  ante un valor inválido, sin avanzar la partida). Lo decide la spec.
- **Dos estilos de test** que mantener (manual y tiempo real); la clasificación de la exploración es orientativa y
  puede ajustarse en apply si una spec mezcla regla y reloj.
- **Rate de frenado**: `setCPUThrottlingRate` frena el hilo principal de la página, pero puede no reflejar el
  coste del render por software (swiftshader, GPU del proceso) ni la CPU más lenta por núcleo del runner. Hay que
  medir antes de fijarlo (misma spec en CI y en local con el rate candidato) y recalibrar si la pasada local sale
  más blanda o más dura que CI. Sin medición previa todavía.
- **Solo chromium**: el frenado depende de CDP; si algún día se añaden otros navegadores, su pasada `CI_LIKE` no
  irá frenada.

## Criterio de éxito
- Con `?e2e&manual&seed=7`, sin llamar a `step`, el tick sigue en 0 tras 2 s reales; tras `step(60)` en una partida
  en curso que no abre ofertas ni termina en esos 60 ticks, el tick ha avanzado exactamente 60.
- `step(n)` con la partida en pausa, eligiendo mejora o terminada ejecuta 0 ticks; con una oferta a mitad, se para
  en el tick de la oferta.
- Sin `?e2e`, `?manual` no cambia nada (1 tick por frame de 16,667 ms y sin aviso); con `?e2e&manual&speed=8`, la
  partida no avanza sin `step`.
- Las specs del proyecto `logic` no contienen `waitForTimeout` ni esperas que sondeen el tick contra el reloj
  (`expect.poll` sobre el tick, `playChoosingFirst` de 100 ms).
- `CI_LIKE=1 npm run test:e2e -- --project=realtime --workers=2 --repeat-each=3`, con el frenado de CPU activo:
  **0 fallos** en 3 pasadas consecutivas, sin reintentos, y el PC sigue usable mientras corre (sin cuelgues).
- El rate de frenado elegido queda registrado en el verify-report con la medición que lo justifica (local frente al
  runner de Actions).
- Suite E2E completa (`logic` + `realtime`) en verde en local y en CI; duración registrada en el verify-report, sin
  umbral.
- `npm run verify` verde; ningún fichero de `src/domain` ni `src/application` modificado; sin dependencias nuevas.
