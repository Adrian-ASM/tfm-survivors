# Retrospectiva · 0008-e2e-fast-sim

- **Fechas**: inicio 2026-11-20 → archivado 2026-11-20
- **PR**: #16 (squash `2d20f35`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 8 / 8 (3.1–4.5; grupos 1 y 2 vacíos: núcleo intacto) |
| Commits (asistidos por IA) | 10 (10) en la rama, fusionados por squash |
| Tests añadidos | +37 unitarios (1046 → 1083) · +3 E2E (13 → 16, `speed.spec.ts`) |
| Hallazgos verify (C / W / S) | 0 / 3 / 4 · sin ronda de correcciones; W2, W3, S1/S2 registrados como deuda en el GDD |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 2 (delta extra de `progress-persistence` pedido tras el design; cifra exacta de F fijada en tasks) |
| Suite E2E | 7,7 min → 38,3 s (2 workers, 16/16, sin reintentos) · derrota 78 s → 9,9 s |

## Qué fue bien
- **Mediciones previas antes de proponer** (lección de 0006): un prototipo desechable confirmó la equivalencia
  (seeds 42 y 90, N = 1/4/8/15: mismo tick, nivel, bajas y mejoras) y midió la suite real (7,7 min, no 4,2). La
  propuesta salió con números y pasó el gate a la primera; N = 8 y el tope 15 vinieron de los datos.
- Cuatro preguntas abiertas de la exploración resueltas por el usuario antes de proponer (`?speed` solo con `?e2e`,
  sembrar la 1.ª derrota, objetivo < 1 min solo local, delta en `simulation-loop`).
- El design razonó la equivalencia por construcción (el estado tras k ticks solo depende de semilla, input y
  elecciones) en vez de confiar en el prototipo, y la implementación la fija con tests en Node que tardan < 0,1 s.
- Núcleo intacto: `advanceFrame` es una función pura sin Phaser en infraestructura; `src/domain` y
  `src/application` sin diff.
- El builder de progreso sembrado usa el codec de producción (`encodeProgress`/`decodeProgress`), así que no se
  desincroniza del esquema de 0007.

## Qué fue mal / dónde falló la IA
- **Typecheck fuera del pre-commit**: un commit de 4.1 entró con un error de `tsc` (`addInitScript` devuelve
  `Promise<Disposable>`). El implementador filtró la salida de `verify` con `grep` y ocultó el fallo; lo detectó
  después y enmendó el commit local. El hook de commit no lo paró porque no ejecuta `typecheck` (W2).
- **4.3 sin rojo propio** (W1): la reescritura de `progress.spec.ts` pasó a la primera. Era previsible (el
  comportamiento del juego no cambia), pero no hay evidencia de que la aserción de 3 entradas detecte la regresión.
- **Spec ∥ design desalineados otra vez**: el design descubrió que con una sola derrota no se puede seguir el orden
  literal "exporta → recarga → importa" de la spec viva de `progress-persistence`; hizo falta un delta MODIFIED que
  el spec-writer no tenía en su encargo.
- El GDD estimaba la suite en ~4,2 min; la medición real fue 7,7 min.

## Desviaciones respecto a spec o diseño
- El escenario "Oferta a mitad de frame acelerado" necesitó medir con un test temporal la posición de la gema
  (x = 516) para abrir la oferta justo en el 3.er tick.
- Las mitigaciones del design para `kills: 0`/`xp: 0` tras R a speed 8 no hicieron falta.
- `results.spec` registra el tiempo real de la derrota como anotación `defeat-real-ms`.

## Lecciones → acciones
- Filtrar la salida de `verify` puede ocultar un fallo → el implementador comprueba el código de salida, no solo
  la cola del log. Acción: AGENTS.md §8.1 ya pide `tail -20`; añadir "y comprueba el código de salida" (pendiente
  de aplicar en el PR de acciones de la retro, junto con W2).
- El pre-commit no cubre `tsc` → deuda 0008 · W2 en el GDD (pre-push con `tsc --noEmit`).
- Cuando el change toca E2E que ya describe una spec viva, el explorer debe listar los escenarios E2E de specs vivas
  afectados para que el spec-writer los incluya desde el principio → añadir ese punto a la plantilla de
  exploración / al encargo del `sdd-explorer`.
- Las mediciones previas volvieron a pagar (0006 → 0008): mantener la regla de la skill `sdd-workflow`.
