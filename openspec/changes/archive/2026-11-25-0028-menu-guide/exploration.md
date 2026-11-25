# Exploración · 0028-menu-guide

## Contexto actual
- Menú: `src/infrastructure/dom/MenuPanel.ts` (4 botones con `button()` de `dom/button.ts`, que hace `blur()` tras el clic para que Esc/R sigan yendo al juego), reglas en `src/infrastructure/menu/MenuController.ts` (`idle | confirming | leaving`; con diálogo abierto las opciones no tienen efecto). Cableado en `src/composition/progressWiring.ts` (MenuPanel + `ConfirmDialog`). `MenuScene` no registra teclas: en modo menú Esc no hace nada (spec main-menu).
- `ConfirmDialog` (`role="alertdialog"`, `aria-modal`) NO escucha teclado a propósito y no usa `<dialog>`. Es el único modal DOM del menú; no hay precedente de `keydown` DOM. Esc de juego va por Phaser (`PauseKey` → `ShopGate` → `BuildGate` → `PauseGate`, solo en `GameScene`), así que un Esc del modal sería el primer listener DOM (permitido por CSP: `addEventListener`, `textContent`; sin inline ni `innerHTML`).
- Estilos en `src/styles.css` (`.menu-panel`, `.confirm-dialog`, z-index 2/3, `font: calc(16px * var(--ui-scale, 1))`); `--ui-scale` lo pone `applyUiScale` y escala todo por `em`. Un modal de 7 páginas de texto debe caber en 960 × 540 (spec "Menú y pausa centrados": centrado ±1 px, sin solape, botones enteros en la ventana).
- Contenido: `content/*.json` → `repositoryContent()` / `parseContent` (`infrastructure/content/loadRunConfig.ts`) → `RunConfig` (dominio). `appearance.json` es el precedente de contenido de presentación fuera de `RunConfig`: entra por `RawBoot.appearance` en `src/composition/contentBoot.ts` (`bootContent`: parse zod, cruce con la config, error → `showContentError`, no se crea menú). Textos de UI actuales: constantes en `dom/menuText.ts` (`MENU_LABELS`), no en `content/`.
- Sondas: `window.__sprint` solo con `?e2e`; `screens: Screen[]` (`menu|playing|paused|shop|build`, `GameScene.ts:113`) se alimenta desde `GameScene.onScreen`; `MenuScene` no tiene sonda propia. Con `?e2e` el menú se salta solo al cargar.
- E2E: suite `logic` = `smoke`, `progress`, `gameplay` (.spec). `smoke.spec.ts` "Arranque y menú" fija la lista exacta de botones `['Jugar','Exportar','Importar','Borrar datos']` y la CSP (`cspState`).
- Cifras que las páginas citarían y ya viven en contenido: casa 15 madera (+1 oro/1.800 ticks) y torre 30 madera + 15 piedra (`buildings.json`), carne 20 % (`resources.json`), precios de armas en `upgrades.json`, oro/piedra por baja (`resources.drops`), 9 mejoras de personaje, victoria a 10:00 (`run.json`).

## Specs afectadas
- `main-menu` (MODIFIED): "Menú de inicio al cargar" dice "exactamente cuatro opciones … en este orden"; también las etiquetas exactas, "Teclas sin efecto en el menú" (Esc), "Menú y pausa centrados" y "Arranque directo con e2e". Requirement nuevo "Cómo jugar" (ADDED, o spec nueva `how-to-play`).
- Sin cambios de comportamiento en `simulation-loop`, `run-state`, `progress-persistence` (el modal no toca progreso ni partida). No existe spec de accesibilidad/teclado: lo más cercano es `main-menu` (foco, Esc). `architecture-guardrails`: regla 5 (contenido en `content/` con zod) aplica a los textos.

