# Spec delta · auto-weapons

<!-- Ruta: openspec/changes/0013-world-camera/specs/auto-weapons/spec.md
     Solo cambia el plazo del primer pulso de Tests con el jugador quieto: 1.800 → 4.800 ticks (decisión del usuario
     en apply, 2026-11-23, sin tocar el contenido). Motivo: en el mundo de 1.920 × 1.080 los enemigos nacen más lejos
     del jugador y ya no se recortan contra las paredes de una arena del tamaño de la vista, así que tardan más en
     entrar en el radio del pulso. Medido en el punto de control de apply (tarea 0.2): primer pulso con la semilla 7
     en el tick 4.161. El resto de "Jugador quieto con el contenido por defecto" (600 ticks) sigue igual. -->

## MODIFIED Requirements

### Requirement: Armas observables en el juego
El sistema SHALL hacer que, con el contenido por defecto, las armas maten enemigos en una partida real sin que el
jugador pulse nada más que las elecciones de mejora.

#### Scenario: Jugador quieto con el contenido por defecto
- **GIVEN** el contenido por defecto (mundo de 1.920 × 1.080), semilla 7, input (0, 0) en todos los ticks y la
  política de elección fija
- **WHEN** se ejecutan 600 ticks (10 s)
- **THEN** se ha creado ≥ 1 proyectil y ≥ 1 enemigo ha quedado dado de baja por armas
- **AND** al seguir hasta el tick 4.800 (80 s), se ha disparado ≥ 1 pulso de Tests en algún tick ≤ 4.800 (medido en
  apply de 0013: tick 4.161)

#### Scenario: Comprobación en el navegador
- **GIVEN** la build de producción servida con `?seed=7` y sin input de movimiento del jugador
- **WHEN** pasan 15 s de juego, pulsando la tecla 1 cada vez que aparece el overlay de elección
- **THEN** una prueba E2E o de snapshot observa ≥ 1 proyectil pintado y ≥ 1 enemigo dado de baja
- **AND** no se exige ningún pulso en esos 15 s (el pulso se comprueba en el núcleo, en ≤ 4.800 ticks)
