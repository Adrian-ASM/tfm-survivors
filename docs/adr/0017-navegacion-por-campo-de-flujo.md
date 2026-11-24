# ADR-0017 · Navegación de los enemigos por campo de flujo de 4 vecinos en el núcleo, con línea libre

- **Estado**: propuesta (change 0019-flow-field)
- **Fecha**: 2026-11-24

## Contexto
Desde 0015/0016 el mapa bloquea al jugador, pero los enemigos lo ignoran: cruzan el río y el castillo, y el 12–13 %
nace sobre celdas bloqueadas (deuda de ADR-0013 y su addendum). El GDD pide que la horda rodee obstáculos y use los
puentes, con hasta 300 vivos. Hay que tener en cuenta varias fuerzas:
- Determinismo: el balance se mide con el bot v2 en las semillas 1..50, así que la navegación debe ser función pura
  del estado, sin azar y con empates estables.
- Rendimiento: ≤ 2 ms por tick con 300 vivos (bench) y sin asignar memoria en el tick (ADR-0003).
- Compatibilidad: con mapa abierto, la persecución debe ser exactamente la de hoy (escenarios numéricos vigentes).
- Medición previa (prototipo): BFS de 4 vecinos en 0,022 ms de media y 0,025 ms en p95; tick con 300 vivos en
  0,027 ms. Balance: 4 vecinos + línea libre + recolocación da 18/50; 4 vecinos sin más da 28 con un quieto
  superviviente; 8 vecinos da 23; 8 + línea libre da 19.

## Opciones
1. **BFS de 4 vecinos desde la celda del jugador, recalculado al cambiar de celda, con línea libre y recolocación de
   la aparición.**
2. BFS/Dijkstra de 8 vecinos sin cortar esquinas y con dirección suavizada: rutas más naturales, pero la diagonal pasa
   a ~21 px de la esquina (el `goblin-tnt` tiene radio 22), hay más empates y su balance no fue mejor.
3. La 1 o la 2 con colisión de enemigos contra el mapa y/o separación: cuesta más por enemigo, contradice la spec "Sin
   separación entre enemigos" y mueve todavía más el balance.
4. A* por enemigo: O(enemigos × celdas) por recálculo. No escala a 300 y no comparte trabajo.

## Decisión
**Opción 1** (gate humano del 2026-11-24):
- `FlowField` es un servicio de dominio propiedad de `Run`, con buffers preasignados. El campo es función solo de
  (mapa, celda del jugador) y se recalcula desde cero cuando cambia esa celda. Se reutiliza la BFS de `connectivity.ts`
  con el **orden de vecinos fijo: izquierda, derecha, arriba, abajo**.
- Objetivo de cada enemigo en el tick: el centro del jugador si está en su celda o tiene **línea libre** (el segmento
  entre centros solo visita celdas caminables; recorrido de rejilla y, en un cruce exacto por una esquina, las dos
  celdas laterales). Si no, el centro del **primer vecino, en el orden fijo, con distancia − 1**. Si el enemigo está en
  una celda sin distancia, persecución directa como reserva.
- Con un mapa sin celdas bloqueadas no hay BFS: la persecución es idéntica a la de hoy.
- La aparición se recoloca en la celda caminable más cercana (`GameMap.nearestWalkable`, el criterio de las gemas)
  dentro de cada intento de `placeSpawn`, antes de comprobar `minDistance`: sigue gastando 1 valor de azar por intento.
- `maxAlive` pasa a 300. No hay separación, ni colisión de enemigos con el mapa, ni edificios: se acepta que los
  enemigos se apilen en los puentes.

## Consecuencias
- Positivas: el río y los puentes cambian el juego; el coste es mínimo (≤ 0,1 ms por recálculo, pocos recálculos por
  tick) y no hay asignaciones; el mapa abierto queda intacto, de modo que los escenarios y E2E con `map=empty` no
  cambian; no se añaden dependencias ni hay cambios en el motor.
- Negativas / costes: el orden de vecinos, la regla de empate, la de la línea libre y la recolocación entran en el
  **contrato de determinismo**: si se cambian, cambian las partidas de todas las semillas y hay que volver a medir el
  balance. El balance cae a 18/50 y se recalibra con contenido (enemigos, armas, mejoras, XP) sin tocar las oleadas ni
  `player.speed`. Los caminos van en escalera y los enemigos se apilan en los puentes. Un enemigo puede rozar con su
  radio una celda bloqueada.
- Cómo revertirla: quitar `FlowField` y la recolocación devuelve la persecución en línea recta, que es local a `Horde`,
  `Run` y `placeSpawn`, pero obliga a recalibrar. El paso a 8 vecinos o a Dijkstra se queda dentro de `FlowField`
  (misma API `retarget`/`steer`). Los edificios (build-sites, 0024) solo añadirán el disparador de recálculo por cambio
  del mapa.

## Addendum · resultados del apply (2026-11-24)
- **Balance**: con la implementación real y `maxAlive` 300, la base cae a **12/50**, no a 18 como en el prototipo.
  Se recalibra solo con la curva de XP (`content/progression.json`: `baseXp` 5 → 9, `xpGrowth` 5 → 3; delta de la
  spec `leveling`), por decisión del usuario. Resultado: **26/50** victorias del bot v2 y 0 quietos supervivientes
  con el mapa generado y con el vacío. Plazos del quieto con la semilla 7: primer golpe 2.276, pulso 1.524, oferta
  2.082 y baja 728. Primer golpe con la 42: 2.442. Tabla de 18 lotes en el design (§6, resultado).
- **Palancas descartadas**: vida y daño del `goblin-tnt` (máximo 16/50). `strict-rules` (31–33, pero deja vivos a
  jugadores quietos). `xpGrowth` sin `baseXp` (37–38, por encima de la banda; con 4 sobrevive un quieto).
- **Bench** (local, informativo): tick con 300 vivos y mapa generado, 0,023 ms. Con 300 sin línea libre, 0,113 ms.
  Con el jugador cambiando de celda en cada tick, 0,172 ms. BFS completa, 0,059 ms de media (p99 0,073).
- **Estado**: pasa a "aceptada" al archivar el change.
