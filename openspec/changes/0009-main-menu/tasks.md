# Tasks · 0009-main-menu

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → aplicación →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea.
     Ciclo de cada tarea: test en ROJO → código mínimo en VERDE → refactor → `npm run verify`. -->

> **Precondición**: 0008-e2e-fast-sim archivado (en curso en otra rama) antes de **archivar** 0009. No bloquea el
> *apply*.
> Specs: `main-menu` (MM), `simulation-loop` (SL), `progress-persistence` (PP), `run-results` (RR), `hud` (HUD).
> Los escenarios que dependen del DOM o del motor tienen su test en el bloque 5 (E2E). Las tareas 4.x que tocan
> escenas o paneles DOM ponen en rojo un E2E del bloque 5 que se escribe **dentro** de la misma tarea.

## 1. Dominio
Sin tareas: el dominio no cambia (`run-state` sin delta). La pausa y el menú quedan fuera de `Run`.

## 2. Aplicación
- [x] 2.1 `TickRun.discardPending()`, que llama a `loop.reset()`. Test: tras un frame de 25 ms (1 tick y
  8,333 ms sobrantes), `discardPending()` hace que un frame de 8,334 ms dé 0 ticks y un segundo de 8,334 ms dé 1.
  — SL "Sobrante descartado al pausar".
  Ficheros: `src/application/TickRun.ts`, `tests/application/loop.test.ts`.
- [x] 2.2 `ProgressRepository.clear()` con `ProgressClearError` (`unavailable | failed`). Primero el contrato
  compartido en rojo: tras `clear()`, `load()` da `ok(null)`; `clear()` sin nada guardado da `ok`. Después,
  `InMemoryProgressRepository` con `clear`, error programable y contadores `writes` / `clears`, y `FakeStorage` con
  `removeItem` y `removeError`. — PP "Borrar el progreso vacío" y "Borrado confirmado" (parte del repositorio).
  Ficheros: `src/application/ProgressRepository.ts`, `tests/support/InMemoryProgressRepository.ts`,
  `tests/support/FakeStorage.ts`, `tests/application/progress-repository-contract.test.ts`.
- [x] 2.3 Caso de uso `ClearProgress` (tabla `ok / unavailable / failed` del design). Tests:
  - con datos (300, 8, 120) y 3 entradas, la sesión queda vacía, `persistent = true` y el resultado es `cleared`;
  - con `corruptPending = true`, queda a `false`;
  - si `clear()` da `unavailable`, la sesión queda vacía y el resultado es `cleared`;
  - si da `failed`, la sesión queda vacía, el valor guardado no cambia y el resultado es `failed`;
  - dos `execute` seguidos dan `cleared` las dos veces.

  — PP "Borrado confirmado", "Borrar datos dañados", "Borrar sin almacenamiento", "Fallo al borrar" y "Borrar el
  progreso vacío".
  Ficheros: `src/application/ClearProgress.ts`, `tests/application/clear-progress.test.ts`.

## 3. Infraestructura (puro, se prueba en Node)
- [x] 3.1 `LocalStorageProgressRepository.clear()` con `removeItem` en `try`. Tests con `FakeStorage`:
  - borra solo la clave `sprint-survivors/progress` (otra clave sigue intacta);
  - `SecurityError` o un fallo al acceder dan `unavailable`;
  - `QuotaExceededError` da `failed` y el valor sigue igual;
  - nunca lanza.

  — PP "Borrar sin almacenamiento", "Fallo al borrar" y "Borrar datos dañados" (el valor dañado desaparece).
  Ficheros: `src/infrastructure/progress/LocalStorageProgressRepository.ts`,
  `tests/infrastructure/local-storage-progress.test.ts`.
- [x] 3.2 `PauseGate.step` y `paused`. Tests con un `TickRun` real:
  - Esc en `running` pausa y llama a `discardPending`;
  - Esc en `choosing` u `over` no hace nada;
  - en pausa, Esc o `'resume'` reanudan;
  - `'menu'` solo en pausa devuelve `'menu'`;
  - `'resume'` sin pausa no hace nada;
  - Esc y R en el mismo frame: queda en pausa (R se ignora en pausa).

  — MM "Pausar y reanudar con Esc", "Reanudar con el botón", "Esc mientras se elige mejora", "Esc con la partida
  terminada", "Esc y R en el mismo frame"; RR "Teclas sin efecto con la partida terminada" (Esc).
  Ficheros: `src/infrastructure/phaser/PauseGate.ts`, `tests/infrastructure/pause-gate.test.ts`.
