# Design · 0009-main-menu

> Revisado contra las specs delta del change: `main-menu`, `simulation-loop`, `progress-persistence`,
> `run-results` y `hud`. Si este documento y una spec chocan, manda la spec (ver §Reconciliación).
>
> **Precondición**: este change se apoya en los requisitos de velocidad de `0008-e2e-fast-sim`
> ("Avance acelerado por frame", "Velocidad de simulación en modo E2E"). 0008 está fusionado pero sin archivar, y su
> archivo está en curso en otra rama. **0008 debe archivarse antes que 0009**, como pide el delta de
> `simulation-loop`.

## Resumen
Hay dos escenas del motor: `MenuScene` (inicio) y `GameScene` (partida). Las dos solo pintan y enrutan.

Los controles clicables son DOM, como `ResultsPanel`: `MenuPanel`, `ConfirmDialog` y `PausePanel`. Las reglas de
esas pantallas viven en controladores puros que se prueban en Node:
- `MenuController`: Jugar una sola vez y opciones bloqueadas mientras el diálogo está abierto.
- `PauseGate`: Esc solo en curso, 0 ticks en pausa y sobrante descartado al pausar.

**Jugar** arranca `GameScene`, que pide la partida a un `RunLauncher` de la composición. `StartRun` se ejecuta en
ese momento: la primera partida de la carga usa la semilla de la URL y las siguientes una nueva.

La pausa vive fuera de `Run`. Solo se añade a `TickRun` un método para descartar el sobrante del acumulador.

**Borrar datos** añade `clear()` a `ProgressRepository` y el caso de uso `ClearProgress`.

Con `?e2e`, la lista de escenas pone `GameScene` primero y el arranque es el actual. Con o sin `?e2e`, **Volver al
menú** lleva al menú.