## Opciones
1. **`content/guide.json` aparte, textos planos, cifras escritas a mano.** Ruta de `appearance.json`: schema zod en `infrastructure/content/`, `bootContent` lo valida, páginas = `{ title, body[] }` en orden fijo. Pros: simple, barato, sin acoplar a `RunConfig`. Contras: cifras duplicadas, riesgo de desincronización con `buildings.json`/`resources.json` cuando se reequilibre.
2. **`guide.json` con marcadores (`{house.cost.wood}`, `{tower.cost.stone}`, `{meat.healPercent}`) interpolados al abrir desde la `RunConfig` ya validada.** Un test/`bootContent` falla si un marcador no resuelve. Pros: sin desincronización de cifras; ajustes de balance se reflejan. Contras: mini-plantilla y catálogo de marcadores que mantener; textos menos legibles en el JSON; más superficie de test.
3. **Textos en `guide.json` + test de coherencia (sin interpolación).** Las cifras se escriben a mano, pero un test en Node cruza cada cifra declarada (`facts: { houseWood: 15 }`) con el contenido real. Pros: JSON legible, detecta deriva en `verify`. Contras: dos sitios que actualizar; test que solo avisa tras el cambio.
- Transversal (sin elegir): modal propio `GuideModal` (DOM) + controlador puro de páginas (`GuideController`: índice, siguiente/anterior con topes, abrir/cerrar) en `infrastructure/menu/`, probable estado `guide` en `MenuController` que bloquea Jugar/Exportar/Importar/Borrar mientras está abierto (patrón `confirming`).

## Riesgos e incógnitas
- Spec: añadir un 5.º botón rompe el requirement "exactamente cuatro" y el smoke de botones; hay que decidir posición (¿tras Jugar o al final?) y que Jugar siga con 1 pulsación.
- Esc: `button()` hace `blur()` y el canvas puede no tener foco; un `keydown` en `document` solo mientras el modal esté abierto, sin filtrar Esc de otras pantallas ni dejar listeners colgados. Foco: ¿al abrir, foco en Siguiente/Cerrar y devolverlo al botón «Cómo jugar»? Choca con el `blur()` del patrón de 0009 (que protege R/Esc del juego); el modal solo vive en el menú, donde no hay teclas de juego.
- Texto largo en 960 × 540 con `--ui-scale` ×2 a 1.920: desbordamiento; necesita ancho máximo y quizá scroll interno.
- Contenido: `content/*` cae en el guardarraíl de contenido/zod; el `import` JSON de Vite y el `appearance.json` ya están en el bundle (sin CSP nueva). Una vía de fallo si `guide.json` es inválido (hoy `showContentError` bloquea todo el arranque).
- Balance: change solo de DOM; `BALANCE_BASELINE` no se toca (confirmar que no se importa nada del núcleo nuevo).
- Orden de las 7 páginas está fijado en el GDD; el número de páginas, ¿validado por zod (7 exactas) o ≥ 1?

## Mediciones previas
No aplica (sin objetivo de balance, ritmo ni rendimiento).

## Preguntas para el usuario (gate de propuesta)
1. Fichero: ¿`content/guide.json` nuevo (recomiendo explorar esta vía, como `appearance.json`) o dentro de uno existente?
2. Cifras: ¿interpolación desde la config (opción 2), test de coherencia (3) o texto fijo a mano (1)?
3. Teclado: Esc cierra el modal; ¿flechas izquierda/derecha para navegar y foco atrapado (focus trap) dentro del modal, o solo ratón + Esc?
4. ¿Imágenes/iconos en las páginas (reutilizar `resourceIcons`/hojas de `appearance.json`) o solo texto?
5. ¿«Cómo jugar» va entre Jugar y Exportar o al final (tras Borrar datos)? Actualiza el requisito "cuatro opciones".
6. E2E mínimo (e2e-lite): ampliar el smoke "Arranque y menú" (lista de 5 botones; abrir el modal, recorrer 7 páginas comprobando botones de los extremos, Esc, menú visible sin partida) sin sonda nueva (sin `?e2e` no hay sonda, se observa el DOM). Resto (límites, bloqueo de opciones, textos zod) en Node. ¿Basta con 1 E2E? ¿Quieres sonda `guide` bajo `?e2e` (p. ej. `screens` con `guide`)?
