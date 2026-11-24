# Spec delta · sprite-rendering

<!-- Aspectos por tipo de recogible (la bolsa dorada `G_Idle` pasa al oro; la XP recibe otro aspecto), madera
     `W_Idle`, vetas `GoldMine_Active`/`GoldMine_Inactive` en el plan del mapa y en el recorte por cámara, y sondas con
     recuentos por tipo. Los montones de madera son recogibles: se pintan como recogibles, no como objetos del mapa.
     Vocabulario en `resources`. -->

## ADDED Requirements

### Requirement: Aspectos de los recogibles y de las vetas
El sistema SHALL definir en los datos de aspecto, validados con zod en el arranque con las reglas de "Datos de aspecto
validados":
- un aspecto por tipo de recogible: `xp` (la gema), `gold` y `wood`; los tipos con aspecto MUST ser exactamente los
  de la unión de tipos de recogible (ver "Recogibles con tipo" en `xp-gems`);
- un aspecto de veta activa y uno de veta agotada;
- un color de reserva `#RRGGBB` por tipo de recogible y uno para la veta, distintos dos a dos, distintos de los colores
  del mapa (`trunk`, `water`, `bridge`, `castle`) y de los de las estructuras.

Los aspectos `gold` y `wood` y los dos de veta tienen hoja y animación `idle`. El aspecto `xp` tiene una hoja del pack
distinta de las de `gold` y `wood` con animación `idle`, o bien se declara **sin hoja**, como forma de color con su
color de reserva; un aspecto `xp` sin hoja no cuenta nunca como reserva en la sonda (como los avisos) y no exige
`idle`. En pantalla, XP, oro y madera MUST ser distinguibles: hojas distintas o, si `xp` no tiene hoja, forma de color
frente a sprite. Un tipo sin aspecto, un aspecto de un tipo inexistente (por ejemplo `meat`), un color ausente, con
otro formato o repetido MUST hacer fallar el arranque con un error que nombre el tipo o el campo.

**Reserva**: si la hoja de un aspecto de recogible falla al cargar o no contiene su frame, los recogibles de ese tipo,
y solo ellos, se pintan con la forma rellena de "Aspecto de reserva ante un fallo de carga" con el color de su tipo;
si falla una hoja de veta, las vetas en ese estado se pintan como un círculo relleno del color de la veta, de radio su
radio de contacto, centrado en su posición. Ningún fallo rompe la partida ni produce errores no capturados.

#### Scenario: Datos del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** hay aspecto para exactamente `xp`, `gold` y `wood`, aspecto de veta activa y de veta agotada, y colores de
  reserva para los tres tipos y para la veta, distintos dos a dos
- **AND** la hoja de `gold` es `G_Idle.png`, la de `wood` `W_Idle.png`, y la de `xp`, si la tiene, es otra distinta de
  ambas

#### Scenario: Datos inválidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: sin aspecto `wood`; con un aspecto extra `meat`; sin
  aspecto de veta agotada; la escala de `gold` 0; el color de reserva de `wood` igual al de `gold`; o el color de la
  veta `"amarillo"`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `wood`, `meat`, la veta agotada, la escala de `gold`, el color de
  `wood` y el color de la veta respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Reserva de un tipo de recogible
- **GIVEN** un snapshot con 2 recogibles `xp`, 2 `gold` y 2 `wood` y la hoja de `wood` sin cargar
- **WHEN** se pinta el snapshot
- **THEN** los 2 `wood` son formas del color de `wood` de 10 px de diámetro (2 × `gemRadius`) centradas en su posición
  (error ≤ 0,001), y los `gold` y los `xp` se pintan con su aspecto del repositorio
- **AND** la sonda cuenta 2 recogibles `wood` con reserva y 0 de los otros dos tipos

### Requirement: Pintado de las vetas
El sistema SHALL pintar, mientras existe una partida, cada veta del snapshot fija en el mundo, con el origen de su
aspecto en la posición de la veta (error ≤ 1 px), en la capa (5) de "Capas del mapa y de las entidades" (bajo las
entidades):
- una veta activa, con el aspecto de veta activa (`GoldMine_Active`);
- una veta agotada, con el aspecto de veta agotada (`GoldMine_Inactive`), desde el primer frame que pinta un snapshot
  en el que figura agotada y hasta el final de la partida, sin dejar visible su aspecto activo.

