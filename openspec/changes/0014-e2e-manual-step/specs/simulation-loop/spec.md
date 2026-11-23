# Spec delta · simulation-loop

<!-- Ruta: openspec/changes/0014-e2e-manual-step/specs/simulation-loop/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Convenciones de este delta:
> - "Modo manual" es el modo de avance que queda activo para la carga cuando la URL incluye `?e2e` y un
>   parámetro `manual` válido (ver "Modo de avance manual en modo E2E"). "Tiempo real" es el modo de siempre:
>   los ticks salen de los frames que informa el motor, con la velocidad N resuelta (change 0008).
> - `step(n)` es la operación `window.__sprint.step(n)` de la sonda E2E. "Devuelve k" significa que la operación
>   termina indicando que ha ejecutado k ticks; "termina" es el momento en que el resultado queda disponible
>   para el test (p. ej., al resolverse la promesa que devuelve).
> - "Partida en curso que no abre ofertas ni termina en los próximos k ticks" se usa igual que en los
>   escenarios de "Avance acelerado por frame".

## ADDED Requirements

### Requirement: Modo de avance manual en modo E2E
El sistema SHALL resolver, una sola vez por carga de la página y junto con la semilla y la velocidad, si el
modo manual está activo, a partir de la URL:
- Si la URL **no** incluye `?e2e`, el modo manual no está activo y el parámetro `manual` se ignora por completo,
  sin avisos, tenga el valor que tenga.
- Si la URL incluye `?e2e` y no incluye `manual`, el modo manual no está activo, sin avisos.
- Si la URL incluye `?e2e` y `manual`, el valor MUST validarse con zod antes de usarse: si está vacío
  (`?e2e&manual` o `?e2e&manual=`), vale `1` o vale `true`, el modo manual está activo, sin avisos; con cualquier
  otro valor (`0`, `false`, `abc`, `2`…) el modo manual **no** está activo y se emite exactamente 1 aviso por
  consola que menciona `manual` en toda la carga.

Con `?e2e`, la sonda MUST exponer si el modo manual está activo (sí/no). La resolución corresponde a la
composición y su efecto al adaptador del motor: el núcleo (`src/domain`, `src/application`) MUST NOT recibir ni
conocer el modo manual ni `step`, y la semilla, el contenido y las reglas del tick no cambian con él.

#### Scenario: Modo manual activo
- **GIVEN** la URL `?e2e&manual&seed=7` y, en otras cargas, `?e2e&manual=1&seed=7` y `?e2e&manual=true&seed=7`
- **WHEN** arranca la partida al cargar
- **THEN** la sonda indica modo manual activo, la partida usa la semilla 7 y no se emite ningún aviso que
  mencione `manual`

#### Scenario: Sin manual en modo E2E
- **GIVEN** la URL `?e2e&seed=7`
- **WHEN** arranca la partida y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** la sonda indica modo manual no activo, se ejecuta exactamente 1 tick y no se emite ningún aviso que
  mencione `manual`

#### Scenario: Valor de manual inválido en modo E2E
- **GIVEN** la URL `?e2e&manual=0`, `?e2e&manual=false`, `?e2e&manual=abc` o `?e2e&manual=2`
- **WHEN** arranca la partida y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** la sonda indica modo manual no activo y se ejecuta exactamente 1 tick
- **AND** se emite exactamente 1 aviso por consola que menciona `manual`

#### Scenario: Manual ignorado fuera de E2E
- **GIVEN** la URL `?manual` y, en otras cargas, `?manual=1&seed=42` y `?manual=abc`
- **WHEN** se pulsa `Jugar` y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** se ejecuta exactamente 1 tick, `window.__sprint` no existe y no se emite ningún aviso que mencione
  `manual`
- **AND** al terminar la partida se guardan su récord y su historial como en una partida sin `manual`

#### Scenario: Avisos independientes de seed, speed y manual
- **GIVEN** la URL `?e2e&seed=abc&manual=abc&speed=abc`
- **WHEN** arranca la partida
- **THEN** se emite exactamente 1 aviso que menciona `seed`, exactamente 1 que menciona `manual` y exactamente 1
  que menciona `speed` (el modo manual no está activo, así que `speed` se valida como siempre)

