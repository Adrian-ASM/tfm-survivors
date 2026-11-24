# Spec delta · hud

<!-- Change 0017-fullscreen-view. "Ventana", "vista" y "tope de vista" como en el delta de `world-camera`.
     Los umbrales de los escalones y el borde o esquina de anclaje de cada elemento los fija el design; esta spec
     fija las propiedades observables. -->

## ADDED Requirements

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

<!-- historial: 0017-fullscreen-view (pendiente de archivar) -->
