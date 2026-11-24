# HUD · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El HUD de la partida: vida, tiempo restante, nivel/XP y bajas, derivados del último snapshot sin alterar la simulación.

## Requirements

### Requirement: Contenido y visibilidad del HUD
La vista SHALL mostrar un HUD con cuatro elementos: la vida del jugador (barra y número), el tiempo restante de la
partida, el nivel y la XP (la barra de XP de `leveling`) y las bajas de la partida (ver `run-outcome`). El HUD MUST
verse si y solo si existe una partida: en todos sus estados (en curso, eligiendo mejora y terminada) y también con la
partida en pausa. En el menú de inicio (ver `main-menu`), donde no existe partida, el HUD MUST NOT verse. El HUD
muestra siempre los valores del último snapshot pintado: mientras la partida está en pausa, eligiendo mejora o
terminada, sus valores no cambian. El HUD solo depende del snapshot: no cambia la simulación.

#### Scenario: HUD al empezar
- **GIVEN** el snapshot de una partida recién creada con el contenido por defecto
- **WHEN** se pinta
- **THEN** el HUD es visible y muestra vida `100/100` con la barra de vida llena (relleno 1), tiempo `10:00`, nivel
  1 con la barra de XP vacía y 0 bajas

#### Scenario: HUD con la partida terminada
- **GIVEN** una partida terminada con derrota en el tick 1.259 con nivel 3 y 41 bajas
- **WHEN** se pinta su snapshot y 60 frames más
- **THEN** el HUD sigue visible en todos ellos con vida `0/100`, tiempo `09:40`, nivel 3 y 41 bajas

#### Scenario: HUD en pausa
- **GIVEN** una partida con duración objetivo 36.000 ticks, en curso en el tick 600 con vida 75 de 100, nivel 2 y
  9 bajas
- **WHEN** se pausa y el motor informa de 600 frames de 16,667 ms
- **THEN** el HUD es visible en todos esos frames con vida `75/100`, tiempo `09:50`, nivel 2 y 9 bajas

#### Scenario: Sin HUD en el menú
- **GIVEN** el menú de inicio al cargar sin `?e2e`
- **WHEN** se pintan 60 frames
- **THEN** el HUD no es visible en ningún frame

#### Scenario: HUD tras volver al menú y jugar
- **GIVEN** una partida en pausa en el tick 3.000 con nivel 5 y 200 bajas
- **WHEN** se pulsa `Volver al menú`, se pinta 1 frame, se pulsa `Jugar` y se pinta el snapshot del tick 0
- **THEN** el HUD no es visible en el frame del menú
- **AND** en el frame de la partida nueva es visible con vida `100/100`, tiempo `10:00`, nivel 1 y 0 bajas

#### Scenario: El HUD no altera la simulación
- **GIVEN** dos partidas idénticas con la misma semilla, inputs y elecciones, una pintada con HUD y otra sin pintar
- **WHEN** ambas ejecutan 600 ticks con ≥ 1 golpe y ≥ 1 baja
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Vida en el HUD
La vista SHALL mostrar la vida como una barra cuyo relleno es vida actual / vida máxima efectiva del último
snapshot, acotado a [0, 1], y como el texto `actual/máxima`. Ambos números se muestran como enteros redondeados
hacia arriba, de modo que un jugador con vida > 0 nunca muestra 0.

#### Scenario: Vida llena
- **GIVEN** un snapshot con vida 100 y vida máxima 100
- **WHEN** se pinta
- **THEN** la barra de vida tiene relleno 1 y el texto es `100/100`

#### Scenario: Vida parcial con la vida máxima mejorada
- **GIVEN** un snapshot con vida 75 y vida máxima 120
- **WHEN** se pinta
- **THEN** la barra de vida tiene relleno 0,625 (error ≤ 0,001) y el texto es `75/120`

#### Scenario: Vida 0
- **GIVEN** un snapshot con vida 0 y vida máxima 100
- **WHEN** se pinta
- **THEN** la barra de vida tiene relleno 0 y el texto es `0/100`

#### Scenario: Vida fraccionaria
- **GIVEN** un snapshot con vida 0,5 y vida máxima 100
- **WHEN** se pinta
- **THEN** el texto es `1/100` y la barra tiene relleno 0,005 (error ≤ 0,001)