Vía de consulta de la API de Phaser: el MCP `phaser-docs` (la página publicada es de la v4.1.0) y, para la 4.2.1
instalada, el código de `node_modules/phaser/src` (ver §API del motor).

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Sin cambios. Ni la pausa ni el menú son estados de `Run` (spec run-state sin cambios). Se reutiliza `EMPTY_PROGRESS`. |
| application | `TickRun` | Mod. | + `discardPending()`, que llama a `loop.reset()`. Lo usa `PauseGate` al pausar (spec simulation-loop: "Sobrante descartado al pausar"). No cambia ninguna regla de `Run`. |
| application | `ProgressRepository` | Mod. | + `clear(): Result<void, ProgressClearError>`, con `code: 'unavailable' \| 'failed'`. Nunca lanza (ADR-0010). Dos implementaciones: `LocalStorageProgressRepository` e `InMemoryProgressRepository` (tests), con el contrato compartido. |
| application | `ClearProgress` | Nueva | Caso de uso; ver §Borrar datos. Devuelve `{ outcome: 'cleared' \| 'failed' }`. *Cancelar* no llega aquí, así que no hay escrituras ni borrados por construcción. |
| application | `FixedStepLoop`, `StartRun`, `RestartRun` | — | Sin cambios. |
| infrastructure/phaser | `PauseGate` | Nueva | Puro, sin import del motor (patrón de `advanceFrame`). Métodos: `step(esc, action, status, run)` → `'menu' \| null`, `paused` y `frame(run, elapsedMs, input, speed)`. Al pausar llama a `run.discardPending()`; en pausa devuelve `run.snapshot()` sin llamar a `execute`. |
| infrastructure/phaser | `PauseKey` | Nueva | Tecla `ESC` con el evento `down`, que se emite una vez por pulsación aunque se mantenga. Mismo patrón que `RestartKey`. |
| infrastructure/phaser | `MenuScene` | Nueva | Clave `'menu'`. `create()`: título en el canvas y `menu.show()`. `update()`: si `menu.takePlay()`, llama a `scene.start('game')`. Al recibir `SHUTDOWN` llama a `menu.hide()`. No registra teclas. |
| infrastructure/phaser | `GameScene` | Mod. | El constructor recibe `RunLauncher` en lugar de `StartedRun`, más `PauseView` y `onScreen`. `create()`: `launcher.launch()`, widgets y `PauseGate` nuevo. Al recibir `SHUTDOWN`: oculta la pausa, `progress.leave()`, y `w`, `last` y la puerta a cero. |
| infrastructure/phaser | `RunLauncher` (interfaz) | Nueva | `launch(): StartedRun \| null`. `null` significa que la composición ya ha pintado el error de contenido. Es un tipo de la escena, no un puerto. |
| infrastructure/menu | `MenuController` | Nueva | Puro, sin DOM. Estados `idle \| confirming \| leaving`. Métodos `requestPlay()`, `takePlay()`, `requestExport()`, `requestImport()`, `openConfirm()`, `confirm()`, `cancel()` y `show()`, que vuelve a `idle`. Con `confirming` o `leaving` las acciones del menú devuelven `false`. `confirm()` y `cancel()` solo actúan en `confirming`. |
| infrastructure/dom | `MenuPanel` | Nueva | `section` con Jugar, Exportar, Importar y Borrar datos (en ese orden), el `input[type=file]` oculto y el mensaje (`role="status"`). Delega en `MenuController`. Con el diálogo abierto, sus botones llevan `disabled`. |
| infrastructure/dom | `ConfirmDialog` | Nueva | `div role="alertdialog" aria-modal="true"` con *Confirmar* y *Cancelar*. **No** usa `<dialog>` nativo, que se cierra con Esc (spec: solo se cierra con los botones), ni `window.confirm`. No escucha el teclado. |
| infrastructure/dom | `PausePanel` | Nueva | `section role="dialog" aria-label="Pausa"` con el texto `Pausa`, Reanudar y Volver al menú. `takeAction(): 'resume' \| 'menu' \| null`. |
| infrastructure/dom | `button.ts` | Nueva (extraída) | Botón que suelta el foco tras el clic. Hoy es privado en `ResultsPanel`; pasa a compartirse. |
| infrastructure/dom | `menuText.ts` | Nueva | Mensajes del menú: `importado`, `64 KiB` y `no válido` (los mismos de `PANEL_MESSAGES`), `borrado` y `no se ha podido borrar`. |
| infrastructure/progress | `MenuProgress` | Nueva | Presentador del menú, sin DOM: `exportText()`, `importFile(file)`, `clear()`, `reset()` y `view`. Su mensaje es independiente del de `ResultsProgress` y se borra con `reset()` cada vez que se muestra el menú. |
| infrastructure/progress | `importFromFile` | Nueva (extraída) | `readProgressFile` + `ImportProgress` → `PanelMessage`. La comparten `ResultsProgress` y `MenuProgress`: misma validación y mismos mensajes. |
| infrastructure/progress | `LocalStorageProgressRepository` | Mod. | `clear()` hace `removeItem(key)` en `try`. Si falla el acceso o hay un `SecurityError`, devuelve `unavailable`; cualquier otra excepción, `failed`. `ProgressStorage` incluye `removeItem`. |
| composition | `runLauncher.ts` | Nueva | `createRunLauncher({ config, urlSeed, randomSeed, onStart, onContentError })` (objeto de opciones; ajustado en el apply). La 1.ª partida de la carga usa `urlSeed` y las demás `randomSeed()`, sin releer la URL ni avisar. `onStart(seed)` actualiza `probe.seed` y `probe.runs`. Si `StartRun` falla, llama a `onContentError` (la composición pasa `showContentError`, que usa `document`) y devuelve `null`. |
| composition | `main.ts` | Mod. | Ya no llama a `StartRun` al cargar. Escenas `[game, menu]` con `?e2e` y `[menu, game]` sin él. La sonda gana `screen: 'menu' \| 'playing' \| 'paused'` y `runs` (partidas creadas en la carga), y `snapshot` vale `null` en el menú. |
| composition | `progressWiring.ts` | Mod. | Comparte `session` y `repository` con `ClearProgress` y `MenuProgress`, conecta `MenuPanel` y `ConfirmDialog`, y añade `leave()` a `SceneProgress`, que oculta el panel de resultados. |
| tests/support | `FakeStorage`, `InMemoryProgressRepository` | Mod. | `removeItem` con `removeError`, y contadores de escrituras y borrados (spec: "0 escrituras y 0 borrados"). |
| — | `src/styles.css` | Mod. | `.menu-panel`, `.pause-panel` y `.confirm-dialog` (sin estilos inline: CSP). |

### Por qué cada cosa va donde va
- **La pausa, en el adaptador, salvo el descarte del sobrante**:
  - Es un estado de la presentación; el núcleo no lo conoce (ADR-0002, `run-state` sin cambios).
  - Descartar el sobrante sí tiene que tocar el acumulador, que es privado de `TickRun`. Por eso se añade
    `discardPending()`: es una operación del bucle que ya existe (`loop.reset()`, la misma que se usa en la
    elección), no un estado nuevo.
