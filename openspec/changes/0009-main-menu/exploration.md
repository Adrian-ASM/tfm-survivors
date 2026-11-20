# Exploración 0009-main-menu

## Contexto actual
- Arranque directo: `src/composition/main.ts` `bootstrap()` carga contenido, resuelve `?seed=` (`resolveSeed`) y `?speed=` (`resolveSpeed`, una vez por carga), ejecuta `StartRun` y crea `Phaser.Game` con una única escena `GameScene('game')` ya con la partida en marcha. No hay menú ni escena previa.
- `?e2e` solo expone `window.__sprint` (probe: seed, speed, snapshot, results, progress). Los 9 specs de `tests/e2e/` (26 `goto`) arrancan la partida directamente con `?e2e&seed=N[&speed=N]`.
- Bucle: `GameScene.update(_, deltaMs)` -> `advanceFrame` (`src/infrastructure/phaser/advanceFrame.ts`) -> `TickRun.execute` -> `FixedStepLoop.advance` (acumulador, tope 250 ms). Con `status !== 'running'` (oferta/fin) `TickRun` hace `loop.reset()` y no avanza. El tiempo de frame lo da Phaser (`delta`), no `Clock`.
- Progreso: puerto `ProgressRepository` (`load`/`save`, síncrono, nunca lanza; ADR-0010), `LocalStorageProgressRepository` (clave `sprint-survivors/progress`), `ProgressSession`, casos de uso `LoadProgress`, `RecordRun`, `ImportProgress`. Export/import viven en el panel DOM `ResultsPanel` + `src/composition/progressWiring.ts` (`downloadProgress`, `readProgressFile`), visible solo al terminar la partida.
- No existe "borrar datos": falta `clear()`/`remove()` en el puerto, el caso de uso (p. ej. `ClearProgress`, que deje `session.progress` vacío y `persistent`/`corruptPending` coherentes), su adaptador y fake de tests. No hay entrada externa que validar (solo confirmación de usuario).
- Reinicio: `RestartKey` (R) + `RestartRun` (solo desde `over`), `GameScene.restart` sustituye `started` (ADR-0009).

## Specs afectadas
- `simulation-loop` (pausa: no avanza ni acumula tiempo; sin ráfaga al reanudar; interacción con `speed`), `run-state` (¿estado de pausa?), `run-results` (R solo con partida terminada; el panel de export/import cambia de sitio o se duplica), `progress-persistence` (nuevo requisito de borrado; CSP/escenarios de import sin cambios), `hud` (overlay de pausa). Nueva spec probable: `main-menu`. `architecture-guardrails` sin cambios si la pausa queda en infraestructura.
- Deudas: 0006·W2 (reinicio tras victoria sin E2E; solo `restart-run.test.ts` y `layers-clear.test.ts`). Victoria con semilla fija es difícil (0006·W1: 1/10 semillas, semilla 2 con `fleeInput`); un E2E de victoria necesita la semilla ganadora o un contenido de test, lo que puede no encajar.

## Opciones
**A. Escena de menú Phaser (`MenuScene`) + `GameScene` arrancada bajo demanda.** Pros: separación natural, la pausa puede ser `scene.pause()`/overlay. Contras: `GameScene` hoy recibe la partida ya creada en el constructor; hay que mover `StartRun` al "Jugar"; cambia el arranque de todos los E2E; botones en Phaser (más código de UI) o mezclados con DOM.
**B. Menú en DOM (como `ResultsPanel`), una sola `GameScene`.** El juego arranca en estado "menu" y "Jugar" lo pone en marcha. Pros: reutiliza Export/Import DOM y su CSP; cambio pequeño; confirmación con `confirm()`-like propio (nunca `window.confirm`, frágil en Playwright). Contras: Phaser sigue corriendo `update` bajo el menú (hay que no avanzar); más estado de adaptador.
**C. Pausa como puerta en el adaptador vs. caso de uso.** C1: `GameScene` salta `advanceFrame` si `paused` (el núcleo no se entera; al reanudar `loop.reset()` o no pasar delta del tiempo pausado; Phaser da delta pequeño tras reanudar, y el tope de 250 ms lo acota). Pros: pureza, sin tocar spec del núcleo. Contras: sin test unitario (depende de Phaser; ver 0006·W2) salvo extraer un controlador puro `PauseGate` testeable en Node, patrón de `advanceFrame`. C2: `PauseRun` en application. Pros: testable, spec explícita. Contras: meter pausa en `Run` filtraría estado de UI al dominio; solo vale si vive fuera de `Run` (en `TickRun`).

## Riesgos e incógnitas
- E2E: el arranque directo con `?seed=` debe seguir existiendo. Opciones: `?e2e` salta el menú (menos fiel) o los E2E pulsan "Jugar" (más fiel, 26 `goto` a revisar). Hay que decidir y además especificar que `?seed=`/`?speed=` se leen una vez por carga y "Jugar" usa la semilla de la URL; reinicios siguen con semilla nueva.
- Pausa y `?speed`: `simSpeed` multiplica avances por frame; pausar no debe dejar acumulador con tiempo. "Sin perder ticks" (criterio GDD) contradice el reset del acumulador en otros estados: precisar, probablemente "no se pierde ni se gana tiempo simulado: el tiempo en pausa no cuenta".
- Esc y foco: el botón DOM suelta el foco para que R vaya al juego; con menú DOM hay que cuidar que Esc llegue a Phaser. Pausa en oferta de mejora/fin de partida: ¿permitida?
- Borrar con almacenamiento no disponible o corrupto; tras borrar, ¿limpiar también `session` en memoria y el panel? Evitar `window.confirm`.
- Pausar al perder foco de pestaña (Phaser ya pausa por visibilidad): comprobar `delta` al volver.
- Ubicación del panel de export/import: ¿se mantiene al terminar partida y se duplica en menú?

## Mediciones previas
No aplican (no fija balance, ritmo ni rendimiento).

## Preguntas para el usuario
1. ¿Menú DOM (B) o escena Phaser (A)?
2. ¿`?e2e` se salta el menú o los E2E pulsan "Jugar"?
3. ¿Esc también en oferta de mejora y en fin de partida, o solo con partida en curso? ¿Pausa ofrece "Volver al menú"?
4. ¿Se mueve Export/Import al menú, se mantiene en resultados, o ambos?
5. ¿Entra 0006·W2 (E2E reinicio tras victoria) aun necesitando semilla/contenido ganador, o se mantiene fuera?
