# Spec delta · enemy-behavior

<!-- Change 0021-goblin-camps. Estados de guardia de clase cerrada (patrulla, alerta y vuelta, D3 y D7) para el
     `goblin-tnt-guard`, navegación hacia un punto fijo y parámetros nuevos del barril (A3). El `goblin-tnt` de oleada
     conserva su artillero (sustituye la previsión D7 de 0020). Los escenarios sin mapa declarado usan el mapa vacío,
     ninguna arma equipada y el jugador con radio 16 y velocidad 215. "Guardia de prueba": un tipo con velocidad 60
     (1 px por tick), radio 22, daño por contacto 15, vida suficiente y este comportamiento: estado inicial de
     patrulla con radio de patrulla 60 y radio de detección 200, que lleva a alerta; alerta con distancia de
     lanzamiento 100 hacia una carga de 20 ticks (dinamita con vuelo de 40 ticks, radio 48 y daño 20) y radio de
     abandono 400 hacia la vuelta; espera de 60 ticks tras la carga, que vuelve a alerta; vuelta con radio de
     detección 200 hacia alerta y, al llegar, a patrulla. Su puesto es (1.000, 1.000) salvo que se diga otra cosa, y el
     jugador tiene vida suficiente. Los valores de contenido del guardia por defecto viven en `content/enemies.json` y
     esta spec solo fija sus cotas. Los parámetros del barril (activación 60, radio 80, mecha 40) son la candidata
     aprobada: si apply los recalibra, el escenario que los cita MUST actualizarse antes de verify. -->

## ADDED Requirements

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

## MODIFIED Requirements

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
