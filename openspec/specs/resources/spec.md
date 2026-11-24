# Resources · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El oro y la madera de la partida: sus contadores, sus fuentes (barril, casas y torres, montones de madera y vetas
de oro) y la garantía de que no cambian el combate ni el balance; y la carne de las ovejas, que cura al recogerla
(ver `sheep` y `player-health`). Gastar oro y madera es de 0024 (castillo-tienda) y 0025 (solares de obra).

**Vocabulario**: un **recogible** es un objeto del suelo con un **tipo** de la unión cerrada
`xp | gold | wood | meat` y un **valor** entero ≥ 1 (ver "Recogibles con tipo" en `xp-gems`). Una **gema** es un recogible de tipo `xp`: donde
una spec viva dice "gema" sin más, se refiere solo a los recogibles de tipo `xp`. Un **montón de madera** es un
recogible de tipo `wood` presente desde el tick 0. Una **veta** es un punto fijo del mapa generado que entrega oro
al pasar el jugador una sola vez.

## Requirements

### Requirement: Contenido de recursos validado
El sistema SHALL leer de `content/*.json`, validados con zod antes de llegar al dominio:
- las **cantidades** de cada fuente, enteros ≥ 1: madera por `goblin-barrel` abatido, oro por `goblin-house`
  destruida, oro por `goblin-tower` destruida, oro por veta, madera por montón y **carne por oveja**;
- la **curación de la carne**: el porcentaje de la vida máxima efectiva que cura cada unidad de valor de un recogible
  `meat` (ver "Curación por carne" en `player-health`), entero de 1 a 100;
- el **número por mapa generado** de montones de madera y de vetas: enteros ≥ 0;
- el **radio de contacto de la veta**: número > 0;
- los **parámetros de colocación** de montones y vetas (ver "Recursos en el mapa generado" en `procedural-map`):
  enteros ≥ 0, en celdas.

Un valor fuera de rango, un campo ausente o un campo desconocido MUST impedir que se muestre el menú o empiece una
partida, con un error que nombre el campo. Los tipos de recogible son exactamente `xp`, `gold`, `wood` y `meat`: un
contenido que declare otro tipo falla con un error que nombra el tipo. Con el contenido por defecto, la carne por oveja
vale 1 y la curación de la carne 20 (provisional, a medir en apply con el balance de `sheep`).

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito, las seis cantidades son enteros ≥ 1, el número de montones y el de vetas por mapa son
  enteros ≥ 1 y el radio de contacto de la veta es > 0
- **AND** la carne por oveja vale 1 y la curación de la carne vale 20

#### Scenario: Valores fuera de rango
- **GIVEN** el contenido por defecto con, en un caso cada vez: la madera por barril 0, −1 o 2,5; el oro por casa 0; el
  oro por torre 1,5; el oro por veta 0; la madera por montón 0; la carne por oveja 0 o 1,5; la curación de la carne 0,
  101 o 12,5; el número de vetas −1 o 1,5; el radio de contacto de la veta 0 o −4; o una distancia de colocación −1
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: 0 montones y 0 vetas por mapa; todas las cantidades a 1;
  la curación de la carne 1 o 100; o todas las distancias de colocación a 0
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Campos ausentes, desconocidos y tipo no admitido
- **GIVEN** el contenido por defecto sin el oro por veta, en otro caso sin la curación de la carne, en otro con un campo
  extra `meatPerHouse: 5`, y en otro con un tipo de recogible `potion`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el oro por veta, la curación de la carne, `meatPerHouse` y `potion`
  respectivamente

### Requirement: Contadores de oro y madera de la partida
El sistema SHALL llevar en cada partida dos contadores enteros, **oro** y **madera**, que valen 0 al crear la
partida (también tras R y tras `Volver al menú` + `Jugar`) y solo suben: cada recogida de un recogible `gold` suma su
valor al oro, cada recogida de un recogible `wood` suma su valor a la madera y cada veta que se agota suma su oro (ver
"Vetas de oro al pasar"). Ninguna otra cosa los cambia en este change: no hay forma de gastarlos, no bajan al recibir
daño ni al subir de nivel y no se conservan entre partidas. Recoger oro o madera MUST NOT sumar XP, y recoger XP MUST
NOT cambiar el oro ni la madera. Los contadores no se guardan en récords ni en el historial (`progress-persistence`
sin cambios) ni se muestran en la pantalla de resultados (`run-results` sin cambios).

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
El sistema SHALL hacer que los recogibles de oro y de madera, los montones, las vetas y los contadores no cambien nada
del combate ni de la progresión: con la misma semilla, el mismo mapa, las mismas ovejas, los mismos inputs y las mismas
elecciones, una partida con el contenido por defecto y otra igual salvo 0 montones, 0 vetas y sin drops de oro ni de
madera (las cantidades no pueden ser 0: el escenario anula las fuentes, no el contenido; la carne de las ovejas se
mantiene en las dos) MUST tener en cada tick los mismos enemigos (identificador, tipo, posición, vida y estado), jugador
(posición, vida e invulnerabilidad), ovejas (identificador, posición, vida y estado), proyectiles, pulsos, peligros,
estructuras, bajas, gemas y carne (identificadores aparte), XP, nivel, ofertas, mejoras, estado y resultado. Los
recursos MUST NOT consumir el azar de la partida (oleadas y ofertas) ni el de las celdas, la decoración, las estructuras
o las ovejas.

