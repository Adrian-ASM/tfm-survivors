# ADR-0019 · Comportamiento de enemigos como estados de clase cerrada en contenido y peligros de área en el núcleo

- **Estado**: aceptada (change 0020-enemy-behaviors, verify C0 del 2026-11-24)
- **Fecha**: 2026-11-24

## Contexto
Hasta 0019 los tres goblins solo se distinguen por sus stats: `Enemy` no tiene estado y el único daño es el contacto.
El GDD pide comportamiento por tipo en contenido (Barril kamikaze, TNT con dinamita y aviso). La parte B (patrulla,
alerta, vuelta al puesto, campamentos) usará la misma base. Fuerzas:
- AGENTS.md §3.5: sin números mágicos, todo en `content/*.json` con zod.
- Núcleo puro y determinista. El balance se mide con un bot en las semillas 1..50.
- Rendimiento: 300 vivos, ≤ 0,25 ms/tick en el peor caso (informativo) y sin asignaciones en el tick (ADR-0003).
- Las specs exigen rechazar al cargar clases desconocidas, destinos inexistentes, estados iniciales ausentes y
  nombres repetidos. Eso supone estados con nombre y destinos explícitos.
- El daño de área tiene que convivir con un golpe por tick y con la invulnerabilidad.

## Opciones
1. **Arquetipos en código** (`chaser | kamikaze | artillery` con parámetros): no hay estados ni destinos en
   contenido, y cada variante de la parte B obliga a tocar el dominio.
2. **Estados con nombre de una clase cerrada** (`chase` con salida por distancia, `fuse`, `charge`, `wait`), cada uno
   con sus parámetros y su destino, compilados a arrays con índices.
3. **FSM general** (movimientos, condiciones y efectos combinables, o una librería como xstate): más flexible, pero
   más difícil de validar, admite combinaciones sin sentido y con una librería se asigna por evento.

Para el daño de área:
- a. Dinamitas y explosiones como entidades del núcleo en pools. Los avisos se derivan del estado.
- b. Efectos instantáneos sin entidad: no permiten un aviso visible en el snapshot ni que el bot lo esquive.

## Decisión
**Opción 2 con a.**
- `Behavior` es un VO de `EnemyType`. Cada enemigo lleva su índice de estado y su tick de entrada como escalares
  mutables. La semántica de cada clase es fija:
  - `chase` se mueve y, tras moverse, sale si d ≤ `distance`.
  - `fuse` está quieto y explota al terminar. El barril queda dado de baja con gema y no se daña con su propia
    explosión.
  - `charge` está quieto y, al terminar, lanza una dinamita si hay sitio bajo `maxDynamites`. Si no, espera sitio.
  - `wait` está quieto y pasa a su destino al empezar el paso de comportamiento.
- El radio y el daño de la explosión, y el vuelo de la dinamita, son parámetros del estado. En `hazards` solo están
  los globales (`maxDynamites`, `dynamiteRadius`, `blastTicks`).
- Orden del tick: comportamiento → armas y su `removeDead` → explosiones (los barriles de este tick, en orden de
  lista, y luego las dinamitas, en orden de creación) → `removeDead` → lanzamientos → golpe al jugador con
  `max(contacto, explosión)`.
- Fuego amigo por solape estricto de círculos. No hay reacciones en cadena. Nada consume azar.
- Las clases nuevas de la parte B (`patrol`, `alert`, `return`) se añaden ampliando la unión cerrada, con
  `assertNever` en el dominio y `discriminatedUnion` en zod.

## Consecuencias
- Positivas:
  - El comportamiento se lee y se calibra en `enemies.json`.
  - El contenido inválido se rechaza con el tipo y el campo.
  - El coste es mínimo: ramas por clase, comparaciones al cuadrado y pools.
  - El bot puede esquivar porque el aviso está en el snapshot desde el primer tick.
  - La parte B reutiliza la misma máquina.
- Negativas / costes:
  - El orden del tick, los dos `removeDead`, la regla del tope (esperar sitio), el orden de explosiones y
    lanzamientos y la regla de que todos los barriles del tick explotan entran en el **contrato de determinismo**.
    Si cambian, cambian las partidas y hay que volver a medir el balance.
  - Cada clase nueva exige un change de dominio (es deliberado).
  - `damage` de contacto pasa a ser opcional.
  - El pool de explosiones solo crece al superar su máximo histórico. El render tiene un tope visual
    (`maxBlastSprites`).
