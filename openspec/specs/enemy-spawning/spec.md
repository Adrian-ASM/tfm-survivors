# Enemy spawning · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Los enemigos aparecen en oleadas que crecen con el tiempo: un director gasta un presupuesto por tramos y los coloca fuera de la vista del jugador, dentro de la arena y con un tope de vivos.

## Requirements

### Requirement: Catálogo de tipos de enemigo
El sistema SHALL definir los tipos de enemigo exclusivamente desde contenido. Cada tipo tiene un identificador
único, una velocidad, un radio y un coste. El contenido por defecto MUST incluir exactamente los 3 tipos del
GDD: `bug`, `memory-leak` y `merge-conflict`. Los tipos solo se diferencian en esos valores.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el catálogo tiene 3 tipos con identificadores `bug`, `memory-leak` y `merge-conflict`
- **AND** cada uno tiene una velocidad > 0, un radio > 0 y un coste > 0

#### Scenario: Valores de cada tipo llegan al dominio
- **GIVEN** un tipo `bug` con `{ "speed": 90, "radius": 10, "cost": 1 }`
- **WHEN** se carga el contenido y aparece un enemigo `bug`
- **THEN** ese enemigo tiene radio 10 y se mueve a 90 unidades/s

### Requirement: Contenido de enemigos y oleadas validado
El sistema SHALL validar con zod los tipos de enemigo, la tabla de oleadas, la vista y los parámetros de spawn
antes de que lleguen al dominio. Un contenido inválido MUST impedir que la partida arranque, con un error que
nombre el campo inválido. Las reglas son las siguientes:
- `speed`, `radius` y `cost` son > 0.
- El diámetro de cada tipo cabe en la arena: 2 × `radius` ≤ min(ancho, alto).
- Los `id` de los tipos no se repiten.
- La tabla de oleadas tiene ≥ 1 tramo, el primero tiene `fromSecond` = 0 y los `fromSecond` son estrictamente
  crecientes.
- `budgetPerSecond` es ≥ 0.
- Cada tramo tiene ≥ 1 tipo en `types` y cada tipo citado existe en el catálogo.
- `maxAlive` y `maxAttempts` son enteros ≥ 1.
- `margin` y `minDistance` son ≥ 0.
- `width` y `height` de la vista son > 0.

#### Scenario: Oleada con un tipo inexistente
- **GIVEN** un tramo con `"types": ["bug", "segfault"]` y un catálogo sin `segfault`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `segfault`
- **AND** no se crea ninguna partida

#### Scenario: Velocidad cero
- **GIVEN** un tipo `bug` con `"speed": 0`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `speed`

#### Scenario: Radio que no cabe en la arena
- **GIVEN** un tipo con `"radius": 300` y una arena de 960 × 540
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `radius`

#### Scenario: Radio en el límite exacto
- **GIVEN** un tipo con `"radius": 270` y una arena de 960 × 540
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Identificador duplicado
- **GIVEN** un catálogo con dos tipos cuyo `id` es `bug`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `id`

#### Scenario: Primer tramo que no empieza en 0
- **GIVEN** una tabla de oleadas cuyo primer tramo tiene `"fromSecond": 5`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `fromSecond`

#### Scenario: Tramos desordenados o repetidos
- **GIVEN** tramos con `fromSecond` 0, 60 y 60
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `fromSecond`

#### Scenario: Tope de vivos no entero
- **GIVEN** `"maxAlive": 0` o `"maxAlive": 12.5`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `maxAlive`

### Requirement: Oleadas por tramos de tiempo
El sistema SHALL elegir en cada tick el tramo activo de la tabla de oleadas: el último cuyo `fromSecond` sea
≤ al tiempo de partida. El último tramo sigue activo hasta el final de la partida. Solo MUST aparecer enemigos de
los tipos permitidos en el tramo activo.

