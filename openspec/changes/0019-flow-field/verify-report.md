# Verify report · 0019-flow-field

Rama `change/0019-flow-field` (13 commits sobre `origin/main`). Auditor independiente: no se ha tocado código.

## Resultados de ejecución
- `npm run verify`: en verde (lint, typecheck, `guard:all` con 746 ficheros, Vitest 178 ficheros y 2.049 tests).
- `npm run test:e2e`: no relanzado. El implementer informa de 13/13 en verde y el change no añade E2E (5.1, `e2e-lite`).
  No he visto motivo para repetirlo: no hay cambios de UI ni de adaptador.

## Escenario → Test → Estado
Todos los escenarios de las 7 capacidades tienen un test que los ejercita de verdad. Muestreados con detalle:
`run-navigation` (llegada en ventanas de ticks, sin pisar `water`/`trunk`/`castle`), `place-spawn` (centro exacto de la
celda recolocada y 1 valor de azar por intento), `run-spawn-map` (snapshot del tick de aparición), los barridos 1..50 y
`balance.test.ts`. Ninguno es vacío ni tautológico.

| Capacidad | Escenarios | Test | Estado |
|---|---|---|---|
| enemy-behavior | Obstáculo fuera del segmento, Obstáculo que corta, Borde de celda bloqueada, Agua y castillo, Sin cortar por una esquina | `map/clear-line.test.ts`, `run-navigation.test.ts` | Cubierto |
| enemy-behavior | Cruce del río, Rodeo de troncos, Rodeo del castillo, Paso por tick, Celda sin distancia, Ataque directo en la celda | `run-navigation.test.ts`, `map/steer.test.ts` | Cubierto |
| enemy-behavior | Empate, El campo solo depende de la celda, La navegación no consume azar | `map/steer.test.ts`, `run-navigation.test.ts` | Cubierto |
| enemy-behavior | Semillas del conjunto, Jugador quieto junto al castillo | `map-navigation-sweep.test.ts` | Cubierto |
| enemy-behavior | Persecución (3), Llegada, Mismo tick, Tras golpear, Baja, Partida terminada, Arena (3), Partida larga | `enemy.test.ts`, `run-enemies.test.ts`, `run-removal.test.ts`, `run-state.test.ts`, `long-run.test.ts` | Cubierto |
| enemy-behavior | Primer tick de vida, Aparición recolocada | `run-enemies.test.ts`, `run-spawn-map.test.ts` | Cubierto |
| enemy-spawning | Tope por defecto, Se alcanza el tope (por defecto), Tope mínimo, Reposición, Presupuesto, Huecos | `content.test.ts`, `run-spawning.test.ts`, `wave-director.test.ts`, `run-removal.test.ts` | Cubierto |
| enemy-spawning | Arena mayor/menor, Centro del mundo, Puerta del castillo, Esquinas, Ninguna posición válida, Presupuesto aplazado | `place-spawn.test.ts`, `run-spawning.test.ts` | Cubierto |
| enemy-spawning | Aparición sobre agua, 1 valor por intento, Demasiado cerca, Mapa sin celdas caminables | `place-spawn.test.ts`, `run-spawn-map.test.ts` | Cubierto (el último solo con mapa de escenario; asumido) |
| enemy-spawning | Recolocación con castillo y río, Partida larga sin spawns ilegales, Mismas apariciones con cualquier ventana | `map-navigation-sweep.test.ts`, `long-run.test.ts`, `camera-rig.test.ts` | Cubierto |
| procedural-map | Mapa vacío, Río con un puente, Celda encerrada, Objetivo no caminable, Toda celda con distancia, Mismo campo | `map/flow-field.test.ts` (+ `connectivity.test.ts`) | Cubierto |
| procedural-map | Rejilla (4 escenarios), Mismos spawns con y sin mapa, Primera oferta en plazo | `game-map.test.ts`, `map-independence.test.ts` | Cubierto |
| simulation-loop | Determinismo (12 escenarios), Persecución sin azar, Posiciones reproducibles, Orden del tick (12) | `determinism*.test.ts`, `run-navigation.test.ts`, `map-navigation-sweep.test.ts`, `run-*.test.ts` | Cubierto |
| simulation-loop | Tope alcanzado, 300 encima, Peor caso (proyectiles, gemas), 300 sin línea libre, Cálculo del campo, Cambio de celda por tick | `run.bench.ts`, `map.bench.ts`; Contacto con cualquier mundo en `piled-contact.test.ts` | Cubierto solo por bench (fuera de `verify`; ver S1) |
| run-outcome | Tasa 25–35 (26/50), Toda partida termina, Quieto pierde (generado y vacío), Límite 180 s, Plazos semilla 7 | `balance.test.ts` | Cubierto |
| run-outcome | Presupuesto de oleadas intacto | `content.test.ts` (literal de tramos, `maxBudget`, `ringRadius`, `player.speed`) | Cubierto |
| leveling | Curva por defecto 9/3, Curva de escenario, Inválidos, Plana, Partida recién creada (9) | `xp-curve.test.ts`, `progression-content.test.ts`, `run-*.test.ts` | Cubierto |
| xp-gems | Baja sobre tronco, Empate, Río, Castillo, Junto a tronco, Sin azar, Mismo tick, Ninguna gema en reposo | `run-gems-map.test.ts`, `long-run.test.ts` | Cubierto |

