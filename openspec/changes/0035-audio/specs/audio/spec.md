# Spec delta · audio

<!-- Change 0035-audio. Capacidad nueva. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables
     por test. Decisiones de la spec (la propuesta las dejaba abiertas):
     D1. Música en resultados: se detiene al terminar la partida y vuelve a empezar desde 0 con la partida nueva (R / ↻).
     D2. Volver al menú: la música se detiene; el menú es mudo. El siguiente `Jugar` la arranca desde 0.
     D3. Oferta de mejora, tienda y obra: NO son pausa; la música sigue sonando y los efectos de compra y obra suenan.
     D4. Volúmenes por defecto (de contenido): música 50, efectos 80, silencio desactivado. Escala entera 0..100,
         deslizadores de paso 5.
     D5. Entrada a las opciones: botón `Sonido` (6.º del menú, 3.ª posición; 2.º de la pausa) que abre un panel DOM
         compartido `Sonido`. Esc cierra el panel sin tocar la pausa.
     D6. La tecla M y el botón táctil de silencio conmutan el silencio general en cualquier pantalla.
     D7. Los ajustes son preferencias, no progreso: `Exportar`, `Importar` y `Borrar datos` no los tocan.
     D8. En `?e2e` la lógica de audio funciona entera (detección, tope, limitación, estado de la música) contra una
         salida muda: "reproducida" = aceptada y entregada a la salida, aunque no suene. Voces activas = 0 en `?e2e`.
     D9. Un `audio.json` inválido es error de contenido (como el resto); los fallos en tiempo de ejecución (sin Web
         Audio, fichero que no carga o no decodifica, desbloqueo rechazado) solo dejan el juego mudo.
     D10 (tras los ficheros del autor, 2026-11-26): la recogida se parte en 3 tipos de efecto (`pickupGold` para oro,
         gema de XP y carne; `pickupStone`; `pickupWood`) en lugar de un `pickup` con fichero por tipo: así la
         limitación de 1 por tipo y snapshot, el intervalo y la prioridad se aplican por recurso con el mezclador de
         siempre. Varios tipos pueden compartir fichero. Tope de peso 6 MB. `.flac` es extensión de audio.
     Sin cambios en `src/domain` ni `src/application`: todo se observa con la sonda `window.__sprint.audio` y con
     dobles de la salida de audio, del almacenamiento y del reloj de render. -->

> Convenciones de esta spec:
> - **Tipos de efecto** (lista cerrada, en este orden): `playerHurt` (golpe recibido por el jugador), `impactWeapon`
>   (impacto de un arma del jugador: flecha o pulso), `impactTower` (impacto de una flecha de torre propia),
>   `impactBlast` (impacto de una explosión), `enemyDeath` (baja de enemigo), `pickupGold` (recogida de oro, de gema
>   de XP o de carne), `pickupStone` (recogida de piedra), `pickupWood` (recogida de madera), `levelUp` (subida de
>   nivel), `explosion` (explosión), `purchase` (compra en la tienda) y `build` (obra en un solar). Son 12.
> - **Tipo de recogida** de un recogible según su clase: `xp`, `gold` y `meat` → `pickupGold`; `stone` →
>   `pickupStone`; `wood` → `pickupWood`.
> - **Petición**: un suceso detectado de un tipo de efecto. Cada petición acaba **reproducida** (aceptada y entregada a
>   la salida de audio, que en `?e2e` es muda) o **descartada**; siempre reproducidas + descartadas = pedidas.
> - **Snapshot procesado**: cada snapshot nuevo que recibe el adaptador de render con partida: uno por frame en
>   tiempo real; en modo manual (`?e2e&manual`, 0014), uno por cada `step(n)`. El audio compara cada snapshot procesado
>   con el anterior de la **misma** partida.
> - **Reloj de render**: el del adaptador. No depende de los ticks salvo en modo manual (`?e2e&manual`, 0014): ahí
>   avanza `n × TICK_MS` (`TICK_MS` = 1.000 / 60 ms) con cada `step(n)` y no avanza sin `step`; los E2E dependen de eso.
> - **Estado de la música**: `stopped` (parada, posición 0), `playing` o `paused` (conserva la posición).
> - **Ajustes de audio**: volumen de música m y de efectos e, enteros 0..100, y silencio general s (booleano).
>   Volumen efectivo de la música = 0 si s, si no m / 100; de un efecto = 0 si s, si no (e / 100) × ganancia del tipo.
> - **Panel `Sonido`**: overlay DOM con el título `Sonido`, los deslizadores `Música` y `Efectos` (0..100, paso 5,
>   cada uno con su valor visible como `N %`), la casilla `Silenciar todo` y el botón `Cerrar`.
> - "Pulsación" de una tecla: `keydown` sin repetición y sin Alt, Ctrl ni Meta (como en `menu-guide`).
> - Los escenarios sin `[E2E]` se verifican sin navegador, con dobles de la salida de audio, del almacenamiento, del
>   reloj de render y del documento. "Contenido de escenario" es el por defecto salvo lo que diga el escenario.

## ADDED Requirements

### Requirement: Contenido de audio validado
El sistema SHALL leer la configuración de audio de un fichero de contenido propio validado con zod al arrancar, por la
misma vía que el resto del contenido de presentación y antes de mostrar el menú. Contiene, sin números mágicos en el
código:
- la música: un fichero;
- por cada uno de los 12 tipos de efecto, exactamente una entrada con su fichero, su prioridad (entero), su intervalo
  mínimo entre reproducciones en ms (≥ 0) y su ganancia (0..1). Varios tipos MAY citar el mismo fichero (p. ej.
  `explosion` e `impactBlast`, o `impactWeapon` e `impactTower`); cada tipo conserva su
  prioridad, intervalo y ganancia propios, y un fichero compartido se pide a la red como mucho 1 vez por carga;
