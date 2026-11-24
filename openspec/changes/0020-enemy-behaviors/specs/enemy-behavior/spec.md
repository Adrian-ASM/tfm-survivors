# Spec delta · enemy-behavior

<!-- Change 0020-enemy-behaviors. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables.
     Convenciones de este delta:
     - Un "tick" es 1/60 s. Una duración de N ticks de un estado en el que se entra en el tick t termina en el tick
       t + N (ver cada clase).
     - Los nombres de los campos de contenido los fija el design; aquí se nombran por su significado.
     - Los escenarios con un enemigo genérico ("un enemigo con velocidad 60") usan un tipo cuyo comportamiento es un
       único estado de persecución sin salida (como `goblin-torch`), salvo que digan otra cosa.
     - Los escenarios con posiciones explícitas y sin mapa declarado usan el mapa vacío y ninguna arma equipada salvo
       que digan otra cosa. El jugador tiene radio 16. -->

## ADDED Requirements

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

Un contenido inválido MUST impedir que la partida arranque, con un error que nombre el tipo y el campo, el estado o la
clase inválidos. Es inválido:
- una clase que no es del catálogo;
- un estado inicial ausente o que no es un estado del tipo;
- un estado de destino que no es un estado del tipo;
- dos estados con el mismo nombre en un tipo;
- una distancia, un radio o un daño ≤ 0, o ausentes cuando la clase los exige;
- una duración o un tiempo de vuelo que no equivale a un número entero de ticks ≥ 1;
- un campo desconocido en un estado.

Leer el comportamiento MUST NOT cambiar los stats del tipo (velocidad, radio, coste, vida, daño por contacto, XP).

#### Scenario: Comportamientos del contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** `goblin-torch` tiene un único estado, de clase persecución y sin salida, que es su estado inicial
- **AND** `goblin-barrel` empieza en un estado de persecución cuya salida por distancia lleva a un estado de mecha
- **AND** `goblin-tnt` empieza en un estado de persecución cuya salida por distancia lleva a un estado de carga, cuyo
  destino es un estado de espera, cuyo destino es el estado de persecución inicial

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

### Requirement: Estado de comportamiento de cada enemigo
El sistema SHALL dar a cada enemigo, al aparecer, el estado inicial de su tipo, y mantener su estado de
comportamiento mientras vive. Las transiciones son exactamente las del contenido:
- **Por distancia** (salida de una persecución): en el paso de comportamiento del tick, tras moverse, si la distancia
  entre el centro del enemigo y el del jugador (ya movido en ese tick) es ≤ la distancia de salida, el enemigo entra
  en el estado de destino en ese mismo tick. A distancia mayor, sigue en persecución.
- **Por tiempo**: un estado de carga o de espera en el que se entra en el tick t termina en el tick t + N (N su
  duración): la carga lanza en el paso de peligros de ese tick (ver "Artillero del Goblin TNT"); la espera pasa al
  estado de destino al empezar el paso de comportamiento de ese tick, y el enemigo actúa ya según el nuevo estado en
  ese tick. Una mecha en la que se entra en el tick t explota en el paso de peligros del tick t + N.

Un enemigo en mecha, carga o espera MUST NOT moverse. Un enemigo en persecución se mueve como en "Persecución en línea
recta" y "Navegación por el campo de flujo". Recibir daño (de armas o de explosiones) MUST NOT cambiar el estado ni
el tiempo que lleva en él. Cambiar de estado MUST NOT consumir azar ni depender de la vista, de la ventana ni del
orden de la lista de enemigos. Un enemigo en su tick de aparición está en su estado inicial y no se mueve ni cambia
de estado. El snapshot expone el estado de cada enemigo vivo (ver `simulation-loop`).

#### Scenario: Estado inicial al aparecer
- **GIVEN** el contenido por defecto y un enemigo de cada tipo que aparece en el tick n
- **WHEN** se lee el snapshot del tick n
- **THEN** cada uno está en el estado inicial de su tipo, de clase persecución

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
- la distancia de lanzamiento del `goblin-tnt` es > radio del `goblin-tnt` + radio del jugador (se detiene antes de
  tocarlo) y ≤ 360 (con el jugador en el centro de una ventana de 1.280 × 720 sin recorte de cámara, el lanzador se ve
  en pantalla);
- el tiempo de vuelo de su dinamita, en ticks, es ≥ ⌈(radio de explosión de la dinamita + radio del jugador) /
  (`player.speed` / 60)⌉: un jugador sin mejoras en el objetivo puede salir del radio avisado.

#### Scenario: Cotas del contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido y se evalúan las cuatro cotas con `player.speed` y el radio del jugador del contenido
- **THEN** las cuatro se cumplen

#### Scenario: Esquiva con el contenido por defecto
- **GIVEN** el contenido por defecto en el mapa vacío, un jugador con vida suficiente en el objetivo de una dinamita
  recién lanzada por un `goblin-tnt`, y en otra partida un jugador a la distancia de activación de un `goblin-barrel`
  que acaba de entrar en mecha
- **WHEN** desde el tick siguiente al lanzamiento (o a la entrada en mecha) el jugador se mueve en línea recta
  alejándose del centro del aviso, sin obstáculos ni mejoras, hasta el tick de la explosión
- **THEN** en ambas partidas la explosión no le hace daño

## MODIFIED Requirements

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

## REMOVED Requirements

<!-- Ninguno. -->