### Requirement: Sin avance por tiempo real en modo manual
En modo manual, el sistema SHALL no ejecutar ticks por el paso del tiempo real: los frames que informe el motor
MUST ejecutar 0 ticks y no acumular tiempo, sea cual sea su duración (incluidos frames de 5.000 ms), y la partida
solo avanza con `step(n)`. El resto del adaptador MUST seguir atendiendo cada frame igual que en tiempo real:
teclado (dirección, Esc, R), clics de pausa y de elección de mejora, menú, pantalla de resultados y guardado.

#### Scenario: Sin step no avanza
- **GIVEN** la URL `?e2e&manual&seed=7` y la partida recién arrancada al cargar
- **WHEN** pasan 2 s reales sin llamar a `step`
- **THEN** `snapshot.tick` sigue valiendo 0

#### Scenario: Frames largos sin step
- **GIVEN** modo manual y una partida en curso en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms y después de 1 frame de 5.000 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue igual campo a campo al del tick n
- **AND** un `step(1)` posterior devuelve 1 y deja el snapshot en el tick n + 1 (sin ráfaga por ese tiempo)

#### Scenario: Pausa sin step
- **GIVEN** modo manual y una partida en curso en el tick n
- **WHEN** se pulsa Esc sin llamar a `step`
- **THEN** la partida queda en pausa y el panel de pausa está visible, con el snapshot en el tick n

#### Scenario: Elección sin step
- **GIVEN** modo manual y una partida con una oferta abierta en el tick n
- **WHEN** se hace clic en la opción de índice 0 sin llamar a `step`
- **THEN** la oferta se cierra, la mejora elegida figura en las mejoras adquiridas y el snapshot sigue en el
  tick n con la partida en curso

#### Scenario: Reinicio sin step
- **GIVEN** modo manual y una partida terminada con la pantalla de resultados visible
- **WHEN** se pulsa R sin llamar a `step`
- **THEN** empieza una partida nueva en el tick 0 y sigue en el tick 0 tras 2 s reales sin `step`

### Requirement: Avance manual con step
Con `?e2e`, la sonda SHALL ofrecer `step(n)`, que avanza la partida un número exacto de ticks y devuelve
cuántos ha ejecutado. En modo manual, con n válido y la partida en curso, `step(n)` MUST:
- leer el input del jugador una vez, al empezar, y aplicarlo a todos sus ticks (como un frame acelerado de
  "Avance acelerado por frame"); una tecla pulsada y soltada sin ningún `step` entre medias no llega a ningún tick;
- ejecutar exactamente n ticks, sin el tope de 15 ticks por frame ni de 250 ms, y sin que el número de ticks
  dependa de la duración de los frames que informe el motor mientras dura el `step`;
- detenerse en el tick en que la partida deja de estar en curso (se abre una oferta o termina con victoria o
  derrota), descartando los ticks restantes: nunca elige una mejora ni ejecuta ticks tras el fin;
- terminar solo cuando el frame que refleja el snapshot final está pintado, y devolver el número k de ticks
  ejecutados (0 ≤ k ≤ n), de modo que `snapshot.tick` final = tick inicial + k.

`step(n)` MUST devolver 0 sin ejecutar ningún tick ni cambiar el snapshot cuando la partida está en pausa,
eligiendo mejora o terminada, cuando no hay partida (menú de inicio) y cuando el modo manual no está activo
(en este último caso, además, emite 1 aviso por consola que menciona `manual` por llamada y no altera el avance
en tiempo real).

Valores de n: es válido un entero en `[1, 9.007.199.254.740.991]` (`Number.MAX_SAFE_INTEGER`). Cualquier otro
valor (0, negativo, no entero, `NaN`, `Infinity`, texto, sin argumento) MUST rechazarse: `step` devuelve 0, no
ejecuta ningún tick, no cambia el snapshot y emite exactamente 1 aviso por consola que menciona `step` por
llamada inválida. Un n válido mayor que los ticks que le quedan a la partida avanza hasta el estado de parada.

Llamadas simultáneas: si se llama a `step` mientras otro `step` no ha terminado, las llamadas MUST ejecutarse
una tras otra en el orden en que se hicieron, sin perder ni duplicar ticks; cada una devuelve sus propios ticks.

