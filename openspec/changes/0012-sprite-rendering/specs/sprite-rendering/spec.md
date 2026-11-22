# Spec delta · sprite-rendering

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/sprite-rendering/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Sustituye por completo al delta aparcado de la premisa "arte solo local" (manifiesto con aspecto `default`,
     build sin arte, placeholders como camino normal, `weapon` en el proyectil): nada de aquello sigue vigente. -->

> Capacidad nueva. Purpose propuesto para la spec viva: el aspecto en pantalla de la partida con el arte versionado
> de Tiny Swords Update 010 (jugador Arquero, un goblin por tipo de enemigo, flechas, gemas y suelo de hierba), su
> animación por estado, la orientación, la animación de muerte de los enemigos y su limpieza, la carga compatible con
> la CSP, el aspecto de reserva ante un fallo de carga y la sonda de recuento de sprites para E2E. El pulso de Tests
> conserva su anillo (ver `auto-weapons`). La procedencia y la licencia del arte son la capacidad `asset-provenance`.
>
> Convenciones de este delta:
> - **Datos de aspecto**: los datos que definen cómo se pinta cada elemento. Su ubicación y su formato los fija el
>   design; los nombres de campo de los escenarios son descriptivos. **Aspecto**: la entrada de un elemento. Hay un
>   aspecto para el jugador, uno por cada tipo de enemigo, uno para el proyectil, uno para la gema, uno para el
>   cadáver y uno para el fondo.
> - **Hoja**: un PNG de la carpeta de assets versionada (ver `asset-provenance`), dividido en frames de tamaño fijo.
> - **Ids goblin**: `goblin-torch`, `goblin-tnt` y `goblin-barrel` heredan, en ese orden, los stats de `bug`,
>   `memory-leak` y `merge-conflict`.
> - **Aspecto de reserva**: forma generada por el juego, sin ficheros, que sustituye a una hoja que no carga.
> - **Cadáver**: sprite que reproduce la animación de muerte de un enemigo dado de baja. No es un enemigo: no figura
>   en el snapshot, no colisiona y no cuenta como sprite de enemigo.
> - **Frame**: un pintado del adaptador de render. Salvo que se diga otra cosa, los frames duran 16,667 ms.
> - **Mundo detenido**: la partida está en pausa (ver `main-menu`), eligiendo mejora (ver `run-state`) o terminada.
> - Los escenarios con `?e2e` pueden usar la sonda `window.__sprint`; sin `?e2e` la sonda no existe.

## ADDED Requirements

### Requirement: Datos de aspecto validados
El sistema SHALL definir el aspecto de cada elemento pintado solo en datos, validados con zod en el arranque antes
de crear el menú o la partida, sin números mágicos en el código de render. Cada aspecto tiene:
- la hoja: ruta relativa dentro de la carpeta de assets versionada, no vacía, terminada en `.png`, sin segmentos
  `..`, sin `/` inicial y sin esquema (`http:`, `data:`, `blob:`…), que figura en la nota de procedencia (ver
  `asset-provenance`);
- el ancho y el alto del frame: enteros ≥ 1;
- la escala: número > 0, independiente del radio del elemento en el snapshot;
- el origen: `x` e `y` en [0, 1];
- la orientación del dibujo sin voltear: derecha o izquierda;
- las animaciones: cada una con una lista de ≥ 1 índices de frame enteros ≥ 0, unos fps > 0 y si va en bucle.

Animaciones obligatorias: `idle` y `walk` en el jugador y en cada tipo de enemigo; `death` sin bucle en el cadáver;
`idle` en el proyectil, la gema y el fondo. Los datos incluyen además el tope de cadáveres visibles a la vez (entero
≥ 1). Los tipos con aspecto MUST ser exactamente los `id` de `content/enemies.json`. Un campo desconocido, un campo
obligatorio ausente, un valor fuera de rango, un tipo de enemigo sin aspecto o un aspecto de un tipo inexistente
MUST hacer fallar el arranque con un error que nombre el campo o el id, igual que el resto del contenido inválido:
no se muestra el menú ni empieza ninguna partida. Los datos de aspecto MUST NOT cambiar la simulación.

