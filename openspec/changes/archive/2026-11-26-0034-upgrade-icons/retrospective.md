# Retrospectiva · 0034-upgrade-icons

- **Fechas**: inicio 2026-11-26 → archivado 2026-11-26
- **PR**: [#90](https://github.com/Adrian-ASM/tfm-survivors/pull/90) (merge `21d9ab4`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 14 / 14 (8 grupos) |
| Commits (asistidos por IA) | 10 (10): planificación, 5 de código (grupos 1–5), 1 de contenido (grupo 6, un solo lote), E2E, docs y verify-report |
| Tests añadidos | 81 bloques `it`/`test` nuevos; 4.238 tests en `verify` (4.211 al cerrar el grupo 5); 0 E2E nuevos, 1 ampliado en `logic` (Tienda de `gameplay.spec`, suite 19) y `public.spec` ampliado a demanda |
| Hallazgos verify (C / W / S) | 0 / 0 / 2, sin re-verify |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 6: 4 decisiones del autor antes de *propose* (origen, datos, reserva, alcance) + 1 aclaración del origen; cambio de origen en apply (los iconos los dibuja un script, no un generador de imágenes) tras una muestra de 3 aprobada por el autor; 1 retoque de la muestra (hombros de la cota) y 1 de la hoja de 18 (arco, Brazo incansable, penacho) |
| Diff | 103 ficheros, +5.107 / −112; `src/domain` y `src/application` sin cambios |
| Specs vivas | 4 modificadas: `asset-provenance` 54 → 67, `castle-shop` 36 → 41, `sprite-rendering` 268 → 282, `upgrades` 60 → 67 (+39 escenarios) |

## Qué fue bien
- Las decisiones abiertas de la exploración (origen del arte, dónde viven los datos, qué es una categoría de reserva,
  si entra la poción) se cerraron con el autor antes de *propose*; spec y design no divergieron en ninguna.
- D9 separó el código del contenido: los grupos 1–5 cerraron en verde sin un solo PNG, y el arte pudo cambiar de
  origen a mitad del change sin tocar código.
- Al no haber herramienta de imágenes en la sesión, el orquestador dibujó los 18 iconos con un script determinista
  sin dependencias (`scripts/icons/draw-icons.mjs`): procedencia trivial de reproducir (el verifier regeneró los 18
  sha256 fuera del repo y coincidieron), estilo uniforme y sin cupos ni términos de terceros.
- El guardarraíl de procedencia asume el Won't por construcción: `generated[]` solo admite `public/assets/icons/`.
- Verify a la primera: 0 / 0 / 2.

## Qué fue mal / dónde falló la IA
- El plan contaba con un generador de imágenes (Antigravity, prompts por recuperar, post-proceso para quitar el
  fondo blanco) que no estaba disponible: tasks.md 6.1 preveía `remove-white-bg.ps1` y hubo que reescribir D8/D9 y
  el ADR en apply. La pregunta "¿puedes generar el resto?" llegó tras cerrar el código.
- Un `node -e` con comillas dobles en Git Bash interpretó acentos graves como sustitución de órdenes y estropeó
  `UpgradeOverlay.ts` (revertido; AGENTS §8.1 ya lo prohíbe).
- El smoke remoto `public.spec.ts` leía `appearanceJson.gem` (inexistente desde 0022) y estaba roto sin que nadie lo
  supiera, porque solo corre a demanda.
- El design se escribió sin shell (no pudo hacer `git fetch` para numerar el ADR); lo confirmó el orquestador.

## Desviaciones respecto a spec o diseño
- Origen de los iconos: dibujados por script (Claude Opus 5.5) en lugar de un generador de imágenes; `postProcess`
  apunta al propio generador (anotado en design D8/D9, ADR-0030 y diario).
- Tercer estado `none` (hueco vacío) en lugar del disco teñido del primer design (cambio tras contrastar con specs).
- `ShopPanel.view` devuelve `products: []` con la tienda cerrada (D7 suponía que ya era así).
- `pngProbe` reutiliza el decodificador de `tests/support/png.ts` (0032).
- Al archivar, "la reserva de la curación" de las specs se concretó como la reserva de arma (decisión del design).

## Lecciones → acciones
- Antes de *propose*, confirma que la herramienta que produce un asset está disponible en la sesión o la usa el
  autor por su cuenta; si no, ofrece una muestra por script como alternativa → regla en `sdd-workflow` §3.
- Los smokes a demanda se pudren sin que nadie lo note → el verifier compila (`tsc`) también `tests/remote/`
  (ya lo cubre `typecheck`; el fallo era en tiempo de ejecución): anotado como deuda, sin acción.