- el tope de voces simultáneas de efectos (entero ≥ 1);
- la tolerancia de cruce de las flechas de torre en px de mundo (> 0; ver "Origen del impacto");
- los ajustes por defecto: música (entero 0..100), efectos (entero 0..100) y silencio (booleano).

Cada fichero citado MUST tener registro en la lista de audio de la nota de procedencia (ver "Procedencia del audio"
en `asset-provenance`). MUST NOT haber tipos de efecto desconocidos, tipos ausentes ni campos desconocidos. Un fichero
inválido MUST impedir que se muestre el menú o empiece una partida, con el error de contenido de siempre, que nombre la
sección o el tipo y el campo; no se crea el menú. Validarlo MUST NOT cambiar el resto del contenido ni la simulación.

#### Scenario: Contenido por defecto válido
- **GIVEN** el contenido de audio del repositorio
- **WHEN** se valida al arrancar
- **THEN** la validación es correcta, hay exactamente 12 entradas de efecto (una por tipo), un fichero de música, tope
  de voces ≥ 1 y ajustes por defecto música 50, efectos 80 y silencio desactivado
- **AND** `explosion` e `impactBlast` citan el mismo fichero, `impactWeapon` e `impactTower` citan el mismo fichero, y
  hay exactamente 11 ficheros distintos entre música (1) y efectos (10)

#### Scenario: Fichero compartido
- **GIVEN** el contenido de audio por defecto, en el que `explosion` e `impactBlast` comparten fichero con ganancias
  distintas
- **WHEN** se valida y se cargan los ficheros con una salida de audio de prueba
- **THEN** la validación es correcta, ese fichero se pide 1 sola vez y cada tipo se reproduce con su propia ganancia

#### Scenario: Tipo de efecto ausente o desconocido
- **GIVEN** el contenido de audio por defecto sin la entrada de `build` y, en otra carga, con una entrada más `jump`
- **WHEN** se valida al arrancar
- **THEN** en ambos casos el arranque muestra el error de contenido, que nombra `build` (o `jump`), y no se crea el
  menú

#### Scenario: Valores fuera de rango
- **GIVEN** el contenido de audio por defecto con, en un caso cada vez: tope de voces 0; música por defecto 101;
  efectos por defecto 12,5; ganancia de `pickupWood` 1,2; intervalo de `enemyDeath` −1; tolerancia de torre 0
- **WHEN** se valida al arrancar
- **THEN** en cada caso el arranque muestra el error de contenido, que nombra el campo, y no se crea el menú

#### Scenario: Fichero sin procedencia
- **GIVEN** el contenido de audio por defecto cuyo fichero de `levelUp` es una ruta sin registro en la lista de audio
  de la nota
- **WHEN** se valida al arrancar
- **THEN** el arranque muestra el error de contenido, que nombra `levelUp` y esa ruta, y no se crea el menú

#### Scenario: Campo desconocido
- **GIVEN** el contenido de audio por defecto con un campo `pan` en la entrada de `explosion`
- **WHEN** se valida al arrancar
- **THEN** el arranque muestra el error de contenido, que nombra `explosion` y `pan`, y no se crea el menú

### Requirement: Sucesos de audio desde el snapshot
El sistema SHALL detectar las peticiones de efecto comparando cada snapshot procesado con el anterior de la misma
partida, sin consultar el núcleo más allá del snapshot y sin usar el reloj de pared. Reglas, por snapshot procesado:
- `playerHurt`: 1 petición por cada golpe de clase `player` cuyo id no se haya visto antes en la partida;
- `impactWeapon` / `impactTower` / `impactBlast`: 1 petición por cada golpe de clase `enemy`, `structure` o `sheep`
  cuyo id no se haya visto antes en la partida, del tipo que fije "Origen del impacto";
- `enemyDeath`: max(0, bajas − bajas anteriores) peticiones (una detonación por mecha no es baja y no pide nada);
- `pickupGold` / `pickupStone` / `pickupWood`: 1 petición, de su tipo de recogida, por cada recogible cuyo id estaba
  en el snapshot anterior y no está en el actual, salvo en un snapshot en el que algún solar ha pasado de `free` a
  construido (sus recogibles los quita el despeje de la huella: 0 peticiones de recogida de ningún tipo en ese
  snapshot); un recogible que sigue con el mismo id (relleno al tope o recolocado) no pide nada;
- `levelUp`: max(0, nivel − nivel anterior) peticiones;
- `explosion`: 1 petición por cada explosión cuyo id no se haya visto antes en la partida;
- `purchase`: 1 petición si la tienda estaba abierta en el snapshot anterior o en el actual y el oro ha bajado;
- `build`: 1 petición por cada solar que estaba en `free` en el anterior y no lo está en el actual.

El primer snapshot procesado de cada partida (tras `Jugar`, R, ↻, el arranque con `?e2e` o `Volver al menú` +
`Jugar`) es la referencia y MUST producir 0 peticiones. Un snapshot igual al anterior (pausa, oferta, tienda u obra sin
cambios) MUST producir 0 peticiones. Los golpes de los primeros ticks de un `step(n)` o de un frame con más ticks que
la ventana de golpes, que el snapshot no expone (ver "Golpes de combate en el snapshot" en `simulation-loop`), no
piden nada; se acepta. Detectar sucesos MUST NOT cambiar el snapshot ni la simulación.

#### Scenario: Un golpe suena una vez en toda su ventana
- **GIVEN** la ventana de golpes 15 y un único golpe de clase `enemy` con id 7 en el tick 100, sin explosiones ni
  flechas de torre
- **WHEN** se procesan uno a uno los snapshots de los ticks 99 a 115
- **THEN** hay exactamente 1 petición `impactWeapon`, en el snapshot del tick 100, y 0 en los demás

