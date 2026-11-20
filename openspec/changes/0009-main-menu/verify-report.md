# Verify report · 0009-main-menu

Verificador independiente (no ha escrito el código). Rama `change/0009-main-menu`, 12 commits sobre `origin/main`.

## 1. Ejecución
| Comando | Resultado |
|---|---|
| `npm run verify` | Verde: lint, typecheck, `guard:all` (452 ficheros) y Vitest 101 ficheros / 1147 tests |
| `npm run test:e2e` | Verde: 47/47 en chromium (1,3 min). Los 9 specs E2E anteriores no están tocados (`git diff`: solo `A` y `probe.ts` con adiciones) |

## 2. Reglas de arquitectura y seguridad (AGENTS.md §3 y §6)
- `src/domain` sin cambios. La pausa no entra en `Run`: solo `TickRun.discardPending()` (llama a `loop.reset()`) y
  `PauseGate` en el adaptador, sin import del motor. Cumple §3.1, §3.2 y ADR-0002.
- Pureza: sin `Math.random`, `Date.now`, `performance.now`, `window`, `document` ni `localStorage` en
  `domain`/`application` (grep limpio). La semilla aleatoria vive en la composición.
- §3.4: `LocalStorageProgressRepository`, `Mulberry32RandomGenerator` y los paneles solo se cablean en `composition/`.
- §3.6: el import del menú pasa por `importFromFile` (`readProgressFile`, 64 KiB, zod) igual que resultados.
- CSP: sin `innerHTML`, `style=`, `on*` ni `window.confirm/alert/prompt` (el único hit es un comentario). `index.html`
  no cambia. Sin secretos ni dependencias nuevas. `<dialog>` nativo descartado a propósito (Esc).
