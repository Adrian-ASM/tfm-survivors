# Proposal · 0036-ui-polish

- **Estado**: aprobada por el autor (2026-11-27)
- **Issue**: —
- **Rama / worktree**: `change/0036-ui-polish`

## Problema
La interfaz tiene asperezas que se notan al jugar (ver `exploration.md`):
- Cada modal se cierra de una forma distinta: `Salir` abajo en la tienda y en la obra, `Cerrar` abajo en la guía y en
  Sonido. No hay un gesto común para cerrar.
- Algunos botones DOM no centran su texto. Está confirmado leyendo el código: `.build-panel button` lleva
  `display:flex; justify-content: space-between`, así que el `Salir` de la obra queda pegado a la izquierda, y
  `.shop-panel button` lleva `text-align:left`, que se corrige a mano en `.shop-panel__leave`.
- Las barras de vida de las casas y torres goblin se ven desde el tick 0 aunque nadie las haya tocado. Eso llena el
  mapa de barras que no informan de nada. El autor quiere otro comportamiento; no es un bug, porque hoy el escenario
  vivo «Barra llena al empezar» lo exige.
- Los iconos de recursos son pequeños: 2em en la guía y en la obra, y 16 px a ×1 en el HUD sobre un frame de 128 px
  donde el dibujo ocupa solo una parte.
- En el HUD las bajas son la única cifra con etiqueta de texto («Bajas: N»). Los demás contadores usan icono y número.
- La obra ofrece «casa» y «torre» sin imagen y sin decir qué hace cada una.

## Objetivo
Una interfaz más coherente y legible, sin tocar la simulación. Al terminar el change:
1. **Cierre con ×.** La tienda, la obra, la guía y Sonido tienen un botón `×` en la esquina superior derecha de su
   recuadro y ya no tienen `Salir` ni `Cerrar` abajo. La `×` hace exactamente lo mismo que Esc en cada modal: sale de
   la tienda o de la obra con su caso de uso de salida sin abrir la pausa, cierra la guía y cierra Sonido, desde el menú
   o desde la pausa. Su nombre accesible es `Salir` en la tienda y la obra y `Cerrar` en la guía y Sonido, de modo que
   `getByRole('button', { name })` siga encontrándola. El menú, la pausa, el diálogo de confirmación y los resultados
   no tienen `×`. El texto de `content/guide.json` que dice «Sal de la tienda con Salir o con Esc» se reescribe para
   nombrar la `×`; el redactado lo fija la spec.
2. **Texto centrado.** Todo botón DOM de una sola etiqueta tiene su texto centrado en horizontal y en vertical dentro
   de la cara visible de su pieza. Las filas de producto (tienda) y de edificio (obra) conservan su disposición
   interna. Las cartas de mejora de Phaser se revisan; solo se tocan si una captura muestra un descentrado.
3. **Barra de vida por daño.** Una estructura no muestra barra hasta el primer frame que pinta un snapshot en el que
   su vida es menor que su vida máxima. Desde ese frame conserva la barra hasta que queda en ruina, y en ruina sigue
   sin barra, como hoy. El estado se reinicia con cada partida nueva (R, ↻ o Volver al menú → Jugar).
4. **Iconos de recursos más grandes** en la guía (`GuideModal`), en la obra (coste y «faltan N») y en las filas de oro,
   madera y piedra del HUD, con más separación entre filas. Las cifras de la exploración son orientativas (unas 3em en
   el DOM y unos 24 px a ×1 en el HUD); las fija el design.
5. **Calavera en el HUD.** El contador de bajas del HUD pasa a ser un icono de calavera (un frame de
   `Factions/Knights/Troops/Dead/Dead.png`, ya registrada) más el número. La pantalla de resultados conserva
   «Bajas: N».
6. **Obra explicada.** Cada fila de la obra lleva el icono de su edificio (`House_Blue` y `Tower_Blue`, ya
   registradas) y una explicación muy breve, con las cifras **interpoladas desde `content/buildings.json`** (por
   ejemplo, casa «+1 oro cada 30 s» y torre «dispara a los enemigos cercanos»). Ningún número se escribe en el código
   ni se repite en otro fichero. El redactado final lo fija la spec.