#### Scenario: Datos del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** los datos de aspecto son válidos, el tope de cadáveres vale 64 y hay aspecto para el jugador, el
  proyectil, la gema, el cadáver, el fondo y exactamente los tipos `goblin-torch`, `goblin-tnt` y `goblin-barrel`

#### Scenario: Valores fuera de rango
- **GIVEN** los datos del repositorio con, en un caso cada vez en el aspecto de `goblin-torch`: ancho de frame 0,
  alto de frame 1,5, escala 0, escala −1, origen `x` 1,1, origen `y` −0,1, fps de `walk` 0, frames de `walk` `[]`,
  `[-1]` o `[1.5]`; y en otro caso el tope de cadáveres 0 o 2,5
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

#### Scenario: Rutas de hoja no admitidas
- **GIVEN** los datos del repositorio con la hoja de `goblin-torch` igual, en un caso cada vez, a `""`,
  `"../secreto.png"`, `"/torch.png"`, `"https://ejemplo.com/torch.png"`, `"data:image/png;base64,AAAA"`,
  `"torch.gif"` o una ruta `.png` que no figura en la nota de procedencia
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra la hoja de `goblin-torch`

#### Scenario: Animaciones obligatorias y campos desconocidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: el jugador sin `walk`, `goblin-tnt` sin `idle`, el
  cadáver sin `death`, `death` del cadáver en bucle o un campo extra `rotation: 90` en el aspecto de la gema
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo

#### Scenario: Tipos de enemigo y aspectos desalineados
- **GIVEN** los datos del repositorio sin el aspecto de `goblin-barrel`, y en otro caso con un aspecto extra para
  `goblin-dragon`, con el contenido de enemigos por defecto
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `goblin-barrel`, y `goblin-dragon` respectivamente

#### Scenario: Datos inválidos en el arranque
- **GIVEN** unos datos de aspecto sin el aspecto del jugador
- **WHEN** se ejecuta el arranque del juego, con y sin `?e2e`
- **THEN** en ambos casos no se crea el menú ni ninguna partida y la consola informa de un error que nombra el
  aspecto del jugador (verificable sin navegador)

#### Scenario: Los aspectos no cambian la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick
  y la política de elección fija, una con los datos de aspecto del repositorio y otra con todas las escalas
  multiplicadas por 2
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Arte de Tiny Swords Update 010 por elemento
El sistema SHALL pintar, con los datos de aspecto del repositorio, cada elemento con su hoja de Update 010:
- el jugador, con una hoja de la unidad Arquero (`Archer`);
- cada tipo de enemigo, con la hoja de su unidad goblin: `goblin-torch` con `Torch`, `goblin-tnt` con `TNT` y
  `goblin-barrel` con `Barrel`, tres hojas distintas;
- el cadáver, con `Dead.png`;
- el proyectil, con `Arrow.png`;
- la gema, con una hoja del pack;
- el fondo, con un suelo de hierba del pack.

La unidad de cada hoja se comprueba con la ruta de origen que registra la nota de procedencia (ver
`asset-provenance`). Cambiar el arte de un elemento MUST requerir solo cambios de datos y de assets, no de código.

#### Scenario: Hoja de cada elemento
- **GIVEN** los datos de aspecto del repositorio y la nota de procedencia
- **WHEN** se busca en la nota la ruta de origen de la hoja de cada aspecto
- **THEN** la del jugador contiene `Archer`; las de `goblin-torch`, `goblin-tnt` y `goblin-barrel` contienen
  `Torch`, `TNT` y `Barrel` respectivamente y son tres ficheros distintos; la del cadáver termina en `Dead.png` y la
  del proyectil en `Arrow.png`
- **AND** todas las rutas de origen pertenecen a Tiny Swords Update 010

#### Scenario: Partida con arte
- **GIVEN** la build de producción servida con `?e2e&seed=42`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** en cada frame la sonda informa de 1 sprite de fondo, de 0 sprites con aspecto de reserva y de un sprite
  de jugador visible salvo en los frames en que el parpadeo lo oculta (ver `player-health`)
- **AND** en algún frame hay ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema visibles, todos con su hoja

