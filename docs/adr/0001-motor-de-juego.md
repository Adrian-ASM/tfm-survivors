# ADR-0001 · Motor de juego 2D

- **Estado**: aceptada
- **Fecha**: 2026-11-19 (propuesta y decisión el mismo día, tras el spike)
- **Evidencia**: rama `spike/engine`, `spikes/engine/README.md`

## Contexto
Necesitamos render 2D en navegador con cientos de entidades, input de teclado (táctil después), audio y un
ecosistema que la IA conozca bien. El motor queda aislado como adaptador (ADR-0002), así que la decisión es reversible
a coste acotado.

## Opciones
1. **Phaser 4**: maduro, WebGL con batching, plantillas oficiales Vite + TS. Riesgo: la IA mezcla APIs de Phaser 3.
2. **Kaplay**: API muy sencilla para prototipar. Riesgo: menor rendimiento con muchas entidades y la IA propone APIs de Kaboom.js.
3. **Canvas 2D a mano**: cero dependencias y control total; más trabajo en audio, escalado y pools.

## Spike
Mismo escenario en los tres (jugador + N enemigos que persiguen), con una simulación común de paso fijo y seed fija;
cada motor solo pinta. FPS medios / 1% low en 10 s, monitor de 165 Hz, navegador Chromium 156:

| Motor | 1.000 | 2.000 | 5.000 | 20.000 |
|---|---|---|---|---|
| Phaser 4.2.1 | 165 / 161 | 163,5 / 161 | 165 / 161 | 164,9 / 161 |
| Kaplay 3001.0.19 | 163,5 / 161 | 79,8 / 54,9 | 27,9 / 23,5 | — |
| Canvas 2D | — | 165 / 161 | 89,2 / 27,5 | — |

Los tres adaptadores funcionaron a la primera, sin APIs inventadas ni mezcladas entre versiones.

## Decisión
**Phaser 4.2.1**, versión exacta en `package.json`.

- Rendimiento: es el único que no se degrada en todo el rango medido (hasta 20.000 entidades). Un survivors suma
  enemigos, proyectiles, gemas y partículas; Kaplay cae a la mitad con 2.000 y Canvas tiene tirones a 5.000.
- Encaje como adaptador: pintar un snapshot del núcleo con `add.image` + `setPosition` fue directo, sin adoptar el
  modelo de entidades del motor.
- Trae lo que Canvas obligaría a construir: audio (Web Audio), escalado, carga de assets, texto y partículas.

## Consecuencias
- Positivas: margen de rendimiento muy amplio; ecosistema y documentación oficiales.
- Negativas: bundle mayor que Kaplay o Canvas; API grande, con riesgo de que la IA proponga APIs de Phaser 3.
- Mitigación: versión fijada, verificar APIs nuevas contra la documentación oficial de Phaser 4 y mantener todo
  el uso del motor dentro de `src/infrastructure` (AGENTS.md §3).
- Pendiente para el change 0001: medir el tamaño del bundle de producción y actualizar Vite (el spike usó 8.1.0;
  en npm ya hay una versión más reciente).
