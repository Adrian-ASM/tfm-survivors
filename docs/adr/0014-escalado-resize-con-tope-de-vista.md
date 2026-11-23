# ADR-0014 · Lienzo a ventana completa (Scale.RESIZE) con tope de vista y UI por escalones enteros

- **Estado**: propuesta (change 0017-fullscreen-view)
- **Fecha**: 2026-11-23

## Contexto
Hasta el change 0016 el lienzo era fijo, de 960 × 540 (`arena.view`), y en un monitor de escritorio el juego
ocupaba una franja pequeña. La historia 0017 pide ocupar toda la ventana y ver más mapa. Las fuerzas en juego:
- **Nitidez del pixel art**: cualquier reescalado no entero lo emborrona.
- **Equidad**: un monitor mayor ve más mapa.
- **Coste de render en CI sin GPU**.
- **HUD legible** en pantallas grandes.
- **Núcleo puro (ADR-0002)**: el tamaño de la ventana no puede entrar en la simulación.

Phaser 4.2.1 ofrece `Scale.RESIZE`: el lienzo toma el tamaño del padre y lo recorta con `min`/`max`
(`ScaleManager.updateScale`). También ofrece `FIT`/`ENVELOP`/`EXPAND` y el zoom de cámara.

## Opciones
1. **RESIZE a zoom 1 con tope `max`**: se ve más mapa hasta el tope, sin reescalado. HUD y overlays tienen que
   recolocarse en cada RESIZE.
2. **RESIZE + zoom de cámara** para acotar la visión: el zoom no entero emborrona, y hace falta una cámara de UI o
   contraescalar el HUD.
3. **FIT/ENVELOP con resolución virtual fija**: no se ve más mapa, solo más grande; aparecen barras o recortes y la
   imagen sale borrosa.

## Decisión
**Opción 1.**
- `scale: { mode: RESIZE, max: maxView (2.560 × 1.440, contenido), snap: 1 × 1, autoCenter: NO_CENTER }`.
- Por encima del tope, el lienzo se queda en 2.560 × 1.440, centrado por la rejilla CSS de `#game`, con bandas del
  fondo de la página.
- Sin Fullscreen API: F11 del navegador entra por el mismo RESIZE.
- HUD y overlays se colocan con funciones puras a partir de un `ScreenFrame`: tamaño entero del lienzo y
  `uiScale = max(1, ⌊min(W/960, H/540)⌋)`, es decir ×1 o ×2 con el tope actual. El texto se vuelve a pintar a su
  tamaño final (no se reescala el objeto).
- Menú, pausa, diálogo y resultados son bloques DOM únicos (título del menú y líneas de resultados incluidos),
  centrados por la rejilla CSS y escalados con la variable `--ui-scale` que la composición pone en cada RESIZE.
- Una ayuda `watchScreen` se suscribe a `Scale.Events.RESIZE` y quita la suscripción en `SHUTDOWN` de la escena,
  porque el `ScaleManager` es global al juego.
- No se activa `pixelArt` ni `roundPixels`.

## Consecuencias
- Positivas:
  - Nítido a DPR 1.
  - Se ve más mapa hasta el tope.
  - La simulación no cambia: el tamaño de ventana vive solo en infraestructura.
  - El layout es puro y se prueba sin navegador.
  - RESIZE llega como mucho una vez por frame (`PRE_STEP`).
- Negativas / costes:
  - Ventaja informativa en ventanas mayores, acotada por el tope.
  - Con ventanas de menos de 768 px de ancho la fila de cartas a ×1 se recorta (no hay mínimo de ventana).
  - Con DPR > 1 el navegador reescala igual que antes.
  - Más trabajo en cada widget (`relayout`).
  - El lienzo de 2.560 × 1.440 cuesta más de pintar (Playwright se fija a 1.280 × 720).
- Cómo revertirla:
  - Volver a un tamaño fijo es quitar `scale` en `main.ts` y pasar un frame fijo a `watchScreen`; los layouts puros
    siguen valiendo.
  - Pasar a la opción 2 añadiría zoom en `CameraRig` y una cámara de UI.
