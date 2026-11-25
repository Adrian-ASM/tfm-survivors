# Sheep · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Las ovejas neutrales del mapa generado: deambulan, huyen del jugador, las dañan las armas y las explosiones, al
morir sueltan carne (ver `resources` y `player-health`) y reaparecen con el tiempo. No cuentan como bajas.

**Oveja de prueba** (valores de escenario, no del contenido por defecto), usada por los escenarios de esta spec y
de otras specs vivas que la citan: radio 20, vida 12, velocidad de paseo 60 px/s (1 px/tick), velocidad de
huida 180 px/s (3 px/tick), radio de huida 200, duración de paseo 60 ticks, duración de pasto 120 ticks, radio de
pasto 300, intervalo de reaparición 600 ticks y distancia mínima de reaparición al jugador 500. Salvo que se diga
otra cosa, la oveja de prueba se declara en el mapa vacío en (1.000, 1.000) (celda (16, 16), x en [960, 1.020],
y en [960, 1.020]) y el jugador (radio 16) está quieto en la salida del mapa vacío, (1.920, 1.080), a 923,47 px.
"Distancia" es entre centros. La **oveja quieta de prueba** es la misma con radio de huida 50, y en los ticks del
escenario está en pasto.

## Requirements

### Requirement: Contenido de las ovejas validado
El sistema SHALL leer de `content/*.json`, validados con zod antes de llegar al dominio, los parámetros de las ovejas:
- el **tope de ovejas vivas** por partida con el mapa generado: entero ≥ 0;
- el **radio** de la oveja (su círculo de colisión con el mapa y de impacto de armas y explosiones): número > 0;
- la **vida** de la oveja: entero ≥ 1;
- la **velocidad de paseo** y la **velocidad de huida**, en px/s: números > 0;
- el **radio de huida**: número > 0;
- la **duración de paseo** y la **duración de pasto**, en ticks: enteros ≥ 1;
- el **radio de pasto**: número > 0;
- el **intervalo de reaparición**, en ticks: entero ≥ 1;
- la **distancia mínima de reaparición al jugador**, en px: número ≥ 0;
- los **parámetros de colocación** inicial (ver "Ovejas en el mapa generado" en `procedural-map`): distancia mínima a
  la zona de inicio, distancia mínima al castillo y separación mínima entre ovejas, enteros ≥ 0, en celdas.

Un valor fuera de rango, un campo ausente o un campo desconocido MUST impedir que se muestre el menú o empiece una
partida, con un error que nombre el campo. Los números de este contenido no se fijan en esta spec salvo el tope por
defecto, que es 4 o 5 (se fija en apply con el balance, ver "Balance con las ovejas y la carne").

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito y el tope de ovejas vivas vale 4 o 5
- **AND** la vida es un entero ≥ 1, las duraciones y el intervalo son enteros ≥ 1 y el radio, las velocidades, el
  radio de huida y el radio de pasto son > 0

#### Scenario: Valores fuera de rango
- **GIVEN** el contenido por defecto con, en un caso cada vez: el tope −1 o 2,5; el radio 0; la vida 0 o 7,5; la
  velocidad de paseo 0; la velocidad de huida −30; el radio de huida 0; la duración de paseo 0; la duración de pasto
  12,5; el radio de pasto 0; el intervalo de reaparición 0; la distancia mínima de reaparición −1; o la separación
  mínima entre ovejas −1
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: el tope 0; la vida 1; las dos duraciones y el
  intervalo a 1; la distancia mínima de reaparición 0; o las tres distancias de colocación a 0
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Campos ausentes o desconocidos
- **GIVEN** el contenido por defecto sin el radio de huida, en otro caso sin el intervalo de reaparición, y en otro
  con un campo extra `contactDamage: 5`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el radio de huida, el intervalo de reaparición y `contactDamage`
  respectivamente

### Requirement: Ovejas de la partida
El sistema SHALL llevar en cada partida una **lista de ovejas vivas**, separada de la de enemigos y de la de
estructuras. Al crear la partida, la lista tiene las ovejas que coloca el mapa generado (ver "Ovejas en el mapa
generado" en `procedural-map`) o las que declara un mapa explícito (ver "Mapa explícito y mapa vacío" en
`procedural-map`), en ese orden; el mapa vacío no tiene ovejas. Cada oveja tiene:
- un **identificador** único en la partida, de una secuencia propia de las ovejas (independiente de la de enemigos y de
  la de recogibles), que no cambia mientras vive y no se reutiliza;