#### Scenario: Golpe entre dos snapshots
- **GIVEN** un snapshot pintado con vida 100 de 100 y el siguiente con vida 90 de 100
- **WHEN** se pinta el segundo
- **THEN** la barra de vida tiene relleno 0,9 (error ≤ 0,001) y el texto es `90/100`

### Requirement: Tiempo restante en el HUD
La vista SHALL mostrar el tiempo restante de la partida en formato `mm:ss`, calculado como los segundos restantes
redondeados hacia arriba: ⌈(duración objetivo en ticks − `snapshot.tick`) / 60⌉, nunca menor que 0. `ss` siempre
tiene 2 dígitos (00–59); `mm` tiene al menos 2 dígitos y no se acota a 59 (duraciones de 100 min o más muestran 3
dígitos). Con la duración objetivo por defecto, el HUD muestra `00:00` solo en el snapshot del tick 36.000.

#### Scenario: Valores en torno al inicio
- **GIVEN** una partida con duración objetivo 36.000 ticks
- **WHEN** se pintan los snapshots de los ticks 0, 1, 59, 60 y 61
- **THEN** el tiempo mostrado es `10:00`, `10:00`, `10:00`, `09:59` y `09:59` respectivamente

#### Scenario: Valores en torno al final
- **GIVEN** una partida con duración objetivo 36.000 ticks
- **WHEN** se pintan los snapshots de los ticks 35.940, 35.941, 35.999 y 36.000
- **THEN** el tiempo mostrado es `00:01`, `00:01`, `00:01` y `00:00` respectivamente

#### Scenario: Valor intermedio
- **GIVEN** una partida con duración objetivo 36.000 ticks
- **WHEN** se pinta el snapshot del tick 3.570 (540,5 s restantes)
- **THEN** el tiempo mostrado es `09:01`

#### Scenario: Otras duraciones
- **GIVEN** partidas con `durationSeconds` 90, 3.600 y 6.000
- **WHEN** se pinta el snapshot del tick 0 de cada una
- **THEN** el tiempo mostrado es `01:30`, `60:00` y `100:00` respectivamente

#### Scenario: El tiempo no corre mientras se elige mejora
- **GIVEN** una partida con duración objetivo 36.000 ticks que abre una oferta en el tick 600
- **WHEN** el motor informa de 600 frames de 16,667 ms con la oferta abierta
- **THEN** el tiempo mostrado es `09:50` en todos esos frames

