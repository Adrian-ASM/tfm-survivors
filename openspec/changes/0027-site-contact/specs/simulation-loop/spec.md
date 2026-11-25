# Spec delta · simulation-loop

## MODIFIED Requirements

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

<!-- Escenarios vivos sin cambios: todos los de este requisito salvo los dos de solares, que se sustituyen por los de
     abajo. -->

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

<!-- Escenarios vivos sin cambios: todos los de este requisito salvo "Solar abierto con los recursos del mismo tick",
     que se sustituye por el de abajo. -->

#### Scenario: Solar abierto con los recursos del mismo tick
- **GIVEN** el solar de prueba (`build-sites`) armado, madera 14 y un recogible `wood` de valor 1 que se recoge en el
  tick n, el mismo en que el jugador toca la huella por primera vez
- **WHEN** se ejecuta el tick n
- **THEN** la partida está en obra en el snapshot del tick n y la opción `house` de la oferta es asequible

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
