# Spec delta · sprite-rendering

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/sprite-rendering/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Capacidad nueva. Purpose propuesto para la spec viva: el aspecto en pantalla del jugador, los enemigos, los
> proyectiles y las gemas (sprites animados definidos en el manifiesto `content/appearance.json`), las texturas de
> reserva cuando falta el arte, la animación de muerte de los enemigos y su limpieza, la carga compatible con la CSP
> y la sonda de recuento de sprites para E2E. El pulso de Tests conserva su anillo (ver `auto-weapons`).
>
> Convenciones de este delta:
> - **Manifiesto**: `content/appearance.json`. **Aspecto**: una entrada del manifiesto. **Id lógico**: `player`,
>   `gem`, el `id` de un tipo de enemigo de `content/enemies.json` o el `id` de un arma con ataque `projectile` de
>   `content/weapons.json`.
> - **Pack**: las hojas PNG referenciadas por el manifiesto, en la carpeta local de arte (la ruta la fija el design;
>   está fuera de git). Ningún escenario depende de un pack concreto: los tamaños de frame, frames y fps que aparecen
>   son ejemplos que el test prepara.
> - **Build sin arte**: la build de producción tal como sale del repositorio, sin ninguna hoja (la de CI y la que se
>   despliega). **Build con arte sintético**: una segunda build de producción para E2E con hojas generadas
>   automáticamente a partir del manifiesto (arte propio de colores planos, con los frames que pide cada aspecto;
>   ningún pack real y nada versionado bajo la carpeta local de arte). El arte presente se detecta al construir: en
>   la build sin arte no se pide ninguna hoja.
> - **Placeholder**: textura de reserva generada por el propio juego, sin ficheros. Se usa cuando la hoja de un
>   aspecto no existe, falla al cargar o no contiene un frame referenciado.
> - **Cadáver**: sprite que reproduce la animación de muerte de un enemigo dado de baja. No es un enemigo: no figura
>   en el snapshot, no colisiona ni cuenta como "sprite de enemigo".
> - **Frame**: un pintado del adaptador de render. Salvo que se diga otra cosa, los frames duran 16,667 ms.
> - "Mundo detenido": la partida está en pausa (ver `main-menu`) o eligiendo mejora (ver `run-state`).
> - Los escenarios de navegador con `?e2e` pueden usar la sonda `window.__sprint`; sin `?e2e` la sonda no existe.

## ADDED Requirements

### Requirement: Manifiesto de aspecto validado
El sistema SHALL definir el aspecto de los elementos de la partida exclusivamente en `content/appearance.json`,
validado con zod en el arranque, antes de crear el menú o la partida. El manifiesto tiene:
- `maxCorpses`: entero ≥ 1, tope de cadáveres visibles a la vez;
- `default`: aspecto obligatorio, usado por todo id lógico sin entrada propia;
- `player` y `gem`: aspecto opcional cada uno;
- `enemies`: objeto opcional `{ <id de tipo de enemigo>: aspecto }`;
- `projectiles`: objeto opcional `{ <id de arma de proyectil>: aspecto }`.

Cada aspecto tiene:
- `sheet`: ruta relativa a la carpeta local de arte, no vacía, que termina en `.png`, sin segmentos `..`, sin `/`
  inicial y sin esquema (`http:`, `data:`, `blob:`…);
- `frameWidth` y `frameHeight`: enteros ≥ 1 (px de la hoja);
- `scale`: número > 0, escala visual del frame en pantalla, independiente del radio del elemento en el snapshot;
- `origin` (opcional, por defecto `{ "x": 0.5, "y": 0.5 }`): `x` e `y` en [0, 1];
- `facing` (opcional, por defecto `"right"`): `"right"` o `"left"`, hacia dónde mira el dibujo sin voltear;
- `tint` (opcional): color `#RRGGBB`;
- `placeholderColor`: color `#RRGGBB` del placeholder de ese aspecto;
- `animations`: objeto con `idle` obligatorio y `walk` y `death` opcionales. Cada animación tiene `frames` (lista
  de ≥ 1 enteros ≥ 0, índices de frame de la hoja), `fps` (número > 0) y `loop` (booleano). `death` MUST tener
  `loop` `false`.

