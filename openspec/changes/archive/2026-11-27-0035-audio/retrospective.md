# Retrospectiva · 0035-audio

- **Fechas**: inicio 2026-11-26 → archivado 2026-11-27
- **PR**: [#92](https://github.com/Adrian-ASM/tfm-survivors/pull/92) (merge `630480c`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 20 / 20 (6 grupos) |
| Commits (asistidos por IA) | 17 (17) en `change/0035-audio` (14 el 26-11, 3 el 27-11), fusionados en 1 (`630480c`): 6 de docs SDD, 5 de código (grupos 1–5), 3 de audio (recogidas por recurso, CC-BY, ficheros del autor), E2E y cierre del grupo 6 |
| Tests añadidos | ~228 en `verify` (4.238 → 4.466 tests, 367 ficheros); 0 E2E nuevos, 2 ampliados (`smoke.spec` y `gameplay.spec`, suite `logic` 19/19) |
| Hallazgos verify (C / W / S) | 0 / 0 / 2, sin re-verify |
| Bloqueos de guardarraíles (hook / ESLint / CI) | no registrados / no registrados / 0 |
| Iteraciones de prompt relevantes | 3 rondas de spec/design tras llegar los assets (tope 2 → 6 MB, recogida por recurso con 12 tipos, `.flac`, CC-BY con `CREDITS.md`) |
| Diff | 122 ficheros, +8.781 / −109; `src/domain` y `src/application` sin cambios |
| Audio | 11 ficheros, 4.947.600 B (7 CC0, 4 CC-BY), tope 6.291.456 B |
| Specs vivas | 1 nueva (`audio`, 15 requisitos, 73 escenarios) y 7 modificadas: `main-menu` 52 → 56, `touch-controls` 41 → 46, `asset-provenance` 67 → 84, `menu-guide` 55 → 56, `mobile-display` 36 → 37, `simulation-loop` 246 → 247, `world-camera` 44 → 45 |

## Qué fue bien
- El núcleo no se tocó: todo el audio se deriva del snapshot (`audio-cues`) y de un mezclador puro, así que
  `BALANCE_BASELINE` y las firmas doradas pasaron sin regenerarlas y el escenario "misma partida con y sin audio"
  es trivial de probar.
- La lógica pura del grupo 1 se hizo con TDD y rojo comprobado; el resto, *test-after* (ADR-0018). Con `file: null`
  todo funcionaba en silencio antes de que existiera un solo fichero de audio, así que los grupos 1–5 cerraron en
  verde sin esperar a los assets.
- El modo `?e2e` ejecuta la lógica entera contra una salida muda y la sonda `window.__sprint.audio` basta para los
  2 E2E ampliados: ningún test nuevo suelto ni esperas de reloj.
- El guardarraíl de procedencia se extendió con la lista de audio, licencias admitidas y `CREDITS.md` en las tres
  capas, sin red.

## Qué fue mal / dónde falló la IA
- El autor creía que todo el audio era CC0 y no lo era. Una de las builds elegidas era CC-BY-NC y hubo que
  sustituirla; las CC-BY restantes obligaron a admitir esa licencia y a crear `CREDITS.md`.
- OpenGameArt bloquea la lectura automática (403): la licencia de cada página se contrastó con capturas del autor,
  no con una lectura directa de la URL.
- No había encoder (ffmpeg) en la máquina: no se pudo recodificar ni recortar nada, de ahí la regla "idéntico byte a
  byte" y la aceptación de `.flac` en lugar de normalizar formatos.
- El design en paralelo con la spec se desalineó en dos puntos (panel `Sonido` frente a controles en línea; reloj de
  render frente a tick para el intervalo mínimo) y hubo que corregirlo antes de *tasks*.
- Un escenario E2E pedía esperar 2 s de reloj, contra `logicGuard`: se reformuló en modo manual con `step(n)`.
- El `core.hooksPath` del worktree apuntaba al repo principal al empezar; se detectó y corrigió antes del primer
  commit de código.

## Desviaciones respecto a spec o diseño
- Los ficheros llegaron tras el gate de *propose*: la spec pasó de un `pickup` con fichero por tipo de recurso a 3
  tipos de recogida (`pickupGold`, `pickupStone`, `pickupWood`), 12 tipos de efecto en total, tope de peso de 2 a 6
  MB, `.flac` como extensión de audio y licencias CC-BY-3.0/4.0 con `CREDITS.md` (decisión D10 y las rondas de
  spec/design posteriores).
- Pequeño desfase aceptado en apply: el primer frame tras reanudar aún cuenta como pausa y descarta sus peticiones
  (nunca reproduce de más).
- El grupo 6 (ficheros) se cerró con la escucha del autor (tarea 6.2 manual) y la ampliación `game-preview`.

## Lecciones → acciones
- Comprobar la licencia de cada URL antes de copiar un asset, y no fiarse de "todo es CC0" → añadir al skill
  `sdd-workflow` (fase explore/propose, cuando haya assets externos) una lista de comprobación: licencia por
  página, host admitido y si la fuente permite lectura automática.
- Con assets de terceros, cerrar fuentes y licencias antes del gate de *propose*, o escribir la spec con contenido
  desacoplado de los ficheros reales (como se hizo con `file: null`) → anotar en el spec-writer que el contenido
  llega después y qué parte de la spec depende de él.
- Spec y design en paralelo deben contrastarse en una pasada de alineación antes de *tasks* (panel frente a
  controles en línea, reloj de render frente a tick) → añadir ese paso al orquestador.
- Un escenario E2E no puede pedir esperas de reloj: usar `?e2e&manual` y `step(n)` desde la spec → recordarlo en el
  spec-writer (ya está en AGENTS.md §2; reforzarlo con el nombre de `logicGuard`).
- Comprobar `git config core.hooksPath` al crear un worktree → añadirlo a la skill `worktree-flow`.
- Una máquina sin encoder obliga a trabajar con los ficheros tal cual → declarar "sin recodificar" como regla de
  procedencia desde el principio (ya recogido en `asset-provenance`).
