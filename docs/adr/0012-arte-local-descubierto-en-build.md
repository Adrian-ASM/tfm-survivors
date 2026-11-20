# ADR-0012 · Arte local descubierto en build, placeholders y animación por reloj de render

- **Estado**: propuesta (change 0012-sprite-rendering)
- **Fecha**: 2026-11-20

## Contexto
El change 0012 pasa de círculos a sprites animados. El arte final no está elegido y el provisional no tiene una
licencia que permita redistribuirlo, así que el repositorio y el despliegue público no pueden llevar PNG del pack.
Fuerzas que influyen:
- CI, los E2E y Pages se ejecutan **sin** pack, y tienen que pasar con 0 errores en consola. Una petición a un PNG
  que no existe da 404, y Chromium lo registra como `console.error` ("Failed to load resource"): rompería
  `smoke.spec.ts` y el resto de colectores de errores.
- La CSP de 0007 (`img-src 'self' data:`) bloquea las URL `blob:` que crea el Loader de Phaser cuando descarga las
  imágenes por XHR (hallazgo del spike `spike/sprites`).
- Hay dos arranques (menú y `?e2e`) y la partida no puede pintar con texturas sin cargar.
- El mundo se detiene en pausa y al elegir mejora, y las animaciones tienen que congelarse con él. Las
  animaciones de muerte no pueden quedar colgadas si la escena se apaga a mitad.
- Cambiar de pack tiene que consistir en editar `content/appearance.json` y la carpeta local, sin tocar `src/`.

## Opciones
1. **Pedir siempre en runtime** las hojas del manifiesto (`public/art/`) y degradar a placeholder con
   `FILE_LOAD_ERROR`. Es simple, pero sin pack cada carga da N errores 404 en consola, y `public/` se copia entero a
   `dist/`: una build local con pack lo publicaría.
2. **Descubrir el arte en build** con `import.meta.glob` sobre una carpeta local ignorada por git (`art/`). Solo se
   piden las hojas que existían al compilar. Si falta el pack, no hay ninguna petición.
3. **Versionar un pack CC0 de referencia**. Resuelve CI, pero obliga a elegir arte ahora (fuera de alcance) y no
   evita el problema con el pack final.

Para la animación:
- a. `AnimationManager` de Phaser (`anims.create`/`play`). Es global al juego, lo mueve el reloj del motor (no se
  congela con `PauseGate`) y termina por eventos.
- b. **Frame elegido por el adaptador** con un reloj de render propio (`AnimClock`) y una función pura
  `frameAt(anim, ms)`.

## Decisión
Se eligen la **opción 2** y la **opción b**:
- `art/` en la raíz del repo, en `.gitignore`. `src/infrastructure/phaser/art/artFiles.ts` hace
  `import.meta.glob('@art/**/*.png', { eager: true, query: '?url', import: 'default' })`. El alias `@art` apunta a
  `art/` salvo que la build de E2E con arte lo redirija a una carpeta de fixtures generadas (variable
  `SPRINT_ART_DIR`, leída solo en `vite.config.ts`). Los PNG de arte nunca se inlinan (`assetsInlineLimit` en forma
  de función), así que siempre se cargan por petición y el camino que se prueba frente a la CSP es el real.
- `loader.imageLoadType: 'HTMLImageElement'` en la configuración del juego. El Loader carga las imágenes con
  `<img src>` del mismo origen, sin `blob:`, y la CSP no cambia.
- Un `BootScene` es la primera escena en los dos arranques: carga las hojas presentes, aplica el filtro `NEAREST`
  solo a esas texturas, genera el placeholder (`Graphics.generateTexture`, Canvas API, sin URL) y arranca
  `MenuScene` o `GameScene`.
- Las animaciones las decide el adaptador: `AnimClock` avanza con el `delta` del frame salvo con el mundo detenido.
  Los cadáveres caducan por tiempo calculado, no por eventos. Al apagar la escena no queda nada pendiente.

## Consecuencias
- Positivas:
  - CI, E2E y Pages funcionan sin pack, sin peticiones fallidas ni retrasos.
  - La CSP no se relaja.
  - Las animaciones se congelan exactamente con el mundo detenido y se pueden probar con dobles, sin motor.
  - El cambio de pack es solo de datos.
- Negativas / costes:
  - Añadir o quitar PNG exige recompilar (en `vite dev` basta con recargar).
  - Una build **local** con pack lleva el arte en `dist/`: solo se despliega la build de CI (job `quality`, sin
    pack).
  - Probar en navegador "con arte" exige una segunda build de E2E con fixtures generadas (unos segundos más en el
    job `e2e`).
  - Se renuncia a las utilidades de `AnimationManager` (yoyo, cadenas), que hoy no hacen falta.
- Cómo revertirla:
  - Pasar a la opción 1 solo afecta a `artFiles.ts` (URL fija en lugar del glob) y a `BootScene`.
  - `imageLoadType` es una línea de `main.ts`.
  - Volver a `AnimationManager` afecta a `PlayerView`, `EnemyLayer` y `CorpseLayer`. El manifiesto no cambia.