Los objetos de escena de las vetas cuentan como objetos del mapa en la sonda (ver "Sonda de render para E2E") y se
recortan con la regla de "Recorte del arte del mapa por cámara" (también al cambiar de partida, de ventana y de modo).
Con el contenido por defecto y las semillas 42 y 123, el total de objetos del mapa, estructuras y vetas incluidas, MUST
ser ≤ 1.000 (comprobado por un test sin navegador del plan de pintado). Con el mapa vacío no se pinta ninguna veta; en
modo menú no se ve ninguna; al empezar una partida nueva no queda visible ninguna veta de la anterior. Pintar las vetas
MUST NOT cambiar la simulación.

#### Scenario: Veta activa en su sitio
- **GIVEN** el mapa vacío con una veta declarada activa en (1.000, 1.000) y todas las hojas cargadas
- **WHEN** se pinta el snapshot
- **THEN** el dibujo de la veta tiene su origen en (1.000, 1.000) (error ≤ 1 px), usa la hoja `GoldMine_Active` y está
  por debajo del sprite del jugador cuando este está encima

#### Scenario: Veta agotada
- **GIVEN** la veta del escenario anterior pintada activa en el frame del tick n − 1 y agotada en el snapshot del
  tick n
- **WHEN** se pintan los snapshots de n a n + 60
- **THEN** desde el frame del tick n la veta se pinta con la hoja `GoldMine_Inactive`, con el mismo origen, y en
  ninguno de esos frames se ve la hoja `GoldMine_Active`

#### Scenario: Vetas recortadas por cámara
- **GIVEN** el contenido por defecto, la semilla 42, una ventana de 1.280 × 720 y el jugador en (16, 16)
- **WHEN** se pinta un frame
- **THEN** cada veta cuya caja intersecta el rectángulo de recorte está dibujada y ninguna otra, y `drawn` es igual al
  número de objetos del plan, estructuras y vetas incluidas, que da la regla

#### Scenario: Tope de objetos con las vetas
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa sin navegador
- **THEN** los objetos del mapa son los de antes de este change (695 y 778 respectivamente) más los de las vetas de cada
  semilla, y el total es ≤ 1.000 en ambas

## MODIFIED Requirements

### Requirement: Arte de Tiny Swords Update 010 por elemento
El sistema SHALL pintar, con los datos de aspecto del repositorio, cada elemento con su hoja de Update 010:
- el jugador, con una hoja de la unidad Arquero (`Archer`);
- cada tipo de enemigo, con la hoja de su unidad goblin: `goblin-torch` con `Torch`, `goblin-tnt` con `TNT` y
  `goblin-barrel` con `Barrel`, tres hojas distintas; `goblin-tnt-guard` con la misma hoja que `goblin-tnt`; la mecha y
  el lanzamiento usan la misma hoja que su tipo;
- el cadáver, con `Dead.png`;
- el proyectil, con `Arrow.png`;
- la gema (recogible `xp`), con una hoja del pack distinta de `G_Idle.png` y de `W_Idle.png`, o sin hoja (ver
  "Aspectos de los recogibles y de las vetas");
- el recogible `gold`, con `G_Idle.png` (bolsa de oro); el recogible `wood`, con `W_Idle.png`;
- la veta activa, con `GoldMine_Active.png`, y la agotada, con `GoldMine_Inactive.png`;
- la dinamita, con `Dynamite.png` (de la carpeta de la unidad `TNT`); la explosión, con `Explosions.png`;
- el fondo, con un suelo de hierba del pack;
- el agua, con `Water.png`; la espuma, con `Foam.png`; los árboles, con `Tree.png`; los puentes, con
  `Bridge_All.png`; el castillo, con `Castle_Blue.png` (castillo azul, como el arquero); la orilla, con una hoja de
  terreno del pack;
- la casa, con `Goblin_House.png`, y su ruina, con `Goblin_House_Destroyed.png`; la torre, con un único
  `Wood_Tower_<color>.png`, y su ruina, con `Wood_Tower_Destroyed.png`.

