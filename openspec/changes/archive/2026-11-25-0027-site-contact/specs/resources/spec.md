# Spec delta · resources

## MODIFIED Requirements

### Requirement: Contadores de oro y madera de la partida
El sistema SHALL llevar en cada partida dos contadores enteros, **oro** y **madera**, que valen 0 al crear la
partida (también tras R y tras `Volver al menú` + `Jugar`). La madera sube con cada recogida de un recogible `wood`, que
suma su valor, y solo baja al construir, en el coste en madera del edificio (ver "Construcción en el solar" en
`build-sites`). El oro sube con cada **ingreso** (la recogida de un recogible `gold`, el agotamiento de una veta, ver
"Vetas de oro al pasar", o el pago de una casa construida, ver "Oro periódico de las casas" en `build-sites`) y solo
baja con las compras de la tienda (ver "Compra en la tienda" en `castle-shop`). Ninguno de los dos es nunca negativo:
una construcción o una compra que no alcanza no se hace (una opción de obra no asequible se ofrece igualmente, pero
construirla devuelve un error, ver "Oferta de obra" en `build-sites`). Cada ingreso de valor v suma v más la
bonificación de oro efectiva g (`goldBonusPercent`, ver "Estadísticas de personaje nuevas" en `upgrades`; 0 sin
mejoras), con la misma regla de resto arrastrado que la XP (ver "Subida de nivel con arrastre" en `leveling`) y un
resto propio del oro, compartido por todos los ingresos: suma ⌊(v × (100 + g) + r) / 100⌋. Con g = 0 cada ingreso suma
exactamente v. No bajan al recibir daño ni al subir de nivel y no se conservan entre partidas. Recoger oro o madera
MUST NOT sumar XP, y recoger XP MUST NOT cambiar el oro ni la madera. Los contadores no se guardan en récords ni en el
historial (`progress-persistence` sin cambios) ni se muestran en la pantalla de resultados (`run-results` sin cambios).

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

#### Scenario: La madera baja al construir
- **GIVEN** una partida en obra con madera 22 y oro 9
- **WHEN** se construye una casa (15 madera)
- **THEN** la madera vale 7 y el oro sigue en 9
- **AND** con madera 14 y piedra 0 la oferta de obra incluye `house` como no asequible, construir `house` devuelve un
  error tipado, la partida sigue en obra y la madera sigue en 14

#### Scenario: Pago de una casa como ingreso
- **GIVEN** g = 10, oro 0, resto 0 y una casa construida
- **WHEN** la casa paga 10 veces y no hay ningún otro ingreso
- **THEN** el oro vale 11, igual que con 10 recogibles `gold` de valor 1
