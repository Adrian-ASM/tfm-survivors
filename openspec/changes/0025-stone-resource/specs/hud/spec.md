# Spec delta · hud

<!-- Al archivar: en el Purpose, "vida, tiempo restante, nivel/XP, bajas, oro, madera y piedra". -->

## ADDED Requirements

### Requirement: Piedra en el HUD
La vista SHALL mostrar en el HUD un tercer contador de recursos, el de **piedra**, junto a los de oro y madera, con un
**icono** y el número de piedra del último snapshot (`resources.stone`) como un entero completo, sin abreviar, sin
separador de miles ni truncar. El icono usa siempre el aspecto de la roca `medium` del recogible `stone` (ver "Aspectos
de los recogibles y de las vetas" en `sprite-rendering`). Con `?e2e`, la sonda del HUD (`window.__sprint.hud`) expone
además `stone` con el número mostrado, como ya hace con el oro y la madera. Si su hoja no carga, el icono se pinta con el color de reserva de
`stone` y el número se sigue mostrando, sin errores no capturados. El contador cambia solo cuando cambia el snapshot
pintado, sigue las reglas de anclaje y de escala del resto del HUD (factor ×1 y ×2 incluidos) y su icono y su número
forman un solo elemento. Los contadores de oro y madera conservan su contenido y su comportamiento.

#### Scenario: Piedra al empezar
- **GIVEN** el snapshot de una partida recién creada
- **WHEN** se pinta
- **THEN** el HUD muestra el icono de la piedra con el número 0, junto a los contadores de oro 0 y madera 0

#### Scenario: Piedra que cambia entre snapshots
- **GIVEN** un snapshot pintado con piedra 2 y el siguiente con piedra 9
- **WHEN** se pinta el segundo
- **THEN** el HUD muestra piedra 9 y los contadores de oro y madera no cambian

#### Scenario: Número grande
- **GIVEN** un snapshot con piedra 12.345
- **WHEN** se pinta
- **THEN** el HUD muestra el número 12345 completo

#### Scenario: Icono de la piedra que no carga
- **GIVEN** el snapshot de una partida recién creada y la hoja `Deco/05.png` (roca `medium`) sin cargar (las del oro y
  la madera, cargadas)
- **WHEN** se pinta el HUD
- **THEN** el contador de piedra es visible con su icono de reserva y el número 0, los de oro y madera con su icono de
  arte, y no hay errores no capturados

#### Scenario: Piedra en el navegador [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y el mismo recorrido que "Contadores en el navegador"
- **WHEN** se avanza con `step(n)` leyendo el HUD y el snapshot tras cada llamada
- **THEN** en cada lectura `hud.stone` es igual a `resources.stone` del snapshot pintado y
  `sprites.pickups.stone.visible` es igual al número de recogibles `stone` del snapshot, sin errores no capturados

## MODIFIED Requirements

### Requirement: Contenido y visibilidad del HUD
La vista SHALL mostrar un HUD con siete elementos: la vida del jugador (barra y número), el tiempo restante de la
partida, el nivel y la XP (la barra de XP de `leveling`), las bajas de la partida (ver `run-outcome`), el oro, la
madera (ver "Oro y madera en el HUD") y la piedra (ver "Piedra en el HUD"). El HUD MUST verse si y solo si existe una
partida: en todos sus estados (en curso, eligiendo mejora, en tienda y terminada) y también con la partida en pausa. En
el menú de inicio (ver `main-menu`), donde no existe partida, el HUD MUST NOT verse. El HUD muestra siempre los valores
del último snapshot pintado: mientras la partida está en pausa, eligiendo mejora o terminada, sus valores no cambian; en
la tienda solo cambian el oro y la vida, por las compras (la piedra no). No hay ningún botón ni indicador de tienda en el
HUD. El HUD solo depende del snapshot: no cambia la simulación.

<!-- Escenarios vivos sin cambios: "HUD con la partida terminada", "HUD en pausa", "HUD tras volver al menú y jugar",
     "El HUD no altera la simulación", "Contadores en el navegador [E2E]" y "HUD en la tienda". "HUD al empezar" y "Sin
     HUD en el menú" se sustituyen por los de abajo. -->

#### Scenario: HUD al empezar
- **GIVEN** el snapshot de una partida recién creada con el contenido por defecto
- **WHEN** se pinta
- **THEN** el HUD es visible y muestra vida `100/100` con la barra de vida llena (relleno 1), tiempo `10:00`, nivel
  1 con la barra de XP vacía, 0 bajas, oro 0, madera 0 y piedra 0

#### Scenario: Sin HUD en el menú
- **GIVEN** el menú de inicio al cargar sin `?e2e`
- **WHEN** se pintan 60 frames
- **THEN** el HUD no es visible en ningún frame, tampoco los contadores de oro, madera y piedra

#### Scenario: Piedra congelada en pausa y en la tienda
- **GIVEN** una partida en curso con piedra 6 y oro 30 que se pausa y, en otro caso, abre la tienda y compra un producto
  de precio 10
- **WHEN** el motor informa de 600 frames de 16,667 ms y se pinta 1 frame más
- **THEN** en todos esos frames el HUD muestra piedra 6

### Requirement: HUD anclado a la ventana
La vista SHALL anclar cada elemento del HUD (barra y número de vida, tiempo restante, barra de XP y nivel, bajas, oro,
madera y piedra) a un borde, una esquina o el centro de un borde de la ventana. Para un mismo factor de escala del HUD
(ver "Escala del HUD por escalones"), la distancia en pantalla de cada elemento a su anclaje MUST ser la misma sea cual
sea el tamaño de la ventana (error ≤ 1 px). Con una ventana ≥ 960 × 540 en ambos ejes, cada elemento MUST quedar entero
dentro de la ventana y ningún par de elementos del HUD MUST solaparse. Si la ventana supera el tope de vista, el HUD se
ancla a la ventana o a la vista según fije el design, con las mismas garantías. Al redimensionar, el HUD MUST
reubicarse desde el primer frame pintado tras el cambio (ver "Redimensionado de la ventana" en `world-camera`). El
icono y el número de cada contador de oro, de madera y de piedra forman un solo elemento.

<!-- Escenarios vivos sin cambios: "Mismo anclaje con dos ventanas", "Esquina opuesta que sigue a la ventana" y "Ventana
     menor que 960 × 540". "HUD entero y sin solapes" y "Contadores reubicados al redimensionar" se sustituyen por los
     de abajo. -->

#### Scenario: HUD entero y sin solapes
- **GIVEN** un snapshot con vida `120/120`, tiempo `10:00`, nivel 99, 12.345 bajas, oro 123.456, madera 12.345 y
  piedra 12.345
- **WHEN** se pinta con ventanas de 960 × 540, 1.280 × 720, 1.920 × 1.080, 2.560 × 1.440 y 3.840 × 2.160
- **THEN** en cada una los ocho elementos del HUD (vida, tiempo, barra de XP, nivel, bajas, oro, madera y piedra) están
  enteros dentro de la ventana y no se solapan entre sí

#### Scenario: Contadores reubicados al redimensionar
- **GIVEN** una partida en pausa con oro 15, madera 3 y piedra 4 pintada con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540 y se pinta el siguiente frame, y después a 2.560 × 1.440
- **THEN** en cada frame los contadores de oro, madera y piedra están a la distancia de su anclaje que corresponde a su
  factor de escala (error ≤ 1 px), enteros dentro de la ventana, sin solapar otro elemento y con los mismos números
