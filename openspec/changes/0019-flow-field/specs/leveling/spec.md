# Spec delta · leveling

<!-- Change 0019-flow-field. Calibración del balance (decisión del usuario, 2026-11-24: solo la curva de XP).
     Con la navegación por el mapa el bot de referencia bajó a 18/50. Sin tocar el presupuesto de oleadas ni
     `player.speed` (gate de la propuesta), la curva pasa de baseXp 5 / xpGrowth 5 a baseXp 9 / xpGrowth 3: más XP para
     la primera subida y subidas más baratas después, que favorecen a quien recoge gemas (el bot) frente al quieto.
     Medido en apply: 26/50 victorias del bot v2 (semillas 1..50), 0 quietos supervivientes con el mapa generado y con
     el vacío, plazos del quieto intactos. -->

## MODIFIED Requirements

### Requirement: Curva de XP validada
El sistema SHALL leer del fichero de progresión de `content/`, validados con zod antes de llegar al dominio, los
parámetros de la curva `baseXp` (entero ≥ 1) y `xpGrowth` (entero ≥ 0). La XP necesaria para pasar del nivel n al
n + 1 MUST ser `xpToNext(n) = baseXp + xpGrowth · (n − 1)`. Un valor ausente, no entero, fuera de rango o un campo
desconocido MUST impedir que la partida arranque con un error que nombre el campo.

El contenido por defecto MUST fijar `baseXp` 9 y `xpGrowth` 3 (change 0019): es la palanca de calibración elegida para
compensar el campo de flujo de los enemigos sin tocar las oleadas ni `player.speed` (ver "Partida ganable y perdible
con el contenido por defecto" en `run-outcome`). Los escenarios de "Subida de nivel con arrastre", "Varias subidas en
un tick", "Sin nivel máximo" y "Barra de XP y nivel en la vista" usan una **curva de escenario** explícita con
`baseXp` 5 y `xpGrowth` 5 (la anterior por defecto), no el contenido por defecto; sus números no cambian.

#### Scenario: Curva por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** `baseXp` vale 9 y `xpGrowth` vale 3
- **AND** `xpToNext` vale 9 en el nivel 1, 12 en el 2, 15 en el 3 y 156 en el 50

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

<!-- historial: 0019-flow-field (pendiente de archivar) -->
