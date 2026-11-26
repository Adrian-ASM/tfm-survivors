# Spec delta · sprite-rendering

<!-- Ruta: openspec/changes/0030-pickup-visibility/specs/sprite-rendering/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Reloj de render R (en ms): el de "Animación del arte del mapa". Se congela en pausa, con una oferta de mejora
     abierta, en la tienda, en la obra y con la partida terminada; no depende de los ticks salvo en modo manual
     (`?e2e&manual`, change 0014), donde avanza n × TICK_MS (1.000 / 60 ms) con cada `step(n)`. -->

## ADDED Requirements

### Requirement: Flote de los recogibles
El sistema SHALL pintar cada recogible de los cinco tipos (`xp`, `gold`, `wood`, `meat` y `stone`) que **flota** en su
x del snapshot y en su y del snapshot más un desplazamiento vertical

d(id, R) = A × sen(2π × (R + id × s) / T) px,

con R el reloj de render del frame (en ms; se congela en pausa, con una oferta de mejora abierta, en la tienda, en la
obra y con la partida terminada, y no depende de los ticks salvo en modo manual, `?e2e&manual` de 0014, donde avanza
n × TICK_MS con cada `step(n)`), `id` el identificador del recogible y A (amplitud, px), T (periodo, ms) y s (paso de
fase, ms) los parámetros del flote de los datos de aspecto (ver "Aspectos de los recogibles y de las vetas"). Flotan
con esa fórmula, **con fase por id**, desde su primer frame pintado, los recogibles **sin aparición**: `stone`, `xp`
(también la gema sin hoja, como forma de color) y los `gold`, `wood` y `meat` sin `spawn` o cuya hoja de aparición
falla (ver "Aparición de oro, madera y carne").

Los `gold`, `wood` y `meat` **con aparición** tienen d = 0 durante su retardo y su aparición y, al terminarla, flotan
**sin salto**: con R_f el reloj del primer frame pintado en que ya no están en aparición (k ≥ n),

d(R) = A × sen(2π × (R − R_f) / T) px para R ≥ R_f,

de modo que en ese primer frame tras la aparición d = 0 (error ≤ 0,001) y, entre frames consecutivos, d cambia como un
seno continuo, sin discontinuidad en R_f. No llevan fase por id: los desfasa su propio R_f (aparición escalonada y
distintos instantes de aparición).

