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
4. **Síntesis en tiempo real sin ficheros**: sin assets, pero no cumple «ficheros CC0 con procedencia» y la música
   medieval no resulta creíble.

## Decisión
Opción 2.
- `AudioCues` (pura) compara cada snapshot pintado con el anterior. Deduplica por id (golpes y explosiones) o por
  contador (`kills`, `level`, oro de la tienda, estado de los solares). Las recogidas solo se cuentan si el tick
  avanzó. El origen del impacto se deduce cruzando `hits` con `blasts` y con los proyectiles desaparecidos.
- `VoiceBudget` (pura) aplica el tope y la limitación con el reloj `tick × TICK_MS`.
- `PhaserSoundOut` reproduce con pools preasignados y nunca llama a `add` con una clave sin cargar.
- Con `?e2e` va `audio.noAudio` y no se pide ningún fichero. `pauseOnBlur` se apaga y la pestaña oculta se trata
  con `HIDDEN`/`VISIBLE`.
- El audio es **solo CC0**. Cada fichero tiene su entrada en la lista `sounds[]` de `content/asset-provenance.json`,
  y `guard-assets` lo vigila junto con un tope de 2 MB en `public/assets/audio/`. El audio no cabe en `files[]`,
  `fonts[]` ni `generated[]`.

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
