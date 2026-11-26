# Proposal · 0034-upgrade-icons

- **Estado**: aprobada por el autor (2026-11-26)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0034-upgrade-icons`

## Problema
Hoy las 15 mejoras solo se distinguen por su nombre y su descripción. Son 9 de personaje, en las cartas de subida
de nivel por XP, y 6 de arma, en la tienda del castillo. La curación de la tienda tampoco tiene imagen. Con el kit
de UI de 0032 las cartas y las filas de la tienda ya llevan marco del pack, pero dentro siguen siendo solo texto, así
que cuesta reconocer una mejora de un vistazo, sobre todo en móvil (0033), donde el texto sale más pequeño.

El pack Tiny Swords (Update 010) no trae objetos de inventario (cota, botas, frascos…): su carpeta `UI/Icons` solo
tiene glifos genéricos. Por eso el arte tiene que salir de otro sitio. El proyecto todavía no tiene una política de
procedencia para imágenes generadas con IA: el guardarraíl `guard-assets` exige hoy que todo gráfico sea
"Update 010".

## Objetivo
Cada carta de mejora de personaje y cada artículo de la tienda (6 mejoras de arma y la curación) muestra su icono.
El icono se liga por id en `content/` y se escala sin suavizado en cualquier tamaño de pantalla. Si un icono falta o
su imagen no carga, se ve el icono de reserva de su categoría y el juego sigue jugable. Todo icono versionado tiene su
procedencia registrada y vigilada por el guardarraíl. El núcleo no cambia: balance, ids y firmas siguen iguales.

## Decisiones del autor (tomadas antes de esta propuesta)
1. **Origen del arte: imágenes generadas con IA.**
   - Punto de partida: las 4 de la prueba previa, que están fuera del repo (`guardrail_chainmail`,
     `shortcuts_boots`, `strict_rules_arrowheads` y `heal_potion`). Son PNG de 64 × 64 con fondo transparente.
   - Prompt de estilo común: "single object, 3/4 view, thick dark outline, flat cel shading, few colors, plain white
     background". Un script quita después el fondo blanco.
   - El resto se genera con el autor durante el change. Las 4 de prueba se pueden regenerar si así mejora la
     coherencia de estilo.
   - La herramienta la elige el autor y queda registrada en cada icono.
2. **Política de IA**:
   - Un ADR nuevo, probablemente el ADR-0030. El architect hará `git fetch` antes de numerarlo.
   - Una lista aparte en `content/asset-provenance.json` con herramienta, fecha, términos de uso, prompt, `sha256` y
     `bytes`, vigilada por `guard-assets`. Ningún icono puede quedar sin entrada.
   - El Won't del GDD "enemigos dibujados con IA" se mantiene: la IA solo se admite para los iconos de las mejoras y
     la curación.
3. **Datos**:
   - Un mapa de iconos por id en `content/appearance.json`, validado con zod.
   - Al arrancar, la composición cruza esos ids con `upgrades.json`. Un id que no existe es un error de contenido; una
     mejora sin icono usa la reserva.
4. **Reserva por categoría**: 2 iconos, uno de personaje y otro de arma. Se usa cuando la mejora no tiene icono o
   cuando su imagen falla al cargar.
5. **Alcance del arte**: 16 iconos, uno por cada una de las 15 mejoras más la poción de curación. Son PNG de 64 × 64
   sueltos y transparentes, escalados con `NEAREST` en la carta (Phaser) y en la tienda (DOM), también con la escala
   ×1/×2 y con el k fraccionario del modo móvil.
6. **Núcleo intacto**: el balance es idéntico a `BALANCE_BASELINE` y no cambian ni los ids de mejora ni las firmas.
   Se aplica la regla e2e-lite: como mucho 1 o 2 E2E.

## Alcance
- **Dentro**:
  - 16 iconos (15 mejoras y la curación) más 2 de reserva (personaje y arma). Son PNG de 64 × 64 transparentes,
    versionados en `public/assets/`.
  - Los iconos de prueba se pueden regenerar. Si el fondo se quita con un script, el paso es reproducible y va
    versionado.
  - Mapa de iconos por id en `content/appearance.json`, con su esquema zod.
  - Cruce de ids con `upgrades.json` en la composición: un id desconocido es un error de contenido y se muestra con
    `showContentError`.
  - Icono en la carta de mejora de personaje: hueco reservado en el layout puro de la carta, con escala ×1/×2 y con el
    k fraccionario del modo móvil.
  - Icono en cada fila de la tienda (6 mejoras de arma y la curación): un `<img>` con URL del mismo origen (la CSP
    `img-src 'self' data:` no cambia) y escalado `pixelated`.
  - Reserva por categoría cuando falta el icono o la imagen no carga.
  - Procedencia de las imágenes IA:
    - lista nueva en `content/asset-provenance.json`;
    - `guard-assets` y `registeredPaths` ampliados para leerla;
    - ADR de la política de IA (probable 0030);
    - nota en `docs/ai-log/`.
  - Una sonda E2E del estado del icono (`painted` o `fallback`) en la oferta y en la tienda, si el design la
    necesita para el único E2E.
- **Fuera**:
  - Iconos para el panel de obra, el HUD, los enemigos u otras entidades. El Won't "enemigos dibujados con IA" sigue
    vigente.
  - Cambiar los ids, los textos, los niveles o los precios de las mejoras, y cualquier cambio en el núcleo
    (`src/domain`, `src/application`), el balance o las firmas.
  - Atlas u hoja única de iconos: van como PNG sueltos.
  - Reservas por stat o por familia: solo hay 2 categorías.
  - Animación de los iconos.
  - Cambios en la CSP.
  - Regenerar el arte del pack o recolorear piezas de Update 010.

## Capacidades afectadas
- `openspec/specs/upgrades` (modificada): la carta de mejora con icono y su reserva.
- `openspec/specs/castle-shop` (modificada): la fila de la tienda con icono, curación incluida, y su reserva.
- `openspec/specs/asset-provenance` (modificada): la lista de imágenes IA, sus campos obligatorios y el
  guardarraíl.
- `openspec/specs/sprite-rendering` (modificada): mapa de iconos en `appearance.json`, cruce de ids, carga y
  escalado `NEAREST`.
- `openspec/specs/mobile-display` (modificada, si hace falta): el hueco del icono con k fraccionario.

## Riesgos y dudas
- **Términos de uso de la herramienta de IA**: hay que leer la licencia sobre las salidas de cada herramienta antes
  de versionar nada. Si unos términos no permiten publicar las salidas en un repositorio público, ese icono no entra
  y se usa la reserva.
- **Coherencia de estilo**: las pruebas tienen más detalle que Tiny Swords. El alfa binario puede dejar un halo
  blanco y el reescalado a 52 px dentro del lienzo de 64 deja escalas no enteras.
- **Cupo de generación**: se agotó el cupo gratuito en la prueba, así que generar 12 o más imágenes puede alargar el
  change varios días. Hasta tenerlas todas, la reserva cubre las que falten.
- **Espacio**: la carta mide 240 × 170 × k y su texto ya va apretado. La fila de la tienda tiene 3 columnas y scroll
  en móvil. Añadir el icono puede mover tests de `cardLayout` y `mobileFrame` que fijan posiciones.
- **Pendiente de design**:
  - dónde va el icono en la carta (arriba o al lado) y a qué tamaño;
  - si la curación usa la reserva de arma cuando su imagen falla, o una reserva propia (en ese caso serían 3);
  - el nombre y la forma de la sonda.
- **Prompts de la prueba previa**: hay que recuperarlos del historial de la herramienta. Si no se pueden recuperar,
  esos iconos se regeneran con un prompt registrado.

## Criterio de éxito
- Hay 16 entradas en el mapa de iconos de `appearance.json`, todas con id válido. Un id desconocido da error de
  contenido y una mejora sin entrada muestra la reserva de su categoría.
- Los 16 PNG y las 2 reservas versionados miden 64 × 64, tienen canal alfa y una entrada en la lista de imágenes IA
  con herramienta, fecha, términos, prompt, `sha256` y `bytes`. `npm run guard:all` falla si se añade un PNG sin
  entrada o con un sha distinto.
- Con una imagen que no carga, la carta o la fila muestra la reserva y la oferta se puede elegir o comprar igual.
- El layout puro de la carta reserva el hueco del icono a ×1, a ×2 y con k fraccionario, sin solaparse con el
  nombre, la descripción ni el nivel.
- El balance con las semillas 1..50 es idéntico a `BALANCE_BASELINE`, las seis firmas no cambian y tampoco los ids
  de `upgrades.json`.
- `npm run verify` y `npm run test:e2e` pasan en verde, con 2 E2E nuevos o ampliados como mucho.
