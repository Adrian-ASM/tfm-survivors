# Retrospectiva · 0003-collisions-and-damage

- **Fechas**: inicio 2026-11-19 → archivado 2026-11-19
- **PR**: pendiente de abrir (rama `change/0003-collisions-and-damage`, sin push al archivar)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 29 / 29 (bloques 1 a 12) |
| Commits (asistidos por IA) | 17 (17), incluido el de archivado; 16 sobre `a22b5e3` antes de archivar |
| Tests añadidos | 130 unitarios (263 → 393, 26 → 32 ficheros) + 1 E2E (3 → 4) |
| Hallazgos verify (C / W / S) | 0 / 2 / 8 (los 2 Warning resueltos antes de archivar; quedan 5 Suggestions abiertas: S4-S8) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / sin ejecutar (sin push); hooks de agente posiblemente inactivos (ver abajo) |
| Iteraciones de prompt relevantes | 1 ampliación del alcance tras la prueba manual (parpadeo, bloque 12); 2 correcciones de spec tras el verify (W1, W2) |
| Benchmark `Run.tick` (200 vivos) | media 0,0078 ms, p99 0,0121 ms (umbral 2 ms); con 200 encima del jugador: media 0,0056 ms, p99 0,0078 ms |

## Qué fue bien
- El orden del tick (jugador → persecución → contacto → director → contador) quedó fijado en el design y el
  verifier lo comprobó contra `Run.tick` sin discrepancias.
- Los tests de contacto, bajas y fin de partida llevan partida de control o contador de azar, y el verifier
  no encontró ningún test tautológico (la lección de 0002 sobre W1 se aplicó).
- La capa de dominio siguió pura: `guard:all` y ESLint en verde en todo el change, sin números mágicos.
- Rendimiento: con 200 enemigos encima del jugador el tick sigue unas 250 veces por debajo del umbral.
- El hallazgo W2 se cerró con un test que prueba la esquiva de verdad (el jugador que huye conserva la vida)
  junto con su control quieto, que sí recibe daño.

## Qué fue mal / dónde falló la IA
- **Sesión de orquestador abierta fuera del repo**: los subagentes del proyecto (`.claude/agents/`) no se
  cargaron y se usaron agentes generales a los que se pasaron las definiciones y los modelos de cada rol.
  Es posible que los hooks de agente no estuvieran activos durante la sesión, de modo que los únicos
  guardarraíles que se sabe que actuaron son husky y la CI local (`npm run verify`). No hay constancia de
  bloqueos de hook, ni a favor ni en contra.
- **Parpadeo añadido tras la prueba manual (bloque 12)**: al probar a mano, el usuario no podía observar el
  daño (la invulnerabilidad no tenía ninguna señal visual) y se amplió el change con el requisito
  "Indicación visual de invulnerabilidad", su design y las tareas 12.1-12.2. El alcance real superó al de la
  propuesta; la necesidad de feedback visual del daño no se detectó al proponer.
- **W1 (verifier)**: los escenarios largos de `enemy-spawning` y `enemy-behavior` suponían una partida de
  36.000 ticks con el jugador vivo, pero con la vida por defecto un jugador quieto muere hacia el segundo 16.
  Los tests ya usaban `LONG_RUN_HEALTH`; las specs no lo decían. Se corrigieron las specs.
- **W2 (verifier)**: ningún test probaba la esquiva (huir y no recibir daño), y la prueba manual en el
  navegador no fue concluyente (pestaña en segundo plano, unos 40 ticks en 30 s). Se añadieron dos tests
  automáticos; la comprobación manual de esquiva queda a cargo del usuario.
- `tasks.md` y `design.md` no recogían dos desviaciones del apply (7.1 adelantada, `EnemyLayer.sync` en tres
  pasadas); se anotaron a posteriori (S1, S2).

## Desviaciones respecto a spec o diseño
- 7.1 adelantada al bloque 1 (sin ella `loadRunConfig` no compilaba al ampliar `RunConfig`).
- 5.1 y "Cambio de tramo" pasados a `LONG_RUN_HEALTH` (con la vida por defecto el tramo 2 no llega).
- `EnemyLayer.sync` en tres pasadas: con `capacity = maxAlive`, asignar antes de liberar dejaba sin hueco a
  las reposiciones del mismo frame; registrado en ADR-0006.
- `EnemyCatalog.mostExpensive` (API pública mínima) para el mensaje `MAX_BUDGET_BELOW_MAX_COST`.
- Getter `hp` en `Enemy` sobre un campo privado `life` (TypeScript no admite ambos con el mismo nombre).
- Bloque 12 (parpadeo) añadido tras el gate de la propuesta: regla de vista en
  `src/infrastructure/phaser/playerBlink.ts`, sin tocar `domain` ni `application`.

## Lecciones → acciones
- Una prueba manual con el usuario puede revelar necesidades de feedback no previstas → en la plantilla de la
  propuesta, añadir la pregunta "¿cómo observa el usuario este comportamiento en el juego?" para cada regla
  invisible (daño, invulnerabilidad, muerte).
- Los escenarios de spec que dependen de que la partida siga en curso deben declarar la vida/condición
  necesaria → en la skill `spec-writer`, comprobar cada escenario largo contra el contenido por defecto.
- Sesiones de orquestador abiertas fuera del repo no cargan subagentes ni, posiblemente, hooks de agente →
  abrir siempre la sesión desde el repo (o documentar en AGENTS.md cómo cargar `.claude/agents/`) y, si no
  se hace, anotarlo en el diario del change.
- Los comportamientos que el usuario debe ver y que aún no tienen E2E (cableado de `GameScene.render`, S7;
  derrota, S6) → valorar un E2E cuando llegue la pantalla de derrota (0006).
- Pendientes de 0003 para changes futuros: S4 (`damageEnemy` O(n), solo tests, resolver en 0004 con
  `removeDead()` una vez por tick), S5 (`Run.snapshot()` asigna ~200 objetos por frame, vigilar con
  proyectiles en 0004), S8 (`determinism.test.ts` importa `playerBlink` de infraestructura; mantenerlo como
  único caso) y la prueba manual de esquiva en el navegador.
