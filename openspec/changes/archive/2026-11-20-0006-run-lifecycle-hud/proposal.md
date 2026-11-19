# Proposal · 0006-run-lifecycle-hud

- **Estado**: aprobada (2026-11-19, gate humano; detalles por confirmar aceptados con sus valores propuestos)
- **Issue**: — (opcional)
- **Rama / worktree**: `change/0006-run-lifecycle-hud`
- **Depende de**: 0005-xp-and-level-up (archivado el 2026-11-19).
- **Exploración**: `openspec/changes/0006-run-lifecycle-hud/exploration.md`

## Problema
Hoy la partida no tiene final ni meta. No hay temporizador: el jugador no sabe cuánto le queda ni puede ganar, y la
única salida es morir. Al morir la escena se queda congelada sin explicar qué ha pasado ni cómo volver a jugar (hay
que recargar la página). El HUD solo muestra la barra de XP: la vida, el tiempo y las bajas no se ven. El GDD marca
como Must "temporizador, victoria y derrota" y "HUD", y la pantalla de resultados con "tiempo, nivel y enemigos
eliminados". Sin esto no hay bucle jugable completo (jugar, terminar, volver a jugar).

## Objetivo
La partida dura un tiempo objetivo de **600 s** (36.000 ticks), definido en contenido. Si el jugador llega vivo al
final, **gana**; si su vida llega a 0 antes, **pierde**. En ambos casos la simulación se congela y aparece, en la
misma escena, un overlay de resultados con el resultado, el tiempo sobrevivido, el nivel alcanzado y las bajas. Con
una tecla se empieza una partida nueva sin recargar. Durante la partida un HUD muestra la vida (barra y número), el
tiempo restante en mm:ss, el nivel/XP y las bajas. Todo sigue siendo determinista: misma semilla y mismos inputs
dan el mismo resultado en el mismo tick.

## Alcance

### Dentro
- **Duración objetivo en contenido**: campo nuevo (p. ej. `durationSeconds: 600` en un fichero de contenido de
  partida; el fichero concreto lo decide el design), validado con zod (entero positivo) y convertido a ticks con
  `TICK_SECONDS`. Sin números mágicos en código. El tiempo de partida **es el número de ticks simulados**: no avanza
  durante `choosing` ni tras terminar.
- **Resultado de la partida (opción B de la exploración)**: se mantiene el estado `over` y se añade un resultado
  ortogonal `won | lost`. Invariante: el resultado está definido si y solo si el estado es `over`.
  - **Derrota**: la vida del jugador llega a 0 (el comportamiento actual de `over`) ⇒ `over` + `lost`.
  - **Victoria**: el jugador sigue vivo al completar el tick en que el tiempo simulado alcanza la duración objetivo
    (tick 36.000 con 600 s) ⇒ `over` + `won`.
  - **Muerte y victoria en el mismo tick: gana la derrota** (`lost`).
  - **Victoria y subida de nivel en el mismo tick**: gana la victoria; no se abre oferta de mejoras (misma regla que
    la muerte en 0005).
  - `over` sigue siendo irreversible y congela todo (sin ticks, sin azar, input ignorado), tanto en victoria como en
    derrota.
- **Contador de bajas** de la partida: cuenta los enemigos abatidos (cada baja que hoy suelta gema suma 1). Empieza
  en 0, no se reinicia al subir de nivel y se congela con `over`.
- **Snapshot ampliado**: resultado (`won | lost | null`), duración objetivo (en ticks o segundos, lo fija el design)
  y bajas. Vida, nivel, XP y tick ya existen.
- **Reinicio**: en estado `over`, una tecla (propuesta: `R` o `Enter`) crea una partida nueva desde cero (tick 0,
  vida máxima base, nivel 1, 0 XP, 0 bajas, sin enemigos, gemas ni proyectiles, mejoras a nivel 0). Fuera de `over`
  la tecla no hace nada. La semilla de la partida nueva la elige la composición (no el dominio).
- **HUD** (vista Phaser, en la misma escena o en una escena paralela: lo decide el design):
  - Vida: barra y número `actual/máxima`.
  - Tiempo restante en `mm:ss` (muestra `10:00` al empezar y `00:00` al ganar; el redondeo exacto lo fija la spec).
  - Nivel y XP (la `XpBar` de 0005 se integra en el HUD).
  - Bajas.
  - Lógica de formato pura (mm:ss, fracción de vida) testeable sin motor, siguiendo el patrón de `xpBarFill.ts`.
- **Overlay de resultados**: título según resultado (victoria/derrota), tiempo sobrevivido (mm:ss), nivel alcanzado,
  bajas y la indicación de la tecla de reinicio.
- **Tests**:
  - Unitarios de dominio: victoria al alcanzar la duración, derrota antes de la duración, empate muerte/victoria
    (gana la derrota), victoria con subida de nivel en el mismo tick, congelado tras `over` en ambos resultados,
    invariante estado/resultado, contador de bajas, determinismo del resultado.
  - Unitarios de la lógica pura del HUD y de la validación del contenido de duración.
  - **E2E de derrota**: el jugador muere, aparece el overlay de resultados con "derrota", se pulsa la tecla y empieza
    una partida nueva en `running`.
  - **Sin E2E de 10 minutos reales**: la victoria se prueba solo en unitarios.
