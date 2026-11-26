# Spec delta · simulation-loop

<!-- Change 0031-combat-feedback. Los escenarios usan los valores por defecto de `auto-weapons` (Linter daño 6,
     Tests daño 4 y radio 90), `goblin-torch` vida 10, `goblin-tnt` vida 45, la oveja de prueba de vida 12 y radio 20
     (`tests/support/sheep.ts`), casa 60 y torre 90 de vida, y el contenido de combate por defecto: ventana de golpes
     15 ticks y tope de golpes por tick 48. "Golpe" es la entrada del registro de combate de este change; no confundir
     con el "golpe" al jugador de `player-health`, que aquí produce como mucho 1 golpe de clase `player` por tick. -->

## ADDED Requirements

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

## REMOVED Requirements
(ninguno)
