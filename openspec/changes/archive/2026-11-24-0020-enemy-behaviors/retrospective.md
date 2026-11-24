# Retrospectiva · 0020-enemy-behaviors (parte A)

- **Fechas**: inicio 2026-11-24 → archivado 2026-11-24
- **PR**: #48 (archivo en PR propio)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 28 / 28 |
| Commits (asistidos por IA) | 11 (11) |
| Tests añadidos | 145 casos `it`/`test` nuevos (51 ficheros de `tests/` tocados; suite 2.235 tests en 192 ficheros) |
| Hallazgos verify (C / W / S) | 0 / 4 / 3 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 1 (CI: `HookTimeoutError` del lote de balance) |
| Iteraciones de prompt relevantes | 3 (preguntas de alcance antes de propose, 3 desajustes propuesta ↔ specs tras tasks, fallo de CI) |

Otros datos: balance 27/50 con el bot v3 y 0 quietos en ambos mapas; bench informativo 0,195–0,215 ms/tick (peor
caso con proyectiles) y 0,037–0,045 (peor caso con peligros); 46 lotes de calibración; 2 hojas de arte nuevas.

## Qué fue bien
- Partir el bloque 0020 del GDD en A (comportamientos) y B (estructuras) a raíz de la exploración: A no tocó el
  generador y la firma dorada del mapa quedó intacta.
- Las mediciones previas corrigieron un dato heredado (primera oferta s7 en 2.082, no 1.527) y anticiparon que el
  barril hacía ~70 % del daño por contacto: la recalibración se esperaba.
- El contraste final del design con las specs (rev. 2) encontró y resolvió antes de apply los desajustes de modelo
  (clases cerradas de estado, tope solo de dinamitas, `damage` opcional).
- TDD estricto en el núcleo con rojo comprobado, incluido romper a propósito el segundo `removeDead` y el tope.
- Un solo E2E nuevo en modo manual, como pide `e2e-lite`.

## Qué fue mal / dónde falló la IA
- **Choque de número de ADR**: el design creó ADR-0018 mientras `main` recibía `0018-tdd-por-capa` (#47). Lo renumeró
  el orquestador a 0019 tras el apply.
- **CI en rojo por tiempo**: el lote de 50 partidas del bot v3 tardó ~70 s en el runner (tope 60 s; ~25 s en local).
  Nadie midió el tiempo del lote al cambiar el bot.
- **Regla del bot v3 débil**: la regla escrita en la spec deja al bot inmóvil ante un artillero lejano (huida (0, 0)
  y dinamita en su centro exacto). Se sorteó con la salida del TNT a 100 px, que quita carácter de artillero (W3).
- La spec delta `leveling` apareció en apply (palanca permitida por la propuesta, pero no prevista en spec).
- Dos ediciones con `node -e` en Bash perdieron texto entre comillas invertidas (la shell las evaluó).
- `core.hooksPath` del worktree de la app apuntaba al checkout principal.

## Desviaciones respecto a spec o diseño
- Calibración fuera del design §5: salida del TNT 100 (no 260), explosión del barril 25 (no 20), curva de XP 9/4
  (`xpGrowth` 3 → 4). Recogidas en el §5 y en el addendum del ADR-0019 (W1 resuelto antes del PR).
- La sección 3 se commiteó con 5.1 y 6.2 para no dejar un commit en rojo (S1).
- "Fuego amigo que mata" se verifica por la XP ganada y no por la posición de la gema (W2, aceptado en revisión).
- Aclaraciones del autor tras tasks: D2 en el caso límite (el barril cuya mecha acaba en el tick sí explota), bench
  informativo y tope de 64 explosiones en render como deuda.

## Deuda
- **W3**: revisar la regla de esquive del bot v3 (dirección de escape por defecto) y recuperar una distancia de
  lanzamiento del TNT mayor que 100 en 0020b.
- **S2**: test que fije que el pool de explosiones no crece indefinidamente.
- Render con un máximo de 64 explosiones simultáneas (`maxBlastSprites`).
- `simulation-loop` "Partida recién creada" sigue citando XP siguiente 5 (incoherencia previa a 0020).
- Margen de balance estrecho: 27/50 con límite inferior 25.

## Lecciones → acciones
- Al cambiar el bot o el coste por tick, medir el tiempo del lote de balance en las mediciones previas y en apply →
  hecho: nota en la skill `sdd-workflow` §3.
- Reservar el número de ADR con `git fetch` justo antes de crearlo y renumerar al rebasar → nota en la skill
  `sdd-workflow` §3 (hecho).
- Las reglas de un bot de referencia en una spec necesitan un escenario con un peligro lejano y el jugador quieto →
  pedírselo al `sdd-spec-writer` cuando el change añada peligros a distancia (0020b).
- Abrir sesiones de change desde el worktree de la app funcionó (cargan subagentes y hooks) renombrando la rama a
  `change/<id>`, pero exige revisar `core.hooksPath` → ya cubierto por la skill `worktree-flow`.
