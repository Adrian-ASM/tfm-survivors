# ADR-0001 · Motor de juego 2D

- **Estado**: propuesta (pendiente de spike)
- **Fecha**: 2026-11-19

## Contexto
Necesitamos render 2D en navegador con cientos de entidades, input de teclado (táctil después), audio y un
ecosistema que la IA conozca bien. El motor queda aislado como adaptador (ADR-0002), así que la decisión es reversible
a coste acotado.

## Opciones
1. **Phaser 4**: maduro, WebGL con batching, plantillas oficiales Vite + TS. Riesgo: la IA mezcla APIs de Phaser 3.
2. **Kaplay**: API muy sencilla para prototipar. Riesgo: menor rendimiento con muchas entidades y la IA propone APIs de Kaboom.js.
3. **Canvas 2D a mano**: cero dependencias y control total; más trabajo en audio, escalado y pools.

## Decisión
Pendiente. Spike en `spike/engine` con el mismo escenario en cada opción (jugador + N enemigos que persiguen):
medir FPS con 200 / 500 / 1.000 entidades y anotar la fricción con la IA (iteraciones, APIs inventadas).
Comprobar la versión actual en npm el día del spike y fijarla exacta en `package.json`.

## Consecuencias
Se completará tras el spike.
