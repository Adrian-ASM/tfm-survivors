# Spec delta · simulation-loop

<!-- Al archivar, añadir al Purpose, tras la "política de elección fija", la convención de "Política de tienda fija en
     los escenarios" (ADDED). -->

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Determinismo
El sistema SHALL producir exactamente el mismo `RunSnapshot`, enemigos (estado de comportamiento incluido), vida,
invulnerabilidad, estado de la partida, resultado, bajas, proyectiles, pulsos, dinamitas, avisos, explosiones,
estructuras (vida y destrucción incluidas), ovejas (identificador, posición, vida, estado y punto de origen), indicación
de daño, recogibles de los cuatro tipos (gemas y carne incluidas), oro, madera, vetas (activa o agotada), XP, nivel,
ofertas, mejoras adquiridas de los dos catálogos, estado de la puerta de la tienda y productos de la tienda incluidos, y
el mismo mapa, a partir del mismo estado inicial, la misma semilla, la misma secuencia de inputs por tick, la misma
secuencia de elecciones de mejora (índice elegido en cada oferta) y la misma secuencia de acciones en cada visita a la
tienda (productos comprados, en orden, y salida). En particular, el resultado de la partida, el tick en que termina,
las bajas y la posición de cada enemigo y de cada oveja en cada tick MUST ser los mismos. El núcleo MUST NOT depender de
reloj del sistema, aleatoriedad global ni APIs del navegador: toda la aleatoriedad MUST venir de instancias del puerto
`RandomGenerator` inicializadas a partir de la semilla de la partida: una para generar el mapa, otra para colocar las
estructuras (ver "Colocación determinista con azar propio" en `goblin-structures`), otra para colocar las vetas y los
montones (ver "Colocación de recursos determinista con azar propio" en `procedural-map`), el azar de las ovejas (una o
varias, ver "Ovejas deterministas" en `sheep`) y otra para el resto de la partida (ver "Azar del mapa independiente del
de la partida" en `procedural-map`). Las armas (selección de objetivo entre enemigos, estructuras y ovejas, disparo,
proyectiles y pulsos), las bajas y su contador, la destrucción de estructuras, el movimiento, la huida, el daño y la
muerte de las ovejas, los recogibles de los cuatro tipos (suelta, madera del barril, oro de las bajas, oro de las
estructuras, carne de las ovejas, recolocación, tope por tipo, imán y recogida), las bonificaciones de XP y de oro y sus
restos, la curación (carne, regeneración, subida sin mejoras y pago), la armadura, la invulnerabilidad mejorada, las
vetas (contacto y agotamiento), los contadores de oro y madera, la colisión del jugador con el mapa, la persecución de
los enemigos (línea libre, campo de distancias y navegación), la navegación hacia un punto fijo, los estados de
comportamiento y sus transiciones (patrulla, alerta y vuelta incluidas), el nacimiento de guardias, los lanzamientos,
las dinamitas, los avisos y las explosiones, la recolocación de las apariciones y de los puntos de patrulla, la XP, la
puerta de la tienda (re-armado y apertura), las compras, la salida de la tienda y la comprobación de victoria y derrota
MUST NOT consumir azar; la apertura de ofertas de mejora sí lo consume, y cada intento de posición de aparición consume
exactamente 1 valor (ver `enemy-spawning`). La colocación inicial, el primer pasto, la dirección de los paseos y la
reaparición de las ovejas consumen solo el azar de las ovejas. Los comportamientos, los peligros, las estructuras, los
recursos, las ovejas y la tienda MUST NOT cambiar el mapa generado por ninguna semilla.

<!-- Escenarios vivos sin cambios (con la política de tienda fija cuando el escenario no dice nada de la tienda): todos
     los de este requisito. -->

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

### Requirement: Snapshot para el motor
El sistema SHALL exponer tras cada frame un `RunSnapshot` con lo único que el adaptador de render necesita para
pintar:
- el número de tick;
- la duración objetivo de la partida, de forma que la vista pueda calcular el tiempo restante sin leer el contenido
  (ver `run-outcome` y `hud`);
- la posición y el radio del jugador;
- la vida actual y la vida máxima (efectiva) del jugador;
- si el jugador está invulnerable (ver `player-health`);
- el estado de la partida: en curso, eligiendo mejora, en tienda o terminada (ver `run-state`);
- el resultado de la partida: vacío, victoria o derrota (ver `run-outcome`);
- las bajas de la partida (ver `run-outcome`);
- el oro y la madera de la partida (ver "Contadores de oro y madera de la partida" en `resources`);
- la lista de enemigos vivos;
- la lista de ovejas vivas (ver `sheep`);
- la lista de proyectiles vivos (ver `auto-weapons`);
- la lista de pulsos visibles (ver `auto-weapons`);
- la lista de dinamitas en vuelo, la de avisos y la de explosiones visibles (ver `enemy-hazards`);
- la lista de estructuras de la partida, destruidas incluidas (ver "Estructuras en el snapshot" en
  `goblin-structures`);
