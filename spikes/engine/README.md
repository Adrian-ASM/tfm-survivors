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

## Resultados

Ejecutado el 2026-11-19 por Claude desde la app de Claude (Desktop Commander para la terminal y el navegador
integrado de la app para medir). Equipo: DESKTOP-QI7JIPP (Windows 10/11 x64) · Navegador: Chromium 156 del
navegador integrado de Claude · Monitor: 165 Hz (techo observado). Servidor `vite` en modo desarrollo.

FPS medios / 1% low durante 10 s (techo = 165):

| Motor | 200 | 500 | 1.000 | 2.000 | 5.000 | 20.000 | ¿Funcionó a la primera? |
|---|---|---|---|---|---|---|---|
| Phaser 4.2.1 (WebGL) | 165 / 161 | 165 / 161 | 165 / 161 | 163,5 / 161 | 165 / 161 | 164,9 / 161 | Sí |
| Kaplay 3001.0.19 | 165 / 161 | 165 / 161 | 163,5 / 161 | **79,8 / 54,9** | **27,9 / 23,5** | — | Sí |
| Canvas 2D | — | 165 / 161 | — | 165 / 161 | **89,2 / 27,5** | — | Sí |

"—": no medido (los valores vecinos ya estaban en el techo o el motor ya había caído).
Durante algunas mediciones el usuario tuvo el foco en la página (pulsaciones registradas); no afecta al coste
de render, que es lo que se mide.

Lectura: hasta 1.000 entidades los tres van al techo. Kaplay se hunde a partir de 2.000 (pierde la mitad de
los frames) y Canvas 2D empieza a tener tirones fuertes a 5.000 (1% low de 27). Phaser 4 aguanta **20.000**
entidades en el techo gracias al batching de WebGL: margen de sobra para proyectiles, gemas de XP y partículas.

## Fricción con la IA (evidencia para la memoria)

El código de los tres adaptadores lo escribió Claude (Opus 5.5) **sin poder ejecutarlo** (sin terminal en el PC).
Anota aquí cada error real que salga al arrancar: API inexistente, mezcla con Phaser 3 o Kaboom.js, opciones
mal nombradas… y cuántas iteraciones hicieron falta para que funcionara. Puntos de riesgo marcados en el código:

- Phaser: `textures.addCanvas`, `add.image`, firma de `Scene.update`.
- Kaplay: opciones `canvas` / `global` / `background`, componentes `pos` / `circle` / `color`, `k.dt()`.

| Motor | Error encontrado | Causa (API inventada / de otra versión / otra) | Iteraciones |
|---|---|---|---|
| Phaser 4.2.1 | Ninguno | — | 0 (funcionó a la primera) |
| Kaplay 3001.0.19 | Ninguno en consola; el canvas no se centra igual que en los otros dos | Kaplay gestiona su tamaño de canvas | 0 |
| Canvas 2D | Ninguno | — | 0 |
| Entorno | `npm` bloqueado en PowerShell por la política de ejecución (`npm.ps1`) | Configuración de Windows, no de la IA | 1 (usar `npm.cmd`) |

Sorpresa positiva: con versiones fijadas y las APIs de riesgo marcadas, no hubo mezcla de APIs de Phaser 3/4
ni de Kaboom/KAPLAY en este escenario mínimo. El riesgo sigue vivo para APIs menos comunes (escalado, audio,
filtros de Phaser 4), así que se mantiene la regla de verificar contra la documentación oficial.

## Criterios de decisión (ADR-0001)

1. Rendimiento con 500-1.000 entidades (un survivors llega a cientos en pantalla).
2. Fricción con la IA: cuántas APIs inventó o confundió.
3. Coste de lo que no trae: audio, escalado/letterbox, carga de assets, texto/HUD, partículas.
4. Encaje como adaptador: que el motor solo pinte un snapshot sin imponer su modelo de entidades.
