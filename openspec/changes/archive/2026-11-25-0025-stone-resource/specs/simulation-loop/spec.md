# Spec delta · simulation-loop

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Determinismo
El sistema SHALL producir exactamente el mismo `RunSnapshot`, enemigos (estado de comportamiento incluido), vida,
invulnerabilidad, estado de la partida, resultado, bajas, proyectiles, pulsos, dinamitas, avisos, explosiones,
estructuras (vida y destrucción incluidas), ovejas (identificador, posición, vida, estado y punto de origen), indicación
de daño, recogibles de los cinco tipos (gemas, carne y piedras con su origen incluidas), oro, madera, piedra, vetas (activa
o agotada), XP, nivel, ofertas, mejoras adquiridas de los dos catálogos, estado de la puerta de la tienda y productos de
la tienda incluidos, y el mismo mapa, a partir del mismo estado inicial, la misma semilla, la misma secuencia de inputs
por tick, la misma secuencia de elecciones de mejora (índice elegido en cada oferta) y la misma secuencia de acciones en
cada visita a la tienda (productos comprados, en orden, y salida). En particular, el resultado de la partida, el tick en
que termina, las bajas y la posición de cada enemigo y de cada oveja en cada tick MUST ser los mismos. El núcleo MUST NOT
depender de reloj del sistema, aleatoriedad global ni APIs del navegador: toda la aleatoriedad MUST venir de instancias
del puerto `RandomGenerator` inicializadas a partir de la semilla de la partida: una para generar el mapa, otra para
colocar las estructuras (ver "Colocación determinista con azar propio" en `goblin-structures`), otra para colocar las
vetas y los montones (ver "Colocación de recursos determinista con azar propio" en `procedural-map`), el azar de las
ovejas (una o varias, ver "Ovejas deterministas" en `sheep`), el **azar de la piedra** (ver "Azar de la piedra") y otra
para el resto de la partida (ver "Azar del mapa independiente del de la partida" en `procedural-map`). Las armas
(selección de objetivo entre enemigos, estructuras y ovejas, disparo, proyectiles y pulsos), las bajas y su contador, la
destrucción de estructuras, el movimiento, la huida, el daño y la muerte de las ovejas, los recogibles de los cinco tipos
(suelta, madera del barril, oro de las bajas, oro de las estructuras, carne de las ovejas, recolocación, tope por tipo,
imán y recogida), las bonificaciones de XP y de oro y sus restos, la curación (carne, regeneración, subida sin mejoras y
pago), la armadura, la invulnerabilidad mejorada, las vetas (contacto y agotamiento), los contadores de oro, madera y
piedra, la colisión del jugador con el mapa, la persecución de los enemigos (línea libre, campo de distancias y
navegación), la navegación hacia un punto fijo, los estados de comportamiento y sus transiciones (patrulla, alerta y
vuelta incluidas), el nacimiento de guardias, los lanzamientos, las dinamitas, los avisos y las explosiones, la
recolocación de las apariciones y de los puntos de patrulla, la XP, la puerta de la tienda (re-armado y apertura), las
compras, la salida de la tienda y la comprobación de victoria y derrota MUST NOT consumir azar; la apertura de ofertas de
mejora sí lo consume, y cada intento de posición de aparición consume exactamente 1 valor (ver `enemy-spawning`). La
colocación inicial, el primer pasto, la dirección de los paseos y la reaparición de las ovejas consumen solo el azar de
las ovejas. La tirada de piedra de cada baja (abatida o no, con cualquier probabilidad) consume exactamente 1 valor del
azar de la piedra y ningún otro (ver "Piedra por enemigo abatido" en `resources`). Los comportamientos, los peligros, las
estructuras, los recursos, las ovejas, la piedra y la tienda MUST NOT cambiar el mapa generado por ninguna semilla.