Los avisos no usan hoja. La unidad o el elemento de cada hoja se comprueba con la ruta de origen que registra la nota
de procedencia (ver `asset-provenance`). Del pack solo se versionan las hojas que usan los datos de aspecto (ningún
otro color de castillo ni de torre, ni `Rocks`, ni `Fire.png`, ni `Wood_Tower_InConstruction`, ni
`GoldMine_Destroyed.png`, ni las hojas de carne `M_*`, ni las de ovejas). Cambiar el arte de un elemento MUST requerir
solo cambios de datos y de assets, no de código.

#### Scenario: Hoja de cada elemento
- **GIVEN** los datos de aspecto del repositorio y la nota de procedencia
- **WHEN** se busca en la nota la ruta de origen de la hoja de cada aspecto
- **THEN** la del jugador contiene `Archer`; las de `goblin-torch`, `goblin-tnt` y `goblin-barrel` contienen
  `Torch`, `TNT` y `Barrel` respectivamente y son tres ficheros distintos; la de `goblin-tnt-guard` es el mismo
  fichero que la de `goblin-tnt`; la del cadáver termina en `Dead.png` y la del proyectil en `Arrow.png`
- **AND** la de `gold` termina en `G_Idle.png`, la de `wood` en `W_Idle.png`, la de `xp`, si la tiene, en otro fichero
  distinto de ambos, y las de la veta activa y agotada en `GoldMine_Active.png` y `GoldMine_Inactive.png`
- **AND** la de la dinamita contiene `TNT` y termina en `Dynamite.png`, y la de la explosión termina en
  `Explosions.png`
- **AND** las del agua, la espuma, el árbol, el puente y el castillo terminan en `Water.png`, `Foam.png`, `Tree.png`,
  `Bridge_All.png` y `Castle_Blue.png` respectivamente
- **AND** las de la casa y su ruina terminan en `Goblin_House.png` y `Goblin_House_Destroyed.png`, y las de la torre y
  su ruina en `Wood_Tower_<color>.png` y `Wood_Tower_Destroyed.png`
- **AND** todas las rutas de origen pertenecen a Tiny Swords Update 010

#### Scenario: Solo las hojas usadas
- **GIVEN** la lista de ficheros versionados y los datos de aspecto del repositorio
- **WHEN** se compara cada asset gráfico de la nota de procedencia con las hojas de los datos de aspecto
- **THEN** cada asset de la nota es la hoja de ≥ 1 aspecto y ningún fichero versionado contiene `Castle_Red`,
  `Castle_Yellow`, `Castle_Purple`, `Castle_Black`, `Rocks`, `Fire`, `Wood_Tower_InConstruction`,
  `GoldMine_Destroyed`, `M_Idle`, `M_Spawn` ni `HappySheep`
- **AND** de `Wood_Tower_Red`, `Wood_Tower_Blue`, `Wood_Tower_Purple` y `Wood_Tower_Yellow` hay exactamente 1 fichero
  versionado, el de la hoja de la torre

#### Scenario: Partida con arte
- **GIVEN** la build de producción servida con `?e2e&seed=42`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** en cada frame la sonda informa de 1 sprite de fondo, de 0 sprites con aspecto de reserva y de un sprite
  de jugador visible salvo en los frames en que el parpadeo lo oculta (ver `player-health`)
- **AND** en algún frame hay ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema visibles, todos con su aspecto

### Requirement: Proyectiles, gemas, pulso y fondo
El sistema SHALL pintar un sprite de flecha por cada proyectil del snapshot y un sprite de recogible por cada
recogible, de los tres tipos, en su posición (error ≤ 0,001) y con el aspecto de su tipo del repositorio (ver
"Aspectos de los recogibles y de las vetas"), ambos en `idle` (la gema sin hoja, como su forma de color). Los
recogibles de los tres tipos van en la capa (6) de "Capas del mapa y de las entidades", donde iban las gemas. El pulso
de Tests no usa datos de aspecto: conserva su anillo (ver `auto-weapons`). Mientras existe una partida, el fondo de
hierba MUST cubrir el mundo entero, (0, 0)–(ancho, alto) en coordenadas de mundo ((0, 0)–(3.840, 2.160) con el
contenido por defecto), quedar por debajo de todos los demás elementos, incluidas las celdas pintadas del mapa, y estar
fijo en el mundo: su posición de mundo no cambia entre snapshots ni al redimensionar la ventana y su posición en
pantalla solo cambia con el rectángulo visible de la cámara (ver `world-camera`). En ningún frame de una partida, con
ninguna ventana, MUST verse dentro del rectángulo visible una zona sin fondo. Esta spec no fija si el fondo se ve en
modo menú.