### Requirement: Carga del arte compatible con la CSP
El sistema SHALL cargar todas las hojas sin ninguna violación de la Content Security Policy y sin cambiar sus
directivas (`img-src 'self' data:` y las demás, ver "Política de seguridad de contenido" en `progress-persistence`),
tanto al arrancar desde el menú como con `?e2e`, en `vite preview` y en la URL pública, bajo la base `/tfm-survivors/`.
La carga MUST terminar antes del primer frame que pinta un elemento de la partida: ningún elemento se pinta con una
hoja sin cargar. Con `?e2e`, la carga del arte MUST conservar el comportamiento de "Carga en modo E2E" (`main-menu`).

#### Scenario: Desde el menú
- **GIVEN** la build de producción servida sin parámetros y una prueba que escucha `securitypolicyviolation`
- **WHEN** se pulsa `Jugar` y se pintan 300 frames
- **THEN** se registran 0 eventos `securitypolicyviolation`, 0 mensajes de consola de violación de CSP y 0 errores
  no capturados

#### Scenario: Con e2e
- **GIVEN** la build de producción servida con `?e2e&seed=42` y la misma escucha
- **WHEN** termina la carga y el motor informa de 15 frames de 16,667 ms
- **THEN** la sonda informa de semilla 42, estado en curso, tick 15 y 0 sprites con aspecto de reserva
- **AND** se registran 0 eventos `securitypolicyviolation` y el menú de inicio no se ha visto

#### Scenario: Directivas sin cambios
- **GIVEN** el `index.html` fuente del repositorio tras este change
- **WHEN** un test de `npm run verify` lee su meta CSP
- **THEN** sus directivas son iguales, una a una, a las de antes del change y `img-src` es `'self' data:`

#### Scenario: Arte en la URL pública
- **GIVEN** la URL pública y el smoke remoto a demanda (ver `public-deploy`)
- **WHEN** carga la página sin parámetros y pulsa `Jugar`
- **THEN** cada hoja de los datos de aspecto se pide bajo `/tfm-survivors/` y responde 200 con tipo `image/png`
- **AND** se registran 0 eventos `securitypolicyviolation` y 0 errores no capturados

### Requirement: Aspecto de reserva ante un fallo de carga
El sistema SHALL, si la hoja de un aspecto falla al cargar o no contiene algún frame referenciado por sus animaciones,
pintar los elementos de ese aspecto con su aspecto de reserva: una forma rellena centrada en la posición del elemento
y de diámetro 2 × el radio del elemento en el snapshot, sin volteo ni rotación (en el fondo, un relleno liso del área
de juego). El fallo MUST NOT romper la partida ni producir errores no capturados, y los aspectos cuya hoja carga bien
siguen con su arte. El aspecto de reserva conserva el resto del comportamiento de esta spec (duración del cadáver,
parpadeo e indicación de daño) y MUST NOT depender de ficheros ni de recursos `blob:`.

#### Scenario: Hoja que no carga
- **GIVEN** la build de producción con `?e2e&seed=42` y una prueba que hace fallar la petición de la hoja de
  `goblin-torch`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** la sonda informa de que todos los sprites de `goblin-torch` usan aspecto de reserva y ningún sprite de
  otro aspecto lo usa
- **AND** la partida sigue avanzando (tick 600) y no hay errores no capturados

#### Scenario: Frame fuera de la hoja
- **GIVEN** un aspecto de `goblin-tnt` con frame de 32 × 32 px, una hoja de 128 × 32 px (frames 0 a 3) y `walk` con
  frames `[0, 1, 2, 7]`
- **WHEN** se pinta un `goblin-tnt`
- **THEN** se pinta con su aspecto de reserva y no hay errores no capturados

#### Scenario: Tamaño del aspecto de reserva
- **GIVEN** la hoja de `goblin-torch` sin cargar y un `goblin-torch` de radio 10 en (300, 200)
- **WHEN** se pinta el snapshot
- **THEN** su sprite es una forma de 20 px de diámetro centrada en (300, 200) (error ≤ 0,001)

### Requirement: Escala y origen
El sistema SHALL pintar cada sprite con arte con un tamaño en pantalla de ancho de frame × escala por alto de frame
× escala, con su origen en la posición del elemento en el snapshot, sea cual sea su radio. La hitbox del snapshot
no cambia por el tamaño visual.

