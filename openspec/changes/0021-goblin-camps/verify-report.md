# Verify report · 0021-goblin-camps

Rama `change/0021-goblin-camps`, commits f083e8e..b150849 sobre origin/main 8b661be. Verificador independiente (no escribió el código).

## Ejecución

| Comando | Resultado |
|---|---|
| `npm run verify` | Verde: lint, typecheck, `guard:all` (848 ficheros) y vitest 216 ficheros / 2.463 tests |
| `npm run test:e2e` | Verde: 14/14 (proyecto `logic`, 17,2 s) |
| `npm run bench` | Verde: 12/12; "Peor caso con estructuras y guardias" media 0,056 ms/tick (p99 0,32 ms) frente a 2 ms (gate) y 0,25 ms (objetivo) |

## Criterios de éxito de la propuesta

| Criterio | Medido | Estado |
|---|---|---|
| 25..35 victorias (bot v3, semillas 1..50) | 27/50 (ADR-0020 addendum y `balance.test.ts` con `WIN_BAND`) | Cumple |
| 0 quietos (mapa generado y vacío) | 0 / 0 | Cumple |
| Mechas por partida > 16,3 | 26,88 (base reproducida 16,30); explosiones 14,64 (base 6,56) | Cumple |
| Lote del bot ≤ 90 s equivalentes en CI | 30,4 s local × 2,8 ≈ 85 s; `BOT_BATCH_TIMEOUT_MS` sigue en 180 s | Cumple (margen estrecho, ver S2) |
| Bench ≤ 0,25 ms | 0,056 ms medido aquí (0,06–0,07 anotado en tasks) | Cumple |
| Objetos del mapa ≤ 1.000 | 695 (42) y 778 (123), test sin navegador en `plan-map-fallback.test.ts` | Cumple |
| Firma de celdas intacta | `MAP_GOLDEN` sin cambios en el diff; `STRUCTURE_GOLDEN` nueva y justificada | Cumple |
| Plazos del quieto (s7 ≤ 4.800) | Primera oferta s7 en tick 2.082 | Cumple |
| Procedencia | `guard:all` verde; 4 hojas con sha256 y bytes coincidentes con los ficheros; todas de Update 010; nota sin Free Pack | Cumple |
| E2E ≤ 2 nuevos o ampliados, manual, sin fps | 1 ampliado ("Mapa real"), `step(n)`, sin `waitForTimeout` nuevo | Cumple |

## Escenario → Test → Estado

259 escenarios únicos en las 11 specs delta. Se cruzó cada título con `tests/` y `src/` (coincidencia literal): 256 localizados con test propio; revisé a mano una muestra de los de azar y orden (`guard-random.test.ts`, `guard-spawning-order.test.ts`, `structure-independence.test.ts`) y comprueban de verdad (contador de llamadas al RNG igual con y sin casa; estado de los 5 guardias; no son tautológicos).

| Escenario | Test | Estado |
|---|---|---|
| Colocar no consume el azar de la partida | `tests/domain/structure/structure-independence.test.ts` | OK |
| Los estados de guardia no consumen azar / Los comportamientos no consumen azar | `tests/domain/enemy/guard-random.test.ts` | OK |
| Nacer no consume azar / Una casa destruida no hace nacer en ese tick / El guardia nacido no se mueve | `tests/domain/structure/guard-spawning-order.test.ts` | OK |
| Objetos del mapa (≤ 1.000, semillas 42 y 123) | `tests/infrastructure/plan-map-fallback.test.ts` | OK |
| Mechas por partida (> 16,3) | `tests/domain/balance.test.ts` | OK |
| Tasa de victoria / Toda partida termina / Quieto pierde / Muerte quieta en 180 s / Plazos | `tests/domain/balance.test.ts` | OK |
| Peor caso con estructuras y guardias | `tests/bench/run.bench.ts` (comprueba 150/150 por estado, `running`, 300 vivos, estructuras intactas, media ≤ 2 ms) | OK |
| Estructuras y guardias en el navegador [E2E] / Objetos dibujados con la cámara [E2E] | `tests/e2e/gameplay.spec.ts` ("Mapa real") | OK |
| Vida por defecto de cada tipo | `tests/infrastructure/content.test.ts` (tabla con 10/25/45/45) y `tests/domain/enemy-catalog.test.ts` | OK (título distinto) |
| El hueco del barril que explota se repone en el mismo tick | `tests/domain/run-hazard-order.test.ts` ("La explosión libera hueco para el director (y se repone en el mismo tick)") | OK (título distinto) |
| Partida con arte | Solo cubría un E2E retirado en `e2e-lite` | Aceptado sin test (e2e-lite) |
| Resto (256 escenarios: goblin-structures, enemy-behavior, enemy-spawning, enemy-hazards, auto-weapons, procedural-map, run-state, simulation-loop, run-outcome, sprite-rendering, asset-provenance) | Prefijo `Scenario:` con el título de la spec en `tests/domain/**`, `tests/infrastructure/**`, `tests/content/**`, `tests/composition/**`, `tests/guardrails/**` | OK |