## Design, ADR-0017 y tasks
- Capas: `FlowField` en `src/domain/map`, sin imports de capas superiores ni del motor; sin `Math.random`, `Date.now`
  ni globales de navegador. `Horde.chase` y `Run.tick` siguen el orden de design §3. No hay dependencias nuevas.
  Los números viven en `content/`: solo cambian `maxAlive` 300 y la curva 9/3 (palanca que el usuario fijó).
- Cero asignaciones en el tick: `dist`, `queue`, `codes` y el `target` de `Horde` son reutilizados.
- Tasks: 5.1–5.3 y las anteriores marcadas, y cada una con commit (2.1 y 2.2 juntos, como la tarea permite; 5.1 sin
  commit porque no cambia ficheros). ADR-0017 existe, ADR-0013 lleva el puntero y el GDD está renumerado.
- Calibración: el procedimiento de parada se cumplió (el usuario aprobó los lotes 16–18, 3 por encima de los 15 del
  design). Tabla de lotes en design §6 y plazos medidos con la semilla 7: golpe 2.276, pulso 1.524, oferta 2.082 y
  baja 728 (con la 42, golpe 2.442), todos dentro de los plazos.

## Hallazgos

### Critical
Ninguno.

### Warning
- **W1 · Balance en el límite inferior.** El bot de referencia gana 26/50: está en la banda 25–35, pero fuera del margen
  27–33 del design (§6 paso 4) y a una sola victoria del suelo. Es determinista, así que no hay flakiness, pero
  cualquier cambio futuro de contenido o de navegación puede sacar el test de la banda. La decisión es del usuario y
  está anotada; conviene mantenerla visible en el archivo y en la retro.
- **W2 · Cifra de partida inexacta en el delta de `leveling` y en design §6.** El comentario del delta
  (`specs/leveling/spec.md`) y la frase "Punto de partida medido: 18/50" del design dicen 18/50, pero la base medida en
  apply con `maxAlive` 300 fue 12/50 (el 18 era el del prototipo con 200). Corregir la redacción antes de archivar, porque
  el historial de la spec viva heredará la cifra.
- **W3 · Historial no bisectable.** Los commits 2.1 a 3.3 se hicieron con `balance.test.ts` en rojo (la regla de
  AGENTS.md pide no cerrar una tarea en rojo). Está documentado en el diario de IA y el HEAD está en verde; queda como
  deuda de proceso (para la retro), no como bloqueo.

### Suggestion
- **S1 · Rendimiento solo en bench.** Los escenarios de "Rendimiento con el tope de enemigos" (300 vivos, sin línea
  libre, cambio de celda por tick, cálculo del campo) solo los ejecuta `npm run bench`, fuera de `verify`. Es coherente
  con la regla del proyecto (informativo, sin umbrales de tiempo en el gate). Opcional: un test de `verify` que compruebe
  la parte lógica (p. ej. que `computations` no crece sin cambio de celda y que ≥ 150 enemigos no tienen línea libre).
- **S2 · `placeSpawn` asigna `at` en cada llamada** (`{ x: 0, y: 0 }`), además del `Vector2` del candidato. Ocurre solo
  al aparecer un enemigo, no por tick, y no incumple el design; un objeto reutilizado lo evitaría.
- **S3 · Pendientes para el archivo (aceptados):** AGENTS.md, estado "aceptada" de ADR-0017 y los comentarios históricos
  que aún dicen "deuda para 0018" (ADR-0013, GDD líneas 66 y 128, ya acompañados de la nota de renumeración).

C: 0 · W: 3 · S: 3
