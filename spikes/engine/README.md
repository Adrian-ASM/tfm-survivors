# Spike · motor de juego (ADR-0001)

> **Desechable.** Vive solo en la rama `spike/engine`. No se fusiona en `main`: su resultado es la ADR-0001.

Mismo escenario en tres opciones: jugador (WASD/flechas) + N enemigos que le persiguen. La simulación es común
(`src/scenario.ts`, paso fijo de 1/60 s y seed fija) y cada motor **solo pinta**, como pide ADR-0002. Los FPS se
miden igual en los tres (`src/bench.ts`, frames reales de `requestAnimationFrame`).

Proyecto aislado en `spikes/engine/` con su propio `package.json`, así que el CI del repo no lo detecta.

## Cómo ejecutarlo

```powershell
git fetch ; git switch spike/engine        # o en un worktree: ./scripts/worktree.ps1 spike engine
cd spikes/engine
npm install
npm run dev                                # abre http://localhost:5173
```

Antes de medir:
- Comprueba si hay versiones más nuevas: `npm view phaser version`, `npm view kaplay version`, `npm view vite version`.
  Si cambian, actualiza `package.json` (versión exacta) y anótalo.
- Anota la **frecuencia del monitor** (60/120/144 Hz): es el techo de FPS. Con 144 Hz, "144" significa "sin pérdida".
- Cierra otras pestañas pesadas y deja el portátil enchufado.

## Resultados (rellenar)

Equipo: ___ · Navegador: ___ · Monitor: ___ Hz

| Motor | 200 (media / 1% low) | 500 | 1.000 | 2.000 | ¿Funcionó a la primera? |
|---|---|---|---|---|---|
| Phaser 4.2.1 | | | | | |
| Kaplay 3001.0.19 | | | | | |
| Canvas 2D | | | | | |

## Fricción con la IA (evidencia para la memoria)

El código de los tres adaptadores lo escribió Claude (Opus 5.5) **sin poder ejecutarlo** (sin terminal en el PC).
Anota aquí cada error real que salga al arrancar: API inexistente, mezcla con Phaser 3 o Kaboom.js, opciones
mal nombradas… y cuántas iteraciones hicieron falta para que funcionara. Puntos de riesgo marcados en el código:

- Phaser: `textures.addCanvas`, `add.image`, firma de `Scene.update`.
- Kaplay: opciones `canvas` / `global` / `background`, componentes `pos` / `circle` / `color`, `k.dt()`.

| Motor | Error encontrado | Causa (API inventada / de otra versión / otra) | Iteraciones |
|---|---|---|---|
| | | | |

## Criterios de decisión (ADR-0001)

1. Rendimiento con 500-1.000 entidades (un survivors llega a cientos en pantalla).
2. Fricción con la IA: cuántas APIs inventó o confundió.
3. Coste de lo que no trae: audio, escalado/letterbox, carga de assets, texto/HUD, partículas.
4. Encaje como adaptador: que el motor solo pinte un snapshot sin imponer su modelo de entidades.
