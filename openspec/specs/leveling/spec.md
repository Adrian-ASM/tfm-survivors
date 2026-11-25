# Leveling · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
La XP acumulada, la curva de niveles y la cola de subidas de nivel pendientes.

## Requirements

### Requirement: Curva de XP validada
El sistema SHALL leer del fichero de progresión de `content/`, validados con zod antes de llegar al dominio, los
parámetros de la curva `baseXp` (entero ≥ 1) y `xpGrowth` (entero ≥ 0). La XP necesaria para pasar del nivel n al
n + 1 MUST ser `xpToNext(n) = baseXp + xpGrowth · (n − 1)`. Un valor ausente, no entero, fuera de rango o un campo
desconocido MUST impedir que la partida arranque con un error que nombre el campo.

El contenido por defecto MUST fijar `baseXp` 9 y `xpGrowth` 4 (changes 0019 y 0020): es la palanca de calibración
elegida para compensar el campo de flujo (0019) y los comportamientos y peligros de los enemigos (0020) sin tocar las
oleadas ni `player.speed` (ver "Partida ganable y perdible con el contenido por defecto" en `run-outcome`). Los
escenarios de "Subida de nivel con arrastre", "Varias subidas en un tick", "Sin nivel máximo" y "Barra de XP y nivel en
la vista" usan una **curva de escenario** explícita con `baseXp` 5 y `xpGrowth` 5, no el contenido por defecto; sus
números no cambian.

#### Scenario: Curva por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** `baseXp` vale 9 y `xpGrowth` vale 4
- **AND** `xpToNext` vale 9 en el nivel 1, 13 en el 2, 17 en el 3 y 205 en el 50

#### Scenario: Curva de escenario
- **GIVEN** un contenido con `baseXp` 5 y `xpGrowth` 5
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito y `xpToNext` vale 5 en el nivel 1, 10 en el 2, 15 en el 3 y 250 en el 50

#### Scenario: Valores inválidos
- **GIVEN** un contenido con, en un caso cada vez, `baseXp` 0, `baseXp` 2,5, `xpGrowth` −1 o `xpGrowth` 1,5
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se crea ninguna partida

#### Scenario: Curva plana
- **GIVEN** `baseXp` 3 y `xpGrowth` 0
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito y `xpToNext` vale 3 en todos los niveles

### Requirement: Nivel y XP iniciales
El sistema SHALL arrancar cada partida con el jugador en nivel 1, XP actual 0 y ninguna subida pendiente, y exponer
en el snapshot el nivel, la XP actual y `xpToNext` del nivel actual.

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con el contenido por defecto
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** el nivel vale 1, la XP actual 0 y la XP para el siguiente nivel 9

### Requirement: Subida de nivel con arrastre
El sistema SHALL sumar a la XP actual la XP de cada gema recogida (ver `xp-gems`): su valor más la bonificación de XP
efectiva b (`xpBonusPercent`, ver "Estadísticas de personaje nuevas" en `upgrades`; 0 sin mejoras). La XP es siempre
entera y la fracción de la bonificación se arrastra entre gemas: con un resto r de la partida (entero de 0 a 99, 0 al
crearla), cada gema de valor v suma ⌊(v × (100 + b) + r) / 100⌋ y deja como resto (v × (100 + b) + r) mod 100. Con b =
0 cada gema suma exactamente su valor. Mientras la XP actual sea ≥ `xpToNext(nivel)`, MUST restarse ese umbral, subir
el nivel en 1 y registrar una subida pendiente; la XP sobrante se conserva en el nivel nuevo. Nivel y XP se actualizan
en el mismo tick de la recogida. La XP no se pierde nunca ni es negativa.

#### Scenario: Por debajo del umbral
- **GIVEN** un jugador en nivel 1 con XP 0
- **WHEN** recoge gemas por un total de 4 XP
- **THEN** sigue en nivel 1 con XP 4 y XP para el siguiente nivel 5, sin subidas pendientes

#### Scenario: Umbral exacto
- **GIVEN** un jugador en nivel 1 con XP 4
- **WHEN** recoge una gema de valor 1 en el tick n
- **THEN** el snapshot del tick n muestra nivel 2, XP 0 y XP para el siguiente nivel 10
- **AND** hay 1 subida registrada en el tick n

#### Scenario: Arrastre del sobrante
- **GIVEN** un jugador en nivel 1 con XP 4
- **WHEN** recoge una gema de valor 4
- **THEN** queda en nivel 2 con XP 3 y XP para el siguiente nivel 10

#### Scenario: XP acumulada hasta el nivel 3
- **GIVEN** un jugador en nivel 1 con XP 0
- **WHEN** recoge, en ticks distintos, gemas por un total de 15 XP y elige una mejora en cada oferta
- **THEN** queda en nivel 3 con XP 0 y XP para el siguiente nivel 15

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

#### Scenario: Una gema que da dos niveles
- **GIVEN** un jugador en nivel 1 con XP 0 y una gema de valor 16 que recoge en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n muestra nivel 3, XP 1 y XP para el siguiente nivel 15
- **AND** hay 2 subidas pendientes y la partida está eligiendo mejora con la primera oferta abierta

#### Scenario: La segunda oferta tras la primera elección
- **GIVEN** la partida del escenario anterior en el tick n
- **WHEN** se elige una opción de la primera oferta
- **THEN** se abre inmediatamente una segunda oferta, el snapshot sigue en el tick n y la partida sigue eligiendo
- **AND** al elegir en la segunda la partida vuelve a en curso y el siguiente tick pedido es el n + 1

#### Scenario: Varias gemas que dan varios niveles
- **GIVEN** un jugador en nivel 1 con XP 4 y 12 gemas de valor 1 que recoge todas en el mismo tick
- **WHEN** se ejecuta ese tick
- **THEN** queda en nivel 3 con XP 1 (4 + 12 = 16 = 5 + 10 + 1) y hay 2 subidas pendientes

### Requirement: Sin nivel máximo
El sistema SHALL permitir subir de nivel sin límite durante la partida en este change; MUST NOT existir un nivel
máximo de partida.

#### Scenario: Nivel 50
- **GIVEN** un jugador en nivel 49 con XP 0, con todas las mejoras en su nivel máximo
- **WHEN** recoge gemas por 245 XP (`xpToNext(49)`)
- **THEN** queda en nivel 50 con XP 0 y XP para el siguiente nivel 250, y la partida sigue en curso

### Requirement: Barra de XP y nivel en la vista
La vista SHALL mostrar en todo momento una barra de XP cuyo relleno es XP actual / XP para el siguiente nivel del
último snapshot (de 0 a 1) y el número del nivel actual. La barra solo depende del snapshot: no cambia la simulación.
La barra y el nivel forman parte del HUD (ver `hud`).

#### Scenario: Barra vacía al empezar
- **GIVEN** el snapshot de una partida recién creada
- **WHEN** se pinta
- **THEN** la barra de XP tiene relleno 0 y el nivel mostrado es 1

#### Scenario: Relleno parcial
- **GIVEN** un snapshot con nivel 2, XP 3 y XP para el siguiente nivel 10
- **WHEN** se pinta
- **THEN** la barra tiene relleno 0,3 (error ≤ 0,001) y el nivel mostrado es 2

#### Scenario: Tras subir de nivel
- **GIVEN** un snapshot pintado con nivel 1 y XP 4, y el siguiente con nivel 2 y XP 0
- **WHEN** se pinta el segundo
- **THEN** la barra tiene relleno 0 y el nivel mostrado es 2

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

<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0019-flow-field (2026-11-24) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0024-split-progression-castle (2026-11-25) -->
