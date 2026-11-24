# Retrospectiva · 0023-sheep-meat

- **Fechas**: inicio 2026-11-24 → archivado 2026-11-24
- **PR**: [#58](https://github.com/Adrian-ASM/tfm-survivors/pull/58) (squash `a833c0b`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 14 / 14 (8 grupos, 0–7) |
| Commits (asistidos por IA) | 10 (10): 1 de planificación, 7 de apply (uno por grupo), 1 de correcciones de verify, 1 del informe |
| Tests añadidos | ~205 (2.648 → 2.853 en `verify`); 15 ficheros de `tests/` nuevos y 31 modificados; 0 E2E nuevos (2 ampliados) |
| Hallazgos verify (C / W / S) | 0 / 3 / 2 (W2, W3, S1 y S2 corregidos en `13fc7f3`; W1 registrado como nueva línea base) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 (`guard:all` falló una vez en `verify` local: `M_Idle.png` preparado sin `asset-provenance.json`) |
| Iteraciones de prompt relevantes | 4: preguntas abiertas de la exploración, contraste design ↔ specs en *tasks*, decisión del arte en el gate de tareas, ronda de correcciones de verify |

Balance (gate M1, sin recalibrar ningún parámetro): bot v3 **28/50** con ovejas (banda 25–35), **27/50** idéntico a
la línea base semilla a semilla con tope de ovejas 0 (26,9 mechas), 0 quietos que ganen. El bot se cura 4,2 de vida
por partida de media; el quieto, 0. Lote del bot 29 s local (+7,5 %; ~81 s estimados en CI, tope 90);
`balance.test.ts` pasa de 31,5 a 63 s por el segundo lote. Bench con cuatro topes llenos y ovejas en huida:
0,252 ms/tick.

## Qué fue bien
- Las preguntas abiertas de la exploración se resolvieron con el usuario antes de *propose* (una sola ronda de 4
  preguntas); la única divergencia con la recomendación (reaparición) entró en la propuesta como riesgo principal.
- El flujo de azar propio (`SHEEP_STREAM` 5) dejó intactas las tres goldens previas; el balance con tope 0 es
  idéntico semilla a semilla, lo que aísla el efecto de las ovejas.
- El contraste final del design en *tasks* (regla 0006 del workflow) detectó tres divergencias de spec ∥ design
  (fórmula de curación, deambular con hash sin estado frente a pasto/paseo, sitio de los datos de la carne) y las
  resolvió antes de descomponer.
- Balance dentro de banda sin tocar contenido; ningún hook ni regla de ESLint bloqueó.

## Qué fue mal / dónde falló la IA
- El `sdd-architect` no tenía shell y no pudo hacer el `git fetch` para numerar el ADR; lo hizo el orquestador.
- El design inicial propuso `HappySheep_All.png` sin ver que las specs (escritas en paralelo) lo prohibían; se
  resolvió en el gate de tareas a favor de las specs.
- El design usaba un hash sin estado para el deambular, contrario a `simulation-loop` (todo el azar de un
  `RandomGenerator`).
- El design exigía `sheep.radius ≤ cellSize / 2`, incompatible con un escenario vivo; el implementador la quitó pero
  dejó el design y un comentario de `schemas.ts` desactualizados (W3).
- Un escenario nuevo ("Resultados sin ovejas") quedó sin test propio hasta verify (W2).
- El lote del bot sube un 7,5 %, por encima del 5 % orientativo de la spec (W1).

## Desviaciones respecto a spec o diseño
- Sin la regla zod `radius ≤ cellSize / 2`: la posición legal se garantiza colocando/reapareciendo solo en celdas
  cuyo centro lo es (design §15).
- `Arsenal.step` recibe estructuras y ovejas como dos parámetros opcionales en vez de una lista de niveles.
- Escala de la oveja 0,6 (design ~0,4).
- Escenario del barril junto a una oveja con la "oveja quieta de prueba" (radio de huida 50).
- Arte de la carne (`M_Idle`) adelantado al grupo 1 porque sin él no compilaba.
- Verify de las correcciones sin segunda pasada del `sdd-verifier` (solo eran Warnings; el usuario pidió abrir el PR).

## Lecciones → acciones
- Un agente sin shell no puede numerar un ADR contra `origin/main` → el orquestador hace el `git fetch` y le pasa el
  número libre al lanzar el design (añadir a la regla "Número de ADR" de `sdd-workflow`).
- Spec ∥ design produce choques de assets y de azar → al lanzar el design, pasar al `sdd-architect` las restricciones
  ya conocidas de las specs vivas (assets vetados, azar solo por `RandomGenerator`); el contraste en *tasks* siguió
  siendo necesario y funcionó.
- Las desviaciones del apply deben reflejarse en `design.md` en el mismo commit que las introduce → pedírselo al
  `sdd-implementer` en el prompt de apply (evita W3/S1).
- Cada change que añade un lote de balance dobla el tiempo de `balance.test.ts` → vigilar el tope de CI (90 s) en el
  próximo change que toque el coste por tick; nueva línea base: lote del bot ~29 s local / ~81 s CI.