#### Scenario: Avance exacto
- **GIVEN** la URL `?e2e&manual&seed=7` y una partida en curso en el tick 0 que no abre ofertas ni termina en los
  próximos 60 ticks
- **WHEN** se llama a `step(60)`
- **THEN** devuelve 60 y `snapshot.tick` vale 60
- **AND** tras 2 s reales sin más llamadas, `snapshot.tick` sigue valiendo 60

#### Scenario: Un solo tick
- **GIVEN** modo manual y una partida en curso en el tick n que no termina ni abre ofertas en el próximo tick
- **WHEN** se llama a `step(1)`
- **THEN** devuelve 1 y `snapshot.tick` vale n + 1

#### Scenario: Más de 15 ticks en un step
- **GIVEN** modo manual y una partida en curso en el tick 0 que no abre ofertas ni termina en los próximos 225
  ticks
- **WHEN** se llama a `step(225)`
- **THEN** devuelve 225 y `snapshot.tick` vale 225

#### Scenario: Independiente de la duración de los frames
- **GIVEN** dos cargas en modo manual con la semilla 7 y una partida en curso en el tick 0 que no abre ofertas ni
  termina en los próximos 30 ticks
- **WHEN** en ambas se llama a `step(30)`, y en una el motor informa de frames de 1 ms y en la otra de 5.000 ms
  mientras dura el `step`
- **THEN** ambas devuelven 30 y sus snapshots en el tick 30 son iguales campo a campo

#### Scenario: Input leído al empezar el step
- **GIVEN** modo manual, una partida en curso que no abre ofertas ni termina en los próximos 8 ticks, el jugador
  en (480, 270) con velocidad 200 y la flecha derecha pulsada
- **WHEN** se llama a `step(8)` y la flecha derecha se suelta antes de que termine
- **THEN** devuelve 8 y el jugador queda en x = 480 + 8 × 3,333 (error ≤ 0,01), si no lo limita el borde del mundo

#### Scenario: Pulsación sin step entre medias
- **GIVEN** modo manual, una partida en curso en el tick n con el jugador en (480, 270)
- **WHEN** se pulsa y se suelta la flecha derecha sin llamar a `step` y después se llama a `step(8)` sin ninguna
  tecla pulsada
- **THEN** devuelve 8 y el jugador sigue en (480, 270) (error ≤ 0,001), si ningún otro efecto lo mueve

#### Scenario: Oferta a mitad de step
- **GIVEN** la URL `?e2e&manual&seed=7` y una partida en el tick 0 cuya primera oferta se abre en el tick k
  (k < 3.600)
- **WHEN** se llama a `step(3600)`
- **THEN** devuelve k, `snapshot.tick` vale k, la partida está eligiendo mejora y la oferta está visible
- **AND** un `step(10)` posterior devuelve 0 y el snapshot sigue en el tick k
- **AND** tras elegir la opción de índice 0, `step(10)` devuelve 10 y `snapshot.tick` vale k + 10

#### Scenario: Oferta en el último tick del step
- **GIVEN** modo manual y una partida en el tick n cuya siguiente oferta se abre en el tick n + 5
- **WHEN** se llama a `step(5)`
- **THEN** devuelve 5 y la partida está eligiendo mejora en el tick n + 5

#### Scenario: Fin de partida a mitad de step
- **GIVEN** modo manual y una partida en curso en el tick n que termina en derrota en el tick n + m (m ≥ 1) si no
  se abre ninguna oferta antes
- **WHEN** se llama a `step(m + 1000)`
- **THEN** devuelve m, `snapshot.tick` vale n + m y la partida está terminada con derrota
- **AND** al terminar el `step` la pantalla de resultados está visible y la partida ya figura en el historial
  guardado
- **AND** un `step(10)` posterior devuelve 0 y el snapshot sigue en el tick n + m

#### Scenario: Victoria al llegar a la duración objetivo
- **GIVEN** modo manual y una partida con duración objetivo de 120 ticks, en curso en el tick 100, que no pierde ni
  abre ofertas antes del tick 120
