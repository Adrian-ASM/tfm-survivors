# Exploración 0030 · pickup-visibility

Intención: recogibles (oro, madera, carne, piedra, gema XP) más grandes, con hoja de aparición en oro/madera/carne y flote leve en los cinco. Radio de recogida y balance intactos. Solo infraestructura y contenido.

## Contexto actual
- `src/infrastructure/phaser/PickupLayer.ts`: un `SlotPool` de Σ topes = 436 sprites (300 + 32 + 64 + 8 + 32). El hueco se asocia por id y `appearing` es true solo la primera vez que el id entra en el pool (o tras `clear()`). Hoy `show` fija aspecto, frame 0 y `at(x, y)` en cada frame.
- Aspecto (`content/appearance.json` `pickups`): oro, madera y carne con `G_Idle`/`W_Idle`/`M_Idle` (128 px, 1 frame) y `scale` 0,3, es decir unos 38 px de lienzo y mucho menos de dibujo. Piedra: 3 rocas `Deco/04`-`06` (64 px, `scale` 0,5). Gema: `{shape:true, placeholderColor}` sin escala propia; `looks.ts` la pinta con el disco de reserva a `2·gemRadius/64`, o sea 10 px (`gemRadius` 5, `progression.json`).
- Esquema zod: `src/infrastructure/content/appearanceSchema.ts` (`StillSchema` strict, `RockAspectSchema`, `XpShapeSchema` strict, `PickupLooksSchema`). Añadir un campo exige tocar el esquema, `looks.ts` (`PickupLook`) y los tests de esquema.
- Radio lógico: atracción `pickupRadius` 128 (`player.json`) y recogida por solape con `gemRadius`. No dependen del sprite; cambiar la escala no toca el núcleo.
- Reloj: `AnimClock` en `RenderLayers` (`renderMs`). `advance(delta, paused || status !== 'running')` lo congela en pausa, elección, tienda, obra y fin de partida; en `?e2e&manual` avanza `ticks · TICK_MS` (determinista). La espuma (`animateFoam`) y los árboles (`MapAnimator`, fase por celda, `phasedFrameAt`) usan ese reloj, así que se detienen igual en pausa.
- Sondas/tests: `sprites.pickups.<tipo>.visible/placeholder` (`tests/e2e/probe.ts`, `gameplay.spec.ts` líneas ~292-380, 578). Ninguno depende de escala ni de frame.
- Carga de hojas: `bootPlan.ts` deduplica por `file` desde el aspecto; una hoja nueva entra sola si figura en el aspecto.

## Hojas `*_Spawn` y procedencia
- Existen en el pack, no en el repo: `C:\Users\Adri\TFM\Tiny Swords (Update 010)\Resources\Resources\{G,W,M}_Spawn.png`. Se ven 7 fotogramas de 128 px (≈ 896 × 128). El fotograma 0 parece vacío; del 1 al 6 el objeto aparece con un anillo que se va cerrando, y el 6 queda en la pose de reposo. Hay que confirmarlo con la cuadrícula real al aplicar. Los tres llevan la sombra incluida (no se pueden usar las variantes `NoShadow`).
- Guardarraíl (`.claude/hooks/guard-assets.mjs`, `content/asset-provenance.json`): cada gráfico versionado necesita entrada con `path`, `source`, `version` "Update 010", `sha256` y `bytes`, y el fichero debe ser byte a byte el del pack. Nada del Free Pack ni `.aseprite`. Las 3 hojas son aptas.
- Choque con specs y tests existentes: `openspec/specs/asset-provenance/spec.md` prohíbe versionar `*_Spawn.png` y `M_Spawn.png`. Los tests que lo vigilan: `tests/infrastructure/resource-provenance.test.ts` (84-86, regex `_Spawn`), `sheep-provenance.test.ts` (75-77, `M_Spawn`), `appearance-schema.test.ts` (139-141, `M_Spawn`) y `appearance-hazards.test.ts` (217, `W_Spawn.png`). El change debe llevar un delta de esas specs y actualizar los 4 tests.

## Capacidades/specs afectadas
`sprite-rendering` (pickups, animación), `asset-provenance` (levantar la prohibición de las 3 hojas Spawn), contenido de aspecto (appearance-schema/content). Sin tocar `xp-gems` ni `resources` (núcleo).

## Opciones
- A. Misma sprite, dos hojas por recogible, todo por reloj (sin tweens): `appearing` guarda `startMs = renderMs`; hasta `7/fps` se usa la hoja Spawn (`setTexture`, como la oveja) y luego la Idle. Flote = desplazamiento Y senoidal con fase derivada del id, aplicado en `at()`.
  Pros: cero objetos nuevos, determinista, se congela con el reloj, un solo cambio de capa. Contras: `setTexture` en cada aparición; la sombra incluida en la hoja sube y baja con el objeto.
