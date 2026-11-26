# Design · 0035-audio

## Resumen
El audio va entero en el adaptador. Una pieza pura (`AudioCues`) compara cada snapshot pintado con el anterior y
saca **señales** (cues) de sonido. Deduplica por id y por contador y deduce el origen del impacto. Otra pieza pura
(`VoiceBudget`) aplica el tope de voces y la limitación por tipo, con el reloj **del tick del snapshot**, nunca el de
pared. Un adaptador fino sobre **Phaser Sound** (`PhaserSoundOut`, Web Audio del motor) reproduce lo que pasa el
presupuesto. La música la gobierna una función pura (`musicState`). La composición lo conecta todo a `onRender`,
`onScreen`, al inicio de partida y a la retención móvil, **sin tocar `GameScene`** ni el núcleo. Los ajustes van en
`localStorage` con zod. Un mismo componente DOM (`AudioControls`) sirve en el menú y en la pausa, con la tecla M y
un botón en la `TouchBar`. El guardarraíl gana una lista `sounds[]` solo CC0 y un tope de 2 MB.

Vía de consulta de Phaser: MCP `phaser-docs` (la API publicada es la v4.1.0) y, como manda la 4.2.1 instalada, el
fuente y los tipos de `node_modules/phaser`:
- `/api-documentation/class/sound-webaudiosoundmanager` (unlock, pauseOnBlur, mute/volume, add).
- `node_modules/phaser/src/sound/webaudio/WebAudioSoundManager.js`: `locked = context.state === 'suspended'`
  (l. 89); `unlock()` escucha `touchstart/touchend/mousedown/mouseup/keydown` en `document.body` y hace
  `context.resume()` (l. 348-389); `onBlur` suspende el contexto si `pauseOnBlur` (l. 399).
- `node_modules/phaser/src/sound/BaseSoundManager.js`: `pauseOnBlur = true` por defecto; escucha `BLUR`/`FOCUS`
  del juego (l. 108, 182).
- `node_modules/phaser/src/sound/webaudio/WebAudioSound.js` l. 54-58: `add(key)` **lanza** si la clave no está en
  `cache.audio`. Por eso solo se crean sonidos de claves cargadas.
- `node_modules/phaser/src/loader/filetypes/AudioFile.js`: XHR `responseType: 'arraybuffer'` (l. 66) +
  `decodeAudioData` (l. 94). Si el fichero no decodifica, `console.error` y fallo del fichero (l. 104). Si el
  formato no es reproducible, `console.warn` y no se encola (l. 151). No usa `blob:` con URLs normales.
- `node_modules/phaser/types/phaser.d.ts`: `Types.Core.AudioConfig.noAudio` (l. 95641),
  `Core.Events.HIDDEN`/`VISIBLE`/`BLUR` (l. 6559, 6642, 6513), `BaseSoundManager.pauseOnBlur` (l. 130819).

## Decisiones

**D1. Phaser Sound y no un módulo propio de Web Audio** (ADR-0031). Phaser ya trae el `AudioContext` y el
desbloqueo por gesto (`unlock` en `body`, que cubre el clic o toque DOM de Jugar). También trae la carga por el
`Loader` que ya usa `BootScene`, la reserva HTML5 Audio, `mute`/`volume` globales, `NoAudioSoundManager`
(`audio.noAudio`) y la reanudación de iOS al volver a ser visible (`onGameVisible`). Un módulo propio repetiría todo
eso sin ganar control, porque el tope y la limitación los decide la lógica pura (D4) y no el motor. Lo que no se
quiere del motor se apaga: `sound.pauseOnBlur = false` (la spec pide pausa con la pestaña **oculta**, no con la
ventana sin foco; D6). El motor queda tras una interfaz de infraestructura `SoundOut` con dos implementaciones,
`PhaserSoundOut` y el doble de los tests. No es un puerto de `application`: nadie del núcleo lo usa.