#### Scenario: Golpe al jugador
- **GIVEN** un snapshot anterior sin golpes y uno actual con un golpe de clase `player` y uno de clase `enemy`
- **WHEN** se procesa el actual
- **THEN** hay 1 petición `playerHurt` y 1 de impacto, y ninguna `playerHurt` por el golpe `enemy`

#### Scenario: Bajas y mechas
- **GIVEN** un snapshot anterior con 10 bajas y 2 barriles vivos y uno actual con 13 bajas en el que además un barril
  ha desaparecido por su mecha
- **WHEN** se procesa el actual
- **THEN** hay exactamente 3 peticiones `enemyDeath`

#### Scenario: Recogidas y despeje
- **GIVEN** un snapshot anterior con los recogibles de ids 4 (`gold`), 5 (`xp`) y 6 (`wood`) y uno actual con solo el
  6, sin solares construidos entre ambos; y en otro caso el mismo par en el que el solar 0 pasa de `free` a `house`
- **WHEN** se procesa el actual
- **THEN** en el primer caso hay 2 peticiones `pickupGold` y 0 de `pickupStone` y `pickupWood`; en el segundo hay 0
  peticiones de recogida de ningún tipo y 1 `build`

#### Scenario: Una recogida por tipo de recurso
- **GIVEN** un snapshot anterior con los recogibles de ids 10 (`xp`), 11 (`meat`), 12 (`gold`), 13 (`stone`),
  14 (`stone`), 15 (`wood`) y 16 (`wood`) y uno actual sin ninguno, sin solares construidos entre ambos, sin efectos
  sonando y todos los tipos fuera de su intervalo
- **WHEN** se procesa el actual
- **THEN** hay 3 peticiones `pickupGold`, 2 `pickupStone` y 2 `pickupWood`
- **AND** se reproduce exactamente 1 de cada uno de los tres tipos y se descartan 2 `pickupGold`, 1 `pickupStone` y
  1 `pickupWood`

#### Scenario: Relleno al tope no es recogida
- **GIVEN** un snapshot anterior con 300 recogibles `xp` y 64 `wood` y uno actual con los mismos 364 ids, el más
  antiguo de cada tipo con más valor
- **WHEN** se procesa el actual
- **THEN** hay 0 peticiones `pickupGold`, `pickupStone` y `pickupWood`

#### Scenario: Varias subidas en un step
- **GIVEN** modo manual y una partida en nivel 3 cuyo `step(600)` la deja en nivel 5
- **WHEN** se procesa el snapshot de ese `step`
- **THEN** hay 2 peticiones `levelUp`

#### Scenario: Explosión visible varios ticks
- **GIVEN** una explosión con id 2 visible en los snapshots de 3 ticks consecutivos
- **WHEN** se procesan los 3
- **THEN** hay exactamente 1 petición `explosion`, en el primero

#### Scenario: Compra en la tienda
- **GIVEN** una partida en tienda con 40 de oro
- **WHEN** se compra un producto de precio 12 y se procesa el snapshot siguiente, y después se sale de la tienda sin
  comprar y se procesa otro
- **THEN** hay 1 petición `purchase` en el primero y 0 en el segundo

#### Scenario: Partida nueva como referencia
- **GIVEN** una partida terminada con 200 bajas y nivel 9
- **WHEN** se pulsa R y se procesa el primer snapshot de la partida nueva (0 bajas, nivel 1)
- **THEN** hay 0 peticiones de cualquier tipo

#### Scenario: Snapshot sin cambios
- **GIVEN** una partida en pausa en el tick 500
- **WHEN** se procesan 300 snapshots iguales al del tick 500
- **THEN** hay 0 peticiones

### Requirement: Origen del impacto
El sistema SHALL asignar a cada golpe nuevo de clase `enemy`, `structure` o `sheep`, en el snapshot en que aparece,
exactamente un tipo de impacto, con esta precedencia:
1. `impactBlast` si alguna explosión del snapshot tiene el mismo tick que el golpe y la distancia entre su centro y la
   posición del golpe es ≤ su radio;
2. si no, `impactTower` si alguna flecha de torre que estaba en el snapshot anterior no está en el actual y su última
   posición conocida está a ≤ la tolerancia de cruce de torre (contenido) de la posición del golpe;
3. si no, `impactWeapon`.

Un golpe que suma daño de varios orígenes en el mismo tick pide un solo impacto, el de mayor precedencia. Una flecha
de torre que aparece y desaparece dentro de un mismo `step(n)` o frame no se ve y su impacto cuenta como
`impactWeapon`; se acepta. Los golpes de clase `player` nunca son impactos (son `playerHurt`).

#### Scenario: Impacto de explosión
- **GIVEN** un golpe nuevo de clase `enemy` en el tick 300 en (500, 500) y una explosión del tick 300 con centro
  (530, 500) y radio 64
- **WHEN** se procesa el snapshot
- **THEN** hay 1 petición `impactBlast` y 0 de `impactTower` e `impactWeapon`

#### Scenario: Explosión de otro tick
- **GIVEN** el caso anterior con la explosión del tick 298, aún visible
- **WHEN** se procesa el snapshot
- **THEN** el golpe pide `impactWeapon`

#### Scenario: Impacto de torre
- **GIVEN** la tolerancia de torre 24, un snapshot anterior con una flecha de torre en (400, 410) y uno actual sin
  ella, con un golpe nuevo de clase `enemy` en (400, 400) y sin explosiones
- **WHEN** se procesa el actual
- **THEN** hay 1 petición `impactTower`

#### Scenario: Flecha de torre lejos del golpe
- **GIVEN** el caso anterior con la flecha desaparecida en (400, 430) (a 30 px)
- **WHEN** se procesa el actual
- **THEN** el golpe pide `impactWeapon`

