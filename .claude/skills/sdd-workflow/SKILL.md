---
name: sdd-workflow
description: Orquesta un change de Spec-Driven Development de principio a fin (explore, propose, spec, design, tasks, apply, verify, archive) delegando cada fase en su subagente y respetando los gates humanos. Úsala para nueva funcionalidad, mecánica, change, spec, propuesta (EN feature, proposal, new mechanic). NO la uses para cambios triviales (texto, color, constante) ni para spikes.
---

# SDD workflow (orquestador)

Tú eres el orquestador: hablas con el usuario, decides la fase y delegas. Mantén tu contexto limpio: pide a los
subagentes resúmenes cortos, no volcados de ficheros.

## 0. Decidir si aplica

Consulta la matriz de AGENTS.md §5. Si es trivial → prompt directo. Si es incierto → propone un spike `spike/<tema>`.

## 1. Preparar el change

1. Id: `NNNN-kebab-case` (siguiente número libre en `openspec/changes/` y `openspec/changes/archive/`).
2. Worktree y rama: skill `worktree-flow` → `change/NNNN-…`. Si el worktree ya existía, comprueba que tiene
   `node_modules` (si no, `npm ci`) antes del primer commit, también el de los artefactos de planificación, y
   que `git config --get core.hooksPath` apunta a `.husky/_` de **este** worktree (en 0024 y 0025 apuntaba al de
   0022; ver `worktree-flow`).
3. Crea `openspec/changes/<id>/` y, si existe una issue en GitHub, anota su número en `proposal.md`.

## 2. Fases

| # | Fase | Subagente | Artefacto | Gate |
|---|---|---|---|---|
| 1 | explore | `sdd-explorer` | `exploration.md` | — |
| 2 | propose | `sdd-spec-writer` | `proposal.md` | **Humano: aprobar alcance** |
| 3 | spec ∥ design | `sdd-spec-writer` ∥ `sdd-architect` | `specs/**/spec.md`, `design.md` | — (lánzalos en paralelo) |
| 4 | tasks | `sdd-architect` | `tasks.md` | Humano (rápido): revisar tareas |
| 5 | apply | `sdd-implementer` | código + tests + commits | — |
| 6 | verify | `sdd-verifier` | `verify-report.md` | Critical > 0 → volver a 5 |
| 7 | revisión | usuario | PR en GitHub | **Humano: aprobar** |
| 8 | archive | tú, con skill `sdd-archive` | specs vivas + retrospectiva | — |

Tras cada fase, resume al usuario en ≤ 5 líneas: qué se produjo, decisiones abiertas y siguiente paso.

## 3. Reglas

- Nunca saltes un gate humano, aunque el usuario esté ausente: deja el trabajo preparado y para.
- El `sdd-verifier` no puede ser el mismo agente que implementó. Lánzalo siempre como subagente nuevo.
- Si en apply aparece un requisito nuevo, vuelve a spec (no lo cueles en el código).
- **E2E ligeros** (AGENTS.md §2, chore `e2e-lite`): pide al `sdd-architect` que en `tasks.md` cubra cada escenario
  con test unitario o de aplicación y reserve el E2E para lo que exige navegador (DOM, render, almacenamiento
  real): máximo 1–2 E2E nuevos por change, en modo manual y sin umbrales de fps ni de tiempo real en el gate.
- En apply, al cerrar cada sección de `tasks.md`, haz `git fetch` y mira si `origin/main` avanzó; si avanzó,
  rebasa antes de seguir (0014).
- Fases pequeñas pueden fusionarse (`spec+design+tasks` en un paso) si el usuario lo pide: anótalo en la retrospectiva.
- **Comportamiento actual en las preguntas al autor**: si una opción dice "como X hoy" (la espuma, el reloj, un
  tope), comprueba en el código qué hace X antes de preguntar. En 0029 se ofreció "como la espuma, que sigue en
  pausa" y la espuma se congela; el architect lo detectó y hubo que repreguntar.
- **Decisiones abiertas al gate de propuesta**: si la exploración deja abierta una regla de azar (cuántos valores
  consume cada evento, cuándo no consume) o en qué fichero de `content/` vive un dato, pregúntalo al usuario antes
  de *propose* y escríbelo en `proposal.md`. Si no, spec ∥ design lo resuelven distinto (0025: consumo por baja y
  roca en `resources.json` frente a `appearance.json`; costó una ronda más del spec-writer).
- **Quién produce los assets**: si el change necesita arte o audio nuevo, confirma antes de *propose* quién lo
  produce y con qué herramienta (el autor por su cuenta o la propia sesión). Sin generador de imágenes en la sesión,
  ofrece una muestra dibujada por script determinista (0034: el plan contaba con Antigravity y se reescribió en apply).
