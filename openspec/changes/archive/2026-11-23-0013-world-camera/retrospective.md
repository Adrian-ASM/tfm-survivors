# Retrospectiva · 0013-world-camera

- **Fechas**: inicio 2026-11-23 → archivado 2026-11-23
- **PR**: #30 (squash `ad6ec9c`) y #31 (`d237b49`, carrera de `level-up.spec` que salió en el CI de main)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 15 / 16: la 5.1 y la parte `CI_LIKE` de la 6.2 se aplazan a 0014 por decisión del usuario |
| Commits (asistidos por IA) | 23 (23) en la rama, más 1 en el PR #31 |
| Tests añadidos | 51 unitarios y de guardarraíl (1385 → 1436) y 12 E2E (63 → 75) |
| Hallazgos verify (C / W / S) | 0 / 3 / 2. W1 y W2 los corrigió el orquestador en la spec; W3 queda como deuda para 0014 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 1 (E2E intermitente en el CI de main, pasó en el reintento) |
| Iteraciones de prompt relevantes | 6: preguntas de alcance, gate del punto de control de balance, estrés E2E dos veces, W1/W2 y la carrera de main |

Medición previa con el bot y las semillas 1..50: 960 × 540 → 30 victorias, 2x → 25, 3x → 13, 4x → 22. En todos los
tamaños, 0 jugadores quietos sobreviven (mueren en unos 82 s). ms/tick en el peor caso: 0,110 → 0,119 con 4x.

## Qué fue bien
- **El núcleo ya estaba preparado:** `src/domain` y `src/application` no cambiaron. El spawn en anillo alrededor del
  jugador y la vista separada en `content/arena.json` venían de 0002. El change se quedó en contenido, adaptador
  y tests.
- **Medir antes de proponer evitó una propuesta equivocada:** la intuición era que sin paredes el bot ganaría más,
  pero gana menos y la relación no es monótona. La propuesta eligió 2x con datos.
- **El punto de control de balance como primera tarea funcionó:** el apply se paró con dos plazos en rojo, el
  usuario decidió (subir plazos en la spec, sin tocar stats) y se siguió sin rehacer trabajo.
- **Una sola fuente de medidas:** desaparecieron `DEFAULT_ARENA` y las copias 960/540 del bot, los E2E y el bench.
  Un guardarraíl de tests impide que vuelvan. Esto destapó que el bench de "200 enemigos encima del jugador" pasaba
  sin contacto.

## Qué fue mal / dónde falló la IA
- **Los E2E de estrés saturaron el PC del usuario:** `CI_LIKE --workers=12 --repeat-each=3` lo dejaba al 100 %
  (130–140 W) y aun así fallaba algún test por tiempos. Hubo que cambiar la receta dos veces durante el apply, y al
  final se aplazó.
- **Un mensaje al implementer llegó tarde:** la instrucción de no relanzar el estrés llegó cuando ya había
  terminado, y el commit `e64b567` dejó una receta provisional que hubo que revertir.
- **La propuesta y la spec no coincidían:** el criterio de éxito "ningún enemigo aparece dentro de la vista"
  contradecía la spec de spawn, que lo acepta cerca de los bordes. Lo detectó el architect en *tasks*, no el
  spec-writer.
- **Un E2E intermitente llegó a main:** `level-up.spec` leía el snapshot dos veces y, en el runner lento, la
  segunda oferta (+342 ticks) caía entre las dos lecturas. Ninguna pasada local lo reprodujo.

## Desviaciones respecto a spec o diseño
- Plazos de balance subidos a 4.800 ticks: primera subida, pulso del jugador quieto y progresión y armas
  reproducibles. Decisión del usuario en el gate del punto de control; lo medido fue 4.346 y 4.161.
- El primer frame de una partida nueva admite tick ≤ 60 en `camera.spec`. La spec se alineó en el verify (W1).
- Los E2E importan los JSON con `with { type: 'json' }`, que exige Playwright.
- `roundPixels` sigue en `false`: no hubo temblor.

## Deuda
- **W3:** sin validación `CI_LIKE` de "Fondo en las cuatro esquinas" ni de `roundPixels`. Pasa a 0014, que
  sustituye la pasada de estrés por throttling con `Emulation.setCPUThrottlingRate` y 2 workers.
- La sonda no expone el rectángulo del suelo, y "Enemigo a la derecha del jugador" solo comprueba la conversión de
  mundo a pantalla, no dónde se pinta el sprite.
- S1: mover `pauseWhileRunning` de `camera.spec` a `probe.ts` si 0014 toca los E2E.
- Renumeración del GDD: 0014 pasa a ser `e2e-manual-step`, así que `procedural-map` pasa a 0015 y `flow-field` a
  0016. Las menciones a "0014 = mapa" de este change y de `docs/gdd.md` se corrigen al archivar 0014.

## Lecciones → acciones
- Las pasadas de estrés con muchos workers no reproducen el runner: lo exageran y bloquean el equipo local →
  0014 (throttling por CDP con 2 workers y la tasa medida contra el runner).
- Los E2E que leen dos veces el estado mientras el juego corre son frágiles en máquinas lentas → leer y comprobar
  en el mismo snapshot. Las reglas pasan al avance manual por ticks de 0014.
- Los criterios de éxito de la propuesta deben contrastarse con las specs → al pedir *tasks*, el orquestador ya
  pide el contraste (skill `sdd-workflow` §3); ahora incluye explícitamente los criterios de éxito de
  proposal.md (hecho en este archivo).
