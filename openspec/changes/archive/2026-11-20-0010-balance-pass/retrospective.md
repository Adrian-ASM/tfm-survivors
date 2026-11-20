# Retrospectiva · 0010-balance-pass

- **Fechas**: inicio 2026-11-20 → archivado 2026-11-20
- **PR**: #20 (squash `a01f374`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 6 / 6 (4 bloques) |
| Commits (asistidos por IA) | 8 (8) en la rama, fusionados por squash |
| Tests añadidos | +4 unitarios (1165 → 1169) · E2E sin cambios (48) · 11 ficheros de `content`/`tests` tocados, `src/` sin diff |
| Hallazgos verify (C / W / S) | 0 / 2 / 3, sin ronda de correcciones (W1 y W2 pasan a deuda; S3 resuelta al archivar) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 4 rondas de medición previas (línea base de 100 semillas, sensibilidad, compatibilidad con "quieto < 180 s" y variantes monótonas) y 2 gates con preguntas |

## Qué fue bien
- **Medir antes de proponer** (lección de 0006) funcionó: el orquestador lanzó un test temporal no versionado
  (35–190 ms por partida) antes de *propose*. Así se vio que la política de elección del bot multiplica por 7 la
  tasa de victorias y que el bot de "opción 0" no sirve como referencia de dificultad.
- **Cada objetivo nuevo se volvió a medir**: el usuario añadió en el gate "quieto < 180 s", y el candidato inicial
  (suavizar desde 60 s) lo rompía. Una medición de 2 min llevó a suavizar desde 180 s.
- **Contraste entre spec y design en paralelo**: el spec-writer y el architect detectaron a la vez que ×0,7 desde
  180 s rompía la monotonía del presupuesto (`enemy-spawning`). Una tercera medición lo resolvió: ×0,8 desde 300 s
  dio 30/50 en el centro de la banda, y apply no necesitó el plan B.
- Al no tocar nada anterior a 300 s, los plazos archivados (semillas 7 y 42, pulso) quedaron idénticos y no hubo
  deltas de otras specs.
- Verify sin críticos a la primera: no hizo falta ronda de correcciones.

## Qué fue mal / dónde falló la IA
- **El architect propuso un factor sin medir** (×0,8 desde 180 s, "28–30 por interpolación"). La medición dio
  24/50, fuera de la banda. Se corrigió antes de *tasks*, pero confirma que interpolar la tasa no vale: no es
  monótona.
- **El spec-writer metió un escenario que probaba el propio test** ("Límites de la banda"). El orquestador lo
  quitó a petición del architect.
- **Heredoc reincidente**: el implementer intentó escribir con un heredoc de Python, se colgó y no llegó a
  escribir nada (está en `docs/ai-log/2026-11-20-0010-apply.md`). El orquestador también usó heredocs para
  mensajes de commit y de PR, aunque no para código ni JSON.
- **Worktree de la app**: la sesión se abrió en `.claude/worktrees/migracion-formato-code-4b86d6`, con la rama
  `claude/balance-pass-0010-728ca5` por detrás de `main`. Hubo que avanzarla y renombrarla a mano.

## Desviaciones respecto a spec o diseño
- Ninguna en apply. Antes de *tasks*, el design cambió la palanca de "×0,7 desde 180 s" a "×0,8 desde 300 s" con
  datos medidos.
- El escenario de `simulation-loop` pasó de la semilla 90 a la 7 (del conjunto), no a la 42, para mantener dos
  semillas distintas en la equivalencia de velocidades.

## Lecciones → acciones
- Interpolar una tasa de victorias no es fiable (es ruidosa y no monótona) → el `sdd-architect` no debe fijar un
  factor de contenido sin medirlo. Añadirlo a las reglas de la skill `sdd-workflow` §3 "Mediciones previas"
  (pendiente de PR de acciones).
- El test temporal de medición (`tmp-measure`) se escribió dos veces (orquestador e implementer) → versionar un
  script de medición de balance (`npm run balance`, fuera de `verify`) que reciba variantes y estrategias, para el
  próximo change que toque `content/`. Encaja con la deuda 0010 · W2.
- El script de fusión de specs se ha usado por tercera vez (0008, 0009 y 0010), de nuevo en un solo uso fuera del
  repo y esta vez con los finales de línea preservados → versionarlo en `scripts/` (sigue pendiente desde 0009).
- Heredocs: 4.º change seguido → reforzar la regla en las instrucciones del `sdd-implementer` (pendiente desde 0009).
