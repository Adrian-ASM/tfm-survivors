# Retrospectiva · 0022-resources-sheep

- **Fechas**: inicio 2026-11-24 → archivado 2026-11-24
- **PR**: #54 (squash `c638628`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 19 / 19 |
| Commits (asistidos por IA) | 10 (10) en la rama del change |
| Tests añadidos | ~152 casos `it`/`test` nuevos en 15 ficheros nuevos y 47 modificados (62 ficheros de `tests/`) |
| Ficheros del PR | 132 (+8.262 / −738); `src/` 46 ficheros (+1.578 / −376) |
| Hallazgos verify (C / W / S) | 0 / 3 / 4 → tras re-verify 0 / 0 (2 registrados como deuda) / 3 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 1 (`no-deprecated`, ~70 errores por `@deprecated` en `gems`) / 0 |
| Iteraciones de prompt relevantes | 3 (preguntas de alcance antes de propose, contraste spec ↔ design antes de tasks, ronda de W1) |
| Specs vivas tocadas | 9 (1 nueva: `resources`); 15 ADDED, 23 MODIFIED, 0 REMOVED |
| Balance | idéntico a la línea base M0 en las 50 semillas: 27/50, 0 quietos, 26,88 mechas |
| Objetos del mapa (42 / 123) | 701 / 784 (antes 695 / 778) |

## Qué fue bien
- **Decisiones de alcance antes de medir** (lección de 0021): el orquestador cerró con el usuario alcance B,
  curación, fuente de la carne y aspecto/HUD tras explore y antes de propose. Al salir la carne del change, la
  medición previa de curación dejó de hacer falta y no se lanzó.
- **Balance por construcción**: congelar en M0 resultado, tick y bajas por semilla (`balanceBaseline.ts`) y una huella
  del contenido de combate convirtió "sin recalibrar" en un test exacto. El tope y relleno por tipo dejaron la XP bit
  a bit igual.
- **Flujo de azar propio** (`RESOURCE_STREAM` 4, ADR-0021): `MAP_GOLDEN` y `STRUCTURE_GOLDEN` intactas; solo se
  añadió `RESOURCE_GOLDEN`.
- **Contraste spec ↔ design en el mismo subagente**: retomar al `sdd-architect` (SendMessage) con la lista de
  choques resolvió los conflictos (lista única con ids de una secuencia, XP sin hoja, anular fuentes en tests) sin
  reabrir specs ni arrancar en frío.
- **Procedencia en la misma tarea** que copia el PNG (lección de 0021): 3 hojas nuevas, `guard:all` limpio.
- **E2E dentro del presupuesto**: 1 nuevo y 2 ampliados; W1 se cerró ampliando `smoke.spec`.

## Qué fue mal / dónde falló la IA
- **Specs muy largas**: 233 escenarios en 9 deltas, porque cada MODIFIED copia el requisito vivo entero. El verifier
  solo pudo muestrear la cobertura (S4).
- **Sonda que no miraba la escena**: el null del HUD en el menú se derivaba de `probe.screen`; un test sobre esa sonda
  habría pasado sin comprobar nada. Lo destapó W1.
- **Heredocs y `node -e`** contra AGENTS.md §8.1: dos ediciones rompieron plantillas literales (reparadas al momento)
  y tres bloques de test se añadieron con `cat >>`.
- **Coste por tick del arnés**: el lote creció un +8 % (objetivo del design ≤ +5 %), sobre todo por copiar dos veces
  cada gema en el snapshot y por los montones de madera que el bot v3 no recoge. Medir en esta máquina es ruidoso
  (32–49 s para la misma configuración).
- **Primera verificación muy barata** (6 herramientas, ~2,5 min): el orquestador volvió a ejecutar `verify` antes de
  fiarse del veredicto.

## Desviaciones respecto a spec o diseño
- `content/resources.json`, su zod y `RESOURCE_STREAM` se adelantaron al grupo 1 para que el contenido por defecto
  validara y los grupos cerraran en verde.
- La vista `gems` comparte objetos con `pickups` (traen `kind` y `value`); sin `@deprecated` por la regla de lint.
- `RunSetup.veins[i]` admite `gold` propio (escenario "Dos vetas" con 15 y 20).
- La regex de hojas admite espacios (`Resources/Gold Mine/`).
- El E2E nuevo calcula un camino BFS: el montón más cercano a la salida en la semilla 42 está al otro lado del río.
- `GameScene.hudView()` devuelve null sin escena activa o sin partida (corrección de W1).
- Deuda registrada: W2 (lote +8 %) y W3 (`MapVein.radius` con test-after en `domain`, contra ADR-0018).
- Sugerencias abiertas: S2 (`RunSetup.veins[i].gold` en el design, se deja en este archivo), S3 (bench de tres topes
  0,2672 ms como nueva referencia), S4 (títulos de test que citen su escenario).

## Lecciones → acciones
- MODIFIED que copian requisitos enteros inflan las specs y la verificación → en la plantilla de spec delta, pedir
  que un MODIFIED con escenarios vivos sin cambios los cite por nombre en vez de copiarlos (pendiente en
  `references/spec.md` de `sdd-workflow`).
- Una sonda E2E debe leer el estado del objeto que dice observar, no deducirlo de otro → nota en la skill
  `test-writer` (pendiente).
- Si el coste del arnés de balance cuenta en el gate, el design debe medir el arnés y el núcleo por separado → nota
  para el `sdd-architect` en `sdd-workflow` §3 "Tiempo del lote de balance" (pendiente).
- Verify con muy pocas herramientas en un change grande → el orquestador vuelve a ejecutar `verify` o pide un
  muestreo explícito por spec (se aplicó en este change).
- Seguimiento del GDD: las ovejas, la carne y la curación (fija, con tope en la vida máxima; solo de ovejas) necesitan
  su propio change tras 0022; renumerar el bloque Should de `docs/gdd.md` con el `game-designer`.
