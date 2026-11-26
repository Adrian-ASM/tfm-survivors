# Exploración 0035-audio

## Contexto actual
- El juego es mudo: `grep audio` no da nada en `src/`, `content/` ni hooks. Phaser 4.2.1 (tipos en `node_modules/phaser/types/phaser.d.ts`: `Core.AudioConfig`, `Sound.BaseSoundManager`, `noAudio`). `Phaser.Game` se crea en `src/composition/main.ts:405` con `loader.imageLoadType: 'HTMLImageElement'`; `BootScene` carga hojas, fuente e iconos; `MenuScene.update` arranca `GameScene` al leer `takePlay()`.
- Persistencia local: `LocalStorageProgressRepository` (`src/infrastructure/progress/`), clave `sprint-survivors/progress`, `Result`, nunca lanza, `corrupt` deja el valor intacto; cableado en `src/composition/progressWiring.ts`. Sirve de patrón para un repositorio de ajustes aparte (clave propia, zod).
- Menú/pausa: DOM (`MenuPanel`, `PausePanel`, `MenuController`, `ConfirmDialog`, `GuideModal`); móvil 0033 con `TouchBar` y retención de `PauseGate`.
- CSP (`index.html`): `default-src 'self'` sin `media-src`, así que cae en `'self'`; `connect-src 'self'` cubre el `fetch`/XHR del cargador de audio de Phaser. WebAudio `decodeAudioData` no necesita `blob:`. Probable: **no hay que tocar la CSP** (hay tests en `tests/guardrails/csp.test.ts` que fijan las directivas).
- Procedencia: `.claude/hooks/guard-assets.mjs` solo reconoce `GRAPHIC` (png…), `FONT` (woff…) y `generated[]` restringido a `public/assets/icons/*.png` (ADR-0030). Un `.ogg/.mp3/.wav` hoy **pasa sin registro**. Hay que añadir lista(s) de audio en `content/asset-provenance.json` (75 entradas hoy) y reglas nuevas en el hook y en sus tests.
- Herramientas: node >= 22 (`engines`). No pude ejecutar shell en esta fase: ffmpeg, encoder OGG/MP3 y su versión **sin comprobar** (el orquestador debe lanzar `ffmpeg -version` / `node -v`). `scripts/icons/draw-icons.mjs` es el precedente de script determinista sin dependencias (byte a byte).

## Eventos del snapshot (`src/domain/run/RunSnapshot.ts`)
| Efecto | Fuente en snapshot | ¿Basta? |
|---|---|---|
| Golpe recibido | `hits` con `kind:'player'` (id, tick) | Sí |
| Impacto de flecha | `hits` `kind:'enemy'/'structure'/'sheep'`; **no indica origen** (flecha, pulso, explosión o torre) | Parcial: sirve "golpe a objetivo"; distinguir flecha de explosión se cruza con `blasts` del mismo tick |
| Muerte de enemigo | `kills` sube; o id que desaparece de `enemies` sin ser detonación | Sí, con ambigüedad (detonar por mecha no cuenta como baja, sí desaparece) |
| Recogida | id de `pickups` que desaparece o `resources` sube; el relleno al tope (ADR-0021) o recolocar puede parecer desaparición | Sí, mejor con contadores + `player` cerca |
| Subida de nivel | `progression.level` sube | Sí |
| Explosión | `blasts[].id` nuevo | Sí |
| Compra | `shop.products[].level` sube / `shop.gold` baja estando `shop.open` | Sí (diff) |
| Obra | `sites[].state` pasa de `free` a `house/tower` | Sí |
Conclusión: **ningún efecto exige tocar el núcleo**. Dedupe por id/tick (ventana de `hits` = 15 ticks, ver `combat.json`): hay que recordar el último id visto.

## Opciones
**A. Efectos y música con Phaser Sound (WebAudio, `this.sound`)**. Pros: desbloqueo de audio y pausa de contexto integrados, `volume`/`mute` globales, `Loader.audio`. Contras: carga por XHR (Phaser ya usa HTMLImage para evitar `blob:`; hay que verificarlo con CSP en build real); más difícil de simular en tests (dobles del motor).
**B. Módulo propio sobre la Web Audio API** (`AudioContext`, buffers, `GainNode` maestro/música/efectos). Pros: control fino del tope de voces y de la limitación por tipo, puerto `AudioOut` sencillo de doblar en tests, independiente del motor. Contras: más código; reimplementa desbloqueo y reanudación (`resume()` tras gesto, pestaña oculta).
**C. Efectos sintetizados en tiempo de ejecución (osciladores/ruido) sin ficheros**. Pros: cero assets, cero procedencia y cero peso. Contras: música medieval poco creíble; sonido más "chiptune"; no cumple "ficheros con procedencia" de la historia.
Transversal: lógica pura de `snapshot → lista de eventos` (diff, tope por tipo y de voces, ventana de ticks) testeable sin motor; el adaptador solo reproduce.

