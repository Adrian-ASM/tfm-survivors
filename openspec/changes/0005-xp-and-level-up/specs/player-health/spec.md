# Spec delta · player-health

<!-- Change 0005-xp-and-level-up. La vida máxima pasa a ser mejorable (mejora `guardrail`, +20 por nivel,
     PROVISIONAL, A MEDIR EN APPLY): sube la vida máxima y la vida actual en la misma cantidad, sin curar el resto.
     El contacto observable con armas activas se reformula sin suponer vida máxima 100 (una mejora puede subirla) y
     con la elección de mejoras en marcha; su plazo en ticks es provisional porque las mejoras y el nuevo consumo
     de azar cambian la partida de la semilla 42. -->

## ADDED Requirements

### Requirement: Vida máxima mejorable
El sistema SHALL, al elegir una mejora de `maxHealth` (ver `upgrades`), sumar su incremento por nivel a la vida
máxima efectiva del jugador y la misma cantidad a su vida actual. La mejora no cura más allá de esa cantidad, no
cambia la invulnerabilidad y la vida actual nunca supera la vida máxima. El snapshot MUST exponer la vida máxima
efectiva.

#### Scenario: Con la vida llena
- **GIVEN** un jugador con vida 100 de 100
- **WHEN** se elige `guardrail` (+20)
- **THEN** el snapshot muestra vida 120 y vida máxima 120

#### Scenario: Con la vida a medias
- **GIVEN** un jugador con vida 55 de 100
- **WHEN** se elige `guardrail` (+20)
- **THEN** el snapshot muestra vida 75 y vida máxima 120

#### Scenario: Nivel máximo
- **GIVEN** un jugador con vida 100 de 100
- **WHEN** se elige `guardrail` 5 veces sin recibir golpes
- **THEN** la vida y la vida máxima valen 200

#### Scenario: La mejora no altera la invulnerabilidad
- **GIVEN** un jugador golpeado en el tick 10 con invulnerabilidad de 30 ticks y vida 90 de 100, y `guardrail`
  elegido en una oferta abierta en el tick 20
- **WHEN** un enemigo con damage 10 sigue en contacto desde el tick 21
- **THEN** la vida vale 110 de 120 hasta el tick 40 y 100 tras el tick 41

#### Scenario: Golpe letal tras la mejora
- **GIVEN** un jugador con vida 10 de 100 que elige `guardrail` (vida 30 de 120)
- **WHEN** recibe un golpe de damage 25 y, tras la invulnerabilidad, otro de damage 5
- **THEN** la vida vale 5 tras el primero y 0 tras el segundo, y la partida termina

## MODIFIED Requirements

### Requirement: Contacto observable con las armas activas
El sistema SHALL hacer que, con el contenido por defecto (armas y mejoras incluidas), un jugador que no se mueve
reciba al menos un golpe de contacto en un plazo acotado, de modo que el daño al jugador siga siendo observable en
el juego real, y que la partida siga en curso tras ese primer golpe.

#### Scenario: Primer golpe en el núcleo con armas activas
- **GIVEN** el contenido por defecto, semilla 42, input (0, 0) en todos los ticks y la política de elección fija
  (ver `simulation-loop`)
- **WHEN** se ejecutan 4.800 ticks (80 s) (plazo provisional, a revalidar en apply)
- **THEN** en algún tick ≤ 4.800 la vida del jugador es menor que su vida máxima
- **AND** en el tick del primer golpe la partida sigue en curso, con la vida del tick anterior menos el `damage` del
  enemigo que golpeó

#### Scenario: Primer golpe en el navegador
- **GIVEN** la build de producción servida con `?seed=42` y sin input de movimiento del jugador
- **WHEN** pasan como mucho 80 s de juego, pulsando la tecla 1 cada vez que aparece el overlay de elección
- **THEN** una prueba E2E observa una vida del jugador menor que la máxima, mayor que 0 y la partida en curso