- **Controladores puros y DOM fino**: Vitest corre en `node` sin jsdom, y los paneles DOM solo se prueban en E2E.
  Las reglas con escenarios precisos (doble clic en Jugar, opciones bloqueadas, Confirmar dos veces, Esc solo en
  curso) viven en `MenuController` y `PauseGate`, que se prueban en rojo en Node.
- **Controles DOM y escenas Phaser**: ver ADR-0011.
  - Importar necesita un `<input type=file>` real.
  - Exportar e Importar ya son DOM en resultados.
  - Los roles ARIA hacen el menú observable sin sonda.
- **`RunLauncher` en la composición**: es lo único que conoce `Mulberry32RandomGenerator`, la semilla de la URL y
  la sonda (AGENTS.md §3.4).

## Flujo

### Arranque
```
bootstrap: loadRunConfig → resolveSeed (aviso de seed: 1 vez, al cargar) → resolveSpeed (1 vez) → wireProgress
  ?e2e:     scenes [GameScene, MenuScene] → GameScene.create → launcher.launch() (seed URL)
  sin e2e:  scenes [MenuScene, GameScene] → MenuScene.create → MenuPanel visible, sin Run, sin sonda
```
Phaser arranca la primera escena de la lista (`autoStart: i === 0`). Con `?e2e`, `MenuScene` no se crea hasta
**Volver al menú**, así que el menú no se ve en ningún frame. Lo observable es lo de ahora: la sonda con la misma
semilla, la misma velocidad y `snapshot` desde el primer render. El aviso de una semilla inválida se emite al
cargar, una sola vez ("como muy tarde cuando empieza la primera partida").

### Frame de `GameScene.update`
```
1. esc = PauseKey.read(); act = PausePanel.takeAction(); r = RestartKey.read(); choice = ChoiceKeys.read()
2. if (gate.step(esc, act, last.status, tickRun) === 'menu') → scene.start('menu'); return
3. if (!gate.paused) { if (r) restart(); elección → ChooseUpgrade }   // en pausa se leen y se descartan
4. snapshot = gate.frame(tickRun, deltaMs, move.read(), simSpeed)     // en pausa: 0 ticks
5. PausePanel.setVisible(gate.paused); render(snapshot); onScreen(gate.paused ? 'paused' : 'playing')
```
- `gate.step`:
  - Si `esc` llega con `status === 'running'`, cambia la pausa. Al pasar a pausa llama a `run.discardPending()`.
  - `act === 'resume'` solo actúa en pausa.
  - `act === 'menu'` solo actúa en pausa y devuelve `'menu'`.
  - Con `choosing` u `over`, Esc no hace nada.
- **0 ticks en pausa**, sea cual sea `deltaMs` (5.000 ms incluidos) y la velocidad. Al reanudar, el acumulador ya
  está a 0: el primer frame de 16,667 ms da exactamente 1 tick (N con `speed = N`), y uno de 8,334 ms da 0.
- **La pausa no altera la simulación**: los ticks dependen solo del input de cada tick, y descartar tiempo real no
  cambia su contenido (escenario "La pausa no altera la simulación", que se prueba en Node con `PauseGate` y
  `TickRun`).
- **Esc y R en el mismo frame**: Esc pausa en el paso 2, así que R se descarta en el 3. Sin pausa, R con la
  partida en curso ya no hace nada (`RestartRun`).
- **Primer frame tras Jugar**: `StartRun` crea un `TickRun` con un `FixedStepLoop` nuevo (acumulador 0). El tiempo
  pasado en el menú nunca llega a ningún bucle.
- **Pestaña oculta sin pausa**: no cambia. No hay autopausa; rigen el tope de 250 ms y 15 ticks por avance de
  `FixedStepLoop` y el `resetDelta` de Phaser al volver (`TimeStep.resume`).

### Volver al menú y limpieza
`scene.start('menu')` (en cola hasta el siguiente paso) apaga `GameScene`:
- `DisplayList.shutdown` destruye todos sus objetos: sprites, HUD y overlays.
- `KeyboardPlugin.shutdown` hace `removeAllKeys(true)`.
- En `SHUTDOWN` la escena oculta `PausePanel` y `progress.leave()` oculta el panel de resultados.
- `onScreen('menu')` deja `probe.snapshot = null`.
- La partida abandonada no llega a `over`, así que `RecordRun` no la registra ni escribe. `corruptPending` sigue
  pendiente para la siguiente partida que termine (run-results: "Aviso de datos dañados tras una partida abandonada").