Cualquier campo desconocido (también un estado de animación distinto de `idle`, `walk` y `death`), campo obligatorio
ausente, valor fuera de rango o con formato no admitido MUST rechazarse con un error explícito que nombre la ruta del
campo (por ejemplo `enemies.bug.animations.walk.fps`). Un manifiesto inválido MUST hacer fallar el arranque igual que
el resto del contenido inválido: el juego no muestra el menú ni empieza ninguna partida y el error figura en la
consola.

#### Scenario: Manifiesto del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el manifiesto es válido, `maxCorpses` vale 64 y hay aspecto `default`, `player`, `gem`, aspectos en
  `enemies` para `bug`, `memory-leak` y `merge-conflict`, y en `projectiles` para `linter`
- **AND** los `placeholderColor` de `default`, `player`, `gem`, `bug`, `memory-leak`, `merge-conflict` y `linter`
  son 7 colores distintos entre sí

#### Scenario: Sin aspecto por defecto
- **GIVEN** el manifiesto del repositorio sin la clave `default`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `default`

#### Scenario: Valores fuera de rango
- **GIVEN** el manifiesto del repositorio con, en un caso cada vez en el aspecto `bug`: `frameWidth` 0,
  `frameHeight` 1,5, `scale` 0, `scale` −1, `origin.x` 1,1, `origin.y` −0,1, `animations.walk.fps` 0,
  `animations.walk.frames` `[]`, `animations.walk.frames` `[-1]`, `animations.walk.frames` `[1.5]`; y en otro caso
  `maxCorpses` 0 o `maxCorpses` 2,5
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

#### Scenario: Formatos no admitidos
- **GIVEN** el manifiesto del repositorio con, en un caso cada vez en el aspecto `bug`: `sheet` `""`,
  `sheet` `"../secreto.png"`, `sheet` `"/bug.png"`, `sheet` `"https://ejemplo.com/bug.png"`,
  `sheet` `"data:image/png;base64,AAAA"`, `sheet` `"bug.gif"`, `tint` `"red"`, `placeholderColor` `"#12345"` o
  `facing` `"up"`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

#### Scenario: Campos y estados desconocidos u obligatorios ausentes
- **GIVEN** el manifiesto del repositorio con, en un caso cada vez: un campo extra `rotation: 90` en el aspecto
  `bug`, una animación `attack` en el aspecto `bug`, el aspecto `player` sin `animations.idle`, el aspecto `gem` sin
  `placeholderColor`, o `animations.death.loop` `true` en el aspecto `bug`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

#### Scenario: Manifiesto inválido en el arranque
- **GIVEN** un manifiesto sin la clave `default`
- **WHEN** se ejecuta el arranque del juego, con y sin `?e2e`
- **THEN** en ambos casos no se crea el menú ni ninguna partida y el arranque informa por consola de un error que
  nombra `default` (verificable sin navegador)

### Requirement: Cruce del manifiesto con el contenido
El sistema SHALL comprobar en el arranque que cada clave de `enemies` es el `id` de un tipo de
`content/enemies.json` y que cada clave de `projectiles` es el `id` de un arma de `content/weapons.json` con ataque
`projectile`. Una clave que no cumple esto MUST hacer fallar el arranque con un error que nombra la clave (por
ejemplo `enemies.dragon`). Un id lógico sin entrada propia MUST pintarse con el aspecto `default`; esto MUST NOT ser
un error. La comprobación no forma parte de las reglas de la partida: un manifiesto no cambia la simulación.

#### Scenario: Enemigo inexistente
- **GIVEN** el manifiesto del repositorio con un aspecto en `enemies.dragon` y el contenido de enemigos por defecto
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `enemies.dragon`

#### Scenario: Arma inexistente o que no es de proyectil
- **GIVEN** el manifiesto del repositorio con un aspecto en `projectiles.laser`, y en otro caso en
  `projectiles.tests` (arma de pulso)
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `projectiles.laser`, y `projectiles.tests` respectivamente

#### Scenario: Tipo de enemigo sin entrada
- **GIVEN** un contenido de enemigos con un cuarto tipo `null-pointer` válido y el manifiesto del repositorio, que no
  tiene `enemies.null-pointer`
