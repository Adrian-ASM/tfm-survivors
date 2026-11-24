# Proposal · 0019-flow-field

- **Estado**: aprobada 2026-11-24 (ver "Decisiones del gate")
- **Issue**: (opcional)
- **Rama / worktree**: `change/0019-flow-field`

## Problema
Desde 0015 el mapa tiene río, puentes, troncos y castillo, pero los enemigos lo ignoran: cruzan el agua, atraviesan
troncos y el castillo en línea recta y parte de ellos nace encima de celdas bloqueadas (11,8–13,4 % de las apariciones
en las semillas 1..50). El mapa no cambia nada para la horda, lo que resta sentido al río y a los puentes y contradice
la historia del GDD "los enemigos rodean obstáculos y usan puentes". La spec `enemy-behavior` lo recoge como deuda
aceptada ("Los enemigos ignoran el mapa", ADR-0013 y su addendum).

Además, `waves.json` limita a 200 enemigos vivos mientras el GDD pide 300.

## Objetivo
Con el mapa generado, los enemigos llegan al jugador por caminos caminables: rodean troncos y castillo y cruzan el río
solo por los puentes. Con mapa abierto (o con línea libre hasta el jugador) persiguen exactamente igual que hoy. La
simulación sigue siendo pura y determinista, con hasta 300 enemigos vivos dentro del presupuesto de tick, y el
balance vuelve a la banda 25–35 victorias de 50 con 0 quietos supervivientes.

## Alcance
- **Dentro**:
  - Campo de flujo en el núcleo (dominio/aplicación, sin motor): distancias por celda desde la celda del jugador sobre
    el mapa de la partida, **4 vecinos**, orden de vecinos fijo y empates estables, sin azar. Se recalcula solo cuando
    el jugador cambia de celda; es función únicamente de (mapa, celda del jugador).
  - Persecución de cada enemigo vivo:
    - **Línea libre**: si el segmento recto desde el enemigo hasta el centro del jugador solo cruza celdas caminables,
      persigue en línea recta como hoy (mismos escenarios numéricos de "Persecución en línea recta").
    - Si no, avanza hacia el centro de la siguiente celda del campo (descenso de distancia), a la velocidad de su tipo.
    - En la celda del jugador, ataque directo al centro del jugador.
  - **Recolocación de la aparición**: un enemigo cuya posición de aparición cae en una celda no caminable se recoloca
    en la celda caminable más cercana (mismo criterio que la recolocación de gemas), sin consumir azar adicional y
    respetando los límites del mundo.
  - `content/waves.json`: `maxAlive` de 200 a **300** (y escenarios de tope y rendimiento con 300).
  - Presupuesto de rendimiento: tick con 300 enemigos vivos dentro del presupuesto vigente (2 ms de media en el bench,
    informativo) y recálculo del campo medido en el bench.
  - Calibración de balance dentro del change (ver decisiones abiertas): bot v2, semillas 1..50, banda 25–35,
    0 quietos a 4.800 ticks, "quieto pierde antes de 180 s" en las 50 semillas, revisión y registro de plazos.
  - ADR nueva (o addendum a ADR-0013) con: campo en el núcleo, 4 vecinos, línea libre, orden de vecinos y empates,
    recolocación de la aparición.
  - **Renumeración del GDD** (`docs/gdd.md`): añadir 0018 map-culling como hecho; el campo de flujo pasa de 0018 a
    **0019**; el bloque Should 0019–0023 pasa a **0020–0024**. Referencias: líneas 17, 118, 119, 124, 128, 159,
    167–172, 198–203 y 246 (en la 246, la deuda "sin separación" deja de saldarse con el campo de flujo y pasa a un
    change propio). El criterio "Given un edificio nuevo… el campo se recalcula" se mueve a build-sites (0024).
- **Fuera**:
  - Edificios construibles y recálculo del campo por cambios del mapa (el mapa sigue inmutable durante la partida);
    se difiere a build-sites (0024).
  - Separación, empuje o colisión entre enemigos: se mantiene "Sin separación entre enemigos" y se **acepta el
    apilamiento en los puentes** (el prototipo midió picos de hasta 158 enemigos en una celda con 4 vecinos puro).
  - Colisión física de los enemigos con el mapa (barrido por ejes como el jugador): con 4 vecinos centro a centro y
    radio ≤ 30 no hace falta; un enemigo puede rozar el borde de una celda bloqueada al seguir la línea libre.
  - Movimiento en 8 vecinos, Dijkstra con costes o suavizado de dirección.
  - Comportamientos propios por tipo de enemigo, casas goblin y campamentos (0020).
  - Cambios en el render, en la sonda E2E o en el snapshot hacia el motor (Phaser no cambia).
  - Uso de `player.speed` como palanca de balance (el prototipo mostró efecto no monótono: 230 → 20, 245 → 14).