- `MenuScene.create` → `menu.show()` → `MenuController.show()` + `MenuProgress.reset()`, sin mensajes heredados.
- El siguiente Jugar vuelve a ejecutar `GameScene.create()`. Los pools se crean una vez por partida, no por frame.
  R dentro de una partida sigue reutilizando objetos (ADR-0009).

### Jugar, una sola vez
El clic llama a `MenuController.requestPlay()`. Si está en `idle`, pasa a `leaving`: el panel se oculta y sus
botones se desactivan. Un segundo clic, en el mismo frame o en el siguiente, devuelve `false`. `MenuScene.update`
consume `takePlay()` una vez y llama a `scene.start('game')` una sola vez, así que la semilla de la URL no se gasta
en una partida descartada.

### Borrar datos
`Borrar datos` → `MenuController.openConfirm()` (`confirming`). Los demás botones del menú quedan desactivados y
cualquier acción se ignora. El diálogo no escucha Esc ni R, y `MenuScene` no registra teclas.
- **Cancelar**: cierra el diálogo y no llama a nada (0 escrituras, 0 borrados; los datos dañados siguen
  intactos y pendientes de aviso).
- **Confirmar**: `controller.confirm()` (solo la primera vez) → `MenuProgress.clear()` → `ClearProgress.execute()`.

| `repository.clear()` | Sesión | Mensaje del menú |
|---|---|---|
| `ok` (incluido si no había nada guardado) | vacía, `persistent = true`, `corruptPending = false` | `borrado` |
| `unavailable` (sin almacenamiento, `SecurityError`) | vacía, `persistent = false`, `corruptPending = false` | `borrado` |
| `failed` (por ejemplo `QuotaExceededError` al borrar) | vacía, `persistent = false`, `corruptPending = false`; el valor guardado no cambia | `no se ha podido borrar` |

- **Borrar la clave (`removeItem`) y no escribir el progreso vacío.** Es lo que el jugador espera de "Borrar
  datos": el navegador se queda sin datos suyos (privacidad). Una carga posterior obtiene `ok(null)` → progreso
  vacío sin avisos, el mismo camino que la primera visita. No hace falta ninguna escritura, y los datos dañados
  desaparecen sin validarlos. `save(EMPTY_PROGRESS)` también cumpliría la spec, pero deja un valor que el jugador
  no ha pedido y puede fallar por cuota.
- **`unavailable` da `borrado`**: si no hay almacenamiento accesible, no queda nada del jugador en el navegador y
  el progreso en uso queda vacío. Así lo pide la spec ("Borrar sin almacenamiento").
- `corruptPending = false` en los tres casos: tras confirmar, el aviso `dañados` no debe salir (spec).

### Foco del teclado
Phaser escucha el teclado en `window` (`input.keyboard.target`, por defecto `window`; `Config.js`), así que un
botón DOM con el foco no se traga Esc ni R. Lo que sí podría pasar es que Espacio o Intro activen un botón con el
foco. Para evitarlo:
- Todo botón suelta el foco tras el clic (`dom/button.ts`).
- Un panel que se oculta suelta antes el foco que contenga.
- Al abrirse, `ConfirmDialog` pone el foco en *Cancelar*, y al cerrarse lo suelta.

Esto cumple "Esc funciona tras pulsar Jugar con el ratón". Los clics DOM solo activan banderas: las llamadas al
motor se hacen dentro de `update`.

### Observabilidad para pruebas (sin `?menu`: la spec manda)
- **Sin `?e2e`**: no hay sonda (spec main-menu: "Sin sonda fuera de E2E"). Los E2E solo observan el DOM:
  `getByRole('button', { name: 'Jugar' })`, `getByRole('dialog', { name: 'Pausa' })`, `getByRole('alertdialog')`
  y la visibilidad de los paneles. También descargas, consola y `localStorage`.
- **Con `?e2e`**: la partida arranca al cargar. Los flujos de menú con sonda se recorren con Esc → **Volver al
  menú** → **Jugar**, porque el bypass solo afecta a la carga. La sonda da `screen`, `runs`, `seed` y `snapshot`
  (`null` en el menú).
- **Lo que solo existe sin `?e2e`** se prueba en Node, en `tests/composition/run-launcher.test.ts`:
  - `?seed=42` + Jugar usa la 42.
  - Semilla inválida y varios Jugar: un solo aviso.
  - Los ticks exactos tras Jugar, en `PauseGate` y `TickRun`.

