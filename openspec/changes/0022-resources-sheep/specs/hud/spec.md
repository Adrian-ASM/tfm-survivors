# Spec delta · hud

<!-- Contadores de oro y madera (icono + número) en el HUD, aunque aún no se puedan gastar (0023/0024).
     Purpose nuevo (para la spec viva al archivar): "El HUD de la partida: vida, tiempo restante, nivel/XP, bajas, oro
     y madera, derivados del último snapshot sin alterar la simulación." -->

## ADDED Requirements

### Requirement: Oro y madera en el HUD
La vista SHALL mostrar en el HUD dos contadores, el de oro y el de madera, cada uno con un **icono** y el número del
último snapshot como un entero completo, sin abreviar, sin separador de miles ni truncar. El icono del oro usa el
aspecto del recogible `gold` (bolsa de oro, `G_Idle`) y el de la madera el del recogible `wood` (`W_Idle`) (ver
"Aspectos de los recogibles y de las vetas" en `sprite-rendering`). Si la hoja de un icono no carga, el icono se
pinta con el color de reserva de su tipo y el número se sigue mostrando, sin errores no capturados. Los contadores
cambian solo cuando cambia el snapshot pintado.

#### Scenario: Contadores al empezar
- **GIVEN** el snapshot de una partida recién creada
- **WHEN** se pinta
- **THEN** el HUD muestra el icono del oro con el número 0 y el icono de la madera con el número 0

#### Scenario: Contadores que cambian entre snapshots
- **GIVEN** un snapshot pintado con oro 10 y madera 2 y el siguiente con oro 35 y madera 5
- **WHEN** se pinta el segundo
- **THEN** el HUD muestra oro 35 y madera 5

#### Scenario: Números grandes
- **GIVEN** un snapshot con oro 123.456 y madera 12.345
- **WHEN** se pinta
- **THEN** el HUD muestra los números 123456 y 12345 completos

#### Scenario: Icono que no carga
- **GIVEN** el snapshot de una partida recién creada y la hoja del oro sin cargar (la de la madera, cargada)
- **WHEN** se pinta el HUD
- **THEN** el contador de oro es visible con su icono de reserva y el número 0, el de madera con su icono de arte, y no
  hay errores no capturados

## MODIFIED Requirements

### Requirement: Contenido y visibilidad del HUD
La vista SHALL mostrar un HUD con seis elementos: la vida del jugador (barra y número), el tiempo restante de la
partida, el nivel y la XP (la barra de XP de `leveling`), las bajas de la partida (ver `run-outcome`), el oro y la
madera (ver "Oro y madera en el HUD"). El HUD MUST verse si y solo si existe una partida: en todos sus estados (en
curso, eligiendo mejora y terminada) y también con la partida en pausa. En el menú de inicio (ver `main-menu`), donde
no existe partida, el HUD MUST NOT verse. El HUD muestra siempre los valores del último snapshot pintado: mientras la
partida está en pausa, eligiendo mejora o terminada, sus valores no cambian. El HUD solo depende del snapshot: no
cambia la simulación.

#### Scenario: HUD al empezar
- **GIVEN** el snapshot de una partida recién creada con el contenido por defecto
- **WHEN** se pinta
- **THEN** el HUD es visible y muestra vida `100/100` con la barra de vida llena (relleno 1), tiempo `10:00`, nivel
  1 con la barra de XP vacía, 0 bajas, oro 0 y madera 0

#### Scenario: HUD con la partida terminada
- **GIVEN** una partida terminada con derrota en el tick 1.259 con nivel 3, 41 bajas, oro 25 y madera 4
- **WHEN** se pinta su snapshot y 60 frames más
- **THEN** el HUD sigue visible en todos ellos con vida `0/100`, tiempo `09:40`, nivel 3, 41 bajas, oro 25 y madera 4

#### Scenario: HUD en pausa
- **GIVEN** una partida con duración objetivo 36.000 ticks, en curso en el tick 600 con vida 75 de 100, nivel 2,
  9 bajas, oro 15 y madera 3
