# Spec delta · player-health

<!-- Purpose nuevo propuesto al archivar: "La vida del jugador, el contacto con enemigos, el daño discreto con armadura
     e invulnerabilidad temporal, la curación (carne, regeneración, subida sin mejoras y pago en la tienda) y la vida
     mínima 0." -->

## ADDED Requirements

### Requirement: Regeneración de vida
El sistema SHALL leer del contenido del jugador, validado con zod, el **intervalo de regeneración**: entero ≥ 1 en
ticks (ausente, no entero o < 1 MUST impedir que la partida arranque con un error que nombre el campo). En el paso de
regeneración de cada tick (ver "Orden de los pasos del tick" en `simulation-loop`) cuyo número es múltiplo del
intervalo, si la regeneración efectiva (`regeneration`, ver "Estadísticas de personaje nuevas" en `upgrades`) es > 0,
la vida actual sube en ese valor, con tope en la vida máxima efectiva. Regenerar no cambia la vida máxima ni la
invulnerabilidad, no ocurre en un tick que acaba antes de ese paso (derrota o victoria) ni mientras la partida no está
en curso (no se ejecutan ticks), y MUST NOT consumir azar. Con regeneración 0 la vida no cambia nunca por este paso.

#### Scenario: Regeneración por intervalo
- **GIVEN** un jugador con vida 50 de 100, regeneración 1, intervalo 60 (valores de escenario), ningún enemigo y la
  partida en el tick 0
- **WHEN** se ejecutan 120 ticks
- **THEN** la vida vale 50 tras el tick 59, 51 tras el 60, 51 tras el 119 y 52 tras el 120

#### Scenario: Tope en la vida máxima
- **GIVEN** un jugador con vida 99 de 100, regeneración 3 e intervalo 60
- **WHEN** se ejecuta el tick 60
- **THEN** la vida vale 100

#### Scenario: Sin mejora no regenera
- **GIVEN** el contenido por defecto, un jugador con vida 50 de 100 sin mejoras y ningún enemigo
- **WHEN** se ejecutan 3.600 ticks
- **THEN** la vida sigue en 50

#### Scenario: La regeneración no resucita
- **GIVEN** un jugador con vida 10, regeneración 5, intervalo 60 y un golpe de 10 en el tick 60
- **WHEN** se ejecuta el tick 60
- **THEN** la vida vale 0 y la partida está terminada con derrota

### Requirement: Curación de pago
El sistema SHALL, al comprar la curación en la tienda (ver "Compra en la tienda" en `castle-shop`), subir la vida
actual en la porción del contenido, con tope en la vida máxima efectiva, y cobrar su precio completo aunque el tope
recorte la porción. Con la vida ya en la vida máxima efectiva la compra se rechaza y no se cobra. Curar así no cambia la
vida máxima ni la invulnerabilidad y MUST NOT consumir azar.

#### Scenario: Curación de pago completa
- **GIVEN** una partida en tienda con vida 40 de 100, oro 20 y curación de porción 25 y precio 10 (valores de
  escenario)
- **WHEN** se compra la curación dos veces
- **THEN** la vida vale 90 y el oro 0

#### Scenario: Curación recortada por el tope
- **GIVEN** la tienda del escenario anterior con vida 99 de 100 y oro 10
- **WHEN** se compra la curación
- **THEN** la vida vale 100 y el oro 0

#### Scenario: Vida llena
- **GIVEN** la tienda con vida 100 de 100 y oro 10
- **WHEN** se compra la curación
- **THEN** se devuelve un error tipado, la vida sigue en 100 y el oro en 10

#### Scenario: La curación de pago no cambia la invulnerabilidad
- **GIVEN** un jugador golpeado en el tick 10 con invulnerabilidad de 30 ticks, que abre la tienda en el tick 20 y
  compra la curación, con un enemigo de damage 10 en contacto desde el tick 21
- **WHEN** se sale de la tienda y se ejecuta hasta el tick 41
- **THEN** el jugador no recibe daño en los ticks 21 a 40 y sí en el 41

## MODIFIED Requirements

### Requirement: Daño discreto por contacto
El sistema SHALL restar a la vida del jugador, en un tick en que el jugador no esté invulnerable y haya ≥ 1 **golpe
candidato**, un único golpe. Su daño bruto es el mayor entre los candidatos de ese tick (el resultado no depende del
orden de los enemigos ni de las explosiones) y el daño aplicado es max(1, daño bruto − armadura efectiva), con la
armadura efectiva de `armor` (ver "Estadísticas de personaje nuevas" en `upgrades`; 0 sin mejoras): la armadura nunca
deja un golpe en 0 de daño. Son golpes candidatos de un tick:
- el contacto de cada enemigo vivo con daño por contacto que está en contacto con el jugador, con el `damage` de su
  tipo;
- cada explosión de ese tick que alcanza al jugador (ver "Explosión de área" en `enemy-hazards`), con su daño de
  explosión.

Varios contactos y explosiones en el mismo tick MUST contar como un solo golpe, y un golpe reducido por la armadura
sigue siendo un golpe (inicia la invulnerabilidad). Golpear por contacto no da de baja al enemigo ni cambia su vida, su
posición, su estado ni su persecución.

<!-- Escenarios vivos sin cambios (armadura 0): "Un golpe de un enemigo", "Varios contactos en el mismo tick",
     "Contactos simultáneos de daño distinto", "Contacto y explosión en el mismo tick", "Dos explosiones en el mismo
     tick" y "Explosión que no alcanza no es candidata". -->

