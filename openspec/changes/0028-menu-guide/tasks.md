# Tasks · 0028-menu-guide

<!-- Sin núcleo: no hay tareas de dominio ni de aplicación (proposal, decisión 8). Todo es infraestructura,
     composición y contenido → test-after (ADR-0018). Por tarea: `npm run verify:fast`. Por grupo:
     `npm run verify` completo y un commit (Conventional Commits, `refs: 0028-menu-guide`, `Assisted-by`). -->

## 1. Dominio
(sin tareas: `src/domain` no cambia)

## 2. Aplicación
(sin tareas: `src/application` no cambia)

## 3. Contenido de la guía y arranque (infraestructura `content/` + composición) · commit 1

- [ ] 3.1 **`guideSchema.ts` + `parseGuide` (forma)** (design §1).
  - Implementa:
    - Schema zod con `GUIDE_PAGE_IDS`, `GUIDE_ICONS` y textos no vacíos tras `trim`.
    - Exactamente 7 páginas, orden por `id`, `strictObject` e iconos únicos.
    - Conversión a `DomainError` con `field` `guide.…` y el sufijo `(página n)`, con n de 1 a 7.
  - Escenarios (spec `menu-guide`, «Contenido de la guía validado»):
    - «Seis u ocho páginas».
    - «Párrafo vacío o página sin párrafos».
    - «Título vacío».
    - «Páginas fuera de orden».
    - «Recurso citado desconocido o repetido».
    - «Campo desconocido» (nombra `image` y la página 6).
  - Test: `tests/infrastructure/content/guide-schema.test.ts`.
- [ ] 3.2 **Marcadores, interpolación y `content/guide.json`** (design §2).
  - Implementa:
    - `GUIDE_MARKERS` con las 14 claves, `formatCount` (punto de miles, sin `Intl`) y `formatSeconds` (como mucho
      una decimal, coma).
    - `interpolate`, con los errores `GUIDE_MARKER_UNKNOWN`, `GUIDE_BRACE_UNMATCHED` y `GUIDE_MARKER_UNRESOLVED`.
    - Las 7 páginas de `guide.json` en el orden del GDD:
      - Sin dígitos.
      - Las 14 claves usadas.
      - Iconos: la página 3 con `xp, gold, wood, meat, stone`, la 5 con al menos `wood` y `stone`, y la 1 sin
        iconos.
  - Escenarios (spec `menu-guide`):
    - «Marcador desconocido» (`tower.cost.gold`, página 5).
    - «Llave suelta» (`cada {` y `cada }`, página 2).
    - «Marcador sin valor en el contenido» (config sin `goblin-tower`).
    - «Cifras con el contenido por defecto».
    - «Las cifras siguen al contenido» (1.800, 4, 40, 37, 19, 35, 15:00).
    - «Segundos con decimal» (1.350 ticks dan 22,5).
    - «Sin cifras escritas a mano».
    - «Catálogo usado entero».
    - «Contenido por defecto válido».
  - Tests:
    - `tests/infrastructure/content/guide-markers.test.ts`.
    - Los casos de marcador y llave en `guide-schema.test.ts`.
- [ ] 3.3 **`bootContent` con la guía** (design §1).
  - Implementa:
    - `RawBoot.guide` obligatorio y `BootedContent.guide`. `parseGuide` va el último.
    - `main.ts` importa `content/guide.json`.
    - `guide: guideJson` en los 6 tests que llaman a `bootContent`.
  - Escenarios:
    - Las variantes inválidas de 3.1 y 3.2 pasan por `report` y `bootContent` devuelve `null` (no se crea el menú).
      Cubre «guide.json inválido impide el menú» de «Contenido de la guía validado».
    - Con el contenido por defecto, `booted.guide` sale interpolada.
  - Test: `tests/composition/guide-boot.test.ts`.
- [ ] 3.4 Cierre del grupo: `npm run verify` en verde (balance intacto, `BALANCE_BASELINE` sin regenerar) y
  commit 1.

## 4. Guía en el menú (infraestructura `dom/` + `menu/` + composición) · commit 2

- [ ] 4.1 **Iconos de recurso** (design §6).
  - Implementa:
    - `ResourceIcons` pasa a `{ xp, gold, wood, meat, stone }`.
    - La gema como forma usa un SVG `data:` con `placeholderColor`, generado por una función pura.
    - `BuildPanel` pide `Pick<…, 'wood' | 'stone'>`.
  - Escenarios (spec `menu-guide`, «Iconos de recurso en la guía»):
    - «Iconos de las páginas de recursos y de obra» (hojas `G_Idle`, `W_Idle`, `M_Idle` y `Deco/05`).
    - «Color de la gema desde el contenido» (`#12AB34`).
    - Hojas de una fila, comprobadas por IHDR.
    - «Sin assets nuevos»: `guard:all` y la nota de procedencia, sin cambios.
  - Test: `tests/infrastructure/dom/resource-icons.test.ts`.
