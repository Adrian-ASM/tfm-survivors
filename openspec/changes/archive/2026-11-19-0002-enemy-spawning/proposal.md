# Proposal · 0002-enemy-spawning

- **Estado**: aprobada (2026-11-19)
- **Issue**: — (opcional)
- **Rama / worktree**: `change/0002-enemy-spawning`
- **Depende de**: 0001-walking-skeleton (archivado el 2026-11-19).
- **Exploración**: `openspec/changes/0002-enemy-spawning/exploration.md`

## Problema
Tras el walking skeleton, la partida consiste en un círculo que se mueve por una arena vacía. No hay amenaza,
así que no hay juego: el pilar del GDD de "oleadas que crecen" (Must: "3 tipos de enemigo con oleadas") no
existe. Además, el siguiente change (0003, colisiones y daño) no tiene con qué chocar. Por último, AGENTS.md §3.3
exige el puerto `RandomGenerator` en el núcleo y todavía no existe: hasta ahora no hacía falta aleatoriedad.

## Objetivo
Al abrir el juego, empiezan a aparecer enemigos de los 3 tipos del GDD (*bug*, *memory leak*, *merge conflict*)
justo fuera de la zona visible alrededor del jugador, recortados a la arena. Mientras la arena mida lo mismo que la
pantalla, aparecen en la práctica por los bordes. Avanzan en línea recta hacia él, cada tipo con su
velocidad y su tamaño, y su número crece con el tiempo siguiendo una tabla de oleadas definida en contenido.
Con la misma semilla y los mismos inputs, la partida es idéntica tick a tick.

## Alcance

### Dentro
- **Tipos de enemigo** en `content/enemies.json`, validados con zod: los 3 del GDD. Cada uno tiene identificador,
  velocidad, radio y coste (para el director de oleadas). Solo cambian los números; no hay comportamientos
  distintos por tipo.
- **Oleadas con modelo híbrido** en `content/waves.json`, validado con zod. Son tramos por tiempo de partida, y
  cada tramo fija el presupuesto o ritmo de spawn y los tipos permitidos. Un director va acumulando ese
  presupuesto y lo gasta en enemigos según su coste.
- **Validación cruzada del contenido**: cada tipo citado en `waves.json` existe en `enemies.json`. Velocidad,
  radio y coste son positivos, el radio cabe en la arena y los tramos están ordenados y sin solaparse. Si el
  contenido no es válido, la partida no arranca y el error es explícito.
- **Vista** como concepto de dominio: es el rectángulo que el jugador ve alrededor de su posición, medido en
  unidades de mundo (no en píxeles de pantalla), con su tamaño en contenido. El dominio no sabe nada de la cámara
  ni del canvas.
- **Posición de spawn**: se elige un punto de un anillo centrado en el jugador. El radio del anillo no se escribe
  en el contenido: se calcula como la mitad de la diagonal de la vista más un margen (este sí, en contenido),
  para que el enemigo nazca justo fuera de la zona visible. Después,
  la posición se recorta a la arena con `Arena.clampCircle`, que no cambia. Tras el recorte, el enemigo MUST
  quedar a una distancia mínima del jugador también configurada en contenido. Si no la cumple, se reintenta un
  número acotado de veces. Si ningún intento es válido, ese spawn se aplaza y nunca se coloca al enemigo junto
  al jugador. Mientras la arena mida lo mismo que la vista, el efecto es casi idéntico a aparecer por el borde,
  y la regla ya sirve para un mapa mayor que la vista.
- **Persecución**: cada tick, cada enemigo avanza en línea recta hacia la posición actual del jugador, a la
  velocidad de su tipo. No hay separación entre enemigos (se pueden solapar) y siempre se quedan dentro de la arena.
- **Tope duro de enemigos vivos**: 200, configurable en contenido. Mientras se esté en el tope no se generan
  enemigos nuevos.
- **Aleatoriedad determinista**: el núcleo recibe inyectado el puerto `RandomGenerator` con semilla. La composición
  elige la semilla. Si la URL trae `?seed=`, se valida con zod como entero sin signo de 32 bits (0 a 4294967295).
  Si falta, se usa una semilla aleatoria. Si es inválida, se ignora, se usa una semilla aleatoria y se avisa por
  consola. El núcleo sigue sin usar `Math.random`, `Date.now` ni APIs del navegador.
- **Benchmark de rendimiento** en este change: un benchmark de Vitest sobre el núcleo, sin motor, con 200 enemigos
  vivos.
- **Snapshot ampliado**: `RunSnapshot` incluye la lista de enemigos vivos con su tipo, posición y radio, y sigue
  sin poder mutarse desde fuera.
- **Render**: el adaptador pinta N enemigos (un círculo por enemigo, con color o tamaño distinto según el tipo,
  como placeholder) a partir del snapshot.

### Fuera
- Vida de los enemigos: no entra en `enemies.json` en este change y llega con 0003 (es la opción por defecto).
- Colisiones, daño, vida del jugador y muerte de enemigos (0003).
- Armas automáticas (0004). XP y gemas (0005).
- Temporizador visible, victoria y derrota, y HUD (0006).
- Guardar o mostrar la semilla y el reto diario (0007).
- Arena mayor que la pantalla y cámara que sigue al jugador (será otro change, que podrá aprovechar la regla
  de spawn por vista).
- Jefe, separación entre enemigos o *flocking* y comportamientos especiales por tipo.
- Balance fino de números: los valores iniciales son orientativos y se ajustarán al jugar.
- Arte y audio definitivos.

## Capacidades afectadas
- `openspec/specs/enemy-spawning` (nueva): catálogo de tipos y oleadas desde contenido, director por
  presupuesto, vista y posición de spawn (anillo y recorte), tope de vivos y validación de contenido.