**D2. Señales derivadas del snapshot, en el adaptador** (`src/infrastructure/audio/audioCues.ts`, pura). La clase
`AudioCues` guarda el estado mínimo del snapshot anterior y `next(snapshot)` devuelve las señales de ese render en un
array reutilizado. Cada señal es `{ cue, count }`: una entrada por tipo con el número de sucesos, para no reservar
memoria por golpe. Reglas:

| Cue | Regla | Por qué no hay falsos positivos |
|---|---|---|
| `playerHit` | golpes con `id > lastHitId` y `kind === 'player'` | id de secuencia propia (ADR-0027). La ventana de 15 ticks ≥ ticks por frame hace que nada se pierda ni se repita |
| `hitArrow` / `hitTower` / `hitBlast` | golpes nuevos con `kind ≠ 'player'`, clasificados con D3 | ídem |
| `enemyDeath` | `kills` sube Δ ⇒ Δ sucesos | `kills` es la definición de baja del dominio: la mecha detonada no cuenta y el despeje de una huella de obra tampoco |
| `pickup` | ids del `pickups` anterior que faltan en el actual, **solo si `tick` avanzó** | recoger solo pasa dentro de un tick. El despeje de la obra y la compra pasan con la simulación parada (tick igual, render propio de `BuildGate`/`ShopGate`). El relleno al tope (ADR-0021) no borra ningún recogible y la recolocación conserva el id |
| `levelUp` | `progression.level` sube Δ | también la subida que solo cura (0024) |
| `explosion` | blasts con `id > lastBlastId` | id único y creciente (`BlastSnapshot`) |
| `purchase` | `shop.gold` baja | el oro solo baja al comprar. La obra gasta madera y piedra |
| `build` | `sites[i].state` pasa de `free` a `house`/`tower` (mismo índice, orden fijo) | la lista tiene longitud fija |

Reinicio: `reset()` explícito al empezar cada partida (callback `started` de la composición, que ya cubre Jugar y
R) y al mostrar el menú. Por seguridad, también si `tick` retrocede. El primer snapshot tras `reset` solo siembra el
estado y no emite nada, así que los montones de madera del tick 0 no suenan.

**D3. Origen del impacto** (pura, en `AudioCues`). Para cada golpe nuevo de clase no jugador, en este orden:
1. `hitBlast` si hay un blast con `tick === hit.tick` cuyo círculo toca el del objetivo:
   `dist(hit, blast) ≤ blast.radius + r`. `r` es el radio del objetivo por `kind` + `targetId` en el snapshot actual
   o en el anterior (enemigos, ovejas, estructuras). Si no se encuentra, vale 0. Es la misma regla
   `circlesOverlap` de `HazardField`, sin números nuevos. Si en el mismo tick se suman flecha y explosión
   (`HitLog` suma por objetivo y tick), gana la explosión.
2. `hitTower` si el golpe es a un `enemy` (las torres solo apuntan a enemigos) y el proyectil **desaparecido** en
   este diff (id del snapshot anterior que falta en el actual) más cercano a `(hit.x, hit.y)` es una flecha de torre
   (`towerProjectiles`). Si empatan, gana el jugador.
3. `hitArrow` en otro caso, también para los pulsos y cuando no ha desaparecido ningún proyectil.

Es una heurística acotada a la presentación. Cuando falla, suena un impacto con otro timbre, y la spec debe
admitirlo así. Los tests fijan los casos con snapshots armados a mano.

