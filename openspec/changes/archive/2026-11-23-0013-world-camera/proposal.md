# Proposal · 0013-world-camera

- **Estado**: aprobada por el usuario el 2026-11-23, tal cual: mundo 2x, alternativa (a) aceptar 2x en el límite
  de la banda y tabla de nombres sin cambios
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0013-world-camera`

## Problema
La arena mide lo mismo que la vista (960x540, `content/arena.json`): no hay mundo que recorrer, la cámara está fija
y los enemigos aparecen recortados contra los bordes de la pantalla. El GDD v2.0 (exploración, castillo, mapa en 0014)
necesita un mundo mayor que la vista con una cámara que siga al jugador.

Además, las dimensiones de la arena están duplicadas fuera del contenido (`DEFAULT_ARENA` 960x540 del bot de referencia
en `tests/support/policies.ts`, `ARENA` de `enemies.spec.ts`, `builders.ts`): si el mundo cambia, el bot y los E2E
razonan con una geometría falsa.

Por último, los textos visibles de mejoras y armas siguen siendo del tema anterior ("Skill: CI rápido", "el Linter"),
incoherentes con el arte medieval de 0012.

## Objetivo
- El mundo es mayor que la vista; la cámara sigue al jugador y nunca muestra nada fuera de los límites del mundo.
- El jugador no puede salir del mundo; los enemigos aparecen alrededor de la vista (fuera de pantalla) y dentro del mundo.
- El suelo cubre el mundo entero.
- Una sola fuente de las dimensiones: el bot (`fleeInput`), los E2E y los builders leen la arena de `content/arena.json`.
- Las 9 mejoras muestran nombres y descripciones medievales; los ids no cambian.
- El balance sigue dentro de la banda calibrada en 0010 sin tocar stats.

## Alcance
- **Dentro**:
  - Tamaño del mundo en `content/arena.json` (propuesta: **1920x1080**, 2x la vista; la vista sigue en 960x540).
  - Cámara del adaptador que sigue al jugador con límites iguales al mundo (seguimiento directo, sin suavizado).
  - Suelo del tamaño del mundo (el aspecto de reserva de 0012 también lo cubre entero).
  - Jugador limitado al mundo y enemigos aparecen en el anillo alrededor de la vista, recortado al mundo (el dominio ya
    lo soporta; cambian los números de los escenarios).
  - HUD y overlays siguen fijos en pantalla con la cámara en movimiento.
  - `fleeInput`, E2E y builders leen la arena del contenido; se elimina `DEFAULT_ARENA` y la `ARENA` duplicada.
  - Escenario del bench "200 enemigos encima del jugador" adaptado para que siga habiendo contacto con cualquier arena
    (posición relativa al jugador, no un punto fijo).
  - Renombrado medieval **solo de textos** (`name` y `description` de `content/upgrades.json`), tabla abajo.
- **Fuera**:
  - Orden de pintado por y, minimapa, zona muerta o suavizado (lerp) de la cámara, variación del suelo.
  - Renombrado de ids (`linter`, `tests`, `strict-rules`…): se queda para un change aparte si se decide.
  - Cambios de stats de armas, enemigos, mejoras u oleadas.
  - Mapa con obstáculos, recursos o castillo (0014 en adelante). Tajo frontal (el arma sigue siendo un pulso circular).
  - Límite de proyectiles por el mundo (siguen igual que hoy).

### Renombrado propuesto (para revisar en el gate)
Las armas no tienen nombre propio en pantalla: solo aparecen en las descripciones de las mejoras. Se nombran como
**Arco** (`linter`, proyectil) y **Tajo** (`tests`, pulso circular alrededor del jugador, sin prometer arco frontal).

| id | Nombre actual → propuesto | Descripción propuesta |
|---|---|---|
| `strict-rules` | Skill: reglas estrictas → **Puntas de acero** | Las flechas del arco hacen más daño. |
| `fast-ci` | Skill: CI rápido → **Tensado rápido** | El arco dispara más a menudo. |
| `wide-analysis` | Skill: análisis amplio → **Ojo de halcón** | El arco alcanza objetivos más lejanos. |
| `hard-asserts` | Skill: asserts estrictos → **Filo templado** | El tajo hace más daño. |
| `watch-mode` | Skill: modo watch → **Brazo incansable** | El tajo se lanza más a menudo. |
| `coverage` | Skill: más cobertura → **Barrido amplio** | El tajo llega más lejos a tu alrededor. |
| `guardrail` | Guardrail → **Cota de malla** | Más vida máxima (y la misma cantidad de vida actual). |
| `shortcuts` | Atajos de teclado → **Botas de viajero** | Te mueves más rápido. |
| `context-window` | Ventana de contexto → **Amuleto del saqueador** | Atraes las gemas desde más lejos. |

El guardado (`Progress`) no almacena ids ni nombres de mejoras: el renombrado no afecta a `localStorage` ni al JSON
exportado/importado.

## Capacidades afectadas
- `openspec/specs/player-movement` (modificada: límites del mundo con los números nuevos).
- `openspec/specs/enemy-spawning` (modificada: escenarios con 960x540 y "arena igual a la vista").
- `openspec/specs/enemy-behavior` (modificada: enemigos dentro del mundo, números).
- `openspec/specs/sprite-rendering` (modificada: el requisito del fondo dice "no hay mundo mayor ni cámara"; pasa a
  suelo del tamaño del mundo y cámara con límites).
- `openspec/specs/run-outcome` (modificada: bot de referencia con la arena del contenido y banda de balance).
- `openspec/specs/upgrades` (modificada solo si algún escenario cita nombres o descripciones visibles).
- Cámara: posible capacidad nueva `world-camera` o requisito dentro de `sprite-rendering` (lo decide spec/design).

## Riesgos y dudas
- **Balance frágil en 2x**: con 1920x1080 el bot gana 25/50, justo el límite inferior de la banda 25–35. Cualquier
  cambio posterior de contenido puede sacarlo de banda. Mediciones previas (semillas 1..50, `fleeInput` con la arena real):

  | Tamaño | Victorias/50 | Quietos supervivientes | Muerte quieta media |
  |---|---|---|---|
  | 960x540 (actual) | 30 | 0 | 81,8 s |
  | 1920x1080 (2x) | 25 | 0 | 82,2 s |
  | 2880x1620 (3x) | 13 | 0 | 82,8 s |
  | 3840x2160 (4x) | 22 | 0 | 82,8 s |

  Desde 2x el anillo de spawn deja de recortarse contra los bordes. La relación no es monótona (3x peor que 4x), así
  que el tamaño no se puede extrapolar. Hipótesis **sin confirmar**: `fleeInput` solo huye y no recoge gemas, por lo
  que en mundo abierto sube menos de nivel.
- **Alternativas abiertas** (decisión del usuario, no hechos): (a) aceptar 2x en el límite; (b) ampliar la banda
  (p. ej. 20–35) y documentarlo; (c) mejorar el bot para que recoja gemas y recalibrar en este change o en otro.
- Rendimiento: ms/tick 0,110 (base) frente a 0,119 (4x) en el peor caso; sin impacto en el núcleo. El coste de render
  de un suelo de 1920x1080 en Phaser 4 no está medido (se comprueba en E2E con `CI_LIKE=1`).
- Las sondas E2E dan coordenadas de mundo; hasta ahora coincidían con las de pantalla. Las specs que comprueben
  posiciones en pantalla deben convertirlas con la cámara.
- Los proyectiles no se limitan al mundo: pueden verse fuera del suelo cerca del borde (aceptado, fuera de alcance).

## Criterio de éxito
- Escenarios de las capacidades modificadas en verde (unitarios y E2E); `npm run verify` y la suite E2E completa verdes,
  también con `CI_LIKE=1`.
- Con el mundo elegido: el jugador no supera los límites del mundo en ningún eje; la cámara no muestra nada fuera del
  mundo al llevar el jugador a las 4 esquinas; HUD y overlays en la misma posición de pantalla con la cámara movida.
- Ningún enemigo aparece fuera del mundo en el tick de su aparición, y lejos de los bordes tampoco dentro del
  rectángulo de la vista; cerca de un borde se acepta dentro de la vista a `minDistance` o más (spec
  `enemy-spawning`; corregido el 2026-11-23 con aprobación del usuario tras el contraste de tasks).
- Bot de referencia (semillas 1..50): victorias dentro de la banda vigente (25–35 salvo que el gate la cambie);
  con 1920x1080 la medición previa da 25.
- Invariante: con las semillas 1..50, ningún jugador quieto sobrevive 180 s (medición previa: 0 supervivientes).
- `rg DEFAULT_ARENA` sin resultados en `tests/`; ninguna dimensión 960x540 del mundo escrita fuera de `content/`.
- Bench "200 enemigos encima del jugador" con contacto en todos los ticks medidos, con cualquier tamaño de arena.
- Los 9 `name`/`description` de `content/upgrades.json` coinciden con la tabla aprobada; los ids no cambian.