#### Scenario: Escala independiente de la hitbox
- **GIVEN** un aspecto de `goblin-tnt` con frame de 192 × 192 px, escala 0,5 y origen (0,5; 0,75), y un
  `goblin-tnt` de radio 22 en (400, 300)
- **WHEN** se pinta el snapshot
- **THEN** el sprite mide 96 × 96 px y el punto del sprite en (0,5; 0,75) de su tamaño está en (400, 300)
  (error ≤ 0,001)
- **AND** con el mismo aspecto, un `goblin-tnt` de radio 30 también mide 96 × 96 px

### Requirement: Animación por estado del jugador y de los enemigos
El sistema SHALL animar el sprite del jugador y el de cada enemigo vivo según su estado, deducido al comparar el
snapshot pintado con el último snapshot pintado de un tick distinto de la misma partida:
- se mueve si su posición ha cambiado más de 0,001 px: reproduce `walk`;
- si no, reproduce `idle`;
- cada animación avanza a sus fps en tiempo de render y, en bucle, vuelve al primer frame al acabar.

Un frame que repite el tick del anterior MUST conservar el estado y la orientación de cada sprite. Un enemigo en su
primer frame pintado (recién aparecido o en un hueco reutilizado) y el jugador en el primer frame de una partida
nueva MUST NOT heredar estado ni orientación de otro elemento o de una partida anterior: se pintan en `idle` y sin
voltear. Con el mundo detenido ninguna animación avanza. Con la partida terminada, el jugador se pinta en `idle` (el
jugador no tiene animación de muerte). La animación no cambia la simulación.

#### Scenario: Quieto y andando
- **GIVEN** un aspecto del jugador con `idle` (frames `[0, 1]`, 2 fps, bucle) y `walk` (frames `[6, 7, 8, 9]`,
  10 fps, bucle)
- **WHEN** se pintan 30 frames con el jugador quieto en (480, 270) y después 30 frames con input (1, 0)
- **THEN** en los 30 primeros reproduce `idle` y en los 30 siguientes, desde el primero en que su posición cambia,
  reproduce `walk`

#### Scenario: Avance de la animación
- **GIVEN** la animación `walk` del escenario anterior en curso desde el frame f
- **WHEN** se pintan 30 frames de 16,667 ms
- **THEN** el frame de hoja mostrado en el frame f + k es el de índice ⌊k × 16,667 / 100⌋ mod 4 de `[6, 7, 8, 9]`,
  con un margen de ±1 frame de render en cada cambio

#### Scenario: Frames sin tick
- **GIVEN** un jugador con input (1, 0) y un motor que informa de frames de 8,333 ms (120 Hz), de modo que los
  frames alternan uno con tick nuevo y otro que repite el tick anterior
- **WHEN** se pintan 120 frames
- **THEN** el jugador reproduce `walk` sin voltear en los 120
- **AND** con input (0, 0) en otros 120 frames iguales reproduce `idle` en todos

#### Scenario: Umbral de movimiento
- **GIVEN** un enemigo que reproduce `walk`
- **WHEN** se pinta el snapshot del tick siguiente, con su posición cambiada 0,0005 px
- **THEN** pasa a reproducir `idle`

#### Scenario: Hueco reutilizado
- **GIVEN** un `goblin-torch` de id 7 pintado en (100, 100) andando hacia la izquierda, que muere, y un `goblin-torch` de
  id 9 que en el frame siguiente se pinta en (800, 100) con el sprite que usaba el id 7
- **WHEN** se pinta ese frame
- **THEN** el de id 9 reproduce `idle` y no está volteado

#### Scenario: Mundo detenido
- **GIVEN** un jugador y 3 enemigos que reproducen `walk` y la partida en pausa en el tick 500
- **WHEN** se pintan 300 frames en pausa
- **THEN** en los 300 cada sprite muestra el mismo frame de hoja que en el primer frame de la pausa
- **AND** lo mismo ocurre durante 300 frames con la partida eligiendo mejora y durante 300 con la partida terminada

