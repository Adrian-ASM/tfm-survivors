# Resources · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El oro, la madera y la piedra de la partida: sus contadores, sus fuentes (enemigos abatidos, barril, casas y
torres, montones de madera y vetas de oro; la piedra, de los enemigos abatidos), el gasto de oro en la tienda
(`castle-shop`) y la carne de las ovejas, que cura al recogerla (ver `sheep` y `player-health`). Gastar madera y
piedra es de 0026 (solares de obra).

**Vocabulario**: un **recogible** es un objeto del suelo con un **tipo** de la unión cerrada
`xp | gold | wood | meat | stone` y un **valor** entero ≥ 1 (ver "Recogibles con tipo" en `xp-gems`). Una **gema** es un recogible de tipo `xp`: donde
una spec viva dice "gema" sin más, se refiere solo a los recogibles de tipo `xp`. Un **montón de madera** es un
recogible de tipo `wood` presente desde el tick 0. Una **veta** es un punto fijo del mapa generado que entrega oro
al pasar el jugador una sola vez. Una **piedra** es un recogible de tipo `stone`; su **origen** (`source`) es el tipo
de enemigo que la soltó y solo decide su aspecto.

## Requirements

### Requirement: Contenido de recursos validado
El sistema SHALL leer de `content/*.json`, validados con zod antes de llegar al dominio:
- las **cantidades** de cada fuente, enteros ≥ 1: madera por `goblin-barrel` abatido, oro por `goblin-house`
  destruida, oro por `goblin-tower` destruida, oro por veta, madera por montón y **carne por oveja**;
- el **oro por baja** de cada tipo de enemigo (ver "Oro por enemigo abatido"), enteros ≥ 0;
- la **probabilidad de piedra** de cada tipo de enemigo (`drops.stoneChance`, ver "Piedra por enemigo abatido"):
  porcentaje entero de 0 a 100;
- la **curación de la carne**: el porcentaje de la vida máxima efectiva que cura cada unidad de valor de un recogible
  `meat` (ver "Curación por carne" en `player-health`), entero de 1 a 100. Esta cota se aplica al valor base del
  contenido, sin mejoras; la cota de la curación efectiva con las mejoras de `meatHealPercent` (`hunter`) la fija
  "Estadísticas de personaje nuevas" en `upgrades` (base + todas en su `maxLevel` entre 1 y 100);
- el **número por mapa generado** de montones de madera y de vetas: enteros ≥ 0;
- el **radio de contacto de la veta**: número > 0;
- los **parámetros de colocación** de montones y vetas (ver "Recursos en el mapa generado" en `procedural-map`):
  enteros ≥ 0, en celdas.

Un valor fuera de rango, un campo ausente o un campo desconocido MUST impedir que se muestre el menú o empiece una
partida, con un error que nombre el campo. Los tipos de recogible son exactamente `xp`, `gold`, `wood`, `meat` y
`stone`: un contenido que declare otro tipo falla con un error que nombra el tipo. El valor de cada piedra es siempre 1:
no es un dato de contenido. Con el contenido por defecto, la carne por oveja vale 1 y la curación de la carne 20. El
tope de oro en el suelo es el del contenido (puede subir respecto a 32 por el oro de las bajas; se calibra en apply).

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito, las seis cantidades son enteros ≥ 1, el número de montones y el de vetas por mapa son
  enteros ≥ 1 y el radio de contacto de la veta es > 0
- **AND** la carne por oveja vale 1 y la curación de la carne vale 20
- **AND** cada tipo de enemigo de `content/enemies.json` tiene una probabilidad de piedra entera en 0..100 y ≥ 1 tipo
  tiene probabilidad ≥ 1

#### Scenario: Valores fuera de rango
- **GIVEN** el contenido por defecto con, en un caso cada vez: la madera por barril 0, −1 o 2,5; el oro por casa 0; el
  oro por torre 1,5; el oro por veta 0; la madera por montón 0; la carne por oveja 0 o 1,5; la curación de la carne 0,
  101 o 12,5; el número de vetas −1 o 1,5; el radio de contacto de la veta 0 o −4; o una distancia de colocación −1
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: 0 montones y 0 vetas por mapa; todas las cantidades a 1;
  la curación de la carne 1; la curación de la carne 100 con un catálogo de personaje sin mejoras de
  `meatHealPercent`; o todas las distancias de colocación a 0
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito
- **AND** con la curación de la carne 100 y el catálogo de personaje por defecto (`hunter` con `perLevel` > 0) la carga
  falla con el error de `upgrades` que nombra `hunter` y `meatHealPercent`, no con un error del campo de recursos

#### Scenario: Campos ausentes, desconocidos y tipo no admitido
- **GIVEN** el contenido por defecto sin el oro por veta, en otro caso sin la curación de la carne, en otro con un campo
  extra `meatPerHouse: 5`, y en otro con un tipo de recogible `potion`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el oro por veta, la curación de la carne, `meatPerHouse` y `potion`
  respectivamente

#### Scenario: Valor de piedra no configurable
- **GIVEN** el contenido por defecto con un campo extra `stonePerDrop: 3` en el contenido de recursos
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `stonePerDrop`

