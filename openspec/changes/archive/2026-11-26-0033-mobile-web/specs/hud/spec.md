# Spec delta · hud

<!-- Ruta: openspec/changes/0033-mobile-web/specs/hud/spec.md
     "HUD anclado a la ventana" no cambia: su garantía para ventanas ≥ 960 × 540 se cumple en modo móvil porque el
     lienzo lógico mide siempre ≥ 960 × 640 en horizontal ("Tamaño lógico del lienzo en modo móvil", `mobile-display`)
     y sus medidas se toman en unidades del lienzo (ver "Vista a ventana completa con tope" en `world-camera`). -->

## ADDED Requirements

## MODIFIED Requirements

### Requirement: Escala del HUD por escalones
**Sin modo móvil** (ver "Activación del modo móvil" en `mobile-display`), la vista SHALL pintar el HUD con un factor de
escala k entero ≥ 1 que depende solo del tamaño de la ventana (nunca del snapshot): no hay escalado continuo. k MUST
NOT disminuir cuando la ventana crece en un eje sin decrecer en el otro. k MUST valer 1 con cualquier ventana de hasta
1.280 × 720 en ambos ejes (incluidas las menores que 960 × 540) y MUST ser ≥ 2 con cualquier ventana de al menos
2.560 × 1.440 en ambos ejes. **En modo móvil**, k es el factor fraccionario de "Escala de la UI del lienzo en modo
móvil" (`mobile-display`), que también depende solo del tamaño de la ventana y del contenido. En ambos modos, con
factor k, cada elemento del HUD MUST medir k veces lo que mide con factor 1, y su distancia al anclaje MUST ser k veces
la de factor 1 (error ≤ 1 px, o ≤ 1 unidad del lienzo en modo móvil). El cambio de factor al redimensionar MUST verse
desde el primer frame pintado tras el cambio. La escala MUST NOT cambiar la simulación ni los valores mostrados. Los
escenarios de este requisito que no mencionan el modo móvil se ejecutan sin él.

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

#### Scenario: Factor fraccionario en modo móvil
- **GIVEN** el modo móvil, un contenido con texto mínimo 12 px CSS, una ventana de 844 × 390 y el mismo snapshot
  pintado sin modo móvil con una ventana de 1.280 × 720 (factor 1)
- **WHEN** se miden la barra de vida, la barra de XP y la altura del texto del tiempo restante en ambos
- **THEN** el factor en modo móvil vale 1,4066 (error ≤ 0,001) y cada medida, en unidades del lienzo, es 1,4066 veces
  la de factor 1 (error ≤ 1 unidad)
- **AND** el texto del tiempo restante mide ≥ 12 px CSS en pantalla (error ≤ 0,1 px)

#### Scenario: El mismo tamaño de ventana con y sin modo móvil
- **GIVEN** una ventana de 1.280 × 720 con `?mobile=0` y, en otra carga, con `?mobile=1`, y un contenido con texto
  mínimo 12 px CSS
- **WHEN** se pinta el HUD
- **THEN** el factor vale 1 en ambas (en la segunda, k_min ≈ 0,762 < 1 con el lienzo de 1.137,78 × 640)
- **AND** el texto base mide 14 px CSS en la primera y 15,75 px CSS en la segunda (error ≤ 0,1 px), y ninguna cambia
  el snapshot

## REMOVED Requirements
