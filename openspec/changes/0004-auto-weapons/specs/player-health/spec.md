# Spec delta · player-health

<!-- Change 0004-auto-weapons. Las reglas de daño al jugador no cambian. Con las armas activas, el jugador quieto
     tarda más en recibir el primer golpe, porque los bugs pueden morir antes de llegar; la comprobación en el
     juego real de 0003 ("la vida baja en ≤ 20 s") pasa a tener un plazo fijado aquí. Si al medir en apply el plazo
     no se cumple con la semilla 42, es un hallazgo de equilibrio: se vuelve a esta spec, no se relaja el test por
     su cuenta. -->

## ADDED Requirements

### Requirement: Contacto observable con las armas activas
El sistema SHALL hacer que, con el contenido por defecto (armas incluidas), un jugador que no se mueve reciba al
menos un golpe de contacto en un plazo acotado, de modo que el daño al jugador siga siendo observable en el juego
real, y que la partida siga en curso tras ese primer golpe.

#### Scenario: Primer golpe en el núcleo con armas activas
- **GIVEN** el contenido por defecto, semilla 42 e input (0, 0) en todos los ticks
- **WHEN** se ejecutan 3.600 ticks (60 s)
- **THEN** en algún tick ≤ 3.600 la vida del jugador es menor que 100
- **AND** en el tick del primer golpe la partida sigue en curso, con vida 100 menos el `damage` del enemigo que
  golpeó

#### Scenario: Primer golpe en el navegador
- **GIVEN** la build de producción servida con `?seed=42` y sin input del jugador
- **WHEN** pasan como mucho 60 s de juego
- **THEN** una prueba E2E observa una vida del jugador menor que la máxima, mayor que 0 y la partida en curso
