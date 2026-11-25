# Spec delta · world-camera

> Ajuste transversal (change 0028): el menú pasa a tener cinco opciones y la guía «Cómo jugar» (ver `menu-guide`) es
> una pantalla más del menú que debe sobrevivir al redimensionado.

## ADDED Requirements

(ninguno)

## MODIFIED Requirements

### Requirement: Redimensionado de la ventana
El sistema SHALL adaptarse a cada cambio de tamaño de la ventana en cualquier pantalla del juego (menú con o sin el
diálogo de `Borrar datos` o la guía, partida en curso, en pausa, eligiendo mejora y terminada) sin recargar la página.
Desde el primer frame pintado tras el cambio, la vista, el HUD (ver `hud`) y los overlays (ver `upgrades`,
`main-menu`, `menu-guide` y `run-results`) MUST corresponder al tamaño nuevo, con sus zonas de clic donde se pintan.
Redimensionar MUST NOT:
- cambiar el snapshot, el estado de la partida, la pausa, la oferta abierta, la página visible de la guía ni el
  progreso guardado;
- ejecutar ni saltar ticks (con la partida en pausa, eligiendo mejora o terminada no se ejecuta ninguno);
- crear ni reiniciar ninguna partida, ni cerrar el menú, el diálogo, la guía ni ningún overlay;
- dejar elementos duplicados: tras cualquier secuencia de cambios hay exactamente un elemento de cada tipo del HUD y
  de cada overlay visible.

Un cambio a un tamaño igual al actual MUST NOT cambiar nada de lo pintado.

#### Scenario: Redimensionado en mitad de la partida
- **GIVEN** una ventana de 1.280 × 720 y una partida en curso con el jugador en (1.920, 1.080)
- **WHEN** la ventana pasa a 800 × 450 y se pinta el siguiente frame
- **THEN** la vista mide 800 × 450 y su esquina superior izquierda es (1.520, 855)
- **AND** el snapshot es igual campo a campo al de una partida idéntica sin redimensionar en ese mismo tick

#### Scenario: Muchos cambios seguidos
- **GIVEN** una partida en curso con una ventana de 1.280 × 720
- **WHEN** la ventana cambia 50 veces de tamaño en 60 frames, alternando entre 1.280 × 720, 1.000 × 600 y
  2.560 × 1.440, y termina en 1.000 × 600
- **THEN** en el último frame la vista mide 1.000 × 600 y hay exactamente 1 barra de vida, 1 tiempo restante, 1 barra
  de XP, 1 nivel y 1 contador de bajas
- **AND** no hay errores no capturados

#### Scenario: Redimensionado en pausa
- **GIVEN** una partida en pausa en el tick 500
- **WHEN** la ventana pasa de 1.280 × 720 a 1.600 × 900 y el motor informa de 60 frames de 16,667 ms
- **THEN** el snapshot sigue igual campo a campo al del tick 500, la partida sigue en pausa y el overlay de pausa es
  visible con `Reanudar` y `Volver al menú` pulsables en su posición nueva

#### Scenario: Redimensionado con la oferta abierta [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=7` en una ventana de 1.280 × 720 y una partida que, tras
  llamadas a `step(60)` sin input, tiene una oferta de 3 opciones abierta en el tick n
- **WHEN** la ventana pasa a 1.000 × 600, se pinta 1 frame, se lee la sonda y se hace clic en el centro de la ventana,
  (500, 300)
- **THEN** la sonda informa de una vista de 1.000 × 600 que cumple la fórmula de "Cámara que sigue al jugador dentro
  del mundo" con la posición del jugador del snapshot (error ≤ 1 px) y de un snapshot todavía en el tick n
- **AND** el clic elige la opción de índice 1 (ver "Overlay de elección en la ventana" en `upgrades`)

#### Scenario: Redimensionado en el menú y con resultados
- **GIVEN** el menú de inicio, y en otra carga una partida terminada con el overlay de resultados visible, con una
  ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540 y se pintan 60 frames
- **THEN** el menú sigue visible con sus cinco opciones (o el overlay de resultados con sus botones), centrado en la
  ventana nueva, y no existe ninguna partida nueva

#### Scenario: Redimensionado con la guía abierta
- **GIVEN** el menú de inicio con la guía abierta en la página 6 y una ventana de 1.280 × 720
- **WHEN** la ventana cambia 10 veces de tamaño, alternando entre 960 × 540 y 2.560 × 1.440, termina en 960 × 540 y
  se pintan 60 frames
- **THEN** hay exactamente 1 guía visible, con el indicador `6 de 7`, centrada en x = 480 (error ≤ 1 px), y no existe
  ninguna partida

#### Scenario: Mismo tamaño
- **GIVEN** una partida en curso con una ventana de 1.280 × 720
- **WHEN** se notifica un cambio de tamaño a 1.280 × 720
- **THEN** la vista, el HUD y los overlays tienen la misma posición y tamaño en pantalla que antes (error ≤ 1 px)

## REMOVED Requirements

(ninguno)