### Requirement: Contadores de oro y madera de la partida
El sistema SHALL llevar en cada partida dos contadores enteros, **oro** y **madera**, que valen 0 al crear la
partida (también tras R y tras `Volver al menú` + `Jugar`). La madera solo sube: cada recogida de un recogible `wood`
suma su valor. El oro sube con cada **ingreso** (la recogida de un recogible `gold` o el agotamiento de una veta, ver
"Vetas de oro al pasar") y solo baja con las compras de la tienda (ver "Compra en la tienda" en `castle-shop`); nunca
es negativo. Cada ingreso de valor v suma v más la bonificación de oro efectiva g (`goldBonusPercent`, ver
"Estadísticas de personaje nuevas" en `upgrades`; 0 sin mejoras), con la misma regla de resto arrastrado que la XP
(ver "Subida de nivel con arrastre" en `leveling`) y un resto propio del oro: suma ⌊(v × (100 + g) + r) / 100⌋. Con
g = 0 cada ingreso suma exactamente v. No bajan al recibir daño ni al subir de nivel y no se conservan entre
partidas. Recoger oro o madera MUST NOT sumar XP, y recoger XP MUST NOT cambiar el oro ni la madera. Los contadores no
se guardan en récords ni en el historial (`progress-persistence` sin cambios) ni se muestran en la pantalla de
resultados (`run-results` sin cambios).

#### Scenario: Partida recién creada
- **GIVEN** el contenido por defecto y la semilla 42 con su mapa generado
- **WHEN** se lee el snapshot del tick 0
- **THEN** el oro vale 0 y la madera vale 0

#### Scenario: Recogida de oro y de madera en el mismo tick
- **GIVEN** un jugador quieto en (480, 270) con oro 0, madera 0, XP 0 en nivel 1, y en su misma posición un
  recogible `gold` de valor 10, uno `wood` de valor 3 y uno `xp` de valor 1
- **WHEN** se ejecuta 1 tick
- **THEN** desaparecen los tres, el oro vale 10, la madera vale 3 y la XP actual vale 1

#### Scenario: Solo suben
- **GIVEN** una partida con oro 25 y madera 6 en el tick n, el jugador no invulnerable en contacto con un enemigo de
  daño 10 y una gema que le hace subir de nivel en ese tick
- **WHEN** se ejecuta el tick n
- **THEN** el oro sigue en 25 y la madera en 6 en el snapshot del tick n

#### Scenario: Partida nueva tras R
- **GIVEN** una partida terminada con oro 40 y madera 12
- **WHEN** se pulsa R y se lee el snapshot del tick 0 de la partida nueva
- **THEN** el oro vale 0 y la madera vale 0

#### Scenario: Valores grandes
- **GIVEN** una partida con oro 99.990 y un recogible `gold` de valor 10 que se recoge en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el oro vale exactamente 100.000 (entero, sin redondeo ni tope)

#### Scenario: Sin rastro en resultados ni en el guardado
- **GIVEN** una partida terminada con oro 30 y madera 8
- **WHEN** se muestra la pantalla de resultados y se guarda el récord y la entrada de historial
- **THEN** la pantalla de resultados tiene las mismas 5 líneas que antes del change, sin oro ni madera
- **AND** el récord y la entrada de historial guardados no tienen ningún campo de oro ni de madera

#### Scenario: Bonificación de oro
- **GIVEN** g = 20, oro 0 y resto 0, un recogible `gold` de valor 10 que se recoge en el tick n y una veta de oro 15
  que se agota en el tick n + 1
- **WHEN** se ejecutan los ticks n y n + 1
- **THEN** el oro vale 12 tras el tick n y 30 tras el n + 1 (12 + ⌊15 × 120 / 100⌋ = 12 + 18)

#### Scenario: Resto arrastrado del oro
- **GIVEN** g = 10, oro 0 y resto 0
- **WHEN** se recogen 10 recogibles `gold` de valor 1 en ticks distintos
- **THEN** el oro vale 11

#### Scenario: El oro solo baja al comprar
- **GIVEN** una partida en tienda con oro 30 y un producto de precio 30
- **WHEN** se compra el producto y se sale de la tienda
- **THEN** el oro vale 0 y vuelve a subir con el siguiente ingreso
- **AND** con oro 29 la compra devuelve un error de oro insuficiente y el oro sigue en 29

### Requirement: Montones de madera recogibles desde el inicio
El sistema SHALL crear, al crear una partida con el mapa generado, un recogible `wood` por cada montón de madera que
coloque el mapa (ver "Recursos en el mapa generado" en `procedural-map`), en la posición del montón, con el valor de
madera por montón del contenido, en el orden de colocación y antes que cualquier otro recogible de la partida. Un
montón es un recogible `wood` como cualquier otro: el imán lo atrae y se recoge por solape (ver `xp-gems`). El mapa
vacío no tiene montones; un mapa explícito solo tiene los que declare el escenario.

