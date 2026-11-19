# Spec delta · upgrades

<!-- Change 0005-xp-and-level-up. Capacidad nueva: catálogo de mejoras en `content/upgrades.json`, nivel de cada
     mejora, oferta de 3 mejoras distintas al subir de nivel (azar de la semilla), elección por índice y efectos
     aditivos sobre la base de contenido. Catálogo por defecto, PROVISIONAL, A MEDIR EN APPLY (nombres, incrementos
     y `maxLevel` 5 en todas):
       strict-rules   Linter · damage        +3        hard-asserts   Tests · damage          +2
       fast-ci        Linter · cooldownTicks −4        watch-mode     Tests · cooldownTicks   −12
       wide-analysis  Linter · range         +60       coverage       Tests · radius (pulso)  +15
       guardrail      Jugador · maxHealth    +20       shortcuts      Jugador · speed         +20
       context-window Jugador · pickupRadius +32
     "Estadística efectiva" = valor base de contenido + nivel de la mejora × incremento por nivel, sumando todas las
     mejoras que afectan a esa estadística. El mecanismo concreto (y su ADR) es del design.
     Salvo que se diga otra cosa, los escenarios parten del contenido por defecto y de una partida sin mejoras. -->

## ADDED Requirements

### Requirement: Catálogo de mejoras validado
El sistema SHALL definir las mejoras exclusivamente en `content/upgrades.json`, validado con zod antes de llegar al
dominio. El fichero tiene una lista con ≥ 1 mejora. Cada mejora tiene:
- `id`: texto no vacío, único en el catálogo;
- `name` y `description`: textos no vacíos;
- un objetivo: un arma, por su `id` de `content/weapons.json`, o el jugador;
- `stat`: la estadística que cambia. Para un arma: `damage`, `cooldownTicks`, `range` (solo armas con criterio
  `nearest-in-range`) o `radius` (radio del criterio, solo armas con criterio `any-in-radius`). Para el jugador:
  `maxHealth`, `speed` o `pickupRadius`;
- `perLevel`: incremento por nivel, número finito distinto de 0; entero si `stat` es `damage` o `cooldownTicks`;
- `maxLevel`: entero ≥ 1.

Con todas las mejoras de una misma estadística en su `maxLevel`, la estadística efectiva MUST seguir en su rango
válido: `damage` ≥ 1, `cooldownTicks` ≥ 1 y `range`, `radius`, `maxHealth`, `speed` y `pickupRadius` > 0. Un campo
desconocido o ausente, un valor fuera de rango, un `id` repetido, un arma inexistente, una estadística incompatible
con el objetivo o un nivel máximo que saque una estadística de rango MUST impedir que la partida arranque con un
error explícito que nombre el campo, la mejora o la regla incumplida.

#### Scenario: Catálogo por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** hay exactamente 9 mejoras, con ids `strict-rules`, `fast-ci`, `wide-analysis`, `hard-asserts`,
  `watch-mode`, `coverage`, `guardrail`, `shortcuts` y `context-window`
- **AND** 6 tienen como objetivo un arma y 3 al jugador, todas con `maxLevel` 5 y los incrementos de la tabla de
  cabecera (provisional, a medir en apply)
- **AND** ninguna añade armas nuevas

#### Scenario: Identificador repetido o lista vacía
- **GIVEN** un catálogo con dos mejoras de `id` `fast-ci`, y en otro caso una lista vacía
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error explícito

#### Scenario: Arma inexistente
- **GIVEN** una mejora con objetivo el arma `refactor`, que no existe en `content/weapons.json`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `refactor`

#### Scenario: Estadística incompatible
- **GIVEN** una mejora de `range` para `tests` (criterio `any-in-radius`), y en otros casos una de `radius` para
  `linter`, una de `pickupRadius` para un arma y una de `damage` para el jugador
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error explícito que nombra la mejora

#### Scenario: Nivel máximo que saca la cadencia de rango
- **GIVEN** la mejora `fast-ci` con `perLevel` −6 y `maxLevel` 5 sobre el Linter de `cooldownTicks` 30
  (30 − 30 = 0)
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `fast-ci` y `cooldownTicks`