- su **posición**, su **radio** y su **vida** actual (al crearse, la vida del contenido);
- su **punto de origen**: la posición en la que se crea (colocación, declaración o reaparición);
- su **estado**: `graze` (pasto), `wander` (paseo) o `flee` (huida).

Las ovejas no pasan por el director de oleadas: no consumen presupuesto, no cuentan para `maxAlive` ni para ningún
tope de enemigos, y el director no las crea. La lista va en orden de creación; una oveja muerta sale de ella sin
cambiar el orden relativo de las demás y una reaparecida entra al final. En ningún tick hay más ovejas vivas que el tope
de ovejas vivas (con el mapa generado) o que las declaradas (con un mapa explícito).

#### Scenario: Ovejas al crear la partida
- **GIVEN** el contenido por defecto y la semilla 42 con su mapa generado
- **WHEN** se lee el snapshot del tick 0
- **THEN** la lista de ovejas tiene exactamente el tope de ovejas vivas del contenido, con identificadores distintos,
  cada una con la vida del contenido, en estado `graze` y con su punto de origen en su posición
- **AND** la lista de enemigos está vacía y el contador de bajas vale 0

#### Scenario: Mapa vacío sin ovejas
- **GIVEN** el contenido por defecto, la semilla 42 y el mapa vacío
- **WHEN** se ejecutan 3.600 ticks
- **THEN** la lista de ovejas está vacía en todos los snapshots

#### Scenario: Nunca más que el tope
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en 36.000 ticks,
  la semilla 7 con su mapa generado, un input aleatorio generado por una seed fija y la política de elección fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún snapshot hay más ovejas vivas que el tope de ovejas vivas
- **AND** ningún identificador de oveja se repite entre ovejas distintas a lo largo de la partida

#### Scenario: Muerte sin reordenar
- **GIVEN** tres ovejas o1, o2 y o3 vivas, en ese orden
- **WHEN** o2 muere en el tick n
- **THEN** la lista del snapshot del tick n es o1, o3, en ese orden
- **AND** cuando o2 reaparece, la lista es o1, o3, o4, con o4 un identificador nuevo

### Requirement: Movimiento de las ovejas por el mapa
El sistema SHALL mover cada oveja viva, cuando su estado la desplaza (paseo o huida), con la misma regla de colisión
que el jugador (ver "Colisión con el mapa" y "Límites de la arena" en `player-movement`), aplicada a su círculo y a su
radio: su círculo MUST NOT solapar ninguna celda no caminable (`trunk`, `water` o `castle`) ni salir de los límites del
mundo, desliza a lo largo de las caras, no rebota y no pasa entre dos celdas no caminables que solo se tocan por una
esquina. Las celdas `bridge` son caminables para la oveja. Las estructuras, las vetas y los recogibles no la bloquean.
Una oveja que queda tangente a una pared y sigue empujando contra ella se queda quieta en esa componente (puede quedar
atascada; es aceptable). Mover las ovejas MUST NOT consumir azar.

#### Scenario: Ninguna oveja solapa el mapa
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en 36.000 ticks,
  la semilla 7 con su mapa generado, un input aleatorio generado por una seed fija y la política de elección fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún snapshot el círculo de una oveja solapa una celda `trunk`, `water` o `castle` ni su centro queda a
  menos de su radio de un borde del mundo

#### Scenario: Huida contra un tronco
- **GIVEN** la oveja de prueba en un mapa de hierba con un tronco en (15, 16) (x en [900, 960], y en [960, 1.020]) y
  el jugador quieto en (1.100, 1.000) (distancia 100 < 200)
- **WHEN** se ejecutan 60 ticks
- **THEN** la oveja está en (980, 1.000) (error ≤ 0,001), tangente a la cara derecha del tronco, desde el tick 7 hasta
  el 60, y en ningún tick lo solapa
- **AND** su estado es `flee` en los 60 snapshots