#### Scenario: Montones en el tick 0
- **GIVEN** el contenido por defecto con N montones por mapa y la semilla 42 con su mapa generado
- **WHEN** se lee el snapshot del tick 0
- **THEN** la lista de recogibles tiene exactamente N recogibles, todos `wood`, con el valor de madera por montón, en
  las posiciones de los montones colocados y en su orden, y ninguno de tipo `xp` ni `gold`

#### Scenario: Montón recogido al pasar
- **GIVEN** el mapa vacío con un montón declarado de valor 4 en (900, 540), el jugador en (700, 540) con velocidad 215,
  `pickupRadius` 128, input (1, 0) y madera 0
- **WHEN** se ejecutan ticks hasta que el montón deja de figurar en el snapshot (como mucho 120)
- **THEN** la madera vale 4 desde el tick en que desaparece y no cambia en los ticks siguientes

#### Scenario: Mapa vacío sin montones
- **GIVEN** el contenido por defecto, la semilla 42 y el mapa vacío
- **WHEN** se lee el snapshot del tick 0
- **THEN** la lista de recogibles está vacía y la madera vale 0

### Requirement: Vetas de oro al pasar
El sistema SHALL dar a cada veta de la partida, al crearla, el estado **activa** y el oro por veta del contenido. En el
paso de recogibles del tick (ver "Orden de los pasos del tick" en `simulation-loop`), tras la recogida de los
recogibles, cada veta activa cuyo centro está a distancia **estrictamente menor** que radio del jugador + radio de
contacto de la veta del centro del jugador (ya movido en ese tick) suma su oro al contador de oro y pasa a **agotada**
de forma irreversible. Las vetas se procesan en el orden de su lista; varias vetas tocadas en el mismo tick suman todas
su oro. Una veta agotada no entrega nada más aunque el jugador vuelva a tocarla. Una veta:
- no bloquea al jugador ni a los enemigos y no cambia ninguna celda, el campo de distancias ni la línea libre;
- no tiene vida, no es objetivo de ningún arma ni recibe daño de explosiones;
- no la atrae el imán ni se mueve: el radio de recogida efectivo (ver `upgrades`) no la afecta;
- sigue en la lista de vetas del snapshot hasta el final de la partida, activa o agotada.

En el tick de la victoria (o de la derrota) no se procesa ninguna veta (el tick acaba antes del paso de recogibles).

#### Scenario: Veta tocada
- **GIVEN** el mapa vacío con una veta declarada activa en (1.000, 1.000) con oro 15 y radio de contacto 24, el jugador
  (radio 16) quieto en (1.039,9; 1.000) (distancia 39,9 < 40) y oro 0
- **WHEN** se ejecuta 1 tick
- **THEN** el oro vale 15 y la veta figura agotada en el snapshot de ese tick

#### Scenario: Tangencia no es contacto
- **GIVEN** la veta del escenario anterior y el jugador quieto en (1.040, 1.000) (distancia 40 = 16 + 24)
- **WHEN** se ejecutan 600 ticks
- **THEN** el oro sigue en 0 y la veta sigue activa

#### Scenario: Un solo uso
- **GIVEN** la veta del escenario "Veta tocada" agotada en el tick n con el jugador encima y oro 15
- **WHEN** el jugador se aleja 200 px, vuelve a ponerse sobre su centro y se ejecutan 600 ticks más
- **THEN** el oro sigue en 15 y la veta sigue agotada en todos los snapshots

#### Scenario: Dos vetas en el mismo tick
- **GIVEN** dos vetas activas v1 y v2, en ese orden, con oro 15 y 20, ambas a distancia < 40 del jugador quieto, y oro 0
- **WHEN** se ejecuta 1 tick
- **THEN** el oro vale 35 y ambas figuran agotadas

#### Scenario: El radio de recogida no alcanza la veta
- **GIVEN** la veta del escenario "Veta tocada" y el jugador quieto en (1.100, 1.000) (distancia 100, < `pickupRadius`
  128, > 40)
- **WHEN** se ejecutan 600 ticks
- **THEN** la veta sigue en (1.000, 1.000), activa, y el oro sigue en 0

#### Scenario: La veta no detiene a nadie ni recibe daño
- **GIVEN** el mapa vacío con una veta activa en (1.000, 1.000), el jugador con velocidad 215 en (900, 1.000) con input
  (1, 0), y una dinamita de radio 48 y daño 20 que explota en (1.000, 1.000) en el tick 30
- **WHEN** se ejecutan 60 ticks
- **THEN** el jugador está en (1.115, 1.000) (error ≤ 0,001), igual que sin la veta, y la veta figura agotada sin
  ningún campo de vida
- **AND** ningún proyectil ni pulso ha tenido la veta como objetivo

#### Scenario: Sin vetas en el tick de la victoria
- **GIVEN** una partida con duración objetivo 120 ticks y el jugador que entra en contacto con una veta activa
  justo en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida termina con victoria, la veta sigue activa y el oro no cambia