El desplazamiento depende solo del id (o de R_f) y de R: MUST NOT depender del tick, del hueco del pool que pinta al
recogible, del número de frames pintados (salvo para fijar R_f), de la ventana, de la cámara ni de partidas
anteriores, y calcularlo MUST NOT consumir ningún
`RandomGenerator` ni usar un flujo de azar nuevo. El flote no cambia la escala, el frame de hoja, el volteo, la
rotación ni la capa del sprite. Un recogible con **aspecto de reserva** (ver "Aspecto de reserva ante un fallo de
carga") no flota: su forma sigue centrada en su posición del snapshot. Pintar el flote MUST NOT cambiar la simulación.

#### Scenario: Desplazamiento según el reloj
- **GIVEN** unos datos de aspecto de prueba con A 4, T 1.600 y s 200, todas las hojas cargadas y un snapshot con 1 gema
  de id 0 en (300, 200), 1 gema de id 1 en (500, 200) y 1 recogible `stone` de id 2 en (700, 200)
- **WHEN** se pinta el snapshot con el reloj de render R = 0, R = 400 y R = 1.200
- **THEN** con R = 0 las y pintadas son 200, 202,828 y 204; con R = 400, 204, 202,828 y 200; con R = 1.200, 196,
  197,172 y 200 (error ≤ 0,001)
- **AND** en los tres casos las x pintadas son 300, 500 y 700 (error ≤ 0,001)

#### Scenario: Fases distintas con el mismo reloj
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj" y 2 gemas de ids 0 y 4 en (300, 200) y (500, 200)
- **WHEN** se pinta con R = 400
- **THEN** la de id 0 se pinta en y 204 y la de id 4 en y 196 (error ≤ 0,001)

#### Scenario: Recogible atraído
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj" y 1 gema de id 0 atraída por el imán, en (300, 200)
  en el snapshot del tick n y en (306, 200) en el del tick n + 1
- **WHEN** se pintan esos dos snapshots con R = 400 y R = 416,667
- **THEN** se pinta en (300, 204) y en (306, 200 + 4 × sen(2π × 416,667 / 1.600)) (error ≤ 0,001)

#### Scenario: Hueco reutilizado
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj", un snapshot pintado con 1 gema de id 7 y el
  siguiente con esa gema recogida y 1 gema nueva de id 9 en (400, 300), pintada con el sprite que usaba la de id 7
- **WHEN** se pinta el segundo snapshot con R = 0
- **THEN** la gema de id 9 se pinta en y = 300 + 4 × sen(2π × 1.800 / 1.600) = 302,828 (error ≤ 0,001)

#### Scenario: Flote congelado en pausa, oferta, tienda, obra y fin
- **GIVEN** una partida con ≥ 1 gema, ≥ 1 piedra y ≥ 1 recogible `wood` en idle en el suelo, con el reloj de render en
  R0 al entrar en pausa; después con una oferta de mejora abierta; después en la tienda; después en la obra; y después
  terminada
- **WHEN** en cada estado se pintan 60 frames de 16,667 ms
- **THEN** en cada estado la y pintada de cada recogible es la misma en los 60 frames (error ≤ 0,001), la que dan su id
  y el reloj al entrar en ese estado
- **AND** al reanudar la pausa y pintar 1 frame de 16,667 ms, cada recogible se pinta con d(id, R0 + 16,667)

#### Scenario: Flote en modo manual
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj", el modo manual (`?e2e&manual`) y una gema de id 0
  quieta en el suelo pintada con el reloj en R0 = 0
- **WHEN** se llama a `step(24)` y se pinta el frame
- **THEN** el reloj de render vale 24 × TICK_MS = 400 (error ≤ 0,001) y la gema se pinta con d = 4 (error ≤ 0,001)
- **AND** sin llamar a `step` durante 60 frames de render, la y pintada no cambia

#### Scenario: Flote sin salto al terminar la aparición
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj" (A 4, T 1.600, s 200), `spawn` de `gold` de 7
  frames a 10 fps y un recogible `gold` de id 5 en (300, 200) cuya aparición empieza en R_a = 1.000
- **WHEN** se pintan frames con R = 1.650, 1.700, 1.716,667, 2.100 y 2.500
- **THEN** con R = 1.650 muestra el frame 6 de `spawn` en y 200; con R = 1.700 (R_f) reproduce `idle` en y 200
  (d = 0, error ≤ 0,001); con R = 1.716,667, en y 200 + 4 × sen(2π × 16,667 / 1.600) = 200,262; con R = 2.100, en y
  204; y con R = 2.500, en y 200 (error ≤ 0,001)
- **AND** con el mismo recogible de id 6 y el mismo R_a, las y pintadas son las mismas (sin fase por id)

#### Scenario: Aparición fallida con fase por id
- **GIVEN** los datos de "Flote sin salto al terminar la aparición" con la hoja `G_Spawn` sin cargar y un recogible
  `gold` de id 1 en (300, 200) pintado por primera vez con R = 0
- **WHEN** se pinta con R = 0 y R = 400
- **THEN** reproduce `idle` en y 202,828 en ambos frames (d(1, R) con fase por id, error ≤ 0,001)

#### Scenario: La reserva no flota
- **GIVEN** los datos de aspecto de "Desplazamiento según el reloj", la hoja `W_Idle` sin cargar y 1 recogible `wood` de
  id 3 en (700, 400) fuera de su aparición
- **WHEN** se pinta con R = 0, R = 400 y R = 1.200
- **THEN** en los tres casos es una forma del color de `wood` de 10 px de diámetro centrada en (700, 400)
  (error ≤ 0,001)

#### Scenario: Flotar no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con A 0 y sin animaciones de
  aparición
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Aparición de oro, madera y carne
El sistema SHALL, para cada recogible `gold`, `wood` o `meat` cuyo aspecto declara una animación de aparición
(`spawn`, con su propia hoja; ver "Aspectos de los recogibles y de las vetas"), reproducir `spawn` **una sola vez** al
aparecer y después pasar a su `idle` y flotar (ver "Flote de los recogibles"). El **inicio** de la aparición es
R_a = R_1 + retardo, con R_1 el reloj de render del primer frame pintado de la partida en cuyo snapshot figura su id, y
el retardo 0 salvo en los recogibles del primer snapshot pintado (ver "Aparición escalonada de los recogibles del
inicio"). En un frame de reloj R, con n el número de frames de `spawn` y k = ⌊(R − R_a) × fps / 1.000⌋:
- si k < 0 (retardo en curso), no se ve: su sprite no es visible;
- si 0 ≤ k < n, muestra el frame de posición k de `spawn` (la aparición completa, del frame 0, el destello inicial, al
  último);
- si k ≥ n, reproduce `idle` y flota.

La aparición se pinta en la posición del snapshot (sin flote), con la escala y el origen del aspecto de su tipo, en la
capa de los recogibles, y avanza con el reloj de render (se congela en pausa, con una oferta de mejora abierta, en la
tienda, en la obra y con la partida terminada; no depende de los ticks salvo en modo manual, `?e2e&manual` de 0014,
donde avanza n × TICK_MS con cada `step(n)`). Es **una vez por id y partida**: MUST NOT repetirse ni reiniciarse al
reutilizar un sprite de otro recogible, al moverse el recogible por el imán, al sumarle valor por el tope de su tipo
(ver "Tope de gemas en el suelo" en `xp-gems`; no se crea un id nuevo) ni con el reloj congelado. Un recogible
recogido durante su aparición MUST NOT quedar visible desde el primer frame que pinta un snapshot sin él. Los
recogibles fuera del rectángulo visible también avanzan su aparición (los recogibles no se recortan por cámara).
`stone` y `xp` MUST NOT reproducir ninguna aparición ni usar ninguna hoja de aparición.

**Reserva**: si la hoja de aparición de un tipo falla al cargar o no contiene algún frame de su `spawn`, sus
recogibles se pintan desde su primer frame con su `idle` y flotan, como si no tuvieran aparición, y eso MUST NOT contar
como aspecto de reserva en la sonda. Si falla la hoja `idle` de un tipo, sus recogibles se pintan con su aspecto de
reserva (sin aparición ni flote) aunque su hoja de aparición cargue. Ningún fallo rompe la partida ni produce errores
no capturados. Calcular la aparición MUST NOT consumir ningún `RandomGenerator` ni cambiar la simulación.

#### Scenario: Aparición y paso a idle
- **GIVEN** unos datos de aspecto de prueba con `spawn` de `gold` de 7 frames `[0, 1, 2, 3, 4, 5, 6]` a 10 fps sin
  bucle, el flote de "Desplazamiento según el reloj" (A 4, T 1.600, s 200), todas las hojas cargadas y un recogible
  `gold` de id 5 en (300, 200) que no estaba en el snapshot pintado anterior
- **WHEN** se pinta su primer frame con R = 1.000 y después frames con R = 1.150, 1.650 y 1.700
- **THEN** muestra el frame de hoja 0, 1 y 6 de `spawn` en (300, 200) (error ≤ 0,001) en los tres primeros, con un
  margen de ±1 frame de render en cada cambio
- **AND** con R = 1.700 reproduce `idle` en (300, 200) (error ≤ 0,001): primer frame tras la aparición, d = 0

#### Scenario: Una sola vez por id
- **GIVEN** el recogible `gold` de id 5 de "Aparición y paso a idle" ya en `idle`
- **WHEN** se pintan 600 frames más de 16,667 ms con ese recogible en el suelo y, en otro caso, atraído por el imán
- **THEN** en ninguno de los 600 muestra un frame de `spawn`

#### Scenario: Sprite reutilizado por un id nuevo
- **GIVEN** el recogible `gold` de id 5 de "Aparición y paso a idle" en `idle`, recogido en el snapshot del tick n, y un
  recogible `wood` nuevo de id 12 que en ese mismo frame se pinta con el sprite que usaba el id 5, con `spawn` de `wood`
  igual al de `gold`
- **WHEN** se pinta el snapshot del tick n con R = 3.000
- **THEN** el sprite muestra el frame 0 del `spawn` de `wood` en la posición del id 12, sin flote

#### Scenario: Valor sumado por el tope
- **GIVEN** el tope de oro lleno, todos los recogibles `gold` en `idle`, y una casa goblin que queda en ruina en el tick
  n con el oro sumado al recogible `gold` más antiguo (ver "Tope de gemas en el suelo" en `xp-gems`)
- **WHEN** se pinta el snapshot del tick n y los 30 frames siguientes
- **THEN** ningún recogible `gold` muestra un frame de `spawn` y el número de sprites `gold` visibles es el mismo que
  antes del tick n

#### Scenario: Recogido durante la aparición
- **GIVEN** el recogible `gold` de id 5 de "Aparición y paso a idle" mostrando el frame 3 de `spawn`
- **WHEN** se pinta un snapshot en el que se ha recogido
- **THEN** no queda visible ningún sprite de recogible para él desde ese frame

#### Scenario: Aparición congelada en pausa, oferta, tienda, obra y fin
- **GIVEN** el recogible `gold` de id 5 de "Aparición y paso a idle" mostrando el frame 2 de `spawn` con R = R_a + 250
  al entrar en pausa; en otros casos, al abrirse una oferta de mejora, al entrar en la tienda, al entrar en la obra y
  al terminar la partida
- **WHEN** en cada caso se pintan 60 frames de 16,667 ms
- **THEN** en los 60 frames muestra el frame 2 de `spawn`
- **AND** al reanudar la pausa sigue en el frame 2 hasta que R − R_a llega a 300 y pasa entonces al frame 3, sin saltar
  ninguno

#### Scenario: Aparición en modo manual
- **GIVEN** el modo manual (`?e2e&manual`), los datos de aspecto de "Aparición y paso a idle" y un recogible `gold` que
  figura por primera vez en el snapshot pintado tras una llamada a `step`, con el reloj en R_a
- **WHEN** se llama a `step(9)` y después a `step(42)`, pintando un frame tras cada llamada
- **THEN** tras `step(9)` el reloj vale R_a + 150 (error ≤ 0,001) y muestra el frame 1 de `spawn`
- **AND** tras `step(42)` el reloj vale R_a + 850 (error ≤ 0,001) y reproduce `idle`

#### Scenario: Piedra y gema sin aparición
- **GIVEN** los datos de aspecto del repositorio, todas las hojas cargadas y un snapshot con 1 recogible `stone` y 1
  gema que no estaban en el snapshot pintado anterior
- **WHEN** se pinta su primer frame y los 60 siguientes
- **THEN** en todos la piedra se pinta con la hoja de su roca y la gema con su forma de color, ambas flotando, y ningún
  sprite usa `G_Spawn`, `W_Spawn` ni `M_Spawn`

#### Scenario: Hoja de aparición que no carga
- **GIVEN** los datos de aspecto del repositorio, la hoja `W_Spawn` sin cargar y un snapshot con 1 recogible `wood` y 1
  `gold` nuevos
- **WHEN** se pinta su primer frame y los 60 siguientes
- **THEN** el `wood` se pinta con `W_Idle` y flota desde el primer frame, y el `gold` reproduce su `spawn` con
  `G_Spawn`
- **AND** la sonda cuenta 0 recogibles `wood` y 0 `gold` con reserva y no hay errores no capturados

#### Scenario: Frame de aparición fuera de la hoja
- **GIVEN** un `spawn` de `meat` con frames `[0, 1, 2, 3, 4, 5, 6, 7]` sobre una hoja de 7 frames (0 a 6) y 1 recogible
  `meat` nuevo
- **WHEN** se pinta su primer frame
- **THEN** reproduce `idle` con `M_Idle`, no cuenta como reserva y no hay errores no capturados

#### Scenario: Hoja idle que no carga con la aparición cargada
- **GIVEN** la hoja `M_Idle` sin cargar, la hoja `M_Spawn` cargada y 1 recogible `meat` nuevo en (700, 400)
- **WHEN** se pinta su primer frame y los 60 siguientes
- **THEN** en todos es una forma del color de `meat` de 10 px de diámetro centrada en (700, 400) (error ≤ 0,001) y en
  ninguno muestra un frame de `M_Spawn`
- **AND** la sonda cuenta 1 recogible `meat` con reserva

#### Scenario: Aparecer no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra sin `spawn` en ningún tipo
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Aparición escalonada de los recogibles del inicio
El sistema SHALL dar a cada recogible `gold`, `wood` o `meat` que figura en el **primer snapshot pintado de una
partida** un retardo de aparición de id × e ms, con e el desfase de aparición de los datos de aspecto (ver "Aspectos de
los recogibles y de las vetas"), contado en el reloj de render desde ese primer frame. Con el contenido por defecto y el
mapa generado son los montones de madera del tick 0 (ids 0 a N − 1, N = `woodPiles.count`, 8; ver `resources`). Los
recogibles que figuran por primera vez en un snapshot posterior tienen retardo 0. Durante su retardo el recogible **no
se ve** (sigue en el snapshot y se puede recoger) y no cuenta como visible en la sonda (ver "Sonda de render para
E2E"); al acabar el retardo empieza su aparición por el frame 0 de `spawn`. El retardo es solo de render: no cambia
el tick 0, los ids, las posiciones ni ninguna firma dorada (`RESOURCE_GOLDEN` incluida). Con e 0 todos empiezan a la
vez.

#### Scenario: Montones escalonados
- **GIVEN** unos datos de aspecto de prueba con e 100 y `spawn` de `wood` de 7 frames a 10 fps sin bucle, y una partida
  cuyo primer snapshot pintado tiene 8 recogibles `wood` de ids 0 a 7, pintado con el reloj en R0
- **WHEN** se pinta con R = R0 + 50, R0 + 350, R0 + 1.350 y R0 + 1.400
- **THEN** con R0 + 50 el id 0 muestra el frame 0 de `spawn` y los ids 1 a 7 no se ven (retardo): 1 sprite `wood`
  visible
- **AND** con R0 + 350 el id 0 muestra el frame 3, el id 3 el frame 0 y los ids 4 a 7 no se ven: 4 sprites `wood`
  visibles
- **AND** con R0 + 1.350 el id 7 muestra el frame 6 de `spawn` y los ids 0 a 6 reproducen `idle`
- **AND** con R0 + 1.400 los 8 reproducen `idle` y flotan; con R0 + 1.350 y R0 + 1.400 hay 8 sprites `wood` visibles
- **AND** en ningún frame se ve un montón con su aparición sin empezar ni un frame de `spawn` antes de su inicio

#### Scenario: Recoger un montón en su retardo
- **GIVEN** la partida de "Montones escalonados" y el jugador que recoge el montón de id 7 en un tick cuyo snapshot se
  pinta con R = R0 + 300 (en su retardo)
- **WHEN** se pintan ese frame y los siguientes hasta R0 + 1.400
- **THEN** el id 7 no se ve en ninguno de ellos y la madera recogida es la misma que con cualquier otro montón

#### Scenario: Recogible posterior sin retardo
- **GIVEN** la partida de "Montones escalonados" y un barril abatido que suelta un recogible `wood` de id 20, que figura
  por primera vez en un snapshot pintado con el reloj en R1
- **WHEN** se pinta ese frame
- **THEN** el id 20 muestra el frame 0 de `spawn` (retardo 0, no 20 × 100)

#### Scenario: Montones del repositorio
- **GIVEN** el contenido por defecto, la semilla 42 (mapa generado) y los datos de aspecto del repositorio
- **WHEN** se pinta el primer frame de la partida con el reloj en R0
- **THEN** los 8 montones de madera (ids 0 a 7) tienen inicios de aparición distintos dos a dos
- **AND** el último termina su aparición (k ≥ n) con R ≤ R0 + 3.000

#### Scenario: Desfase 0
- **GIVEN** los datos de "Montones escalonados" con e 0
- **WHEN** se pinta con R = R0 + 350
- **THEN** los 8 montones muestran el frame 3 de `spawn`

### Requirement: Iconos de recurso sin aparición ni flote
El sistema SHALL mantener los iconos de recurso del HUD (ver "Oro y madera en el HUD" en `hud`), del panel de obra
(ver `build-sites`) y de la guía (ver `menu-guide`) como antes de este change: usan el primer frame de la hoja `idle`
de su recogible (`G_Idle`, `W_Idle`, `M_Idle` y la roca `medium`, `Deco/05`; la gema, su forma de color), MUST NOT
usar ninguna hoja de aparición, no flotan y su tamaño en pantalla no depende de la escala ni del diámetro de los
aspectos de los recogibles.

#### Scenario: Iconos del HUD con otra escala de recogible
- **GIVEN** el HUD con una ventana de 1.280 × 720, una vez con las escalas de los recogibles del repositorio y otra con
  todas ellas y el diámetro de la gema multiplicados por 2
- **WHEN** se pintan 60 frames de 16,667 ms con la partida en curso
- **THEN** en ambos casos y en los 60 frames los iconos de oro, madera y piedra tienen la misma posición y el mismo
  tamaño en pantalla (error ≤ 0,001) y usan `G_Idle`, `W_Idle` y `Deco/05`

#### Scenario: Iconos de la guía y de la obra
- **GIVEN** el contenido por defecto
- **WHEN** se componen los iconos de recurso de la guía y del panel de obra
- **THEN** los de oro, madera, carne y piedra apuntan a `G_Idle`, `W_Idle`, `M_Idle` y `Deco/05`, ninguno a una hoja
  `*_Spawn`, y el de las gemas es una forma con el color de la gema

## MODIFIED Requirements

### Requirement: Arte de Tiny Swords Update 010 por elemento
El sistema SHALL pintar, con los datos de aspecto del repositorio, cada elemento con su hoja de Update 010:
- el jugador, con una hoja de la unidad Arquero (`Archer`);
- cada tipo de enemigo, con la hoja de su unidad goblin: `goblin-torch` con `Torch`, `goblin-tnt` con `TNT` y
  `goblin-barrel` con `Barrel`, tres hojas distintas; `goblin-tnt-guard` con la misma hoja que `goblin-tnt`; la mecha y
  el lanzamiento usan la misma hoja que su tipo;
- el cadáver, con `Dead.png`;
- el proyectil, con `Arrow.png`;
- la gema (recogible `xp`), con una hoja del pack distinta de `G_Idle.png`, `W_Idle.png` y de las hojas de aparición,
  o sin hoja (ver "Aspectos de los recogibles y de las vetas");
- el recogible `gold`, con `G_Idle.png` (bolsa de oro) y su aparición con `G_Spawn.png`; el recogible `wood`, con
  `W_Idle.png` y su aparición con `W_Spawn.png`; el `meat`, con `M_Idle.png` y su aparición con `M_Spawn.png`; el
  `stone`, con las rocas `Deco/04.png`, `Deco/05.png` y `Deco/06.png`, sin aparición;
- la oveja, con `HappySheep_Idle.png` y `HappySheep_Bouncing.png` (ver "Pintado de las ovejas");
- la veta activa, con `GoldMine_Active.png`, y la agotada, con `GoldMine_Inactive.png`;
- la dinamita, con `Dynamite.png` (de la carpeta de la unidad `TNT`); la explosión, con `Explosions.png`;
- el fondo, con un suelo de hierba del pack;
- el agua, con `Water.png`; la espuma, con `Foam.png`; los árboles, con `Tree.png`; los puentes, con
  `Bridge_All.png`; el castillo, con `Castle_Blue.png` (castillo azul, como el arquero); la orilla, con una hoja de
  terreno del pack;
- la casa, con `Goblin_House.png`, y su ruina, con `Goblin_House_Destroyed.png`; la torre, con un único
  `Wood_Tower_<color>.png`, y su ruina, con `Wood_Tower_Destroyed.png`;
- el solar libre, con `House_Construction.png`; la casa construida, con `House_Blue.png`, y la torre construida, con
  `Tower_Blue.png` (ver "Pintado de los solares y de los edificios");
- la decoración, con las hojas `Deco/01.png`, `Deco/02.png`, `Deco/03.png` (setas), `Deco/07.png`, `Deco/08.png`,
  `Deco/09.png` (arbustos), `Deco/10.png`, `Deco/11.png` (matas), `Deco/16.png` (cartel), `Deco/17.png` (poste) y
  `Deco/18.png` (espantapájaros), una hoja por aspecto de decoración.

Los avisos no usan hoja. La unidad o el elemento de cada hoja se comprueba con la ruta de origen que registra la nota
de procedencia (ver `asset-provenance`). Del pack solo se versionan las hojas que usan los datos de aspecto, como hoja
de un aspecto o de una animación de aparición (ningún otro color de castillo ni de torre, ni `Rocks`, ni `Fire.png`, ni
`Wood_Tower_InConstruction`, ni `GoldMine_Destroyed.png`, ni variantes `_(NoShadow)`, ni `HappySheep_All`, ni
`Deco/12`–`Deco/15`). Las rocas `Deco/04`–`06` son solo de la piedra recogible: ningún aspecto de decoración las usa.
Cambiar el arte de un elemento MUST requerir solo cambios de datos y de assets, no de código.

#### Scenario: Hoja de cada elemento
- **GIVEN** los datos de aspecto del repositorio y la nota de procedencia
- **WHEN** se busca en la nota la ruta de origen de la hoja de cada aspecto y de cada animación de aparición
- **THEN** la del jugador contiene `Archer`; las de `goblin-torch`, `goblin-tnt` y `goblin-barrel` contienen
  `Torch`, `TNT` y `Barrel` respectivamente y son tres ficheros distintos; la de `goblin-tnt-guard` es el mismo
  fichero que la de `goblin-tnt`; la del cadáver termina en `Dead.png` y la del proyectil en `Arrow.png`
- **AND** la de `gold` termina en `G_Idle.png`, la de `wood` en `W_Idle.png`, la de `xp`, si la tiene, en otro fichero
  distinto de ambos y de las hojas de aparición, y las de la veta activa y agotada en `GoldMine_Active.png` y
  `GoldMine_Inactive.png`
- **AND** las de aparición de `gold`, `wood` y `meat` terminan en `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png`
  respectivamente, y ni `stone` ni `xp` tienen hoja de aparición
- **AND** la de la dinamita contiene `TNT` y termina en `Dynamite.png`, y la de la explosión termina en
  `Explosions.png`
- **AND** las del agua, la espuma, el árbol, el puente y el castillo terminan en `Water.png`, `Foam.png`, `Tree.png`,
  `Bridge_All.png` y `Castle_Blue.png` respectivamente
- **AND** las de la casa y su ruina terminan en `Goblin_House.png` y `Goblin_House_Destroyed.png`, y las de la torre y
  su ruina en `Wood_Tower_<color>.png` y `Wood_Tower_Destroyed.png`
- **AND** las de los 11 aspectos de decoración terminan en `Deco/01.png`, `Deco/02.png`, `Deco/03.png`, `Deco/07.png`,
  `Deco/08.png`, `Deco/09.png`, `Deco/10.png`, `Deco/11.png`, `Deco/16.png`, `Deco/17.png` y `Deco/18.png`, una cada
  una, y ninguna es la hoja de una roca de la piedra
- **AND** todas las rutas de origen pertenecen a Tiny Swords Update 010

#### Scenario: Solo las hojas usadas
- **GIVEN** la lista de ficheros versionados y los datos de aspecto del repositorio
- **WHEN** se compara cada asset gráfico de la nota de procedencia con las hojas de los datos de aspecto
- **THEN** cada asset de la nota es la hoja de ≥ 1 aspecto o de ≥ 1 animación de aparición, y ningún fichero
  versionado contiene `Castle_Red`, `Castle_Yellow`, `Castle_Purple`, `Castle_Black`, `Rocks`, `Fire`,
  `Wood_Tower_InConstruction`, `GoldMine_Destroyed`, `NoShadow` ni `HappySheep_All`
- **AND** los assets gráficos versionados que contienen `_Spawn` son exactamente `G_Spawn.png`, `W_Spawn.png` y
  `M_Spawn.png`, cada uno 1 vez
- **AND** de `Wood_Tower_Red`, `Wood_Tower_Blue`, `Wood_Tower_Purple` y `Wood_Tower_Yellow` hay exactamente 1 fichero
  versionado, el de la hoja de la torre
- **AND** los ficheros versionados de la carpeta `Deco/` de los assets son exactamente `01`–`11` y `16`–`18` (`.png`),
  cada uno 1 vez, y ninguno de `12`–`15`

#### Scenario: Partida con arte
- **GIVEN** la build de producción servida con `?e2e&seed=42`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** en cada frame la sonda informa de 1 sprite de fondo, de 0 sprites con aspecto de reserva y de un sprite
  de jugador visible salvo en los frames en que el parpadeo lo oculta (ver `player-health`)
- **AND** en algún frame hay ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema visibles, todos con su aspecto

### Requirement: Aspecto de reserva ante un fallo de carga
El sistema SHALL, si la hoja de un aspecto falla al cargar o no contiene algún frame referenciado por sus animaciones,
pintar los elementos de ese aspecto con su aspecto de reserva: una forma rellena centrada en la posición del elemento
y de diámetro 2 × el radio del elemento en el snapshot (en la dinamita, su radio visual; en la explosión, su radio),
sin volteo ni rotación (en el fondo, un relleno liso del mundo entero, (0, 0)–(ancho, alto) en coordenadas de
mundo). El fallo MUST NOT romper la partida ni producir errores no capturados, y los aspectos cuya hoja carga bien
siguen con su arte. El aspecto de reserva conserva el resto del comportamiento de esta spec (duración del cadáver,
parpadeo, indicación de daño y presencia de dinamitas y explosiones mientras figuran en el snapshot) y MUST NOT
depender de ficheros ni de recursos `blob:`. Una animación de comportamiento (`fuse`, `throw`) usa la hoja de su tipo:
si esa hoja falla, todo el tipo se pinta con reserva. La **excepción** es la animación de aparición de un recogible
(`spawn`, con hoja propia): si su hoja falla o no contiene un frame de `spawn`, sus recogibles se pintan con su `idle`
sin aparición y no cuentan como reserva (ver "Aparición de oro, madera y carne"). Un recogible con aspecto de reserva
no flota ni reproduce aparición. Los avisos no tienen hoja y nunca cuentan como reserva. Los elementos del mapa tienen
su propia reserva por colores (ver "Pintado del mapa"): no cuentan como sprites con aspecto de reserva y no dependen de
la hoja del fondo, salvo la orilla si su hoja es la del fondo.

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

#### Scenario: Frame de mecha fuera de la hoja
- **GIVEN** un aspecto de `goblin-barrel` cuya hoja tiene los frames 0 a 29 y `fuse` con frames `[30, 31, 32]`
- **WHEN** se pinta un `goblin-barrel` en persecución y otro en mecha
- **THEN** ambos se pintan con su aspecto de reserva y no hay errores no capturados

#### Scenario: Tamaño del aspecto de reserva
- **GIVEN** la hoja de `goblin-torch` sin cargar y un `goblin-torch` de radio 10 en (300, 200)
- **WHEN** se pinta el snapshot
- **THEN** su sprite es una forma de 20 px de diámetro centrada en (300, 200) (error ≤ 0,001)

#### Scenario: Reserva de la dinamita y la explosión
- **GIVEN** las hojas de la dinamita y de la explosión sin cargar, una dinamita de radio visual 8 en (700, 400) y una
  explosión de radio 56 en (500, 500)
- **WHEN** se pinta el snapshot
- **THEN** la dinamita es una forma de 16 px de diámetro centrada en (700, 400) y la explosión una de 112 px centrada
  en (500, 500) (error ≤ 0,001), y la sonda las cuenta con aspecto de reserva
- **AND** los avisos se pintan igual que con las hojas cargadas y no cuentan como reserva

#### Scenario: Fondo de reserva en el mundo entero
- **GIVEN** la build de producción con `?e2e&manual&map=empty&seed=7` en una ventana de 1.280 × 720, una prueba que
  hace fallar la petición de la hoja del fondo y un input que lleva al jugador a las cuatro esquinas del mundo
- **WHEN** se avanza con `step(n)` hasta que el jugador ha tocado las cuatro esquinas, leyendo la sonda tras cada
  llamada
- **THEN** la sonda informa de que el fondo usa aspecto de reserva y en cada lectura el rectángulo visible de la
  cámara está entero dentro del rectángulo de mundo que cubre ese relleno, (0, 0)–(3.840, 2.160)
- **AND** no hay errores no capturados

#### Scenario: Hoja de aparición que falla sin reserva
- **GIVEN** las hojas `G_Spawn`, `W_Spawn` y `M_Spawn` sin cargar y un snapshot con 1 recogible nuevo de cada uno de
  los tipos `gold`, `wood` y `meat`
- **WHEN** se pinta el snapshot
- **THEN** los 3 se pintan con su `idle` (`G_Idle`, `W_Idle`, `M_Idle`) y la sonda cuenta 0 recogibles con reserva
  de cada tipo, sin errores no capturados

### Requirement: Escala y origen
El sistema SHALL pintar cada sprite con arte con un tamaño en pantalla de ancho de frame × escala por alto de frame
× escala, con su origen en la posición del elemento en el snapshot, sea cual sea su radio; en un recogible que flota,
en su posición pintada (la del snapshot más su desplazamiento de flote, ver "Flote de los recogibles"). La aparición de
un recogible usa la escala y el origen del aspecto de su tipo. La gema sin hoja (forma de color) mide en pantalla el
diámetro de su aspecto, no 2 × `gemRadius`. La hitbox del snapshot no cambia por el tamaño visual.

#### Scenario: Escala independiente de la hitbox
- **GIVEN** un aspecto de `goblin-tnt` con frame de 192 × 192 px, escala 0,5 y origen (0,5; 0,75), y un
  `goblin-tnt` de radio 22 en (400, 300)
- **WHEN** se pinta el snapshot
- **THEN** el sprite mide 96 × 96 px y el punto del sprite en (0,5; 0,75) de su tamaño está en (400, 300)
  (error ≤ 0,001)
- **AND** con el mismo aspecto, un `goblin-tnt` de radio 30 también mide 96 × 96 px

#### Scenario: Tamaños de los recogibles del repositorio
- **GIVEN** los datos de aspecto del repositorio, todas las hojas cargadas, `gemRadius` 5 y `pickupRadius` 128, y un
  snapshot con 1 recogible de cada tipo, con piedras de las tres rocas
- **WHEN** se pinta el snapshot con los recogibles `gold`, `wood` y `meat` en su aparición y, en otro frame, en `idle`
- **THEN** los sprites de `gold`, `wood` y `meat` miden 64 × 64 px (128 × 0,5) en ambos frames, cada piedra mide
  0,75 × el tamaño de frame de su roca y la gema es una forma de 20 px de diámetro (error ≤ 0,001)
- **AND** `gemRadius` sigue en 5 y `pickupRadius` en 128

#### Scenario: Diámetro de la gema independiente de gemRadius
- **GIVEN** una gema sin hoja con diámetro de aspecto 20 y, en otro caso, un contenido de progresión con `gemRadius` 9
- **WHEN** se pinta una gema en (300, 200) con d = 0
- **THEN** en ambos casos es una forma de 20 px de diámetro centrada en (300, 200) (error ≤ 0,001)

### Requirement: Limpieza de la vista al cambiar de partida
El sistema SHALL, en el primer frame de una partida nueva tras R (ver `run-results`) y en el primer frame del menú
tras `Volver al menú` (ver `main-menu`), no dejar visible ningún cadáver ni ningún sprite de jugador, enemigo,
proyectil, pulso, recogible de cualquier tipo, veta, dinamita o explosión, ni ningún aviso, que no corresponda al
snapshot pintado (en el menú, ninguno). Los cadáveres, las explosiones y las apariciones de recogibles en curso (también
las que están en su retardo) se descartan sin terminar su animación y no reaparecen después. En la partida nueva cada
recogible empieza su aparición desde cero, con las reglas de "Aparición de oro, madera y carne" y de "Aparición
escalonada de los recogibles del inicio", aunque su id coincida con el de un recogible de la partida anterior. Cerrar la
escena de la partida a mitad de una animación MUST NOT dejar animaciones en curso ni errores no capturados.

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

#### Scenario: R con apariciones en curso
- **GIVEN** una partida con el mapa real de la semilla 42 cuyos 8 montones ya están en `idle` y 1 recogible `gold`
  mostrando el frame 3 de `spawn`, que termina
- **WHEN** se pulsa R con la misma semilla y se pinta el primer frame de la partida nueva con el reloj en R0
- **THEN** el montón de id 0 muestra el frame 0 de `spawn` y los de ids 1 a 7 no se ven (su retardo), ninguno en
  `idle`, y no hay ningún sprite `gold` visible

#### Scenario: Volver al menú con cadáveres en curso
- **GIVEN** `?e2e&seed=7` y una partida que se pausa en el primer frame en que la sonda informa de ≥ 1 cadáver
- **WHEN** se pulsa `Volver al menú`, se pintan 60 frames en el menú y después se pulsa `Jugar`
- **THEN** en los 60 frames del menú la sonda informa de 0 sprites de jugador, enemigo, cadáver, proyectil, pulso,
  recogible de cada tipo, veta, dinamita, aviso y explosión
- **AND** en el primer frame de la partida nueva hay 0 cadáveres y no hay errores no capturados

### Requirement: Proyectiles, gemas, pulso y fondo
El sistema SHALL pintar un sprite de flecha por cada proyectil del snapshot, en su posición (error ≤ 0,001) y en
`idle`, y un sprite de recogible por cada recogible, de los cinco tipos (`xp`, `gold`, `wood`, `meat` y `stone`), con el
aspecto de su tipo del repositorio (ver "Aspectos de los recogibles y de las vetas"), visible salvo durante su retardo
de aparición (ver "Aparición escalonada de los recogibles del inicio"): durante su aparición, en su posición del
snapshot y con su `spawn` (ver "Aparición de oro, madera y carne"); fuera de ella, en `idle` (la gema
sin hoja, como su forma de color) y en su posición del snapshot más su desplazamiento de flote (ver "Flote de los
recogibles"), en ambos casos con error ≤ 0,001; con aspecto de reserva, centrado en su posición del snapshot. Los
recogibles de los cinco tipos van en la capa (6) de "Capas del mapa y de las entidades", donde iban las gemas. El pulso
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
- **THEN** hay 3 sprites de proyectil con el aspecto del proyectil, cada uno en la posición de un proyectil distinto,
  y 4 de gema con el aspecto de la gema, cada uno en la x de una gema distinta y en su y más el desplazamiento de flote
  de su id (error ≤ 0,001)

#### Scenario: Recogibles de los cinco tipos
- **GIVEN** un snapshot con 4 gemas, 2 recogibles `gold`, 3 `wood`, 1 `meat` y 2 `stone`, todos en `idle`
- **WHEN** se pinta el snapshot
- **THEN** hay 4 sprites con el aspecto `xp`, 2 con el aspecto `gold` (`G_Idle`), 3 con el aspecto `wood` (`W_Idle`),
  1 con el aspecto `meat` (`M_Idle`) y 2 con el de la roca de su origen, cada uno en la x de un recogible distinto de su
  tipo y en su y más su desplazamiento de flote (ver "Flote de los recogibles", error ≤ 0,001)
- **AND** ningún sprite de gema usa la hoja `G_Idle` ni una hoja de aparición

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
- de la decoración, `sprites.mapArt.decor` con `planned` (decoraciones del plan), `painted` (pintadas con su arte) y
  `unpainted` (no pintadas por fallo de su hoja), con `painted` + `unpainted` = `planned`;
- por tipo de estructura, cuántas se pintan intactas, cuántas como ruina y cuántas de ellas con reserva;
- cuántas vetas se pintan activas, cuántas agotadas y cuántas de ellas con reserva;
- el número de objetos de escena usados para pintar el mapa, estructuras, vetas, solares y decoración incluidos;
- el número de esos objetos **dibujados** en el último frame (`drawn`, ver "Recorte del arte del mapa por cámara"),
  con 0 ≤ `drawn` ≤ objetos del mapa.

Los recuentos de celdas pintadas, de elementos del mapa, de decoración, de estructuras y de vetas (pintados y con
reserva) y de objetos del mapa son del plan entero de la partida: MUST NOT depender de la cámara, de la ventana, del
recorte ni del reloj de render. Con el contenido por defecto, los objetos del mapa valen 820 y 904 con las semillas 42 y
123 (737 y 820 con el tope de decoración 0). Solo `drawn` depende del recorte. Los peligros, los recogibles (montones,
carne y piedras incluidos) y las ovejas no forman parte del plan del mapa ni de sus objetos.

Los recuentos `sprites.pickups.<tipo>` (`visible` y `placeholder`) conservan su significado: un recogible en su
aparición o flotando cuenta como visible; uno en su **retardo** de aparición (ver "Aparición escalonada de los
recogibles del inicio") no se ve y no cuenta como visible. Solo cuenta como reserva el que se pinta con su aspecto de
reserva (el fallo de una hoja de aparición no cuenta). Así, por tipo, `visible` = recogibles del snapshot − recogibles
en retardo; fuera del retardo de los recogibles del inicio (con R ≥ R0 + id máximo × e), `visible` es igual a los
recogibles del snapshot y, para un mismo snapshot, no depende del reloj de render, de la aparición ni del flote. Si la
sonda tiene el recuento de recogibles en aparición (`pickupSpawns`, según el design), cuenta por tipo los recogibles en
aparición **o en su retardo** y no cambia ningún otro recuento.

Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador, enemigo, cadáver, oveja,
proyectil, pulso, recogibles de cada tipo, dinamita, aviso, explosión, celdas del mapa, elementos del mapa,
decoración, estructuras, vetas, objetos del mapa y `drawn` valen 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT
cambiar la simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, oveja, proyectil, pulso, dinamita, aviso y explosión son
  iguales en número a los enemigos, ovejas, proyectiles, pulsos, dinamitas, avisos y explosiones del snapshot, los de
  gema, `gold`, `wood`, `meat` y `stone` a los recogibles de cada tipo del snapshot menos los que están en su retardo
  de aparición (iguales a los del snapshot desde el primer frame sin recogibles en retardo), y el de jugador vale 1
  salvo en los frames en que el parpadeo lo oculta, que vale 0
- **AND** los sprites de enemigo por clase de estado coinciden con los enemigos del snapshot en cada clase, y los de
  oveja por estado con las ovejas del snapshot en cada estado
- **AND** las vetas pintadas activas y agotadas coinciden con las del snapshot en cada estado
- **AND** el recuento de cadáveres es ≤ 64 en todos
- **AND** las celdas del mapa pintadas por tipo y los recuentos de decoración son los mismos en los 600 frames, y las
  celdas, iguales a los recuentos del mapa de la sonda

#### Scenario: Recuentos de recogibles sin depender de la aparición ni del flote
- **GIVEN** los datos de "Montones escalonados" (e 100, `spawn` de 7 frames a 10 fps), todas las hojas cargadas, un
  primer snapshot pintado con el reloj en R0 con 8 `wood` (los montones del inicio, ids 0 a 7), 3 gemas (ids 20 a 22) y
  2 `stone` (ids 23 y 24), y un snapshot pintado con R0 + 50 que añade, sin retardo por llegar después del primer
  pintado, 2 `gold` (ids 30 y 31) y 1 `meat` (id 32)
- **WHEN** se pinta ese segundo snapshot, sin cambiarlo, y se lee la sonda con el reloj en R0 + 350, en R0 + 1.000 y en
  R0 + 10.000 (todos en `idle` y flotando)
- **THEN** con R0 + 350 `sprites.pickups` informa de 3, 2, 4, 1 y 2 visibles para `xp`, `gold`, `wood`, `meat` y
  `stone` (los `wood` de ids 4 a 7 en su retardo; los 2 `gold` y el `meat`, en su aparición), y con R0 + 1.000 y
  R0 + 10.000 de 3, 2, 8, 1 y 2
- **AND** en las tres lecturas hay 0 con reserva en cada tipo; si la sonda tiene `pickupSpawns`, con R0 + 350 el de
  `gold` vale 2

#### Scenario: Recuento en aparición [opcional, según design]
- **GIVEN** el escenario "Montones escalonados" y una sonda con el recuento de recogibles en aparición
  (`pickupSpawns`)
- **WHEN** se lee la sonda con R = R0 + 350 y con R = R0 + 1.400
- **THEN** el recuento en aparición de `wood` vale 8 (4 en aparición y 4 en retardo) y 0 respectivamente, los visibles
  de `wood` valen 4 y 8, y el resto de recuentos de la sonda son iguales en las dos lecturas

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
- **AND** en ambas lecturas las vetas pintadas activas son iguales a las vetas activas del snapshot, sin reserva
- **AND** en la primera lectura los sprites `wood` visibles son los montones del snapshot menos los que están en su
  retardo (≥ 1: el de id 0 ya está en su aparición), y en la segunda, iguales a los montones del snapshot, ya en
  `idle`; ninguno con reserva
- **AND** en ambas lecturas los sprites de oveja son iguales en número y por estado a las ovejas del snapshot (en la
  primera, tantas como el tope de ovejas vivas del contenido), y los de `meat` a los recogibles `meat` del snapshot,
  ninguno con reserva
- **AND** se registran 0 eventos `securitypolicyviolation`; si la sonda tiene el recuento en aparición, en la primera
  lectura el de `wood` es igual al número de montones del snapshot

#### Scenario: Totales del mapa con estructuras y vetas
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan del mapa y los recuentos de la sonda, con una ventana de 960 × 540, de 1.280 × 720 y
  de 3.840 × 2.160, con el jugador en el centro del mundo y en (16, 16), y con el reloj de render en 0 y en 10.000 ms
- **THEN** en todos los casos las celdas pintadas por tipo, los elementos del mapa pintados y con reserva, la
  decoración, las estructuras pintadas, las vetas pintadas y los objetos del mapa son iguales entre sí
- **AND** los objetos del mapa valen 820 y 904 respectivamente, los mismos que antes de este change, y ninguno es un
  recogible (piedra, montón, carne, oro o gema)

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
- **THEN** en cada frame `drawn` es igual al número de objetos del plan, estructuras, vetas, solares y decoración
  incluidos, que da "Recorte del arte del mapa por cámara" con el rectángulo visible de ese frame

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los recuentos de jugador, enemigo, cadáver, oveja, proyectil, pulso, gema, `gold`, `wood`, `meat`, `stone`,
  dinamita, aviso, explosión, celdas del mapa, elementos del mapa, decoración, estructuras, vetas, objetos del mapa y
  `drawn` valen 0

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

#### Scenario: Recuento de piedras por roca agregado
- **GIVEN** `rock` `small` en `goblin-torch`, `medium` en `goblin-tnt` y `large` en `goblin-tnt-guard`, un snapshot con
  2 recogibles `stone` de origen `goblin-torch`, 1 de `goblin-tnt` y 3 de `goblin-tnt-guard`, y la hoja `Deco/06.png`
  sin cargar
- **WHEN** se pinta y se lee la sonda
- **THEN** `sprites.pickups.stone` informa de 6 visibles y 3 con reserva (`placeholder`)

#### Scenario: Recuento de la decoración sin una hoja
- **GIVEN** el contenido por defecto, la semilla 42 y la hoja `Deco/18.png` sin cargar
- **WHEN** se pinta el snapshot del tick 0 y se lee la sonda
- **THEN** la decoración del plan es la misma que con todas las hojas, las no pintadas son exactamente las del aspecto
  de `Deco/18.png`, pintadas + no pintadas = las del plan, y los objetos del mapa son los de todas las hojas menos 2
  por cada espantapájaros no pintado

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
- en `gold`, `wood` y `meat`, opcionalmente, una **animación de aparición** `spawn` con su propia hoja (con las reglas
  de ruta y de procedencia de "Datos de aspecto validados"), su tamaño de frame (enteros ≥ 1), una lista de ≥ 1 índices
  de frame enteros ≥ 0, unos fps > 0 y **sin bucle**; `xp`, `stone` y sus rocas MUST NOT declararla;
- en el aspecto `xp` sin hoja, su **diámetro** en px (número > 0), obligatorio;
- los parámetros comunes del **flote** (ver "Flote de los recogibles"): amplitud A en px (número ≥ 0), periodo T en ms
  (número > 0) y paso de fase s en ms (número ≥ 0), y el **desfase de aparición** e en ms (número ≥ 0, ver "Aparición
  escalonada de los recogibles del inicio");
- un aspecto de veta activa y uno de veta agotada;
- un color de reserva `#RRGGBB` por tipo de recogible (uno solo para `stone`, común a sus tres rocas) y uno para la
  veta, distintos dos a dos, distintos de los colores del mapa (`trunk`, `water`, `bridge`, `castle`), de los de las
  estructuras y del de la oveja.

Los aspectos `gold`, `wood` y `meat`, los tres de `stone` y los dos de veta tienen hoja y animación `idle`; la hoja de
`meat` es `M_Idle.png`. El aspecto `xp` tiene una hoja del pack distinta de las de `gold`, `wood`, `meat` y `stone` (y
de las hojas de aparición) con animación `idle`, o bien se declara **sin hoja**, como forma de color con su color de
reserva y su diámetro; un aspecto `xp` sin hoja no cuenta nunca como reserva en la sonda (como los avisos) y no exige
`idle`. En pantalla, XP, oro, madera, carne y piedra MUST ser distinguibles: hojas distintas o, si `xp` no tiene hoja,
forma de color frente a sprite. Cada recogible `stone` se pinta con el aspecto de la roca que declara el aspecto del
tipo de enemigo de su origen (`source`, ver "Recogibles con tipo" en `xp-gems`); una piedra sin origen o con un origen
sin aspecto se pinta con la roca `medium`. El icono de piedra del HUD usa siempre la roca `medium`. La roca la decide
solo el render: no forma parte de la simulación ni cambia el valor ni el radio de la piedra. Un tipo sin aspecto, un
aspecto de un tipo inexistente (por ejemplo `potion`), una roca de `stone` ausente o desconocida, un tipo de enemigo sin
`rock` o con un valor distinto de las tres, un color ausente, con otro formato o repetido, un `spawn` en `xp` o en
`stone`, un `spawn` en bucle o con un campo fuera de rango, un diámetro de `xp` ausente o ≤ 0, o un parámetro del flote
o del desfase ausente o fuera de rango MUST hacer fallar el arranque con un error que nombre el tipo, la roca o el
campo. Los datos de aspecto de los recogibles (escalas, diámetro, aparición, flote y desfase) MUST NOT cambiar la
simulación ni el radio de recogida (`pickupRadius`, `gemRadius`).

**Reserva**: si la hoja `idle` de un aspecto de recogible falla al cargar o no contiene su frame, los recogibles de ese
tipo (en la piedra, los de esa roca), y solo ellos, se pintan con la forma rellena de "Aspecto de reserva ante un fallo
de carga" con el color de su tipo (diámetro 2 × `gemRadius`, sin flote ni aparición); el fallo de una hoja de aparición
sigue "Aparición de oro, madera y carne". Si falla una hoja de veta, las vetas en ese estado se pintan como un círculo
relleno del color de la veta, de radio su radio de contacto, centrado en su posición. Ningún fallo rompe la partida ni
produce errores no capturados.

#### Scenario: Datos del repositorio
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** hay aspecto para exactamente `xp`, `gold`, `wood`, `meat` y `stone`, aspecto de veta activa y de veta agotada,
  y colores de reserva para los cinco tipos y para la veta, distintos dos a dos
- **AND** la hoja de `gold` es `G_Idle.png`, la de `wood` `W_Idle.png`, la de `meat` `M_Idle.png`, y la de `xp`, si la
  tiene, es otra distinta de esas, de las de aparición y de las de `stone`
- **AND** `stone` tiene exactamente las rocas `small`, `medium` y `large`, con las hojas `Deco/04.png`, `Deco/05.png` y
  `Deco/06.png`, cuyo tamaño de frame cabe en la hoja versionada
- **AND** el aspecto de cada tipo de enemigo (`goblin-torch`, `goblin-tnt`, `goblin-barrel` y `goblin-tnt-guard`) tiene
  `rock` en `small`, `medium` o `large`
- **AND** `gold`, `wood` y `meat` tienen escala 0,5; las tres rocas, escala 0,75; y `xp` no tiene hoja y su diámetro
  vale 20
- **AND** `gold`, `wood` y `meat` tienen `spawn` con las hojas `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png`, frame de
  128 × 128 px, frames `[0, 1, 2, 3, 4, 5, 6]` y sin bucle, cuyos frames caben en la hoja versionada; `xp` y `stone` no
  tienen `spawn`
- **AND** el flote tiene A 4 y T 1.600, y los 8 valores (id × s) mod T de los ids 0 a 7 son distintos dos a dos

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

#### Scenario: Aparición, diámetro y flote inválidos
- **GIVEN** los datos del repositorio con, en un caso cada vez: `spawn` en `stone`; `spawn` en `xp`; el `spawn` de
  `gold` en bucle; los frames del `spawn` de `wood` `[]`; los fps del `spawn` de `meat` 0; la hoja del `spawn` de `wood`
  igual a una ruta `.png` que no figura en la nota de procedencia; el diámetro de `xp` 0; el aspecto `xp` sin hoja y sin
  diámetro; la amplitud del flote −1; el periodo del flote 0; el paso de fase −1; el desfase de aparición −1; o sin
  parámetros de flote
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `spawn` y `stone`, `spawn` y `xp`, el bucle del `spawn` de `gold`, los
  frames del `spawn` de `wood`, los fps del `spawn` de `meat`, la hoja del `spawn` de `wood`, el diámetro de `xp` (en
  los dos casos), la amplitud, el periodo, el paso de fase, el desfase y el flote respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Aparición opcional
- **GIVEN** los datos del repositorio sin `spawn` en `gold`, `wood` ni `meat`, y en otro caso con A 0, s 0 y e 0
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito en ambos casos

#### Scenario: Reserva de un tipo de recogible
- **GIVEN** un snapshot con 2 recogibles `xp`, 2 `gold`, 2 `wood` y 2 `meat` y la hoja de `wood` sin cargar
- **WHEN** se pinta el snapshot
- **THEN** los 2 `wood` son formas del color de `wood` de 10 px de diámetro (2 × `gemRadius`) centradas en su posición
  (error ≤ 0,001), y los `gold`, los `meat` y los `xp` se pintan con su aspecto del repositorio
- **AND** la sonda cuenta 2 recogibles `wood` con reserva y 0 de los otros tres tipos

#### Scenario: Reserva de la carne
- **GIVEN** un snapshot con 1 recogible `meat` en (700, 400) y 1 `gold`, la hoja `M_Idle` sin cargar y la hoja
  `M_Spawn` cargada
- **WHEN** se pinta el snapshot
- **THEN** el `meat` es una forma del color de `meat` de 10 px de diámetro centrada en (700, 400) y el `gold` se pinta
  con su aspecto del repositorio (`G_Spawn` en su aparición o `G_Idle` fuera de ella)
- **AND** la sonda cuenta 1 recogible `meat` con reserva y no hay errores no capturados

#### Scenario: Cada piedra con la roca de su origen
- **GIVEN** los datos de aspecto con `rock` `small` en `goblin-torch`, `medium` en `goblin-tnt` y `large` en
  `goblin-tnt-guard`, todas las hojas cargadas, la amplitud del flote 0 y un snapshot con 3 recogibles `stone` de esos
  tres orígenes y 1 sin origen
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
  de `goblin-tnt-guard` se pinta con `Deco/06.png` y el `gold` con su aspecto del repositorio
- **AND** la sonda cuenta 1 en `sprites.pickups.stone.placeholder` y no hay errores no capturados

#### Scenario: Pintar la piedra no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con las tres hojas de la piedra sin
  cargar, las escalas de sus rocas multiplicadas por 2 y la `rock` de todos los tipos de enemigo cambiada
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

#### Scenario: Escalas de los recogibles sin efecto en la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con las escalas de `gold`, `wood` y
  `meat` en 0,3, las de las rocas en 0,5 y el diámetro de `xp` en 10 (los valores de antes de este change)
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick, con las mismas recogidas en los mismos ticks

### Requirement: Animación del arte del mapa
El sistema SHALL animar en el arte del mapa solo la espuma (como antes), los árboles y las torres goblin intactas, con
el reloj de render R (en ms):
- **árbol**: cada árbol pintado con arte reproduce en bucle la animación `idle` de su aspecto (con los datos del
  repositorio, los frames `[0, 1, 2, 3]` de `Tree.png` a 4 fps, como en las slides; los frames 4 y 5 y el
  tocón, frame 8, nunca se muestran), con su
  **fase** φ, un entero en [0, n − 1] (n = número de frames de `idle`): en un frame de render de reloj R muestra el
  frame de posición (⌊R × fps / 1.000⌋ + φ) mod n de `idle`. El tronco y la copa del mismo árbol muestran siempre el
  mismo frame de hoja en el mismo frame de render;
- **torre goblin intacta**: cada torre no destruida pintada con arte reproduce en bucle la animación `idle` de su
  aspecto intacto (con los datos del repositorio, los 4 frames `[0, 1, 2, 3]` de `Wood_Tower_<color>.png` a 5 fps)
  con su fase ψ en [0, n − 1], con la misma regla; sus partes baja y alta muestran el mismo frame de hoja;
- la fase de cada árbol es una función determinista de la semilla de la partida y de su celda; la de cada torre, de
  la semilla y de la estructura. Calcular las fases MUST NOT consumir ningún `RandomGenerator` ni usar un flujo de
  azar nuevo, y no depende del tick, del número de frames pintados, de la ventana ni de partidas anteriores;
- todo lo demás del arte del mapa es **estático** (muestra el mismo frame de hoja en todos los frames de la partida):
  la torre goblin en ruina, el castillo, la casa goblin intacta y en ruina, la veta activa y la agotada, el solar en
  obra (`House_Construction`), la casa y la torre de caballeros construidas (`House_Blue`, `Tower_Blue`), los
  puentes, el agua, las orillas y toda la decoración. Los rectángulos de reserva tampoco cambian.

Espuma, árboles y torres usan el mismo reloj de render que la aparición y el flote de los recogibles (ver "Flote de los
recogibles" y "Aparición de oro, madera y carne"): con la partida en pausa, con una oferta de mejora abierta, en la
tienda, en la obra y con la partida terminada el reloj se congela y todos muestran el mismo frame de hoja en cada
frame pintado de ese estado; al volver a la partida en curso sin pausa siguen desde ese frame, sin saltos. El reloj no
depende de los ticks salvo en modo manual (`?e2e&manual`, change 0014), donde avanza n × TICK_MS con cada `step(n)`.
Con una `idle` de 1 frame el elemento queda estático. Animar el arte del mapa MUST NOT cambiar la simulación, el plan
(elementos, cajas, capas, orden), los recuentos de la sonda ni `drawn`.

#### Scenario: Frame de un árbol según su fase
- **GIVEN** un árbol de fase 2 con `idle` `[0, 1, 2, 3, 4, 5]` a 6 fps
- **WHEN** se pinta con el reloj de render R = 0, R = 700 y R = 1.000
- **THEN** su tronco y su copa muestran el frame de hoja 2, 0 y 2 respectivamente (posiciones 2, (4 + 2) mod 6 y
  (6 + 2) mod 6), con un margen de ±1 frame de render en cada cambio
- **AND** en ningún frame de render muestra el frame de hoja 8

#### Scenario: Frame de una torre según su fase
- **GIVEN** una torre goblin intacta de fase 1 con `idle` `[0, 1, 2, 3]` a 5 fps
- **WHEN** se pinta con el reloj de render R = 0, R = 650 y R = 800
- **THEN** sus partes baja y alta muestran el frame de hoja 1, 0 y 1 respectivamente, con un margen de ±1 frame de
  render en cada cambio

#### Scenario: Fases deterministas
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se calculan las fases de sus árboles y de sus torres goblin dos veces, y una tercera tras pintar 600 frames
  y pulsar R con la misma semilla
- **THEN** las tres listas de fases son iguales celda a celda y estructura a estructura, y cada fase está en [0, 3],
  tanto en los árboles como en las torres (n = 4 frames de `idle` en ambos con los datos del repositorio)

#### Scenario: Árboles y torres congelados en pausa, oferta, tienda, obra y fin
- **GIVEN** una partida con el mapa real de la semilla 42 y la cámara sobre ≥ 1 árbol, ≥ 1 torre goblin intacta y
  ≥ 1 espuma, con el reloj de render en R0 al entrar en pausa en el tick 500; después con una oferta de mejora
  abierta; después en la tienda; después en la obra; y después terminada
- **WHEN** en cada estado se pintan 60 frames de 16,667 ms
- **THEN** en cada estado el reloj de render no cambia, y cada árbol, cada torre intacta y cada espuma dibujados
  muestran en los 60 frames el mismo frame de hoja, el que dan su fase y el reloj al entrar en ese estado
- **AND** al reanudar la pausa y pintar 1 frame de 16,667 ms el reloj vale R0 + 16,667 (error ≤ 0,001) y cada árbol
  y torre muestra el frame que dan su fase y ese reloj

#### Scenario: Elementos estáticos
- **GIVEN** una partida con el mapa real de la semilla 42 en la que, por escenario, una casa goblin y una torre goblin
  quedan en ruina, una veta se agota y se construyen una casa y una torre en dos solares
- **WHEN** se pintan 600 frames de 16,667 ms tras esos cambios
- **THEN** el castillo, la casa goblin intacta y en ruina, la torre goblin en ruina, la veta activa y la agotada, el
  solar en obra, `House_Blue`, `Tower_Blue` y cada decoración muestran el mismo frame de hoja en los 600

#### Scenario: Torre que cae en ruina
- **GIVEN** una torre goblin intacta animada en el frame del tick n − 1 y destruida en el snapshot del tick n
- **WHEN** se pintan los snapshots de n a n + 60
- **THEN** desde el frame del tick n la torre se pinta con su aspecto de ruina, con el mismo frame de hoja en todos, y
  en ninguno se ve un frame de su aspecto intacto

#### Scenario: Reserva de árbol y torre
- **GIVEN** el contenido por defecto, la semilla 42 y, en un caso cada vez, la hoja `Tree.png` sin cargar, una hoja del
  árbol que no contiene el frame 3 o la hoja de la torre intacta sin cargar
- **WHEN** se pintan 120 frames de 16,667 ms
- **THEN** en los dos primeros casos todos los árboles se pintan con el rectángulo del color `trunk`, sin copa, y en el
  tercero toda torre intacta con su rectángulo de reserva, iguales en los 120 frames y sin errores no capturados

#### Scenario: Animar no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, el mismo contenido de juego, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija, una con los datos de aspecto del repositorio y otra con la `idle` del árbol y la de la
  torre intacta de 1 solo frame
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick, y sus planes del arte del mapa tienen los mismos
  objetos con las mismas cajas, capas y orden

## REMOVED Requirements
<!-- Ninguno. -->