#### Scenario: Límite exacto de la cadencia
- **GIVEN** la mejora `fast-ci` con `perLevel` −29 y `maxLevel` 1 (30 − 29 = 1)
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Suma de varias mejoras sobre la misma estadística
- **GIVEN** dos mejoras de `cooldownTicks` del Linter con `perLevel` −4 y `maxLevel` 4 cada una (30 − 32 < 1)
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error explícito que nombra `cooldownTicks`

#### Scenario: Valores inválidos
- **GIVEN** una mejora con, en un caso cada vez, `perLevel` 0, `maxLevel` 0, `maxLevel` 2,5, `perLevel` 1,5 en
  `damage`, `name` vacío o un campo extra `rarity`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

### Requirement: Nivel de las mejoras y disponibilidad
El sistema SHALL llevar, por partida, el nivel de cada mejora del catálogo, que empieza en 0 y sube en 1 cada vez que
se elige, hasta su `maxLevel`. Una mejora está disponible si y solo si su nivel es menor que su `maxLevel`. El
snapshot MUST exponer los niveles de las mejoras adquiridas (nivel ≥ 1), en el orden del catálogo.

#### Scenario: Ninguna adquirida al empezar
- **GIVEN** una partida recién creada
- **WHEN** se lee el snapshot
- **THEN** la lista de mejoras adquiridas está vacía y las 9 mejoras están disponibles

#### Scenario: Mejora en su nivel máximo
- **GIVEN** una partida en la que `fast-ci` se ha elegido 5 veces
- **WHEN** se abre cualquier oferta posterior
- **THEN** `fast-ci` figura con nivel 5 en el snapshot y no aparece en la oferta

### Requirement: Oferta de mejoras
El sistema SHALL abrir una oferta por cada subida de nivel pendiente (ver `leveling`) cuando haya ≥ 1 mejora
disponible. Con ≥ 3 disponibles, la oferta MUST tener exactamente 3 mejoras distintas elegidas con el
`RandomGenerator` de la partida entre las disponibles; con 2 o 1 disponibles, MUST tener exactamente esas. No hay
cancelación, reroll ni descarte. Abrir la oferta es el único paso nuevo que consume azar; su punto en el orden del
tick está en `simulation-loop`. Cada opción del snapshot incluye id, nombre, descripción, nivel actual y nivel
siguiente (actual + 1). Mientras haya una oferta abierta la partida está eligiendo mejora (ver `run-state`).

#### Scenario: Primera oferta
- **GIVEN** una partida con el contenido por defecto en nivel 1 con XP 4
- **WHEN** recoge una gema de valor 1 en el tick n
- **THEN** el snapshot del tick n tiene una oferta de 3 opciones con ids distintos del catálogo, cada una con nivel
  actual 0 y siguiente 1, y su nombre y descripción del contenido

#### Scenario: Oferta reproducible
- **GIVEN** dos partidas con la semilla 42, los mismos inputs y las mismas elecciones
- **WHEN** ambas abren sus 10 primeras ofertas
- **THEN** las ofertas son iguales, opción a opción y en el mismo orden

#### Scenario: Todas las mejoras pueden salir
- **GIVEN** la semilla 1 y una partida en la que, en cada oferta, se elige la opción 0
- **WHEN** se abren las ofertas hasta que todas las mejoras han llegado a su nivel máximo
- **THEN** cada una de las 9 mejoras ha aparecido en ≥ 1 oferta y ninguna oferta repite una mejora

#### Scenario: Dos disponibles
- **GIVEN** un catálogo en el que solo `guardrail` y `shortcuts` están por debajo de su nivel máximo
- **WHEN** se abre una oferta
- **THEN** la oferta tiene exactamente 2 opciones: `guardrail` y `shortcuts`, en algún orden

#### Scenario: Una disponible
- **GIVEN** un catálogo en el que solo `coverage` está por debajo de su nivel máximo
- **WHEN** se abre una oferta
- **THEN** la oferta tiene exactamente 1 opción, `coverage`

#### Scenario: Ninguna disponible
- **GIVEN** una partida con todas las mejoras en su nivel máximo, en nivel 7 con XP a 1 del umbral
- **WHEN** recoge una gema de valor 1 en el tick n
- **THEN** el snapshot del tick n muestra nivel 8, sin oferta y con la partida en curso
- **AND** el tick n + 1 se ejecuta con normalidad

