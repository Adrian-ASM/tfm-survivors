# Spec delta · world-camera

<!-- Ruta: openspec/changes/0033-mobile-web/specs/world-camera/spec.md
     "Redimensionado de la ventana", "HUD y overlays fijos en pantalla", "Cámara que sigue al jugador dentro del
     mundo" y "Sonda de cámara para E2E" no cambian: en modo móvil se aplican con el tamaño de vista de este
     requisito (la sonda ya informa de la ventana en px CSS y del rectángulo en unidades de mundo). -->

## ADDED Requirements

## MODIFIED Requirements

### Requirement: Vista a ventana completa con tope
Mientras el juego está cargado (menú, partida en curso, en pausa, eligiendo mejora o terminada), el lienzo del juego
SHALL ocupar la ventana entera, sin barras de desplazamiento del documento. **Sin modo móvil** (ver "Activación del modo
móvil" en `mobile-display`), el lienzo va a zoom 1: un segmento de L unidades de mundo MUST medir L px CSS en pantalla
(error ≤ 1 px), sea cual sea la densidad de píxeles del dispositivo, y el área de mundo visible en cada frame (la
vista) MUST medir V_w × V_h = min(P_w, T_w) × min(P_h, T_h). **En modo móvil**, la vista MUST medir
min(W, T_w) × min(H, T_h), con W × H el tamaño lógico del lienzo de "Tamaño lógico del lienzo en modo móvil"
(`mobile-display`), y un segmento de L unidades de mundo MUST medir L × P_h / H px CSS (error ≤ 1 px); en modo móvil,
las posiciones y tamaños "en la ventana" de la vista, el HUD y las cartas que fijan esta spec, `hud` y `upgrades` se
miden en unidades del lienzo lógico, y los de los paneles DOM, en px CSS. Si la vista no llena la ventana (o el lienzo
lógico) en algún eje por el tope, el espacio fuera de la vista MUST NOT mostrar ninguna zona del mundo ni de fuera de
él; cómo se rellena ese espacio no lo fija esta spec. Sin modo móvil no hay tamaño mínimo de ventana: una ventana menor
que 960 × 540 sigue ocupada entera y ve menos mundo. Una ventana con ancho o alto 0 (p. ej. minimizada) MUST NOT
producir errores no capturados ni cambiar la simulación, en cualquier modo. Los escenarios de esta spec, de `hud`,
`upgrades`, `main-menu`, `menu-guide`, `run-results`, `castle-shop`, `build-sites` y `sprite-rendering` que no
mencionan el modo móvil se ejecutan sin él.

#### Scenario: Ventana de las pruebas
- **GIVEN** una ventana de 1.280 × 720, sin modo móvil, y una partida en curso
- **WHEN** se pinta un frame
- **THEN** el lienzo mide 1.280 × 720 px CSS, el documento no tiene barras de desplazamiento y la vista mide
  1.280 × 720 unidades de mundo

#### Scenario: Ventana igual al tope
- **GIVEN** una ventana de 2.560 × 1.440
- **WHEN** se pinta un frame de una partida
- **THEN** la vista mide 2.560 × 1.440

#### Scenario: Ventana mayor que el tope
- **GIVEN** una ventana de 3.840 × 2.160, y en otro caso de 2.561 × 1.441
- **WHEN** se pinta un frame de una partida
- **THEN** en ambos casos la vista mide 2.560 × 1.440 y ningún píxel de la ventana fuera de la vista muestra mundo

#### Scenario: Ventana mayor que el tope en un solo eje
- **GIVEN** una ventana de 3.000 × 800
- **WHEN** se pinta un frame de una partida
- **THEN** la vista mide 2.560 × 800

#### Scenario: Ventana pequeña
- **GIVEN** una ventana de 800 × 450, y en otro caso de 320 × 180
- **WHEN** se pinta un frame de una partida
- **THEN** la vista mide 800 × 450 y 320 × 180 respectivamente y el lienzo ocupa la ventana entera

#### Scenario: Densidad de píxeles 2
- **GIVEN** una ventana de 1.280 × 720 px CSS con densidad de píxeles 2
- **WHEN** se pinta un frame de una partida
- **THEN** la vista mide 1.280 × 720 unidades de mundo, igual que con densidad 1

#### Scenario: Ventana minimizada
- **GIVEN** una partida en curso en el tick 600 con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 0 × 0 y después vuelve a 1.280 × 720
- **THEN** no hay errores no capturados y, al volver, la vista mide 1.280 × 720 y cumple "Cámara que sigue al jugador
  dentro del mundo"

#### Scenario: Misma ventana con y sin modo móvil
- **GIVEN** una ventana de 844 × 390 con la URL `?mobile=0` y, en otra carga, con `?mobile=1`
- **WHEN** se pinta un frame de una partida
- **THEN** sin modo móvil la vista mide 844 × 390 unidades de mundo y 1 unidad mide 1 px CSS
- **AND** con modo móvil la vista mide 1.385,03 × 640 unidades de mundo (error ≤ 1) y 640 unidades miden 390 px CSS
  (error ≤ 1 px)

#### Scenario: Modo móvil con densidad de píxeles 3
- **GIVEN** el modo móvil y una ventana de 844 × 390 px CSS con densidad de píxeles 3
- **WHEN** se pinta un frame de una partida
- **THEN** la vista mide 1.385,03 × 640 unidades de mundo (error ≤ 1), igual que con densidad 1

## REMOVED Requirements
