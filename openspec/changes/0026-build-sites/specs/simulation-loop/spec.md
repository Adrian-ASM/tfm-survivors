# Spec delta · simulation-loop

<!-- Convención nueva para el encabezado de la spec viva (al archivar), junto a las de elección y tienda:
     **Convención para todas las specs: política de obra fija** (desde 0026). En un escenario que no dice nada de los
     solares, cada vez que se abre la oferta de un solar se sale sin construir antes del siguiente tick (ver "Política
     de obra fija en los escenarios"). Las construcciones son input del determinismo. -->

## ADDED Requirements

### Requirement: Política de obra fija en los escenarios
Convención para todas las specs (desde 0026): en un escenario que ejecuta ticks sobre una partida que puede abrir la
oferta de un solar y no dice nada de ella, cada vez que se abre se sale sin construir antes de pedir el siguiente tick,
y "N ticks" son N ticks ejecutados. Las construcciones y las salidas de la obra son input del determinismo, igual que el
movimiento, las elecciones de mejora y las compras. Con esta política, una partida MUST producir en cada tick los mismos
snapshots que la misma partida sin solares, salvo la fase en obra y la oferta de obra del snapshot del tick en que se
abre y la lista de solares (estado de armado).

#### Scenario: La política de obra fija no cambia la partida
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42 con su mapa generado, madera 100 y piedra 100 de
  escenario y la misma secuencia de 3.600 inputs que lleva al jugador al acceso de ≥ 2 solares, una con sus solares y
  otra con 0 solares por mapa, ambas con las políticas de elección, tienda y obra fijas
- **WHEN** ambas ejecutan 3.600 ticks
- **THEN** la primera abre la oferta de obra ≥ 2 veces y en cada tick los enemigos, el jugador, las ovejas, los
  recogibles, el oro, la madera, la piedra, la XP, el nivel, las ofertas, las mejoras y el estado del azar son iguales
  en las dos

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

## MODIFIED Requirements

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

<!-- Escenarios vivos sin cambios (con las políticas de tienda y de obra fijas cuando el escenario no dice nada de la
     tienda ni de los solares): todos los de este requisito. -->

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
- la lista de solares de la partida, construidos incluidos, con los campos de "Solares de la partida" (`build-sites`),
  en todos los estados de la partida;
- la oferta de obra, si la partida está en obra (ver "Oferta de obra" en `build-sites`);
- la lista de armas equipadas, en el orden de `content/weapons.json`, con su identificador y si está cargada;
- la lista de recogibles en el suelo, de los cinco tipos (ver `xp-gems`); las gemas son los de tipo `xp`;
- el nivel, la XP actual y la XP para el siguiente nivel (ver `leveling`);
- la oferta de mejoras abierta, si la hay, con sus opciones en orden: id, nombre, descripción, nivel actual y nivel
  siguiente (ver `upgrades`);
- los niveles de las mejoras adquiridas (nivel ≥ 1) de los dos catálogos, con su id, en el orden de "Nivel de las
  mejoras y disponibilidad" (`upgrades`);
- la tienda: la posición de la puerta (o ninguna si el mapa no tiene), si está armada y la lista de productos con los
  campos de "Productos de la tienda" (`castle-shop`), en todos los estados de la partida.

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
"Estructuras en el snapshot" (`goblin-structures`).

La lista de enemigos contiene solo enemigos vivos y va ordenada por orden de aparición o nacimiento. Una baja MUST
quitar al enemigo de la lista sin cambiar el orden relativo de los demás. La lista de ovejas contiene solo ovejas vivas,
va ordenada por orden de creación y una muerte no cambia el orden relativo de las demás. Las listas de proyectiles y de
flechas de torre van ordenadas por orden de creación y una desaparición no cambia el orden relativo de los demás. La
lista de recogibles va ordenada por orden de creación, sin agrupar por tipo, y una recogida no cambia el orden relativo
de los demás. Las listas de dinamitas y de explosiones van ordenadas por orden de creación y la de avisos con el orden
de "Aviso en el suelo" (`enemy-hazards`). Las listas de estructuras, de vetas, de solares y de productos de la tienda
conservan su orden y su longitud durante toda la partida.

<!-- Escenarios vivos sin cambios: todos los de este requisito salvo "Partida recién creada", que se amplía: con el mapa
     vacío la lista de solares está vacía y, con el mapa generado, tiene los 6 solares colocados, en `free` y armados;
     en ambos casos la lista de flechas de torre está vacía y no hay oferta de obra. En "Snapshot no mutable desde
     fuera" (en "Determinismo") la partida del tick 10 tiene además ≥ 1 solar construido y ≥ 1 flecha de torre, y el
     adaptador modifica también el estado de un solar, su huella, la lista de solares y la posición de una flecha. -->

#### Scenario: Solares y flechas en el snapshot
- **GIVEN** el mapa vacío con dos solares declarados s1 y s2, s1 con una torre construida que ha creado las flechas f1 y
  f2 en ese orden, y s2 en `free` y desarmado
- **WHEN** f1 desaparece por impacto, se crea f3 y se lee el snapshot
- **THEN** la lista de solares es s1 (`tower`) y s2 (`free`, desarmado), con sus accesos y huellas, y la de flechas de
  torre es f2, f3, cada una con su posición y su radio
- **AND** la lista de proyectiles del jugador no contiene ninguna flecha

#### Scenario: Snapshot de los solares no mutable desde fuera
- **GIVEN** una partida en el tick 10 con un solar en `free` y armado y sin ninguna oferta de obra en el tick 11
- **WHEN** el adaptador cambia en el `RunSnapshot` recibido el estado de ese solar a `house` y su armado a falso, y se
  ejecuta 1 tick
- **THEN** el snapshot del tick 11 tiene el solar en `free` y armado, y sus celdas siguen caminables

### Requirement: Orden de los pasos del tick
El sistema SHALL ejecutar cada tick de una partida en curso en este orden:
1. movimiento del jugador según el input (velocidad efectiva, ver `upgrades`); después, movimiento de las ovejas vivas,
   en el orden de su lista, con la posición del jugador ya movido: huida o deambular (ver "Huida del jugador" y
   "Deambular de las ovejas" en `sheep`);
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
    si procede y, si la partida sigue en curso, se abre la oferta del primero que procede y la partida pasa a en obra;
    el tick cuenta igualmente.

En una partida terminada, que está eligiendo mejora, que está en tienda o que está en obra no se ejecuta ningún paso
(ver `run-state`).

<!-- Escenarios vivos sin cambios (sin edificios salvo que digan otra cosa): todos los de este requisito. -->

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
- **GIVEN** el solar de prueba armado con el jugador a d = 10, madera 14 y un recogible `wood` de valor 1 que se recoge
  en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la partida está en obra en el snapshot del tick n