- la lista de vetas de la partida, agotadas incluidas (ver "Vetas de oro al pasar" en `resources`);
- la lista de armas equipadas, en el orden de `content/weapons.json`, con su identificador y si está cargada;
- la lista de recogibles en el suelo, de los cuatro tipos (ver `xp-gems`); las gemas son los de tipo `xp`;
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
se reutiliza, su posición y su radio. Cada pulso visible MUST incluir el identificador del arma que lo disparó, el
tick en que se disparó, su centro y su radio. Cada recogible MUST incluir un identificador único dentro de la partida
que no se reutiliza (una sola secuencia para los cuatro tipos), su tipo (`xp`, `gold`, `wood` o `meat`), su valor, su
posición y su radio. Cada veta MUST incluir un identificador único dentro de la partida, su posición, su radio de
contacto, su oro y si está activa o agotada. Cada dinamita MUST incluir su identificador, su posición, su objetivo, su
radio visual y el tick en que explotará; cada aviso, su centro, su radio, su origen (mecha o dinamita) y el tick en
que explotará; cada explosión, su identificador, su centro, su radio y el tick en que ocurrió (ver `enemy-hazards`).
Cada estructura MUST incluir los campos de "Estructuras en el snapshot" (`goblin-structures`).

La lista de enemigos contiene solo enemigos vivos y va ordenada por orden de aparición o nacimiento. Una baja MUST
quitar al enemigo de la lista sin cambiar el orden relativo de los demás. La lista de ovejas contiene solo ovejas vivas,
va ordenada por orden de creación y una muerte no cambia el orden relativo de las demás. La lista de proyectiles va
ordenada por orden de creación y una desaparición no cambia el orden relativo de los demás. La lista de recogibles va
ordenada por orden de creación, sin agrupar por tipo, y una recogida no cambia el orden relativo de los demás. Las
listas de dinamitas y de explosiones van ordenadas por orden de creación y la de avisos con el orden de "Aviso en el
suelo" (`enemy-hazards`). Las listas de estructuras, de vetas y de productos de la tienda conservan su orden y su
longitud durante toda la partida.

<!-- Escenarios vivos sin cambios: todos salvo "Partida recién creada" y "Oferta en el snapshot". -->

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con vida máxima 100
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** las listas de enemigos, proyectiles, pulsos, dinamitas, avisos, explosiones, gemas y mejoras adquiridas
  están vacías y no hay oferta
- **AND** la vida actual y la máxima valen 100, el jugador no está invulnerable y el estado es en curso
- **AND** el resultado está vacío y las bajas valen 0
- **AND** el oro y la madera valen 0
- **AND** el nivel vale 1, la XP actual 0 y la XP para el siguiente nivel 5
- **AND** con el contenido por defecto, la lista de armas es `linter` y `tests`, en ese orden, ambas cargadas, y la
  duración objetivo equivale a 36.000 ticks
- **AND** con el mapa vacío las listas de estructuras, vetas, ovejas y recogibles están vacías y la tienda no tiene
  puerta y, con el mapa generado, la de estructuras tiene todas las colocadas, ninguna destruida, la de vetas todas las
  colocadas, todas activas, la de ovejas todas las colocadas, en `graze`, la de recogibles solo los montones de madera
  y la tienda tiene la puerta en (1.950, 1.170), desarmada
- **AND** en ambos casos la lista de productos tiene los 7 productos con nivel 0

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
3. armas (ver `auto-weapons`), en este orden:
   1. movimiento, impacto y caducidad de los proyectiles existentes, en orden de creación (contra enemigos y, los
      dirigidos a una estructura, contra estructuras, y los dirigidos a una oveja, contra ovejas);
   2. cada arma, en el orden de `content/weapons.json`, elige objetivo con las posiciones de ese momento (enemigos
      primero; estructuras no destruidas solo si no hay enemigos en alcance; ovejas vivas solo si tampoco hay
      estructuras en alcance) y, si está cargada y lo tiene, dispara (crea su proyectil o aplica su pulso);
   3. los enemigos cuya vida ha llegado a 0 en este tick quedan dados de baja, suman cada uno 1 al contador de bajas
      y sueltan, en el orden de la lista de enemigos, su gema, si son un `goblin-barrel` su madera y, si su tipo tiene
      oro por baja, su oro (ver `xp-gems`, "Madera del barril abatido" en `enemy-hazards`, "Oro por enemigo abatido"
      en `resources` y `run-outcome`);
   4. las estructuras cuya vida ha llegado a 0 en este tick quedan destruidas y sueltan su oro, en el orden de la lista
      de estructuras, sin gema ni baja (ver `goblin-structures`);
   5. las ovejas cuya vida ha llegado a 0 en este tick mueren y sueltan su carne, en el orden de la lista de ovejas,
      sin gema ni baja (ver "Vida, daño y muerte de las ovejas" en `sheep` y "Carne de las ovejas abatidas" en
      `resources`);