- **WHEN** se llama a `step(50)`
- **THEN** devuelve 20, `snapshot.tick` vale 120 y la partida está terminada con victoria

#### Scenario: Step en pausa
- **GIVEN** modo manual y una partida en pausa en el tick n
- **WHEN** se llama a `step(60)`
- **THEN** devuelve 0 y el snapshot sigue igual campo a campo al del tick n
- **AND** tras pulsar Esc para reanudar, `step(1)` devuelve 1 y `snapshot.tick` vale n + 1

#### Scenario: Step en el menú
- **GIVEN** modo manual y el menú de inicio visible tras `Volver al menú`
- **WHEN** se llama a `step(60)`
- **THEN** devuelve 0 y no empieza ninguna partida

#### Scenario: Step sin modo manual
- **GIVEN** la URL `?e2e&seed=7` y una partida en curso
- **WHEN** se llama a `step(60)`
- **THEN** devuelve 0, no ejecuta ningún tick por sí mismo y se emite 1 aviso que menciona `manual`
- **AND** la partida sigue ejecutando 1 tick por frame de 16,667 ms

#### Scenario: n inválido
- **GIVEN** modo manual y una partida en curso en el tick n
- **WHEN** se llama a `step(0)`, `step(-1)`, `step(2.5)`, `step(NaN)`, `step(Infinity)`, `step("10")` o `step()`
- **THEN** cada llamada devuelve 0 y el snapshot sigue igual campo a campo al del tick n
- **AND** se emite exactamente 1 aviso por consola que menciona `step` por cada llamada (7 en total)

#### Scenario: n muy grande
- **GIVEN** modo manual y una partida en curso en el tick n que termina en el tick t (n < t ≤ 36.000) sin abrir
  ofertas entre medias
- **WHEN** se llama a `step(9007199254740991)`
- **THEN** devuelve t − n, `snapshot.tick` vale t y la partida está terminada, sin avisos que mencionen `step`

#### Scenario: Llamadas simultáneas
- **GIVEN** modo manual y una partida en curso en el tick 0 que no abre ofertas ni termina en los próximos 60 ticks
- **WHEN** se llama a `step(30)` y, antes de que termine, a `step(30)` otra vez
- **THEN** la primera llamada devuelve 30, la segunda devuelve 30 y termina después de la primera
- **AND** `snapshot.tick` vale 60 cuando termina la segunda

#### Scenario: Llamada simultánea que encuentra la oferta
- **GIVEN** modo manual y una partida en el tick 0 cuya primera oferta se abre en el tick 20
- **WHEN** se llama a `step(30)` y, antes de que termine, a `step(30)` otra vez
- **THEN** la primera devuelve 20, la segunda devuelve 0 y `snapshot.tick` vale 20 con la oferta abierta

### Requirement: Mismo resultado en avance manual
El sistema SHALL producir en modo manual el mismo desenlace que en tiempo real para la misma semilla, el mismo
contenido, la misma secuencia de inputs por tick y las mismas elecciones de mejora: resultado, tick en que
termina, nivel, bajas y lista de mejoras adquiridas con sus niveles MUST ser idénticos. Cómo se reparten los ticks
entre llamadas a `step` no cambia cuáles se ejecutan ni en qué orden.

#### Scenario: Manual frente a tiempo real
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, input (0, 0) constante y la política de
  elección fija, una en tiempo real a velocidad 1 y otra en modo manual
- **WHEN** la primera recibe frames de 16,667 ms y la segunda llamadas a `step(60)` (eligiendo la opción 0 cada vez
  que se abre una oferta) hasta que cada una termina o hasta 36.000 ticks
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la misma
  lista de mejoras adquiridas con sus niveles

#### Scenario: Reparto distinto de los ticks
- **GIVEN** dos partidas en modo manual con el contenido por defecto, la semilla 7, input (0, 0) y la política de
  elección fija
- **WHEN** una avanza con llamadas a `step(1)` y la otra con llamadas a `step(1200)`, repitiendo tras cada oferta,
  hasta llegar al tick 1.200
- **THEN** sus snapshots en el tick 1.200 son iguales campo a campo

## MODIFIED Requirements

