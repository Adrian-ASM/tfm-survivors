# Spec delta · leveling

<!-- Change 0005-xp-and-level-up. Capacidad nueva: XP del jugador, nivel, curva de XP, arrastre del sobrante y cola de
     subidas. Curva por defecto, PROVISIONAL, A MEDIR EN APPLY: xpToNext(n) = baseXp + xpGrowth · (n − 1) con
     baseXp 5 y xpGrowth 5 → 5, 10, 15, 20… (nivel 2 con 5 XP acumulados, nivel 3 con 15, nivel 4 con 30).
     "XP actual" es la XP acumulada dentro del nivel actual, no la total. Cada subida de nivel abre una oferta de
     mejoras según `upgrades`. Si se cambia un valor en apply, búsquese en todas las specs. -->

## ADDED Requirements

### Requirement: Curva de XP validada
El sistema SHALL leer del fichero de progresión de `content/`, validados con zod antes de llegar al dominio, los
parámetros de la curva `baseXp` (entero ≥ 1) y `xpGrowth` (entero ≥ 0). La XP necesaria para pasar del nivel n al
n + 1 MUST ser `xpToNext(n) = baseXp + xpGrowth · (n − 1)`. Un valor ausente, no entero, fuera de rango o un campo
desconocido MUST impedir que la partida arranque con un error que nombre el campo.

#### Scenario: Curva por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** `baseXp` vale 5 y `xpGrowth` vale 5 (provisional, a medir en apply)
- **AND** `xpToNext` vale 5 en el nivel 1, 10 en el 2, 15 en el 3 y 250 en el 50

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
- **THEN** el nivel vale 1, la XP actual 0 y la XP para el siguiente nivel 5

### Requirement: Subida de nivel con arrastre
El sistema SHALL sumar a la XP actual el valor de cada gema recogida (ver `xp-gems`). Mientras la XP actual sea
≥ `xpToNext(nivel)`, MUST restarse ese umbral, subir el nivel en 1 y registrar una subida pendiente; la XP sobrante
se conserva en el nivel nuevo. Nivel y XP se actualizan en el mismo tick de la recogida. La XP no se pierde nunca
ni es negativa.

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

### Requirement: Varias subidas en un tick
El sistema SHALL encolar todas las subidas de nivel que ocurran en un mismo tick, por una gema grande o por varias
gemas a la vez, y resolverlas una detrás de otra: cada subida pendiente abre su propia oferta de mejoras (ver
`upgrades`) y la siguiente se abre tras elegir en la anterior, sin ejecutar ticks entre ambas. El snapshot ya muestra
el nivel final y la XP sobrante desde el tick de la recogida.

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
El resto del HUD (vida, tiempo, inventario) no forma parte de este change.

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
