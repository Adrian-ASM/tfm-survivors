# Spec delta · sprite-rendering

<!-- Change 0023-sheep-meat: sprites animados de la oveja (`HappySheep_Idle`, `HappySheep_Bouncing`) y de la carne
     (`M_Idle`) de Tiny Swords Update 010, su reserva y la sonda. Sin barra de vida en la oveja (como en enemigos y
     estructuras) ni aviso visual de curación aparte: basta la barra de vida del jugador en el HUD. La oveja de prueba
     es la de `sheep` (radio 20). -->

## ADDED Requirements

### Requirement: Pintado de las ovejas
El sistema SHALL pintar en cada frame exactamente un sprite visible por cada oveja del último snapshot (ver `sheep`),
en su posición (error ≤ 0,001), asociado por identificador, con el aspecto de oveja de los datos de aspecto (hoja,
escala y origen, ver "Escala y origen"), en la capa (6) de "Capas del mapa y de las entidades", por encima de los
recogibles y por debajo del jugador y de los enemigos:
- una oveja en `graze` reproduce la animación `idle` (hoja `HappySheep_Idle`, 8 fotogramas);
- una oveja en `wander` o en `flee` reproduce la animación `bounce` (hoja `HappySheep_Bouncing`, 6 fotogramas);
- la oveja mira hacia donde se mueve en x: se voltea horizontalmente cuando su x baja respecto al frame anterior y deja
  de estarlo cuando sube; sin movimiento horizontal conserva su orientación;
