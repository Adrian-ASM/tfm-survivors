# Build sites · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Solares de obra del mapa, elección modal de casa o torre de caballeros con madera y piedra, edificios indestructibles que bloquean el paso, ingreso de oro de las casas y flechas de las torres.

**Vocabulario**:
- **Solar**: lugar fijo del mapa donde se puede construir un único edificio. Estado `free` (sin construir),
  `house` (casa construida) o `tower` (torre construida). Un solar construido no vuelve a `free`.
- **Edificio**: lo construido en un solar (casa o torre de caballeros). No es una estructura goblin
  (`goblin-structures`): no figura en la lista de estructuras ni tiene vida.
- **Huella de la casa** y **huella de la torre** de un solar: las celdas que ocupa cada tipo de edificio en ese
  solar. **Huella del solar**: la unión de las dos. Con el contenido por defecto las tres coinciden (2 × 2 celdas).
- **Celda de obra**: una celda de la huella de un solar `free` o de la huella del edificio de un solar construido.
  Es no caminable (ver "Solar libre que bloquea el paso" y "Edificios que bloquean el paso").
- **Separación** g de un solar: la distancia entre el centro del jugador y el punto más cercano del rectángulo cerrado
  de la huella del solar, menos el radio del jugador. g = 0 es tangencia.
- **Tocar** un solar: g ≤ ε, donde ε es una **constante del dominio** (no es contenido) con 0 < ε ≤ 1 px; su valor lo
  fija el design. Vale igual en las caras y en las esquinas de la huella.
- **Separación de re-armado** X: parámetro de contenido (ver "Contenido de los edificios validado").
- **Punto de disparo** de una torre: el punto del mundo desde el que salen sus flechas (según design, dentro de
  su huella).

Ya no existe el **acceso** de un solar (ni su radio de oferta ni su distancia de re-armado).

Salvo que se diga otra cosa, los escenarios usan:
- el **solar de prueba**: un único solar declarado en el mapa vacío, con huella de solar, de casa y de torre en las
  columnas 20–21 y filas 10–11 (x en [1.200, 1.320], y en [600, 720]), en hierba libre;
- el radio del jugador 16 y la separación de re-armado X = 64 (la del contenido por defecto);
- los costes por defecto: casa 15 madera; torre 30 madera + 15 piedra;
- la política de elección fija, la política de tienda fija y la política de obra fija (`simulation-loop`).

## Requirements

### Requirement: Contenido de los edificios validado
El sistema SHALL leer de `content/buildings.json`, validado con zod antes de llegar al dominio:
- el **coste** de cada tipo de edificio, `house` y `tower`: madera (entero ≥ 1) y piedra (entero ≥ 0);
- el **ingreso de la casa**: oro por pago (entero ≥ 1) y periodo en ticks (entero ≥ 1);
- el **arma de la torre**, con el esquema de un arma de `content/weapons.json` (ver "Contenido de armas validado" en
  `auto-weapons`): `cooldownTicks`, `damage`, `targeting` y `attack`, que MUST ser `nearest-in-range` con
  `projectile`;
- el **tope de flechas de torre** vivas en la partida: entero ≥ 1;
- la **separación de re-armado** X: número finito estrictamente mayor que ε (ver el vocabulario).