- [x] 3.3 `PauseGate.frame`. Tests:
  - en pausa, 300 frames de 16,667 ms y 1 de 5.000 ms dan 0 ticks y el snapshot es igual campo a campo;
  - tras reanudar, 16,667 ms dan exactamente 1 tick;
  - con `speed` 8: 0 ticks en pausa y luego n+8 y n+16;
  - con `speed` 15 y 5.000 ms en pausa: 0 ticks;
  - dos partidas, semilla 42, 1.200 inputs y la política de elección fija, una pausada en los ticks 100, 400 y
    900 durante 300 frames: son iguales en cada tick.

  — SL "Frames durante la pausa", "Primer frame tras reanudar", "Frame largo durante la pausa", "Reanudar a
  velocidad 8", "Pausa a velocidad 15 con frame largo"; MM "La pausa no altera la simulación"; HUD "HUD en pausa"
  (el snapshot no cambia); PP "Pausa sin guardado" (con `RecordRun` + repositorio en memoria: 0 escrituras).
  Ficheros: `src/infrastructure/phaser/PauseGate.ts`, `tests/infrastructure/pause-gate.test.ts`.
- [x] 3.4 `PauseKey` (ESC, evento `down`, una vez por pulsación). Test con el mismo doble de tecla que
  `restart-key.test.ts`: dos `read()` tras un `down` dan `true` y después `false`, y una tecla mantenida sin
  `down` nuevo no vuelve a activarla. — MM "Esc mantenido".
  Ficheros: `src/infrastructure/phaser/PauseKey.ts`, `tests/infrastructure/pause-key.test.ts`.
- [x] 3.5 `MenuController`. Tests:
  - `requestPlay` dos veces da `true` y después `false`, y `takePlay` da `true` una sola vez;
  - con `confirming`, `requestPlay`, `requestExport`, `requestImport` y `openConfirm` dan `false`;
  - `confirm` dos veces da `true` y después `false`;
  - `cancel` vuelve a `idle` sin pedir borrado;
  - `show()` desde `leaving` vuelve a `idle`.

  — MM "Doble clic en Jugar", "Opciones bloqueadas con el diálogo abierto", "Confirmar dos veces", "Cancelar no
  cambia nada" (sin llamada a borrar); RR "Jugar y Esc tras usar los botones del menú" (Jugar sigue con 1 pulsación).
  Ficheros: `src/infrastructure/menu/MenuController.ts`, `tests/infrastructure/menu-controller.test.ts`.
- [x] 3.6 Extraer `importFromFile` de `ResultsProgress` y crear `MenuProgress` y `menuText`. Tests en rojo de
  `MenuProgress`:
  - un import válido da el mensaje con `importado` y los récords fusionados (300, 10, 120);
  - `hola` da `no válido` y 65.537 bytes dan `64 KiB`, sin cambiar la sesión;
  - `clear()` da `borrado` o `no se ha podido borrar` según `ClearProgress`;
  - `exportText()` tras borrar es el progreso vacío;
  - `reset()` borra el mensaje;
  - el mensaje de `MenuProgress` no aparece en `ResultsProgress.view` ni al revés.

  Los tests existentes de `results-progress` siguen en verde.
  — MM "Importar desde el menú", "Import rechazado desde el menú", "Confirmar borra"; PP "Importar desde el
  menú", "Importar tras borrar", "Exportar desde el menú"; RR "Mensajes del menú que no pasan al overlay" y
  "Mensajes del overlay que no pasan al menú" (parte del presentador).
  Ficheros: `src/infrastructure/progress/{importFromFile,MenuProgress}.ts`, `src/infrastructure/dom/menuText.ts`,
  `src/infrastructure/progress/ResultsProgress.ts`, `tests/infrastructure/menu-progress.test.ts`.

## 4. Composición, escenas y paneles
- [x] 4.1 `createRunLauncher`. Tests:
  - la 1.ª `launch()` con `urlSeed` 42 usa la 42;
  - con una fuente que da 123, la 2.ª usa la 123;
  - `onStart` se llama una vez por partida (`runs`);
  - con `?seed=abc`, 4 `launch()` dan semillas en [0, 2³²−1] y 0 avisos (el aviso de la carga lo emite
    `resolveSeed`, una vez);
  - un `StartRun` que falla llama a `onContentError` y devuelve `null`;
  - las partidas son nuevas (tick 0, vida 100/100, nivel 1, sin mejoras).

  — SL "Semilla válida por URL", "Semilla nueva tras volver al menú", "Varios Jugar tras una semilla inválida",
  "Semilla inválida antes y después de Jugar"; MM "Primer Jugar" y "Jugar tras volver al menú" (snapshot inicial).
  Ficheros: `src/composition/runLauncher.ts`, `tests/composition/run-launcher.test.ts`.
