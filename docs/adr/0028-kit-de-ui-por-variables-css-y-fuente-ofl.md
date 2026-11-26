# ADR-0028 · Kit de UI de Update 010 por variables CSS y NineSlice, con fuente OFL bajo procedencia

- **Estado**: propuesta (change 0032-ui-kit)
- **Fecha**: 2026-11-26

## Contexto
La interfaz (7 paneles DOM, 3 cartas y HUD en Phaser) pasa a usar las piezas de `Tiny Swords (Update 010)/UI/`
estiradas con nine-slice y una fuente pixel. Fuerzas:
- CSP `default-src 'self'; style-src 'self'; img-src 'self' data:` sin `font-src`: nada remoto, sin `data:` para
  fuentes y sin estilos en línea (CSSOM sí).
- Base `/tfm-survivors/` igual en `dev`, `preview` y Pages.
- Reserva obligatoria: si una pieza o la fuente no cargan, el aspecto de hoy y la partida jugable.
- Los datos de aspecto viven en `content/appearance.json` validado con zod; sin números mágicos en `src/`.
- Hasta ahora todo asset de terceros es CC0 (ADR-0012) y el guardarraíl solo conoce esa licencia. El pack no trae
  fuentes: la única vía es una fuente OFL, otra licencia con otras obligaciones (distribuir el aviso, no renombrar
  si se modifica).
- `NineSlice` de Phaser 4.2.1 solo pinta en WebGL y sus `slice` son px de textura.

## Opciones
CSS:
1. `url()` estáticos en `styles.css` (Vite antepone la base en build). Duplica márgenes y rutas del contenido, no
   avisa de fallos y deja asomar el fondo de reserva por las esquinas transparentes.
2. **Variables CSS publicadas por la composición** (`style.setProperty` en `#game`) solo para las piezas cuya
   textura cargó en `BootScene`, con `var(--x, <reserva>)` en `styles.css`.
3. Importar las piezas desde `src/` con Vite (hash): saca el arte de `public/assets/tiny-swords/` (contra ADR-0012).

Phaser: NineSlice con `setScale(uiScale)` + `setSize(w / k, h / k)` frente a reescalar texturas o crear piezas por
escalón. Fuente: `load.font` de Phaser (FontFace sin plazo: una fuente que no responde bloquea el arranque, y un
fallo de `FontFace.load()` no emite error de carga), un `@font-face` estático (misma duda de base que la opción 1 y
sin señal de carga para los `Text` del lienzo) o un **`FontFace` propio con plazo** (3.000 ms) que `BootScene`
espera antes de arrancar el menú.

Licencia de la fuente: (a) anotarla a mano en la nota; (b) **ampliar `guard-assets.mjs`** con una lista `fonts[]`
que exige `license` `OFL-1.1`, `licenseFile` versionado, `sha256` y `bytes`.

## Decisión
Opción **2**, NineSlice escalado por el escalón entero, `FontFace` propio con plazo de 3.000 ms y comprobación
`document.fonts.check`, y **(b)**. La reserva de un panel DOM sin su pieza es el borde de 1 px de siempre con el
relleno y las tintas de `panel` (decisión del autor); la de botones, cartas y HUD, el aspecto anterior. La sección `ui` de `appearance.json` es la única fuente de rutas, márgenes y tintas;
el DOM y Phaser la leen. Las fuentes de terceros solo entran con licencia OFL-1.1 y su aviso versionado; el arte sigue
siendo solo CC0 de Update 010.

## Consecuencias
- Positivas: un solo dato para dos tecnologías; esquinas de `slice × uiScale` px exactos; reserva sin código de
  error en CSS (sin variable no hay `border-image`); CSP intacta; licencia de la fuente comprobada en commit y CI.
- Negativas / costes: los paneles DOM dependen de que `BootScene` termine para tener aspecto final (hasta entonces,
  el de reserva); el CSS gana `calc()` y `max()` con variables, menos legible; en Canvas (sin WebGL) Phaser siempre
  usa la reserva; la nota de procedencia admite una segunda licencia.
- Cómo revertirla: borrar la sección `ui`, el bloque de `styles.css` y las llamadas a `createUiPanel`/`applyUiKit`
  devuelve el aspecto de hoy (es la reserva). Quitar `fonts[]` del guardarraíl exige antes retirar el `.woff2`.
