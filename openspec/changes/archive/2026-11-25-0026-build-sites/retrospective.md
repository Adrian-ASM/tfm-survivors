# Retrospectiva · 0026-build-sites

- **Fechas**: inicio 2026-11-25 → archivado 2026-11-25
- **PR**: #66

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 20 / 20 (19 de la descomposición + 1 subtarea marcada aparte) |
| Commits (asistidos por IA) | 11 (11) |
| Tests añadidos | 173 casos (`it`/`test`) en 56 ficheros; suite final 3.444 tests en 293 ficheros |
| Hallazgos verify (C / W / S) | 0 / 3 / 2 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 4 (2 rondas de preguntas al usuario antes de propose, 1 tras propose y 2 aclaraciones del aspecto del solar) |

Datos de cierre: bot v4 idéntico a `BALANCE_BASELINE` (30/50, 0 quietos); bot v5 29/50; bench sin coste añadido
medible (0,12 ms/tick con 300 enemigos y 6 torres); 737/820 objetos del mapa en 42/123; E2E 17/17. Lotes de bots en
el CI de la PR: v4 94,1 s y v5 **140,4 s** (timeout 180 s).

## Qué fue bien
- Las decisiones abiertas (bloqueo, fase modal, bot y balance, nº de solares, huella, oro de la casa, reserva de
  flechas, pausa) se cerraron con el usuario **antes** de propose, como pide la lección de 0025: spec y design
  llegaron casi alineados.
- La medición previa (recursos del bot v4 en 1..50 y rutas desde el castillo) fijó costes y oro de la casa con datos;
  el bot v5 quedó en banda (29/50) sin recalibrar.
- Las cinco firmas doradas y `BALANCE_BASELINE` quedaron intactas: los solares se colocan con `SITE_STREAM` 7 al
  final de la siembra y el bot v4 sale sin construir.
- El único E2E nuevo encontró un fallo real (la escena no cargaba el arte de los solares y pintaba la reserva).

## Qué fue mal / dónde falló la IA
- El design partió el aspecto del solar libre por paridad con dos hojas de construcción, lo que sugería un tipo que
  el solar no tiene; hizo falta preguntar dos veces al usuario y ajustar spec (3 hojas en vez de 4) y design.
- El architect no pudo hacer `git fetch` (sin shell) para numerar el ADR; lo comprobó el orquestador.
- El implementador adelantó piezas de grupos posteriores (contenido, `SITE_STREAM`, política de obra del bot) para
  que el typecheck y el balance pasaran en el grupo 2; el orden de `tasks.md` no lo preveía.
- La regla de contenido del design (radio de oferta + radio del jugador < 1,5 celdas) rompió un fixture vivo con
  `cellSize` 32; se resolvió en el fixture, pero el design no lo había contrastado con los escenarios vivos.
- El lote del bot v5 con el invariante comprobado en cada tick tarda 140 s en CI (78 % del timeout).
- Al archivar, el script de fusión no tiene modo de prueba: un segundo lanzamiento por error falló en el primer
  ADDED (sin daño, pero sin garantía en general).

## Desviaciones respecto a spec o diseño
- Registradas en `design.md` §9 y en `docs/ai-log/2026-11-25-0026-apply.md`: `GameMap.isBuiltAt` y
  `nearestWalkableCenter`; `snapshot.sites` con acceso y huellas; error de invariante en `Run.build`;
  `RunSetup.sites` (obras en el tick 0) y "Semillas del conjunto con edificios" probado en el tick 0 y no en el 1.800;
  fixture con radio de oferta 30; escenarios de la reserva de flechas probados sobre `TowerBattery`/`Arsenal` y
  `PickupField`.
- Assets: se versionan 3 hojas de Knights (`House_Construction` común a todo solar libre, `House_Blue`,
  `Tower_Blue`); `Tower_Construction` y las `*_Destroyed` quedan fuera.

## Lecciones → acciones
- El aspecto de los estados de una entidad (libre/construida) es una decisión del usuario → preguntar en el gate de
  propuesta junto a las reglas de azar y de contenido (skill `sdd-workflow`, "Decisiones abiertas").
- Una regla de validación de contenido nueva debe contrastarse con los fixtures de los escenarios vivos → pedirlo al
  `sdd-architect` en design (skill `sdd-workflow`, "Contraste final del design").
- Los lotes de bots crecen con cada change (v4 94 s + v5 140 s en CI) → deuda: aligerar el invariante por tick del
  lote v5 (muestreo) o partir el lote antes de añadir otro bot; vigilar el timeout de 180 s.
- `tasks.md` debe ordenar contenido y siembra antes de las reglas que los necesitan para compilar → indicarlo al
  `sdd-architect` al descomponer.