**D4. Presupuesto de voces** (`src/infrastructure/audio/VoiceBudget.ts`, pura). El reloj es
`nowMs = snapshot.tick × TICK_MS`: determinista, igual en tiempo real, con `speed` y con `step(n)`, y congelado en
pausa. Por cada suceso, en el **orden de prioridad de `audio.json`** (D5):
1. Si los efectos están en silencio (`muted` o `effects` = 0), se descarta con motivo `muted`.
2. Si el motor sigue bloqueado (`locked`), se descarta con `locked`. Así no hay ráfaga al desbloquear.
3. Si `nowMs − lastAt[cue] < cooldownMs`, se descarta con `cooldown`.
4. Si las voces activas de ese cue son ≥ `cue.maxVoices`, se descarta con `cueLimit`.
5. Si las voces activas en total son ≥ `maxVoices`, se descarta con `voices`.
6. Si no, se acepta: la voz ocupa hasta `nowMs + voiceMs` y se llama a `SoundOut.play(cue, volumen)`.

Las voces son lógicas: viven en un anillo preasignado de `maxVoices` entradas y se purgan con `endsAt ≤ nowMs`. Si
`tick` retrocede o hay `reset`, se vacía. Lo que el motor suena de verdad lo acota además el pool de D7. Así, con
cientos de golpes por segundo, suenan como mucho `maxVoices` y el resto sube `dropped`.

**D5. Contenido `content/audio.json`** (zod estricto, `src/infrastructure/content/audioSchema.ts` +
`loadAudio.ts`; es presentación y no entra en la `RunConfig`):
```json
{
  "maxVoices": 12,
  "defaults": { "music": 60, "effects": 80, "muted": false },
  "sliderStep": 5,
  "music": { "file": null, "volume": 0.6 },
  "cues": [
    { "id": "playerHit", "file": null, "volume": 0.9, "maxVoices": 2, "cooldownMs": 120, "voiceMs": 300 },
    { "id": "levelUp", "...": "..." }, { "id": "purchase" }, { "id": "build" }, { "id": "explosion" },
    { "id": "enemyDeath" }, { "id": "pickup" }, { "id": "hitBlast" }, { "id": "hitTower" }, { "id": "hitArrow" }
  ]
}
```
Los valores de arriba son orientativos y el implementer los ajusta en el JSON. Reglas zod:
- `cues` tiene **exactamente** los 10 ids del conjunto cerrado, una vez cada uno. Su orden es la prioridad.
- `file` es `null` o un nombre plano `^[a-z0-9-]+\.(ogg|mp3|wav)$`, relativo a `public/assets/audio/`.
- `volume` ∈ [0, 1]; `maxVoices` es entero ≥ 1 y ≤ el global; `cooldownMs` es entero ≥ 0; `voiceMs` es entero ≥ 1.
- `defaults.music` y `defaults.effects` son enteros en [0, 100] y múltiplos de `sliderStep`.

Cruce al arrancar (último paso de `bootContent` antes de la guía, mismo `report`): cada `file` no nulo tiene que
figurar en `sounds[]` de la nota (`soundPaths(note)`). Si no, `AUDIO_NOT_REGISTERED` con el campo
`cues.<id>.file`. **Placeholders**: mientras el autor no entregue los ficheros, todo `file` es `null`. Ese cue
pasa el presupuesto y la sonda lo cuenta, pero `SoundOut` no tiene sonido y suena silencio sin errores (contador
`missing`). Así todo se implementa y se prueba sin ficheros.

**D6. Música** (`musicState`, pura). Recibe `{ screen, held, hidden }` y devuelve
`'stopped' | 'playing' | 'paused'`:
- `screen === 'menu'` ⇒ `stopped`. Al volver al menú se para, y el siguiente Jugar empieza desde 0.
- `screen === 'paused'`, `held` (retención 0033) u `hidden` ⇒ `paused`.
- Cualquier otra pantalla de partida (`playing`, `shop`, `build`, oferta y resultados) ⇒ `playing`. R no la
  reinicia.

`screen` llega por `onScreen` en cada frame, `held` por el `hold()` del cableado móvil leído en cada render y
`hidden` por `Phaser.Core.Events.HIDDEN`/`VISIBLE` en `phaserGame.events`. Con la pestaña oculta no hay frames, así
que se aplica en el propio evento. `SoundOut.music(state, volumen)` es idempotente. Si el motor está bloqueado o la
música no ha cargado, queda pendiente y arranca en el primer frame en que se pueda. **Supuesto a confirmar con la
spec**: música sonando en resultados, tienda, obra y ofertas. Si la spec dice otra cosa, cambia una línea de
`musicState` y su test.