- una oveja que indica daño reciente muestra la misma indicación de daño que los enemigos (ver "Indicación visual de
  daño, proyectiles y pulsos" en `auto-weapons`), sin detener su animación ni cambiar su tamaño o posición; no hay
  barra de vida ni números de daño.

Una oveja muerta MUST NOT quedar visible desde el primer frame que pinta un snapshot sin ella; no deja cadáver. Los
datos de aspecto tienen un aspecto de oveja con las animaciones `idle` y `bounce` y un color de reserva `#RRGGBB`,
distinto de los de los recogibles, la veta, las estructuras y el mapa; un aspecto o una animación ausentes, o un color
ausente, con otro formato o repetido MUST hacer fallar el arranque con un error que nombre el campo.

**Reserva**: si una hoja de la oveja falla al cargar o no contiene un frame de sus animaciones, todas las ovejas se
pintan con la forma rellena de "Aspecto de reserva ante un fallo de carga" (diámetro 2 × su radio) con el color de la
oveja, sin errores no capturados. Con el mapa vacío sin ovejas declaradas no se pinta ninguna; en modo menú no se ve
ninguna; al empezar una partida nueva no queda visible ninguna oveja de la anterior. Las ovejas no forman parte del plan
del mapa ni de sus objetos (`drawn` y los objetos del mapa no cambian por ellas). Pintar las ovejas MUST NOT cambiar la
simulación.

#### Scenario: Oveja en pasto y en huida
- **GIVEN** la oveja de prueba en (1.000, 1.000), los datos de aspecto del repositorio con todas las hojas cargadas y
  el jugador quieto en (1.150, 1.000)
- **WHEN** se pintan los snapshots de los ticks 0 y 1
- **THEN** en el del tick 0 hay 1 sprite de oveja en (1.000, 1.000) con la animación `idle` de `HappySheep_Idle`
- **AND** en el del tick 1 el mismo sprite está en (997, 1.000), con la animación `bounce` de `HappySheep_Bouncing`,
  volteado horizontalmente

#### Scenario: Muertes y reapariciones
- **GIVEN** un snapshot con 5 ovejas ya pintado
- **WHEN** se pinta un snapshot en el que 2 han muerto y 1 ha reaparecido
- **THEN** hay exactamente 4 sprites de oveja visibles, cada uno en la posición de una oveja distinta del snapshot

#### Scenario: Reserva de la oveja
- **GIVEN** la hoja `HappySheep_Bouncing` sin cargar y un snapshot con 2 ovejas de radio 20, una en `graze` en
  (1.000, 1.000) y otra en `flee`
- **WHEN** se pinta el snapshot
- **THEN** las 2 ovejas son formas del color de la oveja de 40 px de diámetro centradas en su posición (error ≤ 0,001)
- **AND** la sonda cuenta 2 ovejas con reserva y no hay errores no capturados

#### Scenario: Indicación de daño en una oveja
- **GIVEN** una oveja que indica daño reciente en los snapshots de T a T + 3
- **WHEN** se pintan los snapshots de T a T + 4
- **THEN** su sprite muestra la indicación de daño de T a T + 3 y no en T + 4, con el mismo tamaño y posición que sin
  ella

#### Scenario: Datos de la oveja inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: sin aspecto de oveja; el aspecto de oveja
  sin la animación `bounce`; el color de la oveja igual al de `wood`; o el color de la oveja `"blanco"`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el aspecto de oveja, `bounce` y el color de la oveja en los dos
  últimos casos
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Pintar las ovejas no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con las hojas de la oveja y de la
  carne sin cargar
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

#### Scenario: Ovejas fuera del plan del mapa
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa sin navegador
- **THEN** los objetos del mapa son los mismos que antes del change (701 y 784) y ninguno es de una oveja

## MODIFIED Requirements

### Requirement: Aspectos de los recogibles y de las vetas
El sistema SHALL definir en los datos de aspecto, validados con zod en el arranque con las reglas de "Datos de aspecto
validados":
- un aspecto por tipo de recogible: `xp` (la gema), `gold`, `wood` y `meat`; los tipos con aspecto MUST ser exactamente
  los de la unión de tipos de recogible (ver "Recogibles con tipo" en `xp-gems`);
- un aspecto de veta activa y uno de veta agotada;
- un color de reserva `#RRGGBB` por tipo de recogible y uno para la veta, distintos dos a dos, distintos de los colores
  del mapa (`trunk`, `water`, `bridge`, `castle`) y de los de las estructuras.

Los aspectos `gold`, `wood` y `meat` y los dos de veta tienen hoja y animación `idle`; la hoja de `meat` es `M_Idle.png`.
El aspecto `xp` tiene una hoja del pack distinta de las de `gold`, `wood` y `meat` con animación `idle`, o bien se
declara **sin hoja**, como forma de color con su color de reserva; un aspecto `xp` sin hoja no cuenta nunca como reserva
en la sonda (como los avisos) y no exige `idle`. En pantalla, XP, oro, madera y carne MUST ser distinguibles: hojas
distintas o, si `xp` no tiene hoja, forma de color frente a sprite. Un tipo sin aspecto, un aspecto de un tipo
inexistente (por ejemplo `potion`), un color ausente, con otro formato o repetido MUST hacer fallar el arranque con un
error que nombre el tipo o el campo.

**Reserva**: si la hoja de un aspecto de recogible falla al cargar o no contiene su frame, los recogibles de ese tipo,
y solo ellos, se pintan con la forma rellena de "Aspecto de reserva ante un fallo de carga" con el color de su tipo;
si falla una hoja de veta, las vetas en ese estado se pintan como un círculo relleno del color de la veta, de radio su
radio de contacto, centrado en su posición. Ningún fallo rompe la partida ni produce errores no capturados.

#### Scenario: Datos del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** hay aspecto para exactamente `xp`, `gold`, `wood` y `meat`, aspecto de veta activa y de veta agotada, y
  colores de reserva para los cuatro tipos y para la veta, distintos dos a dos
- **AND** la hoja de `gold` es `G_Idle.png`, la de `wood` `W_Idle.png`, la de `meat` `M_Idle.png`, y la de `xp`, si la
  tiene, es otra distinta de las tres

#### Scenario: Datos inválidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: sin aspecto `wood`; sin aspecto `meat`; con un aspecto
  extra `potion`; sin aspecto de veta agotada; la escala de `gold` 0; el color de reserva de `wood` igual al de `gold`;
  el color de reserva de `meat` igual al de la veta; o el color de la veta `"amarillo"`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `wood`, `meat`, `potion`, la veta agotada, la escala de `gold`, el
  color de `wood`, el color de `meat` y el color de la veta respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Reserva de un tipo de recogible
- **GIVEN** un snapshot con 2 recogibles `xp`, 2 `gold`, 2 `wood` y 2 `meat` y la hoja de `wood` sin cargar
- **WHEN** se pinta el snapshot
- **THEN** los 2 `wood` son formas del color de `wood` de 10 px de diámetro (2 × `gemRadius`) centradas en su posición
  (error ≤ 0,001), y los `gold`, los `meat` y los `xp` se pintan con su aspecto del repositorio
- **AND** la sonda cuenta 2 recogibles `wood` con reserva y 0 de los otros tres tipos

#### Scenario: Reserva de la carne
- **GIVEN** un snapshot con 1 recogible `meat` en (700, 400) y 1 `gold`, y la hoja `M_Idle` sin cargar
- **WHEN** se pinta el snapshot
- **THEN** el `meat` es una forma del color de `meat` de 10 px de diámetro centrada en (700, 400) y el `gold` se pinta
  con `G_Idle`
- **AND** la sonda cuenta 1 recogible `meat` con reserva y no hay errores no capturados

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, en el último frame pintado:
- el recuento de sprites visibles por tipo: fondo, jugador, enemigo vivo, cadáver, oveja, proyectil, pulso, gema
  (recogible `xp`), recogible `gold`, recogible `wood`, recogible `meat`, dinamita, aviso y explosión; y por tipo y por
  aspecto de enemigo, de oveja, de recogible, de dinamita y de explosión, cuántos usan aspecto de reserva (los avisos
  nunca, ni la gema sin hoja);
- por clase de estado de comportamiento (persecución, mecha, carga, espera, patrulla, alerta y vuelta), cuántos
  sprites de enemigo vivo hay, y por estado de oveja (`graze`, `wander` y `flee`), cuántos sprites de oveja hay;
- el número de celdas del mapa pintadas por tipo (`trunk`, `water`, `bridge`, `castle`), con arte o con reserva;
- por elemento del mapa, cuántos se pintan y cuántos de ellos con reserva: agua (celdas `water`), orilla (celdas de
  orilla con su pieza), espuma (celdas de orilla con espuma), árbol (celdas `trunk`), copa (árboles con copa), puente
  (celdas `bridge`) y castillo (0 o 1);
- por tipo de estructura, cuántas se pintan intactas, cuántas como ruina y cuántas de ellas con reserva;
- cuántas vetas se pintan activas, cuántas agotadas y cuántas de ellas con reserva;
- el número de objetos de escena usados para pintar el mapa, estructuras y vetas incluidas;
- el número de esos objetos **dibujados** en el último frame (`drawn`, ver "Recorte del arte del mapa por cámara"),
  con 0 ≤ `drawn` ≤ objetos del mapa.

Los recuentos de celdas pintadas, de elementos del mapa, de estructuras y de vetas (pintados y con reserva) y de
objetos del mapa son del plan entero de la partida: MUST NOT depender de la cámara, de la ventana ni del recorte. Los de
celdas, de elementos del mapa, de estructuras, de vetas y de objetos del mapa conservan el significado y el valor que
tenían antes de este change para la misma semilla y el mismo contenido. Solo `drawn` depende del recorte. Los peligros,
los recogibles (montones y carne incluidos) y las ovejas no forman parte del plan del mapa ni de sus objetos.

Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador, enemigo, cadáver, oveja,
proyectil, pulso, recogibles de cada tipo, dinamita, aviso, explosión, celdas del mapa, elementos del mapa,
estructuras, vetas, objetos del mapa y `drawn` valen 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT cambiar la
simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, oveja, proyectil, pulso, dinamita, aviso y explosión son
  iguales en número a los enemigos, ovejas, proyectiles, pulsos, dinamitas, avisos y explosiones del snapshot, los de
  gema, `gold`, `wood` y `meat` a los recogibles de cada tipo del snapshot, y el de jugador vale 1 salvo en los frames
  en que el parpadeo lo oculta, que vale 0
- **AND** los sprites de enemigo por clase de estado coinciden con los enemigos del snapshot en cada clase, y los de
  oveja por estado con las ovejas del snapshot en cada estado
- **AND** las vetas pintadas activas y agotadas coinciden con las del snapshot en cada estado
- **AND** el recuento de cadáveres es ≤ 64 en todos
- **AND** las celdas del mapa pintadas por tipo son las mismas en los 600 frames e iguales a los recuentos del mapa
  de la sonda

#### Scenario: Barril en mecha y su explosión en el navegador [E2E]
- **GIVEN** la build de producción servida con `?e2e&manual&map=empty&seed=s`, con s una semilla de 1..50, sin input
  de movimiento y con la política de elección fija
- **WHEN** se avanza con `step(n)` y se lee la sonda tras cada llamada, hasta que la partida termina (antes del tick
  10.800, ver "Jugador quieto pierde también con el mapa vacío" en `run-outcome`)
- **THEN** en ≥ 1 lectura la sonda informa de ≥ 1 aviso y ≥ 1 sprite de enemigo en mecha, y en ≥ 1 lectura posterior
  de ≥ 1 explosión, todos sin aspecto de reserva
- **AND** en cada lectura los recuentos de aviso, dinamita y explosión de la sonda son iguales a los del snapshot y no
  hay errores no capturados

#### Scenario: Estructuras y guardias en el navegador [E2E]
- **GIVEN** la build de producción servida con `?e2e&manual&seed=42` (mapa real), sin input de movimiento y con la
  política de elección fija
- **WHEN** arranca la partida, se lee la sonda, y después se avanza con `step(n)` hasta superar en 1 tick el
  intervalo de nacimiento de `goblin-house` y se lee la sonda de nuevo
- **THEN** en ambas lecturas las estructuras pintadas intactas y como ruina, por tipo, son iguales a las no
  destruidas y destruidas del snapshot, y ninguna usa reserva
- **AND** en la segunda lectura hay ≥ 1 sprite de enemigo en patrulla, sin aspecto de reserva, y no hay errores no
  capturados
- **AND** en ambas lecturas los sprites `wood` y las vetas pintadas activas son iguales a los montones y las vetas
  activas del snapshot, sin reserva
- **AND** en ambas lecturas los sprites de oveja son iguales en número y por estado a las ovejas del snapshot (en la
  primera, tantas como el tope de ovejas vivas del contenido), y los de `meat` a los recogibles `meat` del snapshot,
  ninguno con reserva

#### Scenario: Totales del mapa con estructuras y vetas
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa y los recuentos de la sonda, con una ventana de 960 × 540, de 1.280 × 720 y
  de 3.840 × 2.160, y con el jugador en el centro del mundo y en (16, 16)
- **THEN** en todos los casos las celdas pintadas por tipo, los elementos del mapa pintados y con reserva, las
  estructuras pintadas, las vetas pintadas y los objetos del mapa son iguales entre sí
- **AND** las celdas pintadas por tipo, los elementos del mapa, las estructuras, las vetas y los objetos del mapa son
  iguales a los de antes de este change (701 y 784 objetos respectivamente), ≤ 1.000

#### Scenario: Objetos dibujados con la cámara [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=7` (mapa real), una ventana de 1.280 × 720 y la flecha
  derecha mantenida
- **WHEN** arranca la partida y se lee la sonda, y después se llama a `step(60)` 20 veces, eligiendo la opción 0 si se
  abre una oferta, y se lee la sonda tras cada llamada
- **THEN** en cada lectura 0 < `drawn` < objetos del mapa, y los objetos del mapa valen lo mismo en todas las
  lecturas
- **AND** en ≥ 1 lectura `drawn` es distinto del de la primera

#### Scenario: `drawn` igual al recorte
- **GIVEN** una partida con el mapa real de la semilla 42 y una ventana de 1.280 × 720
- **WHEN** se pinta un frame con el jugador en (1.920, 1.080) y otro con el jugador en (16, 16)
- **THEN** en cada frame `drawn` es igual al número de objetos del plan, estructuras y vetas incluidas, que da
  "Recorte del arte del mapa por cámara" con el rectángulo visible de ese frame

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los recuentos de jugador, enemigo, cadáver, oveja, proyectil, pulso, gema, `gold`, `wood`, `meat`,
  dinamita, aviso, explosión, celdas del mapa, elementos del mapa, estructuras, vetas, objetos del mapa y `drawn`
  valen 0

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`
