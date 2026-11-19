# Exploración · 0006-run-lifecycle-hud

Intención: temporizador, victoria y derrota, estados de la partida y HUD (GDD: Must "temporizador, victoria y derrota · HUD"; roadmap 0006).

## Contexto actual
- `src/domain/run/RunStatus.ts`: `'running' | 'choosing' | 'over'`. `over` ya existe y solo se alcanza con vida 0 (`Run.applyContact`, `Run.ts`); es irreversible y congela todo (spec `run-state`). No distingue victoria de derrota.
- Reloj: no hay temporizador. Solo `tickCount` (`Run.ts`), expuesto como `snapshot.tick` (60 ticks = 1 s, `TICK_SECONDS`). El dominio no usa reloj de sistema, así que el tiempo de partida ES el tick. No hay duración objetivo en `content/*.json` ni en `RunConfig` (`RunConfig.ts`).
- Pausa por mejora: `choosing` ya funciona (spec `run-state` y `simulation-loop`; `TickRun.execute` resetea el bucle si no está `running`). No hay pausa con Esc (el GDD la prevé en Controles) ni reinicio; `StartRun` se invoca una sola vez en `src/composition/main.ts`.
- Contador de bajas: no existe en `Run` ni en el snapshot (solo `removeDead()` suelta gemas). El GDD pide "tiempo, nivel y enemigos eliminados" en la pantalla de resultados.
- HUD actual (`src/infrastructure/phaser/GameScene.ts`): solo `XpBar` (barra + etiqueta de nivel/XP) y `UpgradeOverlay`; `HUD_DEPTH`/`OVERLAY_DEPTH` "pensando en 0006". El snapshot ya trae `player.health/maxHealth`, `progression.level/xp/xpToNext` y `tick`; faltan duración objetivo y bajas. No hay pantalla de victoria/derrota: al morir la escena queda congelada.
- Patrón de vista testable sin motor: `XpBar` + `xpBarFill.ts` + `tests/infrastructure/xp-bar.test.ts`; `playerBlink.ts`.
- Tests existentes que dependen de `over`: `tests/domain/run-state.test.ts`, `run-contact.test.ts`, `long-run.test.ts` (usa `LONG_RUN_HEALTH`), E2E `health.spec.ts` (`expect(status).not.toBe('over')`) y `tests/e2e/probe.ts` (`window.__sprint`, solo con `?e2e`).
- Oleadas: `content/waves.json` llega hasta el tramo de 480 s con presupuesto 7/s; el GDD habla de partidas de ~10 min (36.000 ticks, ya usado en `simulation-loop`). Un jugador quieto muere hacia los 16-70 s según vida/armas (retros 0003/0005).

## Capacidades/specs afectadas
- `run-state` (MODIFIED): distinguir terminada por derrota y por victoria; la victoria también congela la simulación; la tabla de transiciones.
- `simulation-loop` (MODIFIED): snapshot (duración objetivo, bajas, resultado), orden del tick (dónde se comprueba la victoria frente a la muerte), `TickRun`.
- Nuevas: `run-timer` o `run-outcome` (duración, victoria, empate muerte/victoria), `hud` (qué se pinta y cuándo), `run-results` (pantalla final).
- `player-health` (menor: "fin de partida" pasa a "derrota"). `enemy-spawning`: los escenarios largos (36.000 ticks) cambian si la victoria termina la partida antes. Un campo nuevo en `RunConfig` obliga a tocar los builders de `tests/support/builders.ts`.
- ADR candidato: modelo de resultado de partida (estado vs. resultado ortogonal).

## Opciones
**A. Resultado como parte del estado.** `RunStatus` = `running | choosing | won | lost` (se elimina `over`).
- Pros: una sola variable; el snapshot y la escena ramifican con un `switch` exhaustivo (`assertNever` ya existe).
- Contras: rompe el literal `over` en specs, tests y E2E (renombrado amplio); `won`/`lost` repiten "terminada" en cada guarda.

