# Spec delta · world-camera

<!-- Ruta: openspec/changes/0030-pickup-visibility/specs/world-camera/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo: con el flote de 0030 un recogible se pinta hasta A px (4 con los datos del repositorio) por encima o por
     debajo de su posición de mundo, lo que contradice el error ≤ 1 px de este requisito para las gemas. La cámara, el
     zoom y el recorte no cambian. -->

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Elementos de la partida en coordenadas de mundo
La vista SHALL pintar jugador, enemigos, cadáveres, proyectiles, pulsos, recogibles (gemas incluidas), mapa y fondo en
su posición de mundo: un elemento en (x, y) se ve en la ventana en (o_x + x − izquierda, o_y + y − arriba), siendo
(izquierda, arriba) la esquina del rectángulo visible y (o_x, o_y) la posición en la ventana de la esquina superior
izquierda de la vista ((0, 0) si la ventana no supera el tope; si lo supera, la que fije el design), con un error
≤ 1 px. En un recogible, (x, y) es su posición pintada: la del snapshot más su desplazamiento de flote (ver "Flote de los
recogibles" en `sprite-rendering`), o la del snapshot durante su aparición y con aspecto de reserva. Un elemento fuera
del rectángulo visible no se ve en pantalla, pero sigue en el snapshot.

#### Scenario: Enemigo a la derecha del jugador
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720, el jugador en (1.920, 1.080) y un enemigo en
  (2.160, 1.140)
- **WHEN** se pinta el snapshot
- **THEN** el enemigo se ve en la posición de pantalla (880, 420)

#### Scenario: Jugador junto a una esquina
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720 y el jugador en (16, 2.144)
- **WHEN** se pinta el snapshot
- **THEN** el jugador se ve en la posición de pantalla (16, 704)

#### Scenario: Ventana mayor que el tope
- **GIVEN** el mundo por defecto, una ventana de 3.840 × 2.160, el jugador en (1.920, 1.080) y un enemigo en
  (1.920 + 1.300, 1.080)
- **WHEN** se pinta el snapshot
- **THEN** el jugador se ve en (o_x + 1.280, o_y + 720) y el enemigo, fuera del rectángulo visible
  (640, 360)–(3.200, 1.800), no se ve en pantalla

#### Scenario: Gema que flota
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720, el jugador en (1.920, 1.080), unos datos de aspecto con
  A 4, T 1.600 y s 200, y una gema de id 0 en (2.160, 1.140)
- **WHEN** se pinta el snapshot con el reloj de render R = 400
- **THEN** la gema se ve en la posición de pantalla (880, 424) (error ≤ 1 px)

## REMOVED Requirements
<!-- Ninguno. -->