- **WHEN** se carga el contenido y se pinta un snapshot con 1 enemigo `null-pointer` y 1 `bug`
- **THEN** la carga tiene éxito
- **AND** el enemigo `null-pointer` se pinta con el aspecto `default` y el `bug` con el aspecto `enemies.bug`

#### Scenario: Manifiesto mínimo
- **GIVEN** un manifiesto con solo `maxCorpses` y `default` (este con solo `animations.idle`)
- **WHEN** se carga el contenido y se pinta un snapshot con jugador, 1 enemigo de cada tipo, 1 proyectil y 1 gema
- **THEN** la carga tiene éxito y los 6 elementos se pintan con el aspecto `default`

#### Scenario: El manifiesto no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por
  tick y la política de elección fija, una con el manifiesto del repositorio y otra con el manifiesto mínimo
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Arte fuera del repositorio y placeholders
El sistema SHALL funcionar sin ningún fichero del pack. El repositorio MUST NOT versionar ningún PNG de la carpeta
local de arte. Para cada aspecto cuya hoja no existe, falla al cargar o no contiene algún frame referenciado por sus
animaciones, el elemento MUST pintarse con el placeholder de ese aspecto: una forma rellena con su
`placeholderColor`, centrada en la posición del elemento y de diámetro 2 × el radio del elemento en el snapshot,
sin volteo ni rotación visibles. La falta de arte MUST NOT romper la partida ni producir errores no capturados. Los
aspectos cuya hoja carga bien se pintan con su arte, aunque otros usen placeholder. El placeholder conserva el
resto del comportamiento de esta spec (estados, duración de la muerte, parpadeo, indicación de daño). Los
placeholders MUST NOT depender de recursos `blob:` ni de ficheros.

#### Scenario: Repositorio sin PNG del pack
- **GIVEN** el repositorio en `main` tras este change
- **WHEN** se listan los ficheros versionados
- **THEN** ninguno es un `.png` bajo la carpeta local de arte

#### Scenario: Sin pack
- **GIVEN** la build sin arte, servida con `?e2e&seed=42`
- **WHEN** termina la carga y el motor informa de 600 frames
- **THEN** la sonda informa de tick 600 y de que todos los sprites visibles de jugador, enemigo, cadáver, proyectil
  y gema usan placeholder
- **AND** no hay errores no capturados en la consola y no se ha pedido ninguna hoja

#### Scenario: Pack parcial
- **GIVEN** la build con arte sintético en la que la hoja de `enemies.bug` carga bien y las de `player` y
  `enemies.memory-leak` fallan al cargar (por ejemplo, su contenido no es una imagen decodificable)
- **WHEN** se pinta un snapshot con el jugador, 1 `bug` y 1 `memory-leak`
- **THEN** el `bug` se pinta con su arte y el jugador y el `memory-leak` con placeholder
- **AND** no hay errores no capturados en la consola

#### Scenario: Frame fuera de la hoja
- **GIVEN** la build con arte sintético con un aspecto `enemies.bug` con `frameWidth` y `frameHeight` 32 cuya hoja
  de 128 × 32 px carga bien (4 frames, índices 0 a 3) y `animations.walk.frames` `[0, 1, 2, 7]`
- **WHEN** se pinta un `bug`
- **THEN** se pinta con el placeholder de `enemies.bug` y no hay errores no capturados

#### Scenario: Tamaño del placeholder
- **GIVEN** la hoja de `enemies.bug` ausente, `placeholderColor` `#33aa33` y un `bug` de radio 10 en (300, 200)
- **WHEN** se pinta el snapshot
- **THEN** el sprite del `bug` es una forma de color `#33aa33` de 20 px de diámetro centrada en (300, 200)
  (error ≤ 0,001)

### Requirement: Carga compatible con la CSP
El sistema SHALL cargar las hojas del pack y crear los placeholders sin ninguna violación de la Content Security
Policy de la página, sin cambiar la política vigente (`img-src 'self' data:`, ver `progress-persistence`), y tanto
al arrancar desde el menú como con `?e2e`. La carga MUST terminar, con o sin pack, antes del primer frame que pinta
un elemento de la partida: ningún elemento se pinta con una textura sin cargar. Sin pack, el arranque con `?e2e`
MUST conservar el comportamiento de "Carga en modo E2E" (`main-menu`).