### Requirement: Recursos sin efecto en el combate
El sistema SHALL hacer que los recogibles de oro, de madera y de piedra, los montones, las vetas y los contadores no
cambien nada del combate ni de la progresión **mientras no se compre nada**: con la misma semilla, el mismo mapa, las
mismas ovejas, los mismos inputs, las mismas elecciones y la política de tienda fija (ver `simulation-loop`), una
partida con el contenido por defecto y otra igual salvo 0 montones, 0 vetas, oro por baja 0 y probabilidad de piedra 0
en todos los tipos y sin drops de oro ni de madera de barriles y estructuras (las cantidades no pueden ser 0: el
escenario anula las fuentes, no el contenido; la carne de las ovejas se mantiene en las dos) MUST tener en cada tick los
mismos enemigos (identificador, tipo, posición, vida y estado), jugador (posición, vida e invulnerabilidad), ovejas
(identificador, posición, vida y estado), proyectiles, pulsos, peligros, estructuras, bajas, gemas y carne
(identificadores aparte), XP, nivel, ofertas, mejoras, estado y resultado. Los recursos MUST NOT consumir el azar de la
partida (oleadas y ofertas) ni el de las celdas, la decoración, las estructuras o las ovejas; las tiradas de piedra solo
consumen el azar de la piedra. Las compras sí cambian el combate (ver `castle-shop`).

#### Scenario: Mismo combate con y sin recursos
- **GIVEN** dos partidas con el contenido por defecto y las semillas 7 y 42, cada una con su mapa generado (ovejas
  incluidas), una con los recursos y otra sin fuentes de oro, de madera ni de piedra (oro por baja 0 y probabilidad de
  piedra 0 incluidos), la misma secuencia de 14.400 inputs generada por una seed fija, la política de elección fija, la
  política de tienda fija y una vida máxima suficiente para no llegar a 0
- **WHEN** ambas ejecutan 14.400 ticks
- **THEN** en cada tick los campos de combate y de progresión enumerados en el requisito son iguales en las dos, sin
  tolerancia
- **AND** en la partida con recursos el oro o la madera es > 0 en el tick 14.400 y se ha soltado ≥ 1 piedra

#### Scenario: Los recursos no consumen azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una se recogen en el tick n 3 recogibles
  `gold`, 2 `wood`, se agota 1 veta y muere por armas 1 `goblin-barrel` que suelta madera
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick
- **AND** el del azar de las ovejas también es el mismo en las dos

#### Scenario: La piedra solo consume su azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo la probabilidad de piedra (0 en una y 100 en todos los
  tipos en la otra), en las que mueren 3 enemigos por armas en el tick n y se recogen 2 recogibles `stone` en la segunda
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick, y también el del azar de
  las ovejas
- **AND** el azar de la piedra ha consumido exactamente 3 valores en cada una y su estado es el mismo en las dos

### Requirement: Carne de las ovejas abatidas
El sistema SHALL crear, por cada oveja que muere en un tick (ver "Vida, daño y muerte de las ovejas" en `sheep`),
exactamente un recogible `meat` con el valor de **carne por oveja** del contenido, en la posición que tenía la oveja en
el paso en que muere (o en la que fije "Recolocación de gemas en celdas no caminables" en `xp-gems` si esa posición está
en una celda no caminable). Los recogibles de carne de un mismo paso se crean en el orden de la lista de ovejas; en el
paso de armas, después de los recogibles de las bajas y del oro de las estructuras destruidas de ese paso; en el paso
de peligros, después de los recogibles de las bajas de ese paso. Ninguna otra cosa crea carne: ni los enemigos, ni las
estructuras, ni el mapa. La carne participa en el paso de recogibles de ese mismo tick y su efecto al recogerla es la
curación (ver "Curación por carne" en `player-health`). Crear carne MUST NOT consumir azar.

#### Scenario: Carne en la posición de la oveja
- **GIVEN** carne por oveja 1, la oveja de prueba con vida 6 en (1.000, 1.000) y un impacto del Linter (daño 6) sobre
  ella en el tick n, con el jugador a 300 px
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n contiene exactamente 1 recogible nuevo, de tipo `meat`, valor 1, en (1.000, 1.000) y
  radio 5

#### Scenario: Orden con bajas y estructuras en el paso de armas
- **GIVEN** un `goblin-torch` con vida 4, una torre con vida 4 y dos ovejas o1 (antes en la lista) y o2 con vida 4,
  todos dentro del radio de un pulso de Tests del tick n
- **WHEN** se ejecuta el tick n
- **THEN** se crean en este orden: la gema del `goblin-torch`, el `gold` de la torre, el `meat` de o1 y el `meat` de o2

#### Scenario: Orden en el paso de peligros
- **GIVEN** una explosión en el tick n que deja a vida 0 a un `goblin-torch` y a una oveja, sin daño de armas en ese
  tick
- **WHEN** se ejecuta el tick n
- **THEN** se crean la gema del `goblin-torch` y después el `meat` de la oveja

#### Scenario: Carne recogida en su tick
- **GIVEN** un jugador quieto con vida 50 de 100, curación del 20 % y una oveja con vida 4 que muere por un pulso de
  Tests a 10 px de su centro en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la carne se crea y se recoge en el tick n y la vida vale 70 en el snapshot del tick n

