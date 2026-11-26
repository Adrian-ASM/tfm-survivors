# 2026-11-26 · Spike `spike/mobile`: el juego en el navegador del móvil con controles táctiles

- **Herramienta / modelo**: Claude Code (claude-opus-5-5) como orquestador, a petición del usuario. Spike
  desechable (AGENTS.md §5, "incierto"), sin change SDD ni subagentes; rama `spike/mobile` (commits `cd54fcb` y
  `2c52005`, solo local), nunca se fusiona.
- **Pregunta**: ¿se puede jugar en el navegador de un móvil (como en PC, sin app) con controles táctiles, se lee
  bien y va fluido?
- **Qué se hizo** (solo infraestructura, composición, CSS e `index.html`; dominio y aplicación intactos):
  - `TouchJoystick` (Phaser): joystick flotante que nace donde se apoya el dedo en la mitad izquierda del lienzo,
    radio 70 px lógicos y zona muerta 0,15; da un `PlayerInput` analógico. El teclado tiene prioridad: si hay
    teclas pulsadas, el joystick se ignora. En reposo se dibuja tenue abajo a la izquierda con el texto
    «Arrastra aquí para moverte», que desaparece tras el primer movimiento de la partida.
  - `TouchBar` (DOM): botones ⏸ (lo mismo que Esc: pausa y salir de tienda/obra), ↻ (lo mismo que R) y ⛶ (pantalla
    completa y, en Android, bloqueo en horizontal). Se pasan a `GameScene` como deps opcionales y se suman a
    `PauseKey`/`RestartKey`.
  - `mobileSpike.ts` (composición): activo con `pointer: coarse` o `?mobile` (`?mobile=0` lo apaga; nunca con
    `?e2e`). Resolución virtual con el modo **EXPAND** de Phaser (alto base `?vh`, 640 por defecto) y `--ui-scale`
    fraccionario para los paneles DOM (tamaño mostrado / tamaño lógico). Aviso «Gira el móvil» en vertical y
    contador de fps, tamaño de ventana y `devicePixelRatio` (también con `?fps` en escritorio).
  - CSS: `100dvh`, `touch-action: none`, `overscroll-behavior: none`, sin selección de texto y márgenes
    `env(safe-area-inset-*)`. Etiqueta `viewport` con `viewport-fit=cover` y sin zoom del usuario.
  - `.claude/launch.json`: configuración `mobile-spike` (`vite --host --port 5190`) para abrirlo desde el móvil.
- **Hallazgos**:
  - **El núcleo no se toca**: `PlayerInput.of(x, y)` ya admitía una dirección analógica con módulo ≤ 1. El
    joystick es un adaptador hermano de `KeyboardInput`; determinismo, firmas y balance no cambian.
  - **`Scale.RESIZE` ignora `zoom`**: en móvil (844 × 390 CSS en horizontal) la vista a zoom 1 enseña unas 3 veces
    menos mundo que a 1.280 × 720. Escalar `#game` con `transform` tampoco sirve, porque Phaser mide el padre con
    `getBoundingClientRect`, que ya incluye la transformación. Lo que funciona es **EXPAND** con alto base 640:
    lienzo lógico de 1.385 × 640 mostrado a 844 × 390, sin tocar `CameraRig` ni el recorte de 0018. La entrada
    táctil la reescala Phaser sin hacer nada.
  - **Escala de la UI**: `screenFrame` tiene ×1 como mínimo (base 960 × 540). Con EXPAND el HUD Phaser cabe, pero
    se ve pequeño: el texto queda a ~0,6 de su tamaño. Los paneles DOM (pausa, menú, tienda) se encogen igual con
    `--ui-scale` fraccionario. Falta decidir si el HUD necesita un diseño propio para móvil.
  - **Botones**: arriba a la derecha tapaban los contadores del HUD; abajo a la derecha (zona libre, porque las
    armas disparan solas) no molestan.
  - **El joystick transparente no se descubre**: el usuario pidió una indicación de que los controles están a la
    izquierda; con el joystick en reposo y el texto, confirmado en el móvil.
  - **Rendimiento**: en un **Pixel 7 Pro** (Chrome Android) va fluido, según el usuario; no hay cifra de fps de
    final de partida. En la emulación a 844 × 390 con dpr 1,5, sin errores de consola.
  - **Acceso desde el móvil**: Chrome Android pide el permiso de «Dispositivos cercanos» / red local para abrir
    `http://192.168.x.x`, aunque el firewall de Windows ya permitía Node (red Wi-Fi en perfil *Público*). La vía
    fiable es USB: `chrome://inspect` → *Port forwarding* 5190 → `localhost:5190` en el móvil, que además da las
    DevTools del móvil en el PC.
  - Menores: el vigilante de Vite no vio un cambio de `styles.css` escrito con un script y hubo que reiniciar el
    servidor. Con el panel del navegador oculto, las capturas de la emulación salen congeladas (3 fps).
- **No probado**: iOS Safari (sin Fullscreen API en iPhone ni bloqueo de orientación), cifras de fps con la horda
  llena, `devicePixelRatio` > 1 a resolución nativa (el lienzo se ve algo blando) y la usabilidad con el dedo de
  las cartas de mejora y de los paneles de tienda y obra.
- **Conclusión**: llevar el juego al navegador móvil es un change de infraestructura y composición de tamaño medio,
  sin núcleo. Para el change real:
  - Resolución virtual con EXPAND (o equivalente) con el alto base en `content/`, validado con zod.
  - Decidir la escala del HUD en móvil.
  - Joystick con la indicación en reposo y sus constantes en `content/`.
  - Botones táctiles para Esc y R y un overlay de orientación.
  - Tests de los adaptadores con dobles y como mucho 1 E2E con `hasTouch` en el proyecto `logic`.
  - Probar en iOS.
