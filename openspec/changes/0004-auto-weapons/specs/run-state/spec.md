# Spec delta · run-state

<!-- Change 0004-auto-weapons. Con la partida terminada tampoco actúan las armas: ni disparos, ni proyectiles que
     se muevan, ni pulsos que caduquen, ni recarga. Se retira el requisito "Una partida sin defensa termina", que
     describía la ausencia de armas. -->

## MODIFIED Requirements

### Requirement: Simulación detenida tras terminar
El sistema SHALL ignorar los ticks pedidos sobre una partida terminada: MUST NOT cambiar la posición ni la vida
del jugador, la posición, la vida, la indicación de daño reciente ni el número de enemigos, el presupuesto ni el
tipo pendiente del director, la carga ni la cadencia de las armas, la posición ni el número de proyectiles, los
pulsos visibles, el estado del `RandomGenerator` ni el contador de ticks, sea cual sea el input. Pedir ticks sobre
una partida terminada no produce errores.

#### Scenario: 600 ticks después de terminar
- **GIVEN** una partida que termina en el tick n con ≥ 1 enemigo vivo
- **WHEN** se ejecutan 600 ticks más con input (1, 1)
- **THEN** el snapshot es igual campo a campo al del tick n, incluido `tick` = n
- **AND** no se ha producido ningún error

#### Scenario: Armas congeladas al terminar
- **GIVEN** una partida que termina en el tick n con ≥ 1 proyectil vivo, 1 pulso visible, ≥ 1 enemigo con daño
  reciente y un enemigo vivo a 50 px del jugador
- **WHEN** se ejecutan 600 ticks más
- **THEN** el snapshot es igual campo a campo al del tick n: mismos proyectiles en las mismas posiciones, el mismo
  pulso, la misma indicación de daño y ninguna vida de enemigo cambiada

#### Scenario: La terminación no consume azar
- **GIVEN** dos partidas idénticas con la misma semilla que terminan en el mismo tick n
- **WHEN** a una se le piden 600 ticks más y a la otra ninguno
- **THEN** sus snapshots son iguales campo a campo

#### Scenario: Una partida terminada no vuelve a en curso
- **GIVEN** una partida terminada
- **WHEN** se ejecutan 36.000 ticks más
- **THEN** el estado sigue siendo terminada y la vida sigue en 0

## REMOVED Requirements

### Requirement: Una partida sin defensa termina
Motivo: describía que en 0003 no existía ningún mecanismo de defensa. Con las armas de 0004 el jugador quieto
mata enemigos (ver `auto-weapons`, "Armas observables en el juego") y la duración de una partida pasa a depender
del equilibrio, que es provisional. Que la vida 0 termina la partida sigue cubierto por "Fin de partida al llegar a
vida 0".