- Puntos pedidos:
  - Pausa y 0 ticks: `PauseGate.frame` devuelve `run.snapshot()` sin `advanceFrame` en pausa, con cualquier
    `elapsedMs` y `speed`. El sobrante se descarta al pausar. Correcto.
  - `?e2e` conserva el arranque: lista `[game, menu]` y `launcher.launch()` en `GameScene.create` con la semilla de
    la URL. Los E2E previos pasan sin tocarlos.
  - Semilla de la URL solo en el primer `launch()` (`first`): correcto. Doble clic: `MenuController` pasa a
    `leaving` y `takePlay` se consume una vez.
  - Borrado: `ClearProgress` implementa la tabla ok / unavailable / failed. `corruptPending = false` en los tres
    casos. `removeItem` solo toca la clave del progreso.
  - El diálogo de borrado no escucha el teclado y `MenuScene` no registra teclas: Esc y R no lo afectan.
  - Limpieza de escena: `SHUTDOWN` oculta pausa y resultados y suelta referencias; `leave()` reinicia la puerta.
    Los sprites los destruye el motor (no observable sin Phaser real, ver W2).
  - Heredocs: sin `\r`, mojibake ni `\` anómalas en los ficheros del diff; lint y guard pasan. Sin corrupción.

## 3. Matriz Escenario → Test → Estado
Leyenda: OK = cubierto con aserción real; PARC = cubierto en parte; SIN = sin test; PREV = test anterior a 0009
(sigue en verde, sin cambios en el comportamiento).

### main-menu (35)
| Escenario | Test | Estado |
|---|---|---|
| Carga sin parámetros | e2e `menu.spec` "Carga sin parámetros…" (menú, orden de botones, pausa y resultados ocultos; HUD no observable) | OK (HUD: W1) |
| Carga con semilla y sin e2e | e2e `menu.spec` "Carga con semilla y sin e2e…" | OK |
| Teclas sin efecto en el menú | e2e `menu.spec` "Teclas sin efecto en el menú…" | OK |
| El progreso guardado no cambia al cargar el menú | e2e `clear-progress` "Cancelar no cambia nada" (`stored` = G) y `menu-progress` | PARC (sin 300 frames explícitos) |
| Primer Jugar | e2e `menu.spec` "Menú tras Volver al menú…" (tick ≤ 60, estado inicial); `run-launcher` "Jugar tras volver al menú" | PARC (HUD `100/100`, `10:00` no observable) |
| Doble clic en Jugar | node `menu-controller` "Doble clic…"; e2e `menu.spec` "Doble clic en Jugar" (`runs` = 2) | OK |
| Esc funciona tras pulsar Jugar con el ratón | e2e `menu.spec` "Esc funciona tras pulsar Jugar…" | OK |
| Carga en modo E2E | e2e previos `smoke`/`speed`/`weapons` (sin tocar) | PREV |
| Modo E2E con velocidad | e2e `speed.spec` + `pause.spec` "Modo E2E con velocidad" | PREV |
| Menú tras Volver al menú en modo E2E | e2e `menu.spec` "Menú tras Volver al menú en modo E2E…" | OK |
| Sin sonda fuera de E2E | e2e `menu.spec` (`hasProbe` false antes y después de Jugar) | OK |
| Exportar sin progreso | e2e `menu-progress` "Exportar sin progreso…" | OK |
| Importar desde el menú | e2e `menu-progress` "Importar desde el menú…"; node `menu-progress` | OK |
| Import rechazado desde el menú | e2e `menu-progress` "Import rechazado…"; node `menu-progress` | OK |
| Jugar tras usar los botones | e2e `menu-progress` "Jugar tras usar los botones…" | OK |
| Diálogo propio | e2e `clear-progress` "Diálogo propio…" (0 diálogos nativos) | OK |
| Cancelar no cambia nada | e2e `clear-progress` "Cancelar no cambia nada…" (byte a byte) | OK |
| Confirmar borra | e2e `clear-progress` "Confirmar borra…" | OK |
| Opciones bloqueadas con el diálogo abierto | node `menu-controller`; e2e `clear-progress` "Diálogo propio…" (`force`, `dispatchEvent`, 0 descargas) | OK |
| Confirmar dos veces | e2e `clear-progress` "Confirmar dos veces…"; node `menu-controller` | OK |
| Teclas con el diálogo abierto | e2e `clear-progress` "Diálogo propio…" (Esc y R, diálogo sigue) | OK |
| Pausar y reanudar con Esc | e2e `pause.spec` "Pausar y reanudar…" (`toStrictEqual`); node `pause-gate` | OK |
| Reanudar con el botón | e2e `pause.spec`; node `pause-gate` "Reanudar con el botón" | OK |
| Esc mantenido | node `pause-key` "Esc mantenido" (evento `down`) | OK (sin E2E) |
| Esc mientras se elige mejora | e2e `pause.spec` "Esc mientras se elige mejora…"; node `pause-gate` it.each | OK |
| Esc con la partida terminada | e2e `pause.spec` "Esc con la partida terminada…" | PARC (no cuenta `runs` = 1) |
| Teclas sin efecto en pausa | e2e `pause.spec` "Teclas sin efecto en pausa…" | OK |
| Esc y R en el mismo frame | node `pause-gate` "Esc y R en el mismo frame" | OK |
| La pausa no altera la simulación | node `pause-gate` "La pausa no altera la simulación" (1.200 ticks, pausas 100/400/900) | OK |
| Volver al menú desde la pausa | e2e `menu.spec` (menú, `screen menu`, `snapshot null`); sprites no observables | PARC (W2) |
| La partida abandonada no se guarda | e2e `menu-flow` (E1 = P0 y `stored` = P0); partida de segundos, sin contador de escrituras | PARC (W3) |
| Jugar tras volver al menú | node `run-launcher` "Jugar tras volver al menú…"; e2e `menu.spec` | OK (HUD: W1) |
| Cinco ciclos menú-partida | e2e `menu.spec` "Cinco ciclos…": solo `runs` = 6, `screen`, sin errores | PARC (W2) |
| Recorrido del menú sin sonda | e2e `menu-flow` "Recorrido del menú sin sonda…" (E1/E2/E3, 0 diálogos, CSP, consola) | OK |
| Borrado que sobrevive a la recarga | e2e `menu-flow` (recarga y export vacío) y `clear-progress` "Confirmar borra" | OK |

### simulation-loop (19)
| Escenario | Test | Estado |
|---|---|---|
| Frames durante la pausa | node `pause-gate` "Frames durante la pausa" | OK |
| Primer frame tras reanudar | node `pause-gate` "Primer frame tras reanudar" | OK |
| Frame largo durante la pausa | node `pause-gate` "Frame largo durante la pausa" | OK |
| Sobrante descartado al pausar | node `loop.test` y `pause-gate` | OK |
| Reanudar a velocidad 8 | node `pause-gate` (n + 8 y n + 16); e2e ritmo | OK |
| Pausa a velocidad 15 con frame largo | node `pause-gate` | OK |
| **Primer frame tras Jugar** | Ninguno (ni `run-launcher` ni `pause-gate` miden 16,667 ms → tick 1 y 8,334 ms → 0 en la partida recién lanzada) | **SIN (C1)** |
| Velocidad tras volver al menú | e2e `menu.spec` "Velocidad tras volver al menú…" (ritmo > 180 ticks/s, no tick 8 exacto) | PARC |
| Velocidad inválida y varios Jugar | Ninguno con 3 Jugar y avisos de `speed`; solo `speed.spec` previo | SIN (W5) |
| Semilla válida por URL | node `run-launcher` | OK |
| Semilla válida por URL en modo E2E | e2e previos (`smoke`, `progress`) | PREV |
| Límites del rango | tests previos de `resolveSeed` | PREV |
| Semilla inválida | tests previos de `resolveSeed` y `speed.spec` | PREV |
| Sin semilla en la URL | previo | PREV |
| Semilla nueva al reiniciar | previo (`seedSource`) | PREV |
| Semilla nueva tras volver al menú | node `run-launcher` (fuente da 123) y e2e (`seed` ≠ 42) | OK |
| Reinicio tras una semilla inválida | previo | PREV |
| Varios Jugar tras una semilla inválida | node `run-launcher` (4 partidas en rango, 1 aviso) | OK |
| Semilla inválida antes y después de Jugar | Solo por piezas (`resolveSeed` previo + `run-launcher`); sin E2E en el menú | PARC (W5) |

### progress-persistence (41)
| Escenario | Test | Estado |
|---|---|---|
| Borrado confirmado | node `clear-progress`; e2e `clear-progress` "Confirmar borra" | OK |
| Partida tras borrar | e2e `clear-progress` "Borrar datos dañados y jugar" (récords e historial 1) | PARC (usa daño, no (300, 8, 120)) |
| Cancelar sin cambios | e2e "Cancelar no cambia nada"; node `menu-controller`; sin contador de escrituras en E2E | PARC |
| Borrar datos dañados | e2e "Borrar datos dañados y jugar"; node `clear-progress` y `local-storage-progress` | PARC (falta recarga posterior) |
| Cancelar con datos dañados | e2e "Cancelar con datos dañados…" | OK |
| Borrar sin almacenamiento | e2e "Borrar sin almacenamiento…"; node `clear-progress` | PARC (sin partida previa ni R/Esc/Volver) |
| Fallo al borrar | e2e "Fallo al borrar…"; node `clear-progress`, `local-storage-progress` | OK |
| Borrar el progreso vacío | e2e "Confirmar dos veces seguidas y borrar el progreso vacío" | OK |
| Un guardado por partida / Reinicio inmediato / Varias partidas | previos | PREV |
| Partida sin terminar | e2e previo `progress.spec` | PREV |
| Partida abandonada con Volver al menú | e2e `menu-flow` (guardado = P0); sin "+1 entrada tras Jugar y terminar" ni 0 escrituras | PARC (W3) |
| Pausa sin guardado | node `pause-gate` "Pausa sin guardado" | OK |
| Recarga tras una partida | previo | PREV |
| Datos guardados dañados | e2e `progress.spec` (1 aviso, valor intacto) | PREV |
| Datos dañados con el menú abierto | Ninguno (300 frames + Exportar + Cancelar sobre dañados) | SIN (W4) |
| Versión futura guardada | e2e `progress.spec` | PREV |
| Primer guardado tras datos dañados | previo | PREV |
| Exportar tras una partida | previo | PREV |
| Exportar desde el menú | e2e `menu-progress` "Exportar desde el menú…" | OK |
| Mismo fichero desde los dos sitios | e2e `menu-progress` "Mismo fichero…" | OK |
| Ida y vuelta / Tamaño máximo | previos | PREV |
| Récords máximos / Duplicados / Recorte / Conmutativa / Import dos veces / Import sobre dañados | previos | PREV |
| Importar desde el menú | e2e y node `menu-progress` | OK |
| Importar tras borrar | node `menu-progress` "Importar tras borrar" | OK |
| Cancelar el selector en el menú | e2e `menu-progress` "Cancelar el selector…" | OK |
| Fichero demasiado grande / en el límite / no JSON | previos + node `menu-progress` | PREV/OK |
| Rechazo en el menú y Jugar | e2e `menu-progress` "Import rechazado…" y "Jugar tras usar los botones" | PARC (Jugar tras un rechazo concreto) |
| Almacenamiento bloqueado | e2e `progress.spec` | PREV |
| Menú con almacenamiento bloqueado | e2e `clear-progress` "Borrar sin almacenamiento…" (carga, Exportar, Jugar; el bloqueo es solo al leer) | PARC (W4) |
| Progreso en memoria durante la carga | previo | PREV |
| Almacenamiento lleno al guardar | node `local-storage-progress` y e2e previo | PREV |

### run-results (25)
| Escenario | Test | Estado |
|---|---|---|
| Overlay tras una derrota / victoria / Sin overlay durante la partida / Aparece en el mismo frame | `results.spec`, `smoke.spec` y unitarios previos | PREV |
| Sin overlay en el menú | e2e `menu.spec` (`.results-panel` oculto) | OK |
| Récords x3 / Aviso sin persistencia / Aviso de datos dañados solo en la primera partida | previos | PREV |
| Aviso de datos dañados tras una partida abandonada | e2e `clear-progress` "Cancelar con datos dañados…" (abandona con `?e2e`, no sin `?e2e` como pide el escenario) | PARC (W3) |
| Reinicio tras derrota / victoria / R durante la partida / R mientras se elige mejora | previos | PREV |
| R en pausa | e2e `pause.spec` "Teclas sin efecto en pausa…" (R) | OK |
| R en el menú | e2e `menu.spec` "Teclas sin efecto en el menú…" (solo tras la carga, no tras Volver al menú) | PARC |
| Una pulsación, una partida nueva / Teclas sin efecto con la partida terminada | previos | PREV |
| Exportar no cambia la partida / R tras usar los botones / Mensajes que no se arrastran | previos | PREV |
| Mensajes del menú que no pasan al overlay | node `menu-progress`; e2e `menu-progress` "Mismo fichero…" | OK |
| Mensajes del overlay que no pasan al menú | node `menu-progress`; e2e `menu-progress` | OK |
| Jugar y Esc tras usar los botones del menú | e2e `menu-flow` "Jugar y Esc tras usar los botones…" (`runs` 2, `paused`) | OK |

### hud (6)
| Escenario | Test | Estado |
|---|---|---|
| HUD al empezar / HUD con la partida terminada / El HUD no altera la simulación | tests previos de HUD y `hud` | PREV |
| HUD en pausa | node `pause-gate` "HUD en pausa" (snapshot pintado sin cambios). No comprueba la visibilidad del HUD | PARC (W1) |
| Sin HUD en el menú | Ninguno | SIN (W1) |
| HUD tras volver al menú y jugar | Ninguno | SIN (W1) |

## 4. Revisión de design.md, tasks.md y ADR
- Capas y nombres coinciden con el design (tabla "Piezas por capa"). Desviaciones declaradas, aceptables:
  `createRunLauncher` con objeto de opciones y `onContentError`; claves en `sceneKeys.ts`; `clear()` mínimo adelantado a 2.2;
  la sonda cuenta reinicios con R en `runs`; ticks exactos tras reanudar solo en Node. El design aún describe la firma
  posicional de `createRunLauncher` (S1).
- `tasks.md`: 17 casillas marcadas, 0 abiertas; los 12 commits llevan `refs: 0009-main-menu` y `Assisted-by`/`Co-Authored-By`.
- ADR-0011 sigue en `Estado: propuesta` (la tarea 6.1 lo deja para tras verify; ver W7).
- Código muerto: no se ha encontrado. Sin secretos.

## 5. Hallazgos

### Critical
- **C1. Escenario "Primer frame tras Jugar" (simulation-loop) sin test.** El design lo remite a "Node, en `PauseGate` y
  `TickRun`", pero ningún test lo mide: tras lanzar la partida con `createRunLauncher`, un frame de 16,667 ms da tick 1
  y uno de 8,334 ms da 0, aunque antes haya habido 600 frames y uno de 5.000 ms en el menú. La garantía es estructural
  (`StartRun` crea un `FixedStepLoop` nuevo), pero según el criterio del change un escenario sin test bloquea el archivado.
  Basta un test de Node en `tests/composition/run-launcher.test.ts`.

### Warning
- **W1. HUD sin verificación de visibilidad.** "Sin HUD en el menú", "HUD tras volver al menú y jugar" y la parte
  visible de "HUD en pausa" y "Primer Jugar" dependen de que Phaser destruya los objetos de `GameScene`. El HUD es de
  canvas y la sonda no lo expone, así que ningún test lo comprueba. Hace falta un campo de sonda (p. ej. `hud` visible)
  o aceptar por escrito que solo se cubre por construcción.
- **W2. Sprites tras Volver al menú y "Cinco ciclos".** El E2E solo comprueba `runs` = 6, `screen` y que no haya
  errores, no que los sprites visibles coincidan con el snapshot (el escenario pide eso en cada frame). El design lo
  declara como riesgo asumido; debe registrarse como deuda o cubrirse con un contador de sprites en la sonda.
- **W3. Partida abandonada, comprobaciones débiles.** El E2E abandona una partida de unos segundos, sin los 5.000
  ticks, 41 bajas ni nivel 6 del escenario, y no cuenta escrituras (solo compara el valor guardado). Falta también
  "Jugar y terminar tras abandonar: historial +1" y el aviso de datos dañados tras abandonar **sin `?e2e`** (el test
  actual usa `?e2e`).
- **W4. Datos dañados y almacenamiento bloqueado en el menú.** Sin test: "Datos dañados con el menú abierto" (300 frames,
  Exportar, Cancelar). Parciales: "Menú con almacenamiento bloqueado" y "Borrar sin almacenamiento" (sin partida previa,
  R, Esc ni Volver al menú; el bloqueo solo simula `SecurityError` al leer `localStorage`) y "Borrar datos dañados" (sin
  la recarga posterior).
- **W5. Velocidad y semilla en el menú.** "Velocidad inválida y varios Jugar" no tiene test (solo `speed.spec` previo) y
  "Semilla inválida antes y después de Jugar" está cubierto por piezas, sin E2E sin `?e2e`. "Velocidad tras volver al
  menú" no comprueba tick 8 exacto (solo ritmo).
- **W6. Riesgo de flakiness en E2E.** Cuatro tests juegan partidas con semilla aleatoria (obligatorio tras Volver al
  menú) a `speed=15` hasta la derrota con un límite de reloj de 60 s (`PLAY_TIMEOUT_MS`; los demás usan 8 con semilla fija).
  Una máquina lenta o una partida larga sin input puede superar el límite. Además hay umbrales de reloj real (> 180 ticks
  en ~1 s a `speed=8`; `waitForTimeout(500..2000)`). Han pasado, pero conviene fijar un margen o registrar la deuda.
- **W7. Precondición de archivado.** 0008 está sin archivar (`openspec/specs/simulation-loop` no tiene "Velocidad de
  simulación en modo E2E") y los deltas de 0009 dependen de él; ADR-0011 sigue "propuesta". Hay que archivar 0008 antes
  que 0009 y aceptar el ADR en el archivo.

### Suggestion
- **S1.** Actualizar en `design.md` la firma de `createRunLauncher` (objeto de opciones con `onContentError`).
- **S2.** `GameScene.update`: `this.started?.tickRun ?? started.tickRun` es redundante, y hay una línea en blanco
  duplicada tras `PULSE_LINE_WIDTH`.
- **S3.** "Esc con la partida terminada" y "R en el menú" podrían comprobar `runs` = 1 y repetirse tras Volver al menú.
- **S4.** Los heredocs usados no han corrompido nada; mantener la anotación en `docs/ai-log` y evitarlos (AGENTS.md §8.1).

**Recuento final: C: 1 · W: 7 · S: 4**

Veredicto: verify y E2E en verde y arquitectura conforme; no se debe archivar hasta cerrar C1 y decidir (corregir o
registrar como deuda) W1–W7.

---

## 6. Re-verify (ronda de correcciones, `8a7f52d..HEAD`, 5 commits)

Ejecución: `npm run verify` verde (guard 454 ficheros, Vitest 102 ficheros / 1159 tests). `npm run test:e2e` verde
(48/48, 1,3 min). Sin cambios en `domain`/`application`; el diff de `src` es solo `GameScene.ts` (reflujo de la
partida del frame; sin imports nuevos ni reglas §3 rotas). Sin cobertura perdida: los escenarios previos conservan sus tests.

| Hallazgo | Estado | Evidencia |
|---|---|---|
| C1 Primer frame tras Jugar | Resuelto | `run-launcher.test.ts`: 16,667 ms ⇒ tick 1, 8,334 ms ⇒ 0 y tras Volver al menú ⇒ [0, 1] (con `PauseGate` y `launch()` reales). Nota: los 601 frames del menú solo se declaran, no se alimentan a ningún bucle; la garantía sigue siendo estructural (S5). |
| W1 HUD sin visibilidad | Abierto (deuda) | Sin campo de sonda; cubierto por construcción |
| W2 Sprites tras Volver al menú / Cinco ciclos | Abierto (deuda) | Sin contador de sprites en la sonda |
| W3 Partida abandonada | Resuelto en lo esencial | `menu-progress-flow.test.ts` con contador de escrituras (0 escrituras, G byte a byte, historial +1, aviso de dañados). La partida de Node se detiene en el tick 4.500, no en 5.000 (deuda menor) |
| W4 Dañados y almacenamiento bloqueado | Resuelto | `menu-progress-flow.test.ts` (dañados con el menú abierto, borrar y recarga, borrar sin almacenamiento con R/Esc/Volver, bloqueo leer/escribir/borrar) y E2E ampliado |
| W5 Velocidad y semilla en el menú | Resuelto | `run-launcher.test.ts`: `?e2e&speed=abc` (1 aviso, 4 partidas a 1 tick) y `?seed=abc` (1 aviso, 0 partidas en el menú, 1 tras Jugar). Sin E2E sin `?e2e` (aceptable) |
| W6 Flakiness E2E | Resuelto en parte | Esperas por frames, conteo de ticks por frame y semilla fija en "Mismo fichero"; los 2 E2E con semilla aleatoria llevan timeout largo. Riesgo residual bajo |
| W7 Precondición de archivado | Abierto (proceso) | Archivar 0008 antes que 0009 y aceptar ADR-0011 |
| S1 design firma `createRunLauncher` | Resuelto | `design.md` actualizado |
| S2 `GameScene.update` redundante | Resuelto | `restart` devuelve la partida en juego; línea en blanco eliminada |
| S3 comprobar `runs` = 1 | Resuelto | `pause.spec`/`menu.spec` |
| S4 heredocs | Sin cambios | Diario de IA actualizado |

Deuda registrada (no bloquea): W1, W2, W7, abandonada en Node hasta el tick 4.500, y S5 (el test C1 no alimenta los
frames del menú; mejora opcional).

**Recuento final tras re-verify: C: 0 · W: 3 · S: 1** (W1, W2, W7 abiertos como deuda; S5 nueva).

Veredicto: sin Critical; archivable tras aprobación humana, con W1, W2 y W7 aceptados como deuda (W7 es un orden de archivado: 0008 primero).
