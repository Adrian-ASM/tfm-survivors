# Spec delta · resources

<!-- Purpose nuevo propuesto al archivar: "El oro y la madera de la partida: sus contadores, sus fuentes (enemigos
     abatidos, barril, casas y torres, montones de madera y vetas de oro), el gasto de oro en la tienda (`castle-shop`)
     y la carne de las ovejas, que cura al recogerla. Gastar madera es de 0025 (solares de obra)." -->

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Contenido de recursos validado
El sistema SHALL leer de `content/*.json`, validados con zod antes de llegar al dominio:
- las **cantidades** de cada fuente, enteros ≥ 1: madera por `goblin-barrel` abatido, oro por `goblin-house`
  destruida, oro por `goblin-tower` destruida, oro por veta, madera por montón y **carne por oveja**;
- el **oro por baja** de cada tipo de enemigo (ver "Oro por enemigo abatido"), enteros ≥ 0;
- la **curación de la carne**: el porcentaje de la vida máxima efectiva que cura cada unidad de valor de un recogible
  `meat` (ver "Curación por carne" en `player-health`), entero de 1 a 100. Esta cota se aplica al valor base del
  contenido, sin mejoras; la cota de la curación efectiva con las mejoras de `meatHealPercent` (`hunter`) la fija
  "Estadísticas de personaje nuevas" en `upgrades` (base + todas en su `maxLevel` entre 1 y 100);
- el **número por mapa generado** de montones de madera y de vetas: enteros ≥ 0;
- el **radio de contacto de la veta**: número > 0;
- los **parámetros de colocación** de montones y vetas (ver "Recursos en el mapa generado" en `procedural-map`):
  enteros ≥ 0, en celdas.

Un valor fuera de rango, un campo ausente o un campo desconocido MUST impedir que se muestre el menú o empiece una
partida, con un error que nombre el campo. Los tipos de recogible son exactamente `xp`, `gold`, `wood` y `meat`: un
contenido que declare otro tipo falla con un error que nombra el tipo. Con el contenido por defecto, la carne por oveja
vale 1 y la curación de la carne 20. El tope de oro en el suelo es el del contenido (puede subir respecto a 32 por el
oro de las bajas; se calibra en apply).

<!-- Escenarios vivos sin cambios: "Contenido por defecto", "Valores fuera de rango" y "Campos ausentes, desconocidos
     y tipo no admitido". -->

#### Scenario: Límites válidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: 0 montones y 0 vetas por mapa; todas las cantidades a 1;
  la curación de la carne 1; la curación de la carne 100 con un catálogo de personaje sin mejoras de
  `meatHealPercent`; o todas las distancias de colocación a 0
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito
- **AND** con la curación de la carne 100 y el catálogo de personaje por defecto (`hunter` con `perLevel` > 0) la carga
  falla con el error de `upgrades` que nombra `hunter` y `meatHealPercent`, no con un error del campo de recursos

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

<!-- Escenarios vivos sin cambios: "Partida recién creada", "Recogida de oro y de madera en el mismo tick", "Solo
     suben" (no hay compras en ese tick), "Partida nueva tras R", "Valores grandes" y "Sin rastro en resultados ni en
     el guardado". -->

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

### Requirement: Recursos sin efecto en el combate
El sistema SHALL hacer que los recogibles de oro y de madera, los montones, las vetas y los contadores no cambien nada
del combate ni de la progresión **mientras no se compre nada**: con la misma semilla, el mismo mapa, las mismas
ovejas, los mismos inputs, las mismas elecciones y la política de tienda fija (ver `simulation-loop`), una partida con
el contenido por defecto y otra igual salvo 0 montones, 0 vetas, oro por baja 0 en todos los tipos y sin drops de oro
ni de madera de barriles y estructuras (las cantidades no pueden ser 0: el escenario anula las fuentes, no el
contenido; la carne de las ovejas se mantiene en las dos) MUST tener en cada tick los mismos enemigos (identificador,
tipo, posición, vida y estado), jugador (posición, vida e invulnerabilidad), ovejas (identificador, posición, vida y
estado), proyectiles, pulsos, peligros, estructuras, bajas, gemas y carne (identificadores aparte), XP, nivel,
ofertas, mejoras, estado y resultado. Los recursos MUST NOT consumir el azar de la partida (oleadas y ofertas) ni el de
las celdas, la decoración, las estructuras o las ovejas. Las compras sí cambian el combate (ver `castle-shop`).

<!-- Escenario vivo sin cambios: "Los recursos no consumen azar". -->

#### Scenario: Mismo combate con y sin recursos
- **GIVEN** dos partidas con el contenido por defecto y las semillas 7 y 42, cada una con su mapa generado (ovejas
  incluidas), una con los recursos y otra sin fuentes de oro ni de madera (oro por baja 0 incluido), la misma
  secuencia de 14.400 inputs generada por una seed fija, la política de elección fija, la política de tienda fija y
  una vida máxima suficiente para no llegar a 0
- **WHEN** ambas ejecutan 14.400 ticks
- **THEN** en cada tick los campos de combate y de progresión enumerados en el requisito son iguales en las dos, sin
  tolerancia
- **AND** en la partida con recursos el oro o la madera es > 0 en el tick 14.400

## REMOVED Requirements

### Requirement: Balance sin recalibrar con los recursos
Motivo: exigía conservar la línea base de 0022 (27/50 con el bot v3 y tope de ovejas 0, 26,9 mechas). Este change la
reemplaza a propósito: las mejoras de arma salen de la oferta, el oro tiene uso y el bot pasa a v4. El balance vigente
es "Balance con la tienda y el bot v4" (`castle-shop`) más "Partida ganable y perdible con el contenido por defecto" y
"Barril que cumple su papel" (`run-outcome`).