#### Scenario: CSP con arte desde el menú
- **GIVEN** la build con arte sintético servida sin parámetros y una prueba que escucha `securitypolicyviolation`
- **WHEN** se pulsa `Jugar` y se pintan 300 frames
- **THEN** se registran 0 eventos `securitypolicyviolation`, no hay errores no capturados y la sonda de render no
  existe (sin `?e2e`)
- **AND** la política de `img-src` del `index.html` servido es `'self' data:`, igual que en la build sin arte

#### Scenario: CSP con arte y con e2e
- **GIVEN** la build con arte sintético servida con `?e2e&seed=42`
- **WHEN** termina la carga y se pintan 300 frames
- **THEN** se registran 0 eventos `securitypolicyviolation`, la sonda informa de 0 sprites con placeholder y el
  jugador y los enemigos que se mueven reproducen `walk`

#### Scenario: CSP sin pack
- **GIVEN** la build sin arte, servida con `?e2e&seed=42` y, en otra carga, sin parámetros pulsando `Jugar`
- **WHEN** se pintan 300 frames en cada caso
- **THEN** se registran 0 eventos `securitypolicyviolation` y no hay errores no capturados

#### Scenario: Arranque e2e sin pack
- **GIVEN** la URL `?e2e&seed=42` y ninguna hoja disponible
- **WHEN** termina la carga y el motor informa de 15 frames de 16,667 ms
- **THEN** la sonda informa de semilla 42, estado en curso y tick 15, y el menú de inicio no se ha visto

### Requirement: Escala y origen
El sistema SHALL pintar cada sprite con arte con un tamaño en pantalla de `frameWidth` × `scale` por
`frameHeight` × `scale` px, con su `origin` en la posición del elemento en el snapshot, sea cual sea el radio del
elemento. Si el aspecto tiene `tint`, el sprite se pinta con ese tinte mientras no muestre otra indicación (ver
`auto-weapons`).

#### Scenario: Escala independiente de la hitbox
- **GIVEN** un aspecto `enemies.memory-leak` con frame 100 × 100, `scale` 0,5 y `origin` (0,5, 1), y un
  `memory-leak` de radio 18 en (400, 300)
- **WHEN** se pinta el snapshot
- **THEN** el sprite mide 50 × 50 px y su borde inferior central está en (400, 300) (error ≤ 0,001)
- **AND** con el mismo aspecto, un `memory-leak` de radio 30 también mide 50 × 50 px

#### Scenario: Cambio de pack solo con datos
- **GIVEN** dos manifiestos A (frame 100 × 100, `scale` 0,4) y B (frame 32 × 32, `scale` 1,25) para `player`, con
  sus hojas, y el mismo código
- **WHEN** se pinta el mismo snapshot con cada uno
- **THEN** el jugador mide 40 × 40 px con A y 40 × 40 px con B, cada uno con su hoja

### Requirement: Animación por estado del jugador y de los enemigos
El sistema SHALL animar el sprite del jugador y el de cada enemigo vivo según su estado, que se deduce comparando
el snapshot pintado con el último snapshot pintado de un tick distinto de la misma partida. Un frame que pinta un
snapshot del mismo tick que el anterior (frames sin tick, p. ej. con refrescos de pantalla > 60 Hz) MUST conservar el
estado y la orientación de cada sprite:
- se mueve si su posición ha cambiado más de 0,001 px: reproduce `walk` (o `idle` si el aspecto no tiene `walk`);
- si no, reproduce `idle`;
- cada animación avanza a sus `fps` en tiempo de render y, con `loop` `true`, vuelve al primer frame al acabar;
  con `loop` `false`, se queda en el último frame.

Un enemigo en su primer frame pintado (recién aparecido o en un hueco reutilizado) y el jugador en el primer frame de
una partida nueva MUST NOT heredar posición, estado ni orientación de otro elemento o de la partida anterior: se
pintan en `idle` y sin voltear. Con el mundo detenido, ninguna animación avanza: cada sprite conserva el frame que
mostraba. Con la partida terminada por derrota, el jugador reproduce una vez `death` (si su aspecto la tiene) y se
queda en su último frame; con victoria, o sin `death`, se pinta en `idle`. La animación no cambia la simulación.

