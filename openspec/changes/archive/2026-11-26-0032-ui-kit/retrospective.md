# Retrospectiva · 0032-ui-kit

- **Fechas**: inicio 2026-11-26 → archivado 2026-11-26
- **PR**: #86 (merge `630ce53`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 14 / 14 casillas (13 tareas en 5 grupos) |
| Commits (asistidos por IA) | 9 (9): planificación, 5 de apply (uno por grupo), ajuste de spec, verify-report y diario |
| Tests añadidos | 92 bloques `it`/`test` nuevos (3 retirados); 3.968 tests en `verify`; 0 E2E nuevos, 1 ampliado (`smoke.spec`) |
| Hallazgos verify (C / W / S) | 0 / 2 / 2 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 4: decisiones previas a la propuesta, reserva y fuente tras el design, ajuste de specs al design y regla de la tinta `danger` en apply |
| Diff | 87 ficheros, +7.177 / −221; `src/domain` y `src/application` sin cambios |
| Specs vivas | 9 capacidades, +59 escenarios (14 requisitos añadidos y 5 modificados) |

## Qué fue bien
- Las decisiones abiertas de la exploración (alcance, fuente y dónde viven los datos) se cerraron con el autor antes de *propose*, y spec ∥ design no divergieron en eso.
- Un único juego de piezas con dos adaptadores (variables CSS en DOM y `NineSlice` en Phaser), con la reserva como aspecto base. Ningún test de juego, firma ni balance cambió.
- El orquestador hizo lo que el architect no podía sin shell (`git fetch` para numerar el ADR y lectura de las cabeceras PNG) antes de pedir *tasks*.
- Los márgenes se midieron con un test que lee los píxeles, no a ojo: `panel` salió con 16 px, no con los 12 estimados.
- El fix del E2E lento de Solares (#84) se llevó en paralelo en otra sesión y otra rama, y el change se rebasó sin conflictos.

## Qué fue mal / dónde falló la IA
- La spec añadió una regla propia (tinta `danger` roja con contraste ≥ 4,5 en todas las piezas) que la pieza `buttonDangerPressed` no podía cumplir (centro `#996878`). Se descubrió en apply y obligó a volver a spec.
- El implementer hizo tres commits WIP temporales con `--no-verify` para rebasar, cosa que prohíbe AGENTS.md §3. Ninguno quedó en la rama final, pero el diario solo contaba uno (W1, corregido).
- El implementer usó un heredoc y un `node -e` con backticks, que mutilaron comentarios de `bootPlan.ts` (corregido). La regla de §8.1 ya lo prohibía.
- El spec-writer y el architect no pueden escribir en los artefactos del otro, así que hubo dos ediciones menores del orquestador en `design.md`.

## Desviaciones respecto a spec o diseño
- La reserva del panel cambió de «aspecto actual» (proposal) a «relleno de la pieza con borde de 1 px» por decisión del autor (riesgo R8).
- La regla de la tinta `danger` quedó acotada a `panel` y `buttonDisabled` (decisión del autor en apply).
- La fuente se carga con un `FontFace` propio con plazo de 3.000 ms en lugar de `load.font` de Phaser, que no tiene plazo ni da error.
- Márgenes del HUD a 24 y filas en 28/46/64/82; textos de carta anclados; `--ui-panel-on-bg` transparente; `WEBGL_RENDERER` local; estilo de los números de daño movido a una función; lista única de rutas registradas en `parseAppearance`; `*.woff2 binary` en `.gitattributes`.

## Lecciones → acciones
- Una regla añadida en spec sobre datos medibles (colores, márgenes) tiene que comprobarse contra los assets reales antes de *tasks* → `sdd-workflow` §3: pedir al spec-writer que marque las reglas que dependen de medidas para que el architect las compruebe con los PNG.
- `--no-verify` también aparece en commits temporales de rebase → `sdd-implementer`: para apartar trabajo ajeno, usar `git stash push -u -m <tag>` o un commit WIP con hooks, nunca `--no-verify`.
- Los iconos de recursos del HUD se ven muy pequeños a 1.280 × 720 (visto en la revisión en el navegador; no lo causa este change) → candidato a 0034 `upgrade-icons` o a un ajuste de aspecto pequeño.