#### Scenario: El puente es caminable para la oveja
- **GIVEN** la oveja de prueba en (990, 500), un mapa de hierba con la fila 9 (y en [540, 600]) toda `water` salvo la
  celda (16, 9) `bridge` (x en [960, 1.020]) y el jugador quieto en (990, 400) (distancia 100)
- **WHEN** se ejecutan 30 ticks
- **THEN** la oveja está en (990, 590) (error ≤ 0,001): huye en línea recta por el puente

### Requirement: Deambular de las ovejas
El sistema SHALL hacer que una oveja que no huye alterne **pasto** y **paseo**:
- en **pasto** (`graze`) no se mueve. Un pasto dura la duración de pasto del contenido, salvo el primer pasto de cada
  oveja colocada por el mapa generado, cuya duración es un entero en [1, duración de pasto] elegido con el azar de las
  ovejas (para que no se muevan todas a la vez). Una oveja declarada por un mapa explícito o reaparecida empieza con un
  pasto de la duración completa;
- al acabar un pasto empieza un **paseo** (`wander`) de la duración de paseo del contenido, con una **dirección**
  unitaria que se elige al empezar y no cambia durante el paseo: si la distancia de la oveja a su punto de origen es
  **mayor** que el radio de pasto, la dirección apunta a su punto de origen; si no, la elige el azar de las ovejas. En
  cada tick del paseo avanza velocidad de paseo / 60 en esa dirección (con "Movimiento de las ovejas por el mapa");
- al acabar un paseo empieza otro pasto.

Cuenta de ticks: un pasto de g ticks que empieza en el tick t ocupa los ticks t a t + g − 1, en los que la oveja no se
mueve, y el paseo empieza en el tick t + g; un paseo de p ticks que empieza en el tick s ocupa los ticks s a s + p − 1,
en los que se mueve, y el pasto siguiente empieza en el tick s + p. Una oveja creada en el tick t (t = 0 al crear la
partida, o el tick de su reaparición) empieza su primer pasto en el tick t + 1. El snapshot la muestra en `graze` en su
tick de creación y en los ticks de pasto, y en `wander` en los de paseo. La huida (ver "Huida del jugador") interrumpe
el pasto o el paseo en curso. El azar de las ovejas MUST NOT ser el de la partida (ver "Ovejas deterministas").

#### Scenario: Pasto y paseo de una oveja declarada
- **GIVEN** la oveja de prueba en el mapa vacío
- **WHEN** se ejecutan 300 ticks
- **THEN** la oveja está en (1.000, 1.000) y en estado `graze` en los snapshots de los ticks 0 a 120
- **AND** en cada tick de 121 a 180 está en estado `wander` y su posición avanza exactamente 1 px (error ≤ 0,001) en la
  misma dirección unitaria en los 60 ticks
- **AND** de 181 a 300 está en estado `graze` y no se mueve

#### Scenario: Vuelta al origen fuera del radio de pasto
- **GIVEN** la oveja de prueba colocada por el escenario en (1.400, 1.000) con punto de origen (1.000, 1.000)
  (distancia 400 > 300)
- **WHEN** se ejecutan 360 ticks
- **THEN** la oveja está en (1.399, 1.000) tras el tick 121, en (1.340, 1.000) tras el 180 y sigue ahí hasta el 300
- **AND** está en (1.280, 1.000) tras el tick 360 (error ≤ 0,001 en las tres)

#### Scenario: Límite exacto del radio de pasto
- **GIVEN** la oveja de prueba colocada por el escenario en (1.300, 1.000) con punto de origen (1.000, 1.000)
  (distancia 300, no mayor que el radio de pasto)
- **WHEN** se ejecutan 180 ticks en dos partidas con la misma semilla, una así y otra con la oveja en (1.000, 1.000)
- **THEN** en las dos la dirección del paseo de los ticks 121 a 180 es la misma (la del azar de las ovejas), no
  necesariamente (−1, 0)

#### Scenario: Una oveja que no huye no se aleja de su origen
- **GIVEN** la oveja de prueba en el mapa vacío y el jugador quieto en la salida durante 36.000 ticks
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún snapshot la distancia de la oveja a (1.000, 1.000) es mayor que 360 (radio de pasto 300 + un paseo
  de 60 ticks a 1 px/tick)