- [x] 4.2 `GameScene` con `RunLauncher`, `PauseGate`, `PauseKey` y `SHUTDOWN`, y `main.ts` con las escenas
  `[game, menu]` con `?e2e`. Por ahora no hay menú. **Rojo**: E2E nuevo `tests/e2e/pause.spec.ts`
  (`?e2e&seed=42`), que comprueba:
  - Esc pausa, el tick no cambia durante 300 frames y el overlay `Pausa` es visible;
  - Esc otra vez da tick n+1;
  - R, 1, 2, 3 y el movimiento no tienen efecto en pausa;
  - en oferta y en resultados, Esc no hace nada.

  Se añade `PausePanel` (DOM) y `button.ts` (extraído de `ResultsPanel`). Regresión: los 9 specs E2E existentes en
  verde sin tocar sus `goto`.
  — MM "Pausar y reanudar con Esc", "Reanudar con el botón", "Teclas sin efecto en pausa", "Esc mientras se elige
  mejora", "Esc con la partida terminada", "Carga en modo E2E", "Modo E2E con velocidad"; RR "R en pausa", "Sin
  overlay durante la partida"; HUD "HUD en pausa"; SL "Semilla válida por URL en modo E2E".
  Ficheros: `src/infrastructure/phaser/GameScene.ts`, `src/infrastructure/dom/{PausePanel,button,ResultsPanel}.ts`,
  `src/composition/main.ts`, `src/styles.css`, `tests/e2e/pause.spec.ts`.
- [x] 4.3 `MenuScene` y `MenuPanel` (Jugar, Exportar, Importar y Borrar datos, sin diálogo todavía). Orden de
  escenas `[menu, game]` sin `?e2e`, y **Volver al menú** desde la pausa. La sonda gana `screen` y `runs`, y
  `snapshot` vale `null` en el menú. `SceneProgress.leave()`. **Rojo**: E2E `tests/e2e/menu.spec.ts`:
  - sin parámetros, el menú es visible con los 4 botones en orden y sin HUD, pausa ni resultados;
  - Esc, R, 1, 2, 3 y el movimiento no hacen nada en el menú;
  - `?seed=42` sin `?e2e` muestra el menú y `window.__sprint` es `undefined`;
  - Jugar muestra el HUD `100/100` `10:00`;
  - con `?e2e`: Esc + Volver al menú da `screen` `menu` y `snapshot` `null`, y Jugar da `runs` 2 y tick 0;
  - con `?e2e&speed=8`: tras Volver al menú y Jugar, 8 ticks por frame;
  - `dblclick` en Jugar da `runs` +1 y el tick avanza con normalidad;
  - Esc pausa tras pulsar Jugar con el ratón.

  — MM "Carga sin parámetros", "Carga con semilla y sin e2e", "Teclas sin efecto en el menú", "Jugar arranca la
  partida", "Doble clic en Jugar", "Esc funciona tras pulsar Jugar con el ratón", "Menú tras Volver al menú en
  modo E2E", "Sin sonda fuera de E2E", "Volver al menú desde la pausa", "Jugar tras volver al menú", "Cinco ciclos
  menú-partida" (`runs` y `screen`); SL "Velocidad tras volver al menú", "Velocidad inválida y varios Jugar",
  "Primer frame tras Jugar" (el tick avanza a 1 por frame); RR "R en el menú", "Sin overlay en el menú"; HUD "Sin
  HUD en el menú", "HUD tras volver al menú y jugar".
  Ficheros: `src/infrastructure/phaser/MenuScene.ts`, `src/infrastructure/dom/MenuPanel.ts`,
  `src/composition/{main,progressWiring}.ts`, `src/styles.css`, `tests/e2e/menu.spec.ts`, `tests/e2e/probe.ts`.