- `openspec/specs/enemy-behavior` (nueva): persecución en línea recta y confinamiento en la arena.
- `openspec/specs/simulation-loop` (modificada): el determinismo pasa a incluir la semilla y el snapshot incluye
  los enemigos.
- `openspec/specs/architecture-guardrails` (sin cambios previstos): se comprobará que el puerto nuevo y su
  implementación con semilla respetan las reglas de capas y pureza sin tocarlas.
- `openspec/specs/player-movement`: sin cambios.

## Riesgos y dudas
- **Rendimiento con muchos enemigos**: con cientos de enemigos a 60 Hz, el `Vector2` inmutable crea varios objetos
  por enemigo y tick, lo que presiona al recolector de basura y puede provocar tirones. También pesan las copias
  congeladas del snapshot y crear y destruir objetos de render. El tope de 200 vivos acota el problema y el
  benchmark de este change lo mide (≤ 2 ms por tick). Si no se cumple, ADR-0003 (camino caliente con estructuras
  mutables internas) tendrá que adelantarse a este change. Lo decide el diseño. El benchmark depende de la
  máquina: en CI puede dar resultados variables.
- **Determinismo**: cualquier uso de aleatoriedad fuera del puerto, o un orden de consumo de números aleatorios
  que dependa de algo no determinista, rompe la reproducibilidad. La igualdad tiene que ser estricta, sin
  tolerancia, sobre un snapshot más grande. Cambiar los valores de contenido cambia la partida aunque la semilla
  sea la misma, y es lo esperado.
- **El recorte acerca el spawn**: con la arena del tamaño de la vista (960x540), casi todo punto del anillo cae
  fuera de la arena y el recorte lo trae al borde, más cerca del jugador que el radio del anillo. Por eso la
  distancia mínima tras el recorte tiene que ser menor que el radio del anillo, o casi ningún intento será
  válido. Si el jugador está pegado a un lado o en una esquina, los puntos recortados contra ese lado quedan
  cerca de él y se rechazan. Los reintentos y el aplazamiento lo resuelven, pero el ritmo efectivo puede bajar.
  Además, el recorte concentra los spawns en el borde (sobre todo en las esquinas) y la distribución deja de ser
  uniforme.
- **Vista frente a pantalla**: si el tamaño de la vista en contenido no coincide con lo que de verdad pinta el
  adaptador, los enemigos pueden nacer a la vista. Hay que mantener los dos tamaños coherentes.
- **Apelotonamiento**: sin separación, los enemigos se van fundiendo en un solo montón. Es aceptable en este
  change. Si resulta molesto al jugar, se valorará en otro change.
- **Contenido acoplado**: la carga actual de configuración solo conoce 2 ficheros y ahora entran 2 más con
  validación cruzada.

## Decisiones tomadas
- Tope duro de vivos: 200, en contenido.
- Semilla: `?seed=` como entero sin signo de 32 bits validado con zod. Si es inválida, se ignora, se usa una
  aleatoria y se avisa por consola. Si falta, también se usa una aleatoria.
- Rendimiento: el benchmark (≤ 2 ms por tick con 200 enemigos) se mide ya en 0002, con Vitest sobre el núcleo.
- Radio del anillo calculado, no literal: mitad de la diagonal de la vista más el margen. Con una vista de
  960x540, sale ≈ 550,7 + 32 ≈ 582,7 unidades.
- Valores por defecto que se mantienen: la vida de los enemigos se deja para 0003; margen de 32 unidades;
  distancia mínima tras el recorte de 200 unidades; 8 reintentos.

## Preguntas abiertas (para el gate)
1. ¿El benchmark de ≤ 2 ms es un test que bloquea `npm run verify` y CI, o es un informe aparte (por ejemplo,
   `npm run bench`) para no depender de la máquina del CI?
2. ¿El tamaño de la vista es un fichero de contenido propio o va junto a la arena? En cualquier caso, la
   propuesta lo fija en 960x540 unidades de mundo.

## Criterio de éxito
- Los escenarios de `enemy-spawning`, `enemy-behavior` y del `simulation-loop` modificado están en verde, y
  `npm run verify` y CI también.
- Dos partidas con la misma semilla y la misma secuencia de 600 inputs (10 s) dan snapshots estrictamente
  iguales en cada tick. Con semillas distintas, las posiciones de spawn difieren.
- En una partida simulada de 10 min (36.000 ticks) con input aleatorio determinista, ningún enemigo aparece
  fuera de la arena ni, tras el recorte, a menos de la distancia mínima configurada del jugador.
- Con una arena mayor que la vista y el jugador lejos de los bordes (caso de test), todo spawn queda a una
  distancia del jugador igual al radio de la vista más el margen (con tolerancia de redondeo de 1e-9), es
  decir, fuera de la zona visible.
- Cuando ningún reintento es válido (por ejemplo, con el jugador en una esquina y una distancia mínima
  inalcanzable), ese tick no genera el enemigo y el presupuesto no se pierde.
- El número de enemigos vivos nunca supera el tope configurado y, con la tabla de oleadas por defecto, el número
  de spawns por minuto no baja de un tramo al siguiente.
- Un contenido inválido (tipo inexistente en una oleada, radio o velocidad ≤ 0) se rechaza con un error explícito.
- En la URL de Pages se ven enemigos de 3 colores o tamaños distintos que aparecen en el borde de la pantalla
  y persiguen al jugador. `?seed=42` reproduce la misma partida si se repiten los mismos movimientos.
- Con `?seed=-1`, `?seed=4294967296` o `?seed=abc`, la partida arranca con una semilla aleatoria y la consola
  muestra 1 aviso.
- Con 200 enemigos vivos, el tick de simulación tarda ≤ 2 ms de media en el benchmark de Vitest sobre el núcleo.