#### Scenario: Primer pasto de las ovejas colocadas
- **GIVEN** el contenido por defecto y la semilla 42 con su mapa generado, con el jugador quieto en la salida
- **WHEN** se ejecutan ticks hasta la duración de pasto del contenido + 1
- **THEN** cada oveja colocada se mueve por primera vez en un tick de [2, duración de pasto + 1] (primer pasto de
  1 a duración de pasto ticks), ya que ninguna está a menos del radio de huida de la salida
- **AND** las mismas ovejas empiezan a moverse en los mismos ticks en otra partida con la misma semilla

### Requirement: Huida del jugador
El sistema SHALL evaluar, en el paso de movimiento de las ovejas de cada tick (ver "Orden de los pasos del tick" en
`simulation-loop`) y en el orden de la lista de ovejas, la distancia de cada oveja viva al jugador ya movido en ese
tick:
- si es **estrictamente menor** que el radio de huida, la oveja pasa a (o sigue en) **huida** (`flee`) y en ese mismo
  tick avanza velocidad de huida / 60 en la dirección que va del centro del jugador a su centro (si coinciden, (1, 0)),
  con "Movimiento de las ovejas por el mapa";
- si es mayor o igual y la oveja estaba en huida, empieza en ese tick un pasto de la duración completa (en ese tick ya
  no se mueve);
- si es mayor o igual y no estaba en huida, sigue con su deambular.

Las ovejas solo huyen del jugador: los enemigos, las explosiones, los avisos, las dinamitas, los proyectiles, los
pulsos y las otras ovejas MUST NOT cambiar su estado ni su movimiento. Huir no cambia su punto de origen.

#### Scenario: Huida en línea recta
- **GIVEN** la oveja de prueba en estado `graze` y el jugador quieto en (1.150, 1.000) (distancia 150 < 200)
- **WHEN** se ejecutan 18 ticks
- **THEN** la oveja está en (997, 1.000) tras el tick 1 y en (949, 1.000) tras el tick 17, en estado `flee` en los
  ticks 1 a 17 (error ≤ 0,001)
- **AND** en el tick 18 (distancia 201) está en estado `graze` en (949, 1.000) y sigue ahí, en `graze`, hasta el tick
  137 inclusive (pasto de 120 ticks, del 18 al 137)

#### Scenario: Tangencia con el radio de huida
- **GIVEN** la oveja de prueba en estado `graze` y el jugador quieto en (1.200, 1.000) (distancia 200)
- **WHEN** se ejecutan 120 ticks
- **THEN** la oveja sigue en (1.000, 1.000), en estado `graze`, en todos los snapshots

#### Scenario: Huida con la posición del jugador ya movido
- **GIVEN** la oveja de prueba en estado `graze` y el jugador en (1.203, 1.000) (distancia 203) con velocidad 215 e
  input (−1, 0)
- **WHEN** se ejecuta 1 tick (el jugador queda en (1.199,417; 1.000), a 199,417 px)
- **THEN** la oveja está en estado `flee` en (997, 1.000) (error ≤ 0,001)

#### Scenario: Jugador sobre la oveja
- **GIVEN** la oveja de prueba y el jugador quieto en (1.000, 1.000)
- **WHEN** se ejecuta 1 tick
- **THEN** la oveja está en (1.003, 1.000) en estado `flee`

#### Scenario: Un enemigo no la espanta
- **GIVEN** la oveja de prueba en estado `graze` y un `goblin-torch` que pasa por su posición en el tick 50
- **WHEN** se ejecutan 120 ticks
- **THEN** la oveja sigue en (1.000, 1.000) y en estado `graze` en todos los snapshots, y el `goblin-torch` sigue su
  persecución como sin la oveja