4. peligros (ver `enemy-hazards`), en este orden:
   1. explosiones del tick: las de los barriles vivos cuya mecha termina en este tick, en el orden de la lista de
      enemigos, y después las de las dinamitas cuyo vuelo termina en este tick, en orden de creación; cada una daña a
      los enemigos vivos de su radio (fuego amigo) y a las ovejas vivas de su radio, no daña estructuras ni vetas, y
      queda registrada como golpe candidato si alcanza al jugador;
   2. los barriles que han explotado y los enemigos cuya vida ha llegado a 0 en este paso quedan dados de baja, suman
      cada uno 1 al contador de bajas y sueltan su gema, en el orden de la lista de enemigos; los `goblin-barrel` dados
      de baja sin haber explotado sueltan además su madera, los que han explotado no sueltan madera ni oro, y el resto
      suelta su oro por baja tras su gema (y su madera); después, las ovejas cuya vida ha llegado a 0 en este paso
      mueren y sueltan su carne, en el orden de la lista de ovejas;
   3. lanzamientos: cada enemigo vivo cuya carga termina en este tick o que sigue en carga esperando sitio, en el
      orden de la lista de enemigos, lanza una dinamita hacia la posición del jugador tras el paso 1 si hay sitio bajo
      el tope de dinamitas, y entra en espera;
5. golpe al jugador (ver `player-health`): con los contactos de los enemigos vivos con daño por contacto y las
   explosiones del paso 4.1 que le alcanzan, un solo golpe del mayor daño, reducido por la armadura con un mínimo de 1,
   si no está invulnerable (las ovejas no son golpe candidato); si la vida llega a 0, la partida termina con derrota y
   el tick acaba aquí;
6. si el número de este tick es igual a la duración objetivo en ticks, la partida termina con victoria y el tick
   acaba aquí (ver `run-outcome`);
7. recogibles, vetas y regeneración:
   1. recogibles de los cuatro tipos, en orden de creación: atracción, movimiento del imán y recogida; la XP recogida
      se suma con su bonificación y se registran las subidas de nivel (ver `xp-gems` y `leveling`), el oro recogido se
      suma con su bonificación y la madera recogida se suma a sus contadores (ver `resources`) y la carne recogida cura
      al jugador (ver "Curación por carne" en `player-health`);
   2. vetas, en el orden de su lista: cada veta activa en contacto con el jugador suma su oro, con su bonificación, y
      queda agotada (ver "Vetas de oro al pasar" en `resources`);
   3. regeneración, si el número de este tick es múltiplo del intervalo (ver "Regeneración de vida" en
      `player-health`);
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
    partida sigue en curso, se abre la tienda si procede y la partida pasa a en tienda; el tick cuenta igualmente.

En una partida terminada, que está eligiendo mejora o que está en tienda no se ejecuta ningún paso (ver `run-state`).

<!-- Escenarios vivos sin cambios: todos los de este requisito (con oro por baja 0 de escenario donde cuentan u ordenan
     recogibles, ver "Oro por enemigo abatido" en `resources`). -->

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
eligiendo mejora, en tienda o terminada, cuando no hay partida (menú de inicio) y cuando el modo manual no está activo
(en este último caso, además, emite 1 aviso por consola que menciona `manual` por llamada y no altera el avance
en tiempo real).

Valores de n: es válido un entero en `[1, 9.007.199.254.740.991]` (`Number.MAX_SAFE_INTEGER`). Cualquier otro
valor (0, negativo, no entero, `NaN`, `Infinity`, texto, sin argumento) MUST rechazarse: `step` devuelve 0, no
ejecuta ningún tick, no cambia el snapshot y emite exactamente 1 aviso por consola que menciona `step` por
llamada inválida. Un n válido mayor que los ticks que le quedan a la partida avanza hasta el estado de parada.

Llamadas simultáneas: si se llama a `step` mientras otro `step` no ha terminado, las llamadas MUST ejecutarse
una tras otra en el orden en que se hicieron, sin perder ni duplicar ticks; cada una devuelve sus propios ticks.

<!-- Escenarios vivos sin cambios: todos los de este requisito. El nuevo se cubre sin navegador (adaptador de step con
     una partida falsa) o dentro del E2E "Abrir, intentar comprar y salir" de `castle-shop`. -->

#### Scenario: Tienda a mitad de step
- **GIVEN** modo manual y una partida en el tick n que abre la tienda en el tick n + 7
- **WHEN** se llama a `step(20)`
- **THEN** devuelve 7, `snapshot.tick` vale n + 7 y la partida está en tienda
- **AND** un `step(10)` posterior devuelve 0; tras salir de la tienda, `step(10)` devuelve 10