#### Scenario: Partida terminada
- **GIVEN** un jugador que reproduce `walk` y una partida que termina con derrota en el tick n
- **WHEN** se pinta el snapshot terminado del tick n
- **THEN** el jugador se pinta en `idle` y es visible (ver `player-health`)

#### Scenario: Parpadeo con sprite animado
- **GIVEN** una vista con periodo de parpadeo 4 y el jugador andando e invulnerable desde el tick 1 durante 30 ticks
- **WHEN** se pintan los snapshots de los ticks 1 a 30
- **THEN** la visibilidad del sprite del jugador sigue "Parpadeo durante la invulnerabilidad" (`player-health`) y,
  en los ticks en que es visible, reproduce `walk`

### Requirement: Orientación
El sistema SHALL orientar los sprites según el desplazamiento (Δx, Δy) entre el snapshot pintado y el último
snapshot pintado de un tick distinto:
- jugador y enemigos: con Δx < −0,001 miran a la izquierda, con Δx > 0,001 a la derecha y, si no, conservan la
  orientación anterior. Mirar a un lado es voltear horizontalmente el dibujo si su orientación sin voltear es la
  contraria, y no voltearlo si coincide. El volteo no cambia la posición ni el tamaño del sprite;
- proyectiles: el sprite rota al ángulo atan2(Δy, Δx) (más π si el dibujo mira a la izquierda), con error
  ≤ 0,01 rad. En su primer frame, sin desplazamiento previo, la rotación es 0 (π si el dibujo mira a la izquierda);
- gemas y fondo: sin volteo ni rotación.

#### Scenario: Jugador que gira
- **GIVEN** un aspecto del jugador cuyo dibujo mira a la derecha
- **WHEN** se pintan 10 frames con input (−1, 0), después 10 con input (0, 1) y después 10 con input (1, 0)
- **THEN** está volteado desde el primer frame en que se mueve a la izquierda hasta el último con input (0, 1), y
  sin voltear desde el primer frame en que se mueve a la derecha

#### Scenario: Dibujo que mira a la izquierda
- **GIVEN** un aspecto de `goblin-barrel` cuyo dibujo mira a la izquierda y un `goblin-barrel` que se
  mueve con Δx = −1,5 por frame
- **WHEN** se pintan 10 frames
- **THEN** el sprite no está volteado en ninguno
- **AND** si se mueve con Δx = +1,5, está volteado desde el segundo frame

#### Scenario: Primer frame de una partida nueva
- **GIVEN** una partida terminada cuyo jugador miraba a la izquierda, con un dibujo que mira a la derecha
- **WHEN** se pulsa R y se pinta el tick 0 de la partida nueva
- **THEN** el jugador no está volteado

#### Scenario: Rotación de la flecha
- **GIVEN** un proyectil del Linter, con un dibujo que mira a la derecha, creado con dirección (0, 1) y pintado en
  5 frames consecutivos con un tick cada uno
- **WHEN** se lee su rotación en cada frame
- **THEN** vale 0 en el primero y π/2 (error ≤ 0,01 rad) del segundo al quinto
- **AND** con dirección (−0,6; 0,8) vale atan2(0,8; −0,6) del segundo al quinto

### Requirement: Animación de muerte de los enemigos
El sistema SHALL, cuando un enemigo pintado en el último frame queda dado de baja (su baja cuenta en las bajas, ver
`run-outcome`) y deja de figurar en el snapshot pintado, mostrar un cadáver con el aspecto de cadáver: reproduce una
vez `death` en la última posición pintada del enemigo, sin moverse, y deja de verse cuando el tiempo de render
acumulado desde su aparición alcanza nº de frames de `death` / fps segundos. Con el mundo detenido ese tiempo no
avanza. Dentro de una partida, un enemigo solo deja de figurar en el snapshot al ser dado de baja (los enemigos vivos
siguen en el snapshot terminado). MUST NOT producir cadáver:
- un elemento que deja de pintarse porque se cambia de partida (R o `Volver al menú`);
- un enemigo dado de baja que nunca llegó a pintarse (apareció y murió entre dos frames).

MUST NOT haber nunca más cadáveres visibles que el tope de cadáveres. Una baja con el tope lleno no produce cadáver
y los cadáveres en curso siguen hasta terminar. Varias bajas en el mismo frame se atienden en el orden de la lista
de enemigos del snapshot anterior hasta llenar el tope. Al terminar su animación el cadáver no deja ningún sprite
visible.

