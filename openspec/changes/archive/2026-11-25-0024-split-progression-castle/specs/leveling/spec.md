# Spec delta · leveling

## ADDED Requirements

### Requirement: Curación por subida sin mejoras
El sistema SHALL leer del fichero de progresión de `content/`, validado con zod, la **curación por subida**: un
entero de 1 a 100 (porcentaje de la vida máxima efectiva). Cada subida pendiente que se resuelve sin ninguna mejora de
personaje disponible (ver "Oferta de mejoras" en `upgrades`) MUST curar al jugador max(1, ⌊curación por subida × vida
máxima efectiva / 100⌋), con tope en la vida máxima efectiva, en el mismo momento en que se resolvería su oferta: en el
paso de ofertas del tick (ver "Orden de los pasos del tick" en `simulation-loop`) o, si quedaba encolada tras una
oferta, en la elección que cierra la anterior, sin ejecutar ticks. Curar así no cambia la vida máxima ni la
invulnerabilidad, no abre oferta, no pasa por eligiendo mejora y MUST NOT consumir azar. Un valor ausente, no entero o
fuera de rango MUST impedir que la partida arranque con un error que nombre el campo.

#### Scenario: Una subida sin mejoras
- **GIVEN** todas las mejoras de personaje en su nivel máximo, vida 50 de 100 y curación por subida 10 (valor de
  escenario)
- **WHEN** el jugador sube 1 nivel en el tick n
- **THEN** el snapshot del tick n muestra vida 60, sin oferta y la partida en curso

#### Scenario: Dos subidas en el mismo tick
- **GIVEN** el estado del escenario anterior con vida 30 de 100
- **WHEN** el jugador sube 2 niveles en el tick n
- **THEN** la vida vale 50 en el snapshot del tick n

#### Scenario: Tope y mínimo
- **GIVEN** el estado de "Una subida sin mejoras" con vida 95 de 100, y en otra partida curación por subida 1 con vida
  10 de 60
- **WHEN** el jugador sube 1 nivel
- **THEN** en la primera la vida vale 100 y en la segunda 11 (⌊0,6⌋ = 0, mínimo 1)

#### Scenario: Sin azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una el jugador sube 2 niveles sin mejoras
  disponibles en el tick n y en la otra no sube
- **WHEN** ambas ejecutan el tick n sin aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

#### Scenario: Valores inválidos
- **GIVEN** un contenido con curación por subida 0, 101, 2,5 o ausente
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el campo

## MODIFIED Requirements

### Requirement: Subida de nivel con arrastre
El sistema SHALL sumar a la XP actual la XP de cada gema recogida (ver `xp-gems`): su valor más la bonificación de XP
efectiva b (`xpBonusPercent`, ver "Estadísticas de personaje nuevas" en `upgrades`; 0 sin mejoras). La XP es siempre
entera y la fracción de la bonificación se arrastra entre gemas: con un resto r de la partida (entero de 0 a 99, 0 al
crearla), cada gema de valor v suma ⌊(v × (100 + b) + r) / 100⌋ y deja como resto (v × (100 + b) + r) mod 100. Con b =
0 cada gema suma exactamente su valor. Mientras la XP actual sea ≥ `xpToNext(nivel)`, MUST restarse ese umbral, subir
el nivel en 1 y registrar una subida pendiente; la XP sobrante se conserva en el nivel nuevo. Nivel y XP se actualizan
en el mismo tick de la recogida. La XP no se pierde nunca ni es negativa.

<!-- Escenarios vivos sin cambios: "Por debajo del umbral", "Umbral exacto", "Arrastre del sobrante" y "XP acumulada
     hasta el nivel 3" (todos con b = 0). -->

#### Scenario: Bonificación con gemas de valor 1
- **GIVEN** un jugador en nivel 1 con XP 0, b = 50 y resto 0
- **WHEN** recoge una gema de valor 1 y, en el tick siguiente, otra
- **THEN** tras la primera la XP vale 1 y tras la segunda vale 3

#### Scenario: Bonificación acumulada
- **GIVEN** un jugador en nivel 1 con XP 0, b = 10, resto 0 y la curva de escenario 5/5
- **WHEN** recoge 10 gemas de valor 1 en ticks distintos y elige una mejora en cada oferta
- **THEN** ha ganado 11 de XP en total: queda en nivel 2 con XP 6

#### Scenario: Bonificación con gema grande
- **GIVEN** un jugador en nivel 1 con XP 0, b = 25 y resto 0
- **WHEN** recoge una gema de valor 4
- **THEN** la XP vale 5 y el resto 0

### Requirement: Varias subidas en un tick
El sistema SHALL encolar todas las subidas de nivel que ocurran en un mismo tick, por una gema grande o por varias
gemas a la vez, y resolverlas una detrás de otra: cada subida pendiente abre su propia oferta de mejoras (ver
`upgrades`), o cura si no hay mejoras de personaje disponibles (ver "Curación por subida sin mejoras"), y la siguiente
se resuelve tras elegir en la anterior, sin ejecutar ticks entre ambas. El snapshot ya muestra el nivel final y la XP
sobrante desde el tick de la recogida.

<!-- Escenarios vivos sin cambios: "Una gema que da dos niveles", "La segunda oferta tras la primera elección" y
     "Varias gemas que dan varios niveles". -->