## Alcance
- **Dentro**:
  - DOM: `ShopPanel`, `BuildPanel`, `GuideModal`, `SoundPanel` (la `×` y la retirada de `Salir` y `Cerrar`),
    `styles.css` (centrado, `×`, tamaños de icono) y textos de `menuText.ts`.
  - Phaser: el HUD (layout de filas, tamaño de icono, contador de bajas con icono, textos de reserva de los paneles) y
    `HealthBarLayer` (visibilidad por primer daño).
  - Contenido de aspecto y textos: `appearance.json` (icono de bajas, iconos de edificio y tamaños si van en datos),
    `guide.json` y los textos de la obra con interpolación validada con zod. Si se añade un esquema o un cruce en
    `bootContent`, su error de contenido se muestra por `showContentError`, como el de la guía.
  - Sondas E2E solo si hacen falta. Si cambia `window.__sprint.hud`, se actualiza su `toEqual` en `smoke.spec`.
- **Fuera**:
  - Núcleo (`src/domain`, `src/application`), simulación, balance, `BALANCE_BASELINE`, `BUILDER_REFERENCE` y las siete
    firmas doradas. Objetos del mapa: siguen 820/904 en las semillas 42/123.
  - Arqueros en las torres goblin (pasan al change 0037) y personajes (pasan al 0038).
  - Renumerar el GDD y las referencias a 0036/0037 en `docs/gdd.md`, `AGENTS.md` y las specs: lo hace el
    `game-designer` aparte.
  - El texto «Bajas: N» de resultados, el cierre del menú, la pausa, el diálogo de confirmación y los resultados.
  - Assets nuevos: no se añade ninguno; la calavera y los edificios ya están registrados en `asset-provenance.json`.
  - Barras de vida para enemigos, ovejas, jugador o edificios propios (siguen sin barra).

## Capacidades afectadas
- `openspec/specs/castle-shop` (modificada): «Overlay de la tienda» («Salir con Esc o con el botón», botón `Salir` en
  el overlay visible) y «Aspecto del overlay de la tienda con piezas de UI» (oro, título y `Salir` siempre enteros, y
  la lista sin solaparse con `Salir`).
- `openspec/specs/build-sites` (modificada):
  - El panel de obra (botón `Salir`, «Salir con Esc o con el botón», `Salir` activo).
  - Las filas, que ganan icono de edificio y explicación interpolada.
  - El tamaño de los iconos de coste: hoy el E2E exige ≥ 20 × 20 px.
  - Su maquetación con piezas de UI: saldo, 2 filas y `Salir` dentro del área útil.
  - Los escenarios de salida por caso de uso («Salir no reabre», «Salir y seguir») no cambian.
- `openspec/specs/menu-guide` (modificada):
  - Controles visibles exactos: `Anterior`, `Siguiente` y `Cerrar`, con `Cerrar` en todas las páginas.
  - «Cerrar la guía», el listener de teclado con ciclos `Cerrar`/Esc y el aspecto con piezas.
  - Los iconos de recurso (tamaño) y el texto de la página de la tienda.
- `openspec/specs/audio` (modificada): el panel `Sonido` con su botón `Cerrar` (contenido, aspecto y escenarios de
  apertura y cierre).
- `openspec/specs/main-menu` (modificada): la maquetación de la guía al redimensionar (`Anterior`, `Siguiente` y
  `Cerrar` enteros, y pulsar `Cerrar` tras pasar a 960 × 540). Es una referencia cruzada; se revisan también las de
  Esc.
- `openspec/specs/hud` (modificada):
  - «Bajas en el HUD», que pasa a icono más número.
  - «HUD anclado a la ventana»: el icono y el número de bajas forman un elemento, y el escenario «HUD entero y sin
    solapes» se repite con los iconos mayores.
  - «Oro y madera en el HUD» y «Piedra en el HUD» (tamaño del icono).
  - «Paneles del HUD con piezas de UI» (textos de reserva).
- `openspec/specs/sprite-rendering` (modificada):
  - «Barras de vida de las estructuras»: se sustituye «Barra llena al empezar» y se añaden la aparición con el primer
    daño y el reinicio en una partida nueva.
  - «Sonda de los números de daño y de las barras»: `healthBars` pasa a contar las estructuras dañadas y no
    destruidas.
  - El aspecto del icono de bajas, si su frame se declara en datos.
- `openspec/specs/mobile-display` (modificada solo si hace falta): la `×` debe cumplir la regla de botones DOM de
  ≥ 44 × 44 px CSS en modo móvil. La zona pulsable puede ser mayor que el glifo.
