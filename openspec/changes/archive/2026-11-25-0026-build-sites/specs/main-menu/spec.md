# Spec delta · main-menu

## MODIFIED Requirements

### Requirement: Pausa con Esc
El sistema SHALL, al pulsar Esc con la partida en curso y sin pausa, poner la partida en pausa y mostrar un overlay
de pausa con el texto `Pausa` y los botones `Reanudar` y `Volver al menú`, pulsables con el ratón. Con la partida en
pausa, pulsar Esc o `Reanudar` quita la pausa y oculta el overlay. Cada pulsación de Esc MUST cambiar la pausa, la
tienda o la obra como mucho una vez, aunque la tecla se mantenga pulsada. Con la partida eligiendo mejora o terminada,
Esc MUST NOT tener efecto. Con la partida en tienda, Esc MUST salir de la tienda (ver "Overlay de la tienda" en
`castle-shop`) y, con la partida en obra, Esc MUST salir de la obra sin construir (ver "Panel de obra" en
`build-sites`); en ambos casos MUST NOT abrir la pausa: la partida queda en curso y sin pausa, y solo una pulsación
posterior la pausa. Mientras la partida está en pausa:
- no se ejecuta ningún tick ni se acumula tiempo (ver `simulation-loop`), y el snapshot no cambia;
- el estado de la partida sigue siendo en curso (la pausa no es un estado de `run-state`);
- el HUD sigue visible con los valores del snapshot de la pausa (ver `hud`);
- las teclas R, 1, 2 y 3 y el input de movimiento MUST NOT tener efecto, ni durante la pausa ni al reanudar;
- no se ven el overlay de elección, el de la tienda, el panel de obra ni el de resultados.

Pausar y reanudar MUST NOT cambiar la simulación: una partida pausada y reanudada que recibe la misma secuencia de
inputs por tick que otra sin pausa produce los mismos snapshots en cada tick.

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: Esc en la obra
- **GIVEN** una partida en obra en el tick n con el panel de obra visible
- **WHEN** se pulsa Esc, se mantiene pulsada 60 frames y se suelta
- **THEN** el panel de obra no es visible, el de pausa no se ha visto, el solar sigue en `free` y la partida está en
  curso sin pausa
- **AND** una segunda pulsación de Esc pone la partida en pausa