### Requirement: Oro por enemigo abatido
El sistema SHALL leer del contenido de recursos, validado con zod, un **oro por baja** para cada tipo de enemigo de
`content/enemies.json`: entero ≥ 0 (0 = ese tipo no suelta oro). Falta un tipo, sobra un tipo inexistente o un valor
fuera de rango MUST impedir que la partida arranque con un error que nombre el tipo. Con el contenido por defecto, al
menos un tipo tiene oro por baja ≥ 1 (los valores son los del contenido).

Cada enemigo **abatido** con oro por baja ≥ 1 MUST crear exactamente un recogible `gold` con ese valor, en la posición
de su gema (recolocación incluida, ver "Recolocación de gemas en celdas no caminables" en `xp-gems`), creado justo
después de su gema y, si es un `goblin-barrel`, de su madera. Abatido tiene el mismo sentido que en "Madera del barril
abatido" (`enemy-hazards`): dado de baja por armas o por una explosión ajena; un `goblin-barrel` que **explota** por su
mecha no suelta oro. Soltar oro MUST NOT cambiar la baja, su gema, el contador de bajas ni el daño de nadie, y MUST NOT
consumir azar. El oro de las bajas sigue el tope de oro (ver "Tope de gemas en el suelo" en `xp-gems`).

**Convención de escenario**: los escenarios vivos anteriores a este change que cuentan, ordenan o suman los
recogibles creados por bajas en un tick (p. ej. "Las estructuras se destruyen tras las bajas" y "Las ovejas mueren tras
las estructuras" en `simulation-loop`, "Orden con bajas y estructuras en el paso de armas" y "Orden en el paso de
peligros" de esta spec, "Tope de XP lleno con otros tipos en el suelo" en `xp-gems` y los de "Madera del barril
abatido" en `enemy-hazards`) se leen con oro por baja 0 en todos los tipos (contenido de escenario), salvo que digan
otra cosa.

#### Scenario: Oro de una baja por armas
- **GIVEN** oro por baja de `goblin-torch` 2 (valor de escenario) y un `goblin-torch` con vida 4 que muere por un
  impacto del Linter en el tick n en (780, 270), lejos del jugador
- **WHEN** se ejecuta el tick n
- **THEN** hay 1 gema nueva y 1 recogible `gold` nuevo de valor 2, ambos en (780, 270), con la gema creada antes

#### Scenario: Orden con el barril abatido
- **GIVEN** oro por baja de `goblin-barrel` 3 y madera por barril 2, y un `goblin-barrel` en persecución abatido por
  armas en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** se crean en este orden su gema, su `wood` de valor 2 y su `gold` de valor 3

#### Scenario: El barril que explota no suelta oro
- **GIVEN** oro por baja de `goblin-barrel` 3 y un barril cuya mecha termina en el tick n y explota
- **WHEN** se ejecuta el tick n
- **THEN** hay 1 gema nueva de ese barril y ningún recogible `gold` nuevo

#### Scenario: Baja por explosión ajena
- **GIVEN** oro por baja de `goblin-torch` 2 y un `goblin-torch` de vida 10 dentro del radio de una dinamita de daño 25
  que explota en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** hay 1 gema y 1 recogible `gold` de valor 2 nuevos de ese `goblin-torch`

#### Scenario: Tipo sin oro
- **GIVEN** oro por baja de `goblin-tnt` 0 y un `goblin-tnt` que muere por armas
- **WHEN** se ejecuta ese tick
- **THEN** hay 1 gema nueva y ningún recogible `gold` nuevo

#### Scenario: Tabla de oro por baja inválida
- **GIVEN** el contenido por defecto sin la entrada de `goblin-tnt-guard`, en otro caso con una entrada `goblin-ogre`
  y en otro con oro por baja −1 o 1,5 en `goblin-torch`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el tipo

#### Scenario: El oro por baja no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo el oro por baja (0 en una y el del contenido en la
  otra), en las que mueren 3 enemigos por armas en el tick n
- **WHEN** ambas ejecutan el tick n sin oferta ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

### Requirement: Más oro en las estructuras
El contenido por defecto SHALL dar más oro por estructura destruida que antes del change: el oro por `goblin-house`
MUST ser > 5 y el oro por `goblin-tower` > 8 (valores de antes del change). El número de vetas por mapa y su oro MUST
NOT cambiar, de modo que las firmas `MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN` y `SHEEP_GOLDEN` quedan
intactas.

#### Scenario: Oro de estructuras por defecto
- **GIVEN** el contenido por defecto tras el change
- **WHEN** se carga el contenido
- **THEN** el oro por casa es > 5 y el oro por torre es > 8
- **AND** el número de vetas por mapa y el oro por veta son los de antes del change

#### Scenario: Firmas intactas
- **GIVEN** el contenido por defecto tras el change
- **WHEN** se calculan las firmas de mapa, estructuras, recursos y ovejas de `tests/support/`
- **THEN** son iguales a las de antes del change