**D7. `PhaserSoundOut`** (`src/infrastructure/audio/PhaserSoundOut.ts`, motor). Recibe `game.sound` y las claves
cargadas que publica `BootScene` (`cache.audio.exists`). La primera vez que se usa un cue cargado crea un **pool de
`cue.maxVoices` instancias** (`sound.add(key)`), y nunca crea objetos por frame. `play` usa una instancia que no
suena o, si no la hay, reinicia la más antigua. Al recibir un cambio de ajustes, la música hace `setVolume` y las
instancias que suenan también, para que el cambio se oiga al instante. `mute` va a `sound.mute`. Expone `locked`
(`sound.locked`) y `loaded`. Nunca llama a `add` con una clave ausente (D1, `WebAudioSound` lanza).

**D8. Carga del audio** (`BootScene`, opcional como los iconos). Recibe la dependencia
`audio?: { key, url }[]`, que solo existe **sin `?e2e`**. En `preload` hace `this.load.audio(key, url)`. Un fallo
solo se anota en `failed` y su cue queda en silencio. La URL es `audioUrl(base, file)` en `assetUrl.ts`
(`assets/audio/`). Con `?e2e`, `new Phaser.Game({ audio: { noAudio: true } })`: no se crea `AudioContext` ni se pide
ningún fichero, y `SoundOut` es la versión muda (todo `missing`). El juego sin `?e2e` y sin ficheros crea el
contexto pero no pide nada.

**D9. Ajustes** (`src/infrastructure/audio/`):
- `audioSettingsSchema.ts`: zod `{ version: 1, music: int 0..100, effects: int 0..100, muted: boolean }` estricto.
- `LocalStorageAudioSettingsRepository`, con el patrón de `LocalStorageProgressRepository`: recibe
  `() => Storage`, usa la clave `sprint-survivors/audio` (espacio de nombres de ADR-0010), devuelve `Result` y nunca
  lanza. `load()` da `ok(null)` si no hay valor, `err('unavailable')` si falla el acceso y `err('corrupt')` si zod
  falla o el JSON es inválido, sin tocar el valor. `save()` da `quota-exceeded` o `unavailable`. **No hay puerto en
  `application`**: solo lo usa el adaptador y no hay una segunda implementación previsible (regla de
  sobreingeniería).
- `AudioSettingsStore`: estado actual y suscriptores. `set({ music?, effects? })` sujeta el valor a [0, 100] y lo
  redondea a `sliderStep`. Además tiene `toggleMute()`. Cada cambio avisa a los suscriptores (mezclador, controles y
  barra) y guarda. Si la carga da `null` o un error, usa los `defaults` de `audio.json`; con `corrupt`, además, un
  `console.warn` (como el progreso). El valor dañado se sobrescribe en el siguiente cambio.
- «Borrar datos» del menú **no** toca la clave de audio: `ClearProgress` borra solo la suya. Si la spec quiere
  borrarla también, se añade en `wireProgress`.

