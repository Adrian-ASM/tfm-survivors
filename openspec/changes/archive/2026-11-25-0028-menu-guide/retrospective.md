# Retrospectiva · 0028-menu-guide

- **Fechas**: inicio 2026-11-25 → archivado 2026-11-25
- **PR**: #72 (squash `f6289a9`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 9 / 9 (grupos 3–5; sin tareas de dominio ni aplicación) |
| Commits (asistidos por IA) | 7 (7) en la rama: planificación, 3 de apply, verify-report, correcciones y re-verify |
| Tests añadidos | +90 (3.493 → 3.583), 0 E2E nuevos (se amplían «Arranque y menú» y «Jugar desde el menú») |
| Hallazgos verify (C / W / S) | 0 / 2 / 3 → re-verify 0 / 0 / 0 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 3 (spec alineada con el design; una ronda de correcciones; S3 corregida a mano en el informe) |

## Qué fue bien
- Las cuatro decisiones abiertas de la exploración (cifras, teclado, iconos, posición) se preguntaron al autor antes
  de *propose*: spec y design no divergieron en ellas salvo en el alcance de los iconos.
- Marcadores interpolados + test "guide.json sin dígitos": las cifras de la guía no pueden desincronizarse del
  contenido cuando se reequilibre.
- Todo en Node con `fakeDom` ampliado (sin jsdom ni dependencias nuevas); un solo E2E ampliado y sin esperas.
- El spec-writer encontró el choque transversal en `world-camera` ("sus cuatro opciones"), que la propuesta no listaba.

## Qué fue mal / dónde falló la IA
- La spec limitó los iconos a oro, madera y piedra (los que tenía el HUD) aunque el autor había elegido iconos de
  recursos en general; hubo que realinearla con el design (cinco, gema como SVG `data:`).
- El primer `fakeDom` no daba el foco al pulsar un botón: el test del foco tras Siguiente pasaba también sin la
  implementación. El implementer lo detectó rompiendo el código a propósito.
- El re-verify dio S3 por abierta cuando `tasks.md` ya estaba corregido (leyó el informe y no el fichero).
- `git status` mostró ficheros "modificados" con diff vacío (ruido de stat en Windows) y confundió al verifier.

## Desviaciones respecto a spec o diseño
- La guía se cierra en `MenuPanel.show()` y no en `progressWiring` (mismo efecto).
- Color de la gema normalizado a minúsculas en el SVG (zod lo convierte en número).
- «Marcador sin valor en el contenido» es inalcanzable por `bootContent` (el schema de `structures.json` exige los
  dos tipos): se cubre con `parseGuide` y un test documenta por qué.
- Auto-merge no permitido en el repo: el autor fusionó la PR a mano.

## Lecciones → acciones
- Al pasar una decisión del autor al spec-writer, enumerar los elementos concretos ("los cinco recursos"), no la
  categoría → nota en la skill `sdd-workflow` (decisiones abiertas al gate).
- Los dobles de DOM deben reproducir el efecto que se prueba (foco al clic, clic ignorado si está desactivado) y el
  test debe verse en rojo → ya cubierto por TDD/test-after con rojo comprobado; reforzar en `test-writer`.
- El re-verify comprueba cada hallazgo en el fichero, no en el informe previo → nota en el agente `sdd-verifier`.
