# Spec delta · upgrades

<!-- Purpose nuevo propuesto al archivar: "Los dos catálogos de mejoras (personaje por XP y arma por oro), la oferta de
     3 de personaje al subir de nivel, la elección y los efectos sobre las estadísticas de armas y jugador." -->

## ADDED Requirements

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

## MODIFIED Requirements

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

<!-- Escenarios vivos sin cambios: "Identificador repetido o lista vacía" (cada catálogo vacío falla por separado),
     "Arma inexistente", "Estadística incompatible", "Nivel máximo que saca la cadencia de rango", "Límite exacto de
     la cadencia", "Suma de varias mejoras sobre la misma estadística" y "Valores inválidos". -->

#### Scenario: Catálogo por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se carga el contenido
- **THEN** hay exactamente 15 mejoras entre los dos catálogos: 9 de personaje y 6 de arma (ver "Catálogos por
  defecto")
- **AND** las 6 de arma y `guardrail`, `shortcuts` y `context-window` tienen `maxLevel` 5 y los incrementos de antes
  del change; las 6 de personaje nuevas, los `perLevel` y `maxLevel` del contenido

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

<!-- Escenarios vivos sin cambios: "Primera oferta", "Oferta reproducible" y "Dos disponibles". -->

#### Scenario: Todas las mejoras pueden salir
- **GIVEN** la semilla 1 y una partida en la que, en cada oferta, se elige la opción 0
- **WHEN** se abren las ofertas hasta que todas las mejoras de personaje han llegado a su nivel máximo
- **THEN** cada una de las 9 mejoras de personaje ha aparecido en ≥ 1 oferta, ninguna oferta repite una mejora y
  ninguna oferta contiene una mejora de arma

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

<!-- Escenario vivo sin cambios: "Índice fuera de rango". -->

#### Scenario: Elección válida
- **GIVEN** una oferta abierta con `shortcuts`, `guardrail` y `armor`, en ese orden
- **WHEN** se elige el índice 1
- **THEN** `guardrail` pasa a nivel 1, la oferta se cierra y la partida vuelve a en curso
- **AND** `shortcuts` y `armor` siguen en nivel 0

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

<!-- Escenarios vivos sin cambios: "Más daño del Linter", "Mejoras acumuladas que matan de un impacto", "Más alcance",
     "Más radio del pulso", "Más daño de Tests", "Más velocidad", "Más radio de recogida" y "El contenido base no
     cambia" (en los de arma, "en nivel k" se obtiene comprando k veces). -->

#### Scenario: Cadencia mejorada sin reiniciar la carga
- **GIVEN** un objetivo permanente a 50 px que no muere y un Linter que dispara en el tick 1 (cargado de nuevo en el
  tick 31), y `fast-ci` comprado durante una tienda abierta en el tick 10 (`cooldownTicks` 26)
- **WHEN** se ejecutan los ticks hasta el 90
- **THEN** el Linter dispara exactamente en los ticks 1, 31, 57 y 83

#### Scenario: Cadencia de Tests mejorada
- **GIVEN** `watch-mode` en nivel 1 (`cooldownTicks` 78) comprado antes del tick 1 y un objetivo permanente en el
  radio que no muere
- **WHEN** se ejecutan 157 ticks
- **THEN** Tests dispara exactamente en los ticks 1, 79 y 157

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

<!-- Escenario vivo sin cambios: "Misma partida con los textos nuevos". "Ids y números sin cambios" se sustituye por
     "Mejoras de arma y de personaje sin cambios" (ADDED). -->

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

## REMOVED Requirements
<!-- Ninguno. El escenario "Ids y números sin cambios" de "Textos medievales de las mejoras" se retira: lo sustituye
     "Mejoras de arma y de personaje sin cambios" (las mejoras de arma cambian de catálogo y ganan precios). -->