- [ ] 4.4 Exportar e Importar del menú conectados a `MenuProgress`, con el mensaje en el panel y `reset()` al
  mostrar el menú. **Rojo**: E2E `tests/e2e/menu-progress.spec.ts`:
  - exportar sin progreso da el vacío;
  - exportar con G de 2 entradas da G y no empieza ninguna partida;
  - importar un fichero válido da `importado` y los récords fusionados;
  - `hola` da `no válido` y 65.537 bytes dan `64 KiB`, y G no cambia;
  - cancelar el selector no da mensaje;
  - Jugar tras usar los botones crea 1 partida;
  - E1 desde resultados es igual byte a byte a E2 desde el menú;
  - el `no válido` del overlay no pasa al menú y los mensajes del menú no pasan al overlay.

  — MM "Exportar sin progreso", "Importar desde el menú", "Import rechazado desde el menú", "Jugar tras usar los
  botones"; PP "Exportar desde el menú", "Mismo fichero desde los dos sitios", "Cancelar el selector en el menú",
  "Rechazo en el menú y Jugar"; RR "Mensajes del menú que no pasan al overlay", "Mensajes del overlay que no
  pasan al menú".
  Ficheros: `src/composition/progressWiring.ts`, `src/infrastructure/dom/MenuPanel.ts`,
  `tests/e2e/menu-progress.spec.ts`.
- [ ] 4.5 `ConfirmDialog` + Borrar datos → `ClearProgress`. Mientras el diálogo está abierto, los botones del
  menú llevan `disabled`. El foco va a *Cancelar*, y el diálogo no escucha Esc. **Rojo**: E2E
  `tests/e2e/clear-progress.spec.ts`:
  - 0 diálogos nativos (con `page.on('dialog')`);
  - con el diálogo abierto, Jugar y Exportar forzados no hacen nada;
  - Esc y R no cierran el diálogo;
  - *Cancelar* deja E2 igual byte a byte a E1 y el valor guardado intacto, también con datos dañados (luego el
    aviso `dañados` sale en resultados);
  - *Confirmar* da `borrado`, el export vacío y, tras recargar, vacío y sin avisos `progress`;
  - *Confirmar* dos veces no da errores;
  - sin almacenamiento (`SecurityError`) da `borrado`; con `QuotaExceededError` al borrar da `no se ha podido
    borrar` y G intacto;
  - con datos dañados, borrar + Jugar + fin no muestra `dañados`;
  - borrar + Jugar + derrota da los récords de esa partida y 1 entrada.

  — MM "Diálogo propio", "Cancelar no cambia nada", "Confirmar borra", "Opciones bloqueadas con el diálogo
  abierto", "Confirmar dos veces", "Teclas con el diálogo abierto"; PP "Borrado confirmado", "Partida tras
  borrar", "Cancelar sin cambios", "Borrar datos dañados", "Cancelar con datos dañados", "Borrar sin
  almacenamiento", "Fallo al borrar", "Borrar el progreso vacío", "Datos dañados con el menú abierto", "Menú con
  almacenamiento bloqueado".
  Ficheros: `src/infrastructure/dom/ConfirmDialog.ts`, `src/infrastructure/dom/MenuPanel.ts`,
  `src/composition/progressWiring.ts`, `src/styles.css`, `tests/e2e/clear-progress.spec.ts`,
  `tests/e2e/progressFixtures.ts`.

## 5. E2E de recorrido y regresión
- [ ] 5.1 Recorrido sin `?e2e` en la build de producción, con P0 de 2 entradas:
  - Jugar, 2 s, Esc, overlay `Pausa` con `Reanudar` y `Volver al menú`, Volver al menú;
  - E1 = P0 (la partida abandonada no figura);
  - Borrar + Cancelar, y E2 = E1 byte a byte;
  - Borrar + Confirmar, y E3 vacío;
  - 0 diálogos nativos, 0 `pageerror` y 0 `securitypolicyviolation` (con `watchCsp`);
  - después, recarga → Exportar vacío y sin avisos `progress`.

  Rojo si falla cualquier paso del flujo que las tareas 4.x no cubrieron juntas.
  — MM "Recorrido del menú sin sonda", "Borrado que sobrevive a la recarga", "La partida abandonada no se guarda";
  PP "Partida abandonada con Volver al menú"; RR "Aviso de datos dañados tras una partida abandonada";
  RR/PP "Jugar y Esc tras usar los botones del menú".
  Ficheros: `tests/e2e/menu-flow.spec.ts`.

## 6. Documentación
- [ ] 6.1 Actualizar AGENTS.md §1 (estado: menú, pausa y borrado; `?e2e` salta el menú solo al cargar) y el
  README si describe el arranque. Pasar ADR-0011 a **aceptada** tras verify. Registrar la sesión en el diario de
  IA (`docs/ai-log/`). Test: `npm run verify` y `npm run test:e2e` en verde (no hay test en rojo propio; es la
  tarea de cierre).
  Ficheros: `AGENTS.md`, `docs/adr/0011-pantallas-escenas-y-controles-dom.md`, `docs/ai-log/…`.