- [ ] 4.2 **`fakeDom` ampliado + `GuideModal`** (design §3, §5).
  - Implementa:
    - En `fakeDom`: `focus()`, `scrollTop`, alta y baja de listeners en el documento con recuento por tipo, y
      `dispatchKey(key, { repeat, altKey, ctrlKey, metaKey })` que informa de `preventDefault`.
    - En el modal: paginación con topes, render con `textContent`, foco en el `root` (`tabindex="-1"`) al abrir y
      tras Anterior y Siguiente, `keydown` solo entre `open()` y `close()`, y teclas con repetición o modificador
      según el orden del §5.
  - Escenarios (spec `menu-guide`):
    - «Primera apertura» (foco dentro de la guía).
    - «Reabrir empieza en la página 1».
    - «Recorrido hacia delante» y «Recorrido hacia atrás».
    - «Páginas intermedias con ambos controles».
    - «Foco tras llegar al tope».
    - «Una sola página visible».
    - Toda la sección «Teclado en la guía»: flechas hasta el tope, izquierda en la 1, ida y vuelta, flecha
      mantenida, modificadores, teclas de juego, flecha y Esc en el mismo frame, y `preventDefault` en Esc y
      flechas.
    - «Esc mantenido».
    - Toda la sección «Escucha de teclado solo con la guía abierta»: 0, 1 y diez ciclos.
    - «Página sin recursos» (0 iconos).
    - «Hoja de icono que no carga»: el render no depende de la carga y no escucha `error`.
  - Test: `tests/infrastructure/dom/guide-modal.test.ts`.
- [ ] 4.3 **`MenuController` + `MenuPanel` + cableado + CSS** (design §4, §7).
  - Implementa:
    - Estado `guide` con `openGuide()` y `closeGuide()`.
    - El 5.º botón «Cómo jugar» en la 2.ª posición y las etiquetas en `menuText`.
    - `MenuPanel` recibe el `GuideModal`. Al cerrar el modal: `closeGuide`, después desbloquea los botones y
      después pone el foco en «Cómo jugar».
    - `wireProgress` y `main.ts` crean el modal con `booted.guide` y los iconos, y `menu.show` lo cierra.
    - Estilos `.guide-modal*` con scroll interno.
  - Escenarios:
    - Spec `main-menu`: «Carga sin parámetros» (5 botones en orden).
    - Spec `menu-guide`:
      - «Doble pulsación de Cómo jugar».
      - «Abrir no toca el progreso»: acciones espía con 0 llamadas.
      - «Cerrar con el botón» y «Cerrar con Esc» (foco en «Cómo jugar» y 5 opciones operativas).
      - «Pulsaciones del menú con la guía abierta».
      - «Cómo jugar con el diálogo de Borrar datos abierto».
      - «Jugar en el mismo frame que se abre la guía».
      - «Menú operativo tras cerrar».
      - «Guía cerrada antes de jugar» y «Volver al menú en modo E2E»: `show()` deja el modal cerrado.
      - «Carga en modo E2E»: ningún camino abre el modal salvo el clic.
    - Spec `main-menu`: «Opciones bloqueadas con el diálogo abierto» y «Teclas con el diálogo abierto», ambos con
      la guía no visible.
  - Tests:
    - `tests/infrastructure/menu/menu-controller.test.ts` (ampliar).
    - `tests/infrastructure/dom/menu-panel.test.ts` (nuevo).
- [ ] 4.4 Cierre del grupo: `npm run verify` en verde y commit 2.

## 5. E2E y documentación · commit 3

- [ ] 5.1 **Ampliar «Arranque y menú» de `smoke.spec.ts`**: es el único E2E del change, sin `?e2e`, solo DOM y
  sin umbrales de tiempo (design §8).
  - Comprobación previa: `tests/support/logicGuard.ts` solo veta `waitForTimeout`, `playChoosingFirst` y
    `expect.poll` sobre el tick, así que `setViewportSize` y `waitFrames` están permitidos (precedente en
    `gameplay.spec.ts:74`). El guard sigue en verde.
  - Pasos:
    1. Comprueba los 5 botones.
    2. Abre la guía: «1 de 7», sin Anterior.
    3. Pulsa 7 veces flecha derecha: «7 de 7», sin Siguiente.
    4. A 960 × 540 y a 1.920 × 1.080, tras `waitFrames`: recuadro y botones enteros, centro ±1 px por eje e
       indicador conservado. No se fija `uiScale`.
    5. Pulsa Esc: guía oculta, menú con 5 botones y foco en «Cómo jugar».
    6. Comprueba 0 diálogos nativos, 0 violaciones de CSP y consola limpia.
  - Escenarios:
    - Spec `menu-guide`: «Recorrido de la guía en el smoke [E2E]».
    - Spec `main-menu`: «Guía entera en la ventana mínima y con escala ×2», en la página 7, y «Guía abierta al
      redimensionar», con el indicador conservado. Los dos parcialmente.
    - Spec `world-camera`: «Redimensionado con la guía abierta», parcialmente.
  - Ejecución: `npm run test:e2e -- smoke.spec`.
- [ ] 5.2 **Documentación**:
  - Línea de estado de 0028 en `AGENTS.md` §1.
  - Entrada del diario de IA en `docs/ai-log/`.
  - `npm run verify` y `npm run test:e2e` en verde, y commit 3.