**B. Estado + resultado ortogonales.** Se mantiene `over`; se añade `snapshot.outcome: 'won' | 'lost' | null`.
- Pros: casi no rompe `run-state` ni los tests existentes; "terminada" sigue siendo un solo concepto congelado.
- Contras: combinación inválida posible (`over` con `null`) que hay que blindar por invariante; dos campos que leer.

**C. B + escena de resultados aparte y reinicio mínimo.** Como B, con una `ResultScene`/overlay de Phaser y un caso de uso `RestartRun` que crea una `Run` nueva con otra semilla.
- Pros: cierra el bucle jugable (jugar, terminar, volver a jugar) y lo prueba un E2E de derrota.
- Contras: reiniciar exige reconstruir pools de capas y la composición (hoy una sola `Run` por carga), más superficie y riesgo; solapa con el menú de 0007.

HUD (válido en cualquiera): (i) más objetos en `GameScene` (simple, `GameScene` ya tiene ~180 líneas) o (ii) un `HudScene` paralela de Phaser (separa responsabilidades, pero añade comunicación entre escenas y su propio ciclo de vida). Un `Hud` con lógica pura (formateo de mm:ss, fracción de vida) testeable como `XpBar`.

## Riesgos e incógnitas
- E2E de victoria: esperar 10 min reales no es viable (los E2E actuales ya tardan 57 s y 1,2 min). Opciones: duración corta inyectada por contenido de test, un parámetro `?e2e` validado con zod, o probar la victoria solo en unitarios. Un parámetro de URL es entrada externa (regla 6: zod).
- Equilibrio: con el contenido actual, ¿se puede ganar a 600 s? Hay que medir (patrón de la tarea 0 de 0005) antes de fijar el plazo; la duración gobierna también qué tramos de `waves.json` se ven.
- Empate: vida 0 y fin de temporizador en el mismo tick; el orden del tick (`applyContact` antes de gemas/director) sugiere que gane la derrota, pero hay que fijarlo en spec.
- Gemas y oferta en el tick de victoria: replicar la regla del tick de la muerte (no abrir oferta ni recoger) o dejar completarlo; afecta al determinismo.
- Cambiar el congelado de `over` toca escenarios de 600 y 36.000 ticks de varias specs (`enemy-spawning`, `enemy-behavior`): revisar los GIVEN con vida suficiente (lección de 0003 W1).
- Deuda: `Run.ts` ya tiene 307 líneas (> 300); añadir temporizador y bajas empuja a extraer piezas. S5 (`snapshot()` asigna por frame) crece con los campos nuevos.
- Pausa con Esc: es nuevo estado `paused`; interactúa con `choosing` (no pausar mientras se elige) y con el acumulador del bucle.
- Menú/reinicio/guardado: 0007 y "menú" (Must) aún no tienen change; riesgo de que 0006 invada.

## Preguntas para el usuario
1. Duración objetivo de la partida: ¿600 s (GDD "~10 min") o menos para el primer balance (p. ej. 300 s)? ¿En `content/run.json`?
2. ¿Qué ocurre al morir o ganar: overlay de resultados en la misma escena, y se puede reiniciar con una tecla (R/Enter) o recargando la página?
3. ¿Contenido de la pantalla de resultados: resultado, tiempo, nivel y bajas (GDD)? ¿Se añade ya el contador de bajas a `Run`?
4. ¿HUD: vida (barra + número), XP/nivel (ya hecho), tiempo restante o transcurrido, bajas? ¿En la misma escena o en `HudScene`?
5. ¿Pausa con Esc entra en este change (nuevo estado) o se difiere?
6. ¿Se prueba la victoria en E2E con duración corta inyectada o solo en unitarios?
7. En empate muerte/victoria en el mismo tick, ¿gana la derrota?
8. Menú de inicio: ¿fuera de 0006 y junto a 0007?
