# Retrospectiva · 0027-site-contact

- **Fechas**: inicio 2026-11-25 → archivado 2026-11-25
- **PR**: #68 (squash `0d63319`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 14 / 14 (4.3 en este archive) |
| Commits (asistidos por IA) | 8 en la rama (8), 1 tras el squash |
| Tests añadidos | +49 (3.444 → 3.493), 0 E2E nuevos (se amplió "Construir una casa en el juego real") |
| Hallazgos verify (C / W / S) | 1 / 1 / 2 → re-verify 0 / 1 (deuda) / 1 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 3 (decisiones previas a propose, informe "solo casas", ronda de verify) |
| Diff de la PR | 81 ficheros, +4.189 / −886 |
| Balance | v4 30 → 34/50 · v5 29 → 34/50 (1,30 casas, 1,10 torres) · 0 quietos · solo cambia `STONE_GOLDEN` |
| Lotes en CI (PR #68) | v4 52,1 s · v5 89,0 s (local 37–40 s y 62–65 s) · `quality` 3 min 6 s |

## Qué fue bien
- Medir con un prototipo desechable (`spike/0027-measure`) antes de proponer: v4 y v5 dieron 34/50 en el prototipo
  y en apply, sin recalibrar nada, y la lista de firmas afectadas (solo `STONE_GOLDEN`) se cumplió.
- Las cuatro decisiones abiertas (re-armado, apertura, ε, «faltan N») se preguntaron al usuario antes de propose:
  spec y design no divergieron en ellas.
- El informe del usuario ("solo podía construir casas") se convirtió en un test de regresión de extremo a extremo
  con el contenido real (3.4) en vez de en una suposición; confirmó que no había bug, solo falta de recursos.

## Qué fue mal / dónde falló la IA
- El design (§1.3) pedía recolocar al arrancar enemigos y recogibles de `RunSetup` sobre una huella, contra tres
  escenarios de la spec escritos en paralelo. Lo detectó el implementer; el orquestador corrigió el design.
- La spec viva `resources` ("con madera 14 la casa no se ofrece") contradecía el alcance y no la cubrió ninguna delta
  hasta apply: el spec-writer no buscó en todas las specs vivas escenarios que dependieran de la regla cambiada.
- La cifra del lote del v5 del design (43,9 s) venía de un lote sin el invariante por tick; la real es 62–65 s en
  local. El verifier lo marcó como Warning y se subió solo ese timeout a 300 s.
- Proyección ×2,8 a CI demasiado pesimista: en la PR los lotes tardaron 52 s y 89 s (factor ≈ 1,4), no 175 s; en
  0026 el mismo runner dio 94 y 140 s, así que el factor varía entre ejecuciones.
- El verifier encontró un escenario sin test ("Marcar no consume azar"): el implementer cerró 2.1 sin cruzar los
  títulos de los escenarios con los tests.

## Desviaciones respecto a spec o diseño
- G1 y G2 en un único commit: con solares aún caminables, el v5 rompía la invariante de `clearFootprint`.
- Despeje inicial: solo recoloca puestos y patrullas de guardia (manda la spec sobre el design).
- Delta nueva de `resources` en apply (MODIFIED "Contadores de oro y madera de la partida").
- "Bot reproducible" sin `bought > 0` (en la semilla 7 el v4 ya no compra); los tests "con y sin recursos/ovejas"
  usan `withoutSites` en los dos lados.
- `BuildPanel` recibe los iconos como tercer argumento del constructor.
- Timeout de `balance-builder.test.ts` a 300 s.

## Lecciones → acciones
- Cuando un change cambia una regla transversal ("solo se ofrece lo asequible"), el spec-writer debe buscarla en
  **todas** las specs vivas, no solo en las capacidades de la propuesta → nota en `sdd-workflow` (fase spec).
- Las cifras de tiempo de lotes que entran en el design deben medirse con los invariantes por tick del test real →
  nota en `sdd-workflow` ("Tiempo del lote de balance").
- El factor local → CI no es fijo: con la máquina actual fue ≈ 1,4, no 2,8. Medir en la PR antes de subir timeouts →
  nota en `sdd-workflow`; revisar si el timeout de 300 s del v5 puede volver a 180 s (89 s en CI).
- Antes de cerrar una tarea con muchos escenarios, cruzar los títulos de la spec con `tests/` (como hace el
  verifier) → nota en el agente `sdd-implementer` o en la skill `test-writer`.