#### Scenario: Muerte y desaparición
- **GIVEN** un aspecto de cadáver con `death` de 6 frames a 15 fps (400 ms) y un `goblin-torch` pintado en (300, 200)
  que muere en el tick T
- **WHEN** se pinta el snapshot del tick T (frame 1) y los 30 frames siguientes
- **THEN** el snapshot del tick T no contiene al `goblin-torch` y no hay sprite de enemigo para él
- **AND** hay 1 cadáver visible en (300, 200) (error ≤ 0,001) al menos en los frames 1 a 23 y ninguno desde el
  frame 26

#### Scenario: Pulso que mata a varios en el mismo tick
- **GIVEN** un tope de cadáveres 64, 0 cadáveres en curso y un pulso de Tests que da de baja a 5 enemigos en el
  tick T
- **WHEN** se pinta el snapshot del tick T
- **THEN** hay 5 cadáveres visibles, cada uno en la última posición pintada de uno de los 5 enemigos

#### Scenario: Tope de cadáveres
- **GIVEN** un tope de cadáveres 64, 60 cadáveres en curso y 7 bajas en el frame siguiente, de los enemigos e1 a
  e7 en el orden de la lista
- **WHEN** se pinta ese frame
- **THEN** hay exactamente 64 cadáveres visibles: los 60 anteriores y los de e1 a e4
- **AND** e5, e6 y e7 no muestran cadáver ni sprite de enemigo, y no hay errores no capturados

#### Scenario: Tope de un cadáver
- **GIVEN** un tope de cadáveres 1, 1 cadáver en curso al que le quedan 100 ms y una baja en el frame siguiente
- **WHEN** se pinta ese frame y los 30 siguientes
- **THEN** hay 1 cadáver visible hasta que termina el primero y la segunda baja no muestra cadáver en ningún frame

#### Scenario: Fin de la partida
- **GIVEN** una partida que termina en el tick n con 8 enemigos en el snapshot pintado del tick n − 1, de los que
  2 quedan dados de baja en el tick n (las bajas suben en 2)
- **WHEN** se pinta el snapshot terminado del tick n y los 60 frames siguientes
- **THEN** en el frame del tick n aparecen exactamente 2 cadáveres y hay 6 sprites de enemigo, uno por cada enemigo
  del snapshot terminado
- **AND** en los 60 frames siguientes siguen visibles esos 6 sprites y no aparece ningún cadáver nuevo

#### Scenario: Salidas iguales a bajas
- **GIVEN** el contenido por defecto, la semilla 42 y 1.200 ticks agrupados en frames de 1 tick y, en otra
  ejecución, de 8 ticks
- **WHEN** se compara cada par de snapshots pintados consecutivos
- **THEN** en todos los pares el número de ids de enemigo que dejan de figurar es igual al aumento de las bajas

#### Scenario: Muerte a velocidad acelerada
- **GIVEN** `?e2e&speed=8` y un `goblin-torch` pintado en (300, 200) en el frame f que muere en el segundo de los 8
  ticks del frame f + 1
- **WHEN** se pinta el frame f + 1
- **THEN** hay 1 cadáver en (300, 200)

#### Scenario: Cadáver con el mundo detenido
- **GIVEN** el cadáver de "Muerte y desaparición" con 200 ms transcurridos y la partida en pausa
- **WHEN** se pintan 300 frames en pausa, se reanuda y se pintan 30 frames más
- **THEN** el cadáver es visible en los 300 frames de pausa y, tras reanudar, deja de verse entre los frames 11 y 14

#### Scenario: Muerte con aspecto de reserva
- **GIVEN** la hoja del cadáver sin cargar y su `death` de 6 frames a 15 fps
- **WHEN** muere un enemigo y se pintan 30 frames
- **THEN** su cadáver se ve con el aspecto de reserva al menos en los frames 1 a 23 y no desde el frame 26