### Requirement: Velocidad de simulación en modo E2E
El sistema SHALL resolver, una sola vez por carga de la página, una velocidad de simulación N entera en `1..15`
a partir de la URL:
- Si la URL **no** incluye `?e2e`, N vale 1 y el parámetro `speed` se ignora por completo, sin avisos, aunque esté
  presente y sea válido.
- Si la URL incluye `?e2e` y el modo manual está activo (ver "Modo de avance manual en modo E2E"), el modo manual
  gana: el parámetro `speed` se ignora por completo, sin avisos, sea válido o no, y ningún frame ejecuta ticks por
  la velocidad; `step(n)` ejecuta n ticks, no n × N.
- Si la URL incluye `?e2e`, el modo manual no está activo y no incluye `speed`, N vale 1, sin avisos.
- Si la URL incluye `?e2e`, el modo manual no está activo y `speed=<valor>`, el valor MUST validarse con zod antes
  de usarse: si es un entero en `[1, 15]`, N vale ese entero; si no, se ignora, N vale 1 y se emite exactamente 1
  aviso por consola que menciona `speed`.

La velocidad resuelta MUST aplicarse a la primera partida de la carga y a cada partida nueva obtenida al reiniciar
(ver `run-results`); el reinicio no vuelve a leer la URL ni emite avisos. La resolución de la velocidad corresponde a
la composición y su efecto al adaptador del motor: el núcleo (`src/domain`, `src/application`) MUST NOT recibir ni
conocer la velocidad, y la semilla, el contenido y las reglas del tick no cambian con ella. Sin el modo manual, el
comportamiento con `?e2e&speed=N` MUST ser idéntico al del change 0008.

#### Scenario: Velocidad válida en modo E2E
- **GIVEN** la URL `?e2e&speed=8`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 8 y no se emite ningún aviso que mencione `speed`

#### Scenario: Límites del rango
- **GIVEN** la URL `?e2e&speed=1` y, en otra carga, `?e2e&speed=15`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y 15 respectivamente, sin avisos que mencionen `speed`

#### Scenario: Velocidad inválida en modo E2E
- **GIVEN** la URL `?e2e&speed=0`, `?e2e&speed=16`, `?e2e&speed=-1`, `?e2e&speed=2.5`, `?e2e&speed=abc` o
  `?e2e&speed=`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1
- **AND** se emite exactamente 1 aviso por consola que menciona `speed`

#### Scenario: Sin velocidad en modo E2E
- **GIVEN** la URL `?e2e&seed=42`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y no se emite ningún aviso que mencione `speed`

#### Scenario: Velocidad ignorada fuera de E2E
- **GIVEN** la URL `?speed=8` y, en otra carga, `?seed=42&speed=8`
- **WHEN** arranca la partida y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** se ejecuta exactamente 1 tick
- **AND** no se emite ningún aviso que mencione `speed`

#### Scenario: Velocidad inválida ignorada fuera de E2E
- **GIVEN** la URL `?speed=abc` y, en otra carga, `?speed=16`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y no se emite ningún aviso que mencione `speed`

#### Scenario: Avisos independientes de seed y speed
- **GIVEN** la URL `?e2e&seed=abc&speed=abc`
- **WHEN** arranca la partida
- **THEN** se emite exactamente 1 aviso que menciona `seed` y exactamente 1 aviso que menciona `speed`

#### Scenario: La velocidad se mantiene al reiniciar
- **GIVEN** la URL `?e2e&speed=8` y una primera partida terminada
- **WHEN** se pulsa R y el motor informa de 1 frame de 16,667 ms
- **THEN** la partida nueva ejecuta exactamente 8 ticks y su snapshot tiene tick 8

#### Scenario: Reinicio tras una velocidad inválida
- **GIVEN** la URL `?e2e&speed=abc`, que emitió 1 aviso al arrancar la primera partida, y esa partida terminada
- **WHEN** se pulsa R 3 veces, terminando cada partida antes del siguiente reinicio
- **THEN** cada partida nueva ejecuta 1 tick por frame de 16,667 ms y el total de avisos que mencionan `speed`
  sigue siendo 1