**D10. Controles** (`src/infrastructure/dom/AudioControls.ts`). Es un `fieldset` con `legend` «Sonido», dos
`<input type="range">` (Música y Efectos, de 0 a 100 con `step` = `sliderStep`, cada uno con su `<label>`) y un botón
«Silenciar» con `aria-pressed`. Un evento `input` aplica el valor al instante (`store.set`) y uno `change` es el que
guarda, así que no se escribe en cada píxel del arrastre. Solo usa `textContent` y `addEventListener` (CSP). **Un
componente y un estado**: hay dos instancias, una en `MenuPanel` (tras las acciones) y otra en `PausePanel` (entre
el título y las acciones), y las dos se suscriben al mismo `AudioSettingsStore`. Se descarta un modal propio, porque
abrirlo en la pausa chocaría con Esc (la pausa lee Esc del motor en `window` y reanudaría). Los paneles reciben el
nodo como parámetro opcional (`extra?: HTMLElement`), y `MenuPanel.setLocked` también lo desactiva (con la guía o
el diálogo abiertos, ninguna opción del menú tiene efecto).
- **Tecla M** (`src/infrastructure/dom/MuteKey.ts`): un `keydown` en `document` con `code === 'KeyM'`, sin
  `repeat` y sin Ctrl/Alt/Meta, llama a `toggleMute()`. Vive lo que la página: funciona en el menú, en partida, en
  pausa y con la retención (0033 conserva el teclado). No choca con nada, porque las teclas del juego son
  WASD/flechas, Esc, R y 1–3, y M no está en el `KeyboardPlugin`. Tampoco la ve `PauseGate`.
- **`TouchBar`**: botón de silencio siempre visible en modo móvil (menú incluido), con `aria-pressed` y dos
  iconos SVG en `touchIcons.ts` (`data:`, ya permitidos por `img-src`). Llama a `toggleMute()` directamente, como
  ⛶, porque no es una acción de la partida. `TouchBar` recibe `audio?: { toggle(): void; subscribe(...) }`.
- Limitación conocida: en la pausa, las flechas no mueven el deslizador con el teclado porque `KeyboardInput`
  captura las flechas (`addKeys`, captura por defecto). Funcionan el puntero y el toque, y M. En el menú la escena de
  partida no está activa. Se comprueba a mano en verify.

**D11. Sonda `window.__sprint.audio`** (solo con `?e2e`, también en el menú):
`{ enabled, music, settings, requested, played, dropped, missing, byCue, activeVoices }`.
- `enabled` vale `false` con `?e2e`. `music` es el estado de `musicState` (lógico, también sin ficheros).
- `requested`, `played`, `dropped` y `missing` son totales desde la carga. `dropped` va por motivo (`muted`,
  `locked`, `cooldown`, `cueLimit`, `voices`) y `byCue` tiene `{ requested, played, dropped }`.
- Invariantes: `requested = played + Σ dropped` y `missing ≤ played` (con `?e2e`, `missing = played`).

Los contadores salen de la lógica pura, no del motor, así que son coherentes con los snapshots en modo manual.

**D12. Procedencia y guardarraíl** (`.claude/hooks/guard-assets.mjs`, `checkAssets` sigue pura). La nota gana la
lista `sounds[]` con `{ path, title, author, source, url, license, downloadedOn, sha256, bytes }`. Reglas nuevas:
1. Todo `.ogg/.mp3/.wav` versionado necesita una entrada en `sounds[]`.
2. El audio solo puede estar en `public/assets/audio/` (va también en `pathProblems`, así que el modo hook lo ve al
   escribir).
3. `license === 'CC0'` exacto, así que CC-BY y el resto fallan. `url` empieza por `https://`, `downloadedOn` es una
   fecha de calendario y no se admiten campos desconocidos.
4. Cada entrada está versionada, su sha256 y sus bytes coinciden y no se repite.
5. Ninguna ruta de `sounds[]` puede estar en `files[]`, `fonts[]` ni `generated[]`, y ningún audio puede estar en
   `generated[]` (ya fallaba por `AI_DIR`/`.png`; se añade un mensaje propio).
6. **Tope de peso**: la suma de los bytes medidos (`digest`) de todo el audio versionado debe ser
   ≤ `AUDIO_MAX_BYTES` = 2.097.152. Lo comprueba `guard:all`, que va dentro de `verify` y del CI.

`registeredPaths` no incluye `sounds[]`, de modo que un audio no vale como hoja ni al revés. `soundPaths` es una
función aparte. Los tests de `tests/guardrails/assets.test.ts` cubren cada regla con listas de ficheros y digests
falsos, sin ficheros reales. Con `sounds: []` (placeholders) todo pasa.

