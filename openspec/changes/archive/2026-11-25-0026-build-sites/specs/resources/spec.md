# Spec delta · resources

<!-- Purpose (al archivar): la frase "Gastar madera y piedra es de 0026 (solares de obra)." pasa a "La madera y la
     piedra se gastan al construir en los solares (`build-sites`), y las casas construidas son otra fuente de oro." -->

## MODIFIED Requirements

### Requirement: Contadores de oro y madera de la partida
El sistema SHALL llevar en cada partida dos contadores enteros, **oro** y **madera**, que valen 0 al crear la
partida (también tras R y tras `Volver al menú` + `Jugar`). La madera sube con cada recogida de un recogible `wood`, que
suma su valor, y solo baja al construir, en el coste en madera del edificio (ver "Construcción en el solar" en
`build-sites`). El oro sube con cada **ingreso** (la recogida de un recogible `gold`, el agotamiento de una veta, ver
"Vetas de oro al pasar", o el pago de una casa construida, ver "Oro periódico de las casas" en `build-sites`) y solo
baja con las compras de la tienda (ver "Compra en la tienda" en `castle-shop`). Ninguno de los dos es nunca negativo:
una construcción o una compra que no alcanza no se hace. Cada ingreso de valor v suma v más la bonificación de oro
efectiva g (`goldBonusPercent`, ver "Estadísticas de personaje nuevas" en `upgrades`; 0 sin mejoras), con la misma
regla de resto arrastrado que la XP (ver "Subida de nivel con arrastre" en `leveling`) y un resto propio del oro,
compartido por todos los ingresos: suma ⌊(v × (100 + g) + r) / 100⌋. Con g = 0 cada ingreso suma exactamente v. No
bajan al recibir daño ni al subir de nivel y no se conservan entre partidas. Recoger oro o madera MUST NOT sumar XP, y
recoger XP MUST NOT cambiar el oro ni la madera. Los contadores no se guardan en récords ni en el historial
(`progress-persistence` sin cambios) ni se muestran en la pantalla de resultados (`run-results` sin cambios).

<!-- Escenarios vivos sin cambios: todos los de este requisito salvo "Solo suben", que se mantiene tal cual (en ese
     escenario no hay construcción). -->

#### Scenario: La madera baja al construir
- **GIVEN** una partida en obra con madera 22 y oro 9
- **WHEN** se construye una casa (15 madera)
- **THEN** la madera vale 7 y el oro sigue en 9
- **AND** con madera 14 la casa no se ofrece y la madera sigue en 14

#### Scenario: Pago de una casa como ingreso
- **GIVEN** g = 10, oro 0, resto 0 y una casa construida
- **WHEN** la casa paga 10 veces y no hay ningún otro ingreso
- **THEN** el oro vale 11, igual que con 10 recogibles `gold` de valor 1

### Requirement: Contador de piedra de la partida
El sistema SHALL llevar en cada partida un contador entero de **piedra** (`snapshot.resources.stone`) que vale 0 al
crear la partida (también tras R y tras `Volver al menú` + `Jugar`). Sube con cada recogida de un recogible `stone`, que
suma exactamente su valor, sin bonificación (`goldBonusPercent` y `xpBonusPercent` no la afectan) y sin resto. Solo
baja al construir, en el coste en piedra del edificio (ver "Construcción en el solar" en `build-sites`); ni el daño, ni
la subida de nivel, ni la tienda la hacen bajar, y nunca es negativa. No se conserva entre partidas. Recoger piedra
MUST NOT cambiar la XP, el oro, la madera ni la vida, y recoger otro tipo MUST NOT cambiar la piedra. La piedra MUST
NOT guardarse en récords ni en el historial, ni salir en la exportación ni mostrarse en la pantalla de resultados
(`progress-persistence` y `run-results` sin cambios).

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: La piedra baja al construir una torre
- **GIVEN** una partida en obra con madera 31 y piedra 16
- **WHEN** se construye una torre (30 madera y 15 piedra)
- **THEN** la madera vale 1 y la piedra 1

#### Scenario: La casa no gasta piedra
- **GIVEN** una partida en obra con madera 15 y piedra 15
- **WHEN** se construye una casa
- **THEN** la madera vale 0 y la piedra sigue en 15
