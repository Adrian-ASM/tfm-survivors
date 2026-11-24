# Proposal · 0021-goblin-camps

- **Estado**: aprobada por el autor en bloque (2026-11-24): decisiones A1–A3, D1–D9 con la opción recomendada y barril con salida 60 + vida 25 + radio 80
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0021-goblin-camps`
- **Entradas**: `exploration.md` de este change; mediciones previas del 2026-11-24 (apartados 1, 2, 3, 5, 7b y 7c
  y el dato del bot v4; el anexo de la medición 6 no se usa); fila 0021 del backlog de `docs/gdd.md`; proposal y
  specs delta de `0020-enemy-behaviors` (sin archivar); decisiones del autor del 2026-11-24.

## Problema

En 0020 cada goblin tiene un comportamiento propio, pero el mapa sigue sin presencia goblin: todos los enemigos
llegan por el anillo de oleadas y el mundo de 3.840 × 2.160 no tiene ningún lugar con un peligro propio. El GDD
describe casas y torres goblin destruibles y un Goblin TNT de guardia que vive junto a ellas. En 0020 ese TNT se
sustituyó por un artillero provisional (D7) y la parte B se aplazó a este change.

Además, según las mediciones previas (7b), el Goblin Barril casi nunca llega a cumplir su papel de kamikaze. En las
partidas ganadas solo el 3,8 % de los barriles enciende la mecha (11,9 de 315,3 por partida) y explota el 1,5 %. El
arco los mata antes. Aun así, el barril es la primera fuente de daño en las derrotas (43,7 %, apartado 3).

## Objetivo

Al terminar:

1. El mapa generado incluye **casas y torres goblin destruibles**, colocadas por semilla, de forma determinista,
   lejos de la zona de inicio, del castillo y del agua.
2. Las casas hacen nacer un **Goblin TNT de guardia** que patrulla alrededor de su puesto, entra en **alerta** al
   detectar al jugador y **vuelve a su puesto** cuando lo pierde. La torre es solo una estructura destruible y no
   ataca.
3. Las armas del jugador pueden destruir casas y torres. Una casa destruida deja de hacer nacer guardias y queda
   como ruina visible.
4. El Goblin Barril llega a encender la mecha más a menudo que hoy (más de 16,3 mechas por partida de media en
   1..50) y el balance sigue en banda.
5. Casas, torres, ruinas y guardias se ven con arte CC0 de Update 010 y tienen aspecto de reserva si una hoja no
   carga.

## Decisiones del autor ya tomadas (2026-11-24)

- **A1. Sin chore previo.** La distancia de lanzamiento del TNT artillero se queda en **100 px** y la curva de XP en
  **9/4** (`baseXp` 9, `xpGrowth` 4). La revisión de la distancia (frente a los 260 px del diseño original) se aplaza
  a un change futuro **"balance-pass-2"** del backlog Should, sin número fijo, que revisará stats, métricas y el bot.
  El GDD lo tendrá que recoger (lo actualiza `game-designer` u orquestador, no esta propuesta).
- **A2. W3 (esquiva del bot v3) es condicional.** Solo se arregla si la mecánica del TNT de guardia lo exige: por
  ejemplo, si lanza desde más de 150 px (fuera del rango de huida del bot) a un jugador quieto y el gate de balance
  cae fuera de la banda. En ese caso entra el arreglo **"flee-nearest"** en `tests/support/` (bot v4): cuando la
  suma de esquiva es nula con ≥ 1 aviso amenazante, se usa la huida de v3 y, si sigue dando (0, 0), se huye del
  enemigo vivo más cercano sin límite de rango (+x si no hay ninguno). Justificación medida sobre la línea base:
  **29/50 y 0 quietos** con flee-nearest, frente a 27/50 con v3, con el mismo tiempo de lote (22,8 s frente a
  21,8 s). El desempate fijo +x que sustituye a la huida baja a **18/50** y queda descartado. Si W3 no hace falta, el
  bot sigue en v3 y su spec no cambia.
- **A3. Ajuste del Goblin Barril en este change.** El autor **autoriza tocar stats de tipo de `goblin-barrel`**
  (vida) además de sus parámetros de comportamiento y de peligro (distancia de activación y radio de explosión). La
  spec delta `run-outcome` de 0020 dejaba los stats de tipo fuera de las palancas de balance ("Presupuesto de
  oleadas y stats intactos"). Esta autorización vale solo para `goblin-barrel`. Medido con TNT 100, curva 9/4 y
  bot v3 (7b y 7c):
  - Una sola palanca no basta. Más vida hunde las victorias (vida ×1,5 → **11/50**). Más distancia de activación
    deja el barril inofensivo (activación 60 → **41/50**, con un daño de barril de 11,0 por partida ganada).
  - **Candidata recomendada**: activación 60 + vida 25 (×1,25) + radio de explosión 80 (+25 %). Da **29/50**,
    0 quietos (generado y vacío), **29,0 mechas** por partida frente a 16,3 (×1,8) y **16,4 explosiones** frente a
    6,6 (×2,5).
  - **Alternativa**: activación 60 + radio 80, sin cambiar la vida. Da **32/50**, 0 quietos y **24,2 mechas** por
    partida (×1,5).
  - El autor elige una de las dos en este gate. La cifra final **se recalibra en apply con las casas y los guardias
    presentes**, dentro de la banda 25–35 y con 0 quietos, sin salir de las cotas de "Comportamiento por defecto
    legible y esquivable" (`enemy-behavior` de 0020). Con la candidata: activación 60 < radio 80, y la mecha de
    40 ticks ≥ ⌈(80 + 16 − 60) / (215 / 60)⌉ = 11.

## Alcance

- **Dentro**:
  - **Estructuras goblin en el mapa generado**: dos tipos, `goblin-house` y `goblin-tower`, cada uno con huella,
    vida y radio de impacto en `content/` (validados con zod). Se colocan con la semilla, solo sobre `grass`, a
    distancia mínima de la zona de inicio, del castillo y del agua, y con una separación mínima entre ellas. El mapa
    vacío y los mapas explícitos no tienen estructuras salvo que el escenario las declare.
  - **Rejilla intacta (opción A de la exploración, ver D1)**: las estructuras son entidades del núcleo, no celdas. La
    rejilla, el campo de flujo, la conectividad y la firma dorada de celdas no cambian. El recálculo del campo de
    flujo por edificios sigue en **0025 build-sites**.
  - **Estructuras destruibles**: reciben daño de las armas del jugador (ver D4), tienen vida, se destruyen al llegar a
    0 y quedan como ruina hasta el final de la partida. Aparecen en el snapshot (id, tipo, posición, radio, vida,
    destruida) y en la sonda E2E.
  - **Goblin TNT de guardia** (tipo nuevo, ver D3): nace en la puerta de una casa viva, con un tope por casa y un
    intervalo de contenido. Tiene estados nuevos de clase cerrada (patrulla, alerta y vuelta) que amplían los de
    ADR-0019, con sus parámetros en `content/enemies.json`: radio de patrulla, radio de detección, radio de
    abandono de la alerta y duraciones. En alerta reutiliza el ciclo de lanzamiento de dinamita de 0020. Cada
    guardia guarda su puesto. Respeta el invariante "el centro de todo enemigo vivo está en celda caminable".
  - **Ajuste del Goblin Barril** según A3.
  - **Arte**: `Goblin_House.png`, `Goblin_House_Destroyed.png`, una hoja `Wood_Tower_<color>.png` y
    `Wood_Tower_Destroyed.png` del pack local Update 010 (4 ficheros), con sha256 y bytes en
    `content/asset-provenance.json`, entradas en `content/appearance.json`, reserva de color por elemento y tejado o
    copa en la capa alta. El guardia reutiliza `TNT_Red`.
  - **Balance** con el contenido final y, si hace falta según A2, bot v4.
  - Determinismo: misma semilla y mismas entradas dan la misma partida. Las estructuras usan un flujo de azar propio
    (ver D2). Nacer, patrullar, entrar en alerta y volver no consumen azar.
- **Fuera**:
  - **Campamentos de guardianes en zonas ricas en recursos** (si el autor aprueba D8): pasan a **0023
    resources-sheep** o a un change posterior, cuando "zona rica" signifique algo (madera, oro, ovejas). Hoy solo se
    podría definir por densidad de troncos y no darían ningún premio por explorarlos.
  - La revisión de la distancia de lanzamiento del TNT artillero y de la curva de XP (A1 → balance-pass-2).
  - El arreglo de W3 si no hace falta (A2).
  - Recálculo del campo de flujo por estructuras, estructuras que bloquean a los enemigos o cambian la rejilla
    (**0025 build-sites**).
  - Ataque propio de la torre (disparo o generación de enemigos).
  - Recompensas por destruir estructuras distintas de lo decidido en D6 (madera y oro en 0023/0024).
  - Separación y colisión entre enemigos, y de enemigos con el mapa (siguen aplazadas desde 0019).
  - Cambios en el presupuesto de oleadas, `maxAlive`, el anillo, `player.speed`, armas, mejoras y stats de
    `goblin-torch` y `goblin-tnt`. Si el balance los exigiera, se vuelve a este gate.
  - `Wood_Tower_InConstruction`, los demás colores de torre y `Fire.png`. Siguen prohibidos.
  - Sonido.

## Decisiones para el autor (aprobables en bloque)

Cada una lleva la opción **recomendada** y su alternativa. La pregunta 1 de la exploración queda resuelta por A1
(sin chore) y por D8 (campamentos).

- **D1. ¿Bloquean las estructuras?** (pregunta 2)
  - *Recomendada*: **opción A**. Las estructuras no son celdas y no colisionan con nadie: el jugador las atraviesa y
    los enemigos las ignoran, como ya ignoran el mapa. No toca `GameMap`, `FlowField`, la colisión del jugador ni el
    bot. Mantiene "Mapa de la partida de solo lectura" y deja el recálculo para 0025.
  - *Alternativa*: **opción C**. Bloquean al jugador mientras viven, con una máscara de colisión aparte del mapa, y
    el campo de flujo las ignora. Se ve más creíble, pero amplía `player-movement` (colisión) y el bot de referencia
    (repulsión y bloqueo por estructuras), y por eso el bot pasaría a v4 aunque W3 no hiciera falta. La opción B
    (celdas sólidas nuevas) queda descartada porque adelanta 0025.
- **D2. Azar de la colocación.**
  - *Recomendada*: un **flujo de azar propio** derivado de la semilla (`STRUCT_STREAM`), distinto de `MAP_STREAM` y
    `DECOR_STREAM`. Ríos, puentes, troncos y castillo de cada semilla no cambian (la firma dorada de celdas no se
    toca) y se añade una firma dorada de estructuras.
  - *Alternativa*: seguir consumiendo `MAP_STREAM` después de los troncos. Conserva la rejilla actual, pero acopla
    cualquier cambio futuro del generador a las estructuras.
- **D3. TNT de guardia frente al de oleada.** (pregunta 4)
  - *Recomendada*: **tipo nuevo `goblin-tnt-guard`** con los mismos stats que `goblin-tnt` y comportamiento de
    patrulla, alerta y vuelta. El `goblin-tnt` de oleada sigue como artillero (sustituye la previsión de D7 de 0020).
    El catálogo pasa de 3 a 4 tipos. Nace solo de casas, no del director de oleadas, y cuenta contra `maxAlive`.
  - *Alternativas*: (1) sumar los guardias al TNT de oleada con el mismo tipo; (2) quitar `goblin-tnt` de
    `waves.json`. La exploración prevé que (2) mueva la presión a zonas que el bot no visita y deje el balance sin
    sentido (> 35 victorias).
- **D4. ¿Qué hace la torre?** (pregunta 3)
  - *Recomendada*: **solo estructura destruible**, sin ataque ni guardias. Una casa basta para generar TNT.
  - *Alternativa*: torre que también hace nacer guardias (mismo mecanismo que la casa, otro tope).
- **D5. Armas y explosiones sobre estructuras.** (pregunta 5)
  - *Recomendada*: las armas del jugador apuntan a estructuras **con prioridad menor que los enemigos**: el proyectil
    elige estructura solo si no hay ningún enemigo vivo en alcance. El pulso de área daña a las estructuras que
    solapa. Las explosiones (barril y dinamita) **no** dañan estructuras, como en 0020.
  - *Alternativa*: objetivos mezclados por distancia (las flechas se gastan en casas) o explosiones que también las
    dañan.
- **D6. Recompensa por destruir.** (pregunta 6)
  - *Recomendada*: **nada** hasta 0023/0024. No suelta gema ni suma al contador de bajas, que sigue contando solo
    enemigos. La recompensa es que la casa deje de hacer nacer guardias.
  - *Alternativa*: una gema de XP con valor de contenido (afecta a la curva y al balance).
- **D7. Patrulla.** (pregunta 7)
  - *Recomendada*: **determinista y sin azar**: puntos fijos derivados del puesto (p. ej. las 4 esquinas de un
    cuadrado de radio de contenido, recorridas en orden fijo y recolocadas a la celda caminable más cercana) y vuelta
    por línea libre o por un campo de distancias hacia el puesto calculado una vez por casa (la rejilla no cambia).
  - *Alternativa*: patrulla con un flujo de azar propio. Más variada, pero añade un flujo y complica el contrato de
    determinismo.
- **D8. Campamentos de guardianes en zonas ricas.** (encargo original)
  - *Recomendada*: **fuera de 0021**, a 0023 resources-sheep o a un change posterior. Sin recursos, un campamento
    sería un grupo de goblins quietos sin premio, y el bot de referencia no recorre el mapa, así que su efecto sobre
    el balance no se podría medir. Hueco no falta: hay ≥ 189 huellas 2 × 3 disjuntas por semilla en 1..1000.
  - *Alternativa*: campamentos por densidad de troncos (ventana k × k con ≥ N troncos), sin recompensa y con
    criterios provisionales que 0023 redefiniría.
- **D9. `xpGrowth` y `BOT_BATCH_TIMEOUT_MS`.** (pregunta 8)
  - *Recomendada*: **`xpGrowth` se queda en 4** (A1) y el timeout **no se sube** (180 s) salvo que la medición en
    apply lo exija. Medido: el lote del bot tarda **22,7 s** en local, unos **64 s** equivalentes en CI (factor
    ×2,8), con margen hasta el umbral de 90 s y casi ×2,8 hasta el timeout.
  - *Alternativa*: subir el timeout ahora como colchón. Ocultaría una regresión de coste por tick.

## Capacidades afectadas

- `openspec/specs/goblin-structures` (nueva): tipos de estructura en contenido, colocación por semilla, vida,
  destrucción, ruina, nacimiento de guardias, snapshot.
- `openspec/specs/procedural-map` (modificada): estructuras en el mapa generado, flujo de azar propio, ausencia en
  el mapa vacío y en los explícitos, sonda. El escenario "Mismos spawns con y sin mapa" se ajusta porque los
  guardias solo existen con el mapa generado y desplazan identificadores.
- `openspec/specs/enemy-behavior` (modificada): estados de patrulla, alerta y vuelta, con sus cotas legibles.
- `openspec/specs/enemy-spawning` (modificada): catálogo de 4 tipos, nacimiento en casas con tope e intervalo,
  `maxAlive`, nuevos stats del barril (A3).
- `openspec/specs/auto-weapons` (modificada): estructuras como objetivo de menor prioridad y daño del pulso.
- `openspec/specs/enemy-hazards` (modificada, de 0020): radio de la explosión del barril y explosiones que no dañan
  estructuras.
- `openspec/specs/run-state` y `openspec/specs/simulation-loop` (modificadas): estructuras en el snapshot y su lugar
  en el orden del tick.
- `openspec/specs/run-outcome` (modificada, de 0020): palancas de balance (A3), contenido final y, si se aplica A2,
  bot v4.
- `openspec/specs/sprite-rendering` y `openspec/specs/asset-provenance` (modificadas, de 0020): arte de casas,
  torres y ruinas. Se retira la prohibición de `Goblin_House` y `Wood_Tower` (ver Riesgos).
- Previsto: ampliar o añadir un ADR sobre estructuras y estados de guardia. Lo decide `sdd-architect`.

## Riesgos y dudas

- **Dependencia de proceso**: las specs de 0020 (`enemy-hazards`, deltas de `enemy-behavior`, `run-outcome`,
  `sprite-rendering`, `asset-provenance`, ...) aún no están en `openspec/specs/`. **0020 se tiene que archivar antes
  de escribir los delta de specs de 0021**, porque los MODIFIED deben copiar el requisito vivo completo.
- **Contradicciones con 0020 que hay que modificar a propósito**:
  - Escenario "Ninguna hoja de más" (`asset-provenance`) y escenario de `sprite-rendering` que prohíben
    `Goblin_House` y `Wood_Tower`, más el texto "ni hojas de casas o torres".
  - El test `tests/infrastructure/appearance-hazards.test.ts` (l. ~208), que prohíbe `Goblin_House|Wood_Tower|Fire`.
    Se mantiene la prohibición de `Fire` y de `Wood_Tower_InConstruction`.
  - "Presupuesto de oleadas y stats intactos" y "Stats por defecto" (`goblin-barrel` con `health` 20). Cambian por A3.
  - "Catálogo con exactamente 3 tipos" (`enemy-spawning`). Cambia por D3.
  - D7 de 0020 ("la parte B cambiará el TNT"). Con D3 el artillero se queda.
- **Balance con poco margen y poco medible**: el bot no explora y las casas están a ≥ 9 celdas de la zona de inicio.
  Los guardias pueden influir ≈ 0 en el bot o, con alerta de largo alcance, castigarle mucho (W3). Para aislar
  causas, en apply se mide por pasos: primero el barril (A3), después las estructuras sin guardias y, al final, los
  guardias. El bot v4 solo entra si el último paso lo exige.
- **Determinismo**: los guardias solo existen con el mapa generado, así que cambian los identificadores y el curso de
  las partidas de las 50 semillas. Hay que volver a medir la primera oferta de la semilla 7 (hoy 2.082) y los plazos
  del quieto.
- **Coste por tick**: patrullas, campos por puesto y una segunda lista de objetivos para las armas añaden trabajo.
  Las listas tienen que ir en pools (sin asignar memoria por tick).
- **Presupuesto de objetos del mapa**: hoy 750 como máximo (semillas 42 y 123), con tope 1.000. Cada casa o torre
  añade ~1–2 objetos.
- **Tamaño**: toca dominio, mapa, azar, armas, snapshot, render, arte, contenido y balance. Con D1-A, D4 y D8 tal como
  se recomiendan es abarcable. Si se aceptan las alternativas de D1, D4 o D8, conviene partir el change.
- **GDD**: la fila 0021 del backlog cita campamentos. Si D8 sale, hay que actualizar el GDD y añadir
  "balance-pass-2" (A1). No lo hace esta fase.

## Criterio de éxito

- Todos los escenarios de las specs delta del change en verde y `npm run verify` en verde.
- **Balance**: con el bot de referencia (v3, o v4 si se aplica A2) sobre las semillas 1..50, **entre 25 y 35
  victorias**.
- **0 quietos**: con las 50 semillas, el jugador quieto ha perdido antes del tick 10.800, tanto en el mapa generado
  como en el vacío.
- **Barril**: media de mechas encendidas por partida en 1..50 **> 16,3** (base medida), anotada en el verify-report
  junto con las explosiones por partida.
- **Tiempo del lote**: el lote del bot (50 × 36.000 ticks) **≤ 90 s equivalentes en CI** (tiempo local × 2,8),
  anotado en el verify-report. `BOT_BATCH_TIMEOUT_MS` sigue en 180 s salvo decisión registrada.
- **Rendimiento**: `npm run bench`, peor caso con 300 vivos, estructuras y el tope de guardias en patrulla o alerta,
  **≤ 0,25 ms/tick**. Es informativo, como en 0020: se anota y no bloquea.
- **Objetos del mapa**: **≤ 1.000** objetos pintados del mapa en las semillas 42 y 123 (test sin navegador).
- **Firmas doradas**: la firma de celdas de `tests/support/mapGolden.ts` no cambia (D1-A con D2). La nueva firma de
  estructuras se genera a propósito y se justifica en el verify-report. Ninguna firma cambia sin anotarlo.
- **Plazos del quieto**: primera oferta de la semilla 7 en ≤ 4.800 ticks (valor nuevo anotado), primer golpe y primer
  pulso en ≤ 4.800 y primera baja en ≤ 900.
- **Procedencia**: `npm run guard:all` en verde, con las 4 hojas nuevas registradas y nada del Free Pack.
- **E2E**: como máximo **2 E2E nuevos o ampliados**, en modo manual (`?e2e&manual` + `step(n)`) y con
  `map: 'real'`, sin umbrales de fps ni de tiempo real.
