# ADR-0012 · Arte CC0 de Tiny Swords (Update 010) versionado en `public/`, con procedencia comprobada

- **Estado**: aceptada (change 0012-sprite-rendering, implementada en apply y sin Critical en verify)
- **Fecha**: 2026-11-22
- **Sustituye a**: la propuesta aparcada "Arte local descubierto en build" (`0012-arte-local-descubierto-en-build.md`,
  2026-11-20). Nunca se aceptó ni llegó a `main`; se borra del change (ver "Por qué se borra y no se marca").

## Contexto
El change 0012 sustituye los círculos por sprites animados. La planificación aparcada suponía que el arte no se podía
redistribuir: lo descubría en build desde una carpeta ignorada (`art/`, `import.meta.glob`, `SPRINT_ART_DIR`) y CI,
E2E y Pages pintaban placeholders. El 2026-11-22 el autor de Tiny Swords (Pixel Frog) confirmó que **"Update 010"
es CC0**. El *Free Pack* actual no lo es y no puede entrar.

Fuerzas que influyen:
- Pages, CI y local tienen que ver **el mismo** arte, y la suite E2E tiene que probar el camino real de carga.
- CSP de 0007: `img-src 'self' data:`. El Loader de Phaser descarga por XHR y crea URL `blob:`, que la CSP bloquea
  (hallazgo del spike `spike/sprites`).
- El pack trae `.DS_Store`, `.aseprite` y un `.zip` junto a los PNG, y en la carpeta hermana está el Free Pack. Un
  fichero colado rompe la historia de licencia del TFM: hace falta una comprobación automática, no solo cuidado.
- La confirmación CC0 es posterior a la página de itch.io: la nota tiene que dejar constancia verificable.
- Hay dos arranques (menú y `?e2e`), pausa con el mundo detenido y Volver al menú (ADR-0011).

## Opciones
Estrategia de assets:
1. **Subconjunto copiado en `public/assets/tiny-swords/`**, con la estructura de carpetas del pack y un
   `PROVENANCE.json` al lado. URL estables (`BASE_URL + ruta`); Vite copia `public/` entero a `dist/`.
2. **Importados desde `src/assets/` con Vite** (hash en el nombre, solo lo referenciado). Vite inlina como `data:`
   los ficheros por debajo de `assetsInlineLimit` (4 KB; `Arrow.png` cae ahí), así que habría dos caminos de carga
   o un ajuste de configuración, y las rutas del manifiesto de aspecto dejarían de ser datos (tendrían que ser
   `import`).
3. **Atlas empaquetado por script.** Menos peticiones, pero modifica el arte (obra derivada que anotar), añade tooling
   y posiblemente una dependencia. Fuera de alcance (proposal).

Carga con la CSP:
- a. Relajar `img-src` con `blob:`. Rechazada: el criterio de la proposal es no tocar las directivas.
- b. **`loader.imageLoadType: 'HTMLImageElement'`**: el Loader usa `<img src>` del mismo origen, sin `blob:`.

Comprobación de licencia:
- i. Revisión manual en el PR. No escala y no deja evidencia.
- ii. **Guardarraíl sobre `git ls-files`** con hash de contenido, en la misma fuente que el resto
  (`.claude/hooks/`) y ejecutado por pre-commit, `guard:all` y CI.

## Decisión
Se eligen **1 + b + ii**:
- Los PNG viven en `public/assets/tiny-swords/<ruta original del pack>` (p. ej.
  `Factions/Goblins/Troops/Torch/Red/Torch_Red.png`): la ruta del repo es la de origen, sin renombrar, para que la
  procedencia se compruebe a simple vista. Solo entra el subconjunto que usa `content/appearance.json`.
- `content/asset-provenance.json` registra pack, autor, versión, licencia (`CC0`) y fecha de la confirmación del
  autor (2026-11-22) y, por fichero, `path`, `source` (ruta en el pack), `version`, `sha256` y `bytes`. Iba a vivir
  junto a los PNG (`public/assets/tiny-swords/PROVENANCE.json`), pero `vite dev` no permite importar JSON de
  `public/` y la composición la necesita para validar las hojas (design R6, resuelto en apply).
- `loader.imageLoadType: 'HTMLImageElement'` en el `GameConfig`. Un `BootScene`, primera escena en los dos
  arranques, carga las hojas y arranca `MenuScene` o `GameScene`. Las texturas son globales al juego: se cargan una
  vez por carga de página.
- Las animaciones las elige el adaptador con un reloj de render propio (`AnimClock` + `frameAt` puro), no el
  `AnimationManager`: así se congelan con `PauseGate` y se prueban sin motor (decisión reutilizada del ADR aparcado).
- `.claude/hooks/guard-assets.mjs` exporta una función pura; `scripts/guard-staged.mjs` la ejecuta una vez sobre
  `git ls-files` (índice). Falla si:
  - hay cualquier `.DS_Store`, `Thumbs.db`, `desktop.ini`, `.aseprite` o comprimido (`.zip`, `.rar`, `.7z`,
    `.tar`, `.gz`) versionado;
  - una ruta contiene "free pack" (sin distinguir mayúsculas ni separador);
  - un asset gráfico (`png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `ico`, `svg`, `aseprite`, sin distinguir
    mayúsculas, en cualquier carpeta) no tiene entrada en la nota, o su `sha256` o `bytes` no coinciden;
  - una entrada de la nota no está versionada o se repite, su `source` es del Free Pack, o faltan campos o la
    licencia no es `CC0` o la versión no es `Update 010`.
  El hash es lo que hace fuerte la regla: un PNG del Free Pack renombrado como uno de Update 010 no pasa.

### Por qué se borra y no se marca
El ADR aparcado nunca fue aceptado ni estuvo en `main`. La numeración pública de ADRs es la de `main`, y dejar un
fichero "rechazado" con el mismo número crea dos ADR-0012. La historia queda en este apartado, en la exploración del
change y en git (la rama aparcada).

## Consecuencias
- Positivas:
  - Pages, CI y local muestran el mismo arte. La suite E2E prueba el camino real (CSP incluida), sin segunda build
    ni fixtures sintéticas.
  - La CSP no cambia.
  - La licencia es comprobable: hash por fichero, fecha de la confirmación (sin captura versionada, como fija la
    spec) y fallo automático en commit y CI.
  - El cambio de arte es de datos (`content/appearance.json` + `content/asset-provenance.json`) y no toca el
    núcleo (diff de `src/domain` y `src/application`: 0 líneas).
- Negativas / costes:
  - Peso en el repo y en `dist/`: 219.672 bytes (≈ 0,21 MB) los 8 PNG, medidos en apply y registrados por fichero
    en la nota.
  - Todo `public/` se publica: el guardarraíl es la única barrera contra un PNG suelto.
  - Una textura que falla al cargar (404) deja un error de red en consola: deja de ser el caso normal, pero el
    fallback por placeholder se mantiene.
  - Se renuncia a utilidades del `AnimationManager` (yoyo, cadenas) que hoy no hacen falta.
- Cómo revertirla:
  - Pasar a la opción 2 afecta a `assetUrl` (composición) y a las rutas del manifiesto.
  - `imageLoadType` es una línea de `main.ts`.
  - Quitar el guardarraíl es quitar una llamada en `guard-staged.mjs` (no recomendable mientras haya arte de terceros).
