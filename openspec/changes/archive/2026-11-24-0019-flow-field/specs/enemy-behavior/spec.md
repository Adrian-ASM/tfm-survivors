# Spec delta · enemy-behavior

<!-- Change 0019-flow-field. Los enemigos dejan de ignorar el mapa: persiguen en línea recta cuando tienen línea libre
     (o están en la celda del jugador) y, si no, siguen el campo de distancias 4-vecino de la celda del jugador.
     Convención de `procedural-map`: un escenario con posiciones explícitas y sin mapa declarado usa el mapa vacío;
     un "mapa de hierba con…" es un mapa explícito de 64 × 36 todo `grass` salvo las celdas citadas, celda de 60 px.
     Purpose nuevo (al archivar): "Los enemigos persiguen al jugador a la velocidad de su tipo, en línea recta cuando
     nada se interpone y rodeando por el mapa (troncos, castillo, río por los puentes) cuando sí, sin salir de la
     arena." -->

## ADDED Requirements

### Requirement: Línea libre hasta el jugador
El sistema SHALL considerar que un enemigo vivo tiene **línea libre** en un tick si es caminable toda celda que
contiene algún punto del segmento recto que va del centro del enemigo al centro del jugador (tras el movimiento del
jugador en ese tick), con la regla de "celda de un punto" de `procedural-map` (⌊x / `cellSize`⌋, ⌊y / `cellSize`⌋).
Si el segmento pasa exactamente por la esquina común de cuatro celdas, también MUST ser caminables las dos celdas
laterales de esa esquina (no se corta por esquinas). Con el mapa vacío todo enemigo tiene siempre línea libre.
Decidir si hay línea libre MUST NOT consumir azar ni depender de la vista, de la ventana ni del orden de la lista de
enemigos.