### Requirement: Nivel y XP en el HUD
La vista SHALL incluir en el HUD la barra de XP y el número del nivel definidos en `leveling` ("Barra de XP y nivel
en la vista"), con el mismo comportamiento.

#### Scenario: Barra de XP dentro del HUD
- **GIVEN** un snapshot con nivel 2, XP 3 y XP para el siguiente nivel 10
- **WHEN** se pinta
- **THEN** el HUD muestra nivel 2 y la barra de XP tiene relleno 0,3 (error ≤ 0,001)

### Requirement: Bajas en el HUD
La vista SHALL mostrar el número de bajas del último snapshot como un entero completo, sin abreviar ni truncar.

#### Scenario: Sin bajas
- **GIVEN** un snapshot con 0 bajas
- **WHEN** se pinta
- **THEN** el HUD muestra 0 bajas

#### Scenario: Bajas que cambian entre snapshots
- **GIVEN** un snapshot pintado con 9 bajas y el siguiente con 12
- **WHEN** se pinta el segundo
- **THEN** el HUD muestra 12 bajas

#### Scenario: Muchas bajas
- **GIVEN** un snapshot con 12.345 bajas
- **WHEN** se pinta
- **THEN** el HUD muestra el número 12345 completo

### Requirement: HUD anclado a la ventana
La vista SHALL anclar cada elemento del HUD (barra y número de vida, tiempo restante, barra de XP y nivel, bajas) a un
borde, una esquina o el centro de un borde de la ventana. Para un mismo factor de escala del HUD (ver "Escala del HUD
por escalones"), la distancia en pantalla de cada elemento a su anclaje MUST ser la misma sea cual sea el tamaño de la
ventana (error ≤ 1 px). Con una ventana ≥ 960 × 540 en ambos ejes, cada elemento MUST quedar entero dentro de la
ventana y ningún par de elementos del HUD MUST solaparse. Si la ventana supera el tope de vista, el HUD se ancla a la
ventana o a la vista según fije el design, con las mismas garantías. Al redimensionar, el HUD MUST reubicarse desde el
primer frame pintado tras el cambio (ver "Redimensionado de la ventana" en `world-camera`).

#### Scenario: Mismo anclaje con dos ventanas
- **GIVEN** el snapshot de una partida recién creada pintado con una ventana de 960 × 540 y otro igual pintado con una
  de 1.280 × 720 (ambas con el mismo factor de escala)
- **WHEN** se mide, para cada elemento del HUD, su distancia al borde o esquina de su anclaje
- **THEN** las distancias y los tamaños de cada elemento son iguales en ambas ventanas (error ≤ 1 px)

#### Scenario: Esquina opuesta que sigue a la ventana
- **GIVEN** un elemento del HUD anclado al borde derecho y una partida pintada con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600 y se pinta el siguiente frame
- **THEN** su borde derecho está a la misma distancia del borde derecho de la ventana que antes (error ≤ 1 px), es
  decir, se ha desplazado 280 px a la izquierda

#### Scenario: HUD entero y sin solapes
- **GIVEN** un snapshot con vida `120/120`, tiempo `10:00`, nivel 99 y 12.345 bajas
- **WHEN** se pinta con ventanas de 960 × 540, 1.280 × 720, 1.920 × 1.080, 2.560 × 1.440 y 3.840 × 2.160
- **THEN** en cada una los cinco elementos del HUD están enteros dentro de la ventana y no se solapan entre sí

#### Scenario: Ventana menor que 960 × 540
- **GIVEN** una partida en curso pintada con una ventana de 640 × 360
- **WHEN** se pinta un frame
- **THEN** el HUD es visible con el factor de escala mínimo (× 1), cada elemento a la misma distancia de su anclaje que
  con 960 × 540, y no hay errores no capturados

### Requirement: Escala del HUD por escalones
La vista SHALL pintar el HUD con un factor de escala k entero ≥ 1 que depende solo del tamaño de la ventana (nunca del
snapshot): no hay escalado continuo. k MUST NOT disminuir cuando la ventana crece en un eje sin decrecer en el otro.
k MUST valer 1 con cualquier ventana de hasta 1.280 × 720 en ambos ejes (incluidas las menores que 960 × 540) y MUST
ser ≥ 2 con cualquier ventana de al menos 2.560 × 1.440 en ambos ejes. Con factor k, cada elemento del HUD MUST medir
k veces lo que mide con factor 1, y su distancia al anclaje MUST ser k veces la de factor 1 (error ≤ 1 px). El
cambio de escalón al redimensionar MUST verse desde el primer frame pintado tras el cambio. La escala MUST NOT cambiar
la simulación ni los valores mostrados.

#### Scenario: Escala mínima
- **GIVEN** ventanas de 320 × 180, 960 × 540 y 1.280 × 720
- **WHEN** se pinta el HUD en cada una
- **THEN** el factor de escala es 1 en las tres

#### Scenario: Escala en pantallas grandes
- **GIVEN** ventanas de 2.560 × 1.440 y 3.840 × 2.160
- **WHEN** se pinta el HUD en cada una
- **THEN** el factor de escala es un entero ≥ 2 en ambas y el de 3.840 × 2.160 no es menor que el de 2.560 × 1.440

#### Scenario: Tamaños proporcionales al factor
- **GIVEN** el mismo snapshot pintado con una ventana de factor 1 y otra de factor k ≥ 2
- **WHEN** se miden la barra de vida, la barra de XP y la altura del texto del tiempo restante
- **THEN** cada medida con factor k es k veces la de factor 1 (error ≤ 1 px)

#### Scenario: Monotonía
- **GIVEN** la secuencia de ventanas 960 × 540, 1.280 × 720, 1.600 × 900, 1.920 × 1.080, 2.560 × 1.440 y
  3.840 × 2.160
- **WHEN** se calcula el factor de escala de cada una
- **THEN** cada factor es un entero ≥ 1 y ninguno es menor que el anterior

#### Scenario: Cambio de escalón al redimensionar
- **GIVEN** una partida en pausa pintada con una ventana de 1.280 × 720 (factor 1)
- **WHEN** la ventana pasa a 2.560 × 1.440 y se pinta el siguiente frame
- **THEN** el HUD se pinta con un factor ≥ 2, muestra los mismos valores que antes y el snapshot no ha cambiado

<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0009-main-menu (2026-11-20) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