#### Scenario: Cambio de tramo
- **GIVEN** un tramo 0 con `types: ["bug"]` y un tramo 1 con `fromSecond` 30 y `types: ["memory-leak"]`, ambos
  con `budgetPerSecond` 1, y un tope de 200
- **WHEN** se ejecutan 3.600 ticks (60 s)
- **THEN** todos los enemigos aparecidos antes del tick 1.790 son `bug`
- **AND** todos los aparecidos después del tick 1.810 son `memory-leak`

#### Scenario: Un solo tramo
- **GIVEN** una tabla con un único tramo, `fromSecond` 0 y `types: ["bug"]`
- **WHEN** se ejecutan 36.000 ticks (10 min)
- **THEN** todos los enemigos aparecidos son `bug`

#### Scenario: Tramo sin presupuesto
- **GIVEN** un único tramo con `budgetPerSecond` 0
- **WHEN** se ejecutan 600 ticks
- **THEN** no hay ningún enemigo vivo

### Requirement: Director por presupuesto
El sistema SHALL acumular en cada tick un presupuesto de `budgetPerSecond × 1/60` del tramo activo. Funciona así:
- Mientras haya un tipo pendiente, se espera a que el presupuesto alcance su coste.
- El tipo pendiente MUST elegirse con el `RandomGenerator` entre los tipos permitidos del tramo activo.
- Cuando el presupuesto acumulado alcanza el coste del tipo pendiente, aparece un enemigo de ese tipo, se resta
  su coste y se elige un nuevo tipo pendiente.
- En un mismo tick pueden aparecer varios enemigos si el presupuesto lo permite.
- Al cambiar de tramo, el presupuesto acumulado se conserva y el tipo pendiente se vuelve a elegir entre los
  tipos del nuevo tramo.
- Un enemigo no se mueve en el tick en que aparece.

#### Scenario: Ritmo constante con coste 1
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["bug"]`, `bug` con coste 1 y un tope de 200
- **WHEN** se ejecutan 615 ticks (10,25 s)
- **THEN** hay exactamente 10 enemigos vivos

#### Scenario: El coste retrasa la aparición
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["memory-leak"]`, `memory-leak` con coste 3
- **WHEN** se ejecutan 175 ticks y después 10 ticks más
- **THEN** tras 175 ticks hay 0 enemigos y tras 185 ticks hay exactamente 1

#### Scenario: Varios spawns en un tick
- **GIVEN** un único tramo con `budgetPerSecond` 630 y `types: ["bug"]`, `bug` con coste 1 y un tope de 200
- **WHEN** se ejecuta 1 tick
- **THEN** hay exactamente 10 enemigos vivos

#### Scenario: Mezcla de tipos
- **GIVEN** un único tramo con `types: ["bug", "memory-leak", "merge-conflict"]`, `budgetPerSecond` 2,
  semilla 1 y un tope de 200
- **WHEN** se ejecutan 36.000 ticks
- **THEN** aparece ≥ 1 enemigo de cada uno de los 3 tipos

#### Scenario: Oleadas que crecen con el contenido por defecto
- **GIVEN** la tabla de oleadas por defecto
- **WHEN** se recorren sus tramos en orden
- **THEN** el `budgetPerSecond` de cada tramo es ≥ el del tramo anterior

### Requirement: Tope de enemigos vivos
El sistema SHALL impedir que el número de enemigos vivos supere `maxAlive` (200 por defecto). Mientras haya
`maxAlive` enemigos vivos, no MUST aparecer ninguno más. Lo que pasa con el presupuesto cuando el número de vivos
baja del tope se especificará en 0003, cuando existan muertes.

#### Scenario: Se alcanza el tope
- **GIVEN** un único tramo con `budgetPerSecond` 1.000 y `types: ["bug"]`, `bug` con coste 1 y `maxAlive` 200
- **WHEN** se ejecutan 13 ticks
- **THEN** hay exactamente 200 enemigos vivos

