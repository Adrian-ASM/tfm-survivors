# Simulation loop · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
La simulación avanza en ticks fijos de 1/60 s, independiente del refresco de pantalla y determinista, y expone un snapshot de solo lectura al motor.

**Convención para todas las specs: política de elección fija** (desde 0005). En un escenario que "ejecuta N
ticks" sobre una partida que puede subir de nivel y no dice nada de elecciones, cada vez que se abre una oferta se
elige la opción de índice 0 antes de pedir el siguiente tick, y "N ticks" son N ticks ejecutados (`snapshot.tick`
avanza N). Las elecciones de mejora son input del determinismo, igual que el movimiento.

**Convención para todas las specs: política de tienda fija** (desde 0024). En un escenario que no dice nada de
la tienda, cada vez que se abre se sale sin comprar antes del siguiente tick (ver "Política de tienda fija en los
escenarios"). Las compras son input del determinismo.

**Convención para todas las specs: política de obra fija** (desde 0026). En un escenario que no dice nada de
los solares, cada vez que se abre la oferta de un solar se sale sin construir antes del siguiente tick (ver
"Política de obra fija en los escenarios"). Las construcciones son input del determinismo.

## Requirements

### Requirement: Paso fijo de simulación
El sistema SHALL avanzar la simulación en ticks de exactamente 1/60 s, independientemente de la tasa de refresco
del monitor, acumulando el tiempo real sobrante para el siguiente frame.

#### Scenario: Un frame de 1/60 s
- **GIVEN** un bucle recién creado con acumulador a 0
- **WHEN** el motor informa de 16,667 ms transcurridos
- **THEN** se ejecuta exactamente 1 tick

#### Scenario: Monitor de 120 Hz
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa dos veces de 8,334 ms
- **THEN** tras el primer frame se han ejecutado 0 ticks y tras el segundo, 1 tick

#### Scenario: Monitor de 30 Hz
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa de 33,334 ms
- **THEN** se ejecutan exactamente 2 ticks

#### Scenario: Tiempo independiente del refresco
- **GIVEN** dos bucles con el mismo estado inicial e input (1, 0) constante
- **WHEN** uno recibe 60 frames de 16,667 ms y el otro 165 frames de 6,061 ms (≈ 1 s en ambos)
- **THEN** ambos han ejecutado 60 ticks (±1) y la posición del jugador difiere ≤ 3,4 px (un tick)

### Requirement: Protección contra la espiral de la muerte
El sistema SHALL limitar el tiempo acumulable por frame a 250 ms, de modo que un frame no ejecute más de 15 ticks
aunque la pestaña haya estado congelada.

#### Scenario: Pestaña en segundo plano
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa de 5.000 ms transcurridos en un solo frame
- **THEN** se ejecutan exactamente 15 ticks

#### Scenario: Tiempo negativo o no numérico
- **GIVEN** un bucle recién creado
- **WHEN** el motor informa de −10 ms o de `NaN`
- **THEN** se ejecutan 0 ticks y el acumulador no cambia

### Requirement: Determinismo
El sistema SHALL producir exactamente el mismo `RunSnapshot`, enemigos (estado de comportamiento incluido), vida,
invulnerabilidad, estado de la partida, resultado, bajas, proyectiles, flechas de torre, pulsos, dinamitas, avisos,
explosiones, estructuras (vida y destrucción incluidas), ovejas (identificador, posición, vida, estado y punto de
origen), indicación de daño, recogibles de los cinco tipos (gemas, carne y piedras con su origen incluidas), oro,
madera, piedra, vetas (activa o agotada), solares (estado y armado), oferta de obra, XP, nivel, ofertas, mejoras
adquiridas de los dos catálogos, estado de la puerta de la tienda y productos de la tienda incluidos, y el mismo mapa,
a partir del mismo estado inicial, la misma semilla, la misma secuencia de inputs por tick, la misma secuencia de
elecciones de mejora (índice elegido en cada oferta), la misma secuencia de acciones en cada visita a la tienda
(productos comprados, en orden, y salida) y la misma acción en cada visita a un solar (tipo construido o salida). En
particular, el resultado de la partida, el tick en que termina, las bajas y la posición de cada enemigo y de cada oveja
en cada tick MUST ser los mismos. El núcleo MUST NOT depender de reloj del sistema, aleatoriedad global ni APIs del
navegador: toda la aleatoriedad MUST venir de instancias del puerto `RandomGenerator` inicializadas a partir de la
semilla de la partida: una para generar el mapa, otra para colocar las estructuras (ver "Colocación determinista con
azar propio" en `goblin-structures`), otra para colocar las vetas y los montones (ver "Colocación de recursos
determinista con azar propio" en `procedural-map`), el azar de las ovejas (una o varias, ver "Ovejas deterministas" en
`sheep`), el **azar de la piedra** (ver "Azar de la piedra"), otra para colocar los solares (ver "Colocación de solares
determinista con azar propio" en `procedural-map`) y otra para el resto de la partida (ver "Azar del mapa
independiente del de la partida" en `procedural-map`). Las armas (selección de objetivo entre enemigos, estructuras y
ovejas, disparo, proyectiles y pulsos), las torres (selección de objetivo, disparo y flechas), las bajas y su
contador, la destrucción de estructuras, el movimiento, la huida, el daño y la muerte de las ovejas, los recogibles de
los cinco tipos (suelta, madera del barril, oro de las bajas, oro de las estructuras, carne de las ovejas,
recolocación, tope por tipo, imán y recogida), las bonificaciones de XP y de oro y sus restos, la curación (carne,
regeneración, subida sin mejoras y pago), la armadura, la invulnerabilidad mejorada, las vetas (contacto y
agotamiento), los contadores de oro, madera y piedra, los pagos de las casas, la colisión del jugador con el mapa, la
persecución de los enemigos (línea libre, campo de distancias y navegación), la navegación hacia un punto fijo, el
recálculo de los campos al construir, los estados de comportamiento y sus transiciones (patrulla, alerta y vuelta
incluidas), el nacimiento de guardias, los lanzamientos, las dinamitas, los avisos y las explosiones, la recolocación
de las apariciones y de los puntos de patrulla, la XP, la puerta de la tienda (re-armado y apertura), las compras, la
salida de la tienda, los solares (re-armado y apertura), la construcción, el despeje de la huella, la salida de la obra
y la comprobación de victoria y derrota MUST NOT consumir azar; la apertura de ofertas de mejora sí lo consume, y cada
intento de posición de aparición consume exactamente 1 valor (ver `enemy-spawning`). La colocación inicial, el primer
pasto, la dirección de los paseos y la reaparición de las ovejas consumen solo el azar de las ovejas. La tirada de
piedra de cada baja (abatida o no, con cualquier probabilidad, también las abatidas por una flecha de torre) consume
exactamente 1 valor del azar de la piedra y ningún otro (ver "Piedra por enemigo abatido" en `resources`). Los
comportamientos, los peligros, las estructuras, los recursos, las ovejas, la piedra, la tienda, los solares y los
edificios MUST NOT cambiar el tipo de ninguna celda del mapa generado por ninguna semilla.

#### Scenario: Dos partidas idénticas
- **GIVEN** dos partidas creadas con el mismo contenido y la semilla 42
- **WHEN** ambas reciben la misma secuencia de 600 inputs (10 s) generada por una seed fija, con la política de
  elección fija
- **THEN** sus snapshots son iguales campo a campo en cada tick, enemigos, vida, invulnerabilidad, estado,
  resultado, bajas, proyectiles, pulsos, estructuras, ovejas, recogibles, oro, madera, vetas, XP, nivel y ofertas
  incluidos (comparación estricta, sin tolerancia)
- **AND** sus mapas son iguales celda a celda

#### Scenario: Semillas distintas
- **GIVEN** dos partidas creadas con el mismo contenido y las semillas 1 y 2
- **WHEN** ambas reciben la misma secuencia de 600 inputs
- **THEN** la posición de aparición de al menos 1 enemigo difiere entre las dos partidas
- **AND** sus mapas difieren en el tipo de al menos 1 celda

#### Scenario: Partida con contactos reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 42, con input (0, 0) en todos los ticks y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo el jugador recibe ≥ 1 golpe
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos la vida, la invulnerabilidad, el
  estado, el resultado y, si la hay, el tick en que la partida termina

#### Scenario: Partida con armas reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7, con input (0, 0) en todos los ticks y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo ≥ 1 enemigo queda dado de baja por armas y se emite ≥ 1
  pulso
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos proyectiles, pulsos, vida de los enemigos,
  indicación de daño reciente y bajas

#### Scenario: Partida con progresión reproducible
- **GIVEN** dos partidas con el contenido por defecto (mundo de 3.840 × 2.160) y la semilla 7, con input (0, 0) y la
  política de elección fija
- **WHEN** ambas ejecutan 4.800 ticks y en ese tiempo se recoge ≥ 1 gema y se abre ≥ 1 oferta (mismo plazo que
  "Primera subida en el núcleo")
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidas gemas, XP, nivel, ofertas y mejoras
  adquiridas

#### Scenario: Partida con peligros reproducible
- **GIVEN** dos partidas con el contenido por defecto, una semilla de 1..50 con su mapa generado, un input
  aleatorio generado por una seed fija y la política de elección fija, y una vida máxima del jugador suficiente para
  no llegar a 0 en 14.400 ticks
- **WHEN** ambas ejecutan 14.400 ticks y en ese tiempo ≥ 1 barril explota y ≥ 1 `goblin-tnt` lanza una dinamita
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos los estados de comportamiento, las
  dinamitas, los avisos, las explosiones, las bajas y las gemas

#### Scenario: Partida con estructuras y guardias reproducible
- **GIVEN** dos partidas con el contenido por defecto, una semilla de 1..50 con su mapa generado, la misma secuencia
  de inputs por tick que lleva al jugador hasta una casa y la mantiene en el alcance del Linter, la política de
  elección fija y una vida máxima del jugador suficiente para no llegar a 0
- **WHEN** ambas ejecutan ticks hasta que la casa queda destruida y ≥ 1 guardia ha entrado en alerta, o hasta el tick
  14.400
- **THEN** ambas destruyen la casa en el mismo tick y ≥ 1 guardia entra en alerta
- **AND** sus snapshots son iguales campo a campo en cada tick, incluidas las estructuras y los estados de los
  guardias

#### Scenario: Partida con recursos reproducible
- **GIVEN** dos partidas con el contenido por defecto, una semilla de 1..50 con su mapa generado, la misma secuencia
  de inputs por tick que lleva al jugador por ≥ 1 montón y ≥ 1 veta y hasta una casa que destruye con el Linter, la
  política de elección fija y una vida máxima suficiente para no llegar a 0
- **WHEN** ambas ejecutan ticks hasta que el oro y la madera son > 0 y ≥ 1 `goblin-barrel` ha soltado madera, o hasta
  el tick 14.400
- **THEN** en ambas el oro y la madera son > 0 en el mismo tick, con los mismos valores
- **AND** sus snapshots son iguales campo a campo en cada tick, incluidos los recogibles con su tipo y valor, el oro, la
  madera y las vetas

#### Scenario: Partida con ovejas y carne reproducible
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42 con su mapa generado, la misma secuencia de inputs
  por tick que lleva al jugador junto a ≥ 1 oveja hasta que las armas la matan y recoge su carne, la política de
  elección fija y una vida máxima de 1.000 (valor de escenario) para no llegar a 0
- **WHEN** ambas ejecutan ticks hasta que ≥ 1 oveja ha reaparecido y el jugador se ha curado ≥ 1 vez, o hasta el tick
  14.400
- **THEN** en ambas la primera curación ocurre en el mismo tick, con la misma vida resultante
- **AND** sus snapshots son iguales campo a campo en cada tick, incluidas las ovejas, los recogibles `meat` y la vida

#### Scenario: Elecciones distintas divergen
- **GIVEN** dos partidas con la misma semilla y los mismos inputs que abren la misma primera oferta de 3 opciones
- **WHEN** en una se elige el índice 0 y en la otra el 1
- **THEN** sus listas de mejoras adquiridas difieren desde ese momento

#### Scenario: Partida larga reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7
- **WHEN** ambas reciben la misma secuencia de 36.000 inputs (10 min), con la política de elección fija
- **THEN** sus snapshots finales son iguales campo a campo, incluidos el estado, el resultado, el tick en que
  terminan, las bajas, el oro, la madera y las ovejas

#### Scenario: Resultado reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 42, input (0, 0) y la política de elección fija
- **WHEN** ambas ejecutan ticks hasta que terminan o hasta el tick 36.000
- **THEN** ambas terminan con el mismo resultado, en el mismo tick y con las mismas bajas

#### Scenario: Victoria reproducible
- **GIVEN** dos partidas con el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a
  0 en 36.000 ticks, semilla 7, la misma secuencia de inputs y la política de elección fija
- **WHEN** ambas ejecutan 36.000 ticks
- **THEN** ambas terminan con victoria en el tick 36.000 con el mismo número de bajas y snapshots finales iguales
  campo a campo

#### Scenario: La colisión no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una el jugador está tangente a un tronco y
  recibe un input que lo empuja contra él, y en la otra está en hierba libre con el mismo input
- **WHEN** ambas ejecutan el mismo tick sin oferta de mejora
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: La persecución por el mapa no consume azar
- **GIVEN** dos partidas con la semilla 7, el mismo estado y el mismo director, una con 300 enemigos vivos navegando
  por el campo de un mapa con río y troncos y otra con los mismos 300 enemigos en el mapa vacío
- **WHEN** ambas ejecutan el mismo tick sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Los comportamientos no consumen azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una 10 enemigos cambian de estado en el tick
  n (entran en mecha, en carga, en alerta, en vuelta o vuelven a persecución o a patrulla) y en la otra siguen en su
  estado
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Las estructuras no consumen azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una el Linter apunta a una casa y la
  destruye en el tick n y en la otra no hay estructuras
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: La curación no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una el jugador recoge en el tick n 2
  recogibles `meat` que le curan y en la otra no hay carne
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Mapa intacto
- **GIVEN** el contenido por defecto tras el change
- **WHEN** se generan los mapas de las semillas de la firma dorada de `tests/support/mapGolden.ts`
- **THEN** su firma es igual a la firma dorada de antes del change

#### Scenario: Posiciones de enemigos reproducibles con el mapa generado
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42 con su mapa generado, la misma secuencia de
  3.600 inputs generada por una seed fija y la política de elección fija
- **WHEN** ambas ejecutan 3.600 ticks
- **THEN** en cada tick la lista de enemigos (identificador, tipo, posición, vida y estado de comportamiento) es igual
  en las dos, sin tolerancia

#### Scenario: Snapshot no mutable desde fuera
- **GIVEN** una partida en el tick 10 con ≥ 1 enemigo vivo, ≥ 1 proyectil vivo, ≥ 1 gema, ≥ 1 recogible `wood`,
  ≥ 1 veta, ≥ 1 estructura, ≥ 1 oveja, ≥ 1 solar construido y ≥ 1 flecha de torre, otra con ≥ 1 dinamita, ≥ 1 aviso y ≥ 1 explosión, otra con una oferta
  abierta y otra terminada
- **WHEN** el adaptador modifica el objeto `RunSnapshot` que ha recibido, incluidas la posición de un enemigo, su
  estado de comportamiento, la lista de enemigos, la vida del jugador, su invulnerabilidad, el estado de la partida,
  el resultado, las bajas, la duración objetivo, la posición de un proyectil, la lista de proyectiles, la posición, el
  tipo y el valor de un recogible, la lista de recogibles, el oro, la madera, el estado y el oro de una veta, la lista
  de vetas, la posición y el objetivo de una dinamita, el centro y el radio de un aviso, la lista de explosiones, la
  vida y la destrucción de una estructura, la lista de estructuras, la posición, la vida y el estado de una oveja, la
  lista de ovejas, el estado y la huella de un solar, la lista de solares, la posición de una flecha de torre, la XP,
  el nivel y las opciones de la oferta
- **THEN** el siguiente tick (o la siguiente elección, o el siguiente snapshot leído) parte del estado interno, no
  del objeto modificado

#### Scenario: Partida con tienda y compras reproducible
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42 con su mapa generado, la misma secuencia de inputs
  por tick que aleja al jugador de la puerta, recoge oro y lo devuelve a ella, la política de elección fija, la misma
  secuencia de compras en cada visita y una vida máxima de 1.000 (valor de escenario)
- **WHEN** ambas ejecutan ticks hasta que han hecho ≥ 1 compra y 600 ticks más, o hasta el tick 14.400
- **THEN** la primera compra ocurre en el mismo tick en las dos, con el mismo oro resultante
- **AND** sus snapshots son iguales campo a campo en cada tick, incluidos el estado, el oro, la vida, las mejoras y los
  productos de la tienda

#### Scenario: Compras distintas divergen
- **GIVEN** dos partidas con la misma semilla y los mismos inputs que abren la tienda en el mismo tick con oro
  suficiente para 1 producto
- **WHEN** en una se compra `strict-rules` y en la otra `fast-ci`
- **THEN** sus listas de mejoras adquiridas difieren desde ese momento

#### Scenario: Partida con piedra reproducible
- **GIVEN** dos partidas con el contenido por defecto, una semilla de 1..50 con su mapa generado, la misma secuencia de
  14.400 inputs generada por una seed fija, la política de elección fija, la política de tienda fija y una vida máxima
  de 1.000 (valor de escenario)
- **WHEN** ambas ejecutan 14.400 ticks y en ese tiempo se sueltan ≥ 1 piedra y se recoge ≥ 1
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos los recogibles `stone` (identificador,
  posición, valor y origen) y la piedra

#### Scenario: Partida con piedra reproducible en el mapa vacío
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, el mapa vacío, input (0, 0) y la política de
  elección fija
- **WHEN** ambas ejecutan ticks hasta que terminan
- **THEN** terminan en el mismo tick y sus snapshots son iguales campo a campo en cada tick, incluidos los recogibles
  `stone` y la piedra

#### Scenario: Partida con edificios reproducible
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42 con su mapa generado, la misma secuencia de inputs
  por tick que recoge madera y piedra y lleva al jugador a ≥ 2 solares, la misma acción en cada visita (una casa y una
  torre), la política de elección fija, la de tienda fija y una vida máxima de 1.000 (valor de escenario)
- **WHEN** ambas ejecutan ticks hasta que han construido una casa y una torre y 3.600 ticks más, o hasta el tick 36.000
- **THEN** ambas construyen en los mismos ticks, con la misma madera y piedra resultantes
- **AND** sus snapshots son iguales campo a campo en cada tick, incluidos los solares, las flechas de torre, el oro,
  los enemigos y las bajas

#### Scenario: Construcciones distintas divergen
- **GIVEN** dos partidas con la misma semilla y los mismos inputs que abren la oferta del mismo solar en el mismo tick
  con madera 30 y piedra 15
- **WHEN** en una se construye `house` y en la otra `tower`
- **THEN** sus listas de solares difieren desde ese momento y la piedra vale 15 en la primera y 0 en la segunda

### Requirement: Snapshot para el motor
El sistema SHALL exponer tras cada frame un `RunSnapshot` con lo único que el adaptador de render necesita para
pintar:
- el número de tick;
- la duración objetivo de la partida, de forma que la vista pueda calcular el tiempo restante sin leer el contenido
  (ver `run-outcome` y `hud`);
- la posición y el radio del jugador;
- la vida actual y la vida máxima (efectiva) del jugador;
- si el jugador está invulnerable (ver `player-health`);
- el estado de la partida: en curso, eligiendo mejora, en tienda, en obra o terminada (ver `run-state`);
- el resultado de la partida: vacío, victoria o derrota (ver `run-outcome`);
- las bajas de la partida (ver `run-outcome`);
- el oro, la madera y la piedra de la partida (ver "Contadores de oro y madera de la partida" y "Contador de piedra de
  la partida" en `resources`);
- la lista de enemigos vivos;
- la lista de ovejas vivas (ver `sheep`);
- la lista de proyectiles vivos del jugador (ver `auto-weapons`);
- la lista de flechas de torre vivas (ver "Torre que dispara sola" en `build-sites`);
- la lista de pulsos visibles (ver `auto-weapons`);
- la lista de dinamitas en vuelo, la de avisos y la de explosiones visibles (ver `enemy-hazards`);
- la lista de estructuras de la partida, destruidas incluidas (ver "Estructuras en el snapshot" en
  `goblin-structures`);
- la lista de vetas de la partida, agotadas incluidas (ver "Vetas de oro al pasar" en `resources`);
- la lista de solares de la partida, construidos incluidos, con los campos de "Solares de la partida" (`build-sites`:
  identificador, huellas de casa y torre, estado y armado; sin acceso), en todos los estados de la partida;
- la oferta de obra, si la partida está en obra, con sus dos opciones y si cada una es asequible (ver "Oferta de obra"
  en `build-sites`);
- la lista de armas equipadas, en el orden de `content/weapons.json`, con su identificador y si está cargada;
- la lista de recogibles en el suelo, de los cinco tipos (ver `xp-gems`); las gemas son los de tipo `xp`;
- el nivel, la XP actual y la XP para el siguiente nivel (ver `leveling`);
- la oferta de mejoras abierta, si la hay, con sus opciones en orden: id, nombre, descripción, nivel actual y nivel
  siguiente (ver `upgrades`);
- los niveles de las mejoras adquiridas (nivel ≥ 1) de los dos catálogos, con su id, en el orden de "Nivel de las
  mejoras y disponibilidad" (`upgrades`);
- la tienda: la posición de la puerta (o ninguna si el mapa no tiene), si está armada y la lista de productos con los
  campos de "Productos de la tienda" (`castle-shop`), en todos los estados de la partida;
- la lista de golpes de la ventana, con los campos y el orden de "Golpes de combate en el snapshot", en todos los
  estados de la partida.

Cada enemigo del snapshot MUST incluir:
- un identificador único dentro de la partida, que no cambia mientras vive y no se reutiliza tras su baja;
- su tipo;
- su posición;
- su radio;
- su vida actual (> 0, ya que solo se listan enemigos vivos);
- si ha recibido daño recientemente (ver `auto-weapons`);
- su estado de comportamiento: el nombre del estado y su clase (persecución, mecha, carga, espera, patrulla, alerta o
  vuelta; ver `enemy-behavior`).

Cada oveja del snapshot MUST incluir su identificador (de la secuencia de las ovejas), su posición, su radio, su vida
actual (> 0), su estado (`graze`, `wander` o `flee`) y si ha recibido daño recientemente (ver "Vida, daño y muerte de
las ovejas" en `sheep`). Cada proyectil del snapshot MUST incluir un identificador único dentro de la partida que no
se reutiliza, su posición y su radio. Cada flecha de torre MUST incluir un identificador único entre las flechas de
torre de la partida que no se reutiliza, su posición y su radio. Cada pulso visible MUST incluir el identificador del
arma que lo disparó, el tick en que se disparó, su centro y su radio. Cada recogible MUST incluir un identificador único
dentro de la partida que no se reutiliza (una sola secuencia para los cinco tipos), su tipo (`xp`, `gold`, `wood`,
`meat` o `stone`), su valor, su posición y su radio; cada recogible `stone` soltado por una baja incluye además su
origen (`source`, el tipo de enemigo que lo soltó), y los de los otros tipos no lo incluyen. Cada veta MUST incluir un
identificador único dentro de la partida, su posición, su radio de contacto, su oro y si está activa o agotada. Cada
dinamita MUST incluir su identificador, su posición, su objetivo, su radio visual y el tick en que explotará; cada
aviso, su centro, su radio, su origen (mecha o dinamita) y el tick en que explotará; cada explosión, su identificador,
su centro, su radio y el tick en que ocurrió (ver `enemy-hazards`). Cada estructura MUST incluir los campos de
"Estructuras en el snapshot" (`goblin-structures`), su vida máxima incluida. Cada golpe MUST incluir los campos de
"Golpes de combate en el snapshot".

La lista de enemigos contiene solo enemigos vivos y va ordenada por orden de aparición o nacimiento. Una baja MUST
quitar al enemigo de la lista sin cambiar el orden relativo de los demás. La lista de ovejas contiene solo ovejas vivas,
va ordenada por orden de creación y una muerte no cambia el orden relativo de las demás. Las listas de proyectiles y de
flechas de torre van ordenadas por orden de creación y una desaparición no cambia el orden relativo de los demás. La
lista de recogibles va ordenada por orden de creación, sin agrupar por tipo, y una recogida no cambia el orden relativo
de los demás. Las listas de dinamitas y de explosiones van ordenadas por orden de creación y la de avisos con el orden
de "Aviso en el suelo" (`enemy-hazards`). La lista de golpes va ordenada por identificador. Las listas de estructuras,
de vetas, de solares y de productos de la tienda conservan su orden y su longitud durante toda la partida.

#### Scenario: Contador de ticks
- **GIVEN** una partida recién creada
- **WHEN** se ejecutan 90 ticks
- **THEN** `snapshot.tick` vale 90

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con vida máxima 100
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** las listas de enemigos, proyectiles, pulsos, dinamitas, avisos, explosiones, gemas, golpes y mejoras
  adquiridas están vacías y no hay oferta
- **AND** la vida actual y la máxima valen 100, el jugador no está invulnerable y el estado es en curso
- **AND** el resultado está vacío y las bajas valen 0
- **AND** el oro, la madera y la piedra valen 0, y no hay ningún recogible `stone`
- **AND** el nivel vale 1, la XP actual 0 y la XP para el siguiente nivel 5
- **AND** con el contenido por defecto, la lista de armas es `linter` y `tests`, en ese orden, ambas cargadas, y la
  duración objetivo equivale a 36.000 ticks
- **AND** con el mapa vacío las listas de estructuras, vetas, ovejas y recogibles están vacías y la tienda no tiene
  puerta y, con el mapa generado, la de estructuras tiene todas las colocadas, ninguna destruida, cada una con vida
  igual a su vida máxima, la de vetas todas las colocadas, todas activas, la de ovejas todas las colocadas, en `graze`,
  la de recogibles solo los montones de madera y la tienda tiene la puerta en (1.950, 1.170), desarmada
- **AND** en ambos casos la lista de productos tiene los 7 productos con nivel 0
- **AND** con el mapa vacío la lista de solares está vacía y, con el mapa generado, tiene los 6 solares colocados,
  en `free` y armados; en ambos casos la lista de flechas de torre está vacía y no hay oferta de obra

#### Scenario: Duración objetivo constante
- **GIVEN** una partida con `durationSeconds` 90
- **WHEN** se leen los snapshots de los ticks 0, 1 y 2.000 y el de una oferta abierta
- **THEN** en todos ellos la duración objetivo equivale a 5.400 ticks

#### Scenario: Carga de las armas en el snapshot
- **GIVEN** una partida con el contenido por defecto en la que hay un enemigo vivo a 50 px del jugador en el tick 1
  y ningún enemigo vivo, estructura no destruida ni oveja en alcance en los ticks 2 a 100, y en la que no se abre
  ninguna oferta
- **WHEN** se ejecutan 100 ticks
- **THEN** en los snapshots de los ticks 1 a 30 `linter` figura como no cargada, y de 31 a 100 como cargada
- **AND** en los snapshots de los ticks 1 a 90 `tests` figura como no cargada, y de 91 a 100 como cargada

#### Scenario: Pulso identificado en el snapshot
- **GIVEN** un pulso de `tests` disparado en el tick 40 con el jugador en (480, 270)
- **WHEN** se lee el snapshot del tick 43
- **THEN** el pulso figura con arma `tests`, tick de disparo 40, centro (480, 270) y radio 90

#### Scenario: Enemigos en el snapshot
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["goblin-torch"]`, `goblin-torch` con coste 1 y radio 10, en
  una partida sin armas equipadas ni estructuras
- **WHEN** se ejecutan 615 ticks
- **THEN** el snapshot lista 10 enemigos de tipo `goblin-torch` con radio 10 e identificadores distintos
- **AND** cada uno tiene una vida actual igual al `health` de `goblin-torch`, no indica daño reciente y está en su
  estado de persecución
- **AND** el orden de la lista coincide con el orden de aparición

#### Scenario: Estado de comportamiento en el snapshot
- **GIVEN** un `goblin-barrel` en mecha, un `goblin-tnt` en espera y tres `goblin-tnt-guard`, en patrulla, en alerta
  y en vuelta
- **WHEN** se lee el snapshot
- **THEN** el barril figura con el nombre de su estado de mecha y la clase mecha, el TNT con el nombre de su estado
  de espera y la clase espera, y cada guardia con el nombre de su estado y la clase patrulla, alerta y vuelta
  respectivamente

#### Scenario: Peligros en el snapshot
- **GIVEN** una dinamita d1 lanzada en el tick 154 con origen (1.199,5; 1.000), objetivo (1.000, 1.000), vuelo de 40
  ticks y radio de explosión 48, y un barril en mecha que explotará en el tick 160 en (500, 500) con radio 56
- **WHEN** se lee el snapshot del tick 155
- **THEN** hay 1 dinamita con identificador d1, objetivo (1.000, 1.000) y tick de explosión 194
- **AND** hay 2 avisos en este orden: el de mecha centrado en (500, 500), radio 56, tick 160, y el de dinamita
  centrado en (1.000, 1.000), radio 48, tick 194
- **AND** la lista de explosiones está vacía

#### Scenario: Estructuras en el snapshot del motor
- **GIVEN** el mapa vacío con una casa declarada en columnas 20–21 y filas 10–12 con radio de impacto 40 y vida 30
- **WHEN** se lee el snapshot del tick 0
- **THEN** la lista de estructuras tiene 1 estructura de tipo `goblin-house`, posición (1.260, 690), radio 40, huella
  (20, 10, 2, 3), vida 30, vida máxima 30 y sin destruir

#### Scenario: Vetas en el snapshot del motor
- **GIVEN** el mapa vacío con dos vetas declaradas v1 en (1.000, 1.000) y v2 en (2.000, 1.000), oro por veta 15 y
  radio de contacto 24, y el jugador que agota v1 en el tick n
- **WHEN** se leen los snapshots de los ticks 0 y n
- **THEN** en ambos la lista de vetas es v1, v2, con sus posiciones, radio 24 y oro 15
- **AND** en el del tick 0 ambas están activas y en el del tick n v1 está agotada y v2 activa

#### Scenario: Ovejas en el snapshot del motor
- **GIVEN** el mapa vacío con la oveja de prueba declarada en (1.000, 1.000) y el jugador quieto en (1.150, 1.000)
- **WHEN** se leen los snapshots de los ticks 0 y 1
- **THEN** en el del tick 0 hay 1 oveja con su identificador, posición (1.000, 1.000), radio 20, vida 12, estado
  `graze` y sin daño reciente
- **AND** en el del tick 1 la misma oveja, con el mismo identificador, está en (997, 1.000) en estado `flee`

#### Scenario: Identificador estable
- **GIVEN** un enemigo vivo con identificador X en el snapshot del tick n
- **WHEN** se ejecuta 1 tick más sin que X se dé de baja
- **THEN** el snapshot del tick n + 1 contiene un enemigo con identificador X, del mismo tipo y radio

#### Scenario: Bajas sin reordenar
- **GIVEN** un snapshot con 10 enemigos vivos cuyos identificadores, en orden de aparición, son a1 … a10
- **WHEN** a3 y a7 quedan dados de baja y se ejecuta 1 tick sin nuevos spawns
- **THEN** la lista del snapshot es exactamente a1, a2, a4, a5, a6, a8, a9, a10, en ese orden
- **AND** las bajas del snapshot han subido en 2

#### Scenario: Reposición al final de la lista
- **GIVEN** la partida del escenario anterior
- **WHEN** aparecen 2 enemigos nuevos b1 y b2, en ese orden
- **THEN** la lista del snapshot es a1, a2, a4, a5, a6, a8, a9, a10, b1, b2

#### Scenario: Baja del primero y del último
- **GIVEN** un snapshot con 200 enemigos vivos a1 … a200
- **WHEN** a1 y a200 quedan dados de baja y se ejecuta 1 tick sin nuevos spawns
- **THEN** la lista del snapshot es a2 … a199, en ese orden

#### Scenario: Proyectiles en el snapshot
- **GIVEN** tres proyectiles p1, p2 y p3 creados en ese orden y vivos
- **WHEN** p2 desaparece por impacto y se crea p4
- **THEN** la lista de proyectiles del snapshot es p1, p3, p4, cada uno con su posición y radio 4

#### Scenario: Gemas en el snapshot
- **GIVEN** tres gemas g1, g2 y g3 creadas en ese orden en el suelo
- **WHEN** g2 se recoge y se crea g4
- **THEN** la lista de gemas del snapshot es g1, g3, g4, cada una con su posición y radio 5

#### Scenario: Recogibles de varios tipos en el snapshot
- **GIVEN** cinco recogibles creados en este orden: w1 (`wood`), g1 (`xp`), o1 (`gold`), m1 (`meat`) y w2 (`wood`)
- **WHEN** g1 se recoge y se crea o2 (`gold`)
- **THEN** la lista de recogibles del snapshot es w1, o1, m1, w2, o2, cada uno con su tipo, su valor, su posición y
  radio 5

#### Scenario: Oferta en el snapshot
- **GIVEN** una partida en la que `guardrail` está en nivel 2 y se abre una oferta que la incluye
- **WHEN** se lee el snapshot
- **THEN** la opción de `guardrail` tiene su nombre y descripción del contenido, nivel actual 2 y siguiente 3
- **AND** la lista de mejoras adquiridas incluye `guardrail` con nivel 2
- **AND** la lista de productos de la tienda es la misma que antes de abrir la oferta

#### Scenario: Tienda en el snapshot
- **GIVEN** una partida que abre la tienda en el tick n con oro 25
- **WHEN** se compra un producto de precio 10 y se lee el snapshot
- **THEN** el estado es en tienda, el oro vale 15, el producto tiene su nivel nuevo y el precio de su siguiente nivel, y
  la puerta figura desarmada

#### Scenario: Piedra en el snapshot
- **GIVEN** cuatro recogibles creados en este orden: w1 (`wood`), s1 (`stone`, valor 1, origen `goblin-torch`), g1
  (`xp`) y s2 (`stone`, valor 1, origen `goblin-tnt-guard`), y `resources.stone` 4
- **WHEN** se recoge s1 y se lee el snapshot
- **THEN** la lista de recogibles es w1, g1, s2, cada uno con su tipo, su valor, su posición y radio 5, s2 con `source`
  `goblin-tnt-guard`, y `resources.stone` vale 5

#### Scenario: Snapshot de la piedra no mutable desde fuera
- **GIVEN** una partida en el tick 10 con piedra 3, un recogible `stone` de valor 1 y origen `goblin-torch` a ≥ 400 px
  del jugador y ninguna baja en el tick 11
- **WHEN** el adaptador cambia en el `RunSnapshot` recibido `resources.stone` a 99, el `source` de ese recogible a
  `goblin-tnt` y su valor a 5, y se ejecuta 1 tick
- **THEN** el snapshot del tick 11 tiene `resources.stone` 3 y el recogible conserva valor 1 y origen `goblin-torch`

#### Scenario: Solares y flechas en el snapshot
- **GIVEN** el mapa vacío con dos solares declarados s1 y s2, s1 con una torre construida que ha creado las flechas f1 y
  f2 en ese orden, y s2 en `free` y desarmado
- **WHEN** f1 desaparece por impacto, se crea f3 y se lee el snapshot
- **THEN** la lista de solares es s1 (`tower`) y s2 (`free`, desarmado), con sus huellas y sin acceso, y la de flechas
  de torre es f2, f3, cada una con su posición y su radio
- **AND** la lista de proyectiles del jugador no contiene ninguna flecha

#### Scenario: Snapshot de los solares no mutable desde fuera
- **GIVEN** una partida en el tick 10 con un solar en `free` y armado, sin ninguna oferta de obra en el tick 11
- **WHEN** el adaptador cambia en el `RunSnapshot` recibido el estado de ese solar a `house`, su armado a falso y una
  celda de su huella, y se ejecuta 1 tick
- **THEN** el snapshot del tick 11 tiene el solar en `free`, armado y con la huella original, y sus celdas siguen no
  caminables

#### Scenario: Golpes en el snapshot del motor
- **GIVEN** el mapa vacío, un `goblin-torch` g de vida 10 en (1.000, 1.000) que recibe un impacto del Linter en el tick
  n y el jugador, no invulnerable, en (1.200, 1.000) con un enemigo con damage 10 en contacto en el tick n + 1
- **WHEN** se lee el snapshot del tick n + 1
- **THEN** la lista de golpes es, en este orden: el de g (clase `enemy`, tick n, posición (1.000, 1.000), daño 6) y el
  del jugador (clase `player`, tick n + 1, posición (1.200, 1.000), daño 10), con identificadores crecientes

### Requirement: Semilla de la partida
El sistema SHALL arrancar cada partida con una semilla que sea un entero sin signo de 32 bits
(de 0 a 4.294.967.295). La URL se lee una sola vez por carga. La **primera partida de la carga** es la que empieza al
pulsar `Jugar` por primera vez en el menú de inicio o, si la URL incluye `?e2e`, la que empieza directamente al
cargar (ver `main-menu`). Para la primera partida de la carga, cuando la URL incluye `?seed=<valor>`, el valor MUST
validarse con zod antes de usarse:
- Si es un entero en ese rango, la partida usa esa semilla.
- Si falta, la partida usa una semilla aleatoria del mismo rango, sin avisos.
- Si está presente pero no es válido, se ignora, la partida usa una semilla aleatoria del mismo rango y se emite
  exactamente 1 aviso por consola que menciona `seed` en toda la carga, como muy tarde cuando empieza la primera
  partida.

Cada partida posterior de la misma carga, tanto la obtenida al reiniciar con R (ver `run-results`) como la que
empieza al pulsar `Jugar` tras `Volver al menú` (ver `main-menu`), MUST usar una semilla aleatoria nueva del mismo
rango, obtenida en el momento en que empieza, aunque la URL incluya `?seed=`; no vuelve a leer la URL ni emite
avisos. Una partida abandonada con `Volver al menú` cuenta como partida de la carga: el siguiente `Jugar` no
reutiliza la semilla de la URL. La elección de la semilla corresponde a la composición: el núcleo MUST recibir la
semilla ya resuelta y no conocer su origen.

#### Scenario: Semilla válida por URL
- **GIVEN** la URL `?seed=42`
- **WHEN** se pulsa `Jugar` en el menú de inicio
- **THEN** la partida usa la semilla 42 y no se emite ningún aviso

#### Scenario: Semilla válida por URL en modo E2E
- **GIVEN** la URL `?e2e&seed=42`
- **WHEN** arranca la partida al cargar
- **THEN** la partida usa la semilla 42 y no se emite ningún aviso

#### Scenario: Límites del rango
- **GIVEN** la URL `?seed=0` y, en otra carga, `?seed=4294967295`
- **WHEN** arranca la primera partida de la carga
- **THEN** la partida usa la semilla 0 y 4.294.967.295 respectivamente, sin avisos

#### Scenario: Semilla inválida
- **GIVEN** la URL `?seed=-1`, `?seed=4294967296`, `?seed=1.5`, `?seed=abc` o `?seed=`
- **WHEN** arranca la primera partida de la carga
- **THEN** la partida arranca con una semilla entera en [0, 4.294.967.295]
- **AND** se ha emitido exactamente 1 aviso por consola que menciona `seed`

#### Scenario: Sin semilla en la URL
- **GIVEN** una URL sin el parámetro `seed`
- **WHEN** arranca la primera partida de la carga
- **THEN** la partida arranca con una semilla entera en [0, 4.294.967.295] y no se emite ningún aviso

#### Scenario: Semilla nueva al reiniciar
- **GIVEN** la URL `?seed=42`, una primera partida terminada y una fuente aleatoria de la composición que en el
  siguiente sorteo da la semilla 123
- **WHEN** se pulsa R
- **THEN** la partida nueva usa la semilla 123, no la 42

#### Scenario: Semilla nueva tras volver al menú
- **GIVEN** la URL `?seed=42`, una primera partida (semilla 42) abandonada con `Volver al menú` y una fuente
  aleatoria de la composición que en el siguiente sorteo da la semilla 123
- **WHEN** se pulsa `Jugar`
- **THEN** la partida nueva usa la semilla 123, no la 42, y no se emite ningún aviso

#### Scenario: Reinicio tras una semilla inválida
- **GIVEN** la URL `?seed=abc`, que emitió 1 aviso al arrancar la primera partida, y esa partida terminada
- **WHEN** se pulsa R 3 veces, terminando cada partida antes del siguiente reinicio
- **THEN** cada partida nueva arranca con una semilla entera en [0, 4.294.967.295] y el total de avisos que mencionan
  `seed` sigue siendo 1

#### Scenario: Varios Jugar tras una semilla inválida
- **GIVEN** la URL `?seed=abc` y una carga en la que se repite 3 veces: `Jugar`, Esc, `Volver al menú`
- **WHEN** se pulsa `Jugar` una cuarta vez
- **THEN** cada una de las 4 partidas arranca con una semilla entera en [0, 4.294.967.295] y el total de avisos que
  mencionan `seed` en la carga es 1

#### Scenario: Semilla inválida antes y después de Jugar
- **GIVEN** la URL `?seed=abc` sin `?e2e`
- **WHEN** termina la carga, se pintan 300 frames en el menú sin pulsar `Jugar` y después se pulsa `Jugar`
- **THEN** durante los 300 frames no existe ninguna partida y se han emitido como mucho 1 aviso que mencione `seed`
- **AND** tras pulsar `Jugar` el total de avisos que mencionan `seed` es exactamente 1

### Requirement: Rendimiento con el tope de enemigos
El sistema SHALL ejecutar un tick de simulación con **300** enemigos vivos (el `maxAlive` por defecto), la persecución
por el mapa generado activa (línea libre y campo de distancias), los comportamientos por tipo activos, la detección de
contacto activa, las armas activas, los peligros activos y las gemas activas en ≤ 2 ms de media, medido con un
benchmark de Vitest sobre el núcleo, sin motor ni render. El cálculo completo del campo de distancias de una celda con
el mapa por defecto MUST tardar ≤ 0,1 ms de media en el mismo benchmark. Ambas medidas son informativas (dependen de
la máquina): no bloquean `verify` ni CI. Además, el verify-report de este change MUST anotar la media del peor caso
con proyectiles y la del caso con peligros, con el objetivo (informativo) de ≤ 0,25 ms por tick en ambos (+20 % sobre
los 0,206 ms medidos antes del change en la misma máquina). La partida medida MUST estar en curso en todos los ticks
medidos, de modo que se midan los pasos completos del tick: si se abre una oferta, el benchmark elige la opción 0
antes del siguiente tick y esa elección cuenta en el tiempo medido. El camino caliente del tick MUST NOT crear objetos
nuevos por tick para gemas (reserva de `maxGems`). Los escenarios que piden enemigos "en contacto" MUST colocarlos
respecto a la posición del jugador, de modo que el contacto se mantenga sea cual sea el tamaño del mundo.

#### Scenario: Tope de vivos alcanzado
- **GIVEN** una partida con el contenido por defecto, semilla fija con su mapa generado, exactamente 300 enemigos vivos
  y una vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos con input (1, 0)
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: 300 enemigos encima del jugador
- **GIVEN** una partida con semilla fija, 300 enemigos vivos en contacto con el jugador y una vida del jugador
  suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
- **AND** en cada tick medido hay ≥ 1 enemigo en contacto con el jugador

#### Scenario: Contacto con cualquier tamaño de mundo
- **GIVEN** la preparación del escenario "300 enemigos encima del jugador", una vez con el mundo por defecto
  (3.840 × 2.160) y otra con una arena explícita de 4.000 × 4.000
- **WHEN** se ejecutan 600 ticks en cada una
- **THEN** en ambas, en cada tick, hay ≥ 1 enemigo en contacto con el jugador

#### Scenario: Peor caso con proyectiles
- **GIVEN** una partida con semilla fija, 300 enemigos vivos, `maxProjectiles` (32) proyectiles vivos en todos los
  ticks medidos y una vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick
- **AND** la media medida se anota en el verify-report frente al objetivo de ≤ 0,25 ms

#### Scenario: Peor caso con peligros
- **GIVEN** una partida con el contenido por defecto, semilla fija con su mapa generado, 300 enemigos vivos de los
  que ≥ 100 son `goblin-barrel` y ≥ 100 `goblin-tnt`, el tope de dinamitas en vuelo en todos los ticks medidos, ≥ 1
  explosión con ≥ 50 enemigos dentro de su radio en ≥ 1 de cada 10 ticks medidos, y una vida del jugador suficiente
  para no llegar a 0 en 600 ticks (los enemigos abatidos se reponen para mantener 300 vivos)
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
- **AND** la media medida se anota en el verify-report frente al objetivo de ≤ 0,25 ms

#### Scenario: Peor caso con gemas
- **GIVEN** una partida con semilla fija, 300 enemigos vivos, `maxProjectiles` (32) proyectiles vivos y `maxGems`
  (300) gemas atraídas, todas a ≥ 400 px del jugador para que ninguna se recoja durante la medición, y una vida del
  jugador suficiente para no llegar a 0
- **WHEN** el benchmark mide 60 ticks consecutivos (60 × 6 px = 360 px < 400)
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: 300 enemigos sin línea libre
- **GIVEN** una partida con el contenido por defecto y un mapa generado, el jugador quieto al otro lado del río
  respecto a 300 enemigos vivos repartidos por el mundo, de modo que ≥ 150 de ellos no tienen línea libre en cada
  tick medido, y una vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: Cálculo del campo
- **GIVEN** el contenido por defecto y los mapas generados de las semillas 1 a 50
- **WHEN** el benchmark calcula en cada mapa el campo de distancias hacia la celda de la salida y hacia la celda (0, 0)
- **THEN** la media es ≤ 0,1 ms por cálculo

#### Scenario: Jugador que cambia de celda en cada tick
- **GIVEN** una partida con el contenido por defecto, semilla fija con su mapa generado, 300 enemigos vivos y un
  jugador cuyo centro cambia de celda en cada tick medido (colocado por el escenario, no por el input)
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick

### Requirement: Orden de los pasos del tick
El sistema SHALL ejecutar cada tick de una partida en curso en este orden:
1. movimiento del jugador según el input (velocidad efectiva, ver `upgrades`), con la colisión con las celdas no
   caminables, las de obra incluidas; después, movimiento de las ovejas vivas, en el orden de su lista, con la posición
   del jugador ya movido: huida o deambular (ver "Huida del jugador" y "Deambular de las ovejas" en `sheep`);
2. comportamiento de los enemigos vivos, en el orden de la lista de enemigos (ver "Estado de comportamiento de cada
   enemigo" en `enemy-behavior`): primero, las esperas que terminan en este tick pasan a su estado de destino; después,
   los enemigos en persecución o en alerta persiguen la nueva posición del jugador, con el campo de distancias de la
   celda que ocupa el centro del jugador tras el paso 1 (ver "Navegación por el campo de flujo"), y los que están en
   patrulla o en vuelta se dirigen a su punto (ver "Navegación hacia un punto fijo"); por último, se aplican las
   transiciones tras moverse: salida por distancia (mecha o carga), detección, pérdida y llegada al puesto. Los
   enemigos en mecha, carga o espera no se mueven;
3. armas (ver `auto-weapons`) y torres (ver "Torre que dispara sola" en `build-sites`), en este orden:
   1. movimiento, impacto y caducidad de los proyectiles existentes del jugador, en orden de creación (contra enemigos
      y, los dirigidos a una estructura, contra estructuras, y los dirigidos a una oveja, contra ovejas); después, de
      las flechas de torre existentes, en orden de creación, solo contra enemigos;
   2. cada arma del jugador, en el orden de `content/weapons.json`, elige objetivo con las posiciones de ese momento
      (enemigos primero; estructuras no destruidas solo si no hay enemigos en alcance; ovejas vivas solo si tampoco hay
      estructuras en alcance) y, si está cargada y lo tiene, dispara (crea su proyectil o aplica su pulso); después,
      cada torre construida, en el orden de la lista de solares, elige objetivo entre los enemigos vivos desde su punto
      de disparo y, si está cargada, lo tiene y hay plaza en la reserva de flechas, dispara su flecha;
   3. los enemigos cuya vida ha llegado a 0 en este tick quedan dados de baja, suman cada uno 1 al contador de bajas
      y sueltan, en el orden de la lista de enemigos, su gema, si son un `goblin-barrel` su madera, si su tipo tiene
      oro por baja su oro y después hacen su tirada de piedra (1 valor del azar de la piedra) y, si sale, sueltan
      su piedra (ver `xp-gems`, "Madera del barril abatido" en `enemy-hazards`, "Oro por enemigo abatido" y "Piedra por
      enemigo abatido" en `resources` y `run-outcome`);
   4. las estructuras cuya vida ha llegado a 0 en este tick quedan destruidas y sueltan su oro, en el orden de la lista
      de estructuras, sin gema ni baja (ver `goblin-structures`);
   5. las ovejas cuya vida ha llegado a 0 en este tick mueren y sueltan su carne, en el orden de la lista de ovejas,
      sin gema ni baja (ver "Vida, daño y muerte de las ovejas" en `sheep` y "Carne de las ovejas abatidas" en
      `resources`);
4. peligros (ver `enemy-hazards`), en este orden:
   1. explosiones del tick: las de los barriles vivos cuya mecha termina en este tick, en el orden de la lista de
      enemigos, y después las de las dinamitas cuyo vuelo termina en este tick, en orden de creación; cada una daña a
      los enemigos vivos de su radio (fuego amigo) y a las ovejas vivas de su radio, no daña estructuras, vetas ni
      edificios, y queda registrada como golpe candidato si alcanza al jugador;
   2. los barriles que han explotado y los enemigos cuya vida ha llegado a 0 en este paso quedan dados de baja, suman
      cada uno 1 al contador de bajas y sueltan su gema, en el orden de la lista de enemigos; los `goblin-barrel` dados
      de baja sin haber explotado sueltan además su madera, el resto suelta su oro por baja tras su gema (y su
      madera), y cada baja hace después su tirada de piedra (1 valor del azar de la piedra) y suelta su piedra si sale;
      los que han explotado hacen la tirada pero no sueltan madera, oro ni piedra; después, las ovejas cuya vida ha
      llegado a 0 en este paso mueren y sueltan su carne, en el orden de la lista de ovejas;
   3. lanzamientos: cada enemigo vivo cuya carga termina en este tick o que sigue en carga esperando sitio, en el
      orden de la lista de enemigos, lanza una dinamita hacia la posición del jugador tras el paso 1 si hay sitio bajo
      el tope de dinamitas, y entra en espera;
5. golpe al jugador (ver `player-health`): con los contactos de los enemigos vivos con daño por contacto y las
   explosiones del paso 4.1 que le alcanzan, un solo golpe del mayor daño, reducido por la armadura con un mínimo de 1,
   si no está invulnerable (las ovejas no son golpe candidato); si la vida llega a 0, la partida termina con derrota y
   el tick acaba aquí;
6. si el número de este tick es igual a la duración objetivo en ticks, la partida termina con victoria y el tick
   acaba aquí (ver `run-outcome`);
7. recogibles, vetas, regeneración e ingresos de las casas:
   1. recogibles de los cinco tipos, en orden de creación: atracción, movimiento del imán y recogida; la XP recogida
      se suma con su bonificación y se registran las subidas de nivel (ver `xp-gems` y `leveling`), el oro recogido se
      suma con su bonificación, la madera y la piedra recogidas se suman a sus contadores (ver `resources`) y la carne
      recogida cura al jugador (ver "Curación por carne" en `player-health`);
   2. vetas, en el orden de su lista: cada veta activa en contacto con el jugador suma su oro, con su bonificación, y
      queda agotada (ver "Vetas de oro al pasar" en `resources`);
   3. regeneración, si el número de este tick es múltiplo del intervalo (ver "Regeneración de vida" en
      `player-health`);
   4. ingresos de las casas: cada casa construida a la que le toca pagar en este tick, en el orden de la lista de
      solares, suma su oro como ingreso, con su bonificación (ver "Oro periódico de las casas" en `build-sites`);
8. director de oleadas (spawns, con la recolocación de las apariciones en celdas caminables, ver `enemy-spawning`);
9. nacimientos:
   1. nacimiento de guardias en las casas no destruidas, en el orden de la lista de estructuras (ver "Nacimiento de
      guardias en casas" en `enemy-spawning`);
   2. reaparición de ovejas: las reapariciones pendientes que tocan en este tick, en su orden, con la posición del
      jugador tras el paso 1 (ver "Reaparición de ovejas" en `sheep`);
10. si hay ≥ 1 subida pendiente: con ≥ 1 mejora de personaje disponible se abre la oferta (consume azar) y la partida
    pasa a eligiendo mejora (ver `upgrades` y `run-state`); sin ninguna, cada subida pendiente cura (ver "Curación por
    subida sin mejoras" en `leveling`); el tick cuenta igualmente;
11. puerta de la tienda (ver "Apertura por la puerta con re-armado" en `castle-shop`): se arma si procede y, si la
    partida sigue en curso, se abre la tienda si procede y la partida pasa a en tienda; el tick cuenta igualmente;
12. solares, en el orden de su lista (ver "Apertura del solar con re-armado" en `build-sites`): cada solar `free` se arma
    si el jugador se ha separado lo suficiente de su huella y, si la partida sigue en curso, se abre la oferta del
    primero armado que el jugador toca, se pueda pagar algo o no, y la partida pasa a en obra; el tick cuenta
    igualmente.

En una partida terminada, que está eligiendo mejora, que está en tienda o que está en obra no se ejecuta ningún paso
(ver `run-state`).

#### Scenario: El contacto usa las posiciones tras moverse ambos
- **GIVEN** un jugador en (480, 270) con radio 16, velocidad 200, vida 100 e input (1, 0), y un enemigo con
  radio 10, velocidad 60, vida suficiente para no morir en este tick y damage 10 en (510, 270) (distancia inicial
  30 > 26)
- **WHEN** se ejecuta 1 tick (jugador en 483,333; enemigo en 509; distancia 25,667 < 26)
- **THEN** la vida del jugador vale 90

#### Scenario: Solo el movimiento del jugador no basta
- **GIVEN** un jugador en (480, 270) con radio 16, velocidad 200, vida 100 e input (1, 0), y un enemigo con
  radio 10, velocidad 60, vida suficiente para no morir en este tick y damage 10 en (512, 270)
- **WHEN** se ejecuta 1 tick (jugador en 483,333; enemigo en 511; distancia 27,667 > 26)
- **THEN** la vida del jugador sigue valiendo 100

#### Scenario: La persecución usa la celda del jugador ya movido
- **GIVEN** un mapa de hierba con troncos en las celdas (10, 2) a (10, 6), un jugador en (958, 270) (celda (15, 4)) con
  velocidad 200 e input (1, 0), que tras moverse queda en (961,333; 270) (celda (16, 4)), y un enemigo con velocidad 60
  en (330, 270) sin línea libre
- **WHEN** se ejecuta 1 tick
- **THEN** el enemigo queda exactamente en la misma posición que en una partida igual con el jugador quieto en
  (961,333; 270) desde el principio e input (0, 0)

#### Scenario: Un enemigo recién aparecido no golpea en su tick de aparición
- **GIVEN** el contenido de spawn por defecto (`minDistance` 200) y un jugador quieto
- **WHEN** aparece un enemigo en el tick n
- **THEN** la vida del jugador tras el tick n es la misma que tras el tick n − 1, si ningún otro enemigo le toca

#### Scenario: Un enemigo recién aparecido no es objetivo en su tick de aparición
- **GIVEN** una partida sin enemigos vivos, estructuras ni ovejas y armas cargadas, en la que el director hace aparecer
  un enemigo en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n no tiene proyectiles ni pulsos nuevos y el enemigo tiene su vida inicial

#### Scenario: Las armas apuntan tras la persecución
- **GIVEN** un jugador quieto en (480, 270), Tests cargado y un `goblin-torch` de radio 10 y velocidad 90 que, al
  empezar el tick, está a distancia 101 (tras la persecución, a 99,5)
- **WHEN** se ejecuta 1 tick
- **THEN** Tests dispara un pulso en ese tick y el `goblin-torch` queda con vida 6

#### Scenario: Las armas apuntan tras la huida de las ovejas
- **GIVEN** un jugador quieto en (1.108, 1.000), Tests cargado, ningún enemigo ni estructura y la oveja de prueba en
  (1.000, 1.000) (distancia 108 < 90 + 20 antes de huir)
- **WHEN** se ejecuta 1 tick (la oveja huye a (997, 1.000), a 111 px)
- **THEN** Tests no dispara, sigue cargado y la oveja conserva vida 12

#### Scenario: Una baja libera el hueco antes del director
- **GIVEN** `maxAlive` 1, un único `goblin-torch` vivo con vida 4 y un director con presupuesto para 1 `goblin-torch` y
  `goblin-torch` como tipo pendiente
- **WHEN** en el tick n el `goblin-torch` muere por un impacto del Linter
- **THEN** el snapshot del tick n tiene exactamente 1 enemigo vivo, distinto del muerto

#### Scenario: El imán usa la posición del jugador ya movido
- **GIVEN** un jugador en (480, 270) con velocidad 200 e input (1, 0) y una gema en (546, 270) (distancia 66 > 64
  antes de moverse)
- **WHEN** se ejecuta 1 tick (jugador en 483,333; distancia 62,667 ≤ 64)
- **THEN** la gema está atraída y a 56,667 px del jugador (error ≤ 0,001)

#### Scenario: El director actúa antes de abrir la oferta
- **GIVEN** una partida en nivel 1 con XP 4, una gema de valor 1 que se recoge en el tick n y un director con
  presupuesto para 1 `goblin-torch` en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n contiene el `goblin-torch` nuevo y la oferta abierta, con la partida eligiendo mejora

#### Scenario: El tick de la victoria acaba tras el contacto
- **GIVEN** una partida con duración objetivo de 120 ticks, el jugador vivo y no invulnerable, un enemigo con damage
  10 en contacto en el tick 120, una gema que se recogería en el tick 120 y un director con presupuesto para 1
  `goblin-torch` en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la vida del jugador ha bajado 10 y sigue > 0, y la partida está terminada con victoria
- **AND** la gema sigue en el snapshot, la XP no cambia y no aparece ningún enemigo nuevo en el tick 120

#### Scenario: Sin recursos en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks, oro 0 y madera 0, un recogible `gold` y uno `wood` que se
  recogerían en el tick 120 y una veta activa con la que el jugador entra en contacto en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida está terminada con victoria, los dos recogibles siguen en el snapshot, la veta sigue activa y el
  oro y la madera siguen en 0

#### Scenario: Las armas actúan en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks y Tests cargado con un `goblin-torch` de vida 4 en su radio
  en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** el `goblin-torch` queda dado de baja, su gema está en el snapshot del tick 120 y las bajas suben en 1

#### Scenario: Las armas actúan antes que la mecha
- **GIVEN** un `goblin-barrel` con vida 4 cuya mecha termina en el tick n y que recibe un impacto mortal del Linter en
  el tick n, con el jugador dentro del radio de su explosión
- **WHEN** se ejecuta el tick n
- **THEN** no hay explosión, el jugador no pierde vida y las bajas suben exactamente en 1
- **AND** hay 1 recogible `wood` nuevo de ese barril

#### Scenario: La explosión de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks, el jugador a vida 100, no invulnerable, y una dinamita de
  daño 20 que le alcanza en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la vida vale 80 y la partida está terminada con victoria

#### Scenario: La explosión libera hueco para el director
- **GIVEN** `maxAlive` 1, un único `goblin-barrel` cuya mecha termina en el tick n y un director con presupuesto para 1
  `goblin-torch`
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n tiene exactamente 1 enemigo vivo, un `goblin-torch`

#### Scenario: Lanzamiento con la posición del jugador ya movido
- **GIVEN** un jugador en (1.000, 1.000) con velocidad 210 e input (0, 1) y un `goblin-tnt` cuya carga termina en el
  tick n
- **WHEN** se ejecuta el tick n
- **THEN** la dinamita nueva tiene objetivo (1.000, 1.003,5) (error ≤ 0,001)

#### Scenario: Un enemigo muerto por explosión no golpea en ese tick
- **GIVEN** un jugador con vida 100, no invulnerable, en contacto con un `goblin-torch` de vida 10 y damage 5, y una
  explosión de daño 25 en el tick n que alcanza al `goblin-torch` pero no al jugador
- **WHEN** se ejecuta el tick n
- **THEN** el `goblin-torch` queda dado de baja y la vida del jugador sigue en 100

#### Scenario: La espera termina antes de moverse
- **GIVEN** un `goblin-tnt` de velocidad 45 cuya espera termina en el tick n, a 300 px del jugador quieto y con
  distancia de lanzamiento 200
- **WHEN** se ejecuta el tick n
- **THEN** en el snapshot del tick n el `goblin-tnt` está en persecución y se ha acercado 0,75 px (error ≤ 0,001)

#### Scenario: Una casa destruida no hace nacer en ese tick
- **GIVEN** una casa con vida 6, sin guardias vivos, cuyo nacimiento tocaría en el tick n, y un impacto del Linter de
  daño 6 sobre ella en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la casa figura destruida en el snapshot del tick n y no nace ningún guardia

#### Scenario: Las estructuras se destruyen tras las bajas
- **GIVEN** una partida con 2 bajas, un pulso de Tests en el tick n que deja a vida 0 a un `goblin-torch` y a una torre
- **WHEN** se ejecuta el tick n
- **THEN** en el snapshot del tick n las bajas valen 3, hay 1 gema nueva (la del `goblin-torch`) y la torre figura
  destruida
- **AND** hay 1 recogible `gold` nuevo, creado después de la gema

#### Scenario: Las ovejas mueren tras las estructuras
- **GIVEN** una partida con 2 bajas y un pulso de Tests en el tick n que deja a vida 0 a un `goblin-torch`, a una
  torre y a una oveja
- **WHEN** se ejecuta el tick n
- **THEN** en el snapshot del tick n las bajas valen 3, la oveja no figura y se han creado en este orden la gema, el
  `gold` de la torre y el `meat` de la oveja

#### Scenario: Oro de una estructura recogido en su tick
- **GIVEN** oro por torre 15, el jugador quieto con oro 0 a 10 px del centro de una torre con vida 4 que el pulso de
  Tests deja a vida 0 en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el recogible `gold` de la torre se crea y se recoge en el tick n, y el oro vale 15 en su snapshot

#### Scenario: Recogibles antes que las vetas
- **GIVEN** un jugador quieto con oro 0 en contacto con una veta activa de oro 15 y con un recogible `gold` de valor 10
  solapado, en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el oro vale 25 en el snapshot del tick n, el recogible ha desaparecido y la veta figura agotada

#### Scenario: El guardia nacido no se mueve en su tick
- **GIVEN** una casa que hace nacer un guardia de radio 22 y daño por contacto 15 en el tick n, con el jugador quieto,
  no invulnerable y a 30 px de su puerta (< 22 + 16), y ningún otro enemigo
- **WHEN** se ejecuta el tick n
- **THEN** en el snapshot del tick n el guardia está en la puerta, en patrulla, y la vida del jugador no ha bajado
  (el golpe del paso 5 va antes del nacimiento)

#### Scenario: La oveja reaparecida no se mueve ni es objetivo en su tick
- **GIVEN** el mapa vacío, el Linter y Tests cargados, ningún enemigo ni estructura, y una reaparición de oveja que toca
  en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n tiene la oveja nueva en el centro de su celda, en `graze`, con la vida del contenido,
  y ningún proyectil ni pulso nuevo
- **AND** en el tick n + 1 la oveja sigue en el centro de su celda (primer tick de su pasto) si el jugador está a ≥ su
  radio de huida

#### Scenario: Oro de la baja tras su gema en el paso de armas
- **GIVEN** oro por baja de `goblin-torch` 2, una torre con vida 4 y un `goblin-torch` con vida 4, ambos dentro del
  radio de un pulso de Tests del tick n
- **WHEN** se ejecuta el tick n
- **THEN** se crean en este orden la gema del `goblin-torch`, su `gold` de valor 2 y el `gold` de la torre

#### Scenario: Regeneración tras los recogibles
- **GIVEN** un jugador con vida 99 de 100, regeneración 5, intervalo 60 y un recogible `meat` de valor 1 que se recoge
  en el tick 60 con curación del 20 %
- **WHEN** se ejecuta el tick 60
- **THEN** la vida vale 100 (la carne la llena y la regeneración no la sube más)

#### Scenario: La tienda se abre tras el director
- **GIVEN** la tienda armada, el jugador que entra en el radio de la puerta en el tick n y un director con presupuesto
  para 1 `goblin-torch` en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n contiene el `goblin-torch` nuevo y la partida está en tienda

#### Scenario: Piedra de la baja tras su oro y antes de la estructura
- **GIVEN** oro por baja de `goblin-torch` 2 y probabilidad de piedra 100, una torre con vida 4 y un `goblin-torch` con
  vida 4, ambos dentro del radio de un pulso de Tests del tick n
- **WHEN** se ejecuta el tick n
- **THEN** se crean en este orden la gema del `goblin-torch`, su `gold` de valor 2, su `stone` de valor 1 y el `gold` de
  la torre

#### Scenario: Sin piedra en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks, piedra 0 y un recogible `stone` que se recogería en el tick
  120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida está terminada con victoria, el recogible sigue en el snapshot y la piedra sigue en 0

#### Scenario: Tirada en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks, probabilidad de piedra 100 en `goblin-torch` y Tests cargado
  con un `goblin-torch` de vida 4 en su radio en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** el `goblin-torch` queda dado de baja y su gema y su piedra están en el snapshot del tick 120

#### Scenario: Las armas antes que la mecha, con piedra
- **GIVEN** probabilidad de piedra 100 en `goblin-barrel` y un `goblin-barrel` con vida 4 cuya mecha termina en el tick
  n y que recibe un impacto mortal del Linter en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** no hay explosión, hay 1 recogible `wood` y 1 `stone` nuevos de ese barril y el azar de la piedra ha consumido
  1 valor (y solo 1: el barril no vuelve a tirar en el paso de peligros)

#### Scenario: Las flechas después de las armas del jugador
- **GIVEN** un `goblin-torch` con vida 6, un proyectil del Linter (daño 6) y una flecha de torre que lo solapan en el
  tick n
- **WHEN** se ejecuta el tick n
- **THEN** el `goblin-torch` queda dado de baja por el proyectil del Linter, el proyectil desaparece y la flecha sigue
  en vuelo

#### Scenario: Pago de la casa tras la regeneración
- **GIVEN** una casa que paga en el tick n, un recogible `gold` de valor 1 que se recoge en el tick n, g = 50, oro 0 y
  resto 0
- **WHEN** se ejecuta el tick n
- **THEN** el oro vale 3: primero el recogible (⌊150 / 100⌋ = 1, resto 50) y después la casa (⌊(150 + 50) / 100⌋ = 2)

#### Scenario: Solar abierto con los recursos del mismo tick
- **GIVEN** el solar de prueba (`build-sites`) armado, madera 14 y un recogible `wood` de valor 1 que se recoge en el
  tick n, el mismo en que el jugador toca la huella por primera vez
- **WHEN** se ejecuta el tick n
- **THEN** la partida está en obra en el snapshot del tick n y la opción `house` de la oferta es asequible

### Requirement: Pintado de los enemigos vivos
El adaptador de render SHALL mostrar en cada frame exactamente un sprite de enemigo visible por cada enemigo del
último snapshot, en su posición y con el aspecto de su tipo (hoja, escala y origen, ver `sprite-rendering`), también
después de bajas. El tamaño en pantalla lo fija el aspecto de su tipo, no su radio. MUST NOT quedar visible ningún
sprite de enemigo de un enemigo dado de baja; su cadáver, si lo hay, no cuenta como sprite de enemigo (ver
"Animación de muerte de los enemigos" en `sprite-rendering`).

#### Scenario: Bajas en medio de la lista
- **GIVEN** un snapshot con 10 enemigos de identificadores 1 a 10 y tipos mezclados ya pintado
- **WHEN** se pinta un snapshot en el que los enemigos 3 y 7 se han dado de baja y el resto no se ha movido
- **THEN** hay exactamente 8 sprites de enemigo visibles
- **AND** para cada enemigo del snapshot hay un sprite de enemigo visible en su posición (error ≤ 0,001) con el
  aspecto de su tipo

#### Scenario: Todos dados de baja
- **GIVEN** un snapshot con 200 enemigos ya pintado
- **WHEN** se pinta un snapshot sin enemigos
- **THEN** no hay ningún sprite de enemigo visible (los cadáveres se cuentan aparte)

#### Scenario: Reposición tras bajas
- **GIVEN** un snapshot con 200 enemigos ya pintado
- **WHEN** se pinta un snapshot con 150 de esos enemigos y 50 enemigos nuevos de otro tipo
- **THEN** hay exactamente 200 sprites de enemigo visibles, cada uno con la posición y el aspecto de un enemigo
  distinto del snapshot

#### Scenario: Aspecto por tipo
- **GIVEN** un snapshot con 1 `goblin-torch`, 1 `goblin-tnt` y 1 `goblin-barrel`
- **WHEN** se pinta el snapshot
- **THEN** cada sprite de enemigo usa la hoja del aspecto de su tipo y las tres hojas son distintas

### Requirement: Sin tiempo acumulado durante la elección
El sistema SHALL no ejecutar ticks ni acumular tiempo real mientras la partida está eligiendo mejora: los frames que
el motor informe en ese estado MUST ejecutar 0 ticks y dejar el acumulador a 0. Si una oferta se abre en un tick de
un frame que tenía más ticks por ejecutar, los ticks restantes de ese frame se descartan y el acumulador queda a 0.
Tras la elección, el bucle sigue con las reglas de "Paso fijo de simulación", sin ráfaga de ticks de recuperación
por el tiempo pasado en la elección.

#### Scenario: Frames durante la elección
- **GIVEN** una partida con una oferta abierta en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms (≈ 10 s)
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Primer frame tras elegir
- **GIVEN** la partida del escenario anterior tras sus 600 frames
- **WHEN** se elige una opción y el motor informa de 16,667 ms
- **THEN** se ejecuta exactamente 1 tick y el snapshot tiene tick n + 1

#### Scenario: Oferta a mitad de frame
- **GIVEN** un bucle con acumulador a 0 y una partida que abrirá una oferta en el primer tick que ejecute
- **WHEN** el motor informa de 50 ms (3 ticks)
- **THEN** se ejecuta exactamente 1 tick y el acumulador queda a 0
- **AND** tras elegir, un frame de 8,334 ms ejecuta 0 ticks

### Requirement: Sin tiempo acumulado con la partida terminada
El sistema SHALL no ejecutar ticks ni acumular tiempo real mientras la partida está terminada: los frames que el
motor informe en ese estado MUST ejecutar 0 ticks y dejar el acumulador a 0. Si la partida termina en un tick de un
frame que tenía más ticks por ejecutar, los ticks restantes de ese frame se descartan y el acumulador queda a 0. La
partida nueva obtenida al reiniciar (ver `run-results`) empieza con el acumulador a 0, sin ráfaga de ticks por el
tiempo pasado en la pantalla de resultados.

#### Scenario: Frames con la partida terminada
- **GIVEN** una partida terminada en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms (≈ 10 s)
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Fin de partida a mitad de frame
- **GIVEN** un bucle con acumulador a 0 y una partida que terminará en el primer tick que ejecute
- **WHEN** el motor informa de 50 ms (3 ticks)
- **THEN** se ejecuta exactamente 1 tick y el acumulador queda a 0

#### Scenario: Primer frame de la partida nueva
- **GIVEN** una partida terminada sobre la que el motor ha informado de 600 frames de 16,667 ms
- **WHEN** se pulsa R y el motor informa de 16,667 ms
- **THEN** la partida nueva ejecuta exactamente 1 tick y su snapshot tiene tick 1
- **AND** si en su lugar el motor informa de 8,334 ms, la partida nueva ejecuta 0 ticks

### Requirement: Velocidad de simulación en modo E2E
El sistema SHALL resolver, una sola vez por carga de la página, una velocidad de simulación N entera en `1..15`
a partir de la URL:
- Si la URL **no** incluye `?e2e`, N vale 1 y el parámetro `speed` se ignora por completo, sin avisos, aunque esté
  presente y sea válido.
- Si la URL incluye `?e2e` y el modo manual está activo (ver "Modo de avance manual en modo E2E"), el modo manual
  gana: el parámetro `speed` se ignora por completo, sin avisos, sea válido o no, y ningún frame ejecuta ticks por
  la velocidad; `step(n)` ejecuta n ticks, no n × N.
- Si la URL incluye `?e2e`, el modo manual no está activo y no incluye `speed`, N vale 1, sin avisos.
- Si la URL incluye `?e2e`, el modo manual no está activo y `speed=<valor>`, el valor MUST validarse con zod antes
  de usarse: si es un entero en `[1, 15]`, N vale ese entero; si no, se ignora, N vale 1 y se emite exactamente 1
  aviso por consola que menciona `speed`.

La velocidad resuelta MUST aplicarse a la primera partida de la carga y a cada partida nueva obtenida al reiniciar
(ver `run-results`); el reinicio no vuelve a leer la URL ni emite avisos. La resolución de la velocidad corresponde a
la composición y su efecto al adaptador del motor: el núcleo (`src/domain`, `src/application`) MUST NOT recibir ni
conocer la velocidad, y la semilla, el contenido y las reglas del tick no cambian con ella. Sin el modo manual, el
comportamiento con `?e2e&speed=N` MUST ser idéntico al del change 0008.

#### Scenario: Velocidad válida en modo E2E
- **GIVEN** la URL `?e2e&speed=8`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 8 y no se emite ningún aviso que mencione `speed`

#### Scenario: Límites del rango
- **GIVEN** la URL `?e2e&speed=1` y, en otra carga, `?e2e&speed=15`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y 15 respectivamente, sin avisos que mencionen `speed`

#### Scenario: Velocidad inválida en modo E2E
- **GIVEN** la URL `?e2e&speed=0`, `?e2e&speed=16`, `?e2e&speed=-1`, `?e2e&speed=2.5`, `?e2e&speed=abc` o
  `?e2e&speed=`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1
- **AND** se emite exactamente 1 aviso por consola que menciona `speed`

#### Scenario: Sin velocidad en modo E2E
- **GIVEN** la URL `?e2e&seed=42`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y no se emite ningún aviso que mencione `speed`

#### Scenario: Velocidad ignorada fuera de E2E
- **GIVEN** la URL `?speed=8` y, en otra carga, `?seed=42&speed=8`
- **WHEN** arranca la partida y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** se ejecuta exactamente 1 tick
- **AND** no se emite ningún aviso que mencione `speed`

#### Scenario: Velocidad inválida ignorada fuera de E2E
- **GIVEN** la URL `?speed=abc` y, en otra carga, `?speed=16`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y no se emite ningún aviso que mencione `speed`

#### Scenario: Avisos independientes de seed y speed
- **GIVEN** la URL `?e2e&seed=abc&speed=abc`
- **WHEN** arranca la partida
- **THEN** se emite exactamente 1 aviso que menciona `seed` y exactamente 1 aviso que menciona `speed`

#### Scenario: La velocidad se mantiene al reiniciar
- **GIVEN** la URL `?e2e&speed=8` y una primera partida terminada
- **WHEN** se pulsa R y el motor informa de 1 frame de 16,667 ms
- **THEN** la partida nueva ejecuta exactamente 8 ticks y su snapshot tiene tick 8

#### Scenario: Reinicio tras una velocidad inválida
- **GIVEN** la URL `?e2e&speed=abc`, que emitió 1 aviso al arrancar la primera partida, y esa partida terminada
- **WHEN** se pulsa R 3 veces, terminando cada partida antes del siguiente reinicio
- **THEN** cada partida nueva ejecuta 1 tick por frame de 16,667 ms y el total de avisos que mencionan `speed`
  sigue siendo 1

#### Scenario: Manual gana a speed
- **GIVEN** la URL `?e2e&manual&speed=8&seed=7` y la partida recién arrancada al cargar
- **WHEN** el motor informa de 120 frames de 16,667 ms sin llamar a `step`
- **THEN** `snapshot.tick` sigue valiendo 0 y no se emite ningún aviso que mencione `speed`
- **AND** con la partida en curso y sin ofertas ni fin en los próximos 10 ticks, `step(10)` devuelve 10 y
  `snapshot.tick` vale 10 (no 80)

#### Scenario: Manual con speed inválida
- **GIVEN** la URL `?e2e&manual&speed=abc` y, en otra carga, `?e2e&manual&speed=16`
- **WHEN** arranca la partida
- **THEN** no se emite ningún aviso que mencione `speed` y la partida no avanza sin `step`

#### Scenario: Manual inválido no anula speed
- **GIVEN** la URL `?e2e&manual=abc&speed=8`
- **WHEN** arranca la partida y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** se ejecutan exactamente 8 ticks
- **AND** se emite exactamente 1 aviso que menciona `manual` y ninguno que mencione `speed`

### Requirement: Avance acelerado por frame
Con velocidad N, el sistema SHALL procesar cada frame que el motor informe con d ms como N avances consecutivos del
bucle de paso fijo, cada uno con d ms y con las reglas de velocidad 1 (incluido el tope de 250 ms por avance), de
modo que un frame de velocidad N ejecute los mismos ticks que N frames consecutivos de d ms a velocidad 1. El input
del jugador MUST leerse una vez por frame y aplicarse a todos los ticks de ese frame. En cuanto la partida deja de
estar en curso (se abre una oferta de mejora o la partida termina con victoria o derrota), los avances y ticks
restantes del frame MUST descartarse y el acumulador MUST quedar a 0. Mientras la partida está eligiendo mejora o
terminada, los frames MUST ejecutar 0 ticks y dejar el acumulador a 0 con cualquier N. Con N = 1 el comportamiento
MUST ser idéntico al actual.

#### Scenario: Un frame de 1/60 s a velocidad 8
- **GIVEN** un bucle recién creado con acumulador a 0, velocidad 8 y una partida en curso que no abre ofertas ni
  termina en los próximos 8 ticks
- **WHEN** el motor informa de 16,667 ms
- **THEN** se ejecutan exactamente 8 ticks y el snapshot tiene tick 8

#### Scenario: Monitor de 120 Hz a velocidad 8
- **GIVEN** un bucle recién creado, velocidad 8 y una partida en curso que no abre ofertas ni termina en los
  próximos 8 ticks
- **WHEN** el motor informa de 1 frame de 8,334 ms
- **THEN** se ejecutan exactamente 4 ticks (igual que 8 frames de 8,334 ms a velocidad 1)

#### Scenario: Velocidad máxima con frame congelado
- **GIVEN** un bucle recién creado, velocidad 15 y una partida en curso que no abre ofertas ni termina en los
  próximos 225 ticks
- **WHEN** el motor informa de 5.000 ms en un solo frame
- **THEN** se ejecutan exactamente 225 ticks (15 avances × 15 ticks)

#### Scenario: Tiempo negativo o no numérico a velocidad 8
- **GIVEN** un bucle recién creado y velocidad 8
- **WHEN** el motor informa de −10 ms o de `NaN`
- **THEN** se ejecutan 0 ticks y el acumulador no cambia

#### Scenario: Velocidad 1 sin cambios
- **GIVEN** dos bucles recién creados con el mismo estado inicial, uno sin velocidad configurada y otro con
  velocidad 1, e input (1, 0) constante
- **WHEN** ambos reciben la misma secuencia de 600 frames de 16,667 ms
- **THEN** ambos ejecutan 600 ticks y sus snapshots son iguales campo a campo tras cada frame

#### Scenario: Oferta a mitad de frame acelerado
- **GIVEN** un bucle con acumulador a 0, velocidad 8 y una partida que abrirá una oferta en el 3.er tick que ejecute
- **WHEN** el motor informa de 16,667 ms
- **THEN** se ejecutan exactamente 3 ticks, la partida está eligiendo mejora y el acumulador queda a 0
- **AND** tras elegir, un frame de 8,334 ms ejecuta 4 ticks (no hay ráfaga de los 5 ticks descartados)

#### Scenario: Fin de partida a mitad de frame acelerado
- **GIVEN** un bucle con acumulador a 0, velocidad 15 y una partida que terminará en el 1.er tick que ejecute
- **WHEN** el motor informa de 50 ms
- **THEN** se ejecuta exactamente 1 tick, la partida está terminada y el acumulador queda a 0

#### Scenario: Frames durante la elección a velocidad 15
- **GIVEN** velocidad 15 y una partida con una oferta abierta en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Frames con la partida terminada a velocidad 15
- **GIVEN** velocidad 15 y una partida terminada en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Input único por frame
- **GIVEN** velocidad 8, una partida en curso que no abre ofertas ni termina en los próximos 8 ticks, el jugador en
  (480, 270) con velocidad 200 y un input (1, 0) leído al empezar el frame que deja de estar activo antes de que el
  frame termine
- **WHEN** el motor informa de 16,667 ms
- **THEN** los 8 ticks del frame usan el input (1, 0) y el jugador queda en x = 480 + 8 × 3,333 (error ≤ 0,01),
  si no lo limita el borde del mundo

### Requirement: Mismo resultado con cualquier velocidad
El sistema SHALL producir el mismo desenlace de partida con cualquier velocidad N en `1..15` para la misma semilla,
el mismo contenido, input constante y la política de elección fija: resultado (victoria o derrota), tick en que
termina, nivel, bajas y lista de mejoras adquiridas con sus niveles MUST ser idénticos a los de velocidad 1. La
velocidad solo cambia cuántos ticks se ejecutan por frame, no cuáles ni en qué orden. Los escenarios de derrota usan
semillas del conjunto 1..50, en el que un jugador quieto pierde antes de 180 s con cualquier semilla (ver
`run-outcome`, "Partida ganable y perdible con el contenido por defecto"); no dependen de que una semilla concreta
pierda antes que otra.

#### Scenario: Derrota equivalente con la semilla 42
- **GIVEN** cuatro partidas con el contenido por defecto, la semilla 42, input (0, 0) constante y la política de
  elección fija, a velocidades 1, 4, 8 y 15
- **WHEN** el motor informa de frames de 16,667 ms hasta que cada partida termina o hasta 36.000 ticks
- **THEN** las cuatro terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la
  misma lista de mejoras adquiridas con sus niveles

#### Scenario: Derrota equivalente con otra semilla del conjunto
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7 (del conjunto 1..50), input (0, 0) constante y
  la política de elección fija, a velocidades 1 y 8
- **WHEN** el motor informa de frames de 16,667 ms hasta que cada partida termina o hasta 36.000 ticks
- **THEN** ambas terminan con resultado derrota antes del tick 10.800, en el mismo tick, con el mismo nivel, las
  mismas bajas y la misma lista de mejoras adquiridas con sus niveles

#### Scenario: Equivalencia con frames irregulares
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (1, 0) constante y la política de
  elección fija, una a velocidad 1 y otra a velocidad 8
- **WHEN** ambas reciben frames con duraciones que alternan 8,334 ms, 16,667 ms y 33,334 ms hasta que terminan o
  hasta 36.000 ticks
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la misma
  lista de mejoras adquiridas con sus niveles

#### Scenario: Snapshots iguales tick a tick
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, input (0, 0) constante y la política de
  elección fija, a velocidades 1 y 8
- **WHEN** ambas avanzan hasta el tick 1.200
- **THEN** el snapshot de la partida a velocidad 8 en el tick 1.200 es igual campo a campo al de la partida a
  velocidad 1 en el tick 1.200

### Requirement: Sin tiempo acumulado durante la pausa ni antes de jugar
El sistema SHALL no ejecutar ticks ni acumular tiempo real mientras la partida está en pausa (ver `main-menu`) o
mientras se ve el aviso de orientación vertical del modo móvil (ver "Aviso de orientación vertical" en
`touch-controls`), y en lo que sigue "en pausa" incluye ambos casos: los frames que el motor informe con la partida en
pausa MUST ejecutar 0 ticks, sea cual sea su duración (incluidos frames largos por una pestaña oculta), y el acumulador
MUST quedar a 0 desde el momento de pausar, descartando el tiempo sobrante que tuviera. Al reanudar (o al desaparecer el
aviso) no se pierde ni se gana tiempo simulado: el snapshot es el mismo que al pausar y el bucle sigue con las reglas de
"Paso fijo de simulación" y "Avance acelerado por frame", sin ráfaga de ticks de recuperación por el tiempo pasado en
pausa. Del mismo modo, la partida que empieza al pulsar `Jugar` MUST empezar con el acumulador a 0, sin ráfaga por el
tiempo pasado en el menú. Esto vale con cualquier velocidad N en `1..15`. El aviso de orientación no es la pausa del
jugador: no abre el overlay de pausa y no cambia si la partida estaba o no en pausa.

#### Scenario: Frames durante la pausa
- **GIVEN** una partida en curso en el tick n
- **WHEN** se pulsa Esc y el motor informa de 300 frames de 16,667 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue igual campo a campo al del tick n

#### Scenario: Primer frame tras reanudar
- **GIVEN** la partida del escenario anterior tras sus 300 frames en pausa
- **WHEN** se pulsa Esc de nuevo y el motor informa de 16,667 ms
- **THEN** se ejecuta exactamente 1 tick y el snapshot tiene tick n + 1

#### Scenario: Frame largo durante la pausa
- **GIVEN** una partida en pausa en el tick n
- **WHEN** el motor informa de 1 frame de 5.000 ms, se reanuda y el motor informa de 16,667 ms
- **THEN** el frame de 5.000 ms ejecuta 0 ticks y el primer frame tras reanudar ejecuta exactamente 1 tick (tick
  n + 1)

#### Scenario: Sobrante descartado al pausar
- **GIVEN** un bucle con una partida en curso que, tras un frame de 25 ms, ha ejecutado 1 tick y tiene 8,333 ms
  sobrantes
- **WHEN** se pulsa Esc, se reanuda sin que el motor informe de ningún frame y el motor informa de 8,334 ms
- **THEN** ese frame ejecuta 0 ticks
- **AND** un segundo frame de 8,334 ms ejecuta exactamente 1 tick

#### Scenario: Reanudar a velocidad 8
- **GIVEN** la URL `?e2e&speed=8` y una partida en pausa en el tick n que no abre ofertas ni termina en los próximos
  16 ticks
- **WHEN** el motor informa de 300 frames de 16,667 ms, se reanuda y el motor informa de 2 frames de 16,667 ms
- **THEN** durante la pausa se ejecutan 0 ticks y tras reanudar el snapshot tiene tick n + 8 después del primer
  frame y n + 16 después del segundo

#### Scenario: Pausa a velocidad 15 con frame largo
- **GIVEN** la URL `?e2e&speed=15` y una partida en pausa en el tick n
- **WHEN** el motor informa de 1 frame de 5.000 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Primer frame tras Jugar
- **GIVEN** el modo menú sobre el que el motor ha informado de 600 frames de 16,667 ms y, después, de 1 frame de
  5.000 ms
- **WHEN** se pulsa `Jugar` y el motor informa de 16,667 ms
- **THEN** la partida ejecuta exactamente 1 tick y su snapshot tiene tick 1
- **AND** si en su lugar el motor informa de 8,334 ms, la partida ejecuta 0 ticks

#### Scenario: Sobrante descartado con el aviso de orientación
- **GIVEN** el modo móvil y un bucle con una partida en curso, sin pausa, que tras un frame de 25 ms ha ejecutado
  1 tick y tiene 8,333 ms sobrantes
- **WHEN** la ventana pasa a vertical, el motor informa de 1 frame de 5.000 ms, la ventana vuelve a horizontal y el
  motor informa de 8,334 ms y después de otros 8,334 ms
- **THEN** el frame de 5.000 ms y el primero de 8,334 ms ejecutan 0 ticks y el segundo ejecuta exactamente 1 tick
- **AND** el overlay de pausa no se ha visto en ningún frame

### Requirement: Velocidad en todas las partidas de la carga
El sistema SHALL aplicar el modo de avance y la velocidad de simulación resueltos para la carga (ver "Modo de
avance manual en modo E2E" y "Velocidad de simulación en modo E2E") a todas las partidas de esa carga: la primera,
las obtenidas al reiniciar con R y las que empiezan al pulsar `Jugar` tras `Volver al menú`. Si el modo manual está
activo, todas esas partidas avanzan solo con `step(n)` y empiezan en el tick 0 sin ticks pendientes; si no, todas
usan la velocidad resuelta. Ninguna de ellas vuelve a leer la URL ni emite avisos que mencionen `speed` o `manual`.

#### Scenario: Velocidad tras volver al menú
- **GIVEN** la URL `?e2e&speed=8`, la primera partida abandonada con `Volver al menú`
- **WHEN** se pulsa `Jugar` y el motor informa de 1 frame de 16,667 ms
- **THEN** la partida nueva ejecuta exactamente 8 ticks y su snapshot tiene tick 8

#### Scenario: Velocidad inválida y varios Jugar
- **GIVEN** la URL `?e2e&speed=abc`, que emitió 1 aviso al cargar
- **WHEN** se abandona la partida con `Volver al menú` y se pulsa `Jugar`, 3 veces seguidas
- **THEN** cada partida nueva ejecuta 1 tick por frame de 16,667 ms y el total de avisos que mencionan `speed` sigue
  siendo 1

#### Scenario: Manual tras reiniciar con R
- **GIVEN** la URL `?e2e&manual&seed=7` y una primera partida terminada con `step`
- **WHEN** se pulsa R y pasan 2 s reales sin llamar a `step`
- **THEN** la partida nueva sigue en el tick 0
- **AND** con la partida en curso y sin ofertas ni fin en los próximos 10 ticks, `step(10)` devuelve 10 y
  `snapshot.tick` vale 10

#### Scenario: Manual tras volver al menú
- **GIVEN** la URL `?e2e&manual&seed=7` y la primera partida, en el tick 50, abandonada con `Volver al menú`
- **WHEN** se pulsa `Jugar` y el motor informa de 120 frames de 16,667 ms sin llamar a `step`
- **THEN** la partida nueva sigue en el tick 0
- **AND** con la partida en curso y sin ofertas ni fin en los próximos 10 ticks, `step(10)` devuelve 10 y
  `snapshot.tick` vale 10

#### Scenario: Manual inválido y varios reinicios
- **GIVEN** la URL `?e2e&manual=abc`, que emitió 1 aviso que menciona `manual` al cargar
- **WHEN** se pulsa R 3 veces, terminando cada partida antes del siguiente reinicio
- **THEN** cada partida nueva ejecuta 1 tick por frame de 16,667 ms y el total de avisos que mencionan `manual`
  sigue siendo 1

### Requirement: Modo de avance manual en modo E2E
El sistema SHALL resolver, una sola vez por carga de la página y junto con la semilla y la velocidad, si el
modo manual está activo, a partir de la URL:
- Si la URL **no** incluye `?e2e`, el modo manual no está activo y el parámetro `manual` se ignora por completo,
  sin avisos, tenga el valor que tenga.
- Si la URL incluye `?e2e` y no incluye `manual`, el modo manual no está activo, sin avisos.
- Si la URL incluye `?e2e` y `manual`, el valor MUST validarse con zod antes de usarse: si está vacío
  (`?e2e&manual` o `?e2e&manual=`), vale `1` o vale `true`, el modo manual está activo, sin avisos; con cualquier
  otro valor (`0`, `false`, `abc`, `2`…) el modo manual **no** está activo y se emite exactamente 1 aviso por
  consola que menciona `manual` en toda la carga.

Con `?e2e`, la sonda MUST exponer si el modo manual está activo (sí/no). La resolución corresponde a la
composición y su efecto al adaptador del motor: el núcleo (`src/domain`, `src/application`) MUST NOT recibir ni
conocer el modo manual ni `step`, y la semilla, el contenido y las reglas del tick no cambian con él.

#### Scenario: Modo manual activo
- **GIVEN** la URL `?e2e&manual&seed=7` y, en otras cargas, `?e2e&manual=1&seed=7` y `?e2e&manual=true&seed=7`
- **WHEN** arranca la partida al cargar
- **THEN** la sonda indica modo manual activo, la partida usa la semilla 7 y no se emite ningún aviso que
  mencione `manual`

#### Scenario: Sin manual en modo E2E
- **GIVEN** la URL `?e2e&seed=7`
- **WHEN** arranca la partida y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** la sonda indica modo manual no activo, se ejecuta exactamente 1 tick y no se emite ningún aviso que
  mencione `manual`

#### Scenario: Valor de manual inválido en modo E2E
- **GIVEN** la URL `?e2e&manual=0`, `?e2e&manual=false`, `?e2e&manual=abc` o `?e2e&manual=2`
- **WHEN** arranca la partida y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** la sonda indica modo manual no activo y se ejecuta exactamente 1 tick
- **AND** se emite exactamente 1 aviso por consola que menciona `manual`

#### Scenario: Manual ignorado fuera de E2E
- **GIVEN** la URL `?manual` y, en otras cargas, `?manual=1&seed=42` y `?manual=abc`
- **WHEN** se pulsa `Jugar` y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** se ejecuta exactamente 1 tick, `window.__sprint` no existe y no se emite ningún aviso que mencione
  `manual`
- **AND** al terminar la partida se guardan su récord y su historial como en una partida sin `manual`

#### Scenario: Avisos independientes de seed, speed y manual
- **GIVEN** la URL `?e2e&seed=abc&manual=abc&speed=abc`
- **WHEN** arranca la partida
- **THEN** se emite exactamente 1 aviso que menciona `seed`, exactamente 1 que menciona `manual` y exactamente 1
  que menciona `speed` (el modo manual no está activo, así que `speed` se valida como siempre)

### Requirement: Sin avance por tiempo real en modo manual
En modo manual, el sistema SHALL no ejecutar ticks por el paso del tiempo real: los frames que informe el motor
MUST ejecutar 0 ticks y no acumular tiempo, sea cual sea su duración (incluidos frames de 5.000 ms), y la partida
solo avanza con `step(n)`. El resto del adaptador MUST seguir atendiendo cada frame igual que en tiempo real:
teclado (dirección, Esc, R, M), clics de pausa y de elección de mejora, menú, panel `Sonido`, pantalla de resultados,
guardado y audio (ver `audio`). El reloj de render de modo manual (0014) avanza `n × TICK_MS` con cada `step(n)` y no
avanza con los frames del motor; el audio lo usa para su limitación por tipo.

#### Scenario: Sin step no avanza
- **GIVEN** la URL `?e2e&manual&seed=7` y la partida recién arrancada al cargar
- **WHEN** pasan 2 s reales sin llamar a `step`
- **THEN** `snapshot.tick` sigue valiendo 0

#### Scenario: Frames largos sin step
- **GIVEN** modo manual y una partida en curso en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms y después de 1 frame de 5.000 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue igual campo a campo al del tick n
- **AND** un `step(1)` posterior devuelve 1 y deja el snapshot en el tick n + 1 (sin ráfaga por ese tiempo)

#### Scenario: Pausa sin step
- **GIVEN** modo manual y una partida en curso en el tick n
- **WHEN** se pulsa Esc sin llamar a `step`
- **THEN** la partida queda en pausa y el panel de pausa está visible, con el snapshot en el tick n

#### Scenario: Elección sin step
- **GIVEN** modo manual y una partida con una oferta abierta en el tick n
- **WHEN** se hace clic en la opción de índice 0 sin llamar a `step`
- **THEN** la oferta se cierra, la mejora elegida figura en las mejoras adquiridas y el snapshot sigue en el
  tick n con la partida en curso

#### Scenario: Reinicio sin step
- **GIVEN** modo manual y una partida terminada con la pantalla de resultados visible
- **WHEN** se pulsa R sin llamar a `step`
- **THEN** empieza una partida nueva en el tick 0 y sigue en el tick 0 tras 2 s reales sin `step`

#### Scenario: Silencio sin step
- **GIVEN** modo manual y una partida en curso en el tick n sin silencio
- **WHEN** se pulsa M sin llamar a `step`
- **THEN** la sonda de audio informa del silencio activado y el snapshot sigue en el tick n

### Requirement: Avance manual con step
Con `?e2e`, la sonda SHALL ofrecer `step(n)`, que avanza la partida un número exacto de ticks y devuelve
cuántos ha ejecutado. En modo manual, con n válido y la partida en curso, `step(n)` MUST:
- leer el input del jugador una vez, al empezar, y aplicarlo a todos sus ticks (como un frame acelerado de
  "Avance acelerado por frame"); una tecla pulsada y soltada sin ningún `step` entre medias no llega a ningún tick;
- ejecutar exactamente n ticks, sin el tope de 15 ticks por frame ni de 250 ms, y sin que el número de ticks
  dependa de la duración de los frames que informe el motor mientras dura el `step`;
- detenerse en el tick en que la partida deja de estar en curso (se abre una oferta, se abre la tienda o termina con
  victoria o derrota), descartando los ticks restantes: nunca elige una mejora, nunca compra ni sale de la tienda y
  nunca ejecuta ticks tras el fin;
- terminar solo cuando el frame que refleja el snapshot final está pintado, y devolver el número k de ticks
  ejecutados (0 ≤ k ≤ n), de modo que `snapshot.tick` final = tick inicial + k.

`step(n)` MUST devolver 0 sin ejecutar ningún tick ni cambiar el snapshot cuando la partida está en pausa,
eligiendo mejora, en tienda o terminada, cuando se ve el aviso de orientación vertical del modo móvil (ver "Aviso de
orientación vertical" en `touch-controls`), cuando no hay partida (menú de inicio) y cuando el modo manual no está
activo (en este último caso, además, emite 1 aviso por consola que menciona `manual` por llamada y no altera el avance
en tiempo real). Como en modo manual el reloj de render solo avanza n × `TICK_MS` con cada `step(n)` (0014), un
`step(n)` que devuelve 0 no lo avanza.

Valores de n: es válido un entero en `[1, 9.007.199.254.740.991]` (`Number.MAX_SAFE_INTEGER`). Cualquier otro
valor (0, negativo, no entero, `NaN`, `Infinity`, texto, sin argumento) MUST rechazarse: `step` devuelve 0, no
ejecuta ningún tick, no cambia el snapshot y emite exactamente 1 aviso por consola que menciona `step` por
llamada inválida. Un n válido mayor que los ticks que le quedan a la partida avanza hasta el estado de parada.

Llamadas simultáneas: si se llama a `step` mientras otro `step` no ha terminado, las llamadas MUST ejecutarse
una tras otra en el orden en que se hicieron, sin perder ni duplicar ticks; cada una devuelve sus propios ticks.

#### Scenario: Avance exacto
- **GIVEN** la URL `?e2e&manual&seed=7` y una partida en curso en el tick 0 que no abre ofertas ni termina en los
  próximos 60 ticks
- **WHEN** se llama a `step(60)`
- **THEN** devuelve 60 y `snapshot.tick` vale 60
- **AND** tras 2 s reales sin más llamadas, `snapshot.tick` sigue valiendo 60

#### Scenario: Un solo tick
- **GIVEN** modo manual y una partida en curso en el tick n que no termina ni abre ofertas en el próximo tick
- **WHEN** se llama a `step(1)`
- **THEN** devuelve 1 y `snapshot.tick` vale n + 1

#### Scenario: Más de 15 ticks en un step
- **GIVEN** modo manual y una partida en curso en el tick 0 que no abre ofertas ni termina en los próximos 225
  ticks
- **WHEN** se llama a `step(225)`
- **THEN** devuelve 225 y `snapshot.tick` vale 225

#### Scenario: Independiente de la duración de los frames
- **GIVEN** dos cargas en modo manual con la semilla 7 y una partida en curso en el tick 0 que no abre ofertas ni
  termina en los próximos 30 ticks
- **WHEN** en ambas se llama a `step(30)`, y en una el motor informa de frames de 1 ms y en la otra de 5.000 ms
  mientras dura el `step`
- **THEN** ambas devuelven 30 y sus snapshots en el tick 30 son iguales campo a campo

#### Scenario: Input leído al empezar el step
- **GIVEN** modo manual, una partida en curso que no abre ofertas ni termina en los próximos 8 ticks, el jugador
  en (480, 270) con velocidad 200 y la flecha derecha pulsada
- **WHEN** se llama a `step(8)` y la flecha derecha se suelta antes de que termine
- **THEN** devuelve 8 y el jugador queda en x = 480 + 8 × 3,333 (error ≤ 0,01), si no lo limita el borde del mundo

#### Scenario: Pulsación sin step entre medias
- **GIVEN** modo manual, una partida en curso en el tick n con el jugador en (480, 270)
- **WHEN** se pulsa y se suelta la flecha derecha sin llamar a `step` y después se llama a `step(8)` sin ninguna
  tecla pulsada
- **THEN** devuelve 8 y el jugador sigue en (480, 270) (error ≤ 0,001), si ningún otro efecto lo mueve

#### Scenario: Oferta a mitad de step
- **GIVEN** la URL `?e2e&manual&seed=7` y una partida en el tick 0 cuya primera oferta se abre en el tick k
  (k < 4.800)
- **WHEN** se llama a `step(4800)`
- **THEN** devuelve k, `snapshot.tick` vale k, la partida está eligiendo mejora y la oferta está visible
- **AND** un `step(10)` posterior devuelve 0 y el snapshot sigue en el tick k
- **AND** tras elegir la opción de índice 0, `step(10)` devuelve 10 y `snapshot.tick` vale k + 10

#### Scenario: Oferta en el último tick del step
- **GIVEN** modo manual y una partida en el tick n cuya siguiente oferta se abre en el tick n + 5
- **WHEN** se llama a `step(5)`
- **THEN** devuelve 5 y la partida está eligiendo mejora en el tick n + 5

#### Scenario: Fin de partida a mitad de step
- **GIVEN** modo manual y una partida en curso en el tick n que termina en derrota en el tick n + m (m ≥ 1) si no
  se abre ninguna oferta antes
- **WHEN** se llama a `step(m + 1000)`
- **THEN** devuelve m, `snapshot.tick` vale n + m y la partida está terminada con derrota
- **AND** al terminar el `step` la pantalla de resultados está visible y la partida ya figura en el historial
  guardado
- **AND** un `step(10)` posterior devuelve 0 y el snapshot sigue en el tick n + m

#### Scenario: Victoria al llegar a la duración objetivo
- **GIVEN** modo manual y una partida con duración objetivo de 120 ticks, en curso en el tick 100, que no pierde ni
  abre ofertas antes del tick 120
- **WHEN** se llama a `step(50)`
- **THEN** devuelve 20, `snapshot.tick` vale 120 y la partida está terminada con victoria

#### Scenario: Step en pausa
- **GIVEN** modo manual y una partida en pausa en el tick n
- **WHEN** se llama a `step(60)`
- **THEN** devuelve 0 y el snapshot sigue igual campo a campo al del tick n
- **AND** tras pulsar Esc para reanudar, `step(1)` devuelve 1 y `snapshot.tick` vale n + 1

#### Scenario: Step en el menú
- **GIVEN** modo manual y el menú de inicio visible tras `Volver al menú`
- **WHEN** se llama a `step(60)`
- **THEN** devuelve 0 y no empieza ninguna partida

#### Scenario: Step sin modo manual
- **GIVEN** la URL `?e2e&seed=7` y una partida en curso
- **WHEN** se llama a `step(60)`
- **THEN** devuelve 0, no ejecuta ningún tick por sí mismo y se emite 1 aviso que menciona `manual`
- **AND** la partida sigue ejecutando 1 tick por frame de 16,667 ms

#### Scenario: n inválido
- **GIVEN** modo manual y una partida en curso en el tick n
- **WHEN** se llama a `step(0)`, `step(-1)`, `step(2.5)`, `step(NaN)`, `step(Infinity)`, `step("10")` o `step()`
- **THEN** cada llamada devuelve 0 y el snapshot sigue igual campo a campo al del tick n
- **AND** se emite exactamente 1 aviso por consola que menciona `step` por cada llamada (7 en total)

#### Scenario: n muy grande
- **GIVEN** modo manual y una partida en curso en el tick n que termina en el tick t (n < t ≤ 36.000) sin abrir
  ofertas entre medias
- **WHEN** se llama a `step(9007199254740991)`
- **THEN** devuelve t − n, `snapshot.tick` vale t y la partida está terminada, sin avisos que mencionen `step`

#### Scenario: Llamadas simultáneas
- **GIVEN** modo manual y una partida en curso en el tick 0 que no abre ofertas ni termina en los próximos 60 ticks
- **WHEN** se llama a `step(30)` y, antes de que termine, a `step(30)` otra vez
- **THEN** la primera llamada devuelve 30, la segunda devuelve 30 y termina después de la primera
- **AND** `snapshot.tick` vale 60 cuando termina la segunda

#### Scenario: Llamada simultánea que encuentra la oferta
- **GIVEN** modo manual y una partida en el tick 0 cuya primera oferta se abre en el tick 20
- **WHEN** se llama a `step(30)` y, antes de que termine, a `step(30)` otra vez
- **THEN** la primera devuelve 20, la segunda devuelve 0 y `snapshot.tick` vale 20 con la oferta abierta

#### Scenario: Tienda a mitad de step
- **GIVEN** modo manual y una partida en el tick n que abre la tienda en el tick n + 7
- **WHEN** se llama a `step(20)`
- **THEN** devuelve 7, `snapshot.tick` vale n + 7 y la partida está en tienda
- **AND** un `step(10)` posterior devuelve 0; tras salir de la tienda, `step(10)` devuelve 10

#### Scenario: Step con el aviso de orientación
- **GIVEN** la URL `?e2e&manual&mobile=1&seed=42`, una partida en curso y sin pausa en el tick n que no abre ofertas ni
  termina en los próximos 60 ticks, y la ventana en vertical con el aviso visible
- **WHEN** se llama a `step(60)`
- **THEN** devuelve 0, el snapshot sigue igual campo a campo al del tick n, el reloj de render no ha avanzado y no se
  emite ningún aviso que mencione `step` ni `manual`
- **AND** con la ventana de nuevo en horizontal, `step(60)` devuelve 60 y `snapshot.tick` vale n + 60

### Requirement: Mismo resultado en avance manual
El sistema SHALL producir en modo manual el mismo desenlace que en tiempo real para la misma semilla, el mismo
contenido, la misma secuencia de inputs por tick y las mismas elecciones de mejora: resultado, tick en que
termina, nivel, bajas y lista de mejoras adquiridas con sus niveles MUST ser idénticos. Cómo se reparten los ticks
entre llamadas a `step` no cambia cuáles se ejecutan ni en qué orden.

#### Scenario: Manual frente a tiempo real
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, input (0, 0) constante y la política de
  elección fija, una en tiempo real a velocidad 1 y otra en modo manual
- **WHEN** la primera recibe frames de 16,667 ms y la segunda llamadas a `step(60)` (eligiendo la opción 0 cada vez
  que se abre una oferta) hasta que cada una termina o hasta 36.000 ticks
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la misma
  lista de mejoras adquiridas con sus niveles

#### Scenario: Reparto distinto de los ticks
- **GIVEN** dos partidas en modo manual con el contenido por defecto, la semilla 7, input (0, 0) y la política de
  elección fija
- **WHEN** una avanza con llamadas a `step(1)` y la otra con llamadas a `step(1200)`, repitiendo tras cada oferta,
  hasta llegar al tick 1.200
- **THEN** sus snapshots en el tick 1.200 son iguales campo a campo

### Requirement: Rendimiento con estructuras y guardias
El sistema SHALL ejecutar un tick de simulación con el contenido por defecto, un mapa generado con sus estructuras,
300 enemigos vivos de los que ≥ 1 por casa son guardias en patrulla o en alerta (hasta el tope de guardias de cada
casa) y las armas con estructuras como objetivo alternativo en ≤ 2 ms de media, medido con un benchmark de Vitest
sobre el núcleo, sin motor ni render. La medida es informativa (depende de la máquina): no bloquea `verify` ni CI. El
verify-report de este change MUST anotar la media de este peor caso frente al objetivo informativo de ≤ 0,25 ms por
tick. El camino caliente del tick MUST NOT crear objetos nuevos por tick para elegir objetivos entre enemigos y
estructuras ni para mover a los guardias.

#### Scenario: Peor caso con estructuras y guardias
- **GIVEN** una partida con el contenido por defecto, semilla fija con su mapa generado y todas sus estructuras sin
  destruir, 300 enemigos vivos con cada casa en su tope de guardias, la mitad de ellos en patrulla y la otra mitad en
  alerta, y una vida del jugador suficiente para no llegar a 0 en 600 ticks (los enemigos abatidos se reponen para
  mantener 300 vivos)
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
- **AND** la media medida se anota en el verify-report frente al objetivo de ≤ 0,25 ms

### Requirement: Rendimiento con recogibles por tipo
El sistema SHALL ejecutar un tick de simulación con el contenido por defecto, un mapa generado con sus estructuras, sus
vetas, sus montones y sus ovejas, 300 enemigos vivos, `maxProjectiles` (32) proyectiles vivos, el tope de ovejas vivas
del contenido (todas en huida) y, en el suelo, el tope de cada tipo de recogible lleno (`maxGems` gemas, el tope de oro,
el de madera, el de carne y `maxStone`) con todos atraídos y a ≥ 400 px del jugador, en ≤ 2 ms de media, medido con un
benchmark de Vitest sobre el núcleo, sin motor ni render. La medida es informativa (depende de la máquina): no bloquea
`verify` ni CI. El verify-report de este change MUST anotar la media de este caso y la del escenario vivo "Peor caso con
gemas" frente al objetivo informativo de ≤ 0,25 ms por tick, y compararla con la de 0022 (0,27 ms con tres topes) y con
la de 0024 si la hay. El camino caliente del tick MUST NOT crear objetos nuevos por tick para los recogibles, las vetas,
las ovejas ni las tiradas de piedra (reserva igual a la suma de los topes de los cinco tipos de recogible).

#### Scenario: Peor caso con los cuatro topes llenos
- **GIVEN** la partida descrita en el requisito, con una vida del jugador suficiente para no llegar a 0
- **WHEN** el benchmark mide 60 ticks consecutivos (60 × 6 px = 360 px < 400, ningún recogible se recoge)
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
- **AND** la media medida se anota en el verify-report frente al objetivo de ≤ 0,25 ms y frente a los 0,27 ms de 0022

#### Scenario: Peor caso con los cinco topes llenos
- **GIVEN** la partida descrita en el requisito, con una vida del jugador suficiente para no llegar a 0
- **WHEN** el benchmark mide 60 ticks consecutivos (60 × 6 px = 360 px < 400, ningún recogible se recoge)
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
- **AND** la media medida se anota en el verify-report frente al objetivo de ≤ 0,25 ms y frente a los 0,27 ms de 0022

### Requirement: Política de tienda fija en los escenarios
Convención para todas las specs (desde 0024): en un escenario que ejecuta ticks sobre una partida que puede abrir la
tienda y no dice nada de ella, cada vez que se abre la tienda se sale sin comprar antes de pedir el siguiente tick, y
"N ticks" son N ticks ejecutados. Las compras y las salidas de la tienda son input del determinismo, igual que el
movimiento y las elecciones de mejora. Con esta política, una partida MUST producir en cada tick los mismos snapshots
que la misma partida en un mapa sin puerta, salvo la fase en tienda del snapshot del tick en que se abre y el estado de
la puerta (armada o no).

#### Scenario: La política de tienda fija no cambia la partida
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42 con su mapa generado y la misma secuencia de
  3.600 inputs que aleja al jugador de la puerta y lo devuelve a ella ≥ 2 veces, una con la puerta y otra igual salvo
  sin puerta, ambas con la política de elección fija y la de tienda fija
- **WHEN** ambas ejecutan 3.600 ticks
- **THEN** la primera abre la tienda ≥ 2 veces y en cada tick los enemigos, el jugador, las ovejas, los recogibles, el
  oro, la XP, el nivel, las ofertas, las mejoras y el estado del azar son iguales en las dos

### Requirement: Sin tiempo acumulado en la tienda
El sistema SHALL no ejecutar ticks ni acumular tiempo real mientras la partida está en tienda, con las mismas reglas
que "Sin tiempo acumulado durante la elección": los frames en ese estado ejecutan 0 ticks y dejan el acumulador a 0;
si la tienda se abre en un tick de un frame (o de un `step`) que tenía más ticks por ejecutar, los restantes se
descartan; tras salir no hay ráfaga de recuperación.

#### Scenario: Frames en la tienda
- **GIVEN** una partida con la tienda abierta en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms y después se sale de la tienda y el motor informa de 16,667 ms
- **THEN** durante los 600 frames se ejecutan 0 ticks y el snapshot sigue en el tick n
- **AND** tras salir se ejecuta exactamente 1 tick y el snapshot tiene tick n + 1

#### Scenario: Tienda a mitad de frame
- **GIVEN** un bucle con acumulador a 0 y una partida que abrirá la tienda en el primer tick que ejecute
- **WHEN** el motor informa de 50 ms (3 ticks)
- **THEN** se ejecuta exactamente 1 tick y el acumulador queda a 0

### Requirement: Azar de la piedra
El sistema SHALL dar a cada partida un **azar de la piedra**: una instancia propia del puerto `RandomGenerator`
inicializada a partir de la semilla de la partida, distinta de la de la partida (oleadas y ofertas) y de las del mapa, la
decoración, las estructuras, los recursos del mapa y las ovejas. Existe **en todo mapa**: el generado, el vacío
(`open`, también con `?e2e&map=empty`) y el de celdas declaradas (`cells`). Lo consumen solo las tiradas de "Piedra por
enemigo abatido" (`resources`): 1 valor por **cada** baja, en el orden de las bajas del tick (la k-ésima tirada es la de
la k-ésima baja de la partida); nada más lo consume. Con la misma
semilla, el azar de la piedra MUST dar la misma secuencia de valores sea cual sea el mapa, y MUST NOT depender de cuántos
valores hayan consumido los demás flujos. Consumirlo MUST NOT cambiar el mapa, las estructuras, los recursos del mapa,
las ovejas, las oleadas ni las ofertas de ninguna semilla.

Una firma dorada nueva en `tests/support/` MUST fijar, para una semilla, un mapa y una secuencia de inputs fijos, la
secuencia de piedras soltadas (tick, identificador, posición y origen) y la piedra final; un cambio en el orden o en el
número de valores consumidos la rompe. Las firmas `MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN` y `SHEEP_GOLDEN`
MUST NOT cambiar por este change.

#### Scenario: Mismo azar de la piedra en cualquier mapa
- **GIVEN** la semilla 42 y tres partidas con el contenido por defecto, una con su mapa generado, otra con el mapa vacío
  y otra con un mapa de celdas declarado
- **WHEN** se leen los 100 primeros valores del azar de la piedra de cada una al crearlas
- **THEN** las tres secuencias son iguales valor a valor

#### Scenario: Semillas distintas, azares distintos
- **GIVEN** dos partidas con las semillas 1 y 2
- **WHEN** se leen los 100 primeros valores del azar de la piedra de cada una
- **THEN** difieren en ≥ 1 valor

#### Scenario: Independiente de los demás flujos
- **GIVEN** la semilla 42 y dos partidas, una con su mapa generado y otra con el mapa vacío, con probabilidad de piedra
  100 en `goblin-torch`, y en cada una un `goblin-torch` que muere por armas en el tick n como primera baja de la
  partida
- **WHEN** se ejecuta el tick n en ambas
- **THEN** el azar de la piedra de ambas ha consumido exactamente 1 valor y su siguiente valor es el mismo en las dos

#### Scenario: Piedra con el mapa vacío
- **GIVEN** el contenido por defecto, la semilla 7, el mapa vacío, input (0, 0) y la política de elección fija
- **WHEN** se ejecutan ticks hasta que la partida termina
- **THEN** en ≥ 1 tick se ha soltado ≥ 1 recogible `stone`

#### Scenario: Firma dorada de las piedras
- **GIVEN** el contenido por defecto, la semilla, el mapa y la secuencia de inputs de la firma dorada nueva
- **WHEN** se ejecuta la partida de la firma y se calcula la firma
- **THEN** es igual a la firma dorada guardada, con ≥ 1 piedra soltada

#### Scenario: Firmas anteriores intactas
- **GIVEN** el contenido por defecto tras el change
- **WHEN** se calculan las firmas de mapa, estructuras, recursos y ovejas de `tests/support/`
- **THEN** son iguales a las de antes del change

#### Scenario: Oleadas intactas
- **GIVEN** dos partidas con la semilla 7, el contenido por defecto y la misma secuencia de 3.600 inputs, una con la
  probabilidad de piedra del contenido y otra con 0 en todos los tipos
- **WHEN** ambas ejecutan 3.600 ticks
- **THEN** en cada tick la lista de enemigos (identificador, tipo, posición, vida y estado), las ofertas y el estado del
  `RandomGenerator` de la partida son iguales en las dos

### Requirement: Política de obra fija en los escenarios
Convención para todas las specs (desde 0026): en un escenario que ejecuta ticks sobre una partida que puede abrir la
oferta de un solar y no dice nada de ella, cada vez que se abre se sale sin construir antes de pedir el siguiente tick,
y "N ticks" son N ticks ejecutados. Las construcciones y las salidas de la obra son input del determinismo, igual que el
movimiento, las elecciones de mejora y las compras. Con esta política, una partida MUST producir en cada tick los mismos
snapshots que la misma partida con los mismos solares (igual de bloqueantes) en la que ninguna oferta de obra llega a
abrirse, salvo la fase en obra y la oferta de obra del snapshot del tick en que se abre y la lista de solares (estado
de armado). Como los solares libres bloquean desde el tick 0, la comparación ya no es con la partida sin solares.

#### Scenario: La política de obra fija no cambia la partida
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42 con su mapa generado, madera 100 y piedra 100 de
  escenario y la misma secuencia de 3.600 inputs que lleva al jugador a tocar ≥ 2 solares; en una los solares se
  comportan con normalidad y en la otra empiezan desarmados y no se arman nunca (escenario preparado), ambas con las políticas de elección,
  tienda y obra fijas
- **WHEN** ambas ejecutan 3.600 ticks
- **THEN** la primera abre la oferta de obra ≥ 2 veces y la segunda ninguna
- **AND** en cada tick los enemigos, el jugador, las ovejas, los recogibles, el oro, la madera, la piedra, la XP, el
  nivel, las ofertas, las mejoras y el estado del azar son iguales en las dos

### Requirement: Sin tiempo acumulado en obra
El sistema SHALL no ejecutar ticks ni acumular tiempo real mientras la partida está en obra, con las mismas reglas que
"Sin tiempo acumulado durante la elección": los frames en ese estado ejecutan 0 ticks y dejan el acumulador a 0; si la
oferta de un solar se abre en un tick de un frame (o de un `step`) que tenía más ticks por ejecutar, los restantes se
descartan; tras construir o salir no hay ráfaga de recuperación.

#### Scenario: Frames en obra
- **GIVEN** una partida con la oferta de un solar abierta en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms y después se sale de la obra y el motor informa de 16,667 ms
- **THEN** durante los 600 frames se ejecutan 0 ticks y el snapshot sigue en el tick n
- **AND** tras salir se ejecuta exactamente 1 tick y el snapshot tiene tick n + 1

#### Scenario: Obra a mitad de frame
- **GIVEN** un bucle con acumulador a 0 y una partida que abrirá la oferta de un solar en el primer tick que ejecute
- **WHEN** el motor informa de 50 ms (3 ticks)
- **THEN** se ejecuta exactamente 1 tick y el acumulador queda a 0

#### Scenario: Step en obra
- **GIVEN** `?e2e&manual` y una partida que abrirá la oferta de un solar en el 3.er tick
- **WHEN** se llama a `step(10)` y después a `step(5)` sin salir de la obra
- **THEN** la primera llamada devuelve 3 y la segunda 0, y el snapshot sigue en el tick del 3.er tick

### Requirement: Rendimiento con edificios y torres
El sistema SHALL ejecutar un tick de simulación con el contenido por defecto, un mapa generado con sus 6 solares
construidos (3 casas y 3 torres, o 6 torres en el caso de torres), 300 enemigos vivos y las torres disparando con su
reserva llena, con un **coste añadido < 0,5 ms por tick** de media frente al mismo caso sin edificios, medido con un
benchmark de Vitest sobre el núcleo, sin motor ni render. La medida es informativa (depende de la máquina): no bloquea
`verify` ni CI. El verify-report de este change MUST anotar las medias con y sin edificios y el coste de recalcular los
campos (el del jugador y los de los guardias) en una construcción. El camino caliente del tick MUST NOT crear objetos
nuevos por tick para las flechas de torre (reserva del tope de flechas) ni para los pagos de las casas.

#### Scenario: Peor caso con 6 torres
- **GIVEN** una partida con el contenido por defecto, semilla fija con su mapa generado, sus 6 solares construidos como
  torre, 300 enemigos vivos con ≥ 1 en el alcance de cada torre en cada tick medido, la reserva de flechas llena y una
  vida del jugador suficiente para no llegar a 0 en 600 ticks (los enemigos abatidos se reponen)
- **WHEN** el benchmark mide 600 ticks consecutivos, y aparte el mismo caso con 0 solares
- **THEN** la diferencia de medias es < 0,5 ms por tick y la partida sigue en curso al terminar la medición
- **AND** ambas medias se anotan en el verify-report

#### Scenario: Recalcular los campos al construir
- **GIVEN** una partida con el contenido por defecto, semilla fija con su mapa generado, 4 casas goblin con su tope de
  guardias y la oferta de un solar abierta
- **WHEN** el benchmark mide construir una casa (recálculo de campos incluido)
- **THEN** la media se anota en el verify-report

### Requirement: Contenido de combate validado
El sistema SHALL leer la ventana de golpes y el tope de golpes por tick de un bloque de contenido de juego propio,
`combat` (en `content/`, fuera de `content/weapons.json` y de los datos de aspecto), validado con zod antes de llegar
al dominio:
- **ventana de golpes** N: entero ≥ 15 (el máximo de ticks que ejecuta un frame a velocidad 1, ver "Protección contra la
  espiral de la muerte"), en ticks;
- **tope de golpes por tick**: entero ≥ 1.

Con el contenido por defecto la ventana vale 15 y el tope 48. Un campo ausente, un campo desconocido o un valor fuera de
rango MUST impedir que se muestre el menú o empiece una partida, con un error que nombre el campo. Este contenido MUST
NOT cambiar ninguna regla de daño, vida ni balance: solo acota lo que se registra y se expone.

#### Scenario: Contenido de combate por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el bloque `combat` tiene ventana de golpes 15 y tope de golpes por tick 48
- **AND** `content/weapons.json` no tiene ningún campo nuevo respecto a antes del change

#### Scenario: Valores de combate fuera de rango
- **GIVEN** el contenido por defecto con, en un caso cada vez: ventana 14, ventana 15,5, ventana 0, tope 0, tope −1 o
  tope 2,5
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la ventana o el tope respectivamente
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos del combate
- **GIVEN** el contenido por defecto con, en un caso cada vez: ventana 15 y tope 1; o ventana 600 y tope 1.000
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Campos de combate ausentes o desconocidos
- **GIVEN** el contenido por defecto con el bloque `combat` sin ventana, en otro caso sin tope, y en otro con un campo
  extra `crit`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el campo ausente o `crit`

### Requirement: Registro de golpes de combate
El sistema SHALL registrar, en cada tick de una partida en curso, un **golpe** por cada objetivo que pierde vida en ese
tick, con el **daño aplicado**: lo que de verdad baja su vida. Hay cuatro **clases** de objetivo:
- `enemy`: un enemigo, dañado por un proyectil del jugador, un pulso, una flecha de torre o una explosión (fuego amigo
  incluido, ver `enemy-hazards`);
- `structure`: una casa o torre goblin, dañada por un proyectil del jugador o un pulso (las explosiones no la dañan,
  ver `goblin-structures`);
- `sheep`: una oveja, dañada por un proyectil del jugador, un pulso o una explosión (ver `sheep`);
- `player`: el jugador, con el golpe único del paso 5 (ver "Daño discreto por contacto" en `player-health`).

El daño aplicado de cada impacto es min(daño del impacto, vida del objetivo justo antes del impacto); en el jugador, el
daño del impacto es el ya reducido por la armadura con el mínimo 1. Los impactos del mismo tick sobre el mismo objetivo
MUST sumarse en un solo golpe, con la suma de lo aplicado, sea cual sea el arma, la torre o la explosión que los cause y
el paso del tick en que ocurran. El golpe que deja al objetivo a vida 0 MUST registrarse (enemigo abatido, oveja muerta,
estructura que pasa a ruina, jugador derrotado), aunque el objetivo ya no figure después en su lista del snapshot. Un
impacto que no quita vida MUST NOT crear golpe ni sumar: sobre el jugador invulnerable, sobre un objetivo que ya tiene
vida 0 en ese tick (dado de baja, muerto o en ruina) o sobre algo que no recibe daño (edificios propios, vetas,
estructuras alcanzadas por una explosión). Las curaciones (regeneración, carne, subida sin mejoras, pago) MUST NOT crear
golpes ni restar de uno. Cada golpe tiene la clase, el identificador del objetivo (el del enemigo, la estructura o la
oveja; el de clase `player` no lo tiene), el tick, la posición del objetivo en ese tick (la que tiene en el paso 3, que
no cambia en los pasos 3 a 5) y el daño, un entero ≥ 1. En una partida que no está en curso no se registra ningún golpe.

#### Scenario: Golpe letal recortado a la vida restante
- **GIVEN** un `goblin-torch` con vida 4 en (1.000, 1.000) y un impacto del Linter (daño 6) en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el `goblin-torch` queda dado de baja y no figura en la lista de enemigos del snapshot del tick n
- **AND** el snapshot del tick n tiene exactamente 1 golpe nuevo, de clase `enemy`, con su identificador, tick n,
  posición (1.000, 1.000) y daño 4

#### Scenario: Suma por objetivo y tick
- **GIVEN** un `goblin-tnt` con vida 45, alcanzado en el tick n por dos proyectiles del Linter (daño 6 cada uno, por
  escenario) y por un pulso de Tests (daño 4)
- **WHEN** se ejecuta el tick n
- **THEN** su vida vale 29 y el tick n tiene exactamente 1 golpe con su identificador, de daño 16

#### Scenario: Suma de armas y explosión en el mismo tick
- **GIVEN** un `goblin-tnt` con vida 45 que recibe en el tick n un impacto del Linter (paso 3) y una explosión de
  daño 25 que lo alcanza (paso 4)
- **WHEN** se ejecuta el tick n
- **THEN** su vida vale 14 y el tick n tiene exactamente 1 golpe con su identificador, de daño 31

#### Scenario: Golpe letal sumado en el mismo tick
- **GIVEN** un `goblin-torch` con vida 10 que recibe en el tick n un impacto del Linter (6) y un pulso de Tests (4)
- **WHEN** se ejecuta el tick n
- **THEN** queda dado de baja y el tick n tiene exactamente 1 golpe con su identificador, de daño 10

#### Scenario: Impacto sobre un objetivo ya abatido en el tick
- **GIVEN** un `goblin-torch` con vida 4 que recibe en el paso 3.1 del tick n un impacto del Linter y que está en el
  radio del pulso de Tests disparado en el paso 3.2 de ese tick
- **WHEN** se ejecuta el tick n
- **THEN** el tick n tiene exactamente 1 golpe con su identificador, de daño 4 (no 8)

#### Scenario: Golpes en ticks distintos no se suman
- **GIVEN** un `goblin-tnt` con vida 45 que recibe un impacto del Linter en el tick n y otro en el tick n + 1
- **WHEN** se ejecutan los ticks n y n + 1
- **THEN** hay 2 golpes con su identificador, uno de tick n y otro de tick n + 1, ambos de daño 6

#### Scenario: Golpe en una estructura que pasa a ruina
- **GIVEN** la casa de prueba en (1.260, 690) con vida 4 y un impacto del Linter en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la casa figura destruida con vida 0 y el tick n tiene exactamente 1 golpe de clase `structure`, con su
  identificador, posición (1.260, 690) y daño 4

#### Scenario: Sin golpe en una ruina ni con explosiones
- **GIVEN** la casa de prueba destruida y, en otra partida, la casa de prueba con vida 30 y una dinamita de radio 48 y
  daño 20 que explota en su centro en el tick n
- **WHEN** se ejecutan 600 ticks en la primera con proyectiles que pasan por su posición, y el tick n en la segunda
- **THEN** en ninguna de las dos hay golpes de clase `structure`

#### Scenario: Golpes en una oveja
- **GIVEN** la oveja de prueba con vida 12 en (1.000, 1.000), un impacto del Linter en el tick n y, en otra partida, una
  explosión de daño 25 que la alcanza en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** en la primera hay 1 golpe de clase `sheep` con su identificador, daño 6 y posición (1.000, 1.000), y la oveja
  sigue viva con vida 6
- **AND** en la segunda hay 1 golpe de clase `sheep` de daño 12 y la oveja ha muerto

#### Scenario: Golpe al jugador con armadura
- **GIVEN** un jugador quieto en (480, 270) con vida 100 y armadura 3, no invulnerable, y un enemigo con damage 2 en
  contacto en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 99 y el tick n tiene exactamente 1 golpe de clase `player`, sin identificador de objetivo, con
  posición (480, 270) y daño 1

#### Scenario: Un solo golpe al jugador con contacto y explosión
- **GIVEN** un jugador con vida 100, sin armadura y no invulnerable, un enemigo con damage 15 en contacto y una
  explosión de daño 25 que le alcanza, ambos en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 75 y el tick n tiene exactamente 1 golpe de clase `player`, de daño 25

#### Scenario: Jugador invulnerable sin golpe
- **GIVEN** un jugador golpeado en el tick t con 30 ticks de invulnerabilidad y un enemigo con damage 10 en contacto en
  los ticks t + 1 a t + 30
- **WHEN** se ejecutan esos 30 ticks
- **THEN** la vida no cambia y ninguno de esos ticks tiene golpes de clase `player`

#### Scenario: Golpe letal al jugador
- **GIVEN** un jugador con vida 5, sin armadura y no invulnerable, y una explosión de daño 25 que le alcanza en el
  tick n
- **WHEN** se ejecuta el tick n
- **THEN** la partida está terminada con derrota y el snapshot del tick n tiene 1 golpe de clase `player` de daño 5

#### Scenario: Las curaciones no son golpes
- **GIVEN** un jugador con vida 50 de 100, regeneración 1 cada 60 ticks y un recogible `meat` que recoge en el tick
  n, sin contactos ni explosiones en los ticks n a n + 120
- **WHEN** se ejecutan esos 121 ticks
- **THEN** la vida sube y ninguno de esos ticks tiene golpes

### Requirement: Orden e identificadores de los golpes
El sistema SHALL dar a cada golpe un **identificador** de una secuencia propia de la partida, que empieza en 0 en cada
partida, sube de 1 en 1 y no se reutiliza; es independiente de las de enemigos, ovejas, proyectiles y recogibles. El
golpe recibe su identificador en el primer impacto que quita vida a su objetivo en ese tick, y los impactos posteriores
del mismo tick sobre ese objetivo solo suman a su daño. El **orden de registro** dentro del tick es el de "Orden de los
pasos del tick":
1. paso 3.1: los proyectiles del jugador, en orden de creación, y después las flechas de torre, en orden de creación;
2. paso 3.2: los pulsos, en el orden de las armas de `content/weapons.json`; cada pulso, sobre los enemigos en el orden
   de su lista, después sobre las estructuras en el orden de la suya y después sobre las ovejas en el orden de la suya;
3. paso 4.1: las explosiones, en su orden; cada una, sobre los enemigos en el orden de su lista y después sobre las
   ovejas en el orden de la suya;
4. paso 5: el golpe al jugador.

Registrar golpes MUST NOT cambiar el orden de los pasos, el orden de las listas, el daño, la vida, las bajas ni ninguna
otra regla del tick.

#### Scenario: Identificadores en orden de registro
- **GIVEN** una partida nueva sin golpes en la que, en el tick n, un proyectil del Linter impacta a un enemigo e2, el
  pulso de Tests alcanza a e1, a e2 (en ese orden de lista) y a la casa de prueba, y una explosión alcanza a la oveja de
  prueba y al jugador, que no es invulnerable; ningún otro impacto alcanza a nadie en ese tick y todos siguen con
  vida > 0 tras él
- **WHEN** se ejecuta el tick n
- **THEN** los golpes del tick n son, en este orden y con identificadores 0, 1, 2, 3 y 4: e2 (Linter + pulso), e1, la
  casa, la oveja y el jugador

#### Scenario: Secuencia sin huecos entre ticks
- **GIVEN** una partida cuyo último golpe tiene identificador k en el tick n
- **WHEN** en el tick n + 3 hay 2 golpes nuevos y en los ticks n + 1 y n + 2 ninguno
- **THEN** los golpes del tick n + 3 tienen identificadores k + 1 y k + 2

#### Scenario: Identificadores desde 0 en cada partida
- **GIVEN** una partida terminada con ≥ 10 golpes
- **WHEN** se crea una partida nueva con la misma semilla y se registra su primer golpe
- **THEN** ese golpe tiene identificador 0

### Requirement: Tope de golpes por tick
El sistema SHALL registrar como mucho el **tope de golpes por tick** golpes de clase `enemy`, `structure` y `sheep` en
cada tick. Cuando un impacto crearía un golpe nuevo con el tope ya alcanzado en ese tick, ese golpe MUST descartarse:
se conservan los primeros en orden de registro y se descartan los últimos. Un golpe descartado no recibe identificador
(los conservados siguen siendo consecutivos) y su impacto se aplica igual a la vida del objetivo. Los impactos
posteriores del mismo tick sobre un objetivo cuyo golpe se conservó siguen sumando a ese golpe. El golpe de clase
`player` (como mucho 1 por tick) MUST NOT contar para el tope ni descartarse por él. Con la misma semilla y las mismas
entradas se descartan siempre los mismos golpes.

#### Scenario: Pulso con más objetivos que el tope
- **GIVEN** el tope de golpes por tick 3, un pulso de Tests que alcanza en el tick n a 5 `goblin-torch` con vida 10,
  e1 … e5 en el orden de la lista, y ningún otro impacto en ese tick
- **WHEN** se ejecuta el tick n
- **THEN** el tick n tiene exactamente 3 golpes, de e1, e2 y e3, con identificadores consecutivos y daño 4
- **AND** los 5 `goblin-torch` quedan con vida 6

#### Scenario: Suma a un golpe conservado con el tope lleno
- **GIVEN** el tope 3, un proyectil del Linter que impacta a e3 en el paso 3.1 del tick n y el pulso de Tests que
  alcanza a e1 … e5 en el paso 3.2
- **WHEN** se ejecuta el tick n
- **THEN** el tick n tiene exactamente 3 golpes: e3 con daño 10, e1 y e2 con daño 4; e4 y e5 no tienen golpe

#### Scenario: El golpe al jugador no cuenta para el tope
- **GIVEN** el tope 1, un pulso de Tests que alcanza a 2 enemigos y un enemigo con damage 10 en contacto con el
  jugador, no invulnerable, en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el tick n tiene exactamente 2 golpes: el del primer enemigo de la lista y el de clase `player` de daño 10

#### Scenario: Tope en el límite
- **GIVEN** el tope 48 y un tick con exactamente 48 objetivos que pierden vida y, en otra partida, con 49
- **WHEN** se ejecuta ese tick
- **THEN** en la primera hay 48 golpes y en la segunda 48, sin el del objetivo registrado en último lugar

#### Scenario: Descarte determinista
- **GIVEN** dos partidas con el contenido por defecto salvo el tope 2, la semilla 42, la misma secuencia de 3.600
  inputs y la política de elección fija
- **WHEN** se ejecutan los 3.600 ticks
- **THEN** en cada tick sus listas de golpes son iguales campo a campo y ningún tick tiene más de 2 golpes que no sean
  de clase `player`

### Requirement: Golpes de combate en el snapshot
El sistema SHALL exponer en el `RunSnapshot` del tick k la lista de golpes de los ticks k − N + 1 a k (N = ventana de
golpes; desde el tick 0 si k < N − 1), en orden de identificador, cada uno con su identificador, su tick, su clase, el
identificador de su objetivo (salvo en `player`), su posición y su daño. Un golpe aparece por tanto en los snapshots de
N ticks consecutivos. Mientras la partida no avanza (eligiendo mejora, en tienda, en obra o terminada) el snapshot
conserva la lista del último tick ejecutado. La lista no tiene más de N × (tope + 1) golpes. Modificar desde fuera la
lista leída MUST NOT cambiar la simulación ni los golpes de snapshots posteriores. Un frame que ejecuta más de N ticks
(con `?e2e&speed=N` > 1, o con `step(n)` y n > N en modo manual) no expone los golpes de sus primeros ticks; se acepta
(solo afecta a lo que se pinta).

#### Scenario: Golpe visible durante la ventana
- **GIVEN** la ventana 15 y un único golpe g en el tick 100
- **WHEN** se leen los snapshots de los ticks 99 a 115
- **THEN** g no está en el del tick 99, está en los de los ticks 100 a 114 y no está en el del tick 115

#### Scenario: Partida recién creada sin golpes
- **GIVEN** una partida recién creada con el mapa generado de la semilla 42
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** la lista de golpes está vacía

#### Scenario: Golpes congelados en la tienda y en la oferta
- **GIVEN** una partida con 3 golpes en los ticks 490 a 500 que abre la tienda en el tick 500 y, en otra partida, una
  oferta de mejora en el tick 500
- **WHEN** se lee el snapshot 60 veces sin ejecutar ticks
- **THEN** en las 60 lecturas la lista de golpes es la misma, con los 3 golpes

#### Scenario: Ventana con un frame de 15 ticks
- **GIVEN** la ventana 15, un frame que ejecuta los ticks 201 a 215 y un golpe en cada uno de ellos
- **WHEN** se lee el snapshot de ese frame
- **THEN** la lista tiene los 15 golpes, de los ticks 201 a 215

#### Scenario: Golpes no mutables desde fuera
- **GIVEN** una partida en el tick 10 con 1 golpe de daño 6 en el tick 10 y ningún impacto en el tick 11
- **WHEN** el adaptador cambia en el `RunSnapshot` recibido el daño de ese golpe a 99, su clase a `player` y vacía la
  lista, y se ejecuta 1 tick
- **THEN** el snapshot del tick 11 tiene ese golpe con daño 6 y su clase original, y la vida del objetivo no ha cambiado

### Requirement: Golpes deterministas y sin efecto en la simulación
El sistema SHALL producir la misma lista de golpes en cada tick (identificador, tick, clase, objetivo, posición y daño)
a partir de la misma semilla, el mismo contenido y las mismas entradas (inputs, elecciones, compras y construcciones),
en cualquier ventana de render y con cualquier `speed`. Registrar y exponer golpes MUST NOT consumir ningún valor de
ningún `RandomGenerator` ni cambiar el estado de la partida: con otra ventana o con otro tope, todo el snapshot salvo la
lista de golpes MUST ser el mismo en cada tick. El change no toca el contenido de combate, de mapa, de estructuras, de
recursos, de ovejas ni de solares, así que la línea base de balance (`BALANCE_BASELINE`, semilla a semilla) y las seis
firmas doradas (`MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`, `SHEEP_GOLDEN`, `STONE_GOLDEN` y `SITE_GOLDEN`)
MUST NOT cambiar.

#### Scenario: Mismos golpes con la misma semilla
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, la misma secuencia de 600 inputs generada por una
  seed fija y la política de elección fija
- **WHEN** se ejecutan los 600 ticks
- **THEN** sus listas de golpes son iguales campo a campo en cada tick (comparación estricta, sin tolerancia) y la del
  tick 600 no está vacía

#### Scenario: Otra ventana u otro tope no cambian la partida
- **GIVEN** dos partidas con la semilla 42, la misma secuencia de 3.600 inputs y la política de elección fija, una con
  ventana 15 y tope 1 y otra con ventana 60 y tope 1.000
- **WHEN** se ejecutan los 3.600 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick salvo la lista de golpes
- **AND** el estado de cada `RandomGenerator` de la partida es el mismo en las dos tras el tick 3.600

#### Scenario: Balance y firmas intactos
- **GIVEN** el contenido por defecto del repositorio con el registro de golpes
- **WHEN** se ejecuta el lote del bot de referencia sobre las semillas 1..50 y se calculan las seis firmas doradas
- **THEN** cada semilla da el mismo resultado, tick de fin y bajas que `BALANCE_BASELINE`, y las seis firmas coinciden
  con las versionadas antes del change

<!-- historial: 0001-walking-skeleton (2026-11-19) -->
<!-- historial: 0002-enemy-spawning (2026-11-19) -->
<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0008-e2e-fast-sim (2026-11-20) -->
<!-- historial: 0009-main-menu (2026-11-20) -->
<!-- historial: 0010-balance-pass (2026-11-20) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0014-e2e-manual-step (2026-11-23) -->
<!-- historial: 0015-procedural-map (2026-11-23) -->
<!-- historial: 0019-flow-field (2026-11-24) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
<!-- historial: 0022-resources-sheep (2026-11-24) -->
<!-- historial: 0023-sheep-meat (2026-11-24) -->
<!-- historial: 0024-split-progression-castle (2026-11-25) -->
<!-- historial: 0025-stone-resource (2026-11-25) -->
<!-- historial: 0026-build-sites (2026-11-25) -->
<!-- historial: 0027-site-contact (2026-11-25) -->
<!-- historial: 0031-combat-feedback (2026-11-26) -->
<!-- historial: 0033-mobile-web (2026-11-26) -->
<!-- historial: 0035-audio (2026-11-27) -->
