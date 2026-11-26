# Retrospectiva · 0030-pickup-visibility

- **Fechas**: inicio 2026-11-26 → archivado 2026-11-26
- **PR**: #78 (archivo en PR aparte)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 13 / 13 (6 grupos, A–F; F añadido en apply) |
| Commits (asistidos por IA) | 9 (9) en la rama; squash en `2b5181b` |
| Tests añadidos | 81 casos `it`/`test` nuevos (7 ficheros de test nuevos, 26 tocados); 3.756 en total; 0 E2E nuevos (1 ampliado, «Mapa real») |
| Hallazgos verify (C / W / S) | 0 / 1 / 2 (W1 y S2 resueltos antes de la PR; S1 como deuda) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 5 (abiertos del gate, salto del flote, reserva del árbol, celda 0 del spawn, escenario de recuentos) |

## Qué fue bien
- Las cuatro decisiones abiertas (escala, flote, montones del tick 0, zoom) se preguntaron antes de *propose*: la
  propuesta salió en una pasada y el zoom quedó fuera con su motivo.
- Todo cabe en infraestructura y contenido: núcleo, firmas doradas, `BALANCE_BASELINE` y 820/904 objetos intactos,
  sin azar nuevo. El flote usa el reloj de render (pausa y `step(n)` gratis), sin tweens.
- El spec-writer encontró una capacidad no prevista (`world-camera`, error ≤ 1 px de las gemas) al recorrer todas
  las specs vivas.
- El autor vio el juego en local antes de aprobar la PR.

## Qué fue mal / dónde falló la IA
- El architect afirmó que la celda 0 de `*_Spawn` estaba vacía «mirando la imagen»; era un destello blanco. Saltó
  en apply (montones como discos blancos durante el retardo) y costó una ronda spec + design + grupo F.
- Spec y design divergieron dos veces por ir en paralelo: el salto de 4 px al terminar la aparición (la spec lo
  admitía, el design flotaba siempre) y si un recogible en retardo cuenta como visible en la sonda. Se resolvió
  mandando la spec.
- El escenario «Recuentos de recogibles…» era imposible con ids únicos (oro y carne del primer pintado caen en
  retardo); W1 de verify.
- El architect no tiene shell y no pudo calcular sha256 ni bytes de las hojas: quedó para apply.

## Desviaciones respecto a spec o diseño
- Aparición 0–6 con el recogible oculto durante el retardo (decisión del autor tras el hallazgo de la celda 0).
- Flote sin salto: con aparición, d = A·sen(2π(R − R_f)/T) desde el primer frame fuera de ella (decisión del autor).
- `closestIssue` en `loadAppearance.ts` para nombrar `pickups.xp.diameter` en el error de zod.
- Escenario de recuentos reescrito tal como lo monta `pickup-spawn.test.ts`.

## Lecciones → acciones
- Un dato de un asset (frame vacío, tamaño, número de celdas) no se da por bueno en design sin medirlo con
  código → pedir al implementer una medición previa (píxeles opacos por celda) antes de *propose*, como las
  mediciones de balance (`sdd-workflow` §3 «Mediciones previas»).
- Spec ∥ design divergen en reglas de borde (transiciones, qué cuenta la sonda) → al pedir *tasks*, listar
  explícitamente al architect las transiciones y recuentos de la spec para contrastar.
- Los escenarios con recuentos deben construirse respetando las reglas temporales del propio change (retardo del
  primer pintado) → el spec-writer comprueba que cada escenario es montable.
