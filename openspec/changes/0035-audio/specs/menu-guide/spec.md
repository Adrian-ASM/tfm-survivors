# Spec delta · menu-guide

<!-- Change 0035-audio. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo: el menú de inicio pasa de 5 a 6 opciones (`Sonido`, 3.ª posición; ver `main-menu` y `audio`). Se
     actualizan los requisitos que cuentan las opciones o enumeran los botones bloqueados con la guía abierta. -->

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Cerrar la guía
El sistema SHALL cerrar la guía al pulsar `Cerrar` o al pulsar Esc con la guía abierta, desde cualquier página.
Al cerrarse, la guía MUST dejar de verse, el menú de inicio MUST seguir visible en modo menú, sin partida, con sus
seis opciones operativas, y el foco MUST quedar en el botón `Cómo jugar`. Cada pulsación de Esc MUST cerrar la guía
como mucho una vez y MUST NOT tener ningún otro efecto, aunque la tecla se mantenga pulsada. Tras cerrar la guía,
`Jugar` MUST seguir empezando una partida con una sola pulsación y Esc MUST pausar esa partida con una sola pulsación.

#### Scenario: Cerrar con el botón
- **GIVEN** la guía abierta en la página 4
- **WHEN** se pulsa `Cerrar`
- **THEN** la guía no es visible, el menú es visible con sus 6 opciones, no existe ninguna partida y el foco está en
  `Cómo jugar`

#### Scenario: Cerrar con Esc
- **GIVEN** la guía abierta en la página 7
- **WHEN** se pulsa Esc una vez
- **THEN** la guía no es visible, el menú es visible, no existe ninguna partida y el foco está en `Cómo jugar`

#### Scenario: Esc mantenido
- **GIVEN** la guía abierta en la página 2
- **WHEN** se pulsa Esc, llegan 20 `keydown` de repetición de Esc y se suelta
- **THEN** la guía no es visible, el menú es visible, no existe ninguna partida, el overlay de pausa no es visible y
  ni el diálogo de `Borrar datos` ni el panel `Sonido` son visibles

#### Scenario: Jugar y pausa tras cerrar la guía
- **GIVEN** el modo menú en el que se ha abierto la guía y se ha cerrado con Esc
- **WHEN** se pulsa `Jugar` una vez con el ratón, se pintan 30 frames y se pulsa Esc una vez, sin otro clic
- **THEN** existe exactamente 1 partida en curso y el overlay de pausa es visible

### Requirement: Opciones del menú bloqueadas con la guía abierta
El sistema SHALL, mientras la guía está abierta, hacer que `Jugar`, `Cómo jugar`, `Sonido`, `Exportar`, `Importar` y
`Borrar datos` no tengan efecto: no empieza ninguna partida, no se descarga ni se importa ningún fichero, no se abre
el diálogo de `Borrar datos` ni el panel `Sonido` y la guía sigue abierta en la misma página. Mientras el diálogo de
`Borrar datos` o el panel `Sonido` está abierto, `Cómo jugar` MUST NOT tener efecto (ver "Confirmación de Borrar datos"
en `main-menu` y "Panel Sonido" en `audio`). Al cerrarse la guía, el diálogo o el panel, el menú vuelve a estar
operativo.

#### Scenario: Pulsaciones del menú con la guía abierta
- **GIVEN** la guía abierta en la página 2 y un progreso guardado G
- **WHEN** se pulsan `Jugar`, `Sonido`, `Exportar`, `Importar` y `Borrar datos`
- **THEN** no existe ninguna partida, se han descargado 0 ficheros, no se ha abierto ningún selector de fichero, ni el
  diálogo de `Borrar datos` ni el panel `Sonido` son visibles y la guía sigue visible con el indicador `2 de 7`
- **AND** el valor guardado sigue siendo G byte a byte

#### Scenario: Cómo jugar con el diálogo de Borrar datos abierto
- **GIVEN** el diálogo de `Borrar datos` abierto
- **WHEN** se pulsa `Cómo jugar`
- **THEN** la guía no es visible y el diálogo sigue visible con `Confirmar` y `Cancelar`
- **AND** tras pulsar `Cancelar` y después `Cómo jugar`, la guía es visible en la página 1

