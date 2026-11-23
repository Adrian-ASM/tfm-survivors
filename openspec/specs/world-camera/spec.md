# World Camera · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El mundo mayor que la vista, la cámara que sigue al jugador dentro de sus límites, el HUD fijo en pantalla y la sonda E2E de cámara, sin que la cámara cambie la simulación.

## Requirements

### Requirement: Tamaño del mundo y de la vista validados
El sistema SHALL leer el tamaño del mundo (`width`, `height`) y el de la vista (`view.width`, `view.height`) de
`content/arena.json`, validados con zod antes de llegar al dominio. Los cuatro valores MUST ser > 0 y el mundo MUST
ser al menos tan grande como la vista en cada eje (`width` ≥ `view.width` y `height` ≥ `view.height`). Un contenido
inválido MUST impedir que se muestre el menú o empiece una partida, con un error que nombre el campo inválido. El
contenido por defecto MUST definir un mundo de 1.920 × 1.080 y una vista de 960 × 540.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el dominio recibe un mundo de 1.920 × 1.080 y una vista de 960 × 540
- **AND** el lienzo del juego mide 960 × 540

#### Scenario: Mundo más estrecho que la vista
- **GIVEN** `content/arena.json` con `"width": 959`, `"height": 1080` y vista 960 × 540
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `width`
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Mundo más bajo que la vista
- **GIVEN** `content/arena.json` con `"width": 1920`, `"height": 539` y vista 960 × 540
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `height`

#### Scenario: Mundo igual a la vista
- **GIVEN** `content/arena.json` con mundo 960 × 540 y vista 960 × 540
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Dimensiones no positivas
- **GIVEN** `content/arena.json` con, en un caso cada vez, `"width": 0`, `"height": -1` o `"view": { "width": 0,
  "height": 540 }`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona el campo inválido

### Requirement: Cámara que sigue al jugador dentro del mundo
Mientras existe una partida, la vista SHALL mostrar en cada frame un rectángulo del mundo del tamaño de la vista
(V_w × V_h) centrado en la posición del jugador del snapshot pintado y desplazado lo mínimo para quedar entero dentro
del mundo (W × H). Su esquina superior izquierda MUST ser
(clamp(x − V_w / 2, 0, W − V_w), clamp(y − V_h / 2, 0, H − V_h)), con un error ≤ 1 px. El seguimiento es directo: el
rectángulo corresponde al snapshot pintado en ese mismo frame, sin retraso, suavizado ni zona muerta. La vista MUST
NOT mostrar en ningún frame ninguna zona fuera de (0, 0)–(W, H). En el primer frame de cada partida (la primera, tras
R y tras `Volver al menú` + `Jugar`) el rectángulo ya corresponde a la posición inicial del jugador, sin heredar el
de la partida anterior.

#### Scenario: Jugador en el centro del mundo
- **GIVEN** el mundo por defecto y el jugador en (960, 540)
- **WHEN** se pinta el snapshot
- **THEN** el rectángulo visible es (480, 270)–(1.440, 810)

#### Scenario: Las cuatro esquinas
- **GIVEN** el mundo por defecto y el jugador, en cuatro snapshots distintos, en (16, 16), (1.904, 16), (16, 1.064) y
  (1.904, 1.064)
- **WHEN** se pinta cada snapshot
- **THEN** el rectángulo visible es, respectivamente, (0, 0)–(960, 540), (960, 0)–(1.920, 540),
  (0, 540)–(960, 1.080) y (960, 540)–(1.920, 1.080)

#### Scenario: Límite exacto del recorte
- **GIVEN** el mundo por defecto y el jugador, en dos snapshots, en (480, 270) y en (1.440, 810)
- **WHEN** se pinta cada snapshot
- **THEN** el rectángulo visible es (0, 0)–(960, 540) y (960, 540)–(1.920, 1.080) respectivamente

#### Scenario: Recorte en un solo eje
- **GIVEN** el mundo por defecto y el jugador en (100, 540)
- **WHEN** se pinta el snapshot
- **THEN** el rectángulo visible es (0, 270)–(960, 810)

#### Scenario: Seguimiento sin retraso
- **GIVEN** el mundo por defecto, un snapshot pintado con el jugador en (960, 540) y el siguiente con el jugador en
  (1.000, 540)
- **WHEN** se pinta el segundo snapshot
- **THEN** en ese mismo frame el rectángulo visible es (520, 270)–(1.480, 810)

#### Scenario: Mundo igual a la vista
- **GIVEN** un mundo de 960 × 540, una vista de 960 × 540 y el jugador en (16, 16) y después en (944, 524)
- **WHEN** se pinta cada snapshot
- **THEN** en ambos el rectángulo visible es (0, 0)–(960, 540)

