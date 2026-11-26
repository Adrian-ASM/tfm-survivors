# Spec delta · simulation-loop

<!-- Ruta: openspec/changes/0033-mobile-web/specs/simulation-loop/spec.md
     Motivo: el aviso de orientación (`touch-controls`) detiene la partida con la partida en curso y sin la pausa del
     jugador. Sin este delta, "Avance manual con step" obligaría a `step(n)` a ejecutar n ticks con el aviso visible.
     Solo se añade el aviso a las condiciones de parada; el resto se copia sin cambios. -->

## ADDED Requirements

## MODIFIED Requirements

### Requirement: Sin tiempo acumulado durante la pausa ni antes de jugar
El sistema SHALL no ejecutar ticks ni acumular tiempo real mientras la partida está en pausa (ver `main-menu`) o
mientras se ve el aviso de orientación vertical del modo móvil (ver "Aviso de orientación vertical" en
`touch-controls`), y en lo que sigue "en pausa" incluye ambos casos: los frames que el motor informe con la partida en
pausa MUST ejecutar 0 ticks, sea cual sea su duración (incluidos frames largos por una pestaña oculta), y el acumulador
MUST quedar a 0 desde el momento de pausar, descartando el tiempo sobrante que tuviera. Al reanudar (o al desaparecer el
aviso) no se pierde ni se gana tiempo simulado: el snapshot es el mismo que al pausar y el bucle sigue con las reglas de
"Paso fijo de simulación" y "Avance acelerado por frame", sin ráfaga de ticks de recuperación por el tiempo pasado en
pausa. Del mismo modo, la partida que empieza al pulsar `Jugar` MUST empezar con el acumulador a 0, sin ráfaga por el
tiempo pasado en el menú. Esto vale con cualquier velocidad N en `1..15`. El aviso de orientación no es la pausa del
jugador: no abre el overlay de pausa y no cambia si la partida estaba o no en pausa.

#### Scenario: Frames durante la pausa
- **GIVEN** una partida en curso en el tick n
- **WHEN** se pulsa Esc y el motor informa de 300 frames de 16,667 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue igual campo a campo al del tick n

#### Scenario: Primer frame tras reanudar
- **GIVEN** la partida del escenario anterior tras sus 300 frames en pausa
- **WHEN** se pulsa Esc de nuevo y el motor informa de 16,667 ms
- **THEN** se ejecuta exactamente 1 tick y el snapshot tiene tick n + 1

#### Scenario: Frame largo durante la pausa
- **GIVEN** una partida en pausa en el tick n
- **WHEN** el motor informa de 1 frame de 5.000 ms, se reanuda y el motor informa de 16,667 ms
- **THEN** el frame de 5.000 ms ejecuta 0 ticks y el primer frame tras reanudar ejecuta exactamente 1 tick (tick
  n + 1)

#### Scenario: Sobrante descartado al pausar
- **GIVEN** un bucle con una partida en curso que, tras un frame de 25 ms, ha ejecutado 1 tick y tiene 8,333 ms
  sobrantes
- **WHEN** se pulsa Esc, se reanuda sin que el motor informe de ningún frame y el motor informa de 8,334 ms
- **THEN** ese frame ejecuta 0 ticks
- **AND** un segundo frame de 8,334 ms ejecuta exactamente 1 tick

#### Scenario: Reanudar a velocidad 8
- **GIVEN** la URL `?e2e&speed=8` y una partida en pausa en el tick n que no abre ofertas ni termina en los próximos
  16 ticks
- **WHEN** el motor informa de 300 frames de 16,667 ms, se reanuda y el motor informa de 2 frames de 16,667 ms
- **THEN** durante la pausa se ejecutan 0 ticks y tras reanudar el snapshot tiene tick n + 8 después del primer
  frame y n + 16 después del segundo

#### Scenario: Pausa a velocidad 15 con frame largo
- **GIVEN** la URL `?e2e&speed=15` y una partida en pausa en el tick n
- **WHEN** el motor informa de 1 frame de 5.000 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Primer frame tras Jugar
- **GIVEN** el modo menú sobre el que el motor ha informado de 600 frames de 16,667 ms y, después, de 1 frame de
  5.000 ms
