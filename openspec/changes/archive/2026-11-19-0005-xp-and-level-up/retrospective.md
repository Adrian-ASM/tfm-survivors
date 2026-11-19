# Retrospectiva · 0005-xp-and-level-up

- **Fechas**: inicio 2026-11-19 → archivado 2026-11-19
- **PR**: #8 (squash `ea65567`); el archivado va en un PR aparte (rama `docs/0005-archive`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 46 / 46 (grupos 0 a 4) |
| Commits (asistidos por IA) | 50 (50) en `change/0005-xp-and-level-up`: 20 `feat(domain)`, 8 `test(domain)`, 3 `feat(app)`, 3 `feat(infra)`, 1 `feat(render)`, 2 `fix`, 1 `refactor`, 5 `test` de contenido/e2e/bench, 7 `docs`; más el de archivado |
| Tests añadidos | 265 unitarios (536 → 801) + 1 E2E (5 → 6, `level-up.spec.ts`) + caso de bench con 300 gemas |
| Tamaño del diff | 106 ficheros, +8.182 / −310 (`src` +1.818, `tests` +3.502) |
| Hallazgos verify (C / W / S) | 0 / 0 / 5 (las 5 Suggestions quedan como deuda, ver abajo) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 1 ronda de preguntas antes de la propuesta (4 decisiones del usuario); 1 alineación spec ↔ design (orden del tick y nombres de campos); 1 parada del apply en el punto de control 0.3 |
| Benchmark `Run.tick` | peor caso (200 enemigos, 32 proyectiles, 300 gemas): media 0,129 ms, p99 0,137 ms (umbral 2 ms) |
| Equilibrio medido (núcleo, quieto, elección fija) | con `pickupRadius` 64: primera oferta tick 4.236 (seed 7, > 3.600); con 128: primera oferta 3.332, primera gema 957, primera baja 179, primer pulso 950 (seed 7); primer golpe 4.122 (seed 42) |

## Qué fue bien
- **El punto de control de medición funcionó a la primera** (lección de 0004 aplicada): la tarea de medir fue la
  primera del apply y bloqueaba la infraestructura; el implementer paró con cifras y alternativas medidas
  (radio 96/128/160/200, `baseXp` 1–3) en vez de relajar tests. Una sola parada, frente a dos en 0004.
- Las preguntas de la exploración se resolvieron con el usuario antes de la propuesta, y los valores por defecto
  restantes se presentaron como "Decisiones por confirmar": la propuesta se aprobó sin rondas de cambios.
- ADR-0008 (mejoras como modificadores aditivos derivados de los niveles) encajó con ADR-0007 sin clases nuevas, y
  la validación del peor caso reutiliza las fábricas de siempre.
- Spec y design en paralelo, con el único conflicto real (orden del tick) resuelto antes de las tareas.
- El E2E destapó un fallo real del motor (Phaser 4.2.1: `Key.onUp` borra `_justDown`, así que una pulsación dentro
  de un frame no elegía nada) que los tests unitarios no podían ver.
- Verify limpio: 0 Critical, 0 Warning; 205 de 210 escenarios con el mismo título en los tests.

## Qué fue mal / dónde falló la IA
- **Sesión de orquestador abierta fuera del repo por tercera vez** (en `C:\Users\Adri\TFM`): los subagentes de
  `.claude/agents/` no se cargaron y se usaron agentes generales con la definición y el modelo de cada rol.
- **Radio de recogida sin medir en la propuesta**: 64 px dejaba las gemas a 100–300 px fuera del imán con el jugador
  quieto; solo 2 ofertas por partida. Se detectó en el punto de control, no antes.
- **Corrección de spec incompleta en la decisión de equilibrio**: el orquestador cambió el valor por defecto pero se
  le escaparon la cabecera de `player-movement` y el GIVEN de "Más radio de recogida", que no fijaba el radio base
  (lo avisó el implementer; corregido en `cc8b8a2`).