#### Scenario: Nada fuera del mundo en una partida real
- **GIVEN** la build de producción con `?e2e&seed=7` y un input que lleva al jugador a las cuatro esquinas del mundo
- **WHEN** se pintan los frames hasta que el jugador ha tocado las cuatro esquinas
- **THEN** en cada frame el rectángulo visible que informa la sonda está dentro de (0, 0)–(1.920, 1.080)

#### Scenario: Partida nueva tras acabar en una esquina
- **GIVEN** una partida terminada ya pintada con el jugador en (1.904, 1.064)
- **WHEN** se pulsa R y se pinta el primer frame de la partida nueva (tick ≤ 60, sin input; como en `run-results`)
- **THEN** el rectángulo visible de ese primer frame es (480, 270)–(1.440, 810)

### Requirement: Elementos de la partida en coordenadas de mundo
La vista SHALL pintar jugador, enemigos, cadáveres, proyectiles, pulsos, gemas y fondo en su posición de mundo: un
elemento en (x, y) se ve en pantalla en (x − izquierda, y − arriba) del rectángulo visible, con un error ≤ 1 px. Un
elemento fuera del rectángulo visible no se ve en pantalla, pero sigue en el snapshot.

#### Scenario: Enemigo a la derecha del jugador
- **GIVEN** el mundo por defecto, el jugador en (960, 540) y un enemigo en (1.200, 600)
- **WHEN** se pinta el snapshot
- **THEN** el enemigo se ve en la posición de pantalla (720, 330)

#### Scenario: Jugador junto a una esquina
- **GIVEN** el mundo por defecto y el jugador en (16, 1.064)
- **WHEN** se pinta el snapshot
- **THEN** el jugador se ve en la posición de pantalla (16, 524)

### Requirement: HUD y overlays fijos en pantalla
La vista SHALL pintar el HUD (ver `hud`), el overlay de elección (ver `upgrades`), el de pausa, el de resultados y el
menú de inicio en coordenadas de pantalla: su posición y su tamaño en pantalla MUST ser los mismos sea cual sea el
rectángulo visible. Sus zonas de clic MUST seguir donde se pintan.

#### Scenario: HUD con la cámara movida
- **GIVEN** el mundo por defecto y dos snapshots con el jugador en (480, 270) y en (1.904, 1.064)
- **WHEN** se pinta cada snapshot
- **THEN** la barra de vida, el tiempo restante, la barra de XP, el nivel y las bajas tienen la misma posición y el
  mismo tamaño en pantalla en ambos frames (error ≤ 1 px)

#### Scenario: Overlay de elección con la cámara movida
- **GIVEN** el mundo por defecto, el jugador en (1.904, 1.064) y una oferta abierta de 3 opciones
- **WHEN** se pinta el snapshot y se hace clic en la tercera carta en su posición de pantalla
- **THEN** las 3 cartas están en la misma posición de pantalla que con el jugador en (480, 270)
- **AND** se elige la opción de índice 2

#### Scenario: Resultados y pausa con la cámara movida
- **GIVEN** el mundo por defecto y el jugador en (1.904, 16)
- **WHEN** se pausa con Esc y, en otra partida en la misma posición, termina la partida
- **THEN** el overlay de pausa y el de resultados ocupan la misma posición de pantalla que con el jugador en
  (480, 270), y `Volver al menú` responde al clic en su posición de pantalla

### Requirement: Sonda de cámara para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, el rectángulo visible del último
frame pintado en coordenadas de mundo (izquierda, arriba, ancho y alto) y el tamaño del mundo. Sin `?e2e` MUST NOT
existir. Leer la sonda MUST NOT cambiar la simulación ni lo que se pinta.

#### Scenario: Rectángulo coherente con el jugador
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de cámara y la posición del jugador del snapshot
- **THEN** en cada frame el ancho y el alto valen 960 y 540, el mundo vale 1.920 × 1.080 y la esquina superior
  izquierda cumple la fórmula de "Cámara que sigue al jugador dentro del mundo" (error ≤ 1 px)

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

### Requirement: La cámara no cambia la simulación
La cámara SHALL ser solo de presentación: MUST NOT cambiar ningún snapshot, el orden del tick ni el consumo del
`RandomGenerator`.

#### Scenario: Misma partida con y sin pintar
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7 y los mismos inputs durante 3.600 ticks, una
  pintada por la vista con la cámara y otra sin pintar
- **WHEN** se comparan sus snapshots tick a tick
- **THEN** son iguales

<!-- historial: 0013-world-camera (2026-11-23) -->
