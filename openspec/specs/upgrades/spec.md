# Upgrades · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Los dos catálogos de mejoras (personaje por XP y arma por oro), la oferta de 3 de personaje al subir
de nivel, la elección y los efectos sobre las estadísticas de armas y jugador.


## Requirements

### Requirement: Catálogo de mejoras validado
El sistema SHALL definir las mejoras exclusivamente en `content/*.json` (los dos catálogos de "Dos catálogos de
mejoras"), validados con zod antes de llegar al dominio. Cada catálogo tiene ≥ 1 mejora. Cada mejora tiene:
- `id`: texto no vacío, único entre los dos catálogos;
- `name` y `description`: textos no vacíos;
- un objetivo: un arma, por su `id` de `content/weapons.json` (catálogo de arma), o el jugador (catálogo de
  personaje);
- `stat`: la estadística que cambia. Para un arma: `damage`, `cooldownTicks`, `range` (solo armas con criterio
  `nearest-in-range`) o `radius` (radio del criterio, solo armas con criterio `any-in-radius`). Para el jugador:
  `maxHealth`, `speed`, `pickupRadius` o una de "Estadísticas de personaje nuevas";
- `perLevel`: incremento por nivel, número finito distinto de 0; entero si `stat` es `damage`, `cooldownTicks` o una
  de "Estadísticas de personaje nuevas";
- `maxLevel`: entero ≥ 1;
- solo en el catálogo de arma, el precio por nivel (ver "Contenido de la tienda validado" en `castle-shop`).

Con todas las mejoras de una misma estadística en su `maxLevel`, la estadística efectiva MUST seguir en su rango
válido: `damage` ≥ 1, `cooldownTicks` ≥ 1, `range`, `radius`, `maxHealth`, `speed` y `pickupRadius` > 0, y los rangos
de "Estadísticas de personaje nuevas". Un campo desconocido o ausente, un valor fuera de rango, un `id` repetido, un
arma inexistente, una estadística incompatible con el objetivo, una mejora en el catálogo equivocado o un nivel máximo
que saque una estadística de rango MUST impedir que la partida arranque con un error explícito que nombre el campo, la
mejora o la regla incumplida.

#### Scenario: Catálogo por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** hay exactamente 15 mejoras entre los dos catálogos: 9 de personaje y 6 de arma (ver "Catálogos por
  defecto")
- **AND** las 6 de arma y `guardrail`, `shortcuts` y `context-window` tienen `maxLevel` 5 y los incrementos de antes
  del change; las 6 de personaje nuevas, los `perLevel` y `maxLevel` del contenido

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
El sistema SHALL llevar, por partida, el nivel de cada mejora de los dos catálogos, que empieza en 0 y sube en 1 cada
vez que se elige (personaje) o se compra (arma), hasta su `maxLevel`. Una mejora de personaje está disponible para la
oferta si y solo si su nivel es menor que su `maxLevel`; las mejoras de arma nunca están disponibles para la oferta. El
snapshot MUST exponer los niveles de las mejoras adquiridas (nivel ≥ 1) de los dos catálogos, primero las de
personaje y después las de arma, cada grupo en el orden de su catálogo.

#### Scenario: Ninguna adquirida al empezar
- **GIVEN** una partida recién creada
- **WHEN** se lee el snapshot
- **THEN** la lista de mejoras adquiridas está vacía y las 9 mejoras de personaje están disponibles

#### Scenario: Mejora en su nivel máximo
- **GIVEN** una partida en la que `shortcuts` se ha elegido 5 veces
- **WHEN** se abre cualquier oferta posterior
- **THEN** `shortcuts` figura con nivel 5 en el snapshot y no aparece en la oferta

#### Scenario: Adquiridas de los dos catálogos
- **GIVEN** una partida con `scholar` elegida 1 vez, `guardrail` 2 veces y `fast-ci` comprada 1 vez
- **WHEN** se lee el snapshot
- **THEN** la lista de mejoras adquiridas es `guardrail` 2, `scholar` 1 y `fast-ci` 1, en ese orden

### Requirement: Oferta de mejoras
El sistema SHALL abrir una oferta por cada subida de nivel pendiente (ver `leveling`) cuando haya ≥ 1 mejora de
personaje disponible. Con ≥ 3 disponibles, la oferta MUST tener exactamente 3 mejoras distintas elegidas con el
`RandomGenerator` de la partida entre las disponibles; con 2 o 1 disponibles, MUST tener exactamente esas. Una oferta
MUST NOT contener mejoras de arma. No hay cancelación, reroll ni descarte. Abrir la oferta es el único paso que consume
azar de la partida fuera del director; su punto en el orden del tick está en `simulation-loop`. Cada opción del
snapshot incluye id, nombre, descripción, nivel actual y nivel siguiente (actual + 1). Mientras haya una oferta abierta
la partida está eligiendo mejora (ver `run-state`). Una subida pendiente sin ninguna mejora de personaje disponible no
abre oferta: cura al jugador (ver "Curación por subida sin mejoras" en `leveling`).

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
- **WHEN** se abren las ofertas hasta que todas las mejoras de personaje han llegado a su nivel máximo
- **THEN** cada una de las 9 mejoras de personaje ha aparecido en ≥ 1 oferta, ninguna oferta repite una mejora y
  ninguna oferta contiene una mejora de arma

#### Scenario: Dos disponibles
- **GIVEN** un catálogo en el que solo `guardrail` y `shortcuts` están por debajo de su nivel máximo
- **WHEN** se abre una oferta
- **THEN** la oferta tiene exactamente 2 opciones: `guardrail` y `shortcuts`, en algún orden

#### Scenario: Una disponible
- **GIVEN** un catálogo de personaje en el que solo `context-window` está por debajo de su nivel máximo
- **WHEN** se abre una oferta
- **THEN** la oferta tiene exactamente 1 opción, `context-window`

#### Scenario: Ninguna disponible
- **GIVEN** una partida con todas las mejoras de personaje en su nivel máximo, en nivel 7 con XP a 1 del umbral, vida
  50 de 100 y una curación por subida del 10 % (valor de escenario)
- **WHEN** recoge una gema de valor 1 en el tick n
- **THEN** el snapshot del tick n muestra nivel 8, sin oferta, con la partida en curso y vida 60
- **AND** el tick n + 1 se ejecuta con normalidad

#### Scenario: La disponibilidad se recalcula entre ofertas encoladas
- **GIVEN** 2 subidas pendientes, vida 50 de 100, una curación por subida del 10 % y un catálogo de personaje en el
  que solo `context-window` está disponible, a 1 nivel de su máximo
- **WHEN** se elige `context-window` en la primera oferta
- **THEN** no se abre segunda oferta (0 disponibles), la segunda subida cura (vida 60) y la partida vuelve a en curso

#### Scenario: Mejoras de arma fuera de la oferta
- **GIVEN** las semillas 1 a 50, input (0, 0) y la política de elección fija
- **WHEN** se abren todas las ofertas hasta el tick 10.800 o el fin de la partida
- **THEN** ninguna opción de ninguna oferta tiene un id del catálogo de arma

### Requirement: Elección de mejora
El sistema SHALL ofrecer un caso de uso para elegir una opción de la oferta abierta por su índice, de 0 a k − 1
siendo k el número de opciones. Una elección válida sube en 1 el nivel de esa mejora, aplica su efecto, cierra la
oferta y, si quedan subidas pendientes, abre la siguiente oferta o, sin mejoras disponibles, cura por cada una (ver
"Curación por subida sin mejoras" en `leveling`); si no quedan, la partida vuelve a en curso. Elegir sin oferta abierta
(partida en curso, en tienda o terminada) o con un índice que no sea un entero en [0, k − 1] MUST devolver un error
tipado (`Result`), sin cambiar el snapshot ni el estado del `RandomGenerator`.

#### Scenario: Elección válida
- **GIVEN** una oferta abierta con `shortcuts`, `guardrail` y `armor`, en ese orden
- **WHEN** se elige el índice 1
- **THEN** `guardrail` pasa a nivel 1, la oferta se cierra y la partida vuelve a en curso
- **AND** `shortcuts` y `armor` siguen en nivel 0

#### Scenario: Índice fuera de rango
- **GIVEN** una oferta abierta con 3 opciones, y en otro caso con 2
- **WHEN** se elige el índice 3 (y −1, y 1,5), y en el segundo caso el índice 2
- **THEN** cada elección devuelve un error tipado y el snapshot y el estado del azar no cambian
- **AND** la oferta sigue abierta y admite después una elección válida

#### Scenario: Sin oferta abierta
- **GIVEN** una partida en curso sin oferta, otra en tienda y otra terminada
- **WHEN** se elige el índice 0
- **THEN** se devuelve un error tipado y el snapshot no cambia

### Requirement: Efectos de las mejoras
El sistema SHALL aplicar el efecto de una mejora en el momento de elegirla (personaje) o comprarla (arma), de modo que
rige desde el siguiente tick ejecutado. Cada estadística afectada pasa a ser su valor efectivo (base + suma de nivel ×
`perLevel` de las mejoras que la cambian). El contenido base no cambia: una partida nueva con el mismo contenido
empieza sin mejoras. Reglas por estadística:
- `damage` de un arma: lo usan los disparos desde el siguiente tick (un proyectil ya en vuelo conserva el daño con
  que se creó, ver `auto-weapons`);
- `cooldownTicks` de un arma: el arma conserva su estado de carga actual; el nuevo intervalo rige desde su siguiente
  disparo;
- `range` y `radius` del criterio de un arma: la selección de objetivo y el pulso los usan desde el siguiente tick
  (un pulso ya visible conserva su radio);
- `maxHealth` del jugador: sube la vida máxima y la vida actual en la misma cantidad (ver `player-health`);
- `speed` y `pickupRadius` del jugador: rigen desde el siguiente tick;
- `regeneration`, `armor`, `xpBonusPercent`, `goldBonusPercent` y `meatHealPercent`: rigen desde el siguiente tick
  ejecutado;
- `invulnerabilityTicks`: rige desde el siguiente golpe; una invulnerabilidad en curso conserva el final que tenía.

#### Scenario: Más daño del Linter
- **GIVEN** `strict-rules` en nivel 1 (Linter con `damage` 9)
- **WHEN** un proyectil del Linter creado después de la elección impacta a un `goblin-torch` con vida 10
- **THEN** el `goblin-torch` queda con vida 1

#### Scenario: Mejoras acumuladas que matan de un impacto
- **GIVEN** `strict-rules` en nivel 5 (Linter con `damage` 21)
- **WHEN** un proyectil del Linter impacta a un `goblin-torch` con vida 10 y otro a un `goblin-barrel` con vida 20
- **THEN** ambos quedan dados de baja con un solo impacto

#### Scenario: Cadencia mejorada sin reiniciar la carga
- **GIVEN** un objetivo permanente a 50 px que no muere y un Linter que dispara en el tick 1 (cargado de nuevo en el
  tick 31), y `fast-ci` comprado durante una tienda abierta en el tick 10 (`cooldownTicks` 26)
- **WHEN** se ejecutan los ticks hasta el 90
- **THEN** el Linter dispara exactamente en los ticks 1, 31, 57 y 83

#### Scenario: Más alcance
- **GIVEN** `wide-analysis` en nivel 1 (`range` 460) y un único enemigo vivo a 450 px del jugador
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es ese enemigo y se crea 1 proyectil

#### Scenario: Más radio del pulso
- **GIVEN** `coverage` en nivel 1 (`radius` 105) y dos `goblin-torch` de radio 10 a distancias 114 y 115 del jugador
- **WHEN** Tests dispara
- **THEN** el de 114 pierde 4 de vida y el de 115 no pierde vida

#### Scenario: Más daño de Tests
- **GIVEN** `hard-asserts` en nivel 1 (Tests con `damage` 6) y un `goblin-torch` con vida 10 en el radio del pulso
- **WHEN** Tests dispara
- **THEN** el `goblin-torch` queda con vida 4

#### Scenario: Cadencia de Tests mejorada
- **GIVEN** `watch-mode` en nivel 1 (`cooldownTicks` 78) comprado antes del tick 1 y un objetivo permanente en el
  radio que no muere
- **WHEN** se ejecutan 157 ticks
- **THEN** Tests dispara exactamente en los ticks 1, 79 y 157

#### Scenario: Más velocidad
- **GIVEN** `shortcuts` en nivel 1 (`speed` 220) y un jugador en (480, 270)
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (700, 270) con un error ≤ 0,001

#### Scenario: Más radio de recogida
- **GIVEN** `pickupRadius` base 64, `context-window` en nivel 1 (efectivo 96), un jugador quieto en (480, 270) y una
  gema en (570, 270) (distancia 90)
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
- **GIVEN** el contenido por defecto (mundo de 3.840 × 2.160 y anillo de aparición de contenido), semilla 7 e input
  (0, 0) en todos los ticks
- **WHEN** se ejecutan ticks hasta el 4.800 (80 s), eligiendo la opción 0 en cada oferta
- **THEN** se abre ≥ 1 oferta en algún tick ≤ 4.800 (medido en apply de 0017: tick 1.527)

#### Scenario: Recorrido en el navegador
- **GIVEN** la build de producción servida con `?seed=7`
- **WHEN** una prueba E2E deja jugar sin input hasta que aparece el overlay y pulsa la tecla 1
- **THEN** antes del overlay el nivel mostrado es 1; tras pulsar, el overlay desaparece, el nivel mostrado es 2 y
  los ticks del snapshot vuelven a avanzar

### Requirement: Textos medievales de las mejoras
El contenido por defecto SHALL dar a cada mejora el `name` y la `description` de esta tabla, carácter a carácter. En
los textos visibles, el arma `linter` se llama **arco** y el arma `tests` se llama **tajo**.

| id | catálogo | `name` | `description` |
|---|---|---|---|
| `strict-rules` | arma | Puntas de acero | Las flechas del arco hacen más daño. |
| `fast-ci` | arma | Tensado rápido | El arco dispara más a menudo. |
| `wide-analysis` | arma | Ojo de halcón | El arco alcanza objetivos más lejanos. |
| `hard-asserts` | arma | Filo templado | El tajo hace más daño. |
| `watch-mode` | arma | Brazo incansable | El tajo se lanza más a menudo. |
| `coverage` | arma | Barrido amplio | El tajo llega más lejos a tu alrededor. |
| `guardrail` | personaje | Cota de malla | Más vida máxima (y la misma cantidad de vida actual). |
| `shortcuts` | personaje | Botas de viajero | Te mueves más rápido. |
| `context-window` | personaje | Amuleto del saqueador | Atraes las gemas desde más lejos. |
| `regeneration` | personaje | Bálsamo de hierbas | Recuperas vida poco a poco. |
| `armor` | personaje | Escudo de roble | Cada golpe te quita menos vida, pero siempre al menos 1. |
| `steady-nerves` | personaje | Temple de veterano | Tras un golpe, tardas más en volver a ser vulnerable. |
| `scholar` | personaje | Tomo del erudito | Las gemas te dan más experiencia. |
| `prospector` | personaje | Bolsa del mercader | Ganas más oro cada vez que lo recoges. |
| `hunter` | personaje | Festín del cazador | La carne te cura más. |

Los ids, el objetivo, `stat`, `perLevel` y `maxLevel` de las 9 mejoras que existían antes del change MUST ser los
mismos que antes del change (ver "Mejoras de arma y de personaje sin cambios"). Los textos MUST NOT cambiar la
simulación, el bot de referencia ni los datos guardados (`localStorage` y JSON exportado).

#### Scenario: Textos del catálogo por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** las 15 mejoras tienen, por id, exactamente el `name` y la `description` de la tabla

#### Scenario: Sin textos del tema anterior
- **GIVEN** el contenido por defecto
- **WHEN** se buscan en los 15 `name` y `description`, como palabra completa y sin distinguir mayúsculas, `Skill`,
  `Linter`, `Tests`, `CI`, `asserts`, `watch`, `cobertura`, `Guardrail`, `Atajos`, `teclado` y `contexto`
- **THEN** no hay ninguna coincidencia

#### Scenario: La carta muestra el texto nuevo
- **GIVEN** un snapshot con una oferta abierta cuyas opciones son `guardrail`, `shortcuts` y `hunter`
- **WHEN** se pinta el overlay de elección
- **THEN** las cartas muestran, en ese orden, "Cota de malla", "Botas de viajero" y "Festín del cazador", cada una con
  su descripción de la tabla y "0 → 1"

#### Scenario: Misma partida con los textos nuevos
- **GIVEN** dos partidas con la semilla 42, los mismos inputs y las mismas elecciones, una con los textos anteriores
  y otra con los de la tabla
- **WHEN** se ejecutan hasta que terminan o hasta el tick 36.000
- **THEN** sus snapshots son iguales tick a tick salvo en el `name` y la `description` de las opciones de oferta

### Requirement: Overlay de elección en la ventana
La vista SHALL centrar el overlay de elección en la ventana: el centro del rectángulo que engloba sus cartas MUST
coincidir con el centro de la ventana (error ≤ 1 px), con las cartas en una fila en el orden de la oferta y
simétricas respecto a ese centro. Con 3 cartas, la de índice 1 MUST contener el centro de la ventana; con 1 carta, esa
carta. Con una ventana ≥ 960 × 540 en ambos ejes, todas las cartas MUST quedar enteras dentro de la ventana y no
solaparse. Al redimensionar, el overlay MUST reubicarse desde el primer frame pintado tras el cambio, sin cerrarse ni
cambiar la oferta, y el clic en cada carta MUST elegir su opción en la posición nueva (ver "Redimensionado de la
ventana" en `world-camera`). Un clic fuera de todas las cartas MUST NOT elegir nada.

#### Scenario: Tres cartas centradas
- **GIVEN** un snapshot con una oferta de 3 opciones pintado con una ventana de 1.280 × 720
- **WHEN** se pinta el overlay
- **THEN** el centro del rectángulo que engloba las 3 cartas es (640, 360) (error ≤ 1 px), la carta de índice 1
  contiene (640, 360) y las 3 están enteras dentro de la ventana

#### Scenario: Clic tras redimensionar
- **GIVEN** el overlay visible con 3 cartas y una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600, se pinta 1 frame y se hace clic en el centro de la tercera carta en su
  posición nueva
- **THEN** se elige la opción de índice 2
- **AND** antes de ese clic, uno en (5, 5), fuera de todas las cartas, no elige nada y la oferta sigue abierta

#### Scenario: Dos cartas y una carta
- **GIVEN** una oferta de 2 opciones, y en otro caso de 1, pintada con una ventana de 960 × 540
- **WHEN** se pinta el overlay
- **THEN** el rectángulo que engloba las cartas está centrado en (480, 270) (error ≤ 1 px); con 1 opción, la carta
  contiene (480, 270)

#### Scenario: Ventana mínima con cartas enteras
- **GIVEN** una oferta de 3 opciones pintada con una ventana de 960 × 540, y en otro caso de 3.840 × 2.160
- **WHEN** se pinta el overlay
- **THEN** en ambos casos las 3 cartas están enteras dentro de la ventana, no se solapan y su texto (nombre,
  descripción y "nivel actual → siguiente") se ve entero

#### Scenario: Ventana menor que 960 × 540
- **GIVEN** una oferta de 3 opciones pintada con una ventana de 640 × 360
- **WHEN** se pinta el overlay y se pulsa la tecla 2
- **THEN** el overlay está centrado en (320, 180) (error ≤ 1 px), no hay errores no capturados y se elige la opción de
  índice 1

### Requirement: Dos catálogos de mejoras
El sistema SHALL separar las mejoras en dos catálogos de contenido:
- **personaje**: las mejoras con objetivo el jugador; son las únicas que salen en la oferta al subir de nivel (ver
  "Oferta de mejoras");
- **arma**: las mejoras con objetivo un arma, por su `id` de `content/weapons.json`; solo se obtienen comprándolas en
  la tienda (ver `castle-shop`), con el precio por nivel del contenido.

Un id MUST ser único entre los dos catálogos. Una mejora de personaje con objetivo un arma, o una de arma con objetivo
el jugador, MUST impedir que la partida arranque con un error que nombre la mejora. Con el contenido por defecto, el
catálogo de arma tiene exactamente las 6 mejoras de arma de antes del change, con los mismos ids, objetivo, `stat`,
`perLevel` y `maxLevel`; el formato referencia el arma por su id, de modo que un loadout con más armas no cambia el
formato.

#### Scenario: Catálogos por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** el catálogo de personaje tiene exactamente 9 mejoras, con ids `guardrail`, `shortcuts`,
  `context-window`, `regeneration`, `armor`, `steady-nerves`, `scholar`, `prospector` y `hunter`, todas con objetivo
  el jugador
- **AND** el catálogo de arma tiene exactamente `strict-rules`, `fast-ci`, `wide-analysis`, `hard-asserts`,
  `watch-mode` y `coverage`, todas con objetivo un arma
- **AND** ninguna añade armas nuevas

#### Scenario: Mejoras de arma y de personaje sin cambios
- **GIVEN** el contenido de mejoras de `main` antes del change y el contenido por defecto tras el change
- **WHEN** se comparan, sin `name` ni `description`, las 6 mejoras de arma y `guardrail`, `shortcuts` y
  `context-window`
- **THEN** son iguales campo a campo (objetivo, `stat`, `perLevel`, `maxLevel`)

#### Scenario: Id repetido entre catálogos
- **GIVEN** una mejora de personaje y una de arma con id `fast-ci`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `fast-ci`

#### Scenario: Mejora en el catálogo equivocado
- **GIVEN** una mejora de `damage` del Linter en el catálogo de personaje, y en otro caso una de `speed` en el de arma
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la mejora

### Requirement: Estadísticas de personaje nuevas
El sistema SHALL admitir en las mejoras de personaje, además de `maxHealth`, `speed` y `pickupRadius`, estas
estadísticas del jugador (nombres provisionales: el design puede renombrar el campo, no su efecto), todas con base 0
salvo la invulnerabilidad, cuya base es la duración del contenido del jugador:
- `regeneration`: vida que recupera en cada tick de regeneración (ver "Regeneración de vida" en `player-health`);
- `armor`: reducción plana del daño de cada golpe (ver "Daño discreto por contacto" en `player-health`);
- `invulnerabilityTicks`: ticks de invulnerabilidad tras un golpe (ver "Invulnerabilidad temporal tras un golpe");
- `xpBonusPercent`: porcentaje extra de XP de cada gema (ver "Subida de nivel con arrastre" en `leveling`);
- `goldBonusPercent`: porcentaje extra de oro de cada ingreso (ver "Contadores de oro y madera de la partida" en
  `resources`);
- `meatHealPercent`: puntos que se suman a la curación de la carne (ver "Curación por carne" en `player-health`).

Su `perLevel` MUST ser entero. Con todas las mejoras de la estadística en su `maxLevel`, el valor efectivo MUST quedar
en su rango: `regeneration`, `armor`, `xpBonusPercent` y `goldBonusPercent` ≥ 0, `invulnerabilityTicks` ≥ 1 y la
curación de la carne efectiva (contenido + `meatHealPercent`) entre 1 y 100. Si no, la carga falla con un error que
nombra la mejora y la estadística.

#### Scenario: Estadísticas nuevas en el contenido por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** `regeneration`, `armor`, `steady-nerves`, `scholar`, `prospector` y `hunter` cambian respectivamente
  `regeneration`, `armor`, `invulnerabilityTicks`, `xpBonusPercent`, `goldBonusPercent` y `meatHealPercent`, con
  `perLevel` entero > 0 y `maxLevel` ≥ 1 del contenido

#### Scenario: Peor caso fuera de rango
- **GIVEN** en un caso cada vez: una mejora de `armor` con `perLevel` −1; una de `invulnerabilityTicks` con `perLevel`
  −10 y `maxLevel` 3 sobre una base de 30 (30 − 30 = 0); una de `meatHealPercent` con `perLevel` 20 y `maxLevel` 5
  sobre una curación de 20 (120 > 100); una de `xpBonusPercent` con `perLevel` 2,5
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la mejora y la estadística

#### Scenario: Límite exacto de la invulnerabilidad
- **GIVEN** una mejora de `invulnerabilityTicks` con `perLevel` −29 y `maxLevel` 1 sobre una base de 30
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

<!-- historial: 0005-xp-and-level-up (2026-11-19) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
<!-- historial: 0024-split-progression-castle (2026-11-25) -->
