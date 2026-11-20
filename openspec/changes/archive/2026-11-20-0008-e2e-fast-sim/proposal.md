# Proposal · 0008-e2e-fast-sim

- **Estado**: aprobada (2026-11-20)
- **Issue**: sin issue de GitHub
- **Rama / worktree**: `change/0008-e2e-fast-sim`

## Problema
La suite E2E (13 tests) tarda **7,7 min** en local con 1 worker (medido; el GDD estimaba 4,2 min). Casi todo el
tiempo es simulación en tiempo real: cada derrota espera ~78 s. Reparto medido: bucle export → recarga → import
(2 derrotas) 2,7 min; almacenamiento bloqueado (seed 90) 1,3 min; derrota + reinicio 1,3 min; primer golpe 1,2 min;
level-up 57 s; los 8 restantes < 4 s cada uno. Con esta duración los E2E se ejecutan poco y frenan los changes
siguientes (0009 menú, 0010 equilibrio), que añadirán más. Es la deuda `0007 · E2E` del GDD.

## Objetivo
Los E2E pueden pedir una simulación acelerada (`?e2e&speed=N`) que ejecuta N veces el paso de simulación por frame
**solo en el adaptador de Phaser**, con el mismo resultado que a velocidad 1 para la misma semilla. Los tests que
no prueban la derrota parten de progreso sembrado en `localStorage`. La suite completa baja de 1 min en local.

## Alcance
- **Dentro**:
  - Parámetro de URL `?speed=N`, **efectivo solo si también está `?e2e`**; sin `?e2e` se ignora (no altera
    partidas, récords ni historial del jugador).
  - Validación con zod (regla 6): entero en `1..15` (el acumulador ya admite 15 ticks/frame). Valor inválido →
    **un único aviso** en consola y velocidad 1, igual que `?seed`.
  - Aceleración en el adaptador: N avances del bucle de paso fijo por frame, deteniéndose en cuanto la partida
    deja de estar en curso (oferta de mejora, victoria o derrota). Núcleo (`domain`, `application`) intacto.
  - Equivalencia: para la misma semilla e input constante, el resultado de la partida (tick final, nivel, kills,
    mejoras elegidas) es idéntico con `speed` 1 y N.
  - E2E: usar la velocidad acelerada (N = 8) en los que juegan hasta un evento lejano (derrota, primer golpe,
    level-up). Bucle export → recarga → import: sembrar la 1.ª partida en `localStorage` y jugar **una sola**
    derrota acelerada. Sembrar también en los demás tests donde la derrota no es lo que se prueba.
  - Revisar umbrales de tiempo real de los E2E (expresarlos en ticks o ajustarlos a la velocidad).
  - Playwright: valorar `workers` (medido: 2 workers 47 s, 1 worker 68 s). CI: bajar `timeout-minutes` del job
    `e2e` (hoy 10) a un valor razonable y solo medir la duración, sin criterio duro.
  - Delta de la spec viva `simulation-loop`.
- **Fuera**:
  - Atajo "terminar ya" ni ninguna entrada nueva en el núcleo (descartado en 0007: prueba un camino distinto del real).
  - Cambiar `MAX_FRAME_MS` / el tope de ticks por frame del núcleo.
  - Acelerar el reloj del motor (`timeScale`, `fps`) o los tweens/render.
  - `?speed` disponible para el jugador fuera de `?e2e`.
  - Cambios de balance o de semillas frágiles (deuda `0007 · S2`, change 0010).

## Capacidades afectadas
- `openspec/specs/simulation-loop` (modificada: velocidad de simulación en modo E2E y equivalencia de resultados).
- `progress-persistence` y `run-results`: sin cambio de comportamiento; sus E2E se reescriben (siembra + velocidad).

## Riesgos y dudas
- **Equivalencia frente a descarte de ticks**: cuando se abre una oferta a mitad de frame se descartan los ticks
  restantes; con N avances por frame el patrón podría diferir. Prototipo: seed 42 (N=1/4/8/15) → tick 4682, nivel 3,
  77 kills, mismas mejoras; seed 90 → tick 4501, nivel 4, 70 kills. Aun así, los E2E no deben fijar el tick exacto.
- **Input**: se lee una vez por frame y se aplica N veces. Equivalente con input constante (los E2E); una pulsación
  breve "dura" N ticks. Aceptable porque solo existe en modo E2E.
- **Coste por frame**: 0,126 ms/tick medio (p99 0,26) con 200 enemigos; con N=8 ≈ 1–2 ms/frame. Medido 59,9–60,1 FPS
  en todos los N. En CI (2 núcleos, WebGL por software) puede ser peor: por eso solo se mide.
- **Siembra**: el `localStorage` sembrado debe ser válido según el esquema zod de 0007; si el esquema cambia, los
  fixtures caducan. Conviene construirlos con los mismos tipos/esquema.
- **Workers**: 2 workers compiten con WebGL por software en CI; decisión del design (local, criterio < 1 min).
- Dependencia de semillas 42 y 90 (deuda `0007 · S2`), sin cambio en este change.

## Criterio de éxito
- Con `?e2e&speed=8`, una derrota E2E (seed 42) termina en **≤ 12 s** reales (medido 9,9 s).
- Para seeds 42 y 90, el resultado con `speed=8` (tick final, nivel, kills, mejoras) es **idéntico** al de `speed=1`.
- Sin `?e2e`, `?speed=8` no cambia nada: 1 tick de simulación por paso de 16,67 ms y sin aviso.
- `?e2e&speed=0`, `=16`, `=abc`, `=2.5` → exactamente 1 aviso en consola y velocidad 1.
- El bucle export → recarga → import y los E2E que no prueban la derrota juegan **como mucho una** derrota
  (los de carga, ninguna).
- Suite E2E completa en local **< 60 s** (con 1 o 2 workers), 13/13 en verde sin reintentos.
- CI: `timeout-minutes` del job `e2e` reducido; duración registrada en el verify-report (sin umbral).
- `npm run verify` verde; ningún fichero de `src/domain` ni `src/application` modificado.
