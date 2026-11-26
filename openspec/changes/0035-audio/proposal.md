# Proposal · 0035-audio

- **Estado**: aprobada por el autor (2026-11-26)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0035-audio`

## Problema
El juego no tiene sonido: no hay nada de audio en `src/`, `content/` ni en los hooks. Tiny Swords no trae audio. El
jugador no oye cuándo le golpean, cuándo cae un enemigo o cuándo sube de nivel. Tampoco hay opciones de audio, y esas
opciones estaban en el Should (accesibilidad) y las absorbe este change (GDD, historia 0035).

Además, el guardarraíl de procedencia (`.claude/hooks/guard-assets.mjs`) solo reconoce gráficos, fuentes y la lista
`generated[]` de iconos. Hoy un `.ogg`, `.mp3` o `.wav` versionado **pasa sin registro**, y eso abre un hueco de
licencias justo en el change que mete los primeros ficheros de audio.

## Objetivo
Al pulsar Jugar suena una música de fondo en bucle, y los sucesos de la partida tienen su efecto de sonido, que se
dispara desde el snapshot. El jugador puede ajustar por separado el volumen de la música y el de los efectos, y
silenciarlo todo. El ajuste se aplica al instante y se guarda en local. Todo el audio es CC0 con su procedencia
registrada y vigilada por el guardarraíl. El núcleo de simulación no cambia: balance y firmas quedan idénticos.

## Decisiones del autor (cerradas)
1. **Origen de los assets**: el autor descarga **todo** el audio (efectos y música) **solo de fuentes CC0**
   (Kenney.nl, OpenGameArt filtrado por CC0, Freesound filtrado por CC0). En este change no hay audio generado por IA
   ni por script, y no se acepta CC-BY. Cada fichero lleva su entrada en `content/asset-provenance.json` con fuente,
   URL, licencia CC0 y fecha. El formato es el que entregue la fuente: no hay encoder en la máquina y Kenney entrega
   OGG. No se recodifica nada.
2. **Música**: un bucle que arranca al pulsar Jugar. Ese gesto desbloquea el audio del navegador, así que antes no
   suena nada. Se pausa con la pausa (Esc / ⏸), con la retención móvil de 0033 (aviso «Gira el móvil») y con la
   pestaña oculta. Al salir de esas situaciones se reanuda.
3. **Efectos**: hay efectos para estos sucesos:
   - golpe recibido por el jugador;
   - impacto, con un sonido distinto según el origen: flecha del jugador, flecha de torre propia o explosión. El
     adaptador lo distingue cruzando `hits` con `blasts` y `towerProjectiles`;
   - muerte de enemigo;
   - recogida;
   - subida de nivel;
   - explosión;
   - compra en la tienda;
   - obra en un solar.

   Hay un tope de voces simultáneas y una limitación por tipo, los dos en contenido validado con zod. Lo que pase del
   tope se descarta.
4. **Opciones**: volumen de música y volumen de efectos por separado, más un silencio general. Se guardan en
   `localStorage` con una clave propia y se validan con zod al leerlas. Si los datos están corruptos o faltan, se usan
   los valores por defecto. El mismo panel sirve en el **menú de inicio** y en la **pausa**. Además hay un botón de
   silencio en la barra táctil móvil (`TouchBar`) y la tecla **M**.
5. **`?e2e`**: no carga ningún fichero de audio. La sonda `window.__sprint.audio` expone contadores (eventos pedidos,
   reproducidos y descartados, voces activas) para los tests. En modo manual (`?e2e&manual`, 0014) el reloj de render
   avanza `n × TICK_MS` con cada `step(n)`, y un `step(n)` puede cruzar muchos ticks en un frame. Por eso los eventos
   se sacan del diff del snapshot con deduplicación por id (ventana de `hits` de 15 ticks) y no del reloj de pared.
6. **Núcleo intacto**: el change solo toca infraestructura, composición y contenido. `BALANCE_BASELINE` y todas las
   firmas doradas quedan idénticas. El peso total de audio tiene un tope propuesto de **2 MB** (criterio de verify).
   La CSP no debería necesitar cambios (`media-src` cae en `default-src 'self'` y `connect-src 'self'` cubre la
   carga); se confirma con un build real.

La elección técnica (Phaser Sound o un módulo propio sobre Web Audio) queda para el design.

## Alcance
- **Dentro**:
  - Ficheros de audio CC0 entregados por el autor en una carpeta propia bajo `public/assets/` (la ruta exacta se fija
    en el design), con su lista de procedencia de audio en `content/asset-provenance.json`.
  - Ampliación de `guard-assets` y de sus tests: reconoce `.ogg`, `.mp3` y `.wav`, rechaza audio versionado sin
    entrada o con licencia distinta de CC0, y no admite audio en `generated[]`.
  - Contenido de audio validado con zod: qué fichero va con cada evento, volúmenes por defecto, tope de voces y
    limitación por tipo. Sin números mágicos.
  - Traducción pura de snapshot a eventos de audio: diff entre snapshots, deduplicación por id, origen del impacto,
    tope y limitación. Se puede testear sin motor.
  - Adaptador de reproducción: música en bucle, efectos, desbloqueo por gesto y pausa/reanudación por pausa,
    retención móvil y `visibilitychange`.
  - Repositorio de ajustes de audio en `localStorage` (zod, `Result`, nunca lanza), siguiendo el patrón de
    `LocalStorageProgressRepository`.
  - Panel de opciones compartido en el menú de inicio y en la pausa, botón de silencio en la `TouchBar` y tecla M.
  - Sonda `window.__sprint.audio` y 1–2 E2E como mucho, ampliando la suite de humo (regla `e2e-lite`).
  - El juego funciona igual si el audio no está disponible o un fichero no carga: no lanza errores ni bloquea el
    arranque.
- **Fuera**:
  - Audio generado por IA o por script, síntesis en tiempo real y licencias CC-BY (ni créditos con atribución).
  - Recodificar o convertir formatos.
  - Varias pistas de música, música adaptativa por fase u oleada, y audio posicional o estéreo por posición en el
    mundo.
  - Cambios en `src/domain` o `src/application`, en `content/` de combate o mapa, en el balance o en las firmas.
  - Volumen maestro aparte de música y efectos (el silencio general hace ese papel).
  - Pruebas en iOS Safari real (ya estaban pendientes desde 0033).
  - Efectos de interfaz (clic de botón, hover) que no correspondan a un suceso de la lista.

## Capacidades afectadas
- `openspec/specs/audio` (nueva): música, efectos desde el snapshot, tope de voces, opciones y su guardado, `?e2e`
  sin audio y la sonda.
- `openspec/specs/asset-provenance` (modificada): el audio se registra y el guardarraíl lo cubre.
- `openspec/specs/main-menu` (modificada): entrada a las opciones de audio en el menú y en la pausa, y tecla M.
- `openspec/specs/touch-controls` (modificada): botón de silencio en la barra táctil.
- `openspec/specs/architecture-guardrails` (modificada, si el spec-writer lo ve necesario): extensiones de audio en
  el hook.

## Riesgos y dudas
- **Dependencia externa (bloquea apply)**: el apply no puede cerrar sin los ficheros del autor, con su URL, licencia
  y fecha de descarga. Si faltan efectos o no hay una música CC0 que encaje con el tema medieval, el change espera o
  se recorta con aprobación del autor. Mientras tanto, la lógica pura, el guardarraíl, los ajustes y el panel se
  pueden avanzar.
- **Peso**: la fuente decide el formato. Una música larga en WAV se come el tope de 2 MB, así que conviene elegir
  OGG/MP3 o un bucle corto.
- **Compatibilidad de formato**: Safari antiguo no reproduce OGG. Se acepta como limitación y no se recodifica. Hay
  que comprobar que el juego no falla si un fichero no se decodifica.
- **Autoplay y desbloqueo**: el gesto de Jugar llega por DOM o por pantalla táctil. Si el desbloqueo falla, el juego
  sigue mudo, sin errores.
- **Avalancha de eventos**: con cientos de `hits` por segundo hacen falta el tope y la limitación. La ventana de 15
  ticks de `hits` obliga a recordar el último id visto. Hay ambigüedades que la spec tiene que resolver: la mecha no
  cuenta como baja, y el relleno al tope o una recolocación pueden parecer una recogida.
- **CSP**: falta confirmar con build y preview que la carga de audio no necesita `blob:` ni `media-src` nuevos.
  `tests/guardrails/csp.test.ts` fija las directivas.
- **Para la spec**: qué pasa con la música en la pantalla de resultados y al volver al menú; si las ofertas, la
  tienda y la obra (que paran la simulación pero no son pausa) silencian la música; y los valores por defecto de los
  volúmenes.

## Criterio de éxito
- Todos los escenarios de `specs/audio` y de los deltas están en verde, con test unitario, de aplicación o E2E
  según `e2e-lite`, y como mucho 1–2 E2E nuevos.
- `npm run guard:all` falla con un `.ogg`, `.mp3` o `.wav` versionado sin entrada o con licencia ≠ CC0, y pasa con
  todo el audio del change registrado.
- Bytes totales de los ficheros de audio versionados ≤ 2.097.152 (2 MB).
- `BALANCE_BASELINE` y las firmas doradas son idénticas, sin regenerarlas; no hay ningún cambio en `src/domain` ni
  en `src/application`.
- Con `?e2e` no se pide ningún fichero de audio a la red, y `window.__sprint.audio` muestra contadores coherentes
  con los eventos del snapshot. El E2E da 0 errores de CSP y 0 errores de consola.
- `npm run build` y `vite preview` reproducen el audio con la CSP actual sin cambios. Si hiciera falta tocarla, se
  justifica en el design.
