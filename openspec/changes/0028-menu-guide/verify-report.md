# Verify report · 0028-menu-guide

Rama `change/0028-menu-guide`, commits 8d03452, 87fed3b y d34b08f sobre 59d7e2a.

## Ejecución

- `npm run verify`: verde (lint, typecheck, `guard:all` con 1.125 ficheros, 300 ficheros y 3.582 tests).
- `npm run test:e2e -- smoke.spec`: 5/5 en verde (el de "Arranque y menú" recorre la guía).
- Los E2E de gameplay y progress no se han lanzado: el change no toca el núcleo ni el flujo de partida.

## Comprobaciones transversales

| Punto | Resultado |
|---|---|
| Capas | OK. Cero cambios en `src/domain` y `src/application`. `GuideModal` y `MenuPanel` (infraestructura), `loadGuide` y `bootContent` (composición). |
| CSP | OK. `GuideModal` solo usa `createElement`, `textContent`, atributos, clases y `hidden`: sin `innerHTML`, sin `style` y sin `cssText`. El icono de gema es un SVG `data:` (`img-src 'self' data:` ya está en `index.html`) y el smoke no registra violaciones. |
| `keydown` | OK. Alta en `open()`, baja en `close()` con la misma referencia (propiedad flecha), `open()` idempotente y `close()` idempotente. Cubierto en "Diez aperturas y cierres". |
| `guide.json` sin dígitos | OK. Lo prueba el test "Sin cifras escritas a mano". Las 14 claves se usan y no hay ninguna otra. |
| Balance | OK. Ningún fichero de `domain`, `application`, `content/` de balance ni `tests/support/balanceBaseline.ts` cambia: `BALANCE_BASELINE` es idéntica. |
| Assets | OK. Sin ficheros gráficos nuevos ni cambios en `asset-provenance.json`. |
| Secretos | Ninguno. |
| Esc y pausa | OK. `PauseKey` solo existe en `GameScene`, que no corre en modo menú, así que el Esc que cierra la guía no puede pausar. |
| tasks.md y commits | OK. Todas las tareas están marcadas, hay un commit por grupo (3, 4 y 5) y el commit 3.x lleva el contenido. |
| Árbol de trabajo | `git status` marca 9 ficheros como modificados, pero `git diff` está vacío: es ruido de finales de línea (CRLF), no cambios reales. |

## Escenario → Test → Estado

### menu-guide

| Escenario | Test | Estado |
|---|---|---|
| Primera apertura | `guide-modal.test.ts` | OK |
| Reabrir empieza en la página 1 | `guide-modal.test.ts` | OK |
| Doble pulsación de Cómo jugar | `menu-panel.test.ts` | OK |
| Abrir no toca el progreso | `menu-panel.test.ts` (0 llamadas a las acciones de progreso) | OK |
| Recorrido hacia delante / hacia atrás | `guide-modal.test.ts` | OK |
| Páginas intermedias con ambos controles | `guide-modal.test.ts` | OK |
| Foco tras llegar al tope | `guide-modal.test.ts` | OK |
| Una sola página visible | `guide-modal.test.ts` | OK |
| Cerrar con el botón / con Esc | `menu-panel.test.ts` | OK |
| Esc mantenido | `guide-modal.test.ts` y `menu-panel.test.ts` | OK |
| Jugar y pausa tras cerrar la guía | `menu-panel.test.ts` (Jugar con 1 pulsación y 0 escuchas; la pausa por Esc queda cubierta por la estructura) | OK, ver W1 |
| Flechas hasta el tope, izquierda en la 1, ida y vuelta | `guide-modal.test.ts` | OK |
| Flecha mantenida | `guide-modal.test.ts` | OK |
| Teclas con modificador | `guide-modal.test.ts` | OK |
| Teclas de juego con la guía abierta | `guide-modal.test.ts` | OK |
| Flechas y Esc en el mismo frame | `guide-modal.test.ts` | OK |
| `preventDefault` en Esc y flechas | `guide-modal.test.ts` | OK |
| Sin escuchador antes de abrir / uno abierta / diez ciclos | `guide-modal.test.ts` | OK |
| Pulsaciones del menú con la guía abierta | `menu-panel.test.ts` | OK |
| Cómo jugar con el diálogo de Borrar datos abierto | `menu-panel.test.ts` | OK |
| Jugar en el mismo frame que se abre la guía | `menu-panel.test.ts` | OK |
| Menú operativo tras cerrar | `menu-panel.test.ts` | OK |
| Carga sin parámetros | `menu-panel.test.ts` (5 botones) y smoke | OK |
| Carga en modo E2E | `menu-panel.test.ts` (ningún camino abre el modal salvo el clic) | OK |
| Volver al menú en modo E2E | `menu-panel.test.ts` (`show()` cierra la guía) | OK |
| Guía cerrada antes de jugar | `menu-panel.test.ts` | OK |
| Contenido por defecto válido | `guide-boot.test.ts` y `guide-schema.test.ts` | OK |
| Seis u ocho páginas | `guide-schema.test.ts` y `guide-boot.test.ts` | OK |
| Párrafo vacío o página sin párrafos | `guide-schema.test.ts` y `guide-boot.test.ts` | OK |
| Título vacío | `guide-schema.test.ts` y `guide-boot.test.ts` | OK |
| Páginas fuera de orden | `guide-schema.test.ts` y `guide-boot.test.ts` | OK |
| Marcador desconocido | `guide-schema.test.ts` y `guide-boot.test.ts` | OK |
| Llave suelta (`{` y `}`) | `guide-schema.test.ts` y `guide-boot.test.ts` | OK |
| Marcador sin valor en el contenido | `guide-markers.test.ts` (solo por `parseGuide`, sin `bootContent`) | OK, ver W2 |
| Recurso citado desconocido o repetido | `guide-schema.test.ts` y `guide-boot.test.ts` | OK |
| Campo desconocido | `guide-schema.test.ts` y `guide-boot.test.ts` | OK |
| Cifras con el contenido por defecto | `guide-markers.test.ts` | OK |
| Las cifras siguen al contenido | `guide-markers.test.ts` | OK |
| Segundos con decimal | `guide-markers.test.ts` | OK |
| Sin cifras escritas a mano | `guide-markers.test.ts` | OK |
| Catálogo usado entero | `guide-markers.test.ts` | OK |
| Iconos de las páginas de recursos y de obra | `resource-icons.test.ts` y `guide-modal.test.ts` | OK |
| Color de la gema desde el contenido | `resource-icons.test.ts` | OK |
| Página sin recursos | `guide-modal.test.ts` | OK |
| Sin assets nuevos | `guard:all` y nota de procedencia sin cambios | OK |
| Hoja de icono que no carga | `guide-modal.test.ts` (el render no depende de la carga) | OK |
| Recorrido de la guía en el smoke [E2E] | `smoke.spec.ts` "Arranque y menú" | OK, ver S1 |