#### Scenario: Mismo combate con y sin recursos
- **GIVEN** dos partidas con el contenido por defecto y las semillas 7 y 42, cada una con su mapa generado (ovejas
  incluidas), una con los recursos y otra sin fuentes de oro ni de madera, la misma secuencia de 14.400 inputs generada
  por una seed fija, la política de elección fija y una vida máxima suficiente para no llegar a 0
- **WHEN** ambas ejecutan 14.400 ticks
- **THEN** en cada tick los campos de combate y de progresión enumerados en el requisito son iguales en las dos, sin
  tolerancia
- **AND** en la partida con recursos el oro o la madera es > 0 en el tick 14.400

#### Scenario: Los recursos no consumen azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una se recogen en el tick n 3 recogibles
  `gold`, 2 `wood`, se agota 1 veta y muere por armas 1 `goblin-barrel` que suelta madera
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick
- **AND** el del azar de las ovejas también es el mismo en las dos

### Requirement: Balance sin recalibrar con los recursos
<!-- El escenario vivo "Contenido de combate intacto" pasa a "Balance con las ovejas y la carne" (`sheep`), que compara
     con `main` antes de este change. -->
El sistema SHALL conservar, con el contenido por defecto final de este change **salvo el tope de ovejas vivas a 0**,
exactamente el resultado de la línea base de balance medida antes del change 0022 con el bot de referencia v3 (que no
busca recogibles, vetas, ovejas ni carne; `tests/support/balanceBaseline.ts`): la misma cifra de victorias sobre las
semillas 1..50 (**27**), cada semilla con el mismo resultado, tick final y bajas, 0 jugadores quietos supervivientes con
el mapa generado y con el mapa vacío, y la misma media de mechas de `goblin-barrel` por partida (**26,9**, > 16,3). Así
se comprueba que la carne, el cuarto tipo de recogible y la selección de objetivos con ovejas no cambian nada cuando no
hay ovejas. El balance con las ovejas presentes lo fija "Balance con las ovejas y la carne" (`sheep`). El tiempo del
lote del bot MUST anotarse en el verify-report, en local (referencia ≤ 35 s) y ×2,8 como equivalente de CI (tope 90 s).

#### Scenario: Victorias del bot de referencia sin ovejas
- **GIVEN** el contenido por defecto final con el tope de ovejas 0, cada semilla de 1 a 50 con su mapa generado
  (montones y vetas incluidos) y el bot de referencia v3
- **WHEN** se juega cada partida hasta que termina o hasta el tick 36.000
- **THEN** exactamente 27 partidas terminan con victoria en el tick 36.000
- **AND** cada semilla termina con el mismo resultado, en el mismo tick y con las mismas bajas que en la línea base

#### Scenario: Quieto pierde con todas las semillas sin ovejas
- **GIVEN** el contenido por defecto final con el tope de ovejas 0, input (0, 0) y la política de elección fija
- **WHEN** se juega cada semilla de 1 a 50 con su mapa generado y, aparte, con el mapa vacío, hasta que termina o hasta
  el tick 10.800
- **THEN** las 100 partidas terminan con derrota en un tick < 10.800

#### Scenario: Mechas por partida intactas sin ovejas
- **GIVEN** el contenido por defecto final con el tope de ovejas 0 y el bot de referencia v3
- **WHEN** se juega cada semilla de 1 a 50 con su mapa generado y se cuentan los `goblin-barrel` que entran en mecha
- **THEN** la media por partida es la de la línea base (26,9 con un decimal) y > 16,3

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

<!-- historial: 0022-resources-sheep (2026-11-24) -->
<!-- historial: 0023-sheep-meat (2026-11-24) -->