#### Scenario: Explosión gana a torre
- **GIVEN** un golpe nuevo de clase `structure` que cumple a la vez la regla de explosión y la de torre
- **WHEN** se procesa el snapshot
- **THEN** pide exactamente 1 `impactBlast`

#### Scenario: El jugador en una explosión
- **GIVEN** un golpe nuevo de clase `player` dentro del radio de una explosión del mismo tick
- **WHEN** se procesa el snapshot
- **THEN** hay 1 petición `playerHurt` y 0 de impacto por ese golpe

### Requirement: Tope de voces y limitación por tipo
El sistema SHALL decidir, en cada snapshot procesado, qué peticiones se reproducen:
- por tipo, como mucho 1 reproducida por snapshot procesado; el resto de ese tipo se descarta;
- una petición de un tipo cuya reproducción anterior empezó hace menos que su intervalo mínimo, medido con el reloj de
  render, se descarta (en modo manual, `?e2e&manual` de 0014, ese reloj avanza `n × TICK_MS` con cada `step(n)`);
- con V efectos sonando y tope de voces T, se reproducen como mucho max(0, T − V) peticiones; las que quedan fuera se
  descartan. Se eligen por prioridad del tipo (mayor primero) y, a igual prioridad, por el orden de los tipos de las
  convenciones;