#### Scenario: Quieto y andando
- **GIVEN** un aspecto `player` con `idle` (frames `[0, 1]`, 2 fps, bucle) y `walk` (frames `[4, 5, 6, 7]`,
  10 fps, bucle)
- **WHEN** se pintan 30 frames con el jugador en (480, 270) y después 30 frames con input (1, 0)
- **THEN** en los 30 primeros el jugador reproduce `idle` y en los 30 siguientes, desde el primero en que su
  posición cambia, reproduce `walk`

#### Scenario: Avance de la animación
- **GIVEN** la animación `walk` del escenario anterior (4 frames a 10 fps, bucle) en curso desde el frame f
- **WHEN** se pintan 30 frames de 16,667 ms
- **THEN** el frame de hoja mostrado en el frame f + k es el índice ⌊k × 16,667 / 100⌋ mod 4 de `[4, 5, 6, 7]`,
  con un error de ±1 frame de render en cada cambio

#### Scenario: Aspecto sin walk
- **GIVEN** un aspecto `enemies.bug` con solo `idle`
- **WHEN** se pinta un `bug` que se mueve 1,5 px por frame durante 60 frames
- **THEN** reproduce `idle` en los 60

#### Scenario: Frames sin tick
- **GIVEN** un jugador con input (1, 0) y un motor que informa de frames de 8,333 ms (120 Hz), de modo que los
  frames alternan uno con tick nuevo y otro que repite el tick anterior
- **WHEN** se pintan 120 frames
- **THEN** el jugador reproduce `walk` y no está volteado en los 120, sin pasar a `idle` en ninguno
- **AND** con input (0, 0) en los mismos 120 frames reproduce `idle` en todos

#### Scenario: Umbral de movimiento
- **GIVEN** un enemigo que reproduce `walk`
- **WHEN** se pinta el snapshot del tick siguiente, en el que su posición ha cambiado 0,0005 px
- **THEN** pasa a reproducir `idle`

#### Scenario: Hueco reutilizado
- **GIVEN** un `bug` de id 7 pintado en (100, 100) andando hacia la izquierda, que muere, y un `bug` de id 9 que en
  el frame siguiente se pinta en (800, 100) con el sprite que usaba el id 7
- **WHEN** se pinta ese frame
- **THEN** el `bug` de id 9 reproduce `idle` y no está volteado

#### Scenario: Mundo detenido
- **GIVEN** un jugador y 3 enemigos reproduciendo `walk` y la partida en pausa en el tick 500
- **WHEN** se pintan 300 frames en pausa
- **THEN** en los 300 frames cada sprite muestra el mismo frame de hoja que en el primer frame de la pausa
- **AND** lo mismo ocurre durante 300 frames con la partida eligiendo mejora

#### Scenario: Muerte del jugador
- **GIVEN** un aspecto `player` con `death` (frames `[20, 21, 22, 23]`, 10 fps, sin bucle) y una partida que
  termina con derrota en el tick n
- **WHEN** se pintan 120 frames con la partida terminada
- **THEN** el jugador reproduce `death` una vez desde el frame que pinta el tick n y, desde el frame 25, muestra el
  frame de hoja 23 hasta el frame 120, visible en todos (sin parpadeo, ver `player-health`)

#### Scenario: Victoria
- **GIVEN** el mismo aspecto `player` y una partida que termina con victoria
- **WHEN** se pintan 60 frames con la partida terminada
- **THEN** el jugador reproduce `idle` en los 60

#### Scenario: Parpadeo con sprite animado
- **GIVEN** una vista con periodo de parpadeo 4, el jugador andando e invulnerable desde el tick 1 durante 30 ticks
- **WHEN** se pintan los snapshots de los ticks 1 a 30
- **THEN** la visibilidad del sprite del jugador sigue "Parpadeo durante la invulnerabilidad" (`player-health`) y,
  en los ticks en que es visible, reproduce `walk`

