# ADR-0031 · Audio en el adaptador, derivado del snapshot y con Phaser Sound

- **Estado**: propuesta
- **Fecha**: 2026-11-26

## Contexto
El change 0035 añade música y efectos. El núcleo es puro y determinista (ADR-0002) y no debe cambiar: el balance y
las firmas tienen que quedar idénticos. Los sucesos que suenan (golpes, bajas, recogidas, subidas, explosiones,
compras y obras) ya se ven en el `RunSnapshot`, incluidos los golpes con id y ventana de ADR-0027. En E2E,
`step(n)` puede cruzar muchos ticks en un frame, así que el audio no puede depender del reloj de pared. El navegador
bloquea el audio hasta un gesto. La CSP es estricta. Y el guardarraíl de procedencia no conocía el audio.

## Opciones
1. **El núcleo emite eventos de audio**: es preciso, pero toca `Run`, el snapshot y las firmas, y lleva a la
   simulación algo que es solo presentación.
2. **Diff de snapshots en el adaptador + Phaser Sound** detrás de una interfaz `SoundOut`, con el tope de voces y
   la limitación por tipo en lógica pura.
3. **Diff en el adaptador + un módulo propio sobre Web Audio**: da control total, pero repite el desbloqueo, la
   carga, la reserva HTML5, el mute y la reanudación en iOS que ya trae Phaser.
4. **Síntesis en tiempo real sin ficheros**: sin assets, pero no cumple «ficheros con licencia abierta y procedencia» y la música
   medieval no resulta creíble.

## Decisión
Opción 2.
- `AudioCues` (pura) compara cada snapshot procesado con el anterior. Deduplica por id (golpes y explosiones) o por
  contador (`kills`, `level`, oro de la tienda, estado de los solares). Las recogidas no cuentan en un snapshot en el
  que se ha construido algo. El origen del impacto se deduce cruzando `hits` con `blasts` y con las flechas de torre
  desaparecidas, dentro de una tolerancia de contenido.
- `EffectMixer` (pura) deja pasar como mucho 1 efecto por tipo y snapshot. Aplica un intervalo mínimo medido con el
  reloj de render del adaptador (en modo manual avanza `n × TICK_MS` por `step(n)`) y un tope de voces sobre los
  efectos que suenan.
- `SoundOut` tiene tres implementaciones: `PhaserSoundOut` (pools perezosos y acotados, nunca `add` con una clave
  sin cargar), la muda de `?e2e` y la no disponible para navegadores sin Web Audio.
- Con `?e2e` o sin Web Audio va `audio.noAudio`, sin camino HTML5 Audio. La carga va en una escena técnica en
  paralelo y no retrasa el menú. `pauseOnBlur` se apaga y la pestaña oculta se trata con `HIDDEN`/`VISIBLE`.
- El audio es **CC0, CC-BY-3.0 o CC-BY-4.0**; otras licencias (NC, SA, ND, otras versiones) se rechazan. Cada
  entrada CC-BY tiene su atribución (título, autor, URL y licencia literales) en una línea de `CREDITS.md`, que
  `guard-assets` también vigila (commit y CI) y que el `README.md` enlaza. El juego no muestra créditos. Cada
  fichero tiene su entrada en la lista `sounds[]` de `content/asset-provenance.json`,
  con URL `https` de `kenney.nl`, `opengameart.org` o `freesound.org`, y `guard-assets` lo vigila en
  `public/assets/audio/`. El audio no cabe en `files[]`, `fonts[]` ni `generated[]`. El tope de peso (6 MB, 6.291.456 bytes; `.ogg`, `.mp3`, `.wav` y `.flac`) lo comprueba un
  test del repositorio dentro de `verify`.

## Consecuencias
- Positivas: el núcleo, el balance y las firmas quedan intactos. La lógica se prueba sin motor ni navegador. Los
  contadores de la sonda son deterministas en modo manual. Desbloqueo, carga y reserva vienen del motor. Y no hay
  dependencias nuevas.
- Negativas / costes: el origen del impacto es heurístico y puede equivocarse en casos límite (otro timbre). El
  diff depende de que cada snapshot mutado se pinte, cosa que hoy hacen `ShopGate`, `BuildGate` y la elección.
  Además, se depende de la API de sonido de Phaser.
- Cómo revertirla: quitar `audioWiring` de la composición y la carga de `BootScene` deja el juego mudo como
  antes. Para pasar a Web Audio propio basta con otra implementación de `SoundOut`. Si un día hace falta precisión
  total en el origen, se añade un campo `source` al `HitSnapshot` en un change del núcleo.