- Sin cambios: `touch-controls` (la ⏸ sigue siendo Esc; «Salir de pantalla completa» no tiene que ver con esto),
  `simulation-loop`, `sheep` y `xp-gems`, donde «Bajas» significa bajas de la simulación.

## Riesgos y dudas
- **Barras.** Hoy no hay regeneración de estructuras, así que «vida < máxima» y «ya dañada» coinciden. La spec fija
  «desde el primer daño», que sigue valiendo si un día hubiera regeneración. Es una decisión de comportamiento que el
  design implementa en el adaptador sin tocar el núcleo. La causa del aspecto actual (barras visibles desde el
  principio) deja de importar: el nuevo contrato se comprueba con el doble de `Graphics` y con la sonda `healthBars`,
  que pasa de 7 a 0 al empezar en la semilla 42.
- **Tests con texto exacto.** Hay que actualizar:
  - El snapshot `dom-unchanged.test.ts.snap` y `dom-unchanged.test.ts`.
  - `shop-panel.test.ts`, `build-panel.test.ts`, `styles-ui.test.ts` (`.shop-panel__leave`) y `guide-modal.test.ts`.
  - `hud-format.test.ts` (`Bajas: 12345`), `ui-layout.test.ts`, `hud-panels.test.ts` y `hud.test.ts`.
  - Los E2E que buscan `Salir` o `Cerrar` por rol, que siguen valiendo si se conserva el nombre accesible.
- **HUD.** Con iconos de unos 24 px el paso actual de 18 px entre filas se solapa. Hay que subirlo y comprobar que el
  HUD queda entero y sin solapes desde 960 × 540 y con k fraccionario en móvil.
- **La `×`.** No debe pisar el título centrado ni la lista desplazable de la tienda en ventanas estrechas. Necesita
  foco visible y `blur()` tras el clic, como los demás botones.
- **Textos de la obra.** Interpolarlos exige un esquema zod y un cruce de claves, que pueden dar un error de contenido
  nuevo. Hay que convertir 1.800 ticks a segundos con `TICK_MS` sin escribir la cifra a mano.
- **E2E ligeros.** Como máximo 1–2 E2E nuevos, a ser posible ampliando los de humo (Tienda, obra y guía en
  `gameplay.spec`), en modo `?e2e&manual`. Todo lo demás se cubre con tests unitarios o de adaptador con dobles.

## Criterio de éxito
- Todos los escenarios ADDED y MODIFIED del change en verde, cada uno con su test. `npm run verify` y `npm run test:e2e`
  (proyecto `logic`) en verde.
- En la tienda, la obra, la guía y Sonido hay exactamente 1 botón `×` en la esquina superior derecha del recuadro,
  con nombre accesible `Salir` en la tienda y la obra y `Cerrar` en la guía y Sonido, y no queda ningún otro botón con
  esos textos visibles. Pulsarla produce el mismo estado que Esc: mismo snapshot, 0 ticks ejecutados y la pausa sin
  abrir.
- En cada botón DOM de una sola etiqueta, el centro del texto y el centro de la cara visible de la pieza no se separan
  más de 1 px en x ni en y (medido con las cajas del DOM, a 1.280 × 720).
- Con el contenido por defecto y la semilla 42, el primer frame tiene `healthBars` 0. Tras el primer frame en que una
  estructura tiene vida < máxima, su barra se ve en todos los frames hasta su ruina y en ninguno después. Una partida
  nueva vuelve a 0.
- Los iconos de recurso de la guía, de la obra y del HUD miden lo que fije el design, siempre más que hoy (> 2em en el
  DOM y > 16 px a ×1 en el HUD). El HUD con 12.345 bajas y los contadores máximos queda entero y sin solapes a 960 × 540,
  1.280 × 720, 1.920 × 1.080, 2.560 × 1.440 y 3.840 × 2.160.
- El HUD muestra el icono de calavera con el número de bajas completo (12345, sin abreviar) y sin la palabra «Bajas».
  La pantalla de resultados sigue mostrando «Bajas: N».
- Cada fila de la obra muestra el icono de su edificio y una explicación cuyas cifras salen de `content/buildings.json`.
  Cambiar un valor en el contenido de prueba cambia el texto, y ningún literal numérico de esos textos está en `src/`.
- `BALANCE_BASELINE` (34/50), `BUILDER_REFERENCE`, las siete firmas doradas y los 820/904 objetos del mapa siguen
  idénticos; `guard:all` en verde y ningún asset nuevo en `asset-provenance.json`.