### Requirement: Orientación
El sistema SHALL orientar los sprites según la dirección de avance entre el snapshot pintado y el último snapshot
pintado de un tick distinto (los frames que repiten tick conservan la orientación):
- jugador y enemigos: si el desplazamiento horizontal Δx cumple Δx < −0,001, miran a la izquierda; si Δx > 0,001,
  a la derecha; si no, conservan la orientación anterior. "Mirar a la izquierda" es voltear horizontalmente el dibujo
  si su `facing` es `"right"` y no voltearlo si es `"left"` (y al revés para la derecha). El volteo no cambia la
  posición del sprite ni su tamaño;
- proyectiles: el sprite rota al ángulo atan2(Δy, Δx) de su desplazamiento (más π si su `facing` es `"left"`), con
  error ≤ 0,01 rad; en el primer frame en que aparece, sin desplazamiento previo, su rotación es 0 (π si `facing` es
  `"left"`). Su dirección es fija (ver `auto-weapons`), así que la rotación no cambia mientras vive;
- gemas: sin volteo ni rotación.

#### Scenario: Jugador que gira
- **GIVEN** un aspecto `player` con `facing` `"right"`
- **WHEN** se pintan 10 frames con input (−1, 0), después 10 con input (0, 1) y después 10 con input (1, 0)
- **THEN** está volteado desde el primer frame en que se mueve a la izquierda hasta el último de input (0, 1), y sin
  voltear desde el primer frame en que se mueve a la derecha

#### Scenario: Dibujo que mira a la izquierda
- **GIVEN** un aspecto `enemies.bug` con `facing` `"left"` y un `bug` que se mueve con Δx = −1,5 por frame
- **WHEN** se pintan 10 frames
- **THEN** el sprite no está volteado en ninguno; y si se mueve con Δx = +1,5, está volteado desde el segundo frame

#### Scenario: Primer frame sin desplazamiento
- **GIVEN** una partida nueva tras pulsar R cuyo jugador de la partida anterior miraba a la izquierda
- **WHEN** se pinta el tick 0 de la partida nueva
- **THEN** el jugador no está volteado (con `facing` `"right"`)

#### Scenario: Rotación del proyectil
- **GIVEN** un proyectil del Linter con `facing` `"right"` creado hacia la dirección (0, 1) y pintado en 5 frames
  consecutivos
- **WHEN** se lee su rotación en cada frame
- **THEN** vale 0 en el primero y π/2 (error ≤ 0,01 rad) del segundo al quinto

### Requirement: Animación de muerte de los enemigos
El sistema SHALL, cuando un enemigo pintado en el último frame queda dado de baja (su muerte cuenta en las bajas de
la partida, ver `run-outcome`) y deja de figurar en el snapshot pintado, mostrar un cadáver con el aspecto de su
tipo (o `default`): reproduce una vez `death` en la última posición pintada del enemigo, con su última orientación,
sin moverse, y deja de verse cuando termina la animación, es decir, cuando el tiempo de render acumulado desde el
frame en que aparece alcanza `frames.length` / `fps` segundos. Con el mundo detenido el tiempo de los cadáveres no
avanza. Si el aspecto no tiene `death`, no hay cadáver: el enemigo deja de verse en ese frame. Dentro de una partida,
un enemigo solo deja de figurar en el snapshot al ser dado de baja (también al terminar la partida: los enemigos
vivos siguen en el snapshot terminado). Los elementos que dejan de pintarse porque se cambia de partida (partida
nueva con R o `Volver al menú`) MUST NOT producir cadáver. Un enemigo dado de baja que nunca llegó a pintarse (apareció y murió entre
dos frames) tampoco produce cadáver.

MUST NOT haber nunca más de `maxCorpses` cadáveres visibles. Si una baja ocurre con el tope lleno, esa baja no
produce cadáver y los cadáveres en curso siguen hasta terminar. Varias bajas en el mismo frame se atienden en el
orden de la lista de enemigos del snapshot anterior hasta llenar el tope. Cuando termina la animación, el cadáver no
deja ningún sprite visible.

#### Scenario: Muerte y desaparición
- **GIVEN** un aspecto `enemies.bug` con `death` de 4 frames a 10 fps (400 ms) y un `bug` pintado en (300, 200) que
  muere en el tick T