#### Scenario: Obstáculo fuera del segmento
- **GIVEN** un mapa de hierba con un tronco en (3, 6) (x en [180, 240], y en [360, 420]), un jugador quieto en
  (480, 270) y un enemigo con velocidad 60 en (100, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (160, 270) con un error ≤ 0,001, igual que con el mapa vacío

#### Scenario: Obstáculo que corta el segmento
- **GIVEN** un mapa de hierba con un tronco en (5, 4) (x en [300, 360], y en [240, 300]), un jugador quieto en
  (480, 270) y un enemigo en (100, 270)
- **WHEN** se evalúa la línea libre del enemigo
- **THEN** el enemigo no tiene línea libre

#### Scenario: Segmento sobre el borde de una celda bloqueada
- **GIVEN** un mapa de hierba con un tronco en (3, 5) (x en [180, 240], y en [300, 360]), un jugador quieto en
  (480, 300) y un enemigo con velocidad 60 en (100, 300) (el segmento y = 300 está en la fila 5 por la regla de celda
  de un punto y atraviesa el tronco)
- **WHEN** se ejecutan 600 ticks
- **THEN** el enemigo no tiene línea libre en el tick 1
- **AND** en ningún tick el centro del enemigo está en la celda (3, 5) (la recta y = 300 sí lo pondría en ella para
  x en [180, 240])
- **AND** en algún tick ≤ 600 el enemigo está en (480, 300) con un error ≤ 0,001

#### Scenario: Agua y castillo también cortan la línea
- **GIVEN** el mapa del escenario "Obstáculo que corta el segmento" con la celda (5, 4) de `water`, y en otro caso de
  `castle`, y en otro de `bridge`
- **WHEN** se evalúa la línea libre del enemigo
- **THEN** con `water` y con `castle` no tiene línea libre y con `bridge` sí

#### Scenario: Sin cortar por una esquina
- **GIVEN** un mapa de hierba con troncos en (4, 3) y (3, 4), un jugador quieto en (270, 270) (celda (4, 4)) y un
  enemigo en (210, 210) (celda (3, 3)); el segmento pasa exactamente por la esquina (240, 240)
- **WHEN** se evalúa la línea libre del enemigo
- **THEN** el enemigo no tiene línea libre
- **AND** sin esos dos troncos sí la tiene

### Requirement: Navegación por el campo de flujo
El sistema SHALL mover, en cada tick de una partida en curso, a cada enemigo vivo que no tiene línea libre y no está
en la celda del jugador según el **campo de distancias** de la celda que ocupa el jugador tras su movimiento en ese
tick (ver "Campo de distancias hacia una celda" en `procedural-map`):
- La **siguiente celda** del enemigo es, entre las 4 vecinas de su celda (arriba, abajo, izquierda, derecha), la
  caminable cuya distancia en el campo es exactamente 1 menos que la de su celda. Si varias lo cumplen, gana la primera
  en un orden de vecinos fijo, el mismo para todos los enemigos, ticks y partidas, que el design MUST documentar.
- El enemigo recorre `velocidad del tipo × 1/60` en línea recta hacia el centro de su siguiente celda (el del
  rectángulo recortado si es una celda del borde). MUST NOT sobrepasar ese centro: si está a una distancia
  ≤ `velocidad × 1/60`, termina exactamente en él y el resto del paso se pierde en ese tick. En el tick siguiente
  vuelve a elegir desde la celda en que haya quedado.
- Si la celda del enemigo no tiene distancia en el campo (es no caminable o no está conectada por 4 vecinos con la
  celda del jugador), el enemigo persigue en línea recta como en "Persecución en línea recta".

Navegar MUST NOT consumir azar, MUST NOT cambiar el mapa y MUST dar la misma posición con cualquier tamaño de ventana.
La velocidad del enemigo es la de su tipo sea cual sea el modo (línea libre o campo). El campo usado en un tick MUST
depender solo del mapa de la partida y de la celda del jugador en ese tick, no de cómo llegó el jugador a ella.

#### Scenario: Cruce del río por el único puente
- **GIVEN** un mapa de hierba con toda la columna 10 de `water` (x en [600, 660], filas 0–35) salvo la celda (10, 20),
  que es `bridge`; un jugador quieto en (930, 270) con una vida suficiente para no llegar a 0 en 3.600 ticks, y un
  enemigo con velocidad 60 en (330, 270)
- **WHEN** se ejecutan 3.600 ticks
- **THEN** en ningún tick el centro del enemigo está en una celda `water`
- **AND** en algún tick su centro está en la celda (10, 20)
- **AND** en algún tick ≤ 2.520 (camino 4-vecino de 42 celdas a 60 px/s) está en (930, 270) con un error ≤ 0,001

#### Scenario: Rodeo de un muro de troncos
- **GIVEN** un mapa de hierba con troncos en las celdas (10, 2) a (10, 6) (x en [600, 660], y en [120, 420]), un
  jugador quieto en (930, 270) con una vida suficiente para no llegar a 0 en 1.200 ticks y un enemigo con velocidad 60
  en (330, 270)
- **WHEN** se ejecutan 1.200 ticks
- **THEN** en ningún tick el centro del enemigo está en una celda `trunk`
- **AND** llega a (930, 270) (error ≤ 0,001) en un tick entre 601 y 960, ambos incluidos (más tarde que los 600 de la
  recta con el mapa vacío; como mucho, el camino 4-vecino de 16 celdas)

#### Scenario: Rodeo del castillo
- **GIVEN** un mapa de hierba con las celdas de columnas 30–34 y filas 15–18 `castle` (x en [1.800, 2.100], y en
  [900, 1.140]), un jugador quieto en (1.950, 1.170) con una vida suficiente para no llegar a 0 en 1.200 ticks y un
  enemigo con velocidad 60 en (1.950, 870), justo encima de la huella
- **WHEN** se ejecutan 1.200 ticks
- **THEN** en ningún tick el centro del enemigo está en una celda `castle`
- **AND** llega a (1.950, 1.170) (error ≤ 0,001) en un tick > 300 y ≤ 660 (camino 4-vecino de 11 celdas)

#### Scenario: Paso por tick con el campo
- **GIVEN** el mapa y el jugador de "Rodeo de un muro de troncos" y un `goblin-torch` (velocidad 90) en (330, 270)
- **WHEN** se ejecuta 1 tick
- **THEN** el `goblin-torch` está a 1,5 unidades (error ≤ 0,001) de (330, 270) y su centro sigue en una celda caminable

#### Scenario: Empate resuelto igual siempre
- **GIVEN** el mapa y el jugador de "Rodeo del castillo" (rodear por la izquierda o por la derecha cuesta lo mismo),
  dos partidas idénticas con un enemigo con velocidad 60 en (1.950, 870) y una tercera con dos enemigos del mismo tipo
  en (1.950, 870)
- **WHEN** se ejecutan 660 ticks en cada una
- **THEN** el enemigo tiene la misma posición en cada tick en las dos primeras partidas
- **AND** en la tercera los dos enemigos tienen exactamente la misma posición en cada tick
- **AND** en el tick 120 el enemigo está a la izquierda (x < 1.950) o a la derecha (x > 1.950) del eje de la huella, y
  ese lado es el mismo en las tres partidas

#### Scenario: El campo solo depende de la celda del jugador
- **GIVEN** el mapa de "Rodeo de un muro de troncos", un enemigo en (330, 270) y, en dos partidas, un jugador quieto
  en (910, 250) y en (950, 290) (ambos en la celda (15, 4), sin línea libre desde el enemigo)
- **WHEN** se ejecuta 1 tick en cada partida
- **THEN** el enemigo queda exactamente en la misma posición en las dos

#### Scenario: Celda sin distancia en el campo
- **GIVEN** un mapa de hierba con troncos en (10, 4), (9, 5), (11, 5) y (10, 6), que encierran la celda caminable
  (10, 5); un jugador quieto en (1.230, 330) y un enemigo con velocidad 60 en (630, 330), centro de la (10, 5)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (690, 330) con un error ≤ 0,001 (persecución en línea recta)
- **AND** con el enemigo en (630, 270), sobre el tronco (10, 4), y el jugador en (1.230, 270), tras 60 ticks está en
  (690, 270) con un error ≤ 0,001

#### Scenario: La navegación no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una hay un enemigo sin línea libre que navega
  por el campo y en la otra el mismo enemigo con línea libre
- **WHEN** ambas ejecutan el mismo tick sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

### Requirement: Enemigos fuera de celdas no caminables en el mapa generado
El sistema SHALL mantener, con el mapa generado por cualquier semilla y el contenido por defecto, el centro de cada
enemigo vivo en una celda caminable en todos los ticks, desde el de su aparición (ver "Posición de aparición fuera de
la vista" en `enemy-spawning`). El círculo del enemigo sí puede solapar en parte una celda no caminable (no hay
colisión física de los enemigos con el mapa).

#### Scenario: Semillas del conjunto
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en 7.200 ticks y,
  para cada semilla de 1 a 50, su mapa generado y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 7.200 ticks con cada semilla, con la política de elección fija
- **THEN** en ningún tick de ninguna semilla hay un enemigo vivo cuyo centro esté en una celda `trunk`, `water` o
  `castle`

#### Scenario: Jugador quieto junto al castillo
- **GIVEN** el contenido por defecto, la semilla 42, el jugador quieto en su salida (1.950, 1.170) con una vida
  suficiente para no llegar a 0 en 3.600 ticks y la política de elección fija
- **WHEN** se ejecutan 3.600 ticks
- **THEN** en ningún tick hay un enemigo vivo con el centro en una celda `castle`
- **AND** en algún tick hay ≥ 1 enemigo en contacto con el jugador

## MODIFIED Requirements

### Requirement: Persecución en línea recta
El sistema SHALL mover cada enemigo vivo que tiene línea libre (ver "Línea libre hasta el jugador") o cuyo centro está
en la misma celda que el centro del jugador, en cada tick de una partida en curso, una distancia
`velocidad del tipo × 1/60` en línea recta hacia el centro del jugador. Esa posición es la del jugador después de
aplicar su movimiento en ese mismo tick. Un enemigo MUST NOT sobrepasar el centro del jugador: si está a una
distancia ≤ `velocidad × 1/60`, termina exactamente en el centro del jugador. Un enemigo que ya está en el centro
del jugador no se mueve. Los enemigos dados de baja no se mueven, y su baja no altera la trayectoria de los demás.
Golpear al jugador MUST NOT cambiar la persecución del enemigo que golpea. Con el mapa vacío todos los enemigos
persiguen siempre así; los escenarios de este requisito usan el mapa vacío salvo que digan otra cosa. El resto de
enemigos vivos navega por el campo de flujo (ver "Navegación por el campo de flujo").

#### Scenario: Persecución horizontal durante un segundo
- **GIVEN** un jugador quieto en (480, 270) y un enemigo con velocidad 60 en (100, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (160, 270) con un error ≤ 0,001

#### Scenario: Persecución en diagonal
- **GIVEN** un jugador quieto en (480, 470) y un enemigo con velocidad 50 en (180, 70)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (210, 110) con un error ≤ 0,001

#### Scenario: Llegada sin sobrepasar
- **GIVEN** un jugador quieto en (480, 270) y un enemigo con velocidad 120 en (470, 270)
- **WHEN** se ejecutan 5 ticks y después 55 ticks más
- **THEN** tras 5 ticks el enemigo está en (480, 270) con un error ≤ 0,001
- **AND** tras 60 ticks sigue en (480, 270) con un error ≤ 0,001

#### Scenario: Persigue la posición del jugador en el mismo tick
- **GIVEN** un jugador en (480, 270) con velocidad 200 e input (1, 0), y un enemigo con velocidad 60 en (480, 470)
- **WHEN** se ejecuta 1 tick
- **THEN** el jugador está en (483,333, 270) y la x del enemigo es 480,0167 con un error ≤ 0,001

#### Scenario: Sigue hasta el centro tras golpear
- **GIVEN** un jugador quieto en (480, 270) con radio 16 y vida 100, y un enemigo con radio 10, velocidad 60 y
  damage 10 en (530, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el jugador ha recibido ≥ 1 golpe
- **AND** el enemigo está en (480, 270) con un error ≤ 0,001 y sigue vivo

#### Scenario: Un enemigo dado de baja deja de perseguir
- **GIVEN** un jugador quieto en (480, 270), un enemigo A con velocidad 60 en (100, 270) y un enemigo B con
  velocidad 60 en (100, 100)
- **WHEN** A queda dado de baja tras el tick 10 y se ejecutan 50 ticks más
- **THEN** A no aparece en el snapshot
- **AND** B está en la misma posición que en una partida idéntica en la que A no se da de baja

#### Scenario: Sin persecución con la partida terminada
- **GIVEN** una partida terminada con un enemigo vivo en (300, 270) y el jugador en (480, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo sigue exactamente en (300, 270)

#### Scenario: Ataque directo en la celda del jugador
- **GIVEN** un mapa de hierba con un tronco en (8, 4) (x en [480, 540], y en [240, 300]), un jugador quieto en
  (510, 330) (celda (8, 5), a 30 px del tronco) y un enemigo con velocidad 60 en (530, 350) (misma celda)
- **WHEN** se ejecuta 1 tick
- **THEN** el enemigo se ha movido 1 unidad (error ≤ 0,001) en línea recta hacia (510, 330)

### Requirement: Enemigos dentro de la arena
El sistema SHALL mantener el círculo de cada enemigo entero dentro de la arena (el mundo, ver `world-camera`) en todo
momento, tanto con línea libre como navegando por el campo: su centro MUST quedar en [radio, ancho − radio] ×
[radio, alto − radio], usando el radio del enemigo. Aplica la misma regla que al jugador. El tamaño de la vista MUST
NOT limitar a los enemigos.

#### Scenario: Enemigo más grande que el jugador junto a un borde
- **GIVEN** una arena de 1.920 × 1.080, un jugador quieto en (1.904, 540) con radio 16 y un enemigo con radio 22 y
  velocidad 120 en (1.860, 540)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (1.898, 540)

#### Scenario: Enemigo junto al borde inferior
- **GIVEN** una arena de 1.920 × 1.080, un jugador quieto en (960, 1.064) con radio 16 y un enemigo con radio 22 y
  velocidad 120 en (960, 1.020)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (960, 1.058)

#### Scenario: Persecución más allá del borde de la vista
- **GIVEN** una arena de 1.920 × 1.080, un jugador quieto en (1.500, 270) y un enemigo con velocidad 60 en
  (900, 270)
- **WHEN** se ejecutan 120 ticks
- **THEN** el enemigo está en (1.020, 270) con un error ≤ 0,001

#### Scenario: Partida larga
- **GIVEN** el contenido por defecto (mundo de 3.840 × 2.160, `maxAlive` 300) salvo una vida máxima del jugador
  suficiente para no llegar a 0 en 36.000 ticks, semilla 7 con su mapa generado y un input aleatorio generado por una
  semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick hay un enemigo cuyo centro quede fuera de [radio, 3.840 − radio] × [radio, 2.160 − radio]
- **AND** en ningún tick hay más de 300 enemigos vivos

### Requirement: Sin movimiento en el tick de aparición
El sistema SHALL mostrar a un enemigo, en el snapshot del tick en que aparece, en su posición de aparición, que es la
ya recolocada si su punto inicial cayó en una celda no caminable (ver "Posición de aparición fuera de la vista" en
`enemy-spawning`). Empieza a perseguir al jugador en el tick siguiente, con línea libre o por el campo.

#### Scenario: Primer tick de vida
- **GIVEN** una partida en la que un enemigo aparece en el tick n en la posición P
- **WHEN** se lee el snapshot del tick n
- **THEN** ese enemigo está exactamente en P
- **AND** en el snapshot del tick n + 1 su distancia a P es `velocidad × 1/60` con un error ≤ 0,001, salvo que
  haya llegado al centro del jugador o al centro de su siguiente celda, o el recorte a la arena lo haya frenado

#### Scenario: Aparición recolocada
- **GIVEN** el contenido por defecto, una semilla de 1..50 con su mapa generado y un enemigo cuyo punto de aparición
  inicial cae en una celda no caminable y se recoloca en la posición P (centro de una celda caminable)
- **WHEN** se lee el snapshot del tick de su aparición
- **THEN** ese enemigo está exactamente en P

## REMOVED Requirements

### Requirement: Los enemigos ignoran el mapa
Motivo: sustituido por "Línea libre hasta el jugador", "Navegación por el campo de flujo" y "Enemigos fuera de celdas
no caminables en el mapa generado" (deuda aceptada en 0015/ADR-0013 y saldada en este change). Sus escenarios dejan de
valer: "Persecución a través del agua" y "Persecución a través del castillo" pasan a "Cruce del río por el único
puente" y "Rodeo del castillo"; "Misma trayectoria con mapa generado y vacío" deja de cumplirse por diseño (la
igualdad con el mapa vacío solo se exige con línea libre).

<!-- historial: 0019-flow-field (pendiente de archivar) -->
