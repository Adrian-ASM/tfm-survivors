# Spec delta · sprite-rendering

## MODIFIED Requirements

### Requirement: Aspectos de los recogibles y de las vetas
El sistema SHALL definir en los datos de aspecto, validados con zod en el arranque con las reglas de "Datos de aspecto
validados":
- un aspecto por tipo de recogible: `xp` (la gema), `gold`, `wood`, `meat` y `stone`; los tipos con aspecto MUST ser
  exactamente los de la unión de tipos de recogible (ver "Recogibles con tipo" en `xp-gems`);
- para `stone`, un aspecto por **roca**: exactamente `small`, `medium` y `large`, con las hojas `Deco/04.png`,
  `Deco/05.png` y `Deco/06.png` de Update 010 respectivamente, tres ficheros distintos, cada uno con su tamaño de frame
  real (no tiene por qué ser el de las demás hojas de recogible) y animación `idle`;
- en el aspecto de **cada tipo de enemigo**, su **roca** (`rock`): `small`, `medium` o `large`, obligatoria (la
  completitud por tipo es la de "Datos de aspecto validados": exactamente los tipos de `content/enemies.json`);
- un aspecto de veta activa y uno de veta agotada;
- un color de reserva `#RRGGBB` por tipo de recogible (uno solo para `stone`, común a sus tres rocas) y uno para la
  veta, distintos dos a dos, distintos de los colores del mapa (`trunk`, `water`, `bridge`, `castle`), de los de las
  estructuras y del de la oveja.