### Requirement: Vida, daño y muerte de las ovejas
El sistema SHALL quitar vida a una oveja solo con las armas del jugador (ver "Objetivo del más cercano dentro de
alcance", "Proyectiles" y "Pulso de área" en `auto-weapons`) y con las explosiones (ver "Explosión de área" en
`enemy-hazards`), con el mismo daño que a un enemigo; el contacto de los enemigos no la daña. Los impactos se
acumulan, también en un mismo tick, y la vida no baja de 0. Una oveja cuya vida llega a 0 **muere** en el paso en que
llega (paso de armas o paso de peligros):
- sale de la lista de ovejas y no figura en el snapshot de ese tick;
- suelta exactamente una pieza de carne (ver "Carne de las ovejas abatidas" en `resources`) en su posición;
- MUST NOT soltar gema, oro ni madera, sumar XP ni sumar al contador de bajas (ver "Ovejas fuera de bajas y
  resultados");
- deja un hueco que se rellena con "Reaparición de ovejas".

Una oveja recibe daño de un mismo tick por armas y por explosiones y muere una sola vez. La oveja indica en el snapshot
si ha recibido daño en los últimos `hitFlashTicks` ticks ejecutados, con la misma regla que los enemigos (ver
"Indicación visual de daño, proyectiles y pulsos" en `auto-weapons`). Matar ovejas MUST NOT consumir el azar de la
partida.

#### Scenario: Dos impactos del Linter
- **GIVEN** la oveja de prueba (vida 12), sin enemigos ni estructuras, una partida con 5 bajas y XP 3, y el jugador
  quieto en (1.300, 1.000) (distancia 300: fuera del radio de huida y dentro del alcance del Linter) con el Linter
  cargado
- **WHEN** se ejecutan ticks hasta que el segundo proyectil del Linter la impacta en el tick n
- **THEN** tras el primer impacto tiene vida 6 e indica daño reciente, y no figura en el snapshot del tick n
- **AND** en el snapshot del tick n hay exactamente 1 recogible `meat` nuevo y ningún `xp`, `gold` ni `wood` nuevo, las
  bajas siguen en 5 y la XP en 3

#### Scenario: Explosión que mata a una oveja
- **GIVEN** la oveja de prueba (vida 12, radio 20) en (1.000, 1.000) y una dinamita de radio 48 y daño 20 que explota
  en (1.060, 1.000) en el tick n (distancia 60 < 68), con el jugador lejos
- **WHEN** se ejecuta el tick n
- **THEN** la oveja no figura en el snapshot del tick n, hay 1 recogible `meat` nuevo en su posición y las bajas no
  cambian

#### Scenario: Explosión tangente
- **GIVEN** la oveja de prueba en (1.000, 1.000) y la dinamita del escenario anterior en (1.068, 1.000) (distancia
  68 = 48 + 20)
- **WHEN** se ejecuta el tick n
- **THEN** la oveja sigue viva con vida 12

#### Scenario: Armas y explosión en el mismo tick
- **GIVEN** la oveja de prueba con vida 6 que recibe en el tick n un impacto del Linter (daño 6) y está dentro del
  radio de una explosión de daño 20 en ese tick
- **WHEN** se ejecuta el tick n
- **THEN** muere en el paso de armas, hay exactamente 1 recogible `meat` nuevo y la explosión no crea otro

#### Scenario: Daño mayor que la vida
- **GIVEN** la oveja de prueba con vida 4 y un pulso de Tests mejorado de daño 10 que la alcanza en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la oveja muere y suelta exactamente 1 recogible `meat`

#### Scenario: El contacto de un enemigo no la daña
- **GIVEN** la oveja de prueba y un `goblin-torch` (daño por contacto 5) colocado por el escenario en su centro durante
  600 ticks, sin armas equipadas
- **WHEN** se ejecutan 600 ticks
- **THEN** la oveja tiene vida 12 en todos los snapshots y nunca indica daño reciente

### Requirement: Reaparición de ovejas
El sistema SHALL, por cada oveja que muere en el tick t de una partida con ovejas, hacer aparecer una oveja nueva en
el paso de reaparición (ver "Orden de los pasos del tick" en `simulation-loop`) del tick t + intervalo de reaparición,
o del primer tick posterior en que haya una celda candidata. La oveja nueva:
- se crea en el centro de una celda **candidata** elegida con el azar de las ovejas. Una celda es candidata si es
  `grass`, no pertenece a la huella de ninguna estructura ni es la puerta de una casa, no es la celda en la que estaba
  el centro de la oveja muerta al morir y su centro está a distancia ≥ la distancia mínima de reaparición del centro
  del jugador en ese tick; con el mapa generado, además, cumple las distancias mínimas a la zona de inicio y al
  castillo de "Ovejas en el mapa generado" (`procedural-map`);
- tiene un identificador nuevo, la vida del contenido, su punto de origen en su posición, estado `graze` con un pasto de
  la duración completa, y entra al final de la lista;
- no se mueve ni puede ser objetivo de las armas en su tick de aparición (aparece después de esos pasos).

Si en un tick hay varias reapariciones pendientes, se atienden en el orden de muerte (y, a igual tick de muerte, en el
orden que tenían en la lista de ovejas). Una reaparición sin celda candidata queda pendiente y se intenta de nuevo en
cada tick siguiente. En los ticks que acaban antes del paso de reaparición (victoria o derrota) no aparece ninguna. La
reaparición MUST NOT consumir el azar de la partida ni cambiar la colocación inicial de las ovejas.

#### Scenario: Reaparición tras el intervalo
- **GIVEN** el mapa vacío con la oveja de prueba como única oveja declarada y el jugador quieto en la salida
  (1.920, 1.080), y la oveja muere en el tick n con su centro en la celda (16, 16)
- **WHEN** se ejecutan los ticks n a n + 600
- **THEN** en los snapshots de n a n + 599 no hay ninguna oveja
- **AND** en el snapshot de n + 600 hay exactamente 1 oveja, con un identificador distinto, vida 12, estado `graze`,
  en el centro de una celda `grass` distinta de la (16, 16) y a ≥ 500 px de (1.920, 1.080)

#### Scenario: Dos muertes en el mismo tick
- **GIVEN** tres ovejas de prueba declaradas o1, o2 y o3, en ese orden, de las que o1 y o2, con vida 4, mueren en el
  mismo pulso de Tests del tick n y o3 sigue viva
- **WHEN** se ejecuta hasta el tick n + 600
- **THEN** en el snapshot de n + 600 la lista es o3, o4, o5, con o4 y o5 nuevas, creadas en ese orden

#### Scenario: Sin celda candidata
- **GIVEN** el mapa vacío con la oveja de prueba como única oveja declarada, con distancia mínima de reaparición 4.500
  (mayor que la diagonal del mundo, 4.405,8), que muere en el tick n
- **WHEN** se ejecutan 3.600 ticks más
- **THEN** no aparece ninguna oveja, no hay errores y la partida sigue en curso

#### Scenario: Muerte en el tick de la victoria
- **GIVEN** una partida con duración objetivo 120 ticks, intervalo de reaparición 1 y una oveja que muere por armas en el
  tick 119
- **WHEN** se ejecuta el tick 120
- **THEN** la partida termina con victoria y la lista de ovejas del snapshot del tick 120 no tiene la oveja nueva

#### Scenario: Vuelta al tope con el contenido por defecto
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente, la semilla 42 con su mapa generado y una partida
  en la que mueren 2 ovejas en el tick n
- **WHEN** se ejecuta hasta el tick n + intervalo de reaparición del contenido
- **THEN** en ese snapshot hay tantas ovejas vivas como el tope, si ninguna otra ha muerto entretanto y había celdas
  candidatas

### Requirement: Ovejas neutrales
El sistema SHALL hacer que las ovejas no interactúen con nada salvo con el mapa, el jugador (solo para huir), las armas
y las explosiones:
- no hacen daño por contacto ni son golpe candidato del jugador, y no inician su invulnerabilidad;
- no bloquean al jugador, a los enemigos, a los proyectiles que no las tienen como objetivo, a otras ovejas ni a los
  recogibles, y nada las empuja (sin colisión oveja-enemigo ni oveja-oveja);
- los enemigos las ignoran: no las persiguen, no las atacan, no les lanzan dinamitas y no cambian por ellas su estado,
  su navegación ni el campo de distancias;
- no recogen recogibles, no agotan vetas, no cambian celdas ni estructuras.

#### Scenario: El jugador atraviesa una oveja sin daño
- **GIVEN** la oveja de prueba con velocidad de huida 1 px/s (valor de escenario), el jugador no invulnerable con vida
  100 en (900, 1.000), velocidad 215 e input (1, 0)
- **WHEN** se ejecutan 60 ticks
- **THEN** el jugador está en (1.115, 1.000) (error ≤ 0,001), igual que sin la oveja, y su vida sigue en 100 sin estar
  invulnerable en ningún snapshot

#### Scenario: Un enemigo cruza una oveja
- **GIVEN** la oveja de prueba en (1.000, 1.000), un jugador quieto en (1.300, 1.000) y un `goblin-torch` (velocidad
  90) en (700, 1.000)
- **WHEN** se ejecutan 60 ticks
- **THEN** el `goblin-torch` está en la misma posición que en una partida igual sin la oveja

#### Scenario: Ovejas solapadas
- **GIVEN** dos ovejas de prueba declaradas en la misma posición (1.000, 1.000) con el jugador lejos
- **WHEN** se ejecutan 120 ticks
- **THEN** ambas siguen en (1.000, 1.000), sin separarse

### Requirement: Ovejas fuera de bajas y resultados
El sistema SHALL excluir las ovejas del contador de bajas (ver "Contador de bajas" en `run-outcome`), que sigue
contando solo enemigos, de la XP y de la pantalla de resultados, el récord y el historial (`run-results` y
`progress-persistence` sin cambios). Ni el snapshot, ni los resultados, ni el guardado tienen contador de ovejas
abatidas ni de carne recogida.

#### Scenario: Bajas solo de enemigos
- **GIVEN** una partida con 4 bajas, una oveja con vida 4 y un `goblin-torch` con vida 4, ambos dentro del radio de un
  pulso de Tests (daño 4) en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** las bajas valen 5, hay 1 gema nueva y 1 recogible `meat` nuevo, creados en ese orden

#### Scenario: Resultados sin ovejas
- **GIVEN** una partida terminada en la que han muerto 6 ovejas y se han recogido 3 piezas de carne
- **WHEN** se muestra la pantalla de resultados y se guarda el récord y la entrada de historial
- **THEN** la pantalla tiene las mismas 5 líneas que antes del change y las bajas mostradas son las de enemigos
- **AND** el récord y la entrada guardados no tienen ningún campo de ovejas ni de carne

### Requirement: Ovejas deterministas
El sistema SHALL decidir todo lo aleatorio de las ovejas (colocación inicial, duración del primer pasto, dirección de
cada paseo y celda de cada reaparición) con el **azar de las ovejas**: uno o varios flujos de azar derivados de la
semilla, distintos del de las celdas del mapa, del de la decoración, del de las estructuras, del de los recursos y del
de la partida (oleadas y ofertas). La colocación inicial MUST depender solo de la semilla, del mapa generado y del
contenido, no de lo que ocurra en la partida. Con la misma semilla, el mismo contenido, los mismos inputs y las mismas
elecciones, las ovejas (identificador, posición, vida, estado y punto de origen), sus muertes, sus reapariciones y la
carne MUST ser iguales tick a tick. Nada de las ovejas MUST consumir el azar de la partida ni cambiar el mapa, las
estructuras o los recursos colocados.

#### Scenario: Partida con ovejas reproducible
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7 con su mapa generado, la misma secuencia de 14.400
  inputs que lleva al jugador cerca de ≥ 1 oveja, la política de elección fija y una vida máxima suficiente
- **WHEN** ambas ejecutan 14.400 ticks y en ese tiempo ≥ 1 oveja huye, ≥ 1 muere y ≥ 1 reaparece
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidas las ovejas, los recogibles `meat` y la vida
  del jugador

#### Scenario: Las ovejas no consumen el azar de la partida
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una hay 5 ovejas que en el tick n pasean, huyen,
  mueren por armas y reaparecen, y en la otra no hay ovejas
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Mismas oleadas con y sin ovejas
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7 con su mapa generado, input (0, 0) y la política de
  elección fija, una con el tope de ovejas por defecto y otra con tope 0
- **WHEN** ambas ejecutan ticks hasta que una de las dos abre su primera oferta o termina, o hasta el tick 1.200
- **THEN** las apariciones del director son las mismas en ambas (tipo, tick y posición)

<!-- historial: 0023-sheep-meat (2026-11-24) -->
<!-- historial: 0024-split-progression-castle (2026-11-25) -->
