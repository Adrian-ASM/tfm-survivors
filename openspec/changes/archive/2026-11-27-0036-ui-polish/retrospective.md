# Retrospectiva · 0036-ui-polish

- **Fechas**: inicio 2026-11-27 → archivado 2026-11-27
- **PR**: #94 (merge `d94956d`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 10 / 10 (5 grupos, todo infraestructura/contenido con test-after) |
| Commits (asistidos por IA) | 10 (10) en la rama, squash en `d94956d` |
| Tests añadidos | 107 unitarios (4.466 → 4.573); 0 E2E nuevos, 5 de humo ampliados |
| Hallazgos verify (C / W / S) | 0 / 0 / 2 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 1 (E2E de los solares en CI) |
| Iteraciones de prompt relevantes | 4 (alcance ampliado antes de explorar; barras: bug → cambio de comportamiento; prueba del autor: × y fila de la torre; fallo del CI) |

## Qué fue bien
- Un solo change para seis detalles de UI: un ciclo SDD en lugar de tres; sin núcleo, balance ni firmas.
- La exploración encontró la calavera ya registrada (`Dead.png`): sin assets nuevos ni script de dibujo.
- Las cifras de la explicación de la casa salen de `buildings.json` (interpoladas como la guía), sin duplicar datos.
- Probar en local (escritorio y móvil por la red) antes del merge sacó dos defectos que los tests no veían.

## Qué fue mal / dónde falló la IA
- **Bug que no lo era**: el orquestador leyó «la vida de estructuras no aparece hasta que reciben daño» como un fallo,
  cuando el autor pedía justo eso como comportamiento. El explorador no lo podía demostrar en el código porque no
  existía; la pregunta directa al autor lo aclaró antes de proponer.
- **× ilegible**: el design fijó la × de 48·k con el 9-slice del botón a escala completa (20/20/28/20 · k); las esquinas
  llenaban la caja y no quedaba cara para el glifo. Los tests medían centrado y posición, no si se veía. Se corrigió
  pintando las esquinas a media escala.
- **Explicación partida**: con dos costes en columna aparte la explicación de la torre se partía sílaba a sílaba
  (`overflow-wrap: anywhere`). Al pasar el coste a una tercera línea, el E2E nuevo de «una línea» pasó en local y falló
  en CI: la métrica de la fuente difiere y a 28em no cabía. Se ensanchó el panel a 34em.
- Una contradicción en la spec delta (casa con vida 4 sin barra en n − 1) la detectó el implementador y la corrigió el
  orquestador.

## Desviaciones respecto a spec o diseño
- `BUILD_TEXT_MAX` 64 medido sobre el texto interpolado; `buildingIcons` devuelve también el ancho y el alto del frame;
  la × a 48·k + 2 px y 16·k − 1 px con `place-content: unsafe center` (diario de apply).
- Tras el verify (commit de la prueba del autor): × con esquinas a media escala y glifo en negrita de 28 px (spec
  delta actualizada), coste de la obra bajo la explicación y panel de obra a 34em. `faceCenterOffset` lee el ancho
  pintado de las esquinas (`border-image-width`) en vez de los márgenes de la pieza.

## Lecciones → acciones
- Los tests geométricos (centrado, posición, solapes) no prueban que un control **se lea** → en piezas 9-slice
  pequeñas, el design comprueba que caja − márgenes × k deja cara visible para el contenido (regla añadida a la
  skill `sdd-workflow`, «Reglas sobre datos medibles»).
- Un texto que «cabe justo» en local puede partirse en CI → los E2E que exigen una línea dejan holgura de ancho o el
  layout la reserva; no basta con medir en una sola máquina.
- Ante una petición ambigua («no aparece hasta…») confirmar con el autor si describe el estado actual o el deseado
  antes de clasificarla como bug.