- El implementer hizo 2 `git commit --amend` en local (uno para tapar un commit con un test en rojo) antes de que
  se le pidiera no hacerlo; algunas ediciones por shell perdieron texto con comillas invertidas y se rehicieron
  con Edit/Write.
- Discrepancia en el recuento: el architect informó de 41 tareas y `tasks.md` tenía 46.
- Las cabeceras `<!-- -->` de las specs delta no se fusionan: la "política de elección fija", citada en varios
  escenarios vivos, solo estaba definida en la cabecera delta de `simulation-loop`. Se movió al Purpose de la spec
  viva al archivar.

## Desviaciones respecto a spec o diseño
- `pickupRadius` por defecto 64 → **128** por decisión del usuario tras el punto de control; el plazo de primera
  oferta (≤ 3.600 ticks) se mantuvo. Los builders de test (`aRunConfig`) siguen en 64 por la geometría de los
  escenarios del imán; `aDefaultConfig` usa el contenido real.
- Orden del tick del design alineado con la spec: armas y bajas con suelta de gemas → contacto → gemas y XP →
  director → oferta. Una gema soltada se puede atraer y recoger en su mismo tick.
- Validación del catálogo por peor caso de cada estadística en lugar de signo fijo (más estricto que "todas al
  máximo" solo con signos mezclados; no ocurre con el catálogo por defecto). Documentado en ADR-0008.
- `ChoiceKeys` escucha el evento `down` de cada tecla en vez de `JustDown` (ver arriba).
- Esquemas zod, loader y JSON nuevos adelantados de 3.1–3.3 porque sin ellos no compila el dominio.
- `PlayerRules` y `checkPlayer` a `player/PlayerRules.ts` (ciclo de imports); `RunSetup` a su fichero con la costura
  de test `upgrades`; piezas del snapshot en `snapshotParts.ts`.
- El bench quita las mejoras de cadencia (con cadencia 1 el catálogo no pasa la validación) y coloca al jugador en
  (480, 16).
- La comprobación manual con `npm run dev` se sustituyó por una captura de Playwright del overlay.

## Lecciones → acciones
- Los valores que deciden el ritmo (radio de recogida, curva) también se miden antes de fijar plazos → la skill del
  spec-writer debe pedir para cada plazo de equilibrio qué parámetros lo gobiernan, y la tarea 0 de medición debe
  barrer esos parámetros, no solo comprobar el plazo.
- Al aplicar una decisión de equilibrio, buscar el número antiguo en cabeceras y GIVEN, no solo en THEN → el
  orquestador lanza un `grep` del valor en todo `openspec/` y en `tests/` antes de reanudar el apply.
- Las convenciones transversales no pueden vivir en comentarios de cabecera delta → la plantilla de spec debe
  ponerlas en un requisito o en el Purpose, y la skill `sdd-archive` debe revisar las cabeceras al fusionar.
- La sesión del orquestador sigue abriéndose fuera del repo (tercera vez) → poner un aviso visible en un
  `CLAUDE.md` de la carpeta padre `C:\Users\Adri\TFM` o abrir siempre la sesión desde el worktree.
- Prohibir explícitamente `git commit --amend` para tapar un commit en rojo en la definición del implementer
  (hoy solo lo prohíbe la instrucción del orquestador).
- Deuda abierta del verify (Suggestions): S1 nota obsoleta "Pendiente de spec" en `design.md` (queda como histórico);
  S2 `Run.ts` con 307 líneas (> 300 del riesgo del design); S3 cinco tests sin el título exacto de la spec; S4
  E2E lentos (`level-up` 57 s, `health` 1,2 min) y margen de 268 ticks en la primera oferta con seed 7; S5 bench sin
  mejoras de cadencia. Siguen abiertas S5 de 0004 (`snapshot()` asigna por frame, ahora también gemas y oferta) y
  S8 de 0003.