#### Scenario: Flechas y gemas
- **GIVEN** un snapshot con 3 proyectiles y 4 gemas
- **WHEN** se pinta el snapshot
- **THEN** hay 3 sprites de proyectil con el aspecto del proyectil y 4 de gema con el aspecto de la gema, cada uno
  en la posición de un elemento distinto del snapshot

#### Scenario: Recogibles de los tres tipos
- **GIVEN** un snapshot con 4 gemas, 2 recogibles `gold` y 3 `wood`
- **WHEN** se pinta el snapshot
- **THEN** hay 4 sprites con el aspecto `xp`, 2 con el aspecto `gold` (`G_Idle`) y 3 con el aspecto `wood` (`W_Idle`),
  cada uno en la posición de un recogible distinto de su tipo
- **AND** ningún sprite de gema usa la hoja `G_Idle`

#### Scenario: Pulso sin sprite
- **GIVEN** un snapshot con 1 pulso de radio 90 en (480, 270)
- **WHEN** se pinta el snapshot
- **THEN** hay 1 anillo de radio 90 centrado en (480, 270) y ningún sprite de hoja para el pulso

#### Scenario: Fondo de hierba en el mundo entero
- **GIVEN** el mundo por defecto y una partida en curso con el jugador en (1.920, 1.080) y, después, en (100, 100)
- **WHEN** se pinta cada snapshot
- **THEN** en ambos el fondo cubre el rectángulo de mundo (0, 0)–(3.840, 2.160), está por debajo de las celdas
  pintadas del mapa, el jugador, los enemigos, los cadáveres, los proyectiles, los pulsos y los recogibles, y su
  posición de mundo es la misma

#### Scenario: Fondo con la ventana en el tope
- **GIVEN** el mundo por defecto, una ventana de 3.840 × 2.160 (vista 2.560 × 1.440) y el jugador en (16, 16) y
  después en (3.824, 2.144)
- **WHEN** se pinta cada snapshot
- **THEN** en ambos el rectángulo visible está entero dentro del rectángulo que cubre el fondo y no se ve ninguna zona
  sin fondo dentro de la vista

#### Scenario: Fondo en las cuatro esquinas
- **GIVEN** la build de producción con `?e2e&manual&map=empty&seed=7` en una ventana de 1.280 × 720 y un input que
  lleva al jugador a las cuatro esquinas del mundo
- **WHEN** se avanza con `step(n)` hasta que el jugador ha tocado las cuatro esquinas, leyendo la sonda tras cada
  llamada
- **THEN** en cada lectura el rectángulo visible de la cámara está entero dentro del rectángulo que cubre el fondo y
  la sonda informa de fondo visible

### Requirement: Limpieza de la vista al cambiar de partida
El sistema SHALL, en el primer frame de una partida nueva tras R (ver `run-results`) y en el primer frame del menú
tras `Volver al menú` (ver `main-menu`), no dejar visible ningún cadáver ni ningún sprite de jugador, enemigo,
proyectil, pulso, recogible de cualquier tipo, veta, dinamita o explosión, ni ningún aviso, que no corresponda al
snapshot pintado (en el menú, ninguno). Los cadáveres y las explosiones en curso se descartan sin terminar su animación
y no reaparecen después. Cerrar la escena de la partida a mitad de una animación MUST NOT dejar animaciones en curso ni
errores no capturados.

#### Scenario: R con cadáveres en curso
- **GIVEN** una partida terminada ya pintada con 10 cadáveres en curso, 15 enemigos, 40 gemas, 5 recogibles `gold`,
  6 `wood`, 2 dinamitas, 3 avisos y 1 explosión, con el mapa vacío
