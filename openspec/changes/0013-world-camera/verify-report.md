# Verify report · 0013-world-camera

HEAD `ede4721`. Verificador independiente (no escribió el código).

## Ejecución
- `npm run verify`: verde. guard 574 ficheros, 127 ficheros / 1436 tests unitarios.
- `npm run test:e2e -- camera sprites enemies hud`: 18/18 en verde (2 workers, sin CI_LIKE). No hay spec `hud` aparte: HUD y overlays se cubren en `camera.spec` ("HUD y overlays con la cámara movida"). Una sola pasada, por la restricción de máquina.
- Capas: sin imports de motor/infra/composición en `domain` y `application`; `CameraRig` en infraestructura; el mundo sale de `content/arena.json` y no hay 960/540 en `src`; `single-arena-source.test.ts` lo vigila en los tests.
- Commits: los 21 llevan `refs: 0013-world-camera` y `Assisted-by`.

## Escenarios → Test → Estado (resumen por spec)

| Spec delta | Test que lo cubre | Estado |
|---|---|---|
| world-camera: contenido por defecto, mundo < / = vista, dimensiones no positivas | `content.test.ts`, `content-boot.test.ts` | OK |
| world-camera: centro, cuatro esquinas, límite de recorte, un solo eje, sin retraso, mundo = vista, con y sin pintar | `camera-rig.test.ts` | OK |
| world-camera: rectángulo coherente, nada fuera del mundo, esquinas, enemigo a la derecha, jugador junto a esquina | `camera.spec.ts` | OK |
| world-camera: partida nueva tras acabar en una esquina (R y Volver al menú) | `camera.spec.ts` | OK, ver W1 |
| world-camera: HUD, cartas, pausa y resultados con la cámara movida | `hud.test.ts`, `camera.spec.ts` | OK |
| sprite-rendering: fondo en el mundo entero, cuatro esquinas, reserva | `ground-view.test.ts`, `sprites.spec.ts` | OK |
| enemy-spawning: arena mayor / igual que la vista, esquinas, sin posición válida, presupuesto, partida larga | `place-spawn.test.ts`, `run-spawning.test.ts`, `long-run.test.ts` | OK |
| enemy-spawning: fuera de pantalla en una partida real | `enemies.spec.ts` | OK |
| player-movement / enemy-behavior (bordes, esquinas, persecución, partida larga) | `player.test.ts`, `enemy.test.ts`, `long-run.test.ts` | OK |
| run-outcome: bot huye de paredes, arena única, banda 25..35, 180 s | `policies.test.ts`, `balance.test.ts`, `single-arena-source.test.ts`, `results.spec.ts` | OK (25/50 en el límite, decisión del usuario) |
| simulation-loop: contacto con cualquier mundo, peor caso, tope | `piled-contact.test.ts`, `run.bench.ts` | OK |
| simulation-loop: partida con progresión reproducible (4.800) | `determinism-progression.test.ts` | OK |
| simulation-loop: partida con armas reproducible (3.600) | `determinism-progression.test.ts` | Parcial, ver W2 |
| upgrades: textos, sin textos viejos, ids y números, carta, misma partida | `upgrades-text.test.ts`, `upgrade-overlay.test.ts`, `upgrades-rename-determinism.test.ts` | OK |
| auto-weapons: plazo del pulso a 4.800 | `balance.test.ts` | OK |

## Hallazgos

### Critical
Ninguno.

### Warning
- **W1**: la spec "Partida nueva tras acabar en una esquina" pide el **tick 0** de la partida nueva. `camera.spec` acepta el primer frame con tick ≤ 60 (`FRESH_MAX_TICKS`), porque la máquina cargada llegaba a más de 8 ticks. La posición (960, 540) y la cámara (480, 270) siguen exactas, y con el jugador quieto no se pierde cobertura real. Aun así es una relajación respecto al texto: alinear la spec con "primer segundo" o registrarlo como deuda.
- **W2**: "Partida con armas reproducible" mantiene 3.600 ticks, pero con el mundo 2x el primer pulso llega en el tick 4.161. La spec dice que los snapshots incluyen pulsos, y el test ya no ejercita ningún pulso (solo proyectiles con enemigos dañados). Es una desviación anotada en el diario, pero la spec y el test no coinciden. Subir el plazo a 4.800 en la spec, como se hizo con la progresión, o añadir un caso con pulso.
- **W3**: la tarea 5.1 y la parte CI_LIKE de la 6.2 quedan sin marcar (aplazadas a 0014 por decisión del usuario). No hay validación CI_LIKE del sprite-rendering "Fondo en las cuatro esquinas" frente a intermitencias, ni del `roundPixels` (R4). Debe registrarse como deuda en 0014 al archivar.

### Suggestion
- **S1**: `fixtures`: `camera.spec` repite el patrón `pauseWhileRunning`. Si 0014 toca los E2E, moverlo a `probe.ts`.
- **S2**: el diario menciona que Playwright exige `with { type: 'json' }` al importar `arena.json`. Dejar la nota en el design para futuros specs.

C: 0 · W: 3 · S: 2
