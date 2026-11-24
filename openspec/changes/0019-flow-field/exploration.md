# Exploración · 0019-flow-field

Intención: los enemigos cruzan el río por los puentes y rodean troncos y castillo con un campo de flujo desde la celda
del jugador (GDD, historia antes "0018"; 0018 pasó a map-culling).

## Contexto actual
- `src/domain/enemy/Enemy.ts` `chase()`: línea recta + `clamp` a la arena; `Horde.chase` llama a cada vivo. Nadie
  consulta el mapa (spec `enemy-behavior` "Los enemigos ignoran el mapa", ADR-0013 y su addendum: "deuda para flow-field").
- `src/domain/run/Run.ts` `tick()`: jugador → `horde.chase` → armas → contacto → victoria → gemas → director. `Run` ya
  guarda el `GameMap` (`terrain`), inmutable durante la partida; los enemigos no lo reciben.
- Mapa: rejilla 64 × 36, celda 60 px (`content/map.json`), un byte por celda; `GameMap.isWalkable/colAt/rowAt`;
  `src/domain/map/connectivity.ts` ya tiene una BFS 4-vecina sin asignar (buffers `Uint8Array`/`Int32Array`). El
  generador garantiza que toda celda caminable es alcanzable desde la salida. Río de 1 celda con 2–3 puentes de 1 celda.
- Aparición (`placeSpawn`): anillo de 1.500 px alrededor del jugador, sin mirar el mapa: parte de los enemigos nace sobre
  agua, tronco o castillo.
- Contenido: `waves.json` `maxAlive` **200** (el GDD habla de 300); radios de enemigo 10/16/22 (celda 60, mitad 30);
  velocidades 45–90 px/s; jugador 215.
- Pruebas: `tests/bench/run.bench.ts` (presupuesto 2 ms de media con 200 vivos, informativo, fuera de `verify`);
  `tests/domain/balance.test.ts` + `tests/support/policies.ts` (bot v2, banda 25–35 de 50 (hoy 25/50, en el límite),
  0 quietos, plazos de primer golpe/pulso/oferta/baja 4.800/4.800/4.800/900; medidos 1.434 pulso, 1.527 oferta, 656 baja).

## Capacidades/specs afectadas
- `enemy-behavior`: MODIFICA "Persecución en línea recta" (sus escenarios deben seguir cumpliéndose con mapa abierto y en
  línea de visión) y REEMPLAZA "Los enemigos ignoran el mapa" (incluido el escenario "misma trayectoria mapa
  generado/vacío"). "Sin separación entre enemigos" solo cambia si se añade separación.
- `procedural-map` (consulta del campo sobre `GameMap`) y `simulation-loop` (orden del tick y presupuesto de rendimiento).
- `enemy-spawning`: solo si se recoloca la aparición sobre celdas bloqueadas. `run-outcome`: balance, plazos, "quieto pierde".
- ADR nueva (campo de flujo en el núcleo, orden de vecinos y empates) o addendum a ADR-0013.
- GDD y AGENTS.md (línea de estado al archivar).

## Opciones (sin elegir)
**A. BFS 4-vecino, recalculado solo al cambiar la celda del jugador, con ataque directo en la celda del jugador o con
línea libre.** El enemigo va al centro de la siguiente celda (conserva los escenarios actuales con mapa abierto).
Pros: determinista y simple; centro a centro con 4 vecinos nunca roza el mapa (radio ≤ 30). Contras: caminos en
escalera, comprobación de línea libre por enemigo (o solo mapa abierto).
**B. BFS/Dijkstra 8-vecino sin cortar esquinas y dirección suavizada.** Pros: rutas más naturales. Contras: la diagonal
centro a centro pasa a ~21 px de la esquina de un bloqueo y el `goblin-tnt` (radio 22) la roza; más casos de empate.
**C. A o B más colisión de enemigos con el mapa (barrido por ejes como el jugador) y/o separación entre enemigos.**
Pros: nunca invaden celdas bloqueadas; cierra la deuda "la horda se amontona". Contras: coste por enemigo o hash
espacial; contradice la spec "Sin separación entre enemigos" (escenarios de superposición) y mueve el balance.

Transversal: enemigo nacido en celda bloqueada: (a) recto hasta pisar celda caminable; (b) recolocar con
`nearestWalkable` (O(celdas), cambia la aparición); (c) BFS que también cruza bloqueadas con coste alto.

## Edificios nuevos
No hay edificios construibles hasta `build-sites` (0023 → 0024) y el mapa es inmutable. Incluir ahora el gancho de
recálculo sería una API sin consumidor real; diferirlo evita especular. Hoy bastaría exigir "campo = f(mapa, celda del
jugador)" y que el criterio del GDD pase a 0024.

## Riesgos e incógnitas
- **Balance**: los desvíos por puentes retrasan o concentran la horda; mueven plazos y tasa (hoy 25/50, límite inferior)
  y el invariante "quieto pierde < 180 s". El bot v2 puede quedar atrapado en cuellos de botella.
- Puentes de 1 celda: 200 enemigos sin separación se apilan en el mismo punto.
- Enemigos nacidos en bloqueadas (porcentaje sin medir; troncos 12 % más río y castillo): comportamiento por definir.
- Determinismo: orden de vecinos fijo, enteros, sin azar, empates estables; independiente del tamaño de ventana.
- Rendimiento: BFS de 2.304 celdas por cambio de celda (jugador 215 px/s: ~3,6 cambios/s) más búsqueda O(1) por enemigo;
  sin medir. Presupuesto del bench 2 ms con 200 vivos; el GDD pide 300.
- Tests que cambian: spec "ignoran el mapa", escenarios con agua/castillo, posibles firmas doradas de trayectorias.
- Phaser: sin dependencia (el snapshot no cambia); los E2E con `map=real` pueden variar en tiempos.

## Mediciones previas (las lanza el orquestador antes de la propuesta, con prototipo desechable)
1. **Coste del campo**: BFS 4 y 8 vecinos sobre los mapas de las semillas 1..50 (media y p99) y tick completo con 200 y
   300 vivos recalculando en cada tick (peor caso). Umbral: ≤ 0,1 ms por recálculo y tick medio ≤ 2 ms con 300 vivos.
2. **Balance con prototipo**: bot v2, semillas 1..50, con A y con B. Umbral: 25–35 victorias, 0 quietos vivos a 4.800
   ticks, "quieto pierde antes de 180 s" en las 50 y plazos 4.800/4.800/4.800/900 (anotar los valores nuevos).
3. **Frecuencia y forma**: cambios de celda por tick con el bot y con input aleatorio; porcentaje de apariciones en celdas
   bloqueadas; pico de enemigos por celda en los puentes.

## Preguntas para el usuario
1. Renumeración del GDD: ¿lo hago yo en el change o el orquestador antes? Hay que añadir 0018 map-culling como hecho,
   0018 flow-field → 0019 (líneas 118, 128, 159, 167–172, 198, 246) y Should 0019–0023 → 0020–0024 (líneas 17, 119,
   124, 128, 199–203).
2. ¿Los edificios nuevos quedan fuera y el criterio se difiere a 0024?
3. ¿Se sube `maxAlive` a 300 (GDD) o se mantiene 200 y el bench a 300 solo como estrés?
4. ¿Se incluye separación entre enemigos (cierra la deuda, cambia spec y balance) o se aplaza?
5. ¿Qué hacen los enemigos nacidos en celdas bloqueadas (recto, recolocar, coste alto)?
6. ¿Se acepta retocar contenido (`player.speed`, oleadas) si la banda 25–35 se rompe?
