# Spec delta · leveling

<!-- Change 0020-enemy-behaviors. Recalibración del balance (tarea 6.2): con los comportamientos y los peligros, las
     palancas de comportamiento no bastaron para dejar a 0 los quietos supervivientes con el mapa vacío (semilla 43),
     así que, como permite `run-outcome`, también se toca la curva de XP: `xpGrowth` pasa de 3 a 4. Solo cambian los
     valores fijados del contenido por defecto; la regla y la curva de escenario no cambian. -->

## ADDED Requirements

<!-- Ninguno. -->

## MODIFIED Requirements

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

## REMOVED Requirements

<!-- Ninguno. -->