- **Mediciones previas**: si `exploration.md` las pide, ejecútalas antes de *propose* (test temporal fuera del
  repo o un `sdd-implementer` acotado que no versiona nada) y pasa los números al `sdd-spec-writer`. Un objetivo
  de balance no entra en la propuesta sin datos (0006: el design previó ajustes que no servían). Antes de pasar
  la configuración medida, contrástala con las specs vivas que la restringen (monotonía de oleadas, escenarios
  con ticks fijos): en 0017 una tabla medida incumplía "Oleadas que crecen" y dos escenarios rompieron en apply.
- **Tiempo del lote de balance**: si el change cambia el bot de referencia o el coste por tick, mide también cuánto
  tarda el lote de 50 partidas y compáralo con su timeout (0020: ~25 s en local, ~70 s en CI, tope 60 s).
  Mídelo con el test real, con sus invariantes por tick: en 0027 el design citó 43,9 s de un lote sin ellos y el
  real daba 62–65 s. El factor local → CI no es fijo (0026: ≈ 2,8; 0027: ≈ 1,4 con el mismo bot): antes de subir
  un timeout, mira el tiempo en el CI de la PR.
- **Coste por tick con tope**: si el núcleo gana una estructura con tope (registro, pool), pide al `sdd-architect`
  que estime el **peor caso con el tope lleno** y al `sdd-implementer` que lo mida con `npm run bench` al cerrar el
  grupo de dominio (0031: la búsqueda lineal estimada en < 0,01 ms subía el tick +12–16 % con el tope saturado).
- **Reglas sobre datos medibles**: si una spec añade una regla sobre valores que salen de assets (colores, márgenes,
  tamaños), pide al `sdd-architect` que la compruebe contra los ficheros reales antes de *tasks* (0032: la tinta
  `danger` roja con contraste 4,5 era imposible sobre el botón rojo pulsado y se descubrió en apply). Con una
  pieza 9-slice en un control pequeño, que compruebe también que caja − márgenes × k deja cara visible para el
  contenido (0036: la × de 48 px con márgenes 20/28 no tenía cara y el glifo no se leía; los tests de centrado
  pasaban).
- **¿Estado actual o deseado?**: si una petición describe un comportamiento («no aparece hasta que…»), confirma con
  el autor si es lo que pasa hoy (bug) o lo que quiere antes de explorarla como bug (0036: era lo deseado).
- **Sin `--no-verify` tampoco en commits temporales**: al pedir apply, recuerda al `sdd-implementer` que para
  apartar trabajo durante un rebase use un commit WIP con hooks o `git stash push -u -m <tag>` (0032: tres WIP
  con `--no-verify`, ninguno en la rama final).
- **Reglas «ningún elemento…» sobre el DOM**: pide al `sdd-spec-writer` que compruebe en el código qué atributos
  ponen ya los changes anteriores antes de prohibirlos (0033: «Sin estilos inline» olvidaba el `style` con
  variables `--*` de `#game` desde 0017/0032, W1).
- **Sondas ampliadas**: si el change añade campos a una sonda E2E, el design no puede prometer «ningún test
  cambia»; pide al `sdd-architect` que liste las aserciones `toEqual` afectadas (0033: tres, S1).
- **Reglas transversales en las specs**: si el change cambia una regla que otras capacidades dan por supuesta
  ("solo se ofrece lo asequible", "un solar libre no bloquea"), pide al `sdd-spec-writer` que la busque en **todas**
  las specs vivas, no solo en las de la propuesta (0027: `resources` decía "con madera 14 la casa no se ofrece" y
  saltó en apply).
- **Número de ADR**: pide al `sdd-architect` un `git fetch` antes de numerar un ADR y renumera si `main` ocupó el
  número durante el change (0020: dos ADR-0018).
- **Contraste final del design**: spec y design van en paralelo, así que al pedir *tasks* indica al
  `sdd-architect` las specs delta que no existían cuando escribió el design y que las contraste antes de
  descomponer (0006: dos specs llegaron tarde y obligaron a reabrir el design). Pide también que contraste los
  criterios de éxito de `proposal.md` con las specs (0013: uno contradecía la spec de spawn).

## 3.1 Coste (créditos)

Cada subagente arranca en frío y vuelve a leer design, specs y skills: ese arranque es el gasto fijo.
- **Agrupa correcciones**: tras un verify, una sola ronda de apply con todos los hallazgos que se vayan a resolver.
  Las Suggestions que no compensen una ronda se registran como deuda en el verify-report.
- **Correcciones triviales** (una línea, un texto, un trailer) las hace el orquestador si el usuario lo pide, sin
  lanzar subagente; anótalo en el diario de IA.
- **Re-verify acotado**: la segunda pasada del `sdd-verifier` revisa solo los hallazgos previos y el diff
  `<commit del informe>..HEAD`, no el change entero.
- Para retomar un subagente cortado, envíale un mensaje (conserva su contexto) en vez de lanzar uno nuevo.
- Cierra la sesión al archivar: el siguiente change empieza en una sesión nueva en su worktree; el estado vive en
  `tasks.md`, `verify-report.md` y `docs/ai-log/`.

## 4. Plantillas

`references/proposal.md`, `references/spec.md`, `references/design.md`, `references/tasks.md`.