- **WHEN** se pinta el snapshot del tick T (frame 1) y los 30 frames siguientes
- **THEN** el snapshot del tick T no contiene el `bug` y hay 0 sprites de enemigo para él
- **AND** hay 1 cadáver visible en (300, 200) (error ≤ 0,001) al menos en los frames 1 a 23 y ninguno desde el
  frame 26

#### Scenario: Pulso que mata a varios en el mismo tick
- **GIVEN** `maxCorpses` 64, 0 cadáveres en curso y un pulso de Tests que da de baja a 5 enemigos en el tick T
- **WHEN** se pinta el snapshot del tick T
- **THEN** hay 5 cadáveres visibles, cada uno en la última posición pintada de uno de los 5 enemigos

#### Scenario: Tope de cadáveres
- **GIVEN** `maxCorpses` 64, 60 cadáveres en curso y 7 bajas en el frame siguiente, de los enemigos e1 a e7 en el
  orden de la lista
- **WHEN** se pinta ese frame
- **THEN** hay exactamente 64 cadáveres visibles: los 60 anteriores y los de e1 a e4
- **AND** e5, e6 y e7 no muestran cadáver ni sprite de enemigo, y no hay errores no capturados

#### Scenario: Tope pequeño
- **GIVEN** `maxCorpses` 1, 1 cadáver en curso al que le quedan 100 ms y una baja en el frame siguiente
- **WHEN** se pinta ese frame y los 30 siguientes
- **THEN** hay 1 cadáver visible hasta que termina el primero y la segunda baja no muestra cadáver en ningún frame

#### Scenario: Aspecto sin death
- **GIVEN** un aspecto `enemies.bug` sin `death` y un `bug` que muere en el tick T
- **WHEN** se pinta el snapshot del tick T
- **THEN** hay 0 cadáveres y 0 sprites para ese `bug`

#### Scenario: Salida sin baja
- **GIVEN** una partida pintada con 12 enemigos vivos
- **WHEN** se pinta el primer snapshot de la partida nueva tras pulsar R, y en otro caso el primer frame del menú
  tras `Volver al menú`
- **THEN** hay 0 cadáveres visibles en ese frame y en los 60 siguientes

#### Scenario: Fin de la partida
- **GIVEN** una partida que termina en el tick n con 8 enemigos en el snapshot pintado del tick n − 1, de los que
  2 quedan dados de baja en el tick n (las bajas aumentan en 2)
- **WHEN** se pinta el snapshot terminado del tick n y los 60 frames siguientes
- **THEN** en el frame del tick n aparecen exactamente 2 cadáveres y hay 6 sprites de enemigo, iguales a los 6
  enemigos del snapshot terminado
- **AND** en los 60 frames siguientes siguen visibles esos 6 sprites de enemigo y no aparece ningún cadáver nuevo

#### Scenario: Salidas iguales a bajas
- **GIVEN** el contenido por defecto, la semilla 42 y 1.200 ticks agrupados en frames de 1 tick y, en otra
  ejecución, de 8 ticks
- **WHEN** se comparan cada par de snapshots pintados consecutivos
- **THEN** el número de ids de enemigo que dejan de figurar es igual al aumento de las bajas en todos los pares

#### Scenario: Muerte a velocidad acelerada
- **GIVEN** `?e2e&speed=8` y un `bug` pintado en (300, 200) en el frame f que muere en el segundo de los 8 ticks del
  frame f + 1
- **WHEN** se pinta el frame f + 1
- **THEN** hay 1 cadáver en (300, 200)

#### Scenario: Cadáver con el mundo detenido
- **GIVEN** el cadáver de "Muerte y desaparición" con 200 ms transcurridos y la partida en pausa
- **WHEN** se pintan 300 frames en pausa, se reanuda y se pintan 30 frames más
- **THEN** el cadáver es visible en los 300 frames de pausa y, tras reanudar, deja de verse entre los frames 11 y 14

