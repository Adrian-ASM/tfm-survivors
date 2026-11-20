# Proposal · 0009-main-menu

- **Estado**: aprobado (2026-11-20), con las respuestas propuestas a las tres preguntas abiertas
- **Issue**: (opcional)
- **Rama / worktree**: `change/0009-main-menu`

## Problema
Al abrir el juego, la partida empieza de inmediato: no hay menú de inicio ni forma de parar. El jugador no puede
prepararse, ni pausar si le interrumpen, y las acciones sobre su progreso (exportar, importar) solo aparecen al
terminar una partida. Tampoco hay forma de borrar los datos guardados. Con esto queda abierto el último *Must* de
menú del GDD (sección "0009 main-menu").

## Objetivo
Al cargar la página sin `?e2e` se ve un menú de inicio con **Jugar**, **Exportar**, **Importar** y **Borrar datos**.
La partida empieza solo al pulsar **Jugar**. Con la partida en curso, Esc la pausa y la reanuda. En la pausa se
puede elegir **Reanudar** o **Volver al menú**. Borrar datos pide confirmación en el propio juego, y si se cancela el
progreso no cambia. Los E2E que ya existen siguen pasando sin cambios.

## Alcance
- **Dentro**:
  - **Menú de inicio como escena propia del motor** (opción A de la exploración): al cargar se ve el menú y no
    existe partida. La partida (`StartRun`) se crea al pulsar **Jugar**, no al cargar la página.
  - **Opciones del menú**: Jugar, Exportar, Importar y Borrar datos. Exportar e Importar se comportan igual que en la
    pantalla de resultados (mismo fichero, mismas validaciones, mismos mensajes; ver `progress-persistence`).
  - **Borrar datos con confirmación propia**: un diálogo del juego con *Confirmar* y *Cancelar*, nunca
    `window.confirm`. *Cancelar* deja el progreso guardado y el que está en memoria idénticos campo a campo.
    *Confirmar* deja el progreso vacío en el almacenamiento y en la sesión. Hace falta definir qué pasa cuando no
    hay almacenamiento disponible o los datos guardados están dañados.
  - **Semilla al pulsar Jugar**: el `?seed=N` de la URL se lee una vez por carga y se aplica a la partida que
    arranca al pulsar **Jugar** por primera vez en la carga (decisión 1). Las reglas de validación y aviso de la semilla no cambian.
  - **Bypass con `?e2e`**: si la URL incluye `?e2e`, el juego se salta el menú y arranca la partida directamente,
    igual que ahora. Los E2E existentes no cambian. Los E2E nuevos del menú cargan sin `?e2e` (o con un mecanismo
    que no active el bypass) y pulsan **Jugar**.
  - **Pausa con Esc** solo mientras la partida está en curso. Esc no hace nada durante la oferta de mejora, en la
    pantalla de resultados ni en el menú. La pausa muestra un overlay con **Reanudar** y **Volver al menú**. Otra
    pulsación de Esc o **Reanudar** reanudan la partida.
  - **Tiempo en pausa**: el tiempo en pausa no cuenta. Al reanudar no se pierden ni se duplican ticks: el tick y el
    snapshot son los mismos que al pausar, y el acumulador no recupera el tiempo pausado (no hay ráfaga de ticks).
    Esto concreta el criterio "sin perder ticks" del GDD. También vale con `?speed=N`.
  - **El estado de pausa vive fuera de `Run`**: el dominio no sabe que existe la pausa. Si la pausa queda en el
    adaptador o en `application` (fuera de `Run`) lo decide el `design`.
  - **Volver al menú** desde la pausa abandona la partida en curso y muestra el menú. La partida abandonada no
    está terminada, así que no se registra en el historial ni en los récords (decisión 2).
  - **Exportar e Importar en ambos sitios**: siguen en la pantalla de resultados y se añaden al menú.
- **Fuera**:
  - 0006·W2 (E2E de reinicio tras victoria): pasa a `0010 balance-pass`, que es donde se resuelve que la partida se
    pueda ganar.
  - Ajustes de audio, accesibilidad (*Should*) y arte definitivo.
  - Pausar al perder el foco de la pestaña con un overlay propio (solo se exige que al volver no haya ráfaga de
    ticks; ver riesgos).
  - Cambios en el formato del progreso, en la CSP o en las reglas de importación.
  - Volver al menú desde la pantalla de resultados (decisión 3).

## Capacidades afectadas
- `openspec/specs/main-menu` (nueva): menú de inicio, sus opciones, el diálogo de confirmación de Borrar datos, el
  arranque con **Jugar**, el bypass con `?e2e`, la pausa con Esc (overlay, Reanudar, Volver al menú), cuándo se
  puede pausar y el flujo observable en el navegador.