#### Scenario: El tope se mantiene
- **GIVEN** la partida del escenario anterior tras 13 ticks
- **WHEN** se ejecutan 600 ticks más
- **THEN** siguen vivos exactamente 200 enemigos

#### Scenario: Tope mínimo
- **GIVEN** `maxAlive` 1 y un único tramo con `budgetPerSecond` 10
- **WHEN** se ejecutan 600 ticks
- **THEN** hay exactamente 1 enemigo vivo

### Requirement: Posición de aparición fuera de la vista
El sistema SHALL colocar cada enemigo nuevo así:
1. Toma un punto a una distancia del jugador igual al radio del anillo, en un ángulo elegido con el
   `RandomGenerator`. El radio del anillo es la mitad de la diagonal de la vista más `margin`:
   √(960² + 540²) / 2 + 32 ≈ 582,727 con los valores por defecto.
2. Recorta ese punto a la arena con la misma regla que al jugador, de modo que el centro quede en
   [radio, ancho − radio] × [radio, alto − radio] usando el radio del enemigo.
3. Acepta la posición solo si, tras el recorte, su distancia al jugador es ≥ `minDistance`.

Si la posición no se acepta, se repite el proceso hasta un total de `maxAttempts` intentos por enemigo. Si ningún
intento es válido, ese enemigo no aparece en este tick, el presupuesto no se gasta y el tipo pendiente se
mantiene. El sistema MUST NOT colocar nunca un enemigo a menos de `minDistance` del jugador.

#### Scenario: Arena mayor que la vista
- **GIVEN** una arena de 4.000 × 4.000, el jugador en (2.000, 2.000), una vista de 960 × 540 y `margin` 32
- **WHEN** aparecen 100 enemigos
- **THEN** cada uno está a 582,727 ± 0,001 unidades del jugador
- **AND** ninguno está dentro del rectángulo de la vista centrado en el jugador

#### Scenario: Arena igual a la vista
- **GIVEN** la arena de 960 × 540, el jugador en (480, 270) y el contenido de spawn por defecto
- **WHEN** aparecen 200 enemigos
- **THEN** el centro de cada uno queda en [radio, 960 − radio] × [radio, 540 − radio]
- **AND** cada uno está a ≥ 200 unidades del jugador
- **AND** cada uno toca un borde de la arena: x = radio, x = 960 − radio, y = radio o y = 540 − radio

#### Scenario: Jugador en una esquina
- **GIVEN** la arena de 960 × 540, el jugador quieto en (16, 16) y el contenido de spawn por defecto
- **WHEN** se ejecutan 3.600 ticks con un tramo de `budgetPerSecond` 5
- **THEN** cada enemigo aparecido está dentro de la arena y a ≥ 200 unidades del jugador en el tick de su
  aparición

#### Scenario: Ninguna posición válida
- **GIVEN** la arena de 960 × 540, `minDistance` 2.000 (mayor que la diagonal de la arena) y `maxAttempts` 8
- **WHEN** se ejecutan 600 ticks con un tramo de `budgetPerSecond` 5
- **THEN** no hay ningún enemigo vivo y la partida sigue avanzando sin error
- **AND** en cada tick se hacen como mucho 8 intentos de posición

#### Scenario: El presupuesto no se pierde al aplazar
- **GIVEN** un tramo con `budgetPerSecond` 1 y coste 1, y un generador aleatorio de prueba con el que todos los
  intentos son inválidos en los ticks 1 a 120 y todos son válidos a partir del tick 121
- **WHEN** se ejecuta el tick 121
- **THEN** aparecen 2 enemigos en ese tick

#### Scenario: Partida larga sin spawns ilegales
- **GIVEN** el contenido por defecto, semilla 7 y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks (10 min)
- **THEN** ningún enemigo aparece fuera de la arena ni a menos de 200 unidades del jugador

<!-- historial: 0002-enemy-spawning (2026-11-19) -->