### main-menu y world-camera

Los 26 escenarios de `main-menu` y los 7 de `world-camera` que el change toca o conserva están cubiertos:

- El menú de 5 botones y las teclas con la guía cerrada están en `menu-panel.test.ts` y en el smoke.
- "Opciones bloqueadas con el diálogo abierto" y "Teclas con el diálogo abierto" están en `menu-panel.test.ts`.
- "Guía entera en la ventana mínima y con escala ×2", "Guía abierta al redimensionar" y "Redimensionado con la guía abierta" tienen cobertura parcial en el smoke, como declaran las tareas: página 7, 960 × 540 y 1.920 × 1.080, y recuadro centrado con error ≤ 1 px.
- Los demás no cambian y siguen cubiertos por sus tests anteriores, que pasan.

## Desviaciones declaradas por el implementer

1. **`MenuPanel.show()` cierra la guía.** Aceptada. Garantiza "Volver al menú" sin guía y está probada en `menu-panel.test.ts`.
2. **Test del controlador en `tests/infrastructure/menu-controller.test.ts`**, no en `tests/infrastructure/menu/` como decía tasks.md. Ubicación: el fichero ya existía allí. Sin impacto (S3).
3. **Color de gema en minúsculas.** Aceptada. El test compara en minúsculas y el escenario `#12AB34` queda cubierto.
4. **"Marcador sin valor" solo vía `parseGuide`.** Ver W2.

## Hallazgos

### Critical

Ninguno.

### Warning

- **W1.** "Jugar y pausa tras cerrar la guía" no prueba que Esc pause la partida después de cerrar la guía. El test unitario solo comprueba Jugar con 1 pulsación y 0 escuchas, y el smoke no lo cubre. El riesgo es bajo: no queda ninguna escucha de la guía y `PauseKey` solo vive en `GameScene`. La parte de la pausa es el único tramo del escenario sin test directo. Resuélvelo ampliando el smoke (como máximo 1 E2E, sin esperas de reloj) o regístralo como aceptado.
- **W2.** "Marcador sin valor en el contenido" se prueba con `parseGuide` (`guide-markers.test.ts`), pero no con `bootContent` (no hay caso `structures` sin `goblin-tower` en la tabla `INVALID` de `guide-boot.test.ts`). El camino es el mismo (`parseGuide` va último), así que el riesgo es bajo. Falta la comprobación de que no se crea el menú.

### Suggestion

- **S1.** El smoke no comprueba que el HUD no sea visible con la guía abierta ni al cerrarla (el escenario lo pide en su último AND). Tampoco visita la página 3 para ver los iconos en el navegador (cubierto en Node, y la CSP de `data:` está comprobada en el HTML).
- **S2.** Líneas de más de 100 caracteres en comentarios de `MenuController.ts` (cabecera y cuerpo de la clase; lint no las marca). Conviene reajustarlas por la convención ≤ 100.
- **S3.** Alinear la ruta del test del controlador en `tasks.md` con la real, o mover el fichero a `tests/infrastructure/menu/`.

## Recuento

C: 0 · W: 2 · S: 3