Los aspectos `gold`, `wood` y `meat`, los tres de `stone` y los dos de veta tienen hoja y animación `idle`; la hoja de
`meat` es `M_Idle.png`. El aspecto `xp` tiene una hoja del pack distinta de las de `gold`, `wood`, `meat` y `stone` con
animación `idle`, o bien se declara **sin hoja**, como forma de color con su color de reserva; un aspecto `xp` sin hoja no
cuenta nunca como reserva en la sonda (como los avisos) y no exige `idle`. En pantalla, XP, oro, madera, carne y piedra
MUST ser distinguibles: hojas distintas o, si `xp` no tiene hoja, forma de color frente a sprite. Cada recogible `stone`
se pinta con el aspecto de la roca que declara el aspecto del tipo de enemigo de su origen (`source`, ver "Recogibles
con tipo" en `xp-gems`); una piedra sin origen o con un origen sin aspecto se pinta con la roca `medium`. El icono de
piedra del HUD usa siempre la roca `medium`. La roca la decide solo el render: no forma parte de la simulación ni cambia
el valor ni el radio de la piedra. Un tipo sin aspecto, un aspecto de un tipo inexistente (por ejemplo `potion`), una
roca de `stone` ausente o desconocida, un tipo de enemigo sin `rock` o con un valor distinto de las tres, un color
ausente, con otro formato o repetido MUST hacer fallar el arranque con un error que nombre el tipo, la roca o el campo.

**Reserva**: si la hoja de un aspecto de recogible falla al cargar o no contiene su frame, los recogibles de ese tipo (en
la piedra, los de esa roca), y solo ellos, se pintan con la forma rellena de "Aspecto de reserva ante un fallo de carga"
con el color de su tipo; si falla una hoja de veta, las vetas en ese estado se pintan como un círculo relleno del color
de la veta, de radio su radio de contacto, centrado en su posición. Ningún fallo rompe la partida ni produce errores no
capturados.

<!-- Escenarios vivos sin cambios: "Reserva de un tipo de recogible" y "Reserva de la carne" (sin piedras en el
     snapshot). "Datos del repositorio" y "Datos inválidos" se sustituyen por los de abajo. -->

#### Scenario: Datos del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** hay aspecto para exactamente `xp`, `gold`, `wood`, `meat` y `stone`, aspecto de veta activa y de veta agotada,
  y colores de reserva para los cinco tipos y para la veta, distintos dos a dos
- **AND** la hoja de `gold` es `G_Idle.png`, la de `wood` `W_Idle.png`, la de `meat` `M_Idle.png`, y la de `xp`, si la
  tiene, es otra distinta de esas y de las de `stone`
- **AND** `stone` tiene exactamente las rocas `small`, `medium` y `large`, con las hojas `Deco/04.png`, `Deco/05.png` y
  `Deco/06.png`, cuyo tamaño de frame cabe en la hoja versionada
- **AND** el aspecto de cada tipo de enemigo (`goblin-torch`, `goblin-tnt`, `goblin-barrel` y `goblin-tnt-guard`) tiene
  `rock` en `small`, `medium` o `large`

#### Scenario: Datos inválidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: sin aspecto `wood`; sin aspecto `meat`; sin aspecto
  `stone`; con un aspecto extra `potion`; sin aspecto de veta agotada; la escala de `gold` 0; el color de reserva de
  `wood` igual al de `gold`; el color de reserva de `meat` igual al de la veta; el color de la veta `"amarillo"`; `stone`
  sin la roca `medium`; `stone` con una roca extra `huge`; la escala de la roca `large` 0; el color de `stone` igual al
  de la oveja; el aspecto de `goblin-tnt` sin `rock`; o el de `goblin-torch` con `rock` `huge`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `wood`, `meat`, `stone`, `potion`, la veta agotada, la escala de
  `gold`, el color de `wood`, el color de `meat`, el color de la veta, `medium`, `huge`, la escala de `large`, el color
  de `stone`, `goblin-tnt` y `goblin-torch` respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Cada piedra con la roca de su origen
- **GIVEN** los datos de aspecto con `rock` `small` en `goblin-torch`, `medium` en `goblin-tnt` y `large` en
  `goblin-tnt-guard`, todas las hojas cargadas y un snapshot con 3 recogibles `stone` de esos tres orígenes y 1 sin
  origen
- **WHEN** se pinta el snapshot
- **THEN** la de `goblin-torch` usa la hoja `Deco/04.png`, la de `goblin-tnt` `Deco/05.png`, la de `goblin-tnt-guard`
  `Deco/06.png` y la sin origen `Deco/05.png`, cada una con el origen de su aspecto en la posición de su recogible
  (error ≤ 0,001)

#### Scenario: Cambiar la roca es solo de datos
- **GIVEN** los datos de aspecto del repositorio con la `rock` de `goblin-torch` cambiada a `large`
- **WHEN** se pinta un snapshot con 1 recogible `stone` de origen `goblin-torch`
- **THEN** se pinta con `Deco/06.png`, sin cambios de código ni de contenido de recursos

#### Scenario: Reserva de una roca
- **GIVEN** `rock` `small` en `goblin-torch` y `large` en `goblin-tnt-guard`, un snapshot con 1 recogible `stone` de
  origen `goblin-torch` en (700, 400), 1 de origen `goblin-tnt-guard` y 1 `gold`, y la hoja `Deco/04.png` sin cargar
- **WHEN** se pinta el snapshot
- **THEN** la piedra de `goblin-torch` es una forma del color de `stone` de 10 px de diámetro centrada en (700, 400), la
  de `goblin-tnt-guard` se pinta con `Deco/06.png` y el `gold` con `G_Idle`
- **AND** la sonda cuenta 1 en `sprites.pickups.stone.placeholder` y no hay errores no capturados

#### Scenario: Pintar la piedra no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con las tres hojas de la piedra sin
  cargar, las escalas de sus rocas multiplicadas por 2 y la `rock` de todos los tipos de enemigo cambiada
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, en el último frame pintado:
- el recuento de sprites visibles por tipo: fondo, jugador, enemigo vivo, cadáver, oveja, proyectil, pulso, gema
  (recogible `xp`), recogible `gold`, recogible `wood`, recogible `meat`, recogible `stone` (`sprites.pickups.stone`,
  con `visible` y `placeholder`), dinamita, aviso y
  explosión; y por tipo y por aspecto de enemigo, de oveja, de recogible (en `stone`, sumando sus tres rocas), de
  dinamita y de explosión, cuántos usan aspecto de reserva (los avisos nunca, ni la gema sin hoja);
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
los recogibles (montones, carne y piedras incluidos) y las ovejas no forman parte del plan del mapa ni de sus objetos.

Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador, enemigo, cadáver, oveja,
proyectil, pulso, recogibles de cada tipo, dinamita, aviso, explosión, celdas del mapa, elementos del mapa,
estructuras, vetas, objetos del mapa y `drawn` valen 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT cambiar la
simulación ni lo que se pinta.

<!-- Escenarios vivos sin cambios: todos los de este requisito salvo "Recuento coherente con el snapshot", "Totales del
     mapa con estructuras y vetas" y "Sonda en el menú", que se sustituyen por los de abajo. -->

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, oveja, proyectil, pulso, dinamita, aviso y explosión son
  iguales en número a los enemigos, ovejas, proyectiles, pulsos, dinamitas, avisos y explosiones del snapshot, los de
  gema, `gold`, `wood`, `meat` y `stone` a los recogibles de cada tipo del snapshot, y el de jugador vale 1 salvo en los
  frames en que el parpadeo lo oculta, que vale 0
- **AND** los sprites de enemigo por clase de estado coinciden con los enemigos del snapshot en cada clase, y los de
  oveja por estado con las ovejas del snapshot en cada estado
- **AND** las vetas pintadas activas y agotadas coinciden con las del snapshot en cada estado
- **AND** el recuento de cadáveres es ≤ 64 en todos
- **AND** las celdas del mapa pintadas por tipo son las mismas en los 600 frames e iguales a los recuentos del mapa
  de la sonda

#### Scenario: Totales del mapa con estructuras y vetas
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa y los recuentos de la sonda, con una ventana de 960 × 540, de 1.280 × 720 y
  de 3.840 × 2.160, y con el jugador en el centro del mundo y en (16, 16)
- **THEN** en todos los casos las celdas pintadas por tipo, los elementos del mapa pintados y con reserva, las
  estructuras pintadas, las vetas pintadas y los objetos del mapa son iguales entre sí
- **AND** las celdas pintadas por tipo, los elementos del mapa, las estructuras, las vetas y los objetos del mapa son
  iguales a los de antes de este change (701 y 784 objetos respectivamente), ≤ 1.000, y ninguno es una piedra

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los recuentos de jugador, enemigo, cadáver, oveja, proyectil, pulso, gema, `gold`, `wood`, `meat`, `stone`,
  dinamita, aviso, explosión, celdas del mapa, elementos del mapa, estructuras, vetas, objetos del mapa y `drawn`
  valen 0

#### Scenario: Recuento de piedras por roca agregado
- **GIVEN** `rock` `small` en `goblin-torch`, `medium` en `goblin-tnt` y `large` en `goblin-tnt-guard`, un snapshot con
  2 recogibles `stone` de origen `goblin-torch`, 1 de `goblin-tnt` y 3 de `goblin-tnt-guard`, y la hoja `Deco/06.png`
  sin cargar
- **WHEN** se pinta y se lee la sonda
- **THEN** `sprites.pickups.stone` informa de 6 visibles y 3 con reserva (`placeholder`)
