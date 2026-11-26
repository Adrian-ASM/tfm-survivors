# Spec delta · simulation-loop

<!-- Change 0035-audio. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo: la lista de lo que el adaptador sigue atendiendo cada frame en modo manual cita las teclas; se añade M y el
     audio (el reloj de render de modo manual, que avanza `n × TICK_MS` con cada `step(n)`, es el que usa la limitación
     por tipo de `audio`). Sin cambios en el núcleo. -->

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Sin avance por tiempo real en modo manual
En modo manual, el sistema SHALL no ejecutar ticks por el paso del tiempo real: los frames que informe el motor
MUST ejecutar 0 ticks y no acumular tiempo, sea cual sea su duración (incluidos frames de 5.000 ms), y la partida
solo avanza con `step(n)`. El resto del adaptador MUST seguir atendiendo cada frame igual que en tiempo real:
teclado (dirección, Esc, R, M), clics de pausa y de elección de mejora, menú, panel `Sonido`, pantalla de resultados,
guardado y audio (ver `audio`). El reloj de render de modo manual (0014) avanza `n × TICK_MS` con cada `step(n)` y no
avanza con los frames del motor; el audio lo usa para su limitación por tipo.

#### Scenario: Sin step no avanza
- **GIVEN** la URL `?e2e&manual&seed=7` y la partida recién arrancada al cargar
- **WHEN** pasan 2 s reales sin llamar a `step`
- **THEN** `snapshot.tick` sigue valiendo 0

#### Scenario: Frames largos sin step
- **GIVEN** modo manual y una partida en curso en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms y después de 1 frame de 5.000 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue igual campo a campo al del tick n
- **AND** un `step(1)` posterior devuelve 1 y deja el snapshot en el tick n + 1 (sin ráfaga por ese tiempo)

#### Scenario: Pausa sin step
- **GIVEN** modo manual y una partida en curso en el tick n
- **WHEN** se pulsa Esc sin llamar a `step`
- **THEN** la partida queda en pausa y el panel de pausa está visible, con el snapshot en el tick n

#### Scenario: Elección sin step
- **GIVEN** modo manual y una partida con una oferta abierta en el tick n
- **WHEN** se hace clic en la opción de índice 0 sin llamar a `step`
- **THEN** la oferta se cierra, la mejora elegida figura en las mejoras adquiridas y el snapshot sigue en el
  tick n con la partida en curso

#### Scenario: Reinicio sin step
- **GIVEN** modo manual y una partida terminada con la pantalla de resultados visible
- **WHEN** se pulsa R sin llamar a `step`
- **THEN** empieza una partida nueva en el tick 0 y sigue en el tick 0 tras 2 s reales sin `step`

#### Scenario: Silencio sin step
- **GIVEN** modo manual y una partida en curso en el tick n sin silencio
- **WHEN** se pulsa M sin llamar a `step`
- **THEN** la sonda de audio informa del silencio activado y el snapshot sigue en el tick n

## REMOVED Requirements
<!-- Ninguno. -->