#### Scenario: Cómo jugar con el panel Sonido abierto
- **GIVEN** el panel `Sonido` abierto desde el menú
- **WHEN** se pulsa `Cómo jugar`
- **THEN** la guía no es visible y el panel sigue visible
- **AND** tras cerrar el panel y pulsar `Cómo jugar`, la guía es visible en la página 1

#### Scenario: Jugar en el mismo frame que se abre la guía
- **GIVEN** el modo menú con la guía no visible
- **WHEN** en el mismo frame se pulsa `Cómo jugar` y después `Jugar`
- **THEN** la guía es visible y no existe ninguna partida

#### Scenario: Menú operativo tras cerrar
- **GIVEN** la guía abierta y cerrada con `Cerrar`
- **WHEN** se pulsa `Exportar`
- **THEN** se descarga exactamente 1 fichero `sprint-survivors-progress.json` y no existe ninguna partida

### Requirement: La guía nunca aparece sola
El sistema SHALL mostrar la guía solo como respuesta a una pulsación de `Cómo jugar` en modo menú. La guía MUST NOT
verse al cargar (con o sin `?e2e`), al volver al menú con `Volver al menú`, ni en ninguna pantalla con partida (en
curso, en pausa, eligiendo mejora, en tienda, en obra o terminada). Pulsar `Jugar` desde el menú no puede ocurrir con
la guía abierta (ver "Opciones del menú bloqueadas con la guía abierta"), de modo que ninguna partida empieza con la
guía visible.

#### Scenario: Carga sin parámetros
- **GIVEN** la build de producción servida sin parámetros
- **WHEN** termina la carga y se pintan 300 frames sin pulsar nada
- **THEN** el menú es visible y la guía no es visible

#### Scenario: Carga en modo E2E
- **GIVEN** la URL `?e2e&manual&seed=42`
- **WHEN** termina la carga y se llama a `step(15)`
- **THEN** la guía no es visible y la sonda informa de una partida en curso en el tick 15

#### Scenario: Volver al menú en modo E2E
- **GIVEN** la URL `?e2e&manual&seed=42` y la partida en pausa
- **WHEN** se pulsa `Volver al menú`
- **THEN** el menú de inicio es visible con sus 6 opciones y la guía no es visible

#### Scenario: Guía cerrada antes de jugar
- **GIVEN** el modo menú en el que se ha abierto la guía, se ha llegado a la página 6 y se ha cerrado
- **WHEN** se pulsa `Jugar`, después Esc y después `Volver al menú`
- **THEN** en ningún paso es visible la guía y, en el menú final, la guía sigue no visible

### Requirement: Guía observable en el navegador
El sistema SHALL permitir, en la build de producción y sin `?e2e`, abrir la guía, recorrer sus 7 páginas y cerrarla
sin recargar la página, sin errores no capturados en la consola, sin diálogos nativos del navegador y sin violaciones
de la CSP. La guía no añade ninguna sonda a `window.__sprint`.

#### Scenario: Recorrido de la guía en el smoke [E2E]
- **GIVEN** la build de producción servida sin `?e2e` y el menú de inicio visible
- **WHEN** una prueba E2E comprueba los 6 botones del menú, pulsa `Cómo jugar`, pulsa flecha derecha 7 veces,
  comprueba la guía con ventanas de 960 × 540 y de 1.920 × 1.080 y después pulsa Esc
- **THEN** al abrir la guía es visible con `1 de 7` y sin `Anterior`; tras 6 pulsaciones muestra `7 de 7` sin
  `Siguiente` y la séptima la deja en `7 de 7`
- **AND** con cada una de las dos ventanas el recuadro de la guía y sus botones visibles están enteros dentro de la
  ventana y el recuadro tiene su centro en el de la ventana (error ≤ 1 px en cada eje)
- **AND** tras Esc la guía no es visible, el menú es visible con sus 6 botones, el HUD no es visible y el foco está en
  `Cómo jugar`
- **AND** no hay errores no capturados, se han abierto 0 diálogos nativos y no se registra ningún evento
  `securitypolicyviolation`

## REMOVED Requirements
<!-- Ninguno. -->