#### Scenario: Manual gana a speed
- **GIVEN** la URL `?e2e&manual&speed=8&seed=7` y la partida recién arrancada al cargar
- **WHEN** el motor informa de 120 frames de 16,667 ms sin llamar a `step`
- **THEN** `snapshot.tick` sigue valiendo 0 y no se emite ningún aviso que mencione `speed`
- **AND** con la partida en curso y sin ofertas ni fin en los próximos 10 ticks, `step(10)` devuelve 10 y
  `snapshot.tick` vale 10 (no 80)

#### Scenario: Manual con speed inválida
- **GIVEN** la URL `?e2e&manual&speed=abc` y, en otra carga, `?e2e&manual&speed=16`
- **WHEN** arranca la partida
- **THEN** no se emite ningún aviso que mencione `speed` y la partida no avanza sin `step`

#### Scenario: Manual inválido no anula speed
- **GIVEN** la URL `?e2e&manual=abc&speed=8`
- **WHEN** arranca la partida y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** se ejecutan exactamente 8 ticks
- **AND** se emite exactamente 1 aviso que menciona `manual` y ninguno que mencione `speed`

### Requirement: Velocidad en todas las partidas de la carga
El sistema SHALL aplicar el modo de avance y la velocidad de simulación resueltos para la carga (ver "Modo de
avance manual en modo E2E" y "Velocidad de simulación en modo E2E") a todas las partidas de esa carga: la primera,
las obtenidas al reiniciar con R y las que empiezan al pulsar `Jugar` tras `Volver al menú`. Si el modo manual está
activo, todas esas partidas avanzan solo con `step(n)` y empiezan en el tick 0 sin ticks pendientes; si no, todas
usan la velocidad resuelta. Ninguna de ellas vuelve a leer la URL ni emite avisos que mencionen `speed` o `manual`.

#### Scenario: Velocidad tras volver al menú
- **GIVEN** la URL `?e2e&speed=8`, la primera partida abandonada con `Volver al menú`
- **WHEN** se pulsa `Jugar` y el motor informa de 1 frame de 16,667 ms
- **THEN** la partida nueva ejecuta exactamente 8 ticks y su snapshot tiene tick 8

#### Scenario: Velocidad inválida y varios Jugar
- **GIVEN** la URL `?e2e&speed=abc`, que emitió 1 aviso al cargar
- **WHEN** se abandona la partida con `Volver al menú` y se pulsa `Jugar`, 3 veces seguidas
- **THEN** cada partida nueva ejecuta 1 tick por frame de 16,667 ms y el total de avisos que mencionan `speed` sigue
  siendo 1

#### Scenario: Manual tras reiniciar con R
- **GIVEN** la URL `?e2e&manual&seed=7` y una primera partida terminada con `step`
- **WHEN** se pulsa R y pasan 2 s reales sin llamar a `step`
- **THEN** la partida nueva sigue en el tick 0
- **AND** con la partida en curso y sin ofertas ni fin en los próximos 10 ticks, `step(10)` devuelve 10 y
  `snapshot.tick` vale 10

#### Scenario: Manual tras volver al menú
- **GIVEN** la URL `?e2e&manual&seed=7` y la primera partida, en el tick 50, abandonada con `Volver al menú`
- **WHEN** se pulsa `Jugar` y el motor informa de 120 frames de 16,667 ms sin llamar a `step`
- **THEN** la partida nueva sigue en el tick 0
- **AND** con la partida en curso y sin ofertas ni fin en los próximos 10 ticks, `step(10)` devuelve 10 y
  `snapshot.tick` vale 10

#### Scenario: Manual inválido y varios reinicios
- **GIVEN** la URL `?e2e&manual=abc`, que emitió 1 aviso que menciona `manual` al cargar
- **WHEN** se pulsa R 3 veces, terminando cada partida antes del siguiente reinicio
- **THEN** cada partida nueva ejecuta 1 tick por frame de 16,667 ms y el total de avisos que mencionan `manual`
  sigue siendo 1

## REMOVED Requirements
<!-- Ninguno. "Avance acelerado por frame" y "Mismo resultado con cualquier velocidad" siguen describiendo el
     tiempo real; en modo manual no se aplica ninguna velocidad (ver MODIFIED "Velocidad de simulación en modo
     E2E"). -->