- **WHEN** se pulsa `Jugar` y el motor informa de 16,667 ms
- **THEN** la partida ejecuta exactamente 1 tick y su snapshot tiene tick 1
- **AND** si en su lugar el motor informa de 8,334 ms, la partida ejecuta 0 ticks

#### Scenario: Sobrante descartado con el aviso de orientación
- **GIVEN** el modo móvil y un bucle con una partida en curso, sin pausa, que tras un frame de 25 ms ha ejecutado
  1 tick y tiene 8,333 ms sobrantes
- **WHEN** la ventana pasa a vertical, el motor informa de 1 frame de 5.000 ms, la ventana vuelve a horizontal y el
  motor informa de 8,334 ms y después de otros 8,334 ms
- **THEN** el frame de 5.000 ms y el primero de 8,334 ms ejecutan 0 ticks y el segundo ejecuta exactamente 1 tick
- **AND** el overlay de pausa no se ha visto en ningún frame

### Requirement: Avance manual con step
Con `?e2e`, la sonda SHALL ofrecer `step(n)`, que avanza la partida un número exacto de ticks y devuelve
cuántos ha ejecutado. En modo manual, con n válido y la partida en curso, `step(n)` MUST:
- leer el input del jugador una vez, al empezar, y aplicarlo a todos sus ticks (como un frame acelerado de
  "Avance acelerado por frame"); una tecla pulsada y soltada sin ningún `step` entre medias no llega a ningún tick;
- ejecutar exactamente n ticks, sin el tope de 15 ticks por frame ni de 250 ms, y sin que el número de ticks
  dependa de la duración de los frames que informe el motor mientras dura el `step`;
- detenerse en el tick en que la partida deja de estar en curso (se abre una oferta, se abre la tienda o termina con
  victoria o derrota), descartando los ticks restantes: nunca elige una mejora, nunca compra ni sale de la tienda y
  nunca ejecuta ticks tras el fin;
- terminar solo cuando el frame que refleja el snapshot final está pintado, y devolver el número k de ticks
  ejecutados (0 ≤ k ≤ n), de modo que `snapshot.tick` final = tick inicial + k.

`step(n)` MUST devolver 0 sin ejecutar ningún tick ni cambiar el snapshot cuando la partida está en pausa,
eligiendo mejora, en tienda o terminada, cuando se ve el aviso de orientación vertical del modo móvil (ver "Aviso de
orientación vertical" en `touch-controls`), cuando no hay partida (menú de inicio) y cuando el modo manual no está
activo (en este último caso, además, emite 1 aviso por consola que menciona `manual` por llamada y no altera el avance
en tiempo real). Como en modo manual el reloj de render solo avanza n × `TICK_MS` con cada `step(n)` (0014), un
`step(n)` que devuelve 0 no lo avanza.

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
  (k < 4.800)
- **WHEN** se llama a `step(4800)`
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

#### Scenario: Step con el aviso de orientación
- **GIVEN** la URL `?e2e&manual&mobile=1&seed=42`, una partida en curso y sin pausa en el tick n que no abre ofertas ni
  termina en los próximos 60 ticks, y la ventana en vertical con el aviso visible
- **WHEN** se llama a `step(60)`
- **THEN** devuelve 0, el snapshot sigue igual campo a campo al del tick n, el reloj de render no ha avanzado y no se
  emite ningún aviso que mencione `step` ni `manual`
- **AND** con la ventana de nuevo en horizontal, `step(60)` devuelve 60 y `snapshot.tick` vale n + 60

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

#### Scenario: Tienda a mitad de step
- **GIVEN** modo manual y una partida en el tick n que abre la tienda en el tick n + 7
- **WHEN** se llama a `step(20)`
- **THEN** devuelve 7, `snapshot.tick` vale n + 7 y la partida está en tienda
- **AND** un `step(10)` posterior devuelve 0; tras salir de la tienda, `step(10)` devuelve 10

## REMOVED Requirements
