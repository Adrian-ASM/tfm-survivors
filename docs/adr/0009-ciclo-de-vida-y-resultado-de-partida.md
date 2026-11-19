# ADR-0009 · Ciclo de vida de la partida: fase con resultado y reinicio por sustitución

- **Estado**: propuesta (change 0006-run-lifecycle-hud)
- **Fecha**: 2026-11-19

## Contexto
Hasta 0005, `RunStatus` era `running | choosing | over`, y `over` solo se alcanzaba con vida 0. En 0006 la partida
puede terminar también por victoria (al llegar a la duración objetivo), y el jugador puede empezar otra sin recargar
la página. Fuerzas:
- Hay mucho escrito sobre el literal `over`: specs (`run-state`, `simulation-loop`), tests, E2E y el probe.
  Renombrarlo cuesta caro y no aporta nada.
- Un resultado separado del estado permite combinaciones inválidas (`over` sin resultado, resultado sin `over`).
- ADR-0003: el snapshot se crea una vez por frame y no se deben añadir asignaciones.
- Hoy hay una sola `Run` por carga, creada en `main.ts`. Las capas de la escena usan pools preasignados que asocian
  hueco ↔ id (ADR-0006), y los ids empiezan en 0 en cada partida.
- AGENTS.md §3.3-4: el núcleo no elige la semilla; solo la composición conoce `Mulberry32RandomGenerator`.

## Opciones
**Resultado**
1. Resultado dentro del estado: `running | choosing | won | lost`. Rompe `over` en todas partes.
2. Estado + campo `outcome` independiente. Rompe poco, pero la invariante solo la protegen los tests.
3. **Fase como unión discriminada** de cuatro valores congelados: `{running, null}`, `{choosing, null}`,
   `{over, won}` y `{over, lost}`. `status` y `outcome` siguen siendo campos distintos.

**Reinicio**
- a. Recargar la página.
- b. `Run.reset()`.
- c. `scene.restart()` de Phaser.
- d. **Caso de uso `RestartRun`** que crea una `Run` nueva con `Run.start` y una semilla nueva de la composición. La
  escena cambia sus referencias y vacía sus capas.

## Decisión
**Resultado: opción 3.** `RunPhase` en `src/domain/run/RunPhase.ts`, con las constantes `RUNNING`, `CHOOSING`, `WON`
y `LOST`. `Run` guarda una sola referencia `phase`, y las transiciones solo pueden asignar una de esas cuatro
constantes, así que la combinación inválida no se puede representar. `RunSnapshot = RunSnapshotBody & RunPhase`
(TypeScript estrecha `outcome` al comprobar `status`). `RunStatus = RunPhase['status']` conserva el literal `over`.
Prioridad dentro del tick: derrota (contacto) > victoria (justo después del contacto) > oferta. La victoria
reutiliza la salida temprana del tick de la muerte: sin gemas, sin director y sin oferta.

**Reinicio: opción d.** `RestartRun` (application) acepta reiniciar solo desde `over` y devuelve un `StartedRun`
nuevo. La composición le inyecta `nextRandom: () => RandomGenerator` (semilla de `crypto.getRandomValues`). La
escena reutiliza pools, HUD y overlays (el mismo contenido da la misma capacidad) y llama a `clear()` en cada capa
antes de pintar la partida nueva, para que un id de la partida nueva no herede el hueco del mismo id de la anterior.

Descartadas:
- (a): mala experiencia y E2E lentos.
- (b): duplica la inicialización de `Run.start` y arriesga dejar estado viejo (director, arsenal, ids, azar).
- (c): recrea todos los objetos del motor y vuelve a registrar las teclas, con riesgo de oyentes duplicados.
  Además, las dependencias de la escena van por constructor.

## Consecuencias
- Positivas:
  - La invariante estado/resultado la comprueba el compilador.
  - Los tests y specs que usan `over` siguen valiendo.
  - El reinicio es exactamente `Run.start`: misma semilla ⇒ misma partida, también tras reiniciar.
  - No se crean objetos del motor al reiniciar.
  - La regla "solo desde `over`" se prueba sin motor.
- Negativas / costes:
  - `RunSnapshot` pasa de `interface` a `type` (intersección con una unión).
  - Las capas ganan un `clear()`.
  - Con `?seed=` el reinicio no repite la semilla (decisión de la proposal); para reproducir una partida reiniciada
    hay que leer `seed` del probe.
- Cómo revertirla:
  - Pasar a la opción 1 es un renombrado mecánico de `RunPhase` y de sus lectores.
  - Cambiar a `scene.restart()` es local a `GameScene` y a `main.ts`: el dominio no cambia.