- con el volumen efectivo de efectos 0, con la pestaña oculta, con la pausa o con la retención (ver "El audio se
  detiene con la pausa, la retención y la pestaña oculta"), toda petición se descarta.

Lo descartado MUST NOT reproducirse más tarde. MUST NOT sonar más de T efectos a la vez.

#### Scenario: Avalancha de impactos
- **GIVEN** tope de voces 8, 0 efectos sonando y un snapshot con 40 golpes nuevos `impactWeapon`
- **WHEN** se procesa
- **THEN** se reproduce 1 `impactWeapon` y se descartan 39

#### Scenario: Intervalo mínimo con el reloj de render en modo manual
- **GIVEN** modo manual (`?e2e&manual`), intervalo mínimo de `impactWeapon` 40 ms y un golpe nuevo `impactWeapon` en
  cada tick
- **WHEN** se llama 4 veces a `step(1)` (el reloj de render avanza 16,667 ms en cada una)
- **THEN** se reproducen el primero y el cuarto (a 50 ms del primero) y se descartan el segundo (16,667 ms) y el
  tercero (33,333 ms)

#### Scenario: Tope con voces ocupadas
- **GIVEN** tope de voces 8, 7 efectos sonando y un snapshot con 1 petición de cada uno de `levelUp`, `enemyDeath` y
  `pickupStone`, con prioridades 9, 5 y 3, todas fuera de su intervalo
- **WHEN** se procesa
- **THEN** se reproduce solo `levelUp` y se descartan `enemyDeath` y `pickupStone`

#### Scenario: Recogidas a igual prioridad con una voz libre
- **GIVEN** tope de voces 8, 7 efectos sonando y un snapshot con 1 petición de cada uno de `pickupWood`,
  `pickupStone` y `pickupGold`, las tres con prioridad 3 y fuera de su intervalo
- **WHEN** se procesa
- **THEN** se reproduce solo `pickupGold` (primero en el orden de los tipos) y se descartan `pickupStone` y
  `pickupWood`

#### Scenario: Tope lleno
- **GIVEN** tope de voces 8 y 8 efectos sonando
- **WHEN** se procesa un snapshot con 1 petición `playerHurt`
- **THEN** se descarta y siguen sonando 8 efectos

#### Scenario: Cuentas cuadran
- **GIVEN** una partida de la semilla 42 con el contenido por defecto y el bot de referencia, sin navegador
- **WHEN** se avanzan 3.600 ticks en bloques de 60, procesando el snapshot de cada bloque, y se leen los contadores
  tras cada uno
- **THEN** en cada lectura, para cada tipo y en el total, reproducidas + descartadas = pedidas, y ningún tipo tiene más
  reproducidas que snapshots procesados

### Requirement: Música de fondo en bucle
El sistema SHALL reproducir la música del contenido en bucle (al acabar, vuelve a empezar sin silencio añadido) con
estas reglas de estado:
- al cargar y en el menú (también con la guía, el diálogo de `Borrar datos` o el panel `Sonido`): `stopped`; antes
  del primer `Jugar` no suena nada;
- al pulsar `Jugar`: `playing` desde la posición 0, una sola música aunque se pulse dos veces;
- con `?e2e`, el arranque directo de la primera partida cuenta como `Jugar` (salida muda);
- oferta de mejora, tienda y obra: sigue en `playing`, sin cambiar la posición;
- al terminar la partida (victoria o derrota): `stopped`;
- al empezar una partida nueva con R o ↻: `playing` desde la posición 0;
- al pulsar `Volver al menú`: `stopped`;
- pausa, retención y pestaña oculta: ver "El audio se detiene con la pausa, la retención y la pestaña oculta".

Con el volumen efectivo de música 0 (volumen 0 o silencio), la música sigue en su estado y avanzando, inaudible.

#### Scenario: Menú mudo
- **GIVEN** la carga sin `?e2e` y una salida de audio de prueba
- **WHEN** se pintan 300 frames en el menú, se abre y cierra la guía y se abre y cierra el panel `Sonido`
- **THEN** la música está en `stopped` y la salida ha recibido 0 órdenes de reproducción

#### Scenario: Jugar arranca la música
- **GIVEN** el menú y una salida de audio de prueba
- **WHEN** se pulsa `Jugar` dos veces en el mismo frame
- **THEN** la música está en `playing` desde la posición 0, en bucle, y la salida tiene exactamente 1 música sonando

#### Scenario: Oferta, tienda y obra no paran la música
- **GIVEN** una partida en curso con la música en `playing` en la posición 12,0 s
- **WHEN** se abre una oferta, se mantiene 2 s de reloj de render y se elige; y en otros casos lo mismo con la tienda
  y con la obra
- **THEN** en cada caso la música sigue en `playing` y su posición avanza esos 2 s (error ≤ 0,1 s)

#### Scenario: Fin de partida y reinicio
- **GIVEN** una partida en curso con la música en `playing` en la posición 40 s
- **WHEN** la partida termina con derrota, se pintan 120 frames y se pulsa R
- **THEN** con los resultados visibles la música está en `stopped`; tras R está en `playing` desde la posición 0

#### Scenario: Volver al menú
- **GIVEN** una partida en pausa con la música en `paused`
- **WHEN** se pulsa `Volver al menú` y después `Jugar`
- **THEN** en el menú la música está en `stopped`; tras `Jugar` está en `playing` desde la posición 0

#### Scenario: Bucle
- **GIVEN** una música de 30 s en `playing`
- **WHEN** pasan 31 s de reloj de render sin pausa
- **THEN** la música sigue en `playing` en la posición 1 s (error ≤ 0,1 s)

### Requirement: El audio se detiene con la pausa, la retención y la pestaña oculta
El sistema SHALL tener la música en `playing` solo si existe una partida no terminada y no hay pausa del jugador, ni
retención de 0033 (aviso `Gira el móvil`), ni la pestaña oculta. Al entrar en cualquiera de esas situaciones, la
música pasa a `paused` (conserva la posición) y los efectos que suenan se cortan (0 efectos sonando); mientras dura,
toda petición se descarta. Al salir de la última que quede, la música vuelve a `playing` desde la posición en que se
pausó. Ocultar y mostrar la pestaña MUST NOT quitar la pausa del jugador ni la retención. En el menú y con la partida
terminada, ocultar y mostrar la pestaña deja la música en `stopped`.

#### Scenario: Pausa con Esc
- **GIVEN** una partida en curso con la música en `playing` en la posición 20 s y 3 efectos sonando
- **WHEN** se pulsa Esc, pasan 5 s de reloj de render y se pulsa Esc otra vez
- **THEN** durante la pausa la música está en `paused` en 20 s y hay 0 efectos sonando; al reanudar vuelve a
  `playing` desde 20 s (error ≤ 0,1 s)

#### Scenario: Retención por orientación
- **GIVEN** el modo móvil y una partida en curso con la música en `playing`
- **WHEN** la ventana pasa a vertical y después vuelve a horizontal
- **THEN** con el aviso visible la música está en `paused` y al volver está en `playing` desde la misma posición

#### Scenario: Pestaña oculta sobre la pausa
- **GIVEN** una partida en pausa con la música en `paused`
- **WHEN** la pestaña se oculta y vuelve a mostrarse
- **THEN** la música sigue en `paused` y la partida sigue en pausa hasta pulsar Esc o `Reanudar`

#### Scenario: Pestaña oculta en curso
- **GIVEN** una partida en curso con la música en `playing` y modo manual
- **WHEN** la pestaña se oculta, se llama a `step(60)` con 2 golpes nuevos y la pestaña vuelve a mostrarse
- **THEN** mientras está oculta la música está en `paused` y las 2 peticiones se descartan; al mostrarse vuelve a
  `playing`

#### Scenario: Pestaña oculta en el menú
- **GIVEN** el menú con la música en `stopped`
- **WHEN** la pestaña se oculta y vuelve a mostrarse
- **THEN** la música sigue en `stopped`

### Requirement: Desbloqueo y fallos de audio
El sistema SHALL desbloquear el audio del navegador con el gesto de `Jugar` (clic, toque o tecla sobre el botón).
Ningún fallo de audio MUST lanzar errores no capturados, bloquear el arranque, retrasar el menú ni `Jugar`, ni
cambiar la simulación:
- sin Web Audio en el navegador, o con el desbloqueo rechazado: el juego funciona mudo; las peticiones se descartan y la
  música queda en su estado lógico sin sonar;
- un fichero que no carga (404) o no se decodifica (p. ej. OGG en un navegador sin soporte): solo ese sonido se
  descarta cada vez que se pide; los demás suenan;
- la música aún no cargada al pulsar `Jugar` empieza a sonar en cuanto carga si su estado sigue siendo `playing`.

La carga de los ficheros de audio MUST empezar como pronto al cargar la página y MUST NOT ser necesaria para mostrar
el menú.

#### Scenario: Navegador sin Web Audio
- **GIVEN** un documento de prueba sin API de Web Audio
- **WHEN** se carga, se pulsa `Jugar`, se juega hasta un golpe al jugador y se pulsa M
- **THEN** no hay errores no capturados, la partida avanza igual y la petición `playerHurt` se descarta

#### Scenario: Fichero que no carga
- **GIVEN** una salida de audio de prueba en la que el fichero de `pickupStone` falla al cargar y el resto carga
- **WHEN** se procesa un snapshot con 1 petición `pickupStone`, 1 `pickupGold` y 1 `levelUp`
- **THEN** se descarta `pickupStone`, se reproducen `pickupGold` y `levelUp` y no hay errores no capturados

#### Scenario: Fichero compartido que no carga
- **GIVEN** una salida de audio de prueba en la que falla al cargar el fichero que comparten `explosion` e
  `impactBlast` y el resto carga
- **WHEN** se procesa un snapshot con 1 petición `explosion`, 1 `impactBlast` y 1 `impactWeapon`
- **THEN** se descartan `explosion` e `impactBlast`, se reproduce `impactWeapon` y no hay errores no capturados

#### Scenario: Desbloqueo rechazado
- **GIVEN** un navegador de prueba que rechaza reanudar el audio tras el gesto
- **WHEN** se pulsa `Jugar`
- **THEN** la partida empieza igual que con audio, sin errores no capturados

#### Scenario: Menú sin esperar al audio
- **GIVEN** una carga en la que los ficheros de audio tardan 10 s en responder
- **WHEN** termina la carga del resto del contenido
- **THEN** el menú es visible sin esperar al audio y `Jugar` empieza la partida con una sola pulsación

### Requirement: Volúmenes y silencio
El sistema SHALL aplicar los ajustes de audio con los volúmenes efectivos de las convenciones. Un cambio de ajuste
(deslizador, casilla, tecla M o botón táctil de silencio) MUST aplicarse a la música que suena y a los efectos que
suenan antes del siguiente frame pintado, sin reiniciar la música ni cambiar su estado. Quitar el silencio MUST
devolver los volúmenes de m y e, sin cambiarlos.

#### Scenario: Volúmenes efectivos
- **GIVEN** ajustes música 50, efectos 80, sin silencio, y ganancia de `explosion` 0,5
- **WHEN** se reproduce una `explosion` con la música en `playing`
- **THEN** el volumen efectivo de la música es 0,5 y el de esa explosión 0,4

#### Scenario: Silencio y vuelta
- **GIVEN** la música en `playing` en la posición 8 s con ajustes música 50 y efectos 80
- **WHEN** se activa el silencio, pasan 2 s de reloj de render y se desactiva
- **THEN** con silencio el volumen efectivo de música y efectos es 0 y la música sigue en `playing`; al quitarlo vuelven
  a 0,5 y 0,8 y la música está en la posición 10 s (error ≤ 0,1 s)
- **AND** los ajustes guardados siguen siendo música 50 y efectos 80

#### Scenario: Cambio al instante
- **GIVEN** la música en `playing` con volumen 50
- **WHEN** se mueve el deslizador `Música` a 20
- **THEN** antes del siguiente frame pintado el volumen efectivo de la música es 0,2 y su posición no ha vuelto a 0

#### Scenario: Efectos a 0
- **GIVEN** ajustes efectos 0 y sin silencio
- **WHEN** se procesa un snapshot con 1 petición `levelUp`
- **THEN** se descarta

### Requirement: Ajustes de audio guardados
El sistema SHALL guardar los ajustes de audio en `localStorage` con la clave `sprint-survivors/audio`, aparte del
progreso, como un objeto con versión de esquema 1, música, efectos y silencio, validado con zod al leerlo. Se leen una
vez al cargar. Si no hay valor, se usan los ajustes por defecto del contenido. Si el valor no es JSON, no cumple el
esquema (p. ej. música 140 o un campo de más) o el almacenamiento lanza al leer, se usan los por defecto, se emite
exactamente 1 aviso por consola que menciona `audio` y el valor guardado MUST NOT cambiar hasta el siguiente cambio de
ajuste. Cada cambio de ajuste confirmado (soltar un deslizador, una pulsación de flecha sobre él, la casilla, M o el
botón táctil) MUST escribir el valor nuevo exactamente 1 vez; abrir o cerrar el panel sin cambiar nada MUST NOT
escribir. Si el almacenamiento lanza al escribir, el ajuste se aplica igual durante la carga y no hay errores no
capturados. `Exportar`, `Importar` y `Borrar datos` MUST NOT leer, escribir ni borrar esta clave, y los ajustes MUST
NOT aparecer en el fichero exportado.

#### Scenario: Sin ajustes guardados
- **GIVEN** un navegador sin la clave `sprint-survivors/audio`
- **WHEN** se carga la página y se abre el panel `Sonido`
- **THEN** muestra música `50 %`, efectos `80 %` y `Silenciar todo` sin marcar, y se han hecho 0 escrituras

#### Scenario: Ajustes que sobreviven a la recarga
- **GIVEN** un navegador sin ajustes guardados
- **WHEN** se pone música a 30, efectos a 65, se activa el silencio y se recarga la página
- **THEN** el valor guardado tiene música 30, efectos 65 y silencio activado, y el panel los muestra así tras la recarga

#### Scenario: Ajustes dañados
- **GIVEN** la clave `sprint-survivors/audio` con, en un caso cada vez, el texto `hola`, música 140, efectos `"80"` y un
  campo extra `master`
- **WHEN** se carga la página
- **THEN** se usan música 50, efectos 80 y sin silencio, hay exactamente 1 aviso que menciona `audio` y el valor
  guardado sigue igual byte a byte
- **AND** tras mover el deslizador `Efectos` a 70 el valor guardado es el nuevo, válido, con efectos 70

#### Scenario: Almacenamiento que lanza
- **GIVEN** un almacenamiento que lanza `SecurityError` al leer y al escribir
- **WHEN** se carga la página, se pulsa M y se pulsa `Jugar`
- **THEN** no hay errores no capturados, el silencio está activado durante la carga y la partida empieza

#### Scenario: Una escritura por cambio
- **GIVEN** el panel `Sonido` abierto
- **WHEN** se pulsa 3 veces flecha derecha sobre `Música` (de 50 a 65), se marca `Silenciar todo` y se cierra el panel
- **THEN** se han hecho exactamente 4 escrituras de la clave y la última tiene música 65 y silencio activado

#### Scenario: Independiente del progreso
- **GIVEN** ajustes guardados A y un progreso guardado
- **WHEN** se pulsa `Exportar`, se importa un fichero válido y se confirma `Borrar datos`
- **THEN** el valor guardado de `sprint-survivors/audio` sigue siendo A byte a byte y el fichero exportado no contiene
  `music` ni `muted`

### Requirement: Panel Sonido
El sistema SHALL abrir el panel `Sonido` al pulsar el botón `Sonido` del menú de inicio (ver `main-menu`) o del overlay
de pausa, mostrando los ajustes en uso. Mover un deslizador cambia su ajuste en pasos de 5 dentro de 0..100 y su valor
visible `N %`; marcar o desmarcar `Silenciar todo` cambia el silencio. Se cierra con `Cerrar` o con una pulsación de
Esc (también ⏸ en modo móvil, que equivale a Esc); al cerrarse, el foco queda en el botón `Sonido` que lo abrió y se
vuelve exactamente a la pantalla de antes: el menú en modo menú o la partida en pausa con su overlay. Al abrirse, el
foco queda dentro del panel. Mientras está abierto:
- solo hay 1 panel `Sonido` visible;
- los botones del menú o de la pausa que quedan debajo MUST NOT tener efecto, y R, 1, 2, 3 y el input de movimiento
  tampoco;
- abrirlo, usarlo y cerrarlo MUST NOT crear partida, ejecutar ticks, quitar la pausa ni cambiar el progreso.

El panel se pinta con las piezas de "Piezas de UI en los paneles DOM" (`sprite-rendering`): marco de `panel`, título con
`header`, `Cerrar` con las piezas de botón y textos con la fuente pixel, con reserva si una pieza no carga. Va centrado
en la ventana como "Menú y pausa centrados en la ventana" (`main-menu`) y, en modo móvil, a escala 1 y desplazable
(ver "Paneles DOM en modo móvil" en `mobile-display`). Ningún elemento del panel MUST tener atributo `style` ni
provocar violaciones de la CSP.

#### Scenario: Abrir desde el menú y cerrar con Esc
- **GIVEN** el modo menú
- **WHEN** se pulsa `Sonido`, se pulsa Esc y se pulsa `Jugar`
- **THEN** tras `Sonido` el panel es visible con `Música`, `Efectos`, `Silenciar todo` y `Cerrar`, y el foco está
  dentro; tras Esc no es visible, el foco está en `Sonido` y no existe partida; tras `Jugar` hay 1 partida en curso

#### Scenario: Abrir desde la pausa
- **GIVEN** una partida en pausa en el tick 500
- **WHEN** se pulsa `Sonido`, se pulsa Esc y se pintan 60 frames
- **THEN** la partida sigue en pausa en el tick 500 con el overlay de pausa visible y el panel cerrado
- **AND** una pulsación más de Esc quita la pausa

#### Scenario: Botones de debajo bloqueados
- **GIVEN** el panel abierto desde la pausa y, en otro caso, desde el menú
- **WHEN** se pulsan `Reanudar` y `Volver al menú` (o `Jugar`, `Cómo jugar` y `Borrar datos`), R y 1
- **THEN** el panel sigue visible, la partida sigue en pausa (o no existe ninguna), la guía y el diálogo no se ven

#### Scenario: Límites del deslizador
- **GIVEN** el panel abierto con música 100 y efectos 0
- **WHEN** se pulsa flecha derecha sobre `Música` y flecha izquierda sobre `Efectos`
- **THEN** siguen en `100 %` y `0 %` y se han hecho 0 escrituras

#### Scenario: Panel centrado
- **GIVEN** el panel abierto con una ventana de 1.280 × 720 y, en otra carga, de 960 × 540
- **WHEN** se pinta 1 frame
- **THEN** su centro horizontal está en x = 640 y x = 480 respectivamente (error ≤ 1 px), está centrado en vertical
  (diferencia ≤ 1 px) y sus controles están enteros dentro de la ventana y sin solaparse

### Requirement: Tecla M
El sistema SHALL conmutar el silencio general con cada pulsación de M, en cualquier pantalla: menú (con o sin la guía,
el diálogo de `Borrar datos` o el panel `Sonido`), partida en curso, en pausa, eligiendo mejora, en tienda, en obra,
terminada y con el aviso de orientación. Una M mantenida conmuta una sola vez; M con Alt, Ctrl o Meta no hace nada. M
MUST NOT tener otro efecto: no mueve al jugador, no cambia la página de la guía, no cierra ni abre paneles, no cambia
la pausa y no cambia la simulación. Con el panel `Sonido` abierto, su casilla refleja el cambio al instante.

#### Scenario: M en partida
- **GIVEN** una partida en curso en el tick n sin silencio
- **WHEN** se pulsa M, se mantiene 60 frames con 20 `keydown` de repetición y se suelta
- **THEN** el silencio está activado (un único cambio) y se ha escrito 1 vez
- **AND** la partida es igual, tick a tick, a otra con la misma semilla e inputs sin pulsar M

#### Scenario: M en el menú con la guía abierta
- **GIVEN** la guía abierta en la página 3 sin silencio
- **WHEN** se pulsa M
- **THEN** el silencio está activado, la guía sigue en `3 de 7` y no existe partida

#### Scenario: M con el panel abierto
- **GIVEN** el panel `Sonido` abierto con `Silenciar todo` sin marcar
- **WHEN** se pulsa M dos veces
- **THEN** tras la primera la casilla está marcada y tras la segunda desmarcada, con el panel visible

#### Scenario: M con modificador
- **GIVEN** una partida en curso sin silencio
- **WHEN** se pulsan Ctrl + M y Alt + M
- **THEN** el silencio sigue desactivado y se han hecho 0 escrituras

### Requirement: Modo E2E sin ficheros y sonda de audio
Con `?e2e`, el sistema SHALL no pedir a la red ningún fichero de audio y SHALL ejecutar la lógica de audio entera
contra una salida muda (detección, origen del impacto, tope, limitación, estado de la música y ajustes). La sonda
`window.__sprint.audio` MUST exponer, en campos que se puedan leer por separado:
- si hay ficheros cargados (falso en `?e2e`) y cuántos ficheros de audio se han pedido (0 en `?e2e`);
- el estado de la música (`stopped`, `playing`, `paused`);
- los ajustes en uso (música, efectos, silencio) y los volúmenes efectivos de música y de efectos;
- contadores acumulados en la carga de peticiones pedidas, reproducidas y descartadas, en total y por tipo de efecto;
- los efectos sonando (0 en `?e2e`).

En el menú la sonda existe con la música en `stopped`. Sin `?e2e` la sonda MUST NOT existir (ver "Arranque directo con
e2e" en `main-menu`).

#### Scenario: Contadores coherentes con el snapshot
- **GIVEN** la lógica de audio en modo E2E (salida muda) y una partida de la semilla 42 con el mapa vacío de los E2E
- **WHEN** se procesa el snapshot de cada tick hasta que tiene ≥ 1 baja, leyendo la sonda tras cada uno
- **THEN** las peticiones `enemyDeath` pedidas igualan las bajas del snapshot, y en cada lectura reproducidas +
  descartadas = pedidas
- **AND** los ficheros de audio pedidos son 0 y los efectos sonando 0

#### Scenario: Sonda en el menú
- **GIVEN** la lógica de audio en modo E2E con una partida en pausa
- **WHEN** se vuelve al menú y se lee la sonda
- **THEN** la sonda de audio existe e informa de la música en `stopped`, con los contadores de la carga intactos

### Requirement: Audio sin efecto en la simulación
El audio SHALL ser solo presentación: los mismos semilla, contenido e inputs por tick MUST producir los mismos snapshots
con audio, sin audio, con silencio, con cualquier volumen y pulsando M o abriendo el panel `Sonido`. El change MUST NOT
cambiar `src/domain` ni `src/application`, ni el contenido de combate o de mapa; `BALANCE_BASELINE` y todas las firmas
doradas MUST quedar idénticas sin regenerarlas.

#### Scenario: Misma partida con y sin audio
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, la misma secuencia de 3.600 inputs por tick y la
  política de elección fija, una con la salida de audio de prueba y otra sin Web Audio
- **WHEN** se avanzan las dos, pulsando M en los ticks 100 y 900 solo en la primera
- **THEN** sus snapshots son iguales campo a campo en cada tick

#### Scenario: Balance y firmas
- **GIVEN** el repositorio tras este change
- **WHEN** se ejecutan los tests de balance y de firmas
- **THEN** `BALANCE_BASELINE` y las firmas doradas coinciden sin regenerarlas, y no hay cambios en `src/domain` ni en
  `src/application` respecto de `main`

### Requirement: Ficheros de audio usados y peso
Cada fichero de audio versionado (`.ogg`, `.mp3`, `.wav`, `.flac`, sin distinguir mayúsculas) SHALL ser el de la
música o el de ≥ 1 tipo de efecto del contenido de audio, y cada fichero citado por el contenido MUST estar versionado.
La comprobación es por fichero (conjunto de ficheros distintos citados), no por tipo: un fichero citado por varios
tipos cuenta una vez. La suma de bytes de todos los ficheros de audio versionados (cada fichero una vez) MUST ser
≤ 6.291.456 (6 MB). Se comprueba con un test sobre el repositorio.

#### Scenario: Todos usados
- **GIVEN** la lista de ficheros versionados y el contenido de audio del repositorio
- **WHEN** se cruzan, por fichero
- **THEN** cada fichero de audio versionado está citado por la música o por ≥ 1 tipo, y cada fichero citado está
  versionado
- **AND** el número de ficheros de audio versionados es igual al de ficheros distintos citados (11)

#### Scenario: Fichero de audio de más
- **GIVEN** una lista simulada igual a la real más `extra.ogg` en la carpeta de audio, registrado en la nota y sin
  uso en el contenido
- **WHEN** se ejecuta el test de "Todos usados"
- **THEN** falla y nombra `extra.ogg`

#### Scenario: Tope de peso
- **GIVEN** los ficheros de audio versionados, y en otro caso una lista simulada con un fichero más que lleva el total a
  6.291.457 bytes
- **WHEN** se suman sus bytes
- **THEN** en el primer caso el total es ≤ 6.291.456 (con los ficheros del autor, 5.093.480); en el segundo el test
  falla y da el total
- **AND** con una lista simulada cuyo total es exactamente 6.291.456 bytes el test pasa

### Requirement: Audio observable en el navegador
El sistema SHALL funcionar en la build de producción con la CSP actual (ver "Política de seguridad de contenido" en
`progress-persistence`) cargando y reproduciendo el audio sin ninguna violación de CSP ni errores no capturados.

#### Scenario: Audio en la partida E2E [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa vacío de los E2E), en el test de humo de partida
  (ampliado, sin test nuevo), contando las peticiones de red a ficheros `.ogg`, `.mp3`, `.wav` y `.flac`
- **WHEN** se lee la sonda, se llama a `step(600)`, se pulsa Esc, se lee la sonda, se pulsa M, se pulsa Esc y se lee la
  sonda
- **THEN** la música está en `playing`, después en `paused` y al final en `playing`; tras M el silencio está activado y
  el volumen efectivo de música y efectos es 0
- **AND** en cada lectura reproducidas + descartadas = pedidas, hay 0 peticiones de red de audio, 0 errores no
  capturados y 0 eventos `securitypolicyviolation`

#### Scenario: Panel Sonido sin sonda [E2E]
- **GIVEN** la build de producción sin `?e2e`, sin ajustes de audio guardados, en el test de humo del menú (ampliado, sin
  test nuevo)
- **WHEN** se pulsa `Sonido`, se pulsa flecha izquierda 2 veces sobre `Música`, se cierra con `Cerrar`, se pulsa `Jugar`,
  se espera a que el menú se oculte y se recarga la página
- **THEN** tras la recarga el panel muestra música `40 %` y efectos `80 %`, el valor guardado de
  `sprint-survivors/audio` tiene música 40 y no hay errores no capturados ni eventos `securitypolicyviolation`