## Capacidades afectadas
- `openspec/specs/enemy-behavior` (modificada):
  - REMOVED/reemplazado "Los enemigos ignoran el mapa" (incluidos "Persecución a través del agua", "a través del
    castillo" y "Misma trayectoria con mapa generado y vacío") por requisitos nuevos de navegación por campo de flujo,
    línea libre, cruce por puentes, rodeo de troncos y castillo y determinismo del campo.
  - MODIFIED "Persecución en línea recta": aplica con línea libre o en la celda del jugador; sus escenarios actuales
    se conservan (mapa abierto).
  - Revisar "Sin movimiento en el tick de aparición" (la posición de aparición es la ya recolocada) y "Enemigos dentro
    de la arena" (partida larga con 300 vivos). "Sin separación entre enemigos" no cambia.
- `openspec/specs/enemy-spawning` (modificada): "Posición de aparición fuera de la vista" (recolocación en celda
  caminable cercana con el mapa generado, sin azar extra) y "Tope de enemigos vivos" (`maxAlive` 300 por defecto).
- `openspec/specs/procedural-map` (modificada): el campo de flujo como consulta de solo lectura sobre el mapa de la
  partida; "Azar del mapa independiente del de la partida" se mantiene.
- `openspec/specs/simulation-loop` (modificada): "Rendimiento con el tope de enemigos" (300 vivos) y, si cambia, "Orden
  de los pasos del tick" (recálculo del campo tras el movimiento del jugador y antes de la persecución).
- `openspec/specs/run-outcome` (modificada): "Partida ganable y perdible con el contenido por defecto" y "Bot de
  referencia para el balance" (nueva tasa, plazos de primer golpe/pulso/oferta/baja e invariante del quieto).
- `openspec/specs/xp-gems` (modificada): "Recolocación de gemas en celdas no caminables" pierde la frase obsoleta
  "los enemigos atraviesan el castillo" (añadida en el gate de spec); la regla y sus escenarios no cambian.
- `docs/gdd.md` (renumeración) y ADR nueva o addendum a ADR-0013. AGENTS.md solo al archivar.

## Riesgos y dudas
- **Balance sin resolver**: con 4 vecinos + línea libre + recolocación el prototipo dio **18/50** (fuera de banda;
  base 25). 4 vecinos puro dio 28 pero un quieto sobrevivía (semilla 12, mapa vacío) y rompía la línea recta; 8
  vecinos 23; 8 + línea libre 19. Oleadas ×0,9 sobre 4 + línea libre subió a 28 pero sobrevivió un quieto (semilla
  39). Probablemente haga falta bajar el presupuesto de oleadas entre ×0,9 y ×0,95 (quizá solo desde el tramo de
  60 s) y revisar plazos e invariante "quieto pierde": hay ruido de ±3–4 victorias entre factores contiguos.
- Cuellos de botella: el bot v2 puede quedar atrapado o, al revés, explotar los puentes para frenar a la horda.
- Apilamiento en puentes de 1 celda sin separación: visualmente feo, aceptado; queda como deuda en el GDD.
- Determinismo: orden de vecinos, empates y recolocación deben ser estables e independientes del tamaño de ventana.
- Rendimiento medido en prototipo muy por debajo del umbral (BFS 4 vecinos 0,022 ms de media / 0,025 ms p95; tick con
  300 vivos 0,015–0,027 ms frente a 0,012 de base; 0,04–0,10 recálculos por tick con el bot); la línea libre por
  enemigo es el coste nuevo dominante y debe entrar en el bench.
- Tests que cambian: escenarios de "ignoran el mapa", posibles firmas doradas de trayectorias y tiempos de los E2E con
  `map=real`.

## Decisiones abiertas para el gate
1. **Enfoque de navegación**: ¿se acepta 4 vecinos + línea libre + recolocación (idéntico a hoy en mapa abierto, sin
   diagonales), aunque deja el balance en 18/50 antes de calibrar?
2. **Retoque de contenido para calibrar** (pregunta 6 de la exploración): ¿se acepta bajar el presupuesto de oleadas
   (orientativo ×0,9–×0,95, quizá solo desde el tramo de 60 s) y, si hace falta, ajustar plazos del balance, con
   `player.speed` fuera como palanca? Si no se acepta, el change no puede garantizar la banda 25–35.

## Decisiones del gate (usuario, 2026-11-24)
1. **Enfoque de navegación aceptado**: 4 vecinos + línea libre + recolocación de la aparición.
2. **No se toca el presupuesto de oleadas** (tramos, `budgetPerSecond`, `maxBudget`) ni `player.speed`. La
   calibración se busca con otras palancas de contenido (stats de enemigos, armas, mejoras o progresión de XP). Si
   ninguna devuelve la banda 25–35 con 0 quietos supervivientes, el implementer **para y se vuelve al usuario**: la banda
   no se relaja por cuenta propia. (`maxAlive` 300 sigue dentro del alcance: es el tope, no el presupuesto.) Esta
   decisión sustituye a la pregunta 2 y a la línea de "Riesgos" que proponía bajar el presupuesto ×0,9–×0,95.

## Criterio de éxito
- Escenarios de las specs delta en verde con `npm run verify`, entre ellos:
  - con un río de una celda y un único puente y el jugador al otro lado, un enemigo cruza por la celda del puente y
    nunca tiene el centro en una celda `water`;
  - con mapa todo `grass`, los escenarios actuales de "Persecución en línea recta" dan las mismas posiciones
    (error ≤ 0,001);
  - ninguna aparición con el mapa generado queda con el centro en una celda no caminable (semillas 1..50);
  - mismo mapa, misma semilla e inputs → mismas posiciones de enemigos en cada tick.
- `maxAlive` 300 por defecto; tick medio ≤ 2 ms con 300 vivos y recálculo del campo ≤ 0,1 ms en el bench (informativo).
- Balance: 25–35 victorias de 50 con el bot v2 (semillas 1..50), 0 quietos vivos a 4.800 ticks, "quieto pierde antes
  de 180 s" en las 50 semillas y plazos nuevos anotados en la spec.
- GDD renumerado (0018 map-culling hecho, flow-field 0019, Should 0020–0024, criterio de edificios en 0024).
