# Spec delta · world-camera

<!-- Ruta: openspec/changes/0015-procedural-map/specs/world-camera/spec.md
     Cambios: el E2E que recorre las cuatro esquinas carga con `map=empty` (ver "Mapa vacío en modo E2E" en
     `procedural-map`), porque con el mapa real una esquina puede ser tronco o agua, y se añade un escenario con el
     mapa real. El comportamiento de la cámara no cambia. -->

## MODIFIED Requirements

### Requirement: Cámara que sigue al jugador dentro del mundo
Mientras existe una partida, la vista SHALL mostrar en cada frame un rectángulo del mundo del tamaño de la vista
(V_w × V_h) centrado en la posición del jugador del snapshot pintado y desplazado lo mínimo para quedar entero dentro
del mundo (W × H). Su esquina superior izquierda MUST ser
(clamp(x − V_w / 2, 0, W − V_w), clamp(y − V_h / 2, 0, H − V_h)), con un error ≤ 1 px. El seguimiento es directo: el
rectángulo corresponde al snapshot pintado en ese mismo frame, sin retraso, suavizado ni zona muerta. La vista MUST
NOT mostrar en ningún frame ninguna zona fuera de (0, 0)–(W, H). En el primer frame de cada partida (la primera, tras
R y tras `Volver al menú` + `Jugar`) el rectángulo ya corresponde a la posición inicial del jugador, sin heredar el
de la partida anterior.

#### Scenario: Jugador en el centro del mundo
- **GIVEN** el mundo por defecto y el jugador en (960, 540)
- **WHEN** se pinta el snapshot
- **THEN** el rectángulo visible es (480, 270)–(1.440, 810)

#### Scenario: Las cuatro esquinas
- **GIVEN** el mundo por defecto y el jugador, en cuatro snapshots distintos, en (16, 16), (1.904, 16), (16, 1.064) y
  (1.904, 1.064)
- **WHEN** se pinta cada snapshot
- **THEN** el rectángulo visible es, respectivamente, (0, 0)–(960, 540), (960, 0)–(1.920, 540),
  (0, 540)–(960, 1.080) y (960, 540)–(1.920, 1.080)

#### Scenario: Límite exacto del recorte
- **GIVEN** el mundo por defecto y el jugador, en dos snapshots, en (480, 270) y en (1.440, 810)
- **WHEN** se pinta cada snapshot
- **THEN** el rectángulo visible es (0, 0)–(960, 540) y (960, 540)–(1.920, 1.080) respectivamente

#### Scenario: Recorte en un solo eje
- **GIVEN** el mundo por defecto y el jugador en (100, 540)
- **WHEN** se pinta el snapshot
- **THEN** el rectángulo visible es (0, 270)–(960, 810)

#### Scenario: Seguimiento sin retraso
- **GIVEN** el mundo por defecto, un snapshot pintado con el jugador en (960, 540) y el siguiente con el jugador en
  (1.000, 540)
- **WHEN** se pinta el segundo snapshot
- **THEN** en ese mismo frame el rectángulo visible es (520, 270)–(1.480, 810)

#### Scenario: Mundo igual a la vista
- **GIVEN** un mundo de 960 × 540, una vista de 960 × 540 y el jugador en (16, 16) y después en (944, 524)
- **WHEN** se pinta cada snapshot
- **THEN** en ambos el rectángulo visible es (0, 0)–(960, 540)

#### Scenario: Nada fuera del mundo en una partida real
- **GIVEN** la build de producción con `?e2e&map=empty&seed=7` y un input que lleva al jugador a las cuatro esquinas
  del mundo
- **WHEN** se pintan los frames hasta que el jugador ha tocado las cuatro esquinas
- **THEN** en cada frame el rectángulo visible que informa la sonda está dentro de (0, 0)–(1.920, 1.080)

#### Scenario: Nada fuera del mundo con el mapa real
- **GIVEN** la build de producción con `?e2e&manual&seed=7` (mapa real) y la flecha derecha mantenida
- **WHEN** se llama a `step(60)` 20 veces, eligiendo la opción 0 si se abre una oferta, y se lee la sonda tras cada
  llamada
- **THEN** en cada lectura el rectángulo visible está dentro de (0, 0)–(1.920, 1.080) y cumple la fórmula de este
  requisito con la posición del jugador del snapshot (error ≤ 1 px)

#### Scenario: Partida nueva tras acabar en una esquina
- **GIVEN** una partida terminada ya pintada con el jugador en (1.904, 1.064)
- **WHEN** se pulsa R y se pinta el primer frame de la partida nueva (tick ≤ 60, sin input; como en `run-results`)
- **THEN** el rectángulo visible de ese primer frame es (480, 270)–(1.440, 810)
