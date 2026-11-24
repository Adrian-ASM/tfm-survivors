# ADR-0018 · Comportamiento de enemigos como estados de clase cerrada en contenido y peligros de área en el núcleo

- **Estado**: propuesta (change 0020-enemy-behaviors)
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
(Pendiente: balance del bot v3, valores finales de contenido, bench, primera oferta de la semilla 7 y demás plazos.)