El contenido ya no tiene punto de acceso: ni radio de oferta ni distancia de re-armado del acceso, ni la regla cruzada
con el radio del jugador. El número de solares por mapa generado y sus parámetros de colocación (ver "Solares en el mapa
generado" en `procedural-map`) y el aspecto (ver `sprite-rendering`) van en el contenido que elija el design, con las
mismas reglas de validación. Un valor fuera de rango, un campo ausente o desconocido (también un `access` sobrante), o un
arma de torre con otro criterio u otro ataque MUST impedir que se muestre el menú o empiece una partida, con un error
que nombre el campo.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** la casa cuesta 15 madera y 0 piedra y la torre 30 madera y 15 piedra
- **AND** la casa paga 1 oro cada 1.800 ticks
- **AND** el arma de la torre es `nearest-in-range` con `range` 350 y `projectile`, con `damage` entero ≥ 1 y menor que
  el `health` de `goblin-torch` (10)
- **AND** el tope de flechas de torre es un entero ≥ 1 y la separación de re-armado vale 64
- **AND** el contenido cargado no tiene radio de oferta ni distancia de re-armado del acceso

#### Scenario: Valores inválidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: madera de la casa 0 o 2,5; piedra de la torre −1 o 1,5;
  oro por pago 0; periodo 0 o 1,5; `range` de la torre 0; un arma de torre con `attack` `pulse` y `targeting`
  `any-in-radius`; tope de flechas 0; separación de re-armado 0, −5 o igual a ε; un campo extra `hp: 100`; o el bloque
  `access` de 0026 (`radius` 40, `rearmDistance` 160)
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo o esa regla
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: piedra de la casa y de la torre 0; madera de ambas 1;
  periodo 1; tope de flechas 1; separación de re-armado = ε + 0,001
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Campo ausente
- **GIVEN** el contenido de edificios sin el coste de la torre, en otro caso sin el tope de flechas y en otro sin la
  separación de re-armado
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

### Requirement: Solares de la partida
El sistema SHALL dar a cada partida una **lista de solares** con orden y longitud fijos durante toda la partida:
- con el mapa generado, los colocados por "Solares en el mapa generado" (`procedural-map`), en su orden de colocación;
- con un mapa explícito, solo los que declare, en el orden de declaración (ver "Mapa explícito y mapa vacío" en
  `procedural-map`);
- con el mapa vacío, ninguno.

Cada solar tiene un identificador único en la partida, su huella de casa, su huella de torre, su estado (`free`,
`house` o `tower`) y si está armado; no tiene acceso. Toda partida empieza con todos sus solares en `free` y
**armados**. Un solar solo cambia de `free` a `house` o a `tower`, al construir (ver "Construcción en el solar"), y
después no vuelve a cambiar de estado. Un solar `free` bloquea el paso desde el tick 0 (ver "Solar libre que bloquea
el paso").

#### Scenario: Solares al crear la partida
- **GIVEN** el contenido por defecto y la semilla 42 con su mapa generado
- **WHEN** se lee el snapshot del tick 0
- **THEN** la lista de solares tiene 6 solares, con identificadores distintos, todos en `free` y armados
- **AND** cada uno tiene huella de casa y huella de torre, ninguno tiene acceso, y todas las celdas de sus huellas son no
  caminables y `grass`

#### Scenario: Sin solares en el mapa vacío
- **GIVEN** el contenido por defecto, la semilla 42 y el mapa vacío
- **WHEN** se ejecutan 3.600 ticks
- **THEN** la lista de solares está vacía en todos los snapshots y la partida no pasa por en obra en ningún tick

#### Scenario: Lista estable
- **GIVEN** una partida con 3 solares declarados s1, s2 y s3 en ese orden
- **WHEN** se construye una casa en s2 y se ejecutan 600 ticks
- **THEN** en cada snapshot la lista es s1, s2, s3, con s2 en `house` y s1 y s3 en `free`

### Requirement: Apertura del solar con re-armado
El sistema SHALL abrir la oferta de obra por **contacto** en el paso de solares del tick (ver "Orden de los pasos del
tick" en `simulation-loop`), con la posición del jugador ya movida (y, por tanto, ya limitada por la colisión con las
huellas) y los recursos tras la recogida de ese tick, según estas reglas, evaluadas para cada solar `free` en el orden
de la lista de solares:
- si el solar está desarmado y su separación g ≥ X, queda **armado**;
- si el solar está armado, el jugador lo toca (g ≤ ε) y la partida sigue en curso al llegar a ese paso (no se ha abierto
  en este tick una oferta de mejora, la tienda ni otro solar), la oferta se abre para ese solar **se pueda pagar algo o
  no**, el solar queda desarmado y la partida pasa a **en obra** (ver `run-state`); el tick cuenta igualmente;
- un solar armado que el jugador toca y que no se abre porque la partida ya no está en curso en ese paso sigue armado;
- en el tick en que la partida termina (victoria o derrota) el paso no se ejecuta;
- un solar construido no se abre nunca más.

Salir sin construir no arma el solar: para volver a abrirlo el jugador MUST separarse al menos X de la huella
(g ≥ X) y volver a tocarla. Estar tangente o empujar contra la huella sin separarse no reabre. Como mucho se abre un
solar por tick. Evaluar los solares MUST NOT consumir azar.

#### Scenario: Se abre con el coste exacto de la casa
- **GIVEN** el solar de prueba armado, madera 15 y piedra 0, y el jugador que entra a d < 40 por primera vez en el tick
  n
- **WHEN** se ejecuta el tick n
- **THEN** la partida está en obra en el snapshot del tick n, con la oferta del solar de prueba, y el solar figura
  desarmado
- **AND** la oferta tiene una sola opción, `house`, con coste 15 madera y 0 piedra

#### Scenario: La torre no se ofrece sin piedra suficiente
- **GIVEN** el solar de prueba armado, madera 30 y piedra 14, y el jugador que entra a d < 40 en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la partida está en obra y la oferta tiene una sola opción, `house`

#### Scenario: Las dos opciones
- **GIVEN** el solar de prueba armado, madera 30 y piedra 15, y el jugador que entra a d < 40 en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la oferta tiene dos opciones, en este orden: `house` (15 madera, 0 piedra) y `tower` (30 madera, 15 piedra)

#### Scenario: Solo la torre asequible
- **GIVEN** costes de escenario: casa 20 madera y 0 piedra, torre 10 madera y 5 piedra; madera 12 y piedra 5, y el
  jugador que entra a d < 40 en el tick n con el solar armado
- **WHEN** se ejecuta el tick n
- **THEN** la oferta tiene una sola opción, `tower`

#### Scenario: Salir no reabre
- **GIVEN** la oferta del solar de prueba abierta en el tick n con el jugador en (1.260, 736) (g = 0)
- **WHEN** se sale sin construir y se ejecutan 600 ticks con el jugador quieto, y después 600 ticks con input (0, −1)
- **THEN** la partida sigue en curso en los 1.200 ticks, el jugador sigue en (1.260, 736) y el solar está desarmado

#### Scenario: Volver sin alejarse lo suficiente
- **GIVEN** la partida del escenario anterior tras sus 1.200 ticks
- **WHEN** el jugador se aleja en vertical hasta g = 63,9 (centro en (1.260, 799,9)), vuelve a tocar la huella y se
  ejecutan 60 ticks más
- **THEN** la partida no pasa por en obra en ningún tick y el solar sigue desarmado

#### Scenario: Volver tras alejarse
- **GIVEN** la partida de "Salir no reabre" y el jugador que llega a g ≥ 64 por primera vez en el tick a
- **WHEN** vuelve hacia la huella y en el tick b es la primera vez tras a con g ≤ ε
- **THEN** el snapshot del tick a marca el solar armado y la partida está en obra en el snapshot del tick b, no antes

#### Scenario: Oferta de mejora en el mismo tick
- **GIVEN** el solar de prueba armado, madera 15, el jugador que lo toca por primera vez en el tick n y una gema que le
  hace subir de nivel en el tick n
- **WHEN** se ejecuta el tick n, se elige la opción 0 y se ejecuta 1 tick con el jugador quieto
- **THEN** en el snapshot del tick n la partida está eligiendo mejora y el solar sigue armado
- **AND** en el del tick n + 1 la partida está en obra

#### Scenario: Tienda y solar en el mismo tick
- **GIVEN** el mapa vacío con la puerta de la tienda declarada en (1.000, 1.000) y la tienda armada, un solar declarado
  armado con huella en las columnas 17–18 y filas 16–17 (x en [1.020, 1.140], y en [960, 1.080]), madera 15, y el
  jugador que llega en el tick n a (1.004, 1.000): a 4 px de la puerta y con g = 0
- **WHEN** se ejecuta el tick n, se sale de la tienda y se ejecuta 1 tick con el jugador quieto
- **THEN** en el snapshot del tick n la partida está en tienda y el solar sigue armado
- **AND** en el del tick n + 1 la partida está en obra

#### Scenario: Dos solares a la vez
- **GIVEN** el mapa vacío con dos solares declarados s1 (el solar de prueba) y s2 (huella en las columnas 22–23 y filas
  12–13, que toca la de s1 solo en la esquina (1.320, 720)), en ese orden, ambos armados, y el jugador quieto en
  (1.304, 736), con g = 0 respecto a los dos (escenario de prueba sin las reglas de colocación)
- **WHEN** se ejecuta el tick n, se sale sin construir y se ejecuta 1 tick con el jugador quieto
- **THEN** en el snapshot del tick n la partida está en obra con la oferta de s1 y s2 sigue armado
- **AND** en el del tick n + 1 la partida está en obra con la oferta de s2

#### Scenario: Sin oferta en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks, el solar de prueba armado y el jugador que lo toca por
  primera vez en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida está terminada con victoria y no ha pasado por en obra

#### Scenario: Solar construido
- **GIVEN** el solar de prueba con una casa construida, madera 100 y piedra 100
- **WHEN** el jugador se aleja hasta g = 400, vuelve a tocar la huella y se ejecutan 60 ticks
- **THEN** la partida no pasa por en obra en ningún tick

#### Scenario: Abrir no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una el jugador toca el solar armado en el tick
  n y en la otra el solar está desarmado
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado de cada `RandomGenerator` de la partida (partida, ovejas, piedra) es el mismo en las dos

#### Scenario: Se abre al tocar una cara
- **GIVEN** el solar de prueba armado, madera 15 y piedra 0, y el jugador en (1.260, 800) con input (0, −1)
- **WHEN** se ejecutan ticks hasta el primer tick n en que g ≤ ε
- **THEN** la partida está en obra en el snapshot del tick n, con la oferta del solar de prueba, y el solar figura
  desarmado
- **AND** en los snapshots anteriores a n la partida está en curso

#### Scenario: Se abre al tocar una esquina
- **GIVEN** el solar de prueba armado, madera 0 y piedra 0, y el jugador quieto con el centro en (1.188,686; 588,686),
  a 16 px (error ≤ 0,001) de la esquina (1.200, 600), sin solapar la huella
- **WHEN** se ejecuta 1 tick
- **THEN** la partida está en obra con la oferta del solar de prueba

#### Scenario: Límite del contacto
- **GIVEN** el solar de prueba armado y, en un caso cada vez, el jugador quieto con g = ε, con g = 2 y con g = 1,5
  respecto a la cara superior (centro en (1.260, 584 − ε), (1.260, 582) y (1.260, 582,5))
- **WHEN** se ejecutan 600 ticks
- **THEN** con g = ε la partida pasa a en obra en el tick 1; con g = 2 y con g = 1,5 no pasa por en obra en ningún tick
  y el solar sigue armado

#### Scenario: Se abre aunque nada sea asequible
- **GIVEN** el solar de prueba armado, madera 0 y piedra 0, y el jugador que lo toca por primera vez en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la partida está en obra en el snapshot del tick n y la oferta tiene `house` y `tower`, ninguna asequible

#### Scenario: Asequibilidad con los recursos del mismo tick
- **GIVEN** el solar de prueba armado, madera 14 y un recogible `wood` de valor 1 que se recoge en el tick n, en el que
  el jugador toca el solar por primera vez
- **WHEN** se ejecuta el tick n
- **THEN** la partida está en obra en el snapshot del tick n y la opción `house` es asequible

#### Scenario: Re-armado medido desde cualquier lado
- **GIVEN** la oferta del solar de prueba abierta y cerrada sin construir con el jugador tangente a la cara inferior
- **WHEN** el jugador rodea la huella sin tocarla hasta quedar a g = 64 de la cara derecha (centro en (1.400, 660))
- **THEN** en ese tick el solar queda armado

### Requirement: Oferta de obra
El sistema SHALL exponer en el snapshot, si y solo si la partida está en obra, la **oferta de obra**: el identificador
del solar abierto y **siempre las dos opciones**, en este orden fijo: `house` y después `tower`. Cada opción tiene su
tipo, su coste (madera y piedra) y si es **asequible**: la madera y la piedra de la partida al abrirse alcanzan su
coste. La oferta no cambia mientras la partida sigue en obra.

#### Scenario: Oferta en el snapshot
- **GIVEN** una partida en obra en el solar s2 con madera 40 y piedra 20
- **WHEN** se lee el snapshot y se piden 600 ticks
- **THEN** la oferta es del solar s2 con `house` (15, 0, asequible) y `tower` (30, 15, asequible), igual en todos los
  snapshots leídos

#### Scenario: Sin oferta fuera de la obra
- **GIVEN** snapshots en curso, eligiendo mejora, en tienda y terminado
- **WHEN** se leen
- **THEN** ninguno tiene oferta de obra

#### Scenario: La torre no asequible por la piedra
- **GIVEN** el solar de prueba armado, madera 30 y piedra 14, y el jugador que lo toca en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la oferta tiene `house` (15, 0, asequible) y `tower` (30, 15, no asequible), en ese orden

#### Scenario: Coste exacto
- **GIVEN** el solar de prueba armado, madera 30 y piedra 15, y el jugador que lo toca en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** las dos opciones son asequibles

#### Scenario: Solo la torre asequible
- **GIVEN** costes de escenario: casa 20 madera y 0 piedra, torre 10 madera y 5 piedra; madera 12 y piedra 5, y el
  jugador que toca el solar armado en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la oferta tiene `house` (no asequible) y `tower` (asequible), en ese orden

#### Scenario: Madera a 1 de la casa
- **GIVEN** el solar de prueba armado, madera 14 y piedra 100, y el jugador que lo toca en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la partida está en obra y las dos opciones son no asequibles

### Requirement: Construcción en el solar
El sistema SHALL ofrecer un caso de uso para **construir** un tipo de edificio (`house` o `tower`) mientras la
partida está en obra. Una construcción válida, sin ejecutar ningún tick:
- resta a la madera y a la piedra exactamente el coste del tipo;
- pasa el solar abierto a `house` o `tower`;
- deja no caminables las celdas de la huella de ese tipo en ese solar (ver "Edificios que bloquean el paso");
- recoloca lo que ocupe la huella (ver "Huella despejada al construir");
- devuelve la partida a en curso.

Construir MUST devolver un error tipado (`Result`), sin cambiar el snapshot ni el estado de ningún `RandomGenerator`,
cuando la partida no está en obra (en curso, eligiendo mejora, en tienda o terminada), cuando el tipo no existe y cuando
la opción de ese tipo **no es asequible** en la oferta. Construir MUST NOT consumir azar ni cambiar el oro, la XP, la
vida ni las mejoras. Las construcciones son input del determinismo, como las elecciones de mejora y las compras.

#### Scenario: Construir una casa
- **GIVEN** una partida en obra en el solar de prueba en el tick n con madera 20, piedra 7 y oro 3
- **WHEN** se construye `house`
- **THEN** la madera vale 5, la piedra 7 y el oro 3, el solar está en `house`, la partida está en curso y
  `snapshot.tick` vale n

#### Scenario: Construir una torre con el coste exacto
- **GIVEN** una partida en obra en el solar de prueba con madera 30 y piedra 15
- **WHEN** se construye `tower`
- **THEN** la madera y la piedra valen 0 y el solar está en `tower`

#### Scenario: Tipo desconocido
- **GIVEN** una partida en obra con madera 100 y piedra 100
- **WHEN** se construye `castle`
- **THEN** devuelve un error tipado y el snapshot no cambia

#### Scenario: Construir fuera de la obra
- **GIVEN** una partida en curso con madera 100 y piedra 100, otra eligiendo mejora, otra en tienda y otra terminada
- **WHEN** en cada una se construye `house`
- **THEN** cada una devuelve un error tipado y el snapshot no cambia

#### Scenario: Un solo edificio por visita
- **GIVEN** una partida en obra con madera 100 y piedra 100
- **WHEN** se construye `house` y después, sin ejecutar ticks, se construye `tower`
- **THEN** la primera tiene éxito, la segunda devuelve un error tipado y la madera vale 85

#### Scenario: Construir no consume azar
- **GIVEN** dos partidas idénticas con la semilla 7 que abren la oferta del mismo solar en el mismo tick
- **WHEN** en una se construye `house` y en la otra se sale sin construir
- **THEN** el estado de cada `RandomGenerator` (partida, ovejas, piedra) es el mismo en las dos

#### Scenario: Torre no asequible
- **GIVEN** una partida en obra con madera 30 y piedra 14 (la torre figura en la oferta, no asequible)
- **WHEN** se construye `tower`
- **THEN** devuelve un error tipado, el snapshot no cambia y la partida sigue en obra

#### Scenario: Nada asequible
- **GIVEN** una partida en obra con madera 0 y piedra 0
- **WHEN** se construye `house` y después `tower`
- **THEN** ambas devuelven un error tipado, el snapshot no cambia y la partida sigue en obra
- **AND** salir sin construir devuelve la partida a en curso

### Requirement: Salida de la obra sin construir
El sistema SHALL ofrecer un caso de uso para salir de la obra sin construir: con la partida en obra la devuelve a en
curso sin ejecutar ningún tick; el siguiente tick ejecutado continúa exactamente donde se quedó la partida. Salir con
la partida en otro estado MUST devolver un error tipado sin cambiar el snapshot. Una visita sin construir MUST dejar la
partida igual que si la oferta no se hubiera abierto, salvo el solar desarmado.

#### Scenario: Salir y seguir
- **GIVEN** una partida que abre la oferta de un solar en el tick n
- **WHEN** se sale sin construir y se ejecuta 1 tick
- **THEN** tras salir el estado es en curso con `snapshot.tick` n, y tras el tick `snapshot.tick` vale n + 1

#### Scenario: Salir fuera de la obra
- **GIVEN** una partida en curso, otra eligiendo mejora, otra en tienda y otra terminada
- **WHEN** en cada una se pide salir de la obra
- **THEN** cada petición devuelve un error tipado y el snapshot no cambia

#### Scenario: Visita sin construir
- **GIVEN** dos partidas con la semilla 7 y los mismos inputs, en las que la oferta de un solar se abre en el tick n
- **WHEN** en una se sale enseguida y en la otra se piden 600 ticks durante la obra y después se sale, y ambas ejecutan
  600 ticks más
- **THEN** sus snapshots son iguales campo a campo en cada uno de esos 600 ticks

### Requirement: Edificios que bloquean el paso
El sistema SHALL tratar cada celda de la huella de un edificio construido (la de su tipo) como **no caminable** desde
el momento de la construcción hasta el final de la partida, para todo lo que depende de caminabilidad (la misma lista
que en "Solar libre que bloquea el paso"). Las celdas de la huella del solar que no son de la huella del edificio
construido quedan caminables o no según fije el design, de forma determinista y sin consumir azar; con el contenido por
defecto no hay ninguna (las huellas coinciden), así que construir no cambia la caminabilidad de ninguna celda. Si una
construcción cambia la caminabilidad de alguna celda, el campo de distancias que se usa en el primer tick ejecutado
tras construir MUST tenerlo en cuenta, aunque el jugador siga en la misma celda. El tipo de las celdas del mapa (`grass`
u otro) no cambia al construir.

#### Scenario: El edificio corta la línea libre
- **GIVEN** el solar de prueba con una casa construida y un enemigo cuyo segmento hasta el jugador cruza la huella
- **WHEN** se evalúa la línea libre del enemigo
- **THEN** no tiene línea libre

#### Scenario: El jugador choca con la casa
- **GIVEN** el solar de prueba con una casa construida y el jugador a 100 px de una cara de su huella, con input
  perpendicular a esa cara
- **WHEN** se ejecutan 60 ticks
- **THEN** el jugador queda tangente a esa cara (error ≤ 0,001) y en ningún tick solapa una celda de la huella

#### Scenario: Aparición sobre el edificio
- **GIVEN** el solar de prueba con una torre construida y un intento de aparición cuyo punto cae en una celda de su
  huella
- **WHEN** se ejecuta el tick de la aparición
- **THEN** el enemigo aparece en el centro de una celda caminable fuera de la huella y el intento ha consumido 1 valor
  del azar, como en el mapa sin edificio

#### Scenario: El tipo de las celdas no cambia
- **GIVEN** el contenido por defecto, la semilla 42 y una casa construida en su primer solar
- **WHEN** se lee el mapa de la partida y se calcula la firma de `tests/support/mapGolden.ts`
- **THEN** las celdas de la huella conservan su tipo del mapa generado y la firma no cambia

#### Scenario: Construir no cambia la caminabilidad por defecto
- **GIVEN** el solar de prueba y el contenido por defecto
- **WHEN** se consulta la caminabilidad de las 2.304 celdas y el campo de distancias hacia la celda (21, 16) antes y
  después de construir la casa, y aparte la torre
- **THEN** las tres consultas son iguales celda a celda y las 4 celdas de la huella son no caminables

### Requirement: Huella despejada al construir
El sistema SHALL, al construir, sin consumir azar y sin cambiar identificadores, tipos, vidas, estados ni el orden de
ninguna lista, recolocar en el centro de la celda caminable más cercana (con las celdas de obra ya actualizadas, el
edificio nuevo incluido) todo lo que quede en la huella del edificio nuevo:
- cada enemigo vivo cuyo centro está en una celda de la huella;
- cada recogible, atraído o no, cuyo centro está en una celda de la huella;
- cada oveja viva cuyo círculo solapa una celda de la huella, y cada punto de origen de oveja que está en una celda de
  la huella;
- cada punto de patrulla y cada puesto de guardia que está en una celda de la huella.

El criterio de "más cercana" y su desempate entre celdas a igual distancia los fija el design; MUST ser deterministas y
no depender del orden de las listas. Las dinamitas, los avisos, las explosiones y los proyectiles no se recolocan. Como
la huella del solar es no caminable desde el tick 0, el jugador nunca la solapa al construir, y lo que no está en la
huella (por ejemplo, una oveja tangente a ella) no se mueve.

#### Scenario: Enemigo dentro de la huella
- **GIVEN** una partida en obra en el solar de prueba con un `goblin-torch` de identificador X, vida 7, en persecución,
  colocado por el escenario con el centro en una celda de la huella de la casa
- **WHEN** se construye `house`
- **THEN** X está en el centro de una celda caminable fuera de la huella, con vida 7, en persecución y en la misma
  posición de la lista de enemigos

#### Scenario: Recogibles dentro de la huella
- **GIVEN** una partida en obra en el solar de prueba con un recogible `wood` no atraído colocado por el escenario y
  otro `xp` atraído, ambos con el centro en celdas de la huella de la torre, madera 30 y piedra 15
- **WHEN** se construye `tower`
- **THEN** ambos están en el centro de celdas caminables fuera de la huella, con el mismo identificador, tipo, valor y
  orden en la lista de recogibles

#### Scenario: Nada en la huella tras construir
- **GIVEN** el contenido por defecto, cada semilla de 1 a 50 con su mapa generado y el bot de referencia v5
- **WHEN** se juega cada partida hasta que termina o hasta el tick 36.000
- **THEN** inmediatamente después de cada construcción y en todos los ticks posteriores ningún enemigo vivo ni recogible
  no atraído tiene el centro en una celda construida, ninguna oveja la solapa y el jugador tampoco

#### Scenario: Despejar no consume azar
- **GIVEN** dos partidas con la semilla 7 que construyen la misma casa en el mismo tick, una con 3 enemigos y 2
  recogibles colocados por el escenario dentro de la huella y otra con ellos fuera
- **WHEN** se construye
- **THEN** el estado de cada `RandomGenerator` es el mismo en las dos

#### Scenario: Oveja tangente a la huella
- **GIVEN** una partida en obra en el solar de prueba con una oveja declarada de radio 20 en (1.260, 740), tangente a la
  cara inferior de la huella, con su punto de origen en esa posición
- **WHEN** se construye `house` y se ejecutan 600 ticks
- **THEN** tras construir la oveja y su origen siguen en (1.260, 740)
- **AND** en ningún tick posterior el círculo de la oveja solapa la huella

#### Scenario: Nada en las celdas de obra
- **GIVEN** el contenido por defecto, cada semilla de 1 a 50 con su mapa generado y el bot de referencia v5
- **WHEN** se juega cada partida hasta que termina o hasta el tick 36.000
- **THEN** en todos los ticks, también inmediatamente después de cada construcción, ningún enemigo vivo ni recogible no
  atraído tiene el centro en una celda de obra, ninguna oveja la solapa y el jugador tampoco

### Requirement: Edificios indestructibles y fuera del combate
El sistema SHALL hacer los edificios indestructibles y ajenos al combate: no tienen vida; las explosiones de barriles y
dinamitas y el contacto de los enemigos MUST NOT afectarlos; las armas del jugador MUST NOT elegirlos como objetivo ni
sus proyectiles colisionar con ellos; no suman bajas, gemas, oro ni piedra. Los edificios no figuran en la lista de
estructuras (`goblin-structures`).

#### Scenario: Explosión junto a una casa
- **GIVEN** el solar de prueba con una casa construida y un `goblin-barrel` que explota con su radio cubriendo toda la
  huella
- **WHEN** se ejecutan el tick de la explosión y 600 ticks más
- **THEN** el solar sigue en `house`, sus celdas siguen no caminables y la lista de estructuras no cambia

#### Scenario: El Linter no apunta a un edificio
- **GIVEN** el solar de prueba con una casa construida a 100 px del jugador, sin enemigos, estructuras ni ovejas, y el
  Linter cargado
- **WHEN** se ejecutan 60 ticks
- **THEN** el Linter no crea ningún proyectil

### Requirement: Oro periódico de las casas
El sistema SHALL hacer que cada casa construida en el tick n (el `snapshot.tick` en el que se construye) pague el oro
por pago del contenido en cada tick n + k × periodo (k ≥ 1), en el paso de ingresos de las casas (ver "Orden de los
pasos del tick" en `simulation-loop`), como un **ingreso** de oro con la bonificación de oro y el resto propio del oro
(ver "Contadores de oro y madera de la partida" en `resources`). El oro va directo al contador: no crea ningún
recogible ni ocupa el tope de oro en el suelo. Si varias casas pagan en el mismo tick, pagan en el orden de la lista de
solares. En el tick en que la partida termina no se paga, y los ticks pedidos en las fases congeladas no cuentan.
Pagar MUST NOT consumir azar.

#### Scenario: Pagos de una casa
- **GIVEN** una casa construida en el tick 1.000 con oro 0, g = 0 y ninguna otra fuente de oro
- **WHEN** se ejecutan ticks hasta el 4.600
- **THEN** el oro vale 0 en el tick 2.799, 1 en el 2.800, 1 en el 4.599 y 2 en el 4.600

#### Scenario: Dos casas
- **GIVEN** casas construidas en los ticks 1.000 y 1.500, oro 0, g = 0 y ninguna otra fuente de oro
- **WHEN** se ejecutan ticks hasta el 4.600
- **THEN** el oro vale 1 en el tick 2.800, 2 en el 3.300, 3 en el 4.600

#### Scenario: Con bonificación de oro
- **GIVEN** una casa con un periodo de escenario de 10 ticks, g = 20, oro 0 y resto 0
- **WHEN** paga 10 veces
- **THEN** el oro vale 12

#### Scenario: Sin recogible ni tope
- **GIVEN** el tope de oro en el suelo lleno y una casa que paga en el tick m
- **WHEN** se ejecuta el tick m
- **THEN** el oro sube en 1, la lista de recogibles no cambia y no se suma nada al recogible `gold` más antiguo

#### Scenario: Sin pago en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks y una casa construida en el tick 60 con un periodo de
  escenario de 60 ticks
- **WHEN** se ejecuta el tick 120
- **THEN** la partida está terminada con victoria y el oro no ha cambiado

#### Scenario: Las pausas no adelantan el pago
- **GIVEN** una casa construida en el tick 1.000 y una oferta de mejora abierta en el tick 2.000 durante la que se
  piden 600 ticks
- **WHEN** se elige y se ejecutan ticks hasta el 2.800
- **THEN** el primer pago ocurre en el tick 2.800, no antes

### Requirement: Torre que dispara sola
El sistema SHALL dar a cada torre construida el arma de torre del contenido, cargada al construirse, que actúa en el
paso de armas de cada tick (ver "Orden de los pasos del tick" en `simulation-loop`), en el orden de la lista de
solares, con las reglas de "Cadencia y retención de carga", "Objetivo del más cercano dentro de alcance" y
"Proyectiles" de `auto-weapons` salvo estas diferencias:
- la distancia y el origen de las **flechas** se miden desde el punto de disparo de la torre, no desde el jugador;
- su objetivo es solo el enemigo vivo más cercano a ≤ `range` (empate: el primero de la lista de enemigos); nunca una
  estructura ni una oveja, y sus flechas atraviesan estructuras y ovejas;
- su daño, su alcance y su cadencia son los del contenido: ninguna mejora (de personaje ni de arma) los cambia;
- sus flechas viven en una **reserva propia** con el tope de flechas de torre: una torre cargada, con objetivo y con
  la reserva llena MUST NOT disparar y conserva la carga. Las flechas MUST NOT ocupar plazas del tope de proyectiles del
  jugador (`maxProjectiles`) ni el jugador plazas de la reserva de las torres.

Las bajas que causan las flechas cuentan como cualquier baja por armas (contador de bajas, gema, madera del barril,
oro por baja y tirada de piedra; ver "Orden de los pasos del tick"). Elegir objetivo y disparar MUST NOT consumir azar.

#### Scenario: Primer disparo de la torre
- **GIVEN** una torre construida en el tick n y un `goblin-torch` que permanece a 300 px de su punto de disparo y a
  > 400 px del jugador
- **WHEN** se ejecuta el tick n + 1
- **THEN** hay exactamente 1 flecha de torre nueva, en el punto de disparo, con dirección hacia el enemigo
- **AND** el jugador no ha creado ningún proyectil

#### Scenario: Límite del alcance
- **GIVEN** una torre cargada y un único enemigo vivo a 350 px de su punto de disparo, y en otro caso a 351 px
- **WHEN** la torre actúa
- **THEN** con 350 px dispara y con 351 px no hay objetivo ni flecha

#### Scenario: Cadencia de la torre
- **GIVEN** una torre construida en el tick n, un arma de torre con `cooldownTicks` c y un objetivo permanente a
  100 px que no muere
- **WHEN** se ejecutan 2 × c + 1 ticks
- **THEN** la torre dispara exactamente en los ticks n + 1, n + 1 + c y n + 1 + 2 × c

#### Scenario: Solo enemigos
- **GIVEN** una torre cargada con una estructura goblin no destruida y una oveja viva a 100 px de su punto de
  disparo, sin enemigos en alcance
- **WHEN** se ejecutan 60 ticks
- **THEN** la torre no crea ninguna flecha y la estructura y la oveja conservan su vida

#### Scenario: Las mejoras no afectan a la torre
- **GIVEN** dos partidas iguales con una torre y un objetivo permanente, una con `strict-rules` y `fast-ci` en su
  `maxLevel` y otra sin mejoras
- **WHEN** se ejecutan 600 ticks
- **THEN** la torre dispara en los mismos ticks en las dos y cada flecha resta el `damage` del contenido

#### Scenario: Baja por una flecha
- **GIVEN** una torre y un `goblin-torch` con vida menor o igual que el daño de la flecha, probabilidad de piedra 100 en
  `goblin-torch` y oro por baja 2, en el que la flecha impacta en el tick m
- **WHEN** se ejecuta el tick m
- **THEN** las bajas suben en 1 y se crean la gema, un `gold` de valor 2 y una `stone` de ese `goblin-torch`

#### Scenario: Reserva de las torres llena
- **GIVEN** un tope de flechas de torre 2 (valor de escenario), 3 torres cargadas con objetivo en alcance que ninguna
  flecha alcanza, y el Linter con objetivo
- **WHEN** se ejecuta 1 tick
- **THEN** hay 2 flechas de torre (las de las dos primeras torres de la lista) y la tercera torre sigue cargada
- **AND** el Linter ha creado su proyectil

#### Scenario: El jugador conserva su tope
- **GIVEN** la reserva de las torres llena en todos los ticks y el Linter con `cooldownTicks` 1 con un objetivo que no
  alcanza
- **WHEN** se ejecutan 60 ticks
- **THEN** hay 32 proyectiles del jugador vivos en el tick 32 y ninguno de ellos es una flecha de torre

#### Scenario: Con el tope del jugador lleno las torres disparan
- **GIVEN** 32 proyectiles del jugador vivos y una torre cargada con objetivo en alcance
- **WHEN** se ejecuta 1 tick
- **THEN** la torre crea su flecha

#### Scenario: Flechas congeladas en pausa
- **GIVEN** una flecha de torre en vuelo y una oferta de mejora abierta en el tick n
- **WHEN** se piden 600 ticks durante la oferta
- **THEN** la flecha sigue en la misma posición y con la misma edad

### Requirement: Panel de obra
La vista SHALL mostrar, si y solo si el snapshot está en obra, un panel centrado en la ventana con:
- el saldo: la madera y la piedra disponibles, cada cifra con el **icono de su recurso** (la misma imagen que el
  contador del HUD de ese recurso, ver `hud`);
- **siempre dos filas**, la casa y después la torre, cada una con el nombre del edificio y su coste en elementos
  distintos, separados de forma que el texto no quede pegado; el coste se muestra por recurso como cifra con su icono,
  y un coste de 0 en un recurso no se muestra (la casa por defecto solo muestra madera);
- un botón `Salir`.

Cada icono MUST tener una alternativa de texto con el nombre del recurso (`madera`, `piedra`). Una fila **asequible**
según la oferta es un botón activo: hacer clic en ella MUST construirla con el caso de uso de construcción. Una fila
**no asequible** se ve atenuada y está desactivada (hacer clic no llama a ningún caso de uso y el snapshot no cambia);
cada recurso cuyo coste supera el saldo muestra su cifra en rojo y el texto «faltan N», con N = coste − saldo de ese
recurso; los recursos que sí alcanzan se muestran como en una fila asequible. Ningún elemento del panel MUST tener
atributo `style` (CSP sin estilos inline); los iconos se cargan desde el propio origen o como `data:`. Pulsar Esc o
`Salir` MUST salir de la obra con el caso de uso de salida, sin abrir la pausa (ver "Pausa con Esc" en `main-menu`).
Mientras el panel se ve, el input de movimiento no llega a la simulación y las teclas 1, 2, 3 y R no tienen efecto.
Tras construir, el panel no se ve y el HUD muestra la madera y la piedra del snapshot nuevo desde el siguiente frame
pintado. El panel no cambia el HUD.

#### Scenario: Panel con una opción
- **GIVEN** un snapshot en obra con madera 30 y piedra 14
- **WHEN** se pinta
- **THEN** el panel es visible con madera 30, piedra 14, 1 fila (la casa, 15 madera) y el botón `Salir`

#### Scenario: Panel con dos opciones
- **GIVEN** un snapshot en obra con madera 30 y piedra 15
- **WHEN** se pinta
- **THEN** el panel tiene 2 filas, la casa primero y la torre después, cada una con su coste

#### Scenario: Clic en la casa
- **GIVEN** el panel del escenario "Panel con las dos opciones asequibles" en el tick n
- **WHEN** se hace clic en la fila de la casa y se pinta 1 frame de 16,667 ms
- **THEN** el panel no es visible, el HUD muestra madera 15 y piedra 15, el solar está en `house` y `snapshot.tick`
  vale n + 1

#### Scenario: Salir con Esc o con el botón
- **GIVEN** el panel visible en el tick n, una vez, y otra vez el mismo estado
- **WHEN** en la primera se pulsa Esc y en la segunda se pulsa `Salir`, y en ambas se pinta 1 frame de 16,667 ms
- **THEN** en ambas el panel no es visible, el overlay de pausa no se ha visto, el solar sigue en `free` y
  `snapshot.tick` vale n + 1

#### Scenario: Sin panel fuera de la obra
- **GIVEN** snapshots en curso, eligiendo mejora, en tienda, en pausa y terminado
- **WHEN** se pintan
- **THEN** el panel de obra no es visible en ninguno

#### Scenario: Panel con las dos opciones asequibles
- **GIVEN** un snapshot en obra con madera 30 y piedra 15
- **WHEN** se pinta
- **THEN** el panel es visible con el saldo 30 madera y 15 piedra con sus iconos, 2 filas activas (casa con 15 madera;
  torre con 30 madera y 15 piedra) y el botón `Salir`
- **AND** ninguna cifra está en rojo ni hay ningún texto «faltan»

#### Scenario: Panel con la torre no asequible
- **GIVEN** un snapshot en obra con madera 30 y piedra 14
- **WHEN** se pinta y se hace clic en la fila de la torre
- **THEN** la fila de la casa está activa y la de la torre atenuada y desactivada, con 30 madera sin rojo y 15 piedra en
  rojo con «faltan 1»
- **AND** el clic no llama al caso de uso de construcción y el snapshot sigue en obra

#### Scenario: Panel sin nada asequible
- **GIVEN** un snapshot en obra con madera 10 y piedra 0
- **WHEN** se pinta
- **THEN** las 2 filas están atenuadas y desactivadas: la casa con 15 madera en rojo y «faltan 5»; la torre con 30
  madera en rojo y «faltan 20» y 15 piedra en rojo y «faltan 15»
- **AND** el botón `Salir` está activo

#### Scenario: Nombre y coste separados
- **GIVEN** un snapshot en obra con madera 30 y piedra 15
- **WHEN** se pinta
- **THEN** en cada fila el nombre y el coste están en elementos distintos y el texto de la fila, con los espacios
  colapsados, tiene ≥ 1 espacio entre el nombre y la primera cifra (no contiene «Casa15» ni «Torre30»)
- **AND** ningún elemento del panel tiene atributo `style` y cada icono tiene la alternativa `madera` o `piedra`

### Requirement: Solares observables en el navegador
La sonda E2E (`window.__sprint`) SHALL exponer, solo con `?e2e`, `sites`: por solar, en el orden del snapshot, su
identificador, su estado, si está armado y sus huellas de casa y torre, **sin acceso** (la clave `access` no existe);
si el panel de obra es visible y, con él, el solar abierto y sus dos opciones, cada una con su tipo, su coste y si es
asequible. En modo menú `sites` MUST valer `null`. Leer la sonda MUST NOT cambiar la simulación. El recorrido completo
MUST poder hacerse en el juego real en modo manual.

#### Scenario: Construir una casa en el juego real [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y `map: 'real'`, a 1.280 × 720, y un input que recoge ≥ 15
  de madera y < 15 de piedra y lleva al jugador a una celda caminable vecina de la huella de un solar y lo empuja contra
  ella (ruta calculada por el test con la sonda del mapa y de los solares, con las huellas libres como no caminables)
- **WHEN** se avanza con `step(n)` hasta que la partida está en obra, se hace clic en la casa y se llama a `step(1)`
- **THEN** con la obra abierta la sonda informa del panel visible, del solar abierto y de las opciones `house`
  (asequible) y `tower` (no asequible), sin clave `access` en ningún solar
- **AND** en el panel la fila de la torre está desactivada con «faltan», cada icono mide ≥ 20 × 20 px y entre el nombre
  y el coste de cada fila hay ≥ 8 px
- **AND** tras el clic la sonda informa del solar en `house`, el panel no es visible, la madera ha bajado en 15,
  `sprites.sites` cuenta 1 casa y 5 solares en obra, y `step(1)` devuelve 1, sin errores no capturados

#### Scenario: Sonda de solares en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda
- **THEN** `sites` vale `null`

### Requirement: Balance con los solares
El sistema SHALL cumplir, con el contenido por defecto final de este change y **sin recalibrar** el contenido de
combate, de oleadas ni de edificios, sobre las semillas 1..50 con su mapa generado:
- con el bot de referencia **v4** (que no construye: cada oferta de obra la cierra sin construir), entre **25 y 35**
  victorias; la línea base de `tests/support/balanceBaseline.ts` se regenera en este change con ese resultado
  (resultado, tick final y bajas por semilla) y los tests la comprueban semilla a semilla;
- con el bot de referencia **v5** (el v4 más construcción: va a una celda caminable vecina de la huella de un solar y
  la toca; el design fija su ruta y su elección de tipo, sin azar), entre **25 y 35** victorias, con ≥ 1 casa construida
  en ≥ 1 partida y ≥ 1 torre construida en ≥ 1 partida; su referencia versionada se regenera en este change;
- el invariante "quieto pierde antes de 180 s": 0 victorias y derrota en un tick < 10.800 en las 50 semillas con el mapa
  generado y con el mapa vacío.

Si el lote v4 o el v5 sale de la banda, el change MUST volver a propose (no se recalibra en apply). El verify-report
MUST anotar: las victorias del v4 y del v5, las casas y torres construidas por partida, el tick de la muerte más tardía
del quieto y el tiempo de cada lote en local y ×2,8 como equivalente de CI (solo anotado). Cada lote MUST caber en el
tiempo máximo del lote de los tests (180 s), que no se sube.

#### Scenario: Victorias del bot v5
- **GIVEN** el contenido por defecto final, cada semilla de 1 a 50 con su mapa generado y el bot v5
- **WHEN** se juega cada partida hasta que termina o hasta el tick 36.000
- **THEN** el número de victorias es ≥ 25 y ≤ 35 y coincide con su referencia versionada
- **AND** en ≥ 1 partida se ha construido ≥ 1 casa y en ≥ 1 partida ≥ 1 torre

#### Scenario: Quieto pierde con los solares
- **GIVEN** el contenido por defecto final, input (0, 0) y las políticas de elección, tienda y obra fijas
- **WHEN** se juega cada semilla de 1 a 50 con su mapa generado y, aparte, con el mapa vacío, hasta que termina o hasta
  el tick 10.800
- **THEN** las 100 partidas terminan con derrota en un tick < 10.800 y ninguna pasa por en obra

#### Scenario: Bot v4 en banda y línea base
- **GIVEN** el contenido por defecto final, cada semilla de 1 a 50 con su mapa generado y el bot v4
- **WHEN** se juega cada partida hasta que termina o hasta el tick 36.000
- **THEN** el número de victorias es ≥ 25 y ≤ 35 y cada semilla termina con el resultado, el tick y las bajas de la línea
  base versionada
- **AND** ninguna partida tiene un solar construido

### Requirement: Solar libre que bloquea el paso
El sistema SHALL tratar cada celda de la huella de un solar `free` como **no caminable** desde la creación de la
partida (tick 0), para todo lo que depende de caminabilidad (ver "Rejilla de celdas tipadas" en `procedural-map`): la
colisión del jugador, la línea libre, el campo de distancias hacia el jugador y hacia un punto fijo (también el de los
puestos de guardia), la recolocación de apariciones, de recogibles y de puntos de patrulla, el movimiento y la
reaparición de las ovejas, la conectividad y el bot de referencia. El tipo de las celdas (`grass`) no cambia, y la
colocación de los solares no cambia (ver "Solares en el mapa generado" en `procedural-map`). Marcar las huellas MUST NOT
consumir azar. Con el mapa vacío sin solares la simulación MUST ser idéntica a la de antes del change.

Una partida MUST NOT crearse si el círculo del jugador en su posición inicial solapa una celda de la huella de un solar
declarado: el error menciona el solar.

#### Scenario: El jugador choca con el solar libre
- **GIVEN** el solar de prueba en `free` y el jugador en (1.260, 800), con input (0, −1)
- **WHEN** se ejecutan ticks hasta que la partida pasa a en obra
- **THEN** en ese tick el jugador está en (1.260, 736) (error ≤ 0,001), tangente a la cara inferior de la huella
- **AND** en ningún tick el círculo del jugador solapa una celda de la huella y el solar sigue en `free`

#### Scenario: Deslizar junto al solar libre
- **GIVEN** el solar de prueba en `free` y desarmado (su oferta ya se abrió y se cerró sin construir), el jugador en
  (1.210, 736), tangente a la cara inferior, y velocidad 200 px/s
- **WHEN** se ejecutan 30 ticks con input (1, −1)
- **THEN** y sigue en 736 y x ha aumentado 70,711 px (error ≤ 0,001), sin pasar de la esquina (x final 1.280,711)

#### Scenario: El enemigo rodea el solar libre
- **GIVEN** un jugador quieto en P = (1.260, 1.000) con una vida suficiente para no llegar a 0 en 3.600 ticks y un
  `goblin-torch` en E = (1.260, 300), de forma que el segmento E–P cruza la huella del solar de prueba y ninguna otra
  celda no caminable; una partida con el solar de prueba en `free` y otra con el mapa vacío sin solar
- **WHEN** se ejecutan 3.600 ticks en cada una, con la política de obra fija
- **THEN** en la partida sin solar el centro del enemigo está en una celda de las columnas 20–21 y filas 10–11 en ≥ 1
  tick
- **AND** en la partida con el solar en ningún tick el centro del enemigo está en una celda de la huella y llega a P
  (error ≤ 0,001) en un tick estrictamente posterior al de la partida sin solar

#### Scenario: El solar libre corta la línea libre
- **GIVEN** el solar de prueba en `free` y un enemigo en (1.260, 300) con el jugador en (1.260, 1.000)
- **WHEN** se evalúa la línea libre del enemigo en el tick 0
- **THEN** no tiene línea libre; con el mapa vacío sin solar sí la tiene

#### Scenario: Campo de distancias en el tick 0
- **GIVEN** el solar de prueba en `free` y el campo de distancias hacia la celda (21, 16)
- **WHEN** se calcula en el tick 0
- **THEN** ninguna de las 4 celdas de la huella tiene distancia y la celda (20, 9) tiene una distancia mayor que
  |20 − 21| + |9 − 16| = 8

#### Scenario: Aparición sobre el solar libre
- **GIVEN** el solar de prueba en `free` y un intento de aparición cuyo punto cae en la celda (20, 10)
- **WHEN** se ejecuta el tick de la aparición
- **THEN** el enemigo aparece en el centro de una celda caminable fuera de la huella y el intento ha consumido 1 valor
  del azar, como con un tronco en esa celda

#### Scenario: Recogible creado sobre el solar libre
- **GIVEN** el solar de prueba en `free` y un `goblin-torch` con vida 4 colocado por el escenario con el centro en
  (1.230, 630), que muere por armas en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** su gema se crea en el centro de una celda caminable fuera de la huella

#### Scenario: Punto de patrulla sobre el solar libre
- **GIVEN** el mapa vacío con una casa goblin declarada y el solar de prueba declarado de forma que uno de los puntos
  de patrulla de su guardia cae en una celda de la huella
- **WHEN** nace el guardia y se ejecutan 1.200 ticks con el jugador a > 1.000 px del guardia
- **THEN** ese punto de patrulla está en el centro de una celda caminable fuera de la huella desde el nacimiento y en
  ningún tick el centro del guardia está en una celda de la huella

#### Scenario: Oveja declarada sobre el solar libre
- **GIVEN** el solar de prueba, un radio de oveja 20 y una oveja declarada en (1.260, 660) (dentro de la huella), y en
  otro caso en (1.260, 735) (a 15 px de la cara inferior)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona la oveja
- **AND** con la oveja en (1.260, 740), tangente a la cara inferior, la partida se crea

#### Scenario: Solar declarado sobre el jugador
- **GIVEN** el mapa vacío (salida (1.920, 1.080)) con un solar declarado de huella en las columnas 31–32 y filas 17–18,
  y en otro caso en las columnas 32–33 y filas 18–19 con una salida declarada en (1.904, 1.080) (tangente, g = 0)
- **WHEN** se intenta crear la partida
- **THEN** la primera no se crea y el error menciona el solar
- **AND** la segunda se crea

#### Scenario: Marcar no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mapa vacío, una con el solar de prueba y otra sin solar
- **WHEN** se crean
- **THEN** el estado de cada `RandomGenerator` de la partida (partida, ovejas, piedra) es el mismo en las dos

### Requirement: Colocación y arte intactos con el solar bloqueante
El sistema SHALL mantener, con el contenido por defecto final de este change, la misma colocación de solares que antes
del change (huellas y orden por semilla, `SITE_GOLDEN` intacta) y el mismo arte del mapa: el bloqueo de las huellas
libres MUST NOT cambiar el número de objetos del plan de arte del mapa (ver `sprite-rendering`).

#### Scenario: Objetos del mapa sin cambios
- **GIVEN** el contenido por defecto final y las semillas 42 y 123 con su mapa generado
- **WHEN** se planifica el arte del mapa de cada una
- **THEN** tiene 737 y 820 objetos respectivamente (≤ 1.000)

<!-- historial: 0026-build-sites (2026-11-25) -->
<!-- historial: 0027-site-contact (2026-11-25) -->