- **WHEN** se pulsa R y se pintan el tick 0 de la partida nueva y los 60 frames siguientes
- **THEN** hay 0 cadáveres visibles en todos esos frames y, en el primero, 1 sprite de jugador y 0 de enemigo,
  proyectil, pulso, recogible, veta, dinamita, aviso y explosión

#### Scenario: R con el mapa real
- **GIVEN** una partida terminada con el mapa real de la semilla 42, con vetas agotadas y recogibles `gold` en el suelo
- **WHEN** se pulsa R (partida nueva con la semilla 43) y se pinta su primer frame
- **THEN** los sprites de recogible visibles son exactamente los montones de la semilla 43, todas las vetas pintadas
  son las de la semilla 43 y están activas, y no queda visible ninguna de la partida anterior

#### Scenario: Volver al menú con cadáveres en curso
- **GIVEN** `?e2e&seed=7` y una partida que se pausa en el primer frame en que la sonda informa de ≥ 1 cadáver
- **WHEN** se pulsa `Volver al menú`, se pintan 60 frames en el menú y después se pulsa `Jugar`
- **THEN** en los 60 frames del menú la sonda informa de 0 sprites de jugador, enemigo, cadáver, proyectil, pulso,
  recogible de cada tipo, veta, dinamita, aviso y explosión
- **AND** en el primer frame de la partida nueva hay 0 cadáveres y no hay errores no capturados

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, en el último frame pintado:
- el recuento de sprites visibles por tipo: fondo, jugador, enemigo vivo, cadáver, proyectil, pulso, gema (recogible
  `xp`), recogible `gold`, recogible `wood`, dinamita, aviso y explosión; y por tipo y por aspecto de enemigo, de
  recogible, de dinamita y de explosión, cuántos usan aspecto de reserva (los avisos nunca, ni la gema sin hoja);
- por clase de estado de comportamiento (persecución, mecha, carga, espera, patrulla, alerta y vuelta), cuántos
  sprites de enemigo vivo hay;
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
celdas, de elementos del mapa y de estructuras conservan el significado y el valor que tenían antes de este change para
la misma semilla y el mismo contenido; el de objetos del mapa es el de antes más los objetos de las vetas. Solo `drawn`
depende del recorte. Los peligros y los recogibles (montones incluidos) no forman parte del plan del mapa ni de sus
objetos.

Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador, enemigo, cadáver,
proyectil, pulso, recogibles de cada tipo, dinamita, aviso, explosión, celdas del mapa, elementos del mapa,
estructuras, vetas, objetos del mapa y `drawn` valen 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT cambiar la
simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, proyectil, pulso, dinamita, aviso y explosión son iguales en
  número a los enemigos, proyectiles, pulsos, dinamitas, avisos y explosiones del snapshot, los de gema, `gold` y
  `wood` a los recogibles de cada tipo del snapshot, y el de jugador vale 1 salvo en los frames en que el parpadeo lo
  oculta, que vale 0
- **AND** los sprites de enemigo por clase de estado coinciden con los enemigos del snapshot en cada clase
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

#### Scenario: Totales del mapa con estructuras y vetas
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa y los recuentos de la sonda, con una ventana de 960 × 540, de 1.280 × 720 y
  de 3.840 × 2.160, y con el jugador en el centro del mundo y en (16, 16)
- **THEN** en todos los casos las celdas pintadas por tipo, los elementos del mapa pintados y con reserva, las
  estructuras pintadas, las vetas pintadas y los objetos del mapa son iguales entre sí
- **AND** las celdas pintadas por tipo, los elementos del mapa y las estructuras son iguales a los de antes de este
  change, y los objetos del mapa son los de antes (695 y 778 respectivamente) más los de las vetas de cada semilla,
  ≤ 1.000

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
- **THEN** los recuentos de jugador, enemigo, cadáver, proyectil, pulso, gema, `gold`, `wood`, dinamita, aviso,
  explosión, celdas del mapa, elementos del mapa, estructuras, vetas, objetos del mapa y `drawn` valen 0

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`
