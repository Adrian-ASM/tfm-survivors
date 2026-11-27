# Verify report · 0036-ui-polish

Resultado de `npm run verify`: verde (371 ficheros, 4.573 tests). E2E `logic` 19/19 en apply (no repetido).

| Escenario (spec) | Test | Estado |
|---|---|---|
| sprite-rendering: datos de contadores (válidos/inválidos) | `appearance-hud.test.ts`, `hud-icon-png.test.ts` | OK |
| sprite-rendering: cuatro modales con ×, reserva, DOM sin cambios, centrado, siete paneles | `*-panel.test.ts`, `guide-modal.test.ts`, `sound-panel*.test.ts`, `styles-ui.test.ts`, `dom-unchanged` | OK |
| sprite-rendering: barras (50 %, primer daño, ruina, partida nueva, R y menú) | `health-bar-layer.test.ts`, `render-layers-feedback.test.ts` | OK |
| sprite-rendering: × y centrado en el navegador, barras a 0 | `smoke.spec`, `gameplay.spec` (`faceCenterOffset`) | OK |
| hud: filas, anclaje, ventanas, bajas, calavera, reserva, 600 frames | `ui-layout`, `hud-panels`, `hud-format`, `hud-icon-pose`, `hud.test` | OK |
| build-sites: textos, explicación, filas con icono, panel, Esc/× | `guide-*.test.ts`, `build-panel`, `resource-icons`, `build-tower-regression`, E2E obra | OK |
| castle-shop: × con teclado, oro justo, ventana mínima, ×2 | `shop-panel`, `shop-gate`, `styles-ui`, `gameplay.spec` | OK |
| menu-guide: × única, iconos mayores, marco ×1/×2, recorrido | `guide-modal`, `styles-ui`, `smoke.spec` | OK |
| audio: abrir/cerrar con Esc y × | `sound-panel.test.ts`, `smoke.spec` | OK |
| main-menu tras redimensionar; Volver al menú con cadáveres; × en móvil; panel Sonido centrado | sin test | Aceptado sin test (e2e-lite) |

Arquitectura: sin núcleo tocado; cambios en infraestructura, composición y contenido. Tareas 1.1–5.2 marcadas y un commit por grupo (8eff660, 606e0aa, 439bf17, 5053c95, 7b049a1, más 0650aff de docs). AGENTS.md y diario de IA actualizados. No se ven secretos ni código muerto.

## Hallazgos
- Critical: ninguno.
- Warning: ninguno.
- Suggestion 1: `.claude/launch.json` aparece modificado sin commitear. Es ajeno al change; no lo incluyas en el PR.
- Suggestion 2: las desviaciones declaradas (`BUILD_TEXT_MAX` 64 medido sobre el texto interpolado, × de 16·k − 1 px, `buildingIcons` con ancho y alto) conviene dejarlas en el design o en el diario antes de archivar.

C: 0 · W: 0 · S: 2
