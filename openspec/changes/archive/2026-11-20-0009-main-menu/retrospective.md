# Retrospectiva · 0009-main-menu

- **Fechas**: inicio 2026-11-20 → archivado 2026-11-20
- **PR**: #18 (squash `a3129de`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 15 / 15 (5 bloques; dominio sin tareas) |
| Commits (asistidos por IA) | 18 (18) en la rama, fusionados por squash |
| Tests añadidos | +76 unitarios (1083 → 1159) · +32 E2E (16 → 48) · 42 ficheros de `src`/`tests` tocados |
| Hallazgos verify (C / W / S) | 1 / 7 / 4 → tras una ronda de correcciones 0 / 3 / 1 (W1, W2, W6 parcial y S5 como deuda) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 3 (4 preguntas de alcance tras explore; 3 respuestas al gate de propose; contraste design ↔ specs antes de tasks) |

## Qué fue bien
- **Preguntas de alcance antes de proponer**: las 5 preguntas abiertas de la exploración se resolvieron con el usuario
  (escena Phaser, `?e2e` salta el menú, Esc solo en partida, export en ambos sitios, 0006 · W2 fuera) y la propuesta
  pasó el gate a la primera con 3 decisiones menores.
- **Contraste final del design** (regla añadida tras 0006): al pedir tasks se pasaron al arquitecto los 5 choques con
  las specs (sobrante del acumulador, textos del borrado, Esc en el diálogo, flag `menu`, doble clic). Los resolvió
  antes de descomponer; no hubo que reabrir el design durante apply.
- **Núcleo intacto**: `src/domain` sin diff; la pausa vive en `PauseGate` (adaptador puro probado en Node) y
  `application` solo gana `TickRun.discardPending()` y `ProgressRepository.clear()`.
- Los 9 specs E2E previos siguieron en verde sin tocar sus `goto` gracias al orden de escenas `[game, menu]` con `?e2e`.
- Re-verify acotado al diff de la ronda (`8a7f52d..HEAD`): 5 herramientas y ~2 min frente a ~5 min del verify completo.

## Qué fue mal / dónde falló la IA
- **Critical por escenario sin test** (C1 "Primer frame tras Jugar"): la garantía era estructural y el implementador
  no escribió el test. Igual que W3–W5: tests que pasaban a la primera porque el código ya era correcto; el
  implementador mutó el código temporalmente para demostrar que detectan la regresión.
- **Heredocs pese a AGENTS.md §8.1**: el implementador escribió ficheros con heredoc; no hubo corrupción (sin `\`),
  quedó en `docs/ai-log/2026-11-20-0009-apply.md`. El orquestador también usó un heredoc para un mensaje de commit.
- **Specs muy largas** (22 requisitos, 129 escenarios): parte no es observable en navegador (HUD, sprites), y eso
  generó W1/W2 que se aceptaron como deuda. El spec-writer escribió escenarios que el diseño no podía probar sin
  ampliar la sonda.
- **Diferencia de finales de línea** al fusionar: el script de fusión escribió LF sobre specs vivas en CRLF; se
  restauró antes del commit.

## Desviaciones respecto a spec o diseño
- `clear()` mínimo adelantado a 2.2 (lo exigían contrato y typecheck); la distinción `unavailable`/`failed` llegó en 3.1.
- `createRunLauncher` con objeto de opciones y `onContentError`; claves de escena en `sceneKeys.ts`.
- Se quitó el flag `?e2e&menu` del primer design: la spec exige que `?e2e` salte siempre el menú al cargar.
- La sonda cuenta en `runs` también los reinicios con R.
- La partida abandonada del test de Node para en el tick 4.500 (no 5.000): la semilla 42 sin input pierde en 4.682.

## Lecciones → acciones
- Un escenario con garantía "estructural" sigue necesitando test → el `sdd-verifier` ya lo caza; añadir al encargo
  del `sdd-implementer` "cada escenario de la spec tiene al menos un test que lo nombra" (pendiente de PR de acciones).
- Escenarios no observables en la capa que pide la spec → el `sdd-spec-writer` debe marcar en cada escenario la capa
  de prueba (Node / E2E con sonda / E2E sin sonda) para que el architect detecte antes los que no se pueden probar.
- Heredocs reincidentes (0008 diario, 0009 apply) → reforzar en el frontmatter/instrucciones del `sdd-implementer`
  la regla de §8.1, no solo en AGENTS.md.
- Script de fusión de specs reutilizado (0008, 0009) → si se repite en 0010, versionarlo en `scripts/` con
  preservación de finales de línea.