- **Medición de equilibrio** al inicio de apply: comprobar con una simulación sin motor que la partida de 600 s es
  ganable con el contenido actual (ver Riesgos).

### Fuera
- Pausa manual con Esc (estado `paused`): diferida.
- Menú de inicio, guardado y exportar/importar (0007), meta-progresión entre partidas, jefe final.
- E2E de victoria y cualquier parámetro de URL o contenido de test para acortar la duración en el juego real.
- Elegir dificultad o duración desde la interfaz; récords o historial de partidas.
- Nuevos tramos de oleadas, enemigos, armas o mejoras (salvo el ajuste mínimo de contenido que exija la medición de
  equilibrio para que la partida sea ganable).
- Audio, animaciones, partículas y transiciones del overlay; inventario de mejoras en el HUD.

## Capacidades afectadas
- `openspec/specs/run-outcome` (nueva): duración objetivo en contenido, tiempo de partida por ticks, victoria,
  derrota, empate (gana la derrota), victoria frente a subida de nivel, invariante estado/resultado, bajas.
- `openspec/specs/hud` (nueva): qué muestra el HUD, formatos (mm:ss, vida, bajas) y cuándo se actualiza.
- `openspec/specs/run-results` (nueva): overlay de resultados y reinicio con tecla.
- `openspec/specs/run-state` (modificada): `over` con resultado `won | lost`; transición `running → over` también por
  victoria; congelado idéntico en ambos casos; prioridad derrota > victoria > oferta.
- `openspec/specs/simulation-loop` (modificada): comprobación de victoria en el orden del tick, snapshot ampliado
  (resultado, duración, bajas), determinismo del resultado.
- `openspec/specs/player-health` (modificada, menor): vida 0 pasa a "derrota" (`over` + `lost`).
- `openspec/specs/enemy-spawning` / `enemy-behavior` (modificadas si hace falta): escenarios de 36.000 ticks o más
  que ahora terminan por victoria; revisar sus GIVEN.

## Riesgos y dudas
- **Ganable con el contenido actual**: un jugador quieto muere a los 16-70 s; no está medido que un jugador que se
  mueve y elige mejoras llegue a 600 s. `waves.json` llega al tramo de 480 s con 7 enemigos/s. Si la medición dice
  que no es ganable, hay que ajustar contenido en este change (y registrarlo) o revisar la duración en el gate.
- **Escenarios largos existentes**: los de 36.000 ticks (`simulation-loop`, `enemy-spawning`, `long-run.test.ts`)
  terminarán ahora por victoria en el tick 36.000; los que miden más allá deben acotarse o usar una duración mayor
  en su contenido de test (lección de 0003 W1).
- **Reinicio**: hoy hay una sola `Run` por carga y la composición la crea una vez en `main.ts`; reiniciar exige
  rehacer la partida y limpiar las capas de sprites (pools) sin fugas ni sprites huérfanos.
- **Invariante `over`/resultado** (opción B): combinación inválida posible (`over` sin resultado o resultado sin
  `over`); hay que blindarla en el modelo y con tests.
- **Deuda**: `Run.ts` ya supera 300 líneas; el temporizador, el resultado y las bajas empujan a extraer piezas.
  `snapshot()` asigna por frame (S5) y crece con los campos nuevos.
- E2E existentes que comprueban `status !== 'over'` (`health.spec.ts`) y el probe `window.__sprint` deben seguir
  válidos con el reinicio.
- ADR candidato: modelo de resultado de partida (estado + resultado ortogonal) y ciclo de vida de la partida con
  reinicio.

## Decisiones por confirmar (defaults propuestos, revisar en el gate)
1. **Tecla de reinicio**: `R` (alternativa: `Enter`, o ambas).
2. **Momento de la victoria**: al completar el tick en que el tiempo simulado alcanza la duración (tick 36.000), tras
   resolver contactos; la derrota de ese mismo tick tiene prioridad.
3. **Victoria y subida de nivel en el mismo tick**: gana la victoria, sin oferta.
4. **Tiempo restante en el HUD**: segundos restantes redondeados hacia arriba (se ve `10:00` en el tick 0 y `00:00`
   solo al ganar).
5. **Semilla de la partida reiniciada**: la elige la composición (nueva en cada reinicio).

## Criterio de éxito
- Todos los escenarios de las specs nuevas y modificadas en verde con `npm run verify`.
- Test de dominio: con vida suficiente y la duración de contenido (600 s), la partida pasa a `over` + `won`
  exactamente en el tick 36.000 y no antes; con vida 0 en un tick < 36.000 pasa a `over` + `lost`; con muerte en el
  tick 36.000 el resultado es `lost`.
- Test de congelado: N ticks solicitados tras `over` (en ambos resultados) no cambian el snapshot ni consumen azar.
- Test de determinismo: misma semilla + mismos inputs + mismas elecciones ⇒ mismo resultado, en el mismo tick y con
  las mismas bajas.
- **Ganabilidad medida**: al menos una simulación sin motor con el contenido real y un input/elecciones
  reproducibles llega viva al tick 36.000 (resultado `won`); la semilla y la estrategia quedan documentadas.
- E2E de derrota en verde: muerte → overlay con resultado de derrota, tiempo, nivel y bajas → tecla de reinicio →
  partida nueva en `running` con tick, bajas y XP a 0.
- Duración objetivo 100 % en `content/*.json` validada con zod; sin números mágicos ni dependencias nuevas.
