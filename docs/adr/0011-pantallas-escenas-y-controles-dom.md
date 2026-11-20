# ADR-0011 · Pantallas: escenas del motor, controles DOM y pausa en el adaptador

- **Estado**: aceptada (2026-11-20, tras verify de 0009)
- **Fecha**: 2026-11-20

## Contexto
El change 0009 añade un menú de inicio, la pausa con Esc y el borrado de datos. Hay que decidir tres cosas que
afectarán a toda la UI futura (ajustes, accesibilidad, que son *Should* del GDD) y a cómo arrancan todos los E2E:
1. Dónde vive cada pantalla.
2. Con qué se construyen los controles clicables.
3. Dónde vive la pausa.

Fuerzas que influyen:
- El núcleo es puro (ADR-0002).
- La CSP es estricta y no admite estilos ni scripts inline.
- Importar necesita un `<input type=file>` real.
- Los E2E (9 specs, 26 `goto`) arrancan directamente con `?e2e`.
- La pausa no puede provocar una ráfaga de ticks al reanudar.

## Opciones
1. **Todo en DOM y una sola escena**: el menú es un panel DOM y la partida arranca en un estado "menú" del
   adaptador. Es el cambio mínimo, pero mezcla el ciclo de vida de la partida con el de la UI en una sola
   escena, que ya es grande.
2. **Escenas del motor con controles dibujados en Phaser**: queda todo dentro del canvas. Exige un kit de
   botones propio, no tiene roles ARIA, el `input[type=file]` necesita de todos modos el DOM y se pierde el
   panel de export/import que ya existe.
3. **Escenas del motor (`MenuScene`, `GameScene`) para el ciclo de vida y controles DOM para lo clicable**, con
   la pausa en el adaptador (`PauseGate` puro). Las escenas deciden cuándo se ve cada panel y los paneles solo
   activan banderas que la escena lee en su `update`.

## Decisión
Se elige la opción 3:
- **Pantallas como escenas**: `scene.start` da una escena limpia al entrar y al salir. `DisplayList` y
  `KeyboardPlugin` se apagan con la escena (comprobado en `node_modules/phaser` 4.2.1).
- **Controles en DOM**: reutilizan el patrón de `ResultsPanel` (`textContent`, `addEventListener`, CSS en
  fichero). Son accesibles por rol y observables por Playwright sin sonda.
- **Reglas en controladores puros, sin DOM ni motor**: las reglas de las pantallas (Jugar una sola vez, opciones
  bloqueadas con el diálogo abierto) viven en `MenuController` y las de la pausa en `PauseGate`. Vitest corre en
  Node sin jsdom, así que el DOM queda fino y se cubre en E2E.
- **La pausa no es un estado de `Run`**: `PauseGate` no llama a `TickRun.execute` en pausa. Al pausar, descarta
  el sobrante con `TickRun.discardPending()`, que equivale a `loop.reset()` y es lo mismo que ya se hace al elegir
  mejora.
- **Modos de arranque**:
  - `?e2e`: va directo a la partida y conserva el arranque actual. **Volver al menú** sí muestra el menú.
  - Sin `?e2e`: siempre muestra el menú y no hay sonda.
  - No se añaden parámetros de URL. Lo que solo existe sin `?e2e` se prueba en la composición.

## Consecuencias
- Positivas:
  - El núcleo no cambia.
  - Se respeta la CSP sin excepciones.
  - Los E2E existentes no se tocan.
  - La UI futura (ajustes, accesibilidad) sigue el mismo patrón.
- Negativas / costes:
  - Hay dos tecnologías de UI: el texto del juego en Phaser y los botones en DOM. Hay que cuidar el foco: los
    botones sueltan el foco tras el clic y los paneles ocultos no lo retienen.
  - `GameScene` recrea sus pools en cada **Jugar**. Es una vez por partida, nunca por frame.
- Cómo revertirla:
  - Pasar a una sola escena (opción 1) solo afecta a `main.ts`, a `MenuScene` y al `RunLauncher`. Los paneles
    DOM y `PauseGate` se conservan.
  - Llevar la pausa a `application` sería añadir `TickRun.pause()` sin cambiar el dominio, porque
    `discardPending()` ya está ahí.