## Riesgos e incógnitas
- Autoplay: desbloquear en el clic de Jugar (DOM y táctil); iOS Safari sin probar (ya pendiente en 0033). Con la retención de 0033 (aviso «Gira el móvil», pausa) conviene pausar/silenciar la música; y al cambiar de pestaña.
- Cientos de hits por segundo: tope de voces simultáneas (contenido en `content/audio.json` con zod, sin números mágicos) y limitación por tipo.
- `?e2e` y `?manual`: `step(n)` avanza muchos ticks por frame, así que el audio no debe depender del reloj de pared; en `?e2e` lo más seguro es no cargar nada (sin descargas ni fallos) y una sonda `__sprint.audio` (contadores de eventos pedidos/reproducidos/descartados) para al menos 1 E2E (máx. 1–2 nuevos, regla `e2e-lite`).
- Dónde cabe el menú de opciones: menú de inicio y pausa son DOM; un único panel compartido evita duplicar. En móvil la `TouchBar` ya tiene ⏸ ↻ ⛶.
- Peso para Pages: música en bucle 60–90 s en OGG ~0,5–1 MB; en WAV PCM 16 bit mono 22 kHz ≈ 2,6 MB por minuto, 44,1 kHz estéreo ≈ 10 MB/min. Efectos cortos (≤ 0,5 s) en WAV mono ≈ 20–45 kB cada uno. Sin encoder OGG el WAV de la música es el factor de peso.
- Balance: el audio no toca `Run`; `BALANCE_BASELINE` y las firmas deben quedar idénticos (test de regresión existente; no hace falta recalibrar).
- Licencia: Kenney es CC0; OpenGameArt/Freesound mezclan CC0 y CC-BY (si se acepta CC-BY, el hook debe validar `attribution`). El audio generado por IA/script cae en la política de ADR-0030 (nuevo ADR o ampliación).

## Mediciones previas
No hacen falta de balance. Solo como comprobación en verify: bytes totales de audio ≤ umbral a fijar (propuesta: 2 MB) y que el bundle JS no crezca de forma apreciable.

## Decisiones abiertas (para el autor)
1. **Quién produce el audio y con qué herramienta**: (a) el autor lo aporta por su cuenta; (b) fuentes CC0 (Kenney, OpenGameArt, Freesound) que descarga el autor, registradas con URL/licencia/fecha; (c) generado en sesión por script determinista sin dependencias (síntesis tipo sfxr a WAV) como los iconos de 0034 (`scripts/icons/`), con lista `generated[]` de audio; (d) mixto: efectos por script y música CC0 del autor. Música medieval por script (c) es poco realista.
2. ¿Música desde el primer change o solo efectos (música como follow-up)?
3. ¿Se acepta CC-BY con atribución (créditos en el menú/Guía) o solo CC0?
4. Formato: OGG (necesita encoder: confirmar `ffmpeg`), MP3 (compatibilidad universal) o WAV PCM (sin herramientas, más peso). Tope de peso total.
5. Opción técnica: A (Phaser Sound), B (Web Audio propio) o C (síntesis en tiempo real).
6. Ubicación de las opciones: panel compartido en menú de inicio y pausa, solo pausa, o también en la `TouchBar` móvil (botón silencio).
7. Controles: volumen maestro único + silencio, o música y efectos por separado; tecla rápida (p. ej. M).
8. `?e2e`: ¿no cargar audio (recomendado), cargarlo mudo o permitir `?audio=1`?
9. Guardarraíl: ¿lista `audio[]` propia (fuente/licencia/URL/fecha/sha256) y carpeta `public/assets/audio/`, y extender `generated[]` a esa carpeta?
10. ¿Efecto distinto para impacto de flecha frente a explosión/torre (requiere cruzar `blasts`/`towerProjectiles`) o un único "golpe a objetivo"?