## API del motor consultada
- `ScenePlugin.start` (apaga esta escena y arranca otra, en cola), `run`, `sleep` y `stop`: MCP `phaser-docs`,
  `/api-documentation/class/scenes-sceneplugin` (v4.1.0). Descarto `sleep`/`wake` porque habría que reiniciar la
  partida a mano al volver a jugar, y `start` ya da una escena limpia.
- Comprobado en la 4.2.1 instalada (`node_modules/phaser/src`):
  - `scene/SceneManager.js`: con `autoStart: (i === 0)` arranca la primera escena de la lista.
  - `gameobjects/DisplayList.js`: `shutdown` destruye los hijos.
  - `input/keyboard/KeyboardPlugin.js`: `shutdown` llama a `removeAllKeys(true)`.
  - `core/TimeStep.js`: `resume` llama a `resetDelta`; `delta` está limitado a `_min`.
  - `core/Config.js`: el teclado escucha en `window`.
  - `input/keyboard/keys/KeyCodes.js`: `ESC: 27`.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. DOM nativo y Phaser 4.2.1 ya instalado. | jsdom/happy-dom para probar los paneles en Vitest: las reglas van en controladores puros y el DOM se cubre en E2E. Los `DOMElement` de Phaser: más superficie para la CSP sin ganancia. |

## Rendimiento y seguridad
- **Presupuesto**: en partida no cambia (16,67 ms/frame). En pausa el coste es menor: 0 ticks, `run.snapshot()` y
  render. `GameScene.create` crea los pools una vez por Jugar (unos ms), nunca por frame. Bundle: unos cientos de
  líneas de TS y CSS, sin dependencias.
- **CSP**: no cambia (`index.html`). Los paneles usan `createElement`, `textContent` y `addEventListener`. Nada de
  `innerHTML`, `on*`, `style=`, `window.confirm`, `window.alert` ni `window.prompt`. El recorrido E2E sin `?e2e`
  comprueba 0 `securitypolicyviolation` y 0 diálogos nativos.
- **Datos persistidos**: el formato v1 no cambia (ADR-0010). `clear()` solo hace `removeItem` sobre
  `sprint-survivors/progress`, sin tocar otras claves del origen compartido de GitHub Pages. El import del menú usa
  `importFromFile`, con la misma validación zod y el mismo límite de 64 KiB (AGENTS.md §3.6). Mostrar el menú no
  lee ni escribe nada más que la carga inicial.
- **URL**: no hay parámetros nuevos. `seed` y `speed` siguen validados con zod como ahora.

## Reconciliación con las specs (cambios respecto a la primera versión)
1. **Acumulador**: ya no se conserva el sobrante. Se descarta al pausar con `TickRun.discardPending()` y hay 0
   ticks en pausa (simulation-loop).
2. **Textos del borrado**: `borrado` y `no se ha podido borrar`, con la tabla `ok / unavailable / failed`. Se elige
   `removeItem`.
3. **Diálogo**: Esc no lo cierra; por eso no se usa `<dialog>` nativo. La pestaña oculta sin pausa mantiene el
   tope de 15 ticks.
4. **Flag `?e2e&menu` eliminado**: la spec dice que `?e2e` siempre salta el menú al cargar. Fuera
   `resolveStartMode` y `progress.menu`. La sonda solo gana `screen` y `runs`. Lo que solo pasa sin `?e2e` se
   prueba en composición.
5. **Precondición 0008** anotada arriba.
6. **Doble clic en Jugar**: `MenuController` y su test en Node, más un E2E con `dblclick`.

## ADRs
- `docs/adr/0011-pantallas-escenas-y-controles-dom.md`: pantallas como escenas del motor con controles DOM y
  controladores puros, pausa fuera de `Run` y arranque con `?e2e`.

## Riesgos
- **"Cinco ciclos menú-partida"** (sprites visibles = snapshot): la sonda no cuenta sprites. Se cubre con los tests
  de capas (`*-layer.test.ts`) y con la destrucción al apagar la escena (Phaser). El E2E solo comprueba `runs`,
  `screen` y que el snapshot sea coherente tras 5 ciclos.
- **Botones `disabled` en Playwright**: `click()` espera a que el botón se active. Los escenarios "opciones
  bloqueadas" usan `click({ force: true })`, que no dispara eventos en un botón desactivado, o `dispatchEvent`.
  El comportamiento se fija en `MenuController`.
- **`StartRun` pasa a `GameScene.create()` con `?e2e`**: los E2E de arranque y semilla deben seguir en verde sin
  tocarlos (tarea de regresión explícita).