## Diseño, capas y reglas de AGENTS.md

- Capas y pureza: `guard:all` y ESLint verdes; no hay `Math.random`, `Date.now` ni `performance.now` en los ficheros `src` tocados. `src/domain/structure/*` nuevo, azar solo por `RandomGenerator` con flujo propio `STRUCT_STREAM` 3 en composición.
- Determinismo: los escenarios de "no consume azar" comparan el siguiente valor del generador y el número de llamadas con y sin la funcionalidad; la firma de celdas sigue igual.
- Contenido: `content/structures.json` con `StructuresSchema` estricto en zod; `enemies.json` con el tipo `goblin-tnt-guard` y las clases nuevas en el `discriminatedUnion`.
- TDD por capa (ADR-0018): commits separados por capa y grupo (dominio 1–4, contenido 5, render 6, balance 7, bench/E2E/docs 8). El rojo previo no es verificable a posteriori desde el historial, pero cada grupo trae sus tests en el mismo commit.
- E2E-lite: 1 E2E ampliado, modo manual, sin fps ni tiempo real.

## tasks.md

- Los 8 grupos están marcados `[x]`, con un commit por grupo (8 commits de implementación).
- 7.5, 7.6 y 7.7 figuran `[x]` y anotadas "no aplican" con su justificación (27/50 ≥ 25, firma W3 = 0, nada recalibrado). Condición comprobada: correcta. El bot sigue en v3 y no hay MODIFIED de "Bot de referencia" ni de valores de barril/guardias en las specs.
- Interpretación del bench: la spec dice "300 enemigos vivos … la mitad de ellos en patrulla y la otra mitad en alerta". Leída literalmente, 150 + 150 = los 300 son guardias (8 por casa en su tope y 292 con puesto en las puertas), que es lo que mide el bench. Es la lectura estricta y la más cargada para el camino de guardias; válida.

## Hallazgos

### Critical
Ninguno.

### Warning
Ninguno.

### Suggestion

- **S1 · Bench sin enemigos de persecución ni armas sobre estructuras.** Los 300 vivos son todos guardias indestructibles y el criterio de puntería sobre estructuras (reserva sin enemigos en alcance) apenas se ejercita; la spec dice "las armas con estructuras como objetivo alternativo" y "los enemigos abatidos se reponen", pero el bench los hace indestructibles. Aun así la media (0,056 ms) deja un margen enorme. Aclarar el texto de la spec en un futuro change ("de los que ≥ 1 por casa son guardias" frente a "la mitad de ellos") o mezclar guardias y perseguidores.
- **S2 · Margen del lote del bot.** 30,4 s local ≈ 85 s en CI frente al tope de 90 s: solo 5 s de margen (el paso 1 daba 28,0 s). Vigilar si un change posterior añade trabajo por tick.
- **S3 · Victorias en 27/50.** Dentro de la banda 25–35, a 2 del mínimo (las estructuras cuestan 2 victorias respecto al paso 1). Cualquier change futuro que reste ≥ 3 victorias tendrá que recalibrar.
- **S4 · Estado de ADR-0020.** Sigue "propuesta"; debe pasar a "aceptada" al aprobar este verify (tarea 8.3 lo deja para después, según el plan). No bloquea.
- **S5 · Tareas condicionales.** 7.5–7.7 marcadas `[x]` con "no aplica" mezclan "hecha" y "descartada"; es más claro dejar una nota explícita en cada línea (hoy solo en el bloque de resultados).

Recuento final: C: 0 · W: 0 · S: 5