**D13. CSP sin cambios.** Web Audio carga por XHR (`connect-src 'self'`) y decodifica un `ArrayBuffer`, así que no
usa `blob:` ni `data:`. La reserva HTML5 Audio usa `<audio src>` (`media-src` cae en `default-src 'self'`).
`tests/guardrails/csp.test.ts` no cambia. Queda pendiente la confirmación manual con `npm run build` + `vite preview`
sin `?e2e` y con los ficheros reales (escucha y consola sin violaciones), que se anota en el verify-report.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Intacto (ni `RunSnapshot` cambia) |
| application | — | — | Intacto |
| infrastructure | `audio/audioCues.ts` (`AudioCues`, `CueId`) | Nueva | Pura: diff, dedupe, origen (D2, D3) |
| infrastructure | `audio/VoiceBudget.ts` | Nueva | Pura: tope, limitación, motivos, contadores (D4, D11) |
| infrastructure | `audio/musicState.ts` | Nueva | Pura (D6) |
| infrastructure | `audio/AudioDirector.ts` | Nueva | Sin motor: une `AudioCues` + `VoiceBudget` + `musicState` + `SoundOut`; `onSnapshot`, `onScreen`, `setHeld`, `setHidden`, `reset`, `probe` |
| infrastructure | `audio/SoundOut.ts` (interfaz + `silentSoundOut`) | Nueva | Costura con el motor; muda en `?e2e` |
| infrastructure | `audio/PhaserSoundOut.ts` | Nueva | Motor: pools, música en bucle, mute y volumen (D7) |
| infrastructure | `audio/audioSettingsSchema.ts`, `LocalStorageAudioSettingsRepository.ts`, `AudioSettingsStore.ts` | Nueva | D9 |
| infrastructure | `content/audioSchema.ts`, `content/loadAudio.ts` (`parseAudio`, `soundPaths`) | Nueva | D5 |
| infrastructure | `dom/AudioControls.ts`, `dom/MuteKey.ts` | Nueva | D10 |
| infrastructure | `dom/MenuPanel.ts`, `dom/PausePanel.ts`, `dom/TouchBar.ts`, `dom/touchIcons.ts`, `phaser/BootScene.ts` | Mod. | Nodo extra, botón de silencio, carga opcional de audio |
| composition | `audioWiring.ts` | Nueva | Repositorio, store, controles, M, director y sonda |
| composition | `main.ts`, `contentBoot.ts`, `progressWiring.ts`, `mobileWiring.ts`, `assetUrl.ts` | Mod. | `audio.noAudio` con `?e2e`, `pauseOnBlur = false`, `HIDDEN`/`VISIBLE`, `onRender` → director, `started` → `reset`, `audioUrl` |
| contenido | `content/audio.json`, `content/asset-provenance.json` (`sounds: []`) | Nueva / Mod. | Los ficheros reales llegan después |
| guardarraíl | `.claude/hooks/guard-assets.mjs` + `tests/guardrails/assets.test.ts` | Mod. | D12 |
| estilos | `src/styles.css` | Mod. | `.audio-controls` con las variables del kit (0032) y reglas `is-mobile` |

## Flujo
```mermaid
sequenceDiagram
  participant GS as GameScene (sin cambios)
  participant C as composition (audioWiring)
  participant D as AudioDirector
  participant Q as AudioCues (pura)
  participant B as VoiceBudget (pura)
  participant O as SoundOut (Phaser / mudo)
  GS->>C: onRender(snapshot)
  C->>D: setHeld(hold()); onSnapshot(snapshot)
  D->>Q: next(snapshot) → [{cue,count}]
  loop por cue en orden de prioridad, por suceso
    D->>B: request(cue, tick×TICK_MS, settings, locked)
    B-->>D: aceptado | motivo
    D->>O: play(cue, cue.volume × effects/100) si aceptado
  end
  GS->>C: onScreen(screen)
  C->>D: onScreen(screen) → musicState → O.music(state, vol)
```
Un frame puede pintar varias veces: tienda, obra, elección y frame. Cada render es un diff propio y el resultado es
el mismo, porque el estado se lleva de un render al siguiente.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Phaser Sound ya está en `phaser` 4.2.1 | Howler.js (dependencia nueva que duplica lo que trae el motor) |