<!-- Escenarios vivos sin cambios (con la política de tienda fija cuando el escenario no dice nada de la tienda y, en
     los que cuentan recogibles de bajas, sin piedra salvo que digan otra cosa): todos los de este
     requisito. -->

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
- el oro, la madera y la piedra de la partida (ver "Contadores de oro y madera de la partida" y "Contador de piedra de
  la partida" en `resources`);
- la lista de enemigos vivos;
- la lista de ovejas vivas (ver `sheep`);
- la lista de proyectiles vivos (ver `auto-weapons`);
- la lista de pulsos visibles (ver `auto-weapons`);
- la lista de dinamitas en vuelo, la de avisos y la de explosiones visibles (ver `enemy-hazards`);
- la lista de estructuras de la partida, destruidas incluidas (ver "Estructuras en el snapshot" en
  `goblin-structures`);
- la lista de vetas de la partida, agotadas incluidas (ver "Vetas de oro al pasar" en `resources`);
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
se reutiliza, su posición y su radio. Cada pulso visible MUST incluir el identificador del arma que lo disparó, el
tick en que se disparó, su centro y su radio. Cada recogible MUST incluir un identificador único dentro de la partida
que no se reutiliza (una sola secuencia para los cinco tipos), su tipo (`xp`, `gold`, `wood`, `meat` o `stone`), su
valor, su posición y su radio; cada recogible `stone` soltado por una baja incluye además su origen (`source`, el tipo
de enemigo que lo soltó), y los de los otros tipos no lo incluyen. Cada veta
MUST incluir un identificador único dentro de la partida, su posición, su radio de contacto, su oro y si está activa o
agotada. Cada dinamita MUST incluir su identificador, su posición, su objetivo, su radio visual y el tick en que
explotará; cada aviso, su centro, su radio, su origen (mecha o dinamita) y el tick en que explotará; cada explosión, su
identificador, su centro, su radio y el tick en que ocurrió (ver `enemy-hazards`). Cada estructura MUST incluir los
campos de "Estructuras en el snapshot" (`goblin-structures`).

La lista de enemigos contiene solo enemigos vivos y va ordenada por orden de aparición o nacimiento. Una baja MUST
quitar al enemigo de la lista sin cambiar el orden relativo de los demás. La lista de ovejas contiene solo ovejas vivas,
va ordenada por orden de creación y una muerte no cambia el orden relativo de las demás. La lista de proyectiles va
ordenada por orden de creación y una desaparición no cambia el orden relativo de los demás. La lista de recogibles va
ordenada por orden de creación, sin agrupar por tipo, y una recogida no cambia el orden relativo de los demás. Las
listas de dinamitas y de explosiones van ordenadas por orden de creación y la de avisos con el orden de "Aviso en el
suelo" (`enemy-hazards`). Las listas de estructuras, de vetas y de productos de la tienda conservan su orden y su
longitud durante toda la partida.

<!-- Escenarios vivos sin cambios: todos los de este requisito salvo "Partida recién creada" y "Snapshot no mutable
     desde fuera" (este en "Determinismo"), que se amplían con la piedra: el de abajo sustituye a "Partida recién
     creada"; en "Snapshot no mutable desde fuera" la partida del tick 10 tiene además ≥ 1 recogible `stone` y el
     adaptador modifica también la piedra y el origen de un recogible `stone`. -->

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con vida máxima 100
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** las listas de enemigos, proyectiles, pulsos, dinamitas, avisos, explosiones, gemas y mejoras adquiridas
  están vacías y no hay oferta
- **AND** la vida actual y la máxima valen 100, el jugador no está invulnerable y el estado es en curso
- **AND** el resultado está vacío y las bajas valen 0
- **AND** el oro, la madera y la piedra valen 0, y no hay ningún recogible `stone`
- **AND** el nivel vale 1, la XP actual 0 y la XP para el siguiente nivel 5
- **AND** con el contenido por defecto, la lista de armas es `linter` y `tests`, en ese orden, ambas cargadas, y la
  duración objetivo equivale a 36.000 ticks
- **AND** con el mapa vacío las listas de estructuras, vetas, ovejas y recogibles están vacías y la tienda no tiene
  puerta y, con el mapa generado, la de estructuras tiene todas las colocadas, ninguna destruida, la de vetas todas las
  colocadas, todas activas, la de ovejas todas las colocadas, en `graze`, la de recogibles solo los montones de madera
  y la tienda tiene la puerta en (1.950, 1.170), desarmada
- **AND** en ambos casos la lista de productos tiene los 7 productos con nivel 0

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
      los enemigos vivos de su radio (fuego amigo) y a las ovejas vivas de su radio, no daña estructuras ni vetas, y
      queda registrada como golpe candidato si alcanza al jugador;
   2. los barriles que han explotado y los enemigos cuya vida ha llegado a 0 en este paso quedan dados de baja, suman
      cada uno 1 al contador de bajas y sueltan su gema, en el orden de la lista de enemigos; los `goblin-barrel` dados
      de baja sin haber explotado sueltan además su madera, el resto suelta su oro por baja tras su gema (y su
      madera), y cada baja hace después su tirada de piedra (1 valor del azar de la piedra) y suelta su piedra si sale;
      los que han explotado hacen la tirada pero no sueltan madera, oro ni piedra; después, las ovejas cuya vida ha llegado a 0 en este paso mueren y sueltan su
      carne, en el orden de la lista de ovejas;
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
   1. recogibles de los cinco tipos, en orden de creación: atracción, movimiento del imán y recogida; la XP recogida
      se suma con su bonificación y se registran las subidas de nivel (ver `xp-gems` y `leveling`), el oro recogido se
      suma con su bonificación, la madera y la piedra recogidas se suman a sus contadores (ver `resources`) y la carne
      recogida cura al jugador (ver "Curación por carne" en `player-health`);
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

<!-- Escenarios vivos sin cambios (sin piedra salvo que digan otra cosa): todos los de este
     requisito. -->

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

#### Scenario: Peor caso con los cinco topes llenos
- **GIVEN** la partida descrita en el requisito, con una vida del jugador suficiente para no llegar a 0
- **WHEN** el benchmark mide 60 ticks consecutivos (60 × 6 px = 360 px < 400, ningún recogible se recoge)
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
- **AND** la media medida se anota en el verify-report frente al objetivo de ≤ 0,25 ms y frente a los 0,27 ms de 0022