### Requirement: Piedra por enemigo abatido
El sistema SHALL leer del contenido de recursos (`resources.json`, `drops.stoneChance`), validado con zod, una
**probabilidad de piedra** para cada tipo de enemigo de `content/enemies.json`: porcentaje entero de 0 a 100 (0 = ese
tipo no suelta piedra nunca; 100 = la suelta en cada baja abatida). Falta un tipo, sobra un tipo inexistente o una
probabilidad fuera de 0..100 o no entera MUST impedir que se muestre el menú o empiece una partida, con un error que
nombre el tipo. Con el contenido por defecto, al menos un tipo tiene probabilidad ≥ 1 (los valores son los del
contenido, se fijan en design). El aspecto de la roca de cada tipo no es contenido de recursos (ver "Aspectos de los
recogibles y de las vetas" en `sprite-rendering`).

**Tirada**: **toda** baja de un enemigo, por armas o por explosión (también la del `goblin-barrel` que explota por su
mecha y la de un tipo con probabilidad 0), MUST consumir **exactamente 1 valor** u ∈ [0, 1) del **azar de la piedra**
(ver "Azar de la piedra" en `simulation-loop`), de modo que la k-ésima tirada de la partida es siempre la de su k-ésima
baja. La baja suelta una piedra si y solo si está **abatida** (mismo sentido que en "Oro por enemigo abatido": dada de
baja por armas o por una explosión ajena; un `goblin-barrel` que explota por su mecha no está abatido) y
⌊u × 100⌋ < p, con p la probabilidad de su tipo (equivale a u × 100 < p). Las tiradas de las bajas de un paso se hacen
en el orden de la lista de enemigos, al procesar cada baja; las del paso de armas, antes que las del paso de peligros.

**Piedra soltada**: exactamente un recogible `stone` de **valor 1** con **origen** (`source`) igual al tipo de la baja,
en la posición de la gema de esa baja (recolocación incluida, ver "Recolocación de gemas en celdas no caminables" en
`xp-gems`), creado justo después de la gema, la madera (si es un `goblin-barrel`) y el oro por baja (si su tipo lo tiene)
de esa misma baja y antes que los recogibles de la baja siguiente. La piedra sigue el tope de piedra `maxStone` (ver
"Tope de gemas en el suelo" en `xp-gems`): la tirada se hace igual con el tope lleno. Soltar piedra MUST NOT cambiar la
baja, su gema, su madera, su oro, el contador de bajas ni el daño de nadie, y la tirada MUST NOT consumir el azar de la
partida (oleadas y ofertas) ni el de las celdas, la decoración, las estructuras, los recursos del mapa o las ovejas.
Ninguna otra cosa crea piedra: ni las estructuras, ni las vetas, ni el mapa, ni las ovejas.

**Convención de escenario**: los escenarios vivos anteriores a este change que cuentan, ordenan o suman los recogibles
creados por bajas en un tick se leen sin piedra (probabilidad de piedra 0 en todos los tipos, o partida de escenario sin
azar de la piedra, que no suelta piedra ni consume valores), salvo que digan otra cosa.

#### Scenario: Tipo con 100 suelta siempre
- **GIVEN** probabilidad de piedra de `goblin-torch` 100 (valor de escenario), oro por baja 0, y un `goblin-torch` con
  vida 4 que muere por un impacto del Linter en el tick n en (780, 270), lejos del jugador
- **WHEN** se ejecuta el tick n
- **THEN** hay 1 gema nueva y 1 recogible `stone` nuevo de valor 1 y origen `goblin-torch`, ambos en (780, 270), con la
  gema creada antes
- **AND** el azar de la piedra ha consumido exactamente 1 valor en el tick n

#### Scenario: Tipo con 0 consume y no suelta
- **GIVEN** probabilidad de piedra de `goblin-tnt` 0 y 20 `goblin-tnt` que mueren por armas en ticks distintos
- **WHEN** se ejecutan esos ticks
- **THEN** no se crea ningún recogible `stone` y el azar de la piedra ha consumido exactamente 20 valores

#### Scenario: Umbral de la tirada
- **GIVEN** un azar de la piedra de escenario cuyo siguiente valor es 0,25, y un `goblin-torch` abatido por armas en el
  tick n, en un caso con probabilidad 25 y en otro con probabilidad 26
- **WHEN** se ejecuta el tick n
- **THEN** con 25 no hay recogible `stone` nuevo (⌊25⌋ < 25 es falso) y con 26 hay exactamente 1
- **AND** en ambos casos el azar de la piedra ha consumido exactamente 1 valor

#### Scenario: Valor límite de la tirada
- **GIVEN** un azar de la piedra de escenario cuyo siguiente valor es 0,99999 y probabilidad de `goblin-torch` 100, y en
  otro caso un valor 0 y probabilidad 1, y en otro un valor 0,0199 y probabilidad 1
- **WHEN** muere por armas un `goblin-torch`
- **THEN** en los dos primeros casos hay exactamente 1 recogible `stone` nuevo y en el tercero ninguno (⌊1,99⌋ = 1)

#### Scenario: El barril que explota consume y no suelta
- **GIVEN** probabilidad de piedra de `goblin-barrel` 100 y un barril cuya mecha termina en el tick n y explota
- **WHEN** se ejecuta el tick n
- **THEN** hay 1 gema nueva de ese barril, ningún recogible `stone` nuevo y el azar de la piedra ha consumido
  exactamente 1 valor

#### Scenario: Valores consumidos igual a bajas
- **GIVEN** el contenido por defecto, la semilla 7 con su mapa generado, un input aleatorio generado por una seed fija,
  la política de elección fija y una vida máxima suficiente para no llegar a 0 en 14.400 ticks
- **WHEN** se ejecutan 14.400 ticks y en ese tiempo ≥ 1 barril explota por su mecha
- **THEN** en cada tick el número de valores consumidos del azar de la piedra es igual al contador de bajas

#### Scenario: La probabilidad de un tipo no desplaza las tiradas de los demás
- **GIVEN** un azar de la piedra de escenario con la secuencia 0,5; 0,05; 0,05 y tres bajas por armas en este orden en
  ticks distintos: un `goblin-tnt`, un `goblin-torch` y otro `goblin-torch`, con probabilidad de `goblin-torch` 10, y en
  una partida la de `goblin-tnt` 0 y en otra 60
- **WHEN** se ejecutan esos ticks en ambas
- **THEN** en las dos los dos `goblin-torch` sueltan piedra (u = 0,05) y solo en la segunda la suelta el `goblin-tnt`
  (u = 0,5)

#### Scenario: Orden con el barril abatido
- **GIVEN** probabilidad de piedra de `goblin-barrel` 100, oro por baja de `goblin-barrel` 3 y madera por barril 2, y un
  `goblin-barrel` en persecución abatido por armas en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** se crean en este orden su gema, su `wood` de valor 2, su `gold` de valor 3 y su `stone` de valor 1 y origen
  `goblin-barrel`, los cuatro en la misma posición

#### Scenario: Piedra por baja intercalada
- **GIVEN** probabilidad de piedra 100 en `goblin-torch` y en `goblin-tnt`, oro por baja 0, y un `goblin-torch` T y un
  `goblin-tnt` N, en ese orden de la lista, que mueren en el mismo pulso de Tests
- **WHEN** se ejecuta ese tick
- **THEN** los 4 recogibles nuevos se crean en este orden: `xp` de T, `stone` de T (origen `goblin-torch`), `xp` de N y
  `stone` de N (origen `goblin-tnt`)

#### Scenario: Baja por explosión ajena
- **GIVEN** probabilidad de piedra de `goblin-torch` 100 y un `goblin-torch` de vida 10 dentro del radio de una
  dinamita de daño 25 que explota en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** hay 1 gema y 1 recogible `stone` de valor 1 nuevos de ese `goblin-torch`

#### Scenario: Tiradas del paso de armas antes que las del de peligros
- **GIVEN** probabilidad de piedra 50 en `goblin-torch`, un azar de la piedra de escenario cuyos dos siguientes valores
  son 0,1 y 0,9, un `goblin-torch` B (después en la lista) que muere por el Linter en el tick n y un `goblin-torch` A
  (antes en la lista) que muere por una explosión en el mismo tick
- **WHEN** se ejecuta el tick n
- **THEN** B consume 0,1 y suelta piedra, A consume 0,9 y no la suelta: hay exactamente 1 recogible `stone` nuevo, en la
  posición de la gema de B

#### Scenario: Piedra sobre un tronco
- **GIVEN** un mapa de hierba con un tronco en (10, 4), probabilidad de piedra de `goblin-torch` 100, el jugador lejos y
  un `goblin-torch` con vida 4 que muere por armas en (650, 270)
- **WHEN** se ejecuta ese tick
- **THEN** su gema y su piedra están ambas en (690, 270), con la gema creada antes

#### Scenario: Tirada con el tope de piedra lleno
- **GIVEN** `maxStone` 1, un recogible `stone` s1 de valor 1 en el suelo lejos del jugador, probabilidad de piedra de
  `goblin-torch` 100 y un `goblin-torch` que muere por armas lejos del jugador
- **WHEN** se ejecuta ese tick
- **THEN** sigue habiendo exactamente 1 recogible `stone`, s1, con valor 2, y el azar de la piedra ha consumido 1 valor

#### Scenario: Tabla de piedra inválida
- **GIVEN** el contenido por defecto sin la entrada de `goblin-tnt-guard` en `drops.stoneChance`, en otro caso con una
  entrada `goblin-ogre` y en otro con probabilidad −1, 101 o 12,5 en `goblin-torch`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el tipo
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos de la tabla
- **GIVEN** el contenido por defecto con probabilidad 0 en todos los tipos, y en otro caso 100 en todos
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Ninguna otra fuente de piedra
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks y probabilidad
  de piedra 0 en todos los tipos, la semilla 7 con su mapa generado (estructuras, vetas, montones y ovejas incluidos), un
  input aleatorio generado por una seed fija y la política de elección fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún snapshot hay un recogible `stone` y la piedra vale 0 en todos

### Requirement: Contador de piedra de la partida
El sistema SHALL llevar en cada partida un contador entero de **piedra** (`snapshot.resources.stone`) que vale 0 al
crear la partida (también tras R y tras `Volver al menú` + `Jugar`). Solo sube: cada recogida de un recogible `stone`
suma exactamente su valor, sin bonificación (`goldBonusPercent` y `xpBonusPercent` no la afectan) y sin resto. En este
change nada lo hace bajar: ni el daño, ni la subida de nivel, ni la tienda. No se conserva entre partidas. Recoger
piedra MUST NOT cambiar la XP, el oro, la madera ni la vida, y recoger otro tipo MUST NOT cambiar la piedra. La piedra
MUST NOT guardarse en récords ni en el historial, ni salir en la exportación ni mostrarse en la pantalla de resultados
(`progress-persistence` y `run-results` sin cambios).

#### Scenario: Partida recién creada
- **GIVEN** el contenido por defecto y la semilla 42 con su mapa generado, y en otro caso el mapa vacío
- **WHEN** se lee el snapshot del tick 0
- **THEN** `resources.stone` vale 0 en ambos

#### Scenario: Recogida de piedra con otros tipos en el mismo tick
- **GIVEN** un jugador quieto en (480, 270) con piedra 0, oro 0, madera 0 y XP 0 en nivel 1, y en su misma posición un
  recogible `stone` de valor 3, uno `gold` de valor 10 y uno `xp` de valor 1
- **WHEN** se ejecuta 1 tick
- **THEN** desaparecen los tres, la piedra vale 3, el oro 10, la madera 0 y la XP actual 1

#### Scenario: Sin bonificación
- **GIVEN** g = 20 (`goldBonusPercent`), una bonificación de XP de 50 y piedra 0
- **WHEN** se recogen 10 recogibles `stone` de valor 1 en ticks distintos
- **THEN** la piedra vale exactamente 10

#### Scenario: No baja al comprar ni al recibir daño
- **GIVEN** una partida con piedra 5 y oro 30 que abre la tienda, compra un producto de precio 30 y sale, y después
  recibe un golpe de 10
- **WHEN** se lee el snapshot tras el golpe
- **THEN** la piedra sigue en 5

#### Scenario: Partida nueva tras R
- **GIVEN** una partida terminada con piedra 7
- **WHEN** se pulsa R y se lee el snapshot del tick 0 de la partida nueva
- **THEN** la piedra vale 0

#### Scenario: Valores grandes
- **GIVEN** una partida con piedra 99.999 y un recogible `stone` de valor 1 que se recoge en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la piedra vale exactamente 100.000

#### Scenario: Sin rastro en resultados ni en el guardado
- **GIVEN** dos partidas iguales que terminan en el mismo tick con el mismo resultado y las mismas bajas, una con
  piedra 12 recogida y otra con piedra 0 (probabilidad 0 en todos los tipos)
- **WHEN** se muestra la pantalla de resultados, se guardan el récord y la entrada de historial y se exporta el progreso
- **THEN** la pantalla de resultados tiene las mismas 5 líneas en las dos
- **AND** el récord, la entrada de historial y el JSON exportado son iguales en las dos y no tienen ningún campo de
  piedra

### Requirement: Balance idéntico con la piedra
El sistema SHALL mantener, con el contenido por defecto final de este change y el bot de referencia v4, los resultados
de la línea base de `tests/support/balanceBaseline.ts` (la de "Balance con la tienda y el bot v4" en `castle-shop`)
semilla a semilla: para cada semilla de 1 a 50, el mismo resultado, el mismo tick final y las mismas bajas (30/50
victorias). La línea base MUST NOT regenerarse en este change: si un test de balance cambia por la piedra, se corrige la
medición, no la línea base. El invariante "quieto pierde antes de 180 s" MUST seguir cumpliéndose en las 50 semillas
con el mapa generado y con el mapa vacío. El verify-report MUST anotar la piedra media recogida y soltada por partida
del lote.

#### Scenario: Línea base intacta
- **GIVEN** el contenido por defecto final, cada semilla de 1 a 50 con su mapa generado y el bot de referencia v4
- **WHEN** se juega cada partida hasta que termina o hasta el tick 36.000
- **THEN** cada semilla termina con el resultado, el tick y las bajas de la línea base de 0024, con 30 victorias
- **AND** en ≥ 1 de las 50 partidas se ha soltado ≥ 1 piedra

#### Scenario: Quieto sigue perdiendo
- **GIVEN** el contenido por defecto final, input (0, 0), la política de elección fija y la política de tienda fija
- **WHEN** se juega cada semilla de 1 a 50 con su mapa generado y, aparte, con el mapa vacío, hasta que termina o hasta
  el tick 10.800
- **THEN** las 100 partidas terminan con derrota en un tick < 10.800

<!-- historial: 0022-resources-sheep (2026-11-24) -->
<!-- historial: 0023-sheep-meat (2026-11-24) -->
<!-- historial: 0024-split-progression-castle (2026-11-25) -->
<!-- historial: 0025-stone-resource (2026-11-25) -->