### Requirement: Limpieza de la vista al cambiar de partida
El sistema SHALL, en el primer frame de una partida nueva tras R (ver `run-results`) y en el primer frame del menú
tras `Volver al menú` (ver `main-menu`), no dejar visible ningún cadáver ni ningún sprite de jugador, enemigo,
proyectil, pulso o gema que no corresponda al snapshot pintado (en el menú, ninguno). Los cadáveres en curso se
descartan sin terminar su animación y no reaparecen después. Cerrar la escena de la partida a mitad de una animación
MUST NOT dejar animaciones en curso ni errores no capturados.

#### Scenario: R con cadáveres en curso
- **GIVEN** una partida terminada ya pintada con 10 cadáveres en curso, 15 enemigos y 40 gemas
- **WHEN** se pulsa R y se pintan el tick 0 de la partida nueva y los 60 frames siguientes
- **THEN** hay 0 cadáveres visibles en todos esos frames y, en el primero, 1 sprite de jugador y 0 de enemigo,
  proyectil, pulso y gema

#### Scenario: Volver al menú con cadáveres en curso
- **GIVEN** `?e2e&seed=7` y una partida que se pausa en el primer frame en que la sonda informa de ≥ 1 cadáver
- **WHEN** se pulsa `Volver al menú`, se pintan 60 frames en el menú y después se pulsa `Jugar`
- **THEN** en los 60 frames del menú la sonda informa de 0 sprites de jugador, enemigo, cadáver, proyectil, pulso y
  gema
- **AND** en el primer frame de la partida nueva hay 0 cadáveres y no hay errores no capturados

### Requirement: Proyectiles, gemas, pulso y fondo
El sistema SHALL pintar un sprite de flecha por cada proyectil del snapshot y un sprite de gema por cada gema, en su
posición (error ≤ 0,001) y con el aspecto del repositorio, ambos en `idle`. El pulso de Tests no usa datos de
aspecto: conserva su anillo (ver `auto-weapons`). Mientras existe una partida, el fondo de hierba MUST cubrir todo el
área de juego visible (0, 0)–(960, 540), quedar por debajo de todos los demás elementos y no moverse; no hay mundo
mayor que la pantalla ni cámara que siga al jugador. Esta spec no fija si el fondo se ve en modo menú.

#### Scenario: Flechas y gemas
- **GIVEN** un snapshot con 3 proyectiles y 4 gemas
- **WHEN** se pinta el snapshot
- **THEN** hay 3 sprites de proyectil con el aspecto del proyectil y 4 de gema con el aspecto de la gema, cada uno
  en la posición de un elemento distinto del snapshot

#### Scenario: Pulso sin sprite
- **GIVEN** un snapshot con 1 pulso de radio 90 en (480, 270)
- **WHEN** se pinta el snapshot
- **THEN** hay 1 anillo de radio 90 centrado en (480, 270) y ningún sprite de hoja para el pulso

#### Scenario: Fondo de hierba
- **GIVEN** una partida en curso con el jugador en (480, 270) y, después, en (100, 100)
- **WHEN** se pinta cada snapshot
- **THEN** en ambos el fondo cubre el rectángulo (0, 0)–(960, 540), está por debajo del jugador, los enemigos, los
  cadáveres, los proyectiles, los pulsos y las gemas, y su posición en pantalla es la misma

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, el recuento de sprites visibles
en el último frame pintado por tipo: fondo, jugador, enemigo vivo, cadáver, proyectil, pulso y gema; y, por tipo y
por aspecto de enemigo, cuántos usan aspecto de reserva. Un sprite oculto por el parpadeo cuenta como no visible.
En modo menú los recuentos de jugador, enemigo, cadáver, proyectil, pulso y gema valen 0. Sin `?e2e` MUST NOT
existir. Leer la sonda MUST NOT cambiar la simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, proyectil, pulso y gema son iguales en número a los
  enemigos, proyectiles, pulsos y gemas del snapshot, y el de jugador vale 1 salvo en los frames en que el parpadeo
  lo oculta, que vale 0
- **AND** el recuento de cadáveres es ≤ 64 en todos

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los recuentos de jugador, enemigo, cadáver, proyectil, pulso y gema valen 0

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

## MODIFIED Requirements
<!-- Ninguno: capacidad nueva. -->

## REMOVED Requirements
<!-- Ninguno. -->