#### Scenario: Armadura sobre un contacto
- **GIVEN** un jugador quieto con vida 100, armadura 3 y un enemigo con damage 10 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale 93 y el jugador está invulnerable

#### Scenario: Armadura sobre el golpe único
- **GIVEN** un jugador con vida 100, armadura 3, un enemigo con damage 15 en contacto y una explosión de daño 25 que le
  alcanza en el mismo tick
- **WHEN** se ejecuta ese tick
- **THEN** la vida vale 78 (25 − 3; no 15 − 3 ni 37)

#### Scenario: Daño mínimo 1
- **GIVEN** un jugador con vida 100, armadura 12 y un enemigo con damage 10 en contacto, y en otro caso armadura 10
- **WHEN** se ejecuta 1 tick
- **THEN** en ambos casos la vida vale 99 y el jugador está invulnerable

#### Scenario: La armadura no evita la derrota
- **GIVEN** un jugador con vida 1, armadura 50 y un enemigo con damage 10 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale 0 y la partida está terminada con derrota

### Requirement: Invulnerabilidad temporal tras un golpe
El sistema SHALL hacer al jugador invulnerable durante N ticks después de cada golpe, sea de contacto o de explosión,
siendo N la duración efectiva en el momento del golpe: la del contenido (N ≥ 1) más la mejora de
`invulnerabilityTicks` (ver "Estadísticas de personaje nuevas" en `upgrades`). Si el golpe ocurre en el tick t, los
contactos y las explosiones de los ticks t + 1 a t + N inclusive MUST NOT hacerle daño, sea cual sea su número o su
daño; un contacto o una explosión en el tick t + N + 1 sí hace daño. Mejorar la duración durante una invulnerabilidad
no cambia su final: la duración nueva rige desde el siguiente golpe. El snapshot del tick k MUST indicar que el jugador
está invulnerable si y solo si un contacto o una explosión en el tick k + 1 no le harían daño. Una explosión que no
hace daño por la invulnerabilidad no la prolonga.

<!-- Escenarios vivos sin cambios (sin mejora): "Contacto continuo con un enemigo", "Fin de la invulnerabilidad justo en
     el tick N", "Contacto nuevo que llega justo al expirar", "Un enemigo más fuerte no rompe la invulnerabilidad",
     "200 enemigos encima del jugador", "Explosión durante la invulnerabilidad", "Explosión justo al expirar" y "La
     explosión inicia la invulnerabilidad". -->

#### Scenario: Invulnerabilidad mejorada
- **GIVEN** un jugador quieto con vida 100, invulnerabilidad del contenido de 30 ticks, `steady-nerves` con +10 por
  nivel en nivel 1 y un enemigo con damage 10 en contacto desde el tick 1
- **WHEN** se ejecutan 42 ticks
- **THEN** la vida vale 90 tras el tick 41 y 80 tras el tick 42

#### Scenario: Mejora durante la invulnerabilidad
- **GIVEN** un jugador golpeado en el tick 10 con invulnerabilidad de 30 ticks, `steady-nerves` (+10) elegida en una
  oferta abierta en el tick 20 y un enemigo con damage 10 en contacto desde el tick 21
- **WHEN** se ejecuta hasta el tick 82
- **THEN** recibe golpes en los ticks 41 y 82 y no entre medias

### Requirement: Curación por carne
El sistema SHALL curar al jugador, en el paso de recogibles del tick (ver "Orden de los pasos del tick" en
`simulation-loop`), por cada recogible `meat` que recoge (ver "Recogida de gemas" en `xp-gems`), en orden de creación:
la vida actual sube en valor de la pieza × max(1, ⌊curación efectiva × vida máxima efectiva / 100⌋), siendo la
curación efectiva la curación de la carne del contenido (ver "Contenido de recursos validado" en `resources`) más
`meatHealPercent` (ver "Estadísticas de personaje nuevas" en `upgrades`; 0 sin mejoras), con la vida máxima efectiva de
ese momento, y queda como mucho en la vida máxima efectiva. La vida es siempre un entero. Curar:
- no cambia la vida máxima ni la invulnerabilidad (ni la inicia, ni la alarga, ni la acorta);
- no tiene efecto si la vida ya está al máximo (el valor sobrante se pierde);
- no ocurre en un tick que acaba antes del paso de recogibles: si el golpe del tick deja la vida en 0, la partida
  termina con derrota y la carne de ese tick no se recoge (la carne no resucita); en el tick de la victoria tampoco se
  recoge;
- MUST NOT consumir azar.

Ninguna otra cosa sube la vida actual salvo la mejora de `maxHealth` (ver "Vida máxima mejorable"), la regeneración
(ver "Regeneración de vida"), la curación por subida sin mejoras (ver "Curación por subida sin mejoras" en `leveling`)
y la curación de pago de la tienda (ver "Curación de pago"). El castillo no cura por estar dentro ni cerca.

<!-- Escenarios vivos sin cambios (sin mejora): "Curación del 20 %", "Tope en la vida máxima", "Relativa a la vida
     máxima efectiva", "Redondeo hacia abajo y mínimo 1", "Pieza acumulada por el tope", "Dos piezas en el mismo
     tick", "Golpe y curación en el mismo tick", "La carne no resucita", "Sin curación en el tick de la victoria" y
     "La curación no cambia la invulnerabilidad". -->

#### Scenario: Carne con la mejora del cazador
- **GIVEN** un jugador con vida 50 de 100, curación de la carne 20, `hunter` con +10 por nivel en nivel 1 y un
  recogible `meat` de valor 1 que se recoge en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la vida vale 80
