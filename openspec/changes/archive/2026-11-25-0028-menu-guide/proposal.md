# Proposal · 0028-menu-guide

- **Estado**: aprobada por el autor (2026-11-25)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0028-menu-guide`
- **Historia**: GDD 0028 · menu-guide (Should, pequeño)

## Problema
El juego ya tiene XP y mejoras de personaje, cinco recogibles (oro, madera, carne, piedra y gemas), tienda en el
castillo, solares de obra, enemigos con comportamientos propios y campamentos goblin. Nada de eso se explica dentro
del juego: el jugador nuevo solo lo descubre probando y fallando. El menú de inicio solo ofrece Jugar, Exportar,
Importar y Borrar datos.

## Objetivo
En el menú de inicio hay un botón «Cómo jugar» que abre un modal con 7 páginas que explican las mecánicas, en el
orden del GDD. Se navega con ratón (anterior, siguiente, cerrar) y con teclado (flechas y Esc). Al cerrarlo se vuelve
al menú sin que empiece ninguna partida. Los textos viven en `content/guide.json`, validado con zod, y las cifras
se toman del contenido cargado, así que coinciden siempre con el balance real.

## Decisiones del autor (cerradas en el gate)
1. **Fichero de textos**: `content/guide.json` nuevo, validado con zod. Entra por la misma vía de presentación que
   `appearance.json` (`RawBoot` / `bootContent`), fuera de `RunConfig`. Tiene **exactamente 7 páginas** en este
   orden: (1) movimiento y armas automáticas, (2) XP y mejoras de personaje, (3) recursos (oro, madera, carne,
   piedra, gemas), (4) castillo-tienda, (5) solares de obra (casa y torre), (6) enemigos y campamentos y
   (7) victoria y derrota. Ningún texto de las páginas va fijo en el código.
2. **Cifras interpoladas**: los textos llevan marcadores con nombre (p. ej. `{buildings.house.wood}`) que se
   rellenan con los valores del contenido ya cargado y validado. La validación rechaza al arrancar cualquier
   marcador desconocido. No se escribe a mano ninguna cifra que exista en otro fichero de `content/`.
3. **Teclado**:
   - Con el modal abierto, Esc lo cierra.
   - Flecha derecha pasa a la página siguiente y flecha izquierda a la anterior. En la primera y en la última página,
     la flecha hacia fuera no hace nada.
   - Al abrir, el foco pasa al modal. Al cerrar (con ratón o con Esc), el foco vuelve al botón «Cómo jugar».
   - No hay focus trap completo.
   - El listener de teclado del DOM **solo existe mientras el modal está abierto**: se registra al abrir y se quita
     al cerrar.
4. **Iconos**: las páginas de recursos y de obra (y cualquier otra que cite oro, madera, piedra, carne o gemas)
   reutilizan los iconos de recurso del HUD (`resourceIcons`). No hay assets gráficos nuevos ni entradas nuevas en
   `asset-provenance.json`.
5. **Posición del botón**: el orden pasa a ser `Jugar`, `Cómo jugar`, `Exportar`, `Importar` y `Borrar datos`.
   Cambia el requisito vivo "exactamente cuatro opciones" de `main-menu`.
6. **E2E y sonda**: no hay sonda E2E nueva. Como mucho se añade un E2E, y lo hace ampliando "Arranque y menú" de
   `smoke.spec.ts`, observando el DOM. Con `?e2e`, el modal nunca aparece por sí solo, ni al cargar ni al volver al
   menú.
7. **`guide.json` inválido**: recibe el mismo tratamiento que el resto del contenido. Hay error de contenido al
   arrancar (`showContentError`) y no se crea el menú.
8. **Núcleo y balance intactos**: no se toca `src/domain` ni `src/application`. El balance es idéntico a
   `BALANCE_BASELINE`, sin regenerarla.

## Alcance
- **Dentro**:
  - Botón «Cómo jugar» en el menú de inicio, en la segunda posición.
  - Modal DOM con título de página, indicador de página (n de 7) y controles anterior, siguiente y cerrar. En la
    primera página no hay anterior y en la última no hay siguiente.
  - Mientras el modal está abierto, las demás opciones del menú no tienen efecto (mismo patrón que el diálogo de
    Borrar datos).
  - Navegación por teclado: Esc y flechas izquierda/derecha, con foco al abrir y al cerrar, según la decisión 3.
  - `content/guide.json` con su schema zod, el catálogo cerrado de marcadores y su interpolación desde el contenido
    cargado.
  - Los errores de validación (número de páginas distinto de 7, texto vacío, marcador desconocido) se muestran como
    error de contenido al arrancar.
  - Iconos de recurso del HUD en las páginas que los citan.
  - El modal cabe y queda centrado en la ventana mínima de 960 × 540 y con la escala de UI ×2, igual que el resto
    de overlays del menú.
  - Tests unitarios o de infraestructura en Node para la paginación, los topes, el teclado, el foco, el ciclo de
    vida del listener, el schema y los marcadores. Como mucho, 1 E2E en el smoke.
- **Fuera**:
  - Cambios en el núcleo de simulación, en el balance, en las firmas doradas o en el progreso guardado.
  - Abrir la guía desde la pausa, desde los resultados o durante la partida.
  - Tutorial interactivo, imágenes o capturas nuevas, animaciones del modal.
  - Traducciones o selector de idioma.
  - Focus trap completo y otras mejoras de accesibilidad que no estén en la decisión 3.
  - Sonda `window.__sprint` nueva o ampliación de `screens`.
  - Mover a `content/` las etiquetas actuales del menú (`MENU_LABELS`).

## Capacidades afectadas
- `openspec/specs/main-menu` (**modificada**):
  - MODIFIED "Menú de inicio al cargar": cinco opciones, en el orden nuevo.
  - Retoque de "Arranque directo con e2e" (el escenario "Menú tras Volver al menú" cita "sus cuatro opciones") y de
    "Menú y pausa centrados en la ventana" si debe cubrir el modal.
  - Nueva etiqueta visible exacta `Cómo jugar` en las convenciones.
- `openspec/specs/menu-guide` (**nueva**):
  - Apertura y cierre del modal sin partida.
  - Orden y topes de las 7 páginas.
  - Teclado y foco.
  - Ciclo de vida del listener.
  - Opciones del menú bloqueadas con el modal abierto.
  - No aparece solo con `?e2e`.
  - Contenido `guide.json` validado (7 páginas, marcadores conocidos, error de contenido).
  - Cifras interpoladas iguales a las del contenido.
  - Iconos de recurso.
- Sin cambios: `simulation-loop`, `run-state`, `progress-persistence`, `hud` (solo se reutilizan sus iconos) y
  `architecture-guardrails` (la regla 5 se cumple con zod; no hay regla nueva).

## Riesgos y dudas
- **Texto largo en 960 × 540 con UI ×2**: puede desbordar. Hará falta un ancho máximo y quizá scroll interno. El
  design decide cómo; la spec fija que el modal y sus controles caben enteros y centrados (±1 px).
- **Primer listener de teclado DOM**: puede chocar con el `blur()` de `button()` (0009) y con el Esc de Phaser.
  Queda acotado porque el modal solo existe en modo menú, donde Esc no tiene efecto. Hay que comprobar que, al
  cerrar, no queda ningún listener y que Esc en el menú sin modal sigue sin efecto.
- **Catálogo de marcadores**: es una mini-plantilla que hay que mantener. Si un reequilibrio renombra un campo, el
  arranque falla con error de contenido. Es el comportamiento buscado, pero lo verá quien reequilibre.
- **Marcadores con valores derivados**: algunas cifras son derivadas (p. ej. la victoria a 10:00 a partir de ticks,
  o el intervalo de ingreso de la casa en segundos). El design fija el formato de cada marcador; la spec da el texto
  esperado con el contenido por defecto.
- **Smoke de botones**: el smoke actual fija la lista exacta de cuatro botones y hay que actualizarlo. Que Jugar
  siga arrancando con una sola pulsación lo cubre la spec viva y no cambia.
- **Carga en `bootContent`**: un JSON más en el bundle. La CSP no cambia (sin `innerHTML`, solo `textContent`).

## Criterio de éxito
- Todos los escenarios de `specs/main-menu` y `specs/menu-guide` del change tienen test y pasan en verde.
  `npm run verify` y `npm run test:e2e` (proyecto `logic`) en verde.
- Menú sin `?e2e`: exactamente 5 botones visibles, en el orden `Jugar`, `Cómo jugar`, `Exportar`, `Importar`,
  `Borrar datos`.
- Navegación en el modal:
  - Al abrirlo se ve la página 1 de 7.
  - 6 pulsaciones de siguiente (o de flecha derecha) llevan a la página 7. En la 7 no hay siguiente y otra flecha
    derecha la deja en la 7.
  - En la 1 no hay anterior y la flecha izquierda la deja en la 1.
- Cerrar (botón o Esc) deja el menú visible, sin partida y con el foco en «Cómo jugar». Después ya no queda ningún
  listener `keydown` del modal registrado.
- Con `?e2e`, el modal no es visible al cargar ni tras Volver al menú.
- `guide.json` con 6 u 8 páginas, con un texto vacío o con un marcador desconocido hace que el arranque muestre el
  error de contenido y no cree el menú.
- Con el contenido por defecto, cada cifra interpolada coincide con su fuente: casa 15 madera y 1 oro cada
  1.800 ticks, torre 30 madera + 15 piedra (`buildings.json`), carne 20 % (`resources.json`) y victoria a 10:00
  (`run.json`). En `guide.json` no aparece ninguna de esas cifras escrita literalmente.
- Ningún fichero nuevo en `assets/` ni entrada nueva en `asset-provenance.json`. Como mucho 1 E2E nuevo o ampliado.
- `src/domain` y `src/application` sin cambios. Balance idéntico a `BALANCE_BASELINE` (34/50 con el bot v4 tras
  0027 y 0 quietos), sin regenerarla.