- B. Animación por tweens/anims de Phaser. Pros: menos código propio. Contras: no se congela solo en pausa, ni sigue `step(n)` del modo manual, y deja de ser testeable sin motor; rompe el patrón de 0012/0029.
- C. A + sombra elíptica propia (un `Graphics` o un pool de 436 más) para que el flote no mueva la sombra. Pros: mejor lectura visual. Contras: +436 objetos o redibujo por frame; hay que quitar la sombra de la hoja (no se puede).
- Gema y piedra: flote igual que A. La gema necesita un campo de tamaño (`scale` o `size`) en `XpShapeSchema`, porque hoy su tamaño sale del radio.

## Riesgos e incógnitas
- Cuándo aparece: `SlotPool.appearing` ya da el "una sola vez por id". No se repite al reciclar el hueco, porque el `startMs` se reasigna al aparecer y el id nunca se reutiliza (ADR-0006). `clear()` (R, menú) reinicia.
- Montón de madera desde el tick 0 (ids 0..N-1): reproducirían la aparición todos a la vez al empezar, con fase nula. Mitigación: saltar la hoja en el primer `sync` o desfasar por id. Decisión del autor.
- Fuera de cámara la aparición se gasta: los pickups no tienen recorte, así que el jugador ve aparecer solo los cercanos. Probable que valga.
- Frenado por tamaño: sobre 436 sprites, un `setPosition` por frame ya existe; añadir `sin` es despreciable. Más escala = más solape con jugador y recogibles agrupados (hasta 300 gemas).
- Legibilidad del radio: atracción 128 no cambia, pero un sprite mucho mayor que `gemRadius` 5 sugiere un radio de recogida que no es real. Mantener escalas moderadas.
- Capas: los recogibles van bajo ovejas, enemigos y jugador, así que agrandarlos no tapa HUD; sí puede ocultarse tras entidades.
- Reserva: si falla una hoja Spawn, saltar la aparición; si falla la Idle, la reserva de siempre.
- E2E: ninguno depende de escala ni frame. e2e-lite: un único test, en manual, ampliando uno de humo; el resto con tests unitarios de capa (`render-layers`, `stone-render`, `layers-clear`).
- Determinismo/balance: el flote no pasa por el núcleo, así que `BALANCE_BASELINE` queda idéntica y no hace falta medirla.

## Pregunta GDD: zoom de cámara por tamaño de ventana
Hoy `Scale.RESIZE` con tope `maxView` 2.560 × 1.440 (ADR-0014), zoom 1, lienzo centrado por CSS: en un 4K el lienzo no crece más allá del tope, así que lo pequeño es todo el juego, no solo los recogibles. Un zoom (ADR-0014, opción 2) exige zoom no entero (emborrona salvo ×2), cámara de UI separada para HUD y overlays (hoy `scrollFactor` 0 sobre una sola cámara), revisar `CameraRig`, el recorte de 0018 y los `watchScreen`/`hudLayout`. Con zoom > 1 el área visible baja y `ringRadius` 1.500 sigue fuera de pantalla; con zoom < 1 habría que subir `ringRadius` (zod exige > media diagonal del tope, 1.468). Es un change propio de riesgo medio y toca viewport/HUD. Recomendación: dejarlo fuera y abrirlo como change aparte si el autor lo quiere.

## Deuda a incluir
AGENTS.md (0029) dice "Árbol con `idle` 0–5 a 6 fps". Verificado en `content/appearance.json` (`map.trees.idle`): frames [0, 1, 2, 3], fps 4 (PR #77). Corregirlo en este change (la torre goblin sigue en 0–3 a 5 fps). Hay una nota en la memoria del usuario que lo recoge.

## Mediciones previas
No aplica: no fija objetivo de balance, ritmo ni rendimiento. Se comprobará que `BALANCE_BASELINE` no cambia (el núcleo no se toca) y que los objetos del mapa siguen en 820/904 (los recogibles no cuentan en ese total).

## Preguntas para el usuario (con recomendación)
1. Escala: oro, madera y carne 0,3 a 0,5-0,6 (≈ 64-77 px); piedra 0,5 a 0,75-1; gema de 10 px a unos 20 px. Recomiendo 0,5 / 0,75 / 20 px y ajustar tras verlo.
2. Flote: amplitud 3-4 px, periodo ~1,6 s, fase por id. Recomiendo seno, 4 px y 1,6 s.
3. Montón de madera inicial: ¿reproduce la aparición? Recomiendo que sí, desfasada por id, para que el mapa "despierte"; alternativa válida: saltarla.
4. Gema y piedra: ¿solo flote o también un destello al aparecer? Recomiendo solo flote, como dice la historia.
5. Sombra: ¿que se mueva con el objeto (opción A) o sombra propia (C)? Recomiendo A y ver si la baked-in estorba.
6. Zoom de cámara: recomiendo dejarlo fuera de 0030.
7. Corrección de AGENTS.md del árbol: confirmar que entra aquí.
