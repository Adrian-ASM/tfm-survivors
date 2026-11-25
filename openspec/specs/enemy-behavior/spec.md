# Enemy behavior · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Los enemigos persiguen al jugador a la velocidad de su tipo, sin salir de la arena, y cada tipo sigue el
comportamiento por estados que declara su contenido (persecución, mecha del barril, carga y espera del TNT).

## Requirements

### Requirement: Persecución en línea recta
El sistema SHALL mover cada enemigo vivo **en un estado de clase persecución** (ver "Estado de comportamiento de cada
enemigo") que tiene línea libre (ver "Línea libre hasta el jugador") o cuyo centro está en la misma celda que el
centro del jugador, en cada tick de una partida en curso, una distancia `velocidad del tipo × 1/60` en línea recta
hacia el centro del jugador. Esa posición es la del jugador después de aplicar su movimiento en ese mismo tick. Un
enemigo MUST NOT sobrepasar el centro del jugador: si está a una distancia ≤ `velocidad × 1/60`, termina exactamente
en el centro del jugador. Un enemigo que ya está en el centro del jugador no se mueve. Los enemigos dados de baja no
se mueven, y su baja no altera la trayectoria de los demás. Golpear al jugador MUST NOT cambiar la persecución del
enemigo que golpea. Un enemigo en mecha, carga o espera no se mueve. Con el mapa vacío todos los enemigos en
persecución persiguen siempre así; los escenarios de este requisito usan el mapa vacío y un tipo con un único estado
de persecución sin salida salvo que digan otra cosa. El resto de enemigos vivos en persecución navega por el campo
de flujo (ver "Navegación por el campo de flujo").

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

#### Scenario: Un enemigo en espera no persigue
- **GIVEN** un jugador quieto en (480, 270) y un enemigo con velocidad 60 en (100, 270) en un estado de espera de
  600 ticks
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo sigue exactamente en (100, 270)

### Requirement: Velocidad por tipo
El sistema SHALL mover cada enemigo en persecución a la velocidad de su tipo, definida en contenido. Dos enemigos en
persecución de tipos con distinta velocidad recorren distancias distintas en el mismo número de ticks.

#### Scenario: Dos tipos, dos velocidades
- **GIVEN** un jugador quieto en (900, 270), un `goblin-torch` con velocidad 90 en (100, 100) y un `goblin-tnt`
  con velocidad 45 en (100, 440)
- **WHEN** se ejecutan 60 ticks
- **THEN** el `goblin-torch` ha recorrido 90 unidades y el `goblin-tnt` 45, ambos con un error ≤ 0,001
- **AND** el `goblin-tnt` sigue en persecución en los 60 ticks (está a > 770 px del jugador, más que su distancia de
  lanzamiento por defecto, ≤ 360)

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

### Requirement: Sin separación entre enemigos
El sistema SHALL permitir que los enemigos se solapen entre sí y con el jugador. No hay separación, empuje,
*knockback* ni colisión física entre enemigos, ni entre enemigos y jugador: el contacto con el jugador solo
produce daño (ver `player-health`) y no cambia la posición de nadie.

#### Scenario: Dos enemigos idénticos se superponen
- **GIVEN** un jugador quieto en (480, 270) y dos enemigos del mismo tipo en (100, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** ambos enemigos tienen exactamente la misma posición

#### Scenario: El contacto no empuja al jugador
- **GIVEN** un jugador quieto en (480, 270) con vida 1.000 y 50 enemigos con velocidad 60 a ≤ 20
  unidades de su centro
- **WHEN** se ejecutan 60 ticks con input (0, 0)
- **THEN** el jugador sigue exactamente en (480, 270)
- **AND** todos los enemigos están en (480, 270) con un error ≤ 0,001

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

### Requirement: Un enemigo dañado sigue persiguiendo
El sistema SHALL mantener la persecución de un enemigo vivo en persecución tras recibir daño de cualquier arma o
explosión: su velocidad, su dirección hacia el jugador y su estado de comportamiento MUST ser los mismos que si no
hubiera recibido daño. Recibir daño no desplaza al enemigo.

#### Scenario: Misma trayectoria con y sin daño
- **GIVEN** dos partidas idénticas con un jugador quieto en (480, 270) y un `goblin-torch` de vida 10 en (380, 270), en
  las que en una el `goblin-torch` recibe un impacto del Linter en el tick n (vida 4) y en la otra no recibe daño
- **WHEN** se ejecutan los ticks n a n + 10
- **THEN** la posición del `goblin-torch` es la misma en ambas partidas en cada uno de esos ticks (error ≤ 0,001)

#### Scenario: El impacto no empuja
- **GIVEN** un `goblin-torch` en la posición P al terminar la persecución del tick n
- **WHEN** recibe un impacto del Linter o un pulso de Tests en el paso de armas del tick n
- **THEN** en el snapshot del tick n sigue exactamente en P

#### Scenario: La explosión no empuja
- **GIVEN** un `goblin-torch` con vida 50 en la posición P al terminar la persecución del tick n, dentro del radio de
  una explosión de daño 25 en el tick n
- **WHEN** se ejecuta el tick n y los 10 siguientes
- **THEN** en el snapshot del tick n sigue exactamente en P con vida 25
- **AND** en los ticks n + 1 a n + 10 su posición es la misma que en una partida idéntica sin explosión

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
la vista" en `enemy-spawning`), también en las celdas de los edificios construidos: al construir, un enemigo con el
centro en la huella se recoloca (ver "Huella despejada al construir" en `build-sites`) y después navega evitándola. El
círculo del enemigo sí puede solapar en parte una celda no caminable (no hay colisión física de los enemigos con el
mapa).

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

#### Scenario: Semillas del conjunto con edificios
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en 7.200 ticks y,
  para cada semilla de 1 a 50, su mapa generado con sus 6 solares construidos en el tick 1.800 (3 casas y 3 torres,
  escenario preparado) y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 7.200 ticks con cada semilla, con la política de elección fija
- **THEN** en ningún tick de ninguna semilla hay un enemigo vivo cuyo centro esté en una celda `trunk`, `water`,
  `castle` o construida

### Requirement: Comportamiento por tipo en contenido
El sistema SHALL leer el comportamiento de cada tipo de enemigo de `content/enemies.json`, validado con zod antes de
llegar al dominio. El comportamiento de un tipo es un **estado inicial** y una lista de **estados**, cada uno con un
nombre único dentro del tipo y una **clase** de este catálogo cerrado, con sus parámetros:
- **persecución**: el enemigo se mueve como en "Persecución en línea recta" y "Navegación por el campo de flujo".
  Puede tener una salida por distancia: una distancia > 0 y el estado de destino.
- **mecha**: el enemigo no se mueve. Tiene una duración (N ≥ 1 ticks), un radio de explosión > 0 y un daño de
  explosión > 0. No tiene estado de destino: al terminar, el enemigo explota y queda dado de baja (ver "Kamikaze del
  Goblin Barril").
- **carga**: el enemigo no se mueve. Tiene una duración (N ≥ 1 ticks), los parámetros de la dinamita que lanza al
  terminar (tiempo de vuelo N ≥ 1 ticks, radio de explosión > 0 y daño de explosión > 0, ver `enemy-hazards`) y el
  estado de destino tras lanzar.
- **espera**: el enemigo no se mueve. Tiene una duración (N ≥ 1 ticks) y el estado de destino.
- **patrulla**: el enemigo recorre los puntos de patrulla de su puesto (ver "Guardia del Goblin TNT"). Tiene un radio
  de patrulla > 0, un radio de detección > 0 y el estado de destino al detectar al jugador.
- **alerta**: el enemigo se mueve como en persecución. Tiene una salida por distancia (distancia de lanzamiento > 0 y
  estado de destino) y una salida por pérdida (radio de abandono > 0 y estado de destino).
- **vuelta**: el enemigo va a su puesto. Tiene un radio de detección > 0 y su estado de destino, y el estado de
  destino al llegar al puesto.

Un contenido inválido MUST impedir que la partida arranque, con un error que nombre el tipo y el campo, el estado o la
clase inválidos. Es inválido:
- una clase que no es del catálogo;
- un estado inicial ausente o que no es un estado del tipo;
- un estado de destino que no es un estado del tipo;
- dos estados con el mismo nombre en un tipo;
- una distancia, un radio o un daño ≤ 0, o ausentes cuando la clase los exige;
- una duración o un tiempo de vuelo que no equivale a un número entero de ticks ≥ 1;
- un campo desconocido en un estado;
- un tipo con algún estado de patrulla, alerta o vuelta cuyo estado inicial no es de clase patrulla (sin puesto no
  hay a dónde volver);
- en un tipo, un radio de abandono ≤ alguno de sus radios de detección.

Leer el comportamiento MUST NOT cambiar los stats del tipo (velocidad, radio, coste, vida, daño por contacto, XP).

#### Scenario: Comportamientos del contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** `goblin-torch` tiene un único estado, de clase persecución y sin salida, que es su estado inicial
- **AND** `goblin-barrel` empieza en un estado de persecución cuya salida por distancia lleva a un estado de mecha
- **AND** `goblin-tnt` empieza en un estado de persecución cuya salida por distancia lleva a un estado de carga, cuyo
  destino es un estado de espera, cuyo destino es el estado de persecución inicial
- **AND** `goblin-tnt-guard` empieza en un estado de patrulla que al detectar lleva a un estado de alerta; la salida
  por distancia de la alerta lleva a un estado de carga, cuyo destino es un estado de espera, cuyo destino es la
  alerta; la salida por pérdida lleva a un estado de vuelta, que al detectar lleva a la alerta y al llegar a la
  patrulla inicial

#### Scenario: Clase desconocida
- **GIVEN** el contenido por defecto con un estado de `goblin-barrel` de clase `teleport`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `goblin-barrel` y `teleport`
- **AND** no se crea ninguna partida

#### Scenario: Destino inexistente
- **GIVEN** el contenido por defecto con la salida del estado de persecución de `goblin-tnt` dirigida a un estado
  `hide` que el tipo no declara
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `goblin-tnt` y `hide`

#### Scenario: Estado inicial ausente o inexistente
- **GIVEN** el contenido por defecto con `goblin-torch` sin estado inicial, y en otro caso con un estado inicial
  `sleep` que no declara
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `goblin-torch` y el estado inicial, y `sleep` respectivamente

#### Scenario: Nombre de estado repetido
- **GIVEN** el contenido por defecto con dos estados de `goblin-tnt` con el mismo nombre
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `goblin-tnt` y ese nombre

#### Scenario: Parámetros no positivos
- **GIVEN** el contenido por defecto con, en un caso cada vez: la distancia de salida de la persecución de
  `goblin-barrel` 0 o −1; el radio de explosión de su mecha 0; el daño de explosión de su mecha −5; el radio de
  explosión de la dinamita de `goblin-tnt` 0; o el daño de esa dinamita ausente
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo y el tipo

#### Scenario: Duraciones inválidas
- **GIVEN** el contenido por defecto con, en un caso cada vez: la duración de la mecha de `goblin-barrel` 0 o
  negativa; la duración de la carga de `goblin-tnt` equivalente a 2,5 ticks; el tiempo de vuelo de su dinamita 0; o la
  duración de su espera ausente
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo y el tipo

#### Scenario: Duración mínima válida
- **GIVEN** el contenido por defecto con la duración de la mecha, de la carga, de la espera y el tiempo de vuelo
  equivalentes a 1 tick
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Parámetros de guardia inválidos
- **GIVEN** el contenido por defecto con, en un caso cada vez en `goblin-tnt-guard`: el radio de patrulla 0; el radio
  de detección de la patrulla −1; el radio de abandono de la alerta ausente; el radio de abandono igual a su radio de
  detección; o un campo extra `sightCone` en la patrulla
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `goblin-tnt-guard` y ese campo (o `sightCone`)

#### Scenario: Estados de guardia sin patrulla inicial
- **GIVEN** el contenido por defecto con `goblin-tnt-guard` cuyo estado inicial es su alerta, y en otro caso con
  `goblin-torch` con un estado extra de clase vuelta
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `goblin-tnt-guard` y `goblin-torch` respectivamente y el estado
  inicial

### Requirement: Estado de comportamiento de cada enemigo
El sistema SHALL dar a cada enemigo, al aparecer o nacer, el estado inicial de su tipo, y mantener su estado de
comportamiento mientras vive. Las transiciones son exactamente las del contenido:
- **Por distancia** (salida de una persecución o de una alerta): en el paso de comportamiento del tick, tras moverse,
  si la distancia entre el centro del enemigo y el del jugador (ya movido en ese tick) es ≤ la distancia de salida, el
  enemigo entra en el estado de destino en ese mismo tick. A distancia mayor, sigue en su estado.
- **Por detección** (patrulla y vuelta) y **por pérdida** (alerta): con la misma distancia y en el mismo momento,
  según "Guardia del Goblin TNT"; la llegada al puesto en vuelta, también.
- **Por tiempo**: un estado de carga o de espera en el que se entra en el tick t termina en el tick t + N (N su
  duración): la carga lanza en el paso de peligros de ese tick (ver "Artillero del Goblin TNT"); la espera pasa al
  estado de destino al empezar el paso de comportamiento de ese tick, y el enemigo actúa ya según el nuevo estado en
  ese tick. Una mecha en la que se entra en el tick t explota en el paso de peligros del tick t + N.

Un enemigo en mecha, carga o espera MUST NOT moverse. Un enemigo en persecución o en alerta se mueve como en
"Persecución en línea recta" y "Navegación por el campo de flujo"; uno en patrulla o en vuelta, como en "Navegación
hacia un punto fijo". Recibir daño (de armas o de explosiones) MUST NOT cambiar el estado ni el tiempo que lleva en él.
Cambiar de estado MUST NOT consumir azar ni depender de la vista, de la ventana ni del orden de la lista de enemigos.
Un enemigo en su tick de aparición o de nacimiento está en su estado inicial y no se mueve ni cambia de estado. El
snapshot expone el estado de cada enemigo vivo (ver `simulation-loop`).

#### Scenario: Estado inicial al aparecer
- **GIVEN** el contenido por defecto, un enemigo de cada tipo de oleada que aparece en el tick n y un
  `goblin-tnt-guard` que nace en una casa en el tick n
- **WHEN** se lee el snapshot del tick n
- **THEN** los de oleada están en el estado inicial de su tipo, de clase persecución, y el guardia en el suyo, de
  clase patrulla

#### Scenario: Salida por distancia justo en el límite
- **GIVEN** un tipo de prueba con velocidad 60, un estado inicial de persecución con salida a 100 px hacia un estado
  de espera de 600 ticks, un jugador quieto en (1.000, 1.000) y un enemigo de ese tipo en (1.101, 1.000)
- **WHEN** se ejecuta 1 tick (queda a 100 px) y, en otra partida con el enemigo en (1.101,5; 1.000), 1 tick (queda a
  100,5 px)
- **THEN** en la primera el enemigo está en el estado de espera en el snapshot del tick 1
- **AND** en la segunda sigue en persecución en el snapshot del tick 1

#### Scenario: El daño no cambia el estado
- **GIVEN** dos partidas idénticas con un `goblin-tnt` en carga desde el tick t, y en una recibe un impacto del
  Linter en el tick t + 1 que no lo mata
- **WHEN** se ejecutan los ticks t + 1 a t + 100
- **THEN** su estado de comportamiento y su posición son los mismos en ambas partidas en cada uno de esos ticks

#### Scenario: El daño no saca de la patrulla
- **GIVEN** dos partidas idénticas con el guardia de prueba en patrulla y el jugador a > 200 px durante 100 ticks, y
  en una el guardia recibe un impacto del Linter en el tick 10 que no lo mata
- **WHEN** se ejecutan los ticks 10 a 100
- **THEN** su estado y su posición son los mismos en ambas partidas en cada uno de esos ticks

### Requirement: Goblin Antorcha sin cambios
El sistema SHALL mantener al `goblin-torch` con un único estado de persecución sin salida: su movimiento, su contacto
y su daño por contacto son los de antes del change.

#### Scenario: Rodeo del castillo con el contenido por defecto
- **GIVEN** el contenido por defecto, el mapa de "Rodeo del castillo", un jugador quieto en (1.950, 1.170) con vida
  suficiente para no llegar a 0 en 660 ticks y un `goblin-torch` (velocidad 90) en (1.950, 870)
- **WHEN** se ejecutan 660 ticks
- **THEN** en ningún tick su centro está en una celda `castle` y llega a (1.950, 1.170) (error ≤ 0,001) en un tick
  > 200 y ≤ 440 (camino 4-vecino de 11 celdas a 1,5 px por tick)
- **AND** en ningún tick cambia de estado

### Requirement: Kamikaze del Goblin Barril
El sistema SHALL hacer que un enemigo cuyo comportamiento tiene una persecución con salida a una mecha (el
`goblin-barrel` con el contenido por defecto):
1. persiga al jugador mientras está en persecución;
2. entre en mecha en el tick t en que, tras moverse, queda a una distancia del jugador ≤ su distancia de activación
   (la distancia de salida de la persecución);
3. se quede quieto en su posición desde el tick t, con un aviso en el suelo centrado en esa posición y del radio de la
   explosión, visible en los snapshots de los ticks t a t + N − 1 (N la duración de la mecha);
4. explote en el paso de peligros del tick t + N con centro en su posición, el radio y el daño de su mecha (ver
   "Explosión de área" en `enemy-hazards`), y quede dado de baja en ese tick: suma 1 a las bajas y suelta su gema
   (ver `xp-gems`). No suelta nada más.

El barril que explota MUST NOT recibir daño de su propia explosión. Un barril que queda dado de baja por armas o por
una explosión ajena **antes** del paso de peligros del tick t + N (también durante la persecución o en un tick
anterior de la mecha) muere como cualquier enemigo (baja y gema) y MUST NOT explotar; su aviso deja de estar en el
snapshot de ese tick. El `goblin-barrel` MUST NOT hacer daño por contacto (ver `player-health`).

#### Scenario: Mecha y explosión con el jugador quieto
- **GIVEN** un tipo barril de prueba con velocidad 70, radio 16, vida 20, `xp` 2, sin daño por contacto, distancia de
  activación 40, mecha de 30 ticks, radio de explosión 56 y daño de explosión 25; un jugador quieto en (1.000, 1.000)
  con vida 100, no invulnerable, y un barril en (1.100, 1.000)
- **WHEN** se ejecutan 82 ticks
- **THEN** en el snapshot del tick 51 el barril está en persecución en (1.040,5; 1.000) (error ≤ 0,001)
- **AND** en los snapshots de los ticks 52 a 81 está en mecha, quieto en (1.039,333; 1.000) (error ≤ 0,001), con un
  aviso de radio 56 centrado en esa posición, y la vida del jugador vale 100
- **AND** en el snapshot del tick 82 el barril no figura, hay 1 explosión de radio 56 centrada en (1.039,333; 1.000),
  la vida del jugador vale 75, las bajas han subido en 1 y hay 1 gema nueva de valor 2 en (1.039,333; 1.000)

#### Scenario: Esquiva de la explosión del barril
- **GIVEN** la partida del escenario anterior hasta el tick 52 (barril en mecha) y, desde el tick 53, un jugador con
  velocidad 210 e input (−1, 0)
- **WHEN** se ejecuta hasta el tick 82
- **THEN** en el tick 82 el jugador está en (895, 1.000) (error ≤ 0,001), a 144,333 px del centro de la explosión
  (≥ 56 + 16), y su vida vale 100
- **AND** el barril ha explotado igualmente: las bajas han subido en 1 y hay 1 gema nueva

#### Scenario: Barril abatido durante la mecha no explota
- **GIVEN** la partida de "Mecha y explosión con el jugador quieto" en la que el barril queda a vida 0 por un
  impacto del Linter en el tick 70
- **WHEN** se ejecuta hasta el tick 120
- **THEN** en el snapshot del tick 70 el barril no figura, no hay aviso suyo, las bajas han subido en 1 y hay 1 gema
  nueva de valor 2
- **AND** en ningún tick de 70 a 120 hay una explosión ni la vida del jugador baja de 100

#### Scenario: Barril abatido en el mismo tick en que terminaría la mecha
- **GIVEN** la partida de "Mecha y explosión con el jugador quieto" en la que el barril queda a vida 0 por un
  impacto del Linter en el tick 82
- **WHEN** se ejecuta el tick 82
- **THEN** no hay ninguna explosión, la vida del jugador vale 100, las bajas han subido en 1 y hay 1 gema nueva

#### Scenario: Barril que ya está dentro al aparecer en el escenario
- **GIVEN** el barril de prueba de "Mecha y explosión con el jugador quieto" colocado en (1.030, 1.000), a 30 px del
  jugador quieto
- **WHEN** se ejecuta 1 tick
- **THEN** en el snapshot del tick 1 está en mecha en (1.028,833; 1.000) (error ≤ 0,001): se ha movido en el tick 1
  y ha entrado en mecha tras moverse

#### Scenario: El barril no golpea por contacto
- **GIVEN** el barril de prueba de "Mecha y explosión con el jugador quieto" colocado en el centro del jugador
  quieto, (1.000, 1.000), con el jugador a vida 100
- **WHEN** se ejecutan 31 ticks
- **THEN** en los snapshots de los ticks 1 a 30 el barril está en mecha en (1.000, 1.000), la vida del jugador vale
  100 y no está invulnerable
- **AND** en el snapshot del tick 31 el barril ha explotado y la vida del jugador vale 75

#### Scenario: Sin contacto del barril por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** `goblin-barrel` no tiene daño por contacto

### Requirement: Artillero del Goblin TNT
El sistema SHALL hacer que un enemigo cuyo comportamiento tiene una persecución con salida a una carga (el
`goblin-tnt` con el contenido por defecto):
1. persiga al jugador mientras está en persecución;
2. entre en carga en el tick t en que, tras moverse, queda a una distancia del jugador ≤ su distancia de lanzamiento
   (la distancia de salida de la persecución), y se quede quieto;
3. en el paso de peligros del tick t + A (A la duración de la carga), si sigue vivo y hay sitio bajo el tope de
   dinamitas (ver `enemy-hazards`), lance una dinamita desde su posición hacia la posición del jugador en ese tick
   (tras su movimiento) y entre en espera en ese tick. Lanza aunque el jugador ya esté más lejos que la distancia de
   lanzamiento;
4. si en ese tick no hay sitio, siga en carga, quieto, y lance en el paso de peligros del primer tick posterior en que
   haya sitio, con la posición del jugador de ese tick;
5. tras una espera de C ticks en la que entró en el tick s, vuelva a persecución al empezar el paso de comportamiento
   del tick s + C, se mueva en ese tick y pueda volver a entrar en carga en ese mismo tick.

El `goblin-tnt` conserva su daño por contacto en todos sus estados. Un `goblin-tnt` que queda dado de baja antes del
paso de peligros del tick en que lanzaría MUST NOT lanzar. Las dinamitas ya lanzadas siguen su vuelo aunque su
lanzador muera.

#### Scenario: Ciclo completo de lanzamiento
- **GIVEN** un tipo TNT de prueba con velocidad 45, radio 22, vida 45, daño por contacto 15, distancia de lanzamiento
  200, carga de 20 ticks, dinamita con vuelo de 40 ticks, radio 48 y daño 20, y espera de 60 ticks; un jugador quieto
  en (1.000, 1.000) con vida suficiente y un TNT en (1.300, 1.000); tope de dinamitas ≥ 1
- **WHEN** se ejecutan 234 ticks
- **THEN** el TNT entra en carga en el tick 134, en (1.199,5; 1.000) (error ≤ 0,001), y no se mueve en los ticks 135
  a 213
- **AND** en el snapshot del tick 154 hay 1 dinamita nueva con origen (1.199,5; 1.000) y objetivo (1.000, 1.000), y
  el TNT está en espera
- **AND** en el tick 214 el TNT vuelve a persecución, está en (1.198,75; 1.000) (error ≤ 0,001) y entra de nuevo en
  carga en ese tick
- **AND** en el snapshot del tick 234 hay 1 dinamita nueva más

#### Scenario: Objetivo fijado al lanzar
- **GIVEN** la partida del escenario anterior y un jugador que, desde el tick 155, se mueve con input (0, 1)
- **WHEN** se ejecuta hasta el tick 193
- **THEN** la dinamita lanzada en el tick 154 conserva el objetivo (1.000, 1.000) en todos los snapshots de 154 a 193

#### Scenario: TNT abatido durante la carga no lanza
- **GIVEN** la partida de "Ciclo completo de lanzamiento" en la que el TNT queda a vida 0 por armas en el tick 154
- **WHEN** se ejecuta el tick 154
- **THEN** el snapshot del tick 154 no contiene ninguna dinamita y el TNT no figura

#### Scenario: Lanza aunque el jugador se aleje durante la carga
- **GIVEN** la partida de "Ciclo completo de lanzamiento" y un jugador con velocidad 210 que, desde el tick 135, se
  mueve con input (−1, 0)
- **WHEN** se ejecuta el tick 154
- **THEN** hay 1 dinamita nueva cuyo objetivo es la posición del jugador en el tick 154, (930, 1.000) (error
  ≤ 0,001; 20 ticks a 3,5 px), a 269,5 px del TNT, más que su distancia de lanzamiento

### Requirement: Comportamiento por defecto legible y esquivable
El sistema SHALL cumplir con el contenido por defecto, sea cual sea la calibración del balance:
- la distancia de activación del `goblin-barrel` es < el radio de su explosión;
- la duración de su mecha, en ticks, es ≥ ⌈(radio de explosión + radio del jugador − distancia de activación) /
  (`player.speed` / 60)⌉: un jugador sin mejoras que huye en línea recta sin obstáculos desde el inicio de la mecha
  sale del radio avisado antes de la explosión;
- la distancia de lanzamiento del `goblin-tnt` y la del `goblin-tnt-guard` son > radio de su tipo + radio del jugador
  (se detienen antes de tocarlo) y ≤ 360 (con el jugador en el centro de una ventana de 1.280 × 720 sin recorte de
  cámara, el lanzador se ve en pantalla);
- el tiempo de vuelo de la dinamita de cada uno, en ticks, es ≥ ⌈(radio de explosión de la dinamita + radio del
  jugador) / (`player.speed` / 60)⌉: un jugador sin mejoras en el objetivo puede salir del radio avisado;
- los radios de detección del `goblin-tnt-guard` son ≤ 360 (el guardia que entra en alerta se ve en pantalla, con la
  misma ventana) y < su radio de abandono.

#### Scenario: Cotas del contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido y se evalúan las cotas con `player.speed` y el radio del jugador del contenido
- **THEN** todas se cumplen

#### Scenario: Esquiva con el contenido por defecto
- **GIVEN** el contenido por defecto en el mapa vacío, un jugador con vida suficiente en el objetivo de una dinamita
  recién lanzada por un `goblin-tnt`, en otra partida por un `goblin-tnt-guard`, y en otra un jugador a la distancia
  de activación de un `goblin-barrel` que acaba de entrar en mecha
- **WHEN** desde el tick siguiente al lanzamiento (o a la entrada en mecha) el jugador se mueve en línea recta
  alejándose del centro del aviso, sin obstáculos ni mejoras, hasta el tick de la explosión
- **THEN** en las tres partidas la explosión no le hace daño

#### Scenario: Parámetros del barril por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** la distancia de activación de `goblin-barrel` es 60, el radio de su explosión 80 y su mecha dura 40 ticks
- **AND** 40 ≥ ⌈(80 + 16 − 60) / (215 / 60)⌉ = 11 y 60 < 80

### Requirement: Navegación hacia un punto fijo
El sistema SHALL mover a un enemigo vivo que se dirige a un **punto fijo** Q (un punto de patrulla o su puesto, ver
"Guardia del Goblin TNT") con las mismas reglas que la persecución del jugador, cambiando el centro del jugador por Q:
- si el segmento entre su centro y Q tiene línea libre (con la regla de "Línea libre hasta el jugador") o su centro
  está en la misma celda que Q, recorre `velocidad del tipo × 1/60` en línea recta hacia Q;
- si no, sigue el campo de distancias de la celda de Q (ver "Campo de distancias hacia una celda" en
  `procedural-map`) hacia el centro de su siguiente celda, con la regla de vecinos y empates de "Navegación por el
  campo de flujo";
- si su celda no tiene distancia en ese campo, va en línea recta hacia Q.

En ningún caso MUST sobrepasar Q ni el centro de su siguiente celda: si está a una distancia ≤ `velocidad × 1/60`,
termina exactamente en él y el resto del paso se pierde en ese tick. Un enemigo que está exactamente en Q no se mueve.
Navegar hacia un punto MUST NOT consumir azar, cambiar el mapa ni depender de la ventana, de la posición del jugador
ni del orden de la lista de enemigos. Con el mapa vacío el movimiento es siempre en línea recta.

#### Scenario: Línea recta hasta el punto
- **GIVEN** el guardia de prueba en vuelta en (1.300, 1.000) y un jugador quieto en (3.000, 1.000)
- **WHEN** se ejecutan 299 ticks y después 1 tick más
- **THEN** tras 299 ticks está en (1.001, 1.000) y tras 300 en (1.000, 1.000), ambos con error ≤ 0,001

#### Scenario: Rodeo de un muro hasta el puesto
- **GIVEN** un mapa de hierba con troncos en las celdas (10, 2) a (10, 6) (x en [600, 660], y en [120, 420]), el
  guardia de prueba con puesto (930, 270) en vuelta en (330, 270) y un jugador quieto en (3.000, 2.000)
- **WHEN** se ejecutan 1.200 ticks
- **THEN** en ningún tick el centro del guardia está en una celda `trunk`
- **AND** llega a (930, 270) (error ≤ 0,001) en un tick entre 601 y 960, ambos incluidos

### Requirement: Guardia del Goblin TNT
El sistema SHALL hacer que un enemigo cuyo comportamiento empieza en un estado de patrulla (el `goblin-tnt-guard` con
el contenido por defecto) guarde un **puesto** fijo durante toda su vida: la puerta de la casa en la que nace (ver
"Nacimiento de guardias en casas" en `enemy-spawning`), o el que fije el escenario. Sus estados son:
1. **Patrulla**: recorre en bucle, en este orden, los **puntos de patrulla** de su puesto (x, y) con radio de
   patrulla r: (x − r, y − r), (x + r, y − r), (x + r, y + r) y (x − r, y + r). Cada punto se recorta al mundo con la
   regla de "Enemigos dentro de la arena" y, si queda en una celda no caminable, se recoloca en el centro de la celda
   caminable más cercana con el criterio de "Recolocación de gemas en celdas no caminables" de `xp-gems`. Los puntos
   no cambian durante la partida. Al entrar en patrulla se dirige al primer punto; en el tick en que llega exactamente
   a un punto, en el siguiente tick se dirige al siguiente (tras el cuarto, al primero). Se mueve con "Navegación hacia
   un punto fijo".
2. **Alerta**: se mueve exactamente como un enemigo en persecución (ver "Persecución en línea recta" y "Navegación por
   el campo de flujo").
3. **Vuelta**: se dirige a su puesto con "Navegación hacia un punto fijo".

Transiciones, en el paso de comportamiento del tick y tras moverse, con la distancia entre su centro y el del jugador
(ya movido en ese tick):
- en patrulla, si la distancia es ≤ su radio de detección, entra en alerta;
- en alerta, si la distancia es ≤ su distancia de lanzamiento, entra en carga (ciclo de "Artillero del Goblin TNT":
  carga, lanzamiento y espera), y su espera termina en alerta; si no, y la distancia es > su radio de abandono, entra
  en vuelta;
- en vuelta, si la distancia es ≤ su radio de detección, entra en alerta; si no, y está exactamente en su puesto,
  entra en patrulla.

Un guardia en carga o espera no se mueve. Conserva su daño por contacto en todos sus estados. Ningún estado ni
transición MUST consumir azar ni depender de la vista, de la ventana ni del orden de la lista de enemigos. Las
estructuras no influyen en su movimiento (ver "Estructuras sin colisión" en `goblin-structures`), y destruir su casa
no cambia su puesto ni su estado.

#### Scenario: Patrulla en el mapa vacío
- **GIVEN** el guardia de prueba en patrulla en su puesto (1.000, 1.000) en el tick 0 y un jugador quieto en
  (3.000, 1.000)
- **WHEN** se ejecutan 565 ticks
- **THEN** está exactamente en (940, 940) en el tick 85, en (1.060, 940) en el 205, en (1.060, 1.060) en el 325, en
  (940, 1.060) en el 445 y de nuevo en (940, 940) en el 565 (error ≤ 0,001)
- **AND** sigue en patrulla en todos los ticks y su centro nunca sale del cuadrado (940, 940)–(1.060, 1.060)

#### Scenario: Punto de patrulla recolocado
- **GIVEN** un mapa de hierba con un tronco en (15, 15) (x en [900, 960], y en [900, 960]), el guardia de prueba en
  patrulla en su puesto (1.000, 1.000) y un jugador quieto en (3.000, 1.000)
- **WHEN** se ejecutan 600 ticks
- **THEN** su primer punto de patrulla es (990, 930), centro de la celda (16, 15): empata a 50,99 px con la (15, 16) y
  gana por fila menor; llega a él exactamente en algún tick
- **AND** en ningún tick su centro está en la celda (15, 15)

#### Scenario: Detección justo en el límite
- **GIVEN** el guardia de prueba en patrulla en su puesto (1.000, 1.000) y un jugador quieto en (1.000, 1.199)
- **WHEN** se ejecuta 1 tick (el guardia queda en (999,293; 999,293), a 199,708 px)
- **THEN** está en alerta en el snapshot del tick 1
- **AND** con el jugador quieto en (1.000, 1.202) (queda a 202,708 px) sigue en patrulla en el snapshot del tick 1

#### Scenario: Alerta, lanzamiento y vuelta a la alerta
- **GIVEN** el guardia de prueba en alerta en (1.150, 1.000), un jugador quieto en (1.000, 1.000) y tope de dinamitas
  ≥ 1
- **WHEN** se ejecutan 130 ticks
- **THEN** entra en carga en el tick 50, en (1.100, 1.000), y en el snapshot del tick 70 hay 1 dinamita nueva con
  origen (1.100, 1.000) y objetivo (1.000, 1.000), y el guardia está en espera
- **AND** en el tick 130 vuelve a alerta, se mueve a (1.099, 1.000) (error ≤ 0,001) y entra de nuevo en carga
- **AND** en ningún tick de 1 a 130 está en patrulla ni en vuelta

#### Scenario: Abandono de la alerta
- **GIVEN** el guardia de prueba en alerta en (1.000, 1.000) y un jugador en (1.300, 1.000) que se mueve con input
  (1, 0) desde el tick 1
- **WHEN** se ejecutan 39 ticks
- **THEN** en el snapshot del tick 38 sigue en alerta (a 398,167 px) y en el del tick 39 está en vuelta (a 400,75 px)

#### Scenario: Llegada al puesto
- **GIVEN** el guardia de prueba en vuelta en (1.300, 1.000) y un jugador quieto en (3.000, 1.000)
- **WHEN** se ejecutan 301 ticks
- **THEN** en el snapshot del tick 299 está en vuelta y en el del tick 300 está en patrulla en (1.000, 1.000)
- **AND** en el tick 301 se ha movido 1 px (error ≤ 0,001) hacia (940, 940)

#### Scenario: Detección durante la vuelta
- **GIVEN** el guardia de prueba en vuelta en (1.300, 1.000) y un jugador quieto en (1.150, 1.000)
- **WHEN** se ejecuta 1 tick
- **THEN** está en alerta en el snapshot del tick 1

#### Scenario: Guardia que nace en la puerta
- **GIVEN** una casa explícita con puerta (1.290, 810) que hace nacer un `goblin-tnt-guard` en el tick n
- **WHEN** se leen los snapshots de n y n + 1
- **THEN** en el de n el guardia está en (1.290, 810) en su estado inicial de patrulla
- **AND** en el de n + 1 se ha movido hacia su primer punto de patrulla, derivado del puesto (1.290, 810)

#### Scenario: Guardias en celdas caminables
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en 7.200 ticks y,
  para cada semilla de 1 a 50, su mapa generado, un input aleatorio generado por una semilla fija y la política de
  elección fija
- **WHEN** se ejecutan 7.200 ticks con cada semilla
- **THEN** en ningún tick de ninguna semilla hay un `goblin-tnt-guard` vivo con el centro en una celda `trunk`,
  `water` o `castle`

#### Scenario: Los estados de guardia no consumen azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una hay 5 guardias que patrullan, entran en
  alerta o vuelven en el tick n
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

### Requirement: Navegación con edificios construidos
El sistema SHALL aplicar "Línea libre hasta el jugador", "Navegación por el campo de flujo" y "Navegación hacia un punto
fijo" con las celdas de los edificios construidos como no caminables (ver "Edificios que bloquean el paso" en
`build-sites`), desde el primer tick ejecutado tras la construcción: el campo hacia la celda del jugador y los campos
hacia los puntos fijos de los guardias tienen en cuenta todos los edificios construidos hasta ese momento. Un enemigo
que no tiene línea libre por un edificio rodea el edificio por el campo. Con el mismo mapa y los mismos edificios, el
movimiento MUST ser el mismo sea cual sea el tick en que se construyeron. Nada de esto consume azar.

#### Scenario: El campo se recalcula y el enemigo rodea
- **GIVEN** el solar de prueba (`build-sites`) con la casa construida en el tick n, un jugador quieto en P y un
  `goblin-torch` en E que antes del tick n tenía línea libre a través de la huella
- **WHEN** se ejecutan 1.200 ticks desde el n + 1
- **THEN** el enemigo no tiene línea libre en el tick n + 1, en ningún tick su centro está en una celda de la huella y
  llega a P (error ≤ 0,001)

#### Scenario: El guardia vuelve rodeando el edificio
- **GIVEN** el mapa vacío, el guardia de prueba en vuelta con su puesto Q y el solar de prueba con una torre construida
  cuya huella corta el segmento entre el guardia y Q, y un jugador quieto a > 1.000 px
- **WHEN** se ejecutan 1.200 ticks
- **THEN** en ningún tick el centro del guardia está en una celda de la huella y llega a Q (error ≤ 0,001)

#### Scenario: Mismo movimiento con la misma obra en otro momento
- **GIVEN** dos partidas iguales en el tick 2.000 con los mismos enemigos, el mismo jugador y la misma casa construida
  en el mismo solar, construida en una en el tick 500 y en la otra en el tick 1.500 (escenario preparado)
- **WHEN** ambas ejecutan 600 ticks con el mismo input
- **THEN** las posiciones de los enemigos son iguales en cada tick

<!-- historial: 0002-enemy-spawning (2026-11-19) -->
<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0015-procedural-map (2026-11-23) -->
<!-- historial: 0016-map-art (2026-11-23) -->
<!-- historial: 0019-flow-field (2026-11-24) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
<!-- historial: 0026-build-sites (2026-11-25) -->