- `openspec/specs/simulation-loop` (modificada): *Semilla de la partida* (la semilla de la URL se aplica a la
  partida de **Jugar**, no a la carga). Se añade un requisito para que no se acumule tiempo en pausa, parecido a
  *Sin tiempo acumulado durante la elección*, que cubra la ausencia de ráfaga al reanudar y el caso con `speed`.
- `openspec/specs/progress-persistence` (modificada): nuevo requisito *Borrado del progreso* (borrado confirmado,
  cancelación, sin almacenamiento, datos dañados pendientes). *Exportar el progreso* e *Import con fusión* se
  amplían si hace falta para decir que se pueden lanzar también desde el menú.
- `openspec/specs/run-results` (modificada): *Reinicio con la tecla R* (R tampoco hace nada en pausa ni en el
  menú). *Acciones de progreso sin efecto en la partida* (convive con las mismas acciones del menú; los mensajes no
  pasan del menú a la partida ni al revés).
- `openspec/specs/run-state` (sin cambios previstos): la pausa no es un estado de `Run`. Si en la fase spec hiciera
  falta dejarlo explícito, sería un escenario y no un estado nuevo.
- `openspec/specs/hud` (posiblemente modificada): visibilidad del HUD con el menú y con el overlay de pausa.
- `openspec/specs/architecture-guardrails` (sin cambios si la pausa queda fuera del núcleo).

## Riesgos y dudas
- **Arranque y E2E**: sacar `StartRun` del arranque cambia `bootstrap()` y `GameScene`, que hoy recibe la partida
  ya creada. El bypass con `?e2e` tiene que dar exactamente el arranque actual, porque si no se rompen los 9 specs
  E2E (26 `goto`).
- **Los E2E nuevos y el bypass**: si `?e2e` salta el menú, los E2E del menú no pueden usar la sonda
  `window.__sprint` tal como está ahora. Hay que buscar otra forma de observar el estado (otro parámetro, sonda sin
  bypass…). Lo decide el `design`, pero condiciona los escenarios.
- **Pausa sin ráfaga**: Phaser puede entregar un `delta` grande al reanudar o al volver de una pestaña oculta. Sin
  un reset explícito, el tope de 250 ms permitiría hasta 15 ticks de golpe (y más con `speed`). Esto es justo lo
  que el criterio prohíbe.
- **Testabilidad de la pausa**: si vive en la escena de Phaser, no tiene test unitario (es la misma deuda que
  0006·W2). Conviene un controlador puro que se pueda probar en Node, siguiendo el patrón de `advanceFrame`.
- **Foco del teclado**: los botones DOM de Exportar e Importar pueden quedarse con el foco y tragarse Esc o R.
- **Borrado**: necesita una operación nueva en el puerto `ProgressRepository` y en su fake. Hay que fijar cómo queda
  el aviso de datos dañados (`corruptPending`) y qué pasa cuando no hay almacenamiento.

## Decisiones (antes preguntas abiertas; aprobadas por el usuario el 2026-11-20)
1. **Semilla en el segundo Jugar**: solo la primera partida de la carga (el primer **Jugar**, o el arranque directo
   con `?e2e`) usa el `?seed=N` de la URL. Tras **Volver al menú**, el siguiente **Jugar** usa una semilla aleatoria
   nueva, igual que el reinicio con R.
2. **Partida abandonada**: **Volver al menú** no registra la partida en el historial ni en los récords.
3. **Resultados y menú**: **Volver al menú** no se ofrece desde la pantalla de resultados; desde ahí solo se
   reinicia con R. Queda fuera de este change.

## Criterio de éxito
- Escenarios de `main-menu` y los deltas de `simulation-loop`, `progress-persistence` y `run-results` en verde, en
  unitarios y en E2E.
- Con la partida en curso en el tick n, se pulsa Esc, se pintan 300 frames y se vuelve a pulsar Esc: el snapshot
  sigue en el tick n durante la pausa, y en el primer frame tras reanudar (16,667 ms) está en el tick n+1, sin
  ráfaga. Con `speed=N` avanza N ticks por frame, no más.
- En el menú, **Borrar datos** + *Cancelar* deja un `Exportar` posterior igual byte a byte al de antes. **Borrar
  datos** + *Confirmar* deja un `Exportar` con historial vacío y récords iniciales.
- Con `?seed=42` sin `?e2e`, pulsar **Jugar** arranca una partida con semilla 42.
- Los 9 specs E2E existentes pasan sin tocar sus `goto`. `npm run verify` está en verde.
