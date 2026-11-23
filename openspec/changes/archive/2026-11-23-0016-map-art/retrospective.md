# Retrospectiva · 0016-map-art

- **Fechas**: inicio 2026-11-23 → archivado 2026-11-23
- **PR**: #39 (squash `d1884d7`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 27 / 27 casillas de `tasks.md` (bloques 1–7, con la puerta visual 5.1) |
| Commits (asistidos por IA) | 29 (29) en la rama, fusionados en squash |
| Tests añadidos | ~144 casos (`it`/`test`) nuevos en el diff; unitarios de 1.719 (main tras 0015) a 1.859; E2E `logic` 12/12 sin tests nuevos (3 ampliados) y 1 `@realtime` nuevo |
| Hallazgos verify (C / W / S) | 0 / 3 / 3 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 1 (pre-commit: un `any` en un test) / 0 (CI del PR: `quality` y `e2e` en verde a la primera) |
| Iteraciones de prompt relevantes | 1 `sdd-explorer`, 1 `sdd-implementer` de mediciones previas, 3 `sdd-spec-writer` (propose, spec, ajuste de orilla) + 1 para fusionar specs vivas, 3 `sdd-architect` (design, contraste + tasks, ajuste de orilla), 1 `game-designer` (GDD), 2 rondas del `sdd-implementer` de apply (hasta la puerta visual y resto), 1 `sdd-verifier` |

Balance final con castillo sólido y `player.speed` 215: 27/50 y ningún quieto vivo a 180 s (máx. tick 5.613).
Objetos del mapa: 196 (semilla 42), 245 (123), máximo 258 en 1..50 (tope 300). fps `@realtime` con `CI_LIKE=1` en
el PC local: 32,9 / 27,6 (informativo).

## Qué fue bien
- **Mediciones previas con prototipo de tres opciones de render** antes de propose: la tabla de fps y objetos llevó
  al usuario a elegir C (espuma animada) con datos, y la medición del castillo sólido (24/50 con 210, 28/50 con 215)
  fijó la velocidad antes del apply. El punto de control de balance cayó en banda a la primera (27/50).
- **Lección de 0015 aplicada**: nada de capa del tamaño del mundo con transparencia; el CI del PR pasó sin
  incidencias de fps.
- **Puerta visual como gate intermedio**: el usuario aprobó capturas de 4 semillas antes de E2E y docs; los
  problemas visuales (puente, orillas este/oeste) se aceptaron como deuda con conocimiento de causa.
- **Contraste final del design antes de tasks** (lección de 0006): cazó dos fricciones spec/design (E2E nuevos frente
  a ampliados; dónde vigilar el tope de objetos) y el riesgo R1 de la orilla en el agua.
- **e2e-lite**: 0 E2E nuevos en `logic`; el tope de objetos lo vigila un test puro dentro de `verify`.
- La agrupación de orillas por tramos rindió más de lo estimado (r3 preveía 275–340; real ≤ 258): no hizo falta el
  `Blitter`.

## Qué fue mal / dónde falló la IA
- **Recomendación ambigua del orquestador** sobre la copa ("tapa solo al jugador; enemigos por debajo de las
  copas"): se contradecía y obligó a repreguntar. Lo detectó el implementer de mediciones.
- **Orilla en el agua** en la primera spec: no se miró cómo está pensado `Tilemap_Flat` (hierba con borde) hasta el
  contraste; costó una ronda extra de spec + design.
- **Estimaciones de objetos** del design desviadas en ambos sentidos (≈340 → real 245 en la 123).
- **Firma dorada de la 123**: el prototipo predijo ~115/576 cambios y el real fue 22/576 (la unión zona + castillo del
  design no desplaza su río horizontal). Sin impacto, pero la predicción no sirvió.
- **Desviaciones de nombre/orden** en el apply (`checkTileScales`, reserva por hueco, `startEmptyWithExit`) no se
  llevaron al design hasta el verify (W1).
- El orquestador decidió cambiar el castillo de visual a sólido solo tras interrupción del usuario: la primera
  recomendación (visual) priorizaba no tocar el dominio sobre lo que pedía el GDD.

## Desviaciones respecto a spec o diseño
- Design §12.7 (W1): `checkTileScales` desde `bootContent`; reserva por elemento en su hueco de capa;
  helper `startEmptyWithExit`.
- Títulos de los dos E2E ampliados del mapa ajustados a su nuevo alcance.
- GDD: la historia 0016 decía "el núcleo no cambia"; corregida por el `game-designer` tras el gate (castillo sólido).

## Deuda registrada
- W2: balance 27/50, cerca del límite inferior de la banda.
- Enemigos atraviesan el castillo hasta 0018 flow-field.
- Puente norte-sur con poste recortado; orillas este/oeste con borde más fino; poca variedad de árboles.

## Lecciones → acciones
- Una recomendación al usuario sobre capas/profundidad debe nombrar qué se pinta encima de qué, sin negaciones →
  aplicar en las preguntas del orquestador (sin cambio de fichero).
- Antes de especificar un autotile, mirar cómo pinta el pack sus piezas (tierra o agua) → pedirlo explícitamente al
  `sdd-explorer` cuando el change use tiles de un pack.
- Las desviaciones del apply van al design en la misma ronda → pedírselo al `sdd-implementer` al cerrar cada bloque.
