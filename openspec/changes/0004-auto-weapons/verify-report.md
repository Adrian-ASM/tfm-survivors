# Verify report · 0004-auto-weapons

Verificador independiente (`sdd-verifier`). Rama `change/0004-auto-weapons`, 34 commits sobre `origin/main`.

## Ejecución

| Comando | Resultado |
|---|---|
| `npm run verify` | OK: lint, typecheck, `guard:all` (221 ficheros), 44 ficheros y 531 tests en verde |
| `npm run test:e2e` | OK: 5 de 5 (armas con `?seed=7` en 3,4 s; primer golpe con `?seed=42` en 1,1 min, dentro de 80 s) |
| `npm run bench` | OK: 200 vivos con input 0,0096 ms; 200 encima 0,0057 ms; peor caso con 32 proyectiles 0,143 ms (p99 0,169); snapshot 0,0047 ms. Todos muy por debajo de 2 ms |

## Hallazgos

### Critical
Ninguno.

### Warning
Ninguno.

### Suggestion
1. `design.md` conserva en su cuerpo los plazos originales (primer golpe ≤ 3.600 ticks / 60 s, "sin medir"). Quedan
   corregidos en la sección "Desviaciones del apply" y en la spec delta, así que no hay contradicción abierta,
   pero conviene no copiar esos números al archivar.
2. El bench no usa una variable de entorno: `BENCH_HEALTH = 1e9` es una constante del fichero (el comando
   `BENCH_HEALTH=1e9 npm run bench` no cambia nada). Mide lo que pide la spec: armas por defecto activas, 200 vivos
   y `status === 'running'` comprobados, y 32 proyectiles en todos los ticks verificados con una partida gemela.
   La vida de los enemigos se sustituye por una constante precisamente para que el tope no se vacíe.
3. `docs/ai-log/2026-11-19-0004-apply.md` es veraz: 531 tests (+138 sobre 393), 5 E2E, mediciones de equilibrio
   coherentes con los tests y con la spec ajustada, y las desviaciones coinciden con las de `design.md`. Las cifras
   del bench difieren en milésimas de las de esta ejecución (peor caso 0,124 frente a 0,143 ms), variación normal
   de máquina. Una escritura fuera del alcance del implementer, con precedente de 0003 y pedida por la tarea 8.4.
4. Varios escenarios heredados de 0003 se prueban con tests de nombre descriptivo propio y no con el prefijo
   `Scenario:` (p. ej. "Una baja libera el hueco antes del director" mediante "Reposición en el mismo tick").
   Los 81 escenarios únicos tienen test; unificar el prefijo facilitaría la trazabilidad.

## Escenario → Test → Estado

| Escenario (spec delta) | Test | Estado |
|---|---|---|
| auto-weapons (contenido, 8 escenarios) | `tests/infrastructure/weapons-content.test.ts`, `tests/domain/weapon-type.test.ts`, `tests/domain/run-config.test.ts` | Cubierto |
| Armas equipadas al inicio, Disparo en el tick 1 | `tests/domain/run-weapons.test.ts`, `tests/domain/weapon-loadout.test.ts`, `tests/domain/run.test.ts` | Cubierto |
| Cadencia y retención de carga (4) | `tests/domain/weapon.test.ts`, `tests/domain/arsenal.test.ts`, `tests/domain/run-weapons.test.ts` | Cubierto |
| Objetivo más cercano en alcance (4) | `tests/domain/targeting.test.ts` | Cubierto |
| Proyectiles y tope (6) | `tests/domain/projectile.test.ts`, `tests/domain/arsenal.test.ts` | Cubierto |
| Pulso de área (3) | `tests/domain/arsenal.test.ts`, `tests/domain/run-weapons.test.ts` | Cubierto |
| Daño acumulado y bajas (7) | `tests/domain/run-damage.test.ts`, `tests/domain/run-removal.test.ts` | Cubierto |
| Indicación visual (4) | `tests/infrastructure/enemy-layer.test.ts`, `projectile-layer.test.ts`, `pulse-layer.test.ts` | Cubierto |
| Armas observables (núcleo / navegador) | `tests/domain/balance.test.ts`, `tests/e2e/weapons.spec.ts` | Cubierto |
| enemy-behavior (2) | `tests/domain/run-damage.test.ts`, `tests/domain/run-removal.test.ts` | Cubierto |
| enemy-spawning (vida, daño, ids; 8) | `tests/domain/enemy.test.ts`, `tests/domain/run-removal.test.ts` | Cubierto |
| player-health (núcleo / navegador) | `tests/domain/balance.test.ts` (4.800 ticks), `tests/e2e/health.spec.ts` (80 s) | Cubierto |
| run-state (4) | `tests/domain/run-state.test.ts` | Cubierto |
| simulation-loop: orden del tick (6) | `tests/domain/run-contact.test.ts`, `run-removal.test.ts`, `run-weapons.test.ts` | Cubierto |
| simulation-loop: snapshot (10) | `tests/domain/run.test.ts`, `run-weapons.test.ts`, `run-removal.test.ts` | Cubierto |
| simulation-loop: determinismo (6, incl. contactos en 4.800 y armas) | `tests/domain/determinism.test.ts`, `long-run.test.ts` | Cubierto |
| simulation-loop: rendimiento (3) | `tests/bench/run.bench.ts` | Cubierto (≤ 2 ms con margen de 14 veces) |

## Contraste con diseño y reglas

- `tasks.md`: 32 casillas marcadas, 0 pendientes. 34 commits, todos con `Assisted-by`.
- Capas (AGENTS.md §3): `domain` sin `Math.random`, `Date.now` ni `performance.now`; `guard:all` y ESLint en verde.
  Contenido de armas en `content/*.json` validado por zod (`schemas.ts`); sin números mágicos detectados.
- ADR-0007 existe y coincide con el modelo de uniones discriminadas implementado. Desviaciones del apply
  (`readyIn` omitido, `launch` posicional, `SceneCapacity.visualTicks`, mensajes en `schemas.ts`) documentadas.
- Plazos de equilibrio relajados (≤ 4.800 ticks, ≤ 80 s, pulso ≤ 1.800) alineados entre spec, tests y E2E.

C: 0 · W: 0 · S: 4

Veredicto: APTO para archivar.
