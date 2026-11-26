# Retrospectiva · 0033-mobile-web

- **Fechas**: inicio 2026-11-26 → archivado 2026-11-26
- **PR**: #88 (merge `b766d1a`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 10 / 10 (5 grupos, A–E) |
| Commits (asistidos por IA) | 9 (9): planificación, 5 de apply (uno por grupo), E2E de W2, correcciones de verify y re-verify |
| Tests añadidos | 127 bloques `it`/`test` nuevos (1 retirado); 4.109 tests en `verify`; 2 E2E nuevos en `logic` (19 en la suite) |
| Hallazgos verify (C / W / S) | 0 / 2 / 2 → re-verify 0 / 0 / 0 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 4: 4 decisiones del autor antes de *propose*, 2 escenarios devueltos al spec-writer tras el design, ronda única de correcciones de verify y aviso al implementer para no arrastrar ficheros ajenos al commit |
| Diff | 67 ficheros, +5.529 / −68; `src/domain` y `src/application` sin cambios |
| Specs vivas | 2 capacidades nuevas (`mobile-display` 36 escenarios, `touch-controls` 41) y 3 modificadas (`world-camera`, `hud`, `simulation-loop`, +2 escenarios cada una) |

## Qué fue bien
- El spike `spike/mobile` dejó una lista de conclusiones concreta; la exploración la contrastó con el código de
  0017/0032 y dejó 11 decisiones con recomendación. Las 4 de más peso se cerraron con el autor antes de *propose*.
- El código instalado de Phaser 4.2.1 ya calcula EXPAND con la fórmula de la propuesta: no se copió en `src`.
- El arrastre por CDP (`Input.dispatchTouchEvent`) llega a Phaser en headless; no hizo falta el plan B. El
  implementer comprobó que el E2E móvil falla si se anula la captura del joystick.
- Sin núcleo: firmas, balance y 820/904 objetos del mapa intactos sin regenerar nada.

## Qué fue mal / dónde falló la IA
- El design se escribió antes que las specs (en paralelo) y hubo que contrastarlo después: 7 puntos a reconciliar
  y 2 escenarios devueltos al spec-writer (aspecto con tope y «Sin estilos inline»).
- La spec «Sin estilos inline» no conocía el `style` de `#game` que publica variables `--*` desde 0017/0032 (W1).
  El escenario pedía recorrer varias pantallas y el E2E solo miraba una (W2).
- El design afirmó «ningún test actual cambia» y la sonda `viewport` con campos nuevos obligaba a ampliar tres
  aserciones `toEqual` (S1).
- El implementer volvió a usar heredocs y `python -` para escribir código (prohibido en §8.1); Python dejó CRLF en
  cinco ficheros, normalizados antes del commit.
- El orquestador escribió `core.hooksPath` en la config compartida del repo en lugar de la del worktree; se dejó el
  valor relativo `.husky/_` y se quitó el override del worktree.

## Desviaciones respecto a spec o diseño
- Tests existentes ampliados (`DESKTOP_VIEWPORT_EXTRA` en `smoke.spec`/`gameplay.spec`, `viewport-probe.test.ts`).
- `#game` exceptuado en «Sin estilos inline» si su `style` contiene solo propiedades `--*` (delta de spec en verify).
- Sonda `viewport` con `mobile`, `domScale`, `displayScale` y `hint`; sondeo del joystick en cada frame para soltar
  el dedo en modo manual; `--safe-area-block` y `overscroll-behavior: contain` en paneles.
- iOS sin verificar (best effort, decidido en la propuesta).

## Lecciones → acciones
- Una spec nueva sobre el DOM tiene que partir del DOM real de hoy (atributos que ya ponen changes anteriores) →
  `sdd-workflow` §3: pedir al spec-writer que, para reglas «ningún elemento…», compruebe el DOM actual en el código.
- Una sonda con campos nuevos rompe los `toEqual` existentes → plantilla de design: no prometer «ningún test cambia»
  si el change amplía una sonda; listar las aserciones afectadas.
- `core.hooksPath` en worktrees con `extensions.worktreeConfig` → `worktree-flow`: usar siempre `--worktree` o
  `--unset` y nunca `git config core.hooksPath <ruta>` sin ámbito.