#### Scenario: Muerte con placeholder
- **GIVEN** la hoja de `enemies.bug` ausente y su `death` de 4 frames a 10 fps
- **WHEN** muere un `bug` y se pintan 30 frames
- **THEN** su cadáver se ve con el placeholder de `enemies.bug` al menos en los frames 1 a 23 y no desde el frame 26

### Requirement: Limpieza de la vista al cambiar de partida
El sistema SHALL, en el primer frame de una partida nueva tras R (ver `run-results`) y en el primer frame del menú
tras `Volver al menú` (ver `main-menu`), no dejar visible ningún cadáver ni ningún sprite de jugador, enemigo,
proyectil, pulso o gema que no corresponda al snapshot pintado (en el menú, ninguno). Los cadáveres en curso se
descartan sin terminar su animación y no reaparecen después. Al cerrar la escena de la partida a mitad de una
animación MUST NOT quedar animaciones en curso ni errores no capturados.

#### Scenario: R con cadáveres en curso
- **GIVEN** una partida terminada ya pintada con 10 cadáveres en curso, 15 enemigos y 40 gemas
- **WHEN** se pulsa R y se pinta el tick 0 de la partida nueva y los 60 frames siguientes
- **THEN** hay 0 cadáveres visibles en todos esos frames y, en el primero, 1 sprite de jugador y 0 de enemigo,
  proyectil, pulso y gema

#### Scenario: Volver al menú con cadáveres en curso
- **GIVEN** `?e2e&seed=7` y una partida en curso que se pausa en el primer frame en que la sonda informa de ≥ 1
  cadáver visible
- **WHEN** se pulsa `Volver al menú` y se pintan 60 frames en el menú, y después se pulsa `Jugar`
- **THEN** en los 60 frames del menú la sonda informa de 0 sprites de jugador, enemigo, cadáver, proyectil, pulso y
  gema
- **AND** en el primer frame de la partida nueva hay 0 cadáveres y no hay errores no capturados

### Requirement: Aspecto de proyectiles y gemas
El sistema SHALL pintar cada proyectil con el aspecto `projectiles.<weapon>` del arma que lo disparó (campo `weapon`
del snapshot, ver `auto-weapons`), o con `default` si no hay entrada, y cada gema con el aspecto `gem` (o `default`).
Proyectiles y gemas reproducen `idle`. El pulso de Tests no usa el manifiesto: conserva su anillo.

#### Scenario: Proyectil por arma
- **GIVEN** un contenido con dos armas de proyectil `linter` y `formatter`, un manifiesto con
  `projectiles.linter` y sin `projectiles.formatter`, y un snapshot con 1 proyectil de cada arma
- **WHEN** se pinta el snapshot
- **THEN** el proyectil de `linter` usa el aspecto `projectiles.linter` y el de `formatter` el aspecto `default`

#### Scenario: Gema
- **GIVEN** el manifiesto del repositorio y un snapshot con 3 gemas
- **WHEN** se pinta el snapshot
- **THEN** hay 3 sprites de gema, cada uno con el aspecto `gem` en la posición de una gema distinta (error ≤ 0,001)

#### Scenario: Pulso sin manifiesto
- **GIVEN** un manifiesto mínimo (solo `default`) y un snapshot con 1 pulso de radio 90 en (480, 270)
- **WHEN** se pinta el snapshot
- **THEN** hay 1 anillo de radio 90 centrado en (480, 270) y ningún sprite del manifiesto para el pulso

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, el recuento de sprites
visibles en el último frame pintado, por tipo: jugador, enemigo (vivo), cadáver, proyectil, pulso y gema, y, para
cada tipo, cuántos de ellos usan placeholder. Un sprite oculto por el parpadeo del jugador cuenta como no visible.
La sonda funciona también en modo menú (todos los recuentos a 0). Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT
cambiar la simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, proyectil, pulso y gema son iguales en número a los
  enemigos, proyectiles, pulsos y gemas del snapshot, y el de jugador vale 1 salvo en los frames en que el parpadeo
  lo oculta, que vale 0
- **AND** el recuento de cadáveres es ≤ `maxCorpses` en todos ellos

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los seis recuentos valen 0

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

## MODIFIED Requirements
<!-- Ninguno: capacidad nueva. -->

## REMOVED Requirements
<!-- Ninguno. -->