## Rendimiento y seguridad
- **Núcleo**: 0 ms/tick añadidos (no se toca). `BALANCE_BASELINE` y las firmas quedan idénticas sin regenerarlas.
- **Por render**: el diff es O(golpes nuevos + recogibles + proyectiles), con ≤ 49 golpes por tick, ≤ 436
  recogibles y ≤ 15 ticks por frame. Usa dos `Set` de ids que se alternan y se vacían, sin reservar memoria por
  frame. Objetivo < 0,1 ms, medido con un bench opcional (no bloquea).
- **Motor**: ≤ `maxVoices` fuentes de Web Audio a la vez, con pools preasignados.
- **Memoria**: el PCM decodificado ocupa mucho más que el OGG (60 s estéreo a 44,1 kHz ≈ 21 MB en float32).
  Se recomienda una música ≤ 90 s.
- **Bundle**: unos pocos kB de código propio, sin dependencias. El audio son ≤ 2 MB en `public/` (D12).
- **Entradas externas**: los ajustes de `localStorage` pasan por zod y caen a los valores por defecto. `audio.json`
  y la nota pasan por zod y por el guardarraíl. Los ficheros de audio solo los decodifica el navegador.
- **Seguridad**: sin secretos, sin red de terceros y con la CSP intacta (D13). El autor descarga las fuentes CC0 a
  mano. El repo solo guarda las URL en la nota.

## Riesgos
- Si los ficheros no llegan, el change no puede cerrar la escucha real, pero todo lo demás cierra con `file: null`.
- La heurística de D3 puede fallar en casos límite, con un impacto de otro timbre.
- Safari antiguo no reproduce OGG: `console.warn` del cargador y silencio (se acepta en el proposal).
- `decodeAudioData` con un fichero dañado da un `console.error` del motor fuera de `?e2e`. Ningún E2E lo ve, porque
  con `?e2e` no se carga audio.
- La numeración de ADR-0031 está sin confirmar contra `origin` (este agente no tiene shell). Hay que hacer
  `git fetch` y renumerar si la PR #91 ocupa ese número.

## Pruebas (orientación para tasks)
- Unitarias puras: `AudioCues` (cada fila de D2, cada rama de D3, `reset`, tick que retrocede, tick igual sin
  recogida), `VoiceBudget` (cada motivo, purga e invariante), `musicState` (tabla) y `AudioDirector` con un
  `SoundOut` falso.
- Infraestructura con dobles (`fakeDom`, `Storage` falso): repositorio (patrón del de progreso), store,
  `AudioControls`, `MuteKey`, `TouchBar`, `parseAudio` y el cruce con `sounds[]`, y `PhaserSoundOut` con un
  `sound` falso (pool, sin `add` de claves ausentes).
- Guardarraíl: cada regla de D12 en `assets.test.ts`.
- E2E (1, ampliando un test de `gameplay.spec` en modo manual): ninguna petición a `/assets/audio/`, la sonda
  cumple las invariantes tras `step(n)` con golpes, M cambia `settings.muted` y sobrevive a la recarga, `music`
  pasa a `paused` con Esc, y 0 errores de CSP y de consola.

## ADRs
- `docs/adr/0031-audio-en-el-adaptador-con-phaser-sound.md` (nuevo): el audio se deriva del snapshot en el
  adaptador, Phaser Sound detrás de `SoundOut`, y solo audio CC0 con lista propia en la nota.