#### Scenario: La disponibilidad se recalcula entre ofertas encoladas
- **GIVEN** 2 subidas pendientes y un catálogo en el que solo `coverage` está disponible, a 1 nivel de su máximo
- **WHEN** se elige `coverage` en la primera oferta
- **THEN** no se abre segunda oferta (0 disponibles) y la partida vuelve a en curso

### Requirement: Elección de mejora
El sistema SHALL ofrecer un caso de uso para elegir una opción de la oferta abierta por su índice, de 0 a k − 1
siendo k el número de opciones. Una elección válida sube en 1 el nivel de esa mejora, aplica su efecto, cierra la
oferta y, si quedan subidas pendientes, abre la siguiente oferta; si no, la partida vuelve a en curso. Elegir sin
oferta abierta (partida en curso o terminada) o con un índice que no sea un entero en [0, k − 1] MUST devolver un
error tipado (`Result`), sin cambiar el snapshot ni el estado del `RandomGenerator`.

#### Scenario: Elección válida
- **GIVEN** una oferta abierta con `fast-ci`, `guardrail` y `coverage`, en ese orden
- **WHEN** se elige el índice 1
- **THEN** `guardrail` pasa a nivel 1, la oferta se cierra y la partida vuelve a en curso
- **AND** `fast-ci` y `coverage` siguen en nivel 0

#### Scenario: Índice fuera de rango
- **GIVEN** una oferta abierta con 3 opciones, y en otro caso con 2
- **WHEN** se elige el índice 3 (y −1, y 1,5), y en el segundo caso el índice 2
- **THEN** cada elección devuelve un error tipado y el snapshot y el estado del azar no cambian
- **AND** la oferta sigue abierta y admite después una elección válida

#### Scenario: Sin oferta abierta
- **GIVEN** una partida en curso sin oferta, y en otro caso una partida terminada
- **WHEN** se elige el índice 0
- **THEN** se devuelve un error tipado y el snapshot no cambia

### Requirement: Efectos de las mejoras
El sistema SHALL aplicar el efecto de una mejora en el momento de elegirla, de modo que rige desde el siguiente tick
ejecutado. Cada estadística afectada pasa a ser su valor efectivo (base + suma de nivel × `perLevel` de las mejoras
que la cambian). El contenido base no cambia: una partida nueva con el mismo contenido empieza sin mejoras. Reglas
por estadística:
- `damage` de un arma: lo usan los disparos desde el siguiente tick (un proyectil ya en vuelo conserva el daño con
  que se creó, ver `auto-weapons`);
- `cooldownTicks` de un arma: el arma conserva su estado de carga actual; el nuevo intervalo rige desde su siguiente
  disparo;
- `range` y `radius` del criterio de un arma: la selección de objetivo y el pulso los usan desde el siguiente tick
  (un pulso ya visible conserva su radio);
- `maxHealth` del jugador: sube la vida máxima y la vida actual en la misma cantidad (ver `player-health`);
- `speed` y `pickupRadius` del jugador: rigen desde el siguiente tick.

#### Scenario: Más daño del Linter
- **GIVEN** `strict-rules` en nivel 1 (Linter con `damage` 9)
- **WHEN** un proyectil del Linter creado después de la elección impacta a un bug con vida 10
- **THEN** el bug queda con vida 1

#### Scenario: Mejoras acumuladas que matan de un impacto
- **GIVEN** `strict-rules` en nivel 5 (Linter con `damage` 21)
- **WHEN** un proyectil del Linter impacta a un bug con vida 10 y otro a un merge-conflict con vida 20
- **THEN** ambos quedan dados de baja con un solo impacto

#### Scenario: Cadencia mejorada sin reiniciar la carga
- **GIVEN** un objetivo permanente a 50 px que no muere y un Linter que dispara en el tick 1 (cargado de nuevo en el
  tick 31), y `fast-ci` elegido durante una oferta abierta en el tick 10 (`cooldownTicks` 26)
- **WHEN** se ejecutan los ticks hasta el 90
- **THEN** el Linter dispara exactamente en los ticks 1, 31, 57 y 83

#### Scenario: Más alcance
- **GIVEN** `wide-analysis` en nivel 1 (`range` 460) y un único enemigo vivo a 450 px del jugador
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es ese enemigo y se crea 1 proyectil

#### Scenario: Más radio del pulso
- **GIVEN** `coverage` en nivel 1 (`radius` 105) y dos bugs de radio 10 a distancias 114 y 115 del jugador
- **WHEN** Tests dispara
- **THEN** el de 114 pierde 4 de vida y el de 115 no pierde vida