- Cómo revertirla: quitar `Behavior` y `HazardField`, y con ello todos los tipos con un único `chase`, devuelve la
  persecución de 0019 y obliga a recalibrar.

## Addendum · resultados del apply
Calibración (tarea 6.2) con `measureBalance` y el bot v3 sobre `BALANCE_SEEDS` 1..50. Partida de los valores de
design §5 (`maxDynamites` 24, barril 40/40/64/20, TNT 260/30/45-56-15/90, curva 9/3).

**Hallazgo del bot v3.** Con la distancia de lanzamiento de 260 el bot pierde las 50 semillas aunque los peligros
casi no hagan daño (2 dinamitas de daño 5: 0/50). El TNT lanza desde fuera del radio de huida (150 px): sin
enemigos cerca, `fleeInput` da (0, 0), el bot está quieto, la dinamita apunta a su centro exacto, la suma de la
esquiva es nula ("en el centro de todos los avisos") y la regla le manda usar la huida, que sigue siendo (0, 0).
Recibe todas las dinamitas. La regla es la de la spec y no se toca; la palanca que lo resuelve está permitida: una
distancia de lanzamiento < 150 deja al TNT dentro del radio de huida.

| Lote (cambios sobre design §5) | Victorias | Quietos vivos (generado) | Quietos vivos (vacío) |
|---|---|---|---|
| ninguno | 0 | — | 21, 43 |
| `maxDynamites` 8 · 4 · 2 (con daños 5/10) | 0 | — · — · 10, 23, 32, 42, 48 | 21, 43 · … |
| lanzamiento 140 | 29 | — | 21, 43 |
| lanzamiento 140, barril daño 25 · 26 · 28 · 30 | 28 · 28 · 27 · 24 | — | 43 |
| lanzamiento 140, mecha 30 · 24 · 20 (daño 25) | 25 · 21 · 23 | 42 · 42 · 39, 42 | 21 · — · — |
| lanzamiento 140, radio 72 · 80, activación 30 · 48 | 22 · 19 · 21 · 24 | — · — · 12, 42 · — | 43 · 43 · — · 7 |
| lanzamiento 150 · 130 · 120 · 100 · 80 (daño 25–30) | 13 · 29 · 31 · 37 · 36 | — | 43 |
| lanzamiento 140, daño 25, `xpGrowth` 4 | 19 | — | — |
| lanzamiento 120, daño 25, `xpGrowth` 4 | 25 | — | — |
| **lanzamiento 100, daño 25, `xpGrowth` 4** | **27** | **—** | **—** |

Ninguna combinación solo de comportamiento y peligros dejó a 0 el quieto con el mapa vacío (la semilla 43
sobrevive en todas las que dan ≥ 25 victorias), así que se usó también la segunda palanca, la curva de XP
(`xpGrowth` 3 → 4; delta de `leveling`).

Contenido final: TNT con salida a **100** (cotas: 38 < 100 ≤ 360; vuelo 45 ≥ 21), barril con daño de mecha **25**
(40 < 64; mecha 40 ≥ 12), el resto como en design §5 (`maxDynamites` 24, `dynamiteRadius` 8, `blastTicks` 30);
curva **9/4**. Oleadas, `maxAlive`, anillo, `player.speed`, stats, armas y mejoras sin cambios.

Plazos del quieto con el contenido final (mapa generado): semilla 7, primera baja en el tick 728, primer pulso en el
1.524, primera oferta en el **2.082** (igual que antes) y primer golpe en el 2.276; semilla 42, primer golpe en el
2.442. Bot v3: **27/50** victorias; quietos vivos en el tick 10.799: 0 con el mapa generado y 0 con el vacío.

Bench (`npm run bench`, informativo, máquina del apply): peor caso con proyectiles **0,195 ms/tick** y peor caso
con peligros **0,038 ms/tick** (600 ticks en 10 bloques de 60 rehechos con `RunSetup`; contenido por defecto con
sus armas), ambos ≤ 0,25 ms.
