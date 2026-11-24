# Spec delta · auto-weapons

<!-- Change 0017-fullscreen-view. Añadido en apply (decisión del usuario, 2026-11-23): con el mundo de 3.840 × 2.160,
     el anillo de aparición de 1.500 y la tabla de oleadas E1 (1,2 / 2,4 / 2,4 / 3,0 / 4,2), los enemigos tardan más
     en llegar al jugador quieto. Medido con las semillas 1..50: primera baja por armas entre los ticks 508 y 850
     (solo 5 semillas ≤ 600); semilla 7: primer proyectil en el 590, primera baja en el 656 y primer pulso de Tests
     en el 1.434. La ventana de la primera baja pasa de 600 a 900 ticks. Detalle en
     docs/ai-log/2026-11-23-0017-apply.md. -->

## MODIFIED Requirements

### Requirement: Armas observables en el juego
El sistema SHALL hacer que, con el contenido por defecto, las armas maten enemigos en una partida real sin que el
jugador pulse nada más que las elecciones de mejora.

#### Scenario: Jugador quieto con el contenido por defecto
- **GIVEN** el contenido por defecto (mundo de 3.840 × 2.160, anillo de aparición 1.500), semilla 7, input (0, 0) en
  todos los ticks y la política de elección fija
- **WHEN** se ejecutan 900 ticks (15 s)
- **THEN** se ha creado ≥ 1 proyectil y ≥ 1 enemigo ha quedado dado de baja por armas (medido en apply de 0017:
  primer proyectil en el tick 590 y primera baja en el 656)
- **AND** al seguir hasta el tick 4.800 (80 s), se ha disparado ≥ 1 pulso de Tests en algún tick ≤ 4.800 (medido en
  apply de 0017: tick 1.434)

#### Scenario: Comprobación en el navegador
- **GIVEN** la build de producción servida con `?seed=7` y sin input de movimiento del jugador
- **WHEN** pasan 15 s de juego, pulsando la tecla 1 cada vez que aparece el overlay de elección
- **THEN** una prueba E2E o de snapshot observa ≥ 1 proyectil pintado y ≥ 1 enemigo dado de baja
- **AND** no se exige ningún pulso en esos 15 s (el pulso se comprueba en el núcleo, en ≤ 4.800 ticks)

<!-- historial: 0017-fullscreen-view (pendiente de archivar) -->