#### Scenario: Más daño de Tests
- **GIVEN** `hard-asserts` en nivel 1 (Tests con `damage` 6) y un bug con vida 10 en el radio del pulso
- **WHEN** Tests dispara
- **THEN** el bug queda con vida 4

#### Scenario: Cadencia de Tests mejorada
- **GIVEN** `watch-mode` en nivel 1 (`cooldownTicks` 78) elegido antes del tick 1 y un objetivo permanente en el
  radio que no muere
- **WHEN** se ejecutan 157 ticks
- **THEN** Tests dispara exactamente en los ticks 1, 79 y 157

#### Scenario: Más velocidad
- **GIVEN** `shortcuts` en nivel 1 (`speed` 220) y un jugador en (480, 270)
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (700, 270) con un error ≤ 0,001

#### Scenario: Más radio de recogida
- **GIVEN** `pickupRadius` base 64, `context-window` en nivel 1 (efectivo 96), un jugador quieto en (480, 270) y una gema en
  (570, 270) (distancia 90)
- **WHEN** se ejecuta 1 tick
- **THEN** la gema está atraída y en (564, 270)

#### Scenario: El contenido base no cambia
- **GIVEN** una partida con `strict-rules` en nivel 3
- **WHEN** se crea otra partida con el mismo contenido
- **THEN** la nueva empieza sin mejoras y su Linter tiene `damage` 6

### Requirement: Overlay de elección
La vista SHALL mostrar, mientras el snapshot tenga una oferta abierta, un overlay con una carta por opción, en el
orden de la oferta, con su nombre, su descripción y su nivel actual → siguiente. Pulsar la tecla 1, 2 o 3, o hacer
clic en una carta, MUST elegir la opción de índice 0, 1 o 2 respectivamente, a través del caso de uso de elección.
Una tecla sin carta (p. ej. 3 con 2 opciones) no hace nada. Sin oferta abierta el overlay no se ve y las teclas 1, 2
y 3 no hacen nada. Mientras el overlay se ve, el input de movimiento no llega a la simulación.

#### Scenario: Tres cartas
- **GIVEN** un snapshot con una oferta de 3 opciones
- **WHEN** se pinta
- **THEN** el overlay es visible con 3 cartas, cada una con el nombre, la descripción y "nivel actual → siguiente"
  de su opción, en el orden de la oferta

#### Scenario: Elegir con tecla
- **GIVEN** el overlay visible con 3 cartas
- **WHEN** se pulsa la tecla 2
- **THEN** se elige la opción de índice 1 y, sin más subidas pendientes, el overlay deja de verse

#### Scenario: Elegir con clic
- **GIVEN** el overlay visible con 3 cartas
- **WHEN** se hace clic en la tercera
- **THEN** se elige la opción de índice 2

#### Scenario: Menos cartas
- **GIVEN** un snapshot con una oferta de 2 opciones
- **WHEN** se pinta y se pulsa la tecla 3
- **THEN** el overlay muestra 2 cartas, no se elige nada y el overlay sigue visible

#### Scenario: Sin oferta
- **GIVEN** un snapshot sin oferta
- **WHEN** se pinta y se pulsan las teclas 1, 2 y 3
- **THEN** el overlay no es visible y la partida no cambia por esas teclas

### Requirement: Progresión observable en el juego
El sistema SHALL permitir, en el juego real y con el contenido por defecto, recorrer el bucle completo matar →
recoger gemas → subir de nivel → elegir mejora → seguir jugando.

#### Scenario: Primera subida en el núcleo
- **GIVEN** el contenido por defecto, semilla 7 e input (0, 0) en todos los ticks
- **WHEN** se ejecutan ticks hasta el 3.600 (60 s), eligiendo la opción 0 en cada oferta
- **THEN** se abre ≥ 1 oferta en algún tick ≤ 3.600 (plazo provisional, a medir en apply)

#### Scenario: Recorrido en el navegador
- **GIVEN** la build de producción servida con `?seed=7`
- **WHEN** una prueba E2E deja jugar sin input hasta que aparece el overlay y pulsa la tecla 1
- **THEN** antes del overlay el nivel mostrado es 1; tras pulsar, el overlay desaparece, el nivel mostrado es 2 y
  los ticks del snapshot vuelven a avanzar