- **WHEN** se pausa y el motor informa de 600 frames de 16,667 ms
- **THEN** el HUD es visible en todos esos frames con vida `75/100`, tiempo `09:50`, nivel 2, 9 bajas, oro 15 y
  madera 3

#### Scenario: Sin HUD en el menú
- **GIVEN** el menú de inicio al cargar sin `?e2e`
- **WHEN** se pintan 60 frames
- **THEN** el HUD no es visible en ningún frame, tampoco los contadores de oro y madera

#### Scenario: HUD tras volver al menú y jugar
- **GIVEN** una partida en pausa en el tick 3.000 con nivel 5, 200 bajas, oro 60 y madera 9
- **WHEN** se pulsa `Volver al menú`, se pinta 1 frame, se pulsa `Jugar` y se pinta el snapshot del tick 0
- **THEN** el HUD no es visible en el frame del menú
- **AND** en el frame de la partida nueva es visible con vida `100/100`, tiempo `10:00`, nivel 1, 0 bajas, oro 0 y
  madera 0

#### Scenario: El HUD no altera la simulación
- **GIVEN** dos partidas idénticas con la misma semilla, inputs y elecciones, una pintada con HUD y otra sin pintar
- **WHEN** ambas ejecutan 600 ticks con ≥ 1 golpe, ≥ 1 baja y ≥ 1 recogida de oro o de madera
- **THEN** sus snapshots son iguales campo a campo en cada tick

#### Scenario: Contadores en el navegador [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real) y un input que lleva al jugador hasta el
  montón de madera más cercano a la salida
- **WHEN** se avanza con `step(n)` hasta que la madera del snapshot es > 0, leyendo el HUD y el snapshot tras cada
  llamada
- **THEN** en cada lectura los números de oro y madera del HUD son iguales a los del snapshot pintado
- **AND** en la última lectura la madera mostrada es > 0 y no hay errores no capturados

### Requirement: HUD anclado a la ventana
La vista SHALL anclar cada elemento del HUD (barra y número de vida, tiempo restante, barra de XP y nivel, bajas, oro y
madera) a un borde, una esquina o el centro de un borde de la ventana. Para un mismo factor de escala del HUD (ver
"Escala del HUD por escalones"), la distancia en pantalla de cada elemento a su anclaje MUST ser la misma sea cual sea
el tamaño de la ventana (error ≤ 1 px). Con una ventana ≥ 960 × 540 en ambos ejes, cada elemento MUST quedar entero
dentro de la ventana y ningún par de elementos del HUD MUST solaparse. Si la ventana supera el tope de vista, el HUD se
ancla a la ventana o a la vista según fije el design, con las mismas garantías. Al redimensionar, el HUD MUST
reubicarse desde el primer frame pintado tras el cambio (ver "Redimensionado de la ventana" en `world-camera`). El
icono y el número de cada contador de oro y de madera forman un solo elemento.

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
- **GIVEN** un snapshot con vida `120/120`, tiempo `10:00`, nivel 99, 12.345 bajas, oro 123.456 y madera 12.345
- **WHEN** se pinta con ventanas de 960 × 540, 1.280 × 720, 1.920 × 1.080, 2.560 × 1.440 y 3.840 × 2.160
- **THEN** en cada una los siete elementos del HUD (vida, tiempo, barra de XP, nivel, bajas, oro y madera) están
  enteros dentro de la ventana y no se solapan entre sí

#### Scenario: Ventana menor que 960 × 540
- **GIVEN** una partida en curso pintada con una ventana de 640 × 360
- **WHEN** se pinta un frame
- **THEN** el HUD es visible con el factor de escala mínimo (× 1), cada elemento a la misma distancia de su anclaje que
  con 960 × 540, y no hay errores no capturados

#### Scenario: Contadores reubicados al redimensionar
- **GIVEN** una partida en pausa con oro 15 y madera 3 pintada con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540 y se pinta el siguiente frame, y después a 2.560 × 1.440
- **THEN** en cada frame los contadores de oro y madera están a la distancia de su anclaje que corresponde a su factor
  de escala (error ≤ 1 px), enteros dentro de la ventana, sin solapar otro elemento y con los mismos números
