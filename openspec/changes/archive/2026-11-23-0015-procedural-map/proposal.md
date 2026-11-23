# Proposal · 0015-procedural-map

- **Estado**: aprobada (2026-11-23)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0015-procedural-map`
- **Origen**: `exploration.md` de este change; historia "mapa distinto por semilla" del GDD (allí aún numerada
  0014; se corrige al archivar).

## Problema
El mundo de 1.920 × 1.080 (change 0013) es un prado vacío e idéntico en todas las partidas: no hay nada que rodear,
la semilla solo cambia las oleadas y el jugador puede huir en línea recta en cualquier dirección. El GDD v2.0 pide un
mapa medieval generado por semilla, con bosques, ríos y puentes, en el que el jugador choque con troncos y agua, y
que reserve la zona de inicio para el castillo (llega en el change de castillo-tienda). Además, los changes
siguientes (campo de flujo, campamentos, recursos, solares) necesitan un mapa consultable por celdas sobre el que
apoyarse.

## Objetivo
- Cada partida tiene un mapa de rejilla generado por su semilla: hierba, manchas de troncos y un río con puentes.
  Misma semilla → mismo mapa celda a celda; semillas distintas → mapas distintos.
- El jugador no atraviesa troncos ni agua, desliza a lo largo de ellos y cruza el río por los puentes.
- Todo el terreno caminable es alcanzable desde el inicio; la zona de inicio está libre.
- Ninguna gema queda en una celda no caminable.
- Los E2E pueden leer el mapa de la partida por la sonda `window.__sprint`.
- El mapa se ve con un aspecto de reserva (colores lisos por tipo de celda), sin arte nuevo.
- El balance vuelve a estar dentro de la banda vigente con el mapa activo.

## Alcance
- **Dentro**:
  - Generación pura y determinista del mapa a partir de la semilla de la partida, como parte del núcleo, con sus
    parámetros (tamaño de celda, densidades, número de puentes, radio de la zona de inicio…) en `content/*.json`
    validado con zod.
  - Tipos de celda: hierba, tronco, agua y puente. Caminables: hierba y puente. No caminables: tronco y agua.
  - Zona de inicio reservada alrededor del centro del mundo (donde ya aparece el jugador), toda caminable.
  - Conectividad garantizada: toda celda caminable es alcanzable desde la zona de inicio por un círculo del radio del
    jugador.
  - Colisión del jugador contra celdas no caminables, con deslizamiento; se mantienen los límites del mundo.
  - Recolocación de cada gema que caiga en una celda no caminable a la celda caminable más cercana, de forma
    determinista y sin consumir azar.
  - Consulta de caminabilidad por celda disponible para el resto del núcleo (preparada para el campo de flujo, sin
    usarla aún en los enemigos).
  - Pintado del mapa con aspecto de reserva por tipo de celda, por debajo de todo lo demás y cubriendo el mundo.
  - Sonda E2E del mapa (dimensiones de la rejilla, tamaño de celda, tipo de cada celda o un resumen verificable, y
    la zona de inicio).
  - Bot de referencia consciente de obstáculos (v2) y recalibrado del balance para entrar en la banda.
  - Adaptación de los tests (unitarios y E2E de `logic`) que asumen posiciones libres.
- **Fuera**:
  - **Arte del mapa**: agua y espuma, orillas con autotile, árboles (tronco + copa), puente, castillo, y sus entradas
    en `content/asset-provenance.json`. Va en un change posterior (número a fijar al archivar; el campo de flujo se
    desplaza un número).
  - Castillo como obstáculo sólido o tienda (change de castillo-tienda); aquí la zona de inicio solo se reserva.
  - Navegación de enemigos: hasta el campo de flujo, **los enemigos atraviesan troncos y agua** y siguen persiguiendo
    en línea recta; sus spawns no tienen en cuenta el mapa.
  - Proyectiles y pulsos: no colisionan con el mapa.
  - Copa de los árboles (no existe sin arte; el tronco ocupa la celda).
  - Campamentos, recursos, casas goblin, solares, montones de leña, árboles talables, borde de agua del mundo como
    límite duro, minimapa.
  - Cambios en la duración de la partida (600 s) o en la banda de balance.

## Supuestos revisables (valores por defecto si el gate no dice otra cosa)
1. **Zona de inicio**: un disco centrado en el centro del mundo, toda caminable y sin obstáculos; el castillo sólido
   llega con el arte/la tienda. Prototipo: radio 180 px.
2. **"Zona clave"** (GDD: "el jugador alcanza todas las zonas clave") = toda celda caminable del mapa, alcanzable
   desde la zona de inicio. Cuando existan campamentos o solares, serán celdas caminables y quedarán cubiertas.
3. **Azar del mapa**: el mapa se genera con un flujo de azar derivado de la semilla, independiente del de las
   oleadas; generar el mapa no altera la secuencia de spawns de cada semilla.
4. **Tamaño de celda 60 px** (rejilla exacta de 32 × 18 en 1.920 × 1.080). El GDD dice 64 px, pero 64 no divide
   1.080; el change de arte tendrá que escalar los tiles de 64 px del pack. Ver pregunta abierta 1.
5. **Composición del mapa** (prototipo): 1 río serpenteante de 1 celda de ancho con 2–3 puentes, manchas de troncos
   de 3–8 celdas, densidad de troncos 12–15 % y agua ~6 %; fracción caminable ≥ 70 %.

## Mediciones previas (prototipo temporal, no versionado)
| Variante | Victorias bot /50 | Quietos vivos a 180 s |
|---|---|---|
| Sin mapa (hoy) | 25 | 0 |
| Mapa + bot actual (no ve obstáculos), cualquier densidad | 12–19 | 0 |
| Mapa + bot v2, troncos 5 % | 21 | 0 |
| Mapa + bot v2, troncos 10 % | 26 | 0 |
| Mapa + bot v2, troncos 12 % | 26 | 0 |
| Mapa + bot v2, troncos 15 % | 25 | 0 |
| Mapa + bot v2, troncos 20 % | 28 | 0 |

- Bot v2 del prototipo: además de huir de enemigos y paredes, las celdas de tronco y agua repelen como paredes
  (1/d², alcance 64 px) y, si la dirección elegida está bloqueada, prueba girar ±45°, ±90° y ±135°.
- Conectividad con rechazo de ríos/manchas que desconectan: 100 % en 1..50 y en 1..1000. Sin rechazo, con 20 %, cae
  al 58 %.
- Coste: generación ≤ 0,15 ms por mapa; colisión ~0,04 µs por tick.
- Lectura: el mejor encaje (12–15 %) queda en el límite inferior de la banda (24–28 con ruido ±3 entre variantes).

## Capacidades afectadas
- `openspec/specs/procedural-map` (nueva): contenido del mapa validado, tipos de celda, generación determinista,
  zona de inicio, conectividad, caminabilidad por celda, sonda E2E del mapa.
- `openspec/specs/player-movement` (modificada): colisión con celdas no caminables y deslizamiento; los escenarios que
  asumen un mundo libre pasan a declarar un mapa vacío o explícito.
- `openspec/specs/xp-gems` (modificada): recolocación de gemas que caen en celda no caminable.
- `openspec/specs/run-outcome` (modificada): bot de referencia v2 consciente de obstáculos y balance medido con mapa.
- `openspec/specs/sprite-rendering` (modificada): el fondo de hierba pasa a ser el mapa con aspecto de reserva por
  tipo de celda; recuento en la sonda de render si aplica.
- `openspec/specs/simulation-loop` (modificada, a confirmar en spec): determinismo y semilla incluyen el mapa; el
  snapshot o la sonda exponen el mapa de la partida.
- `openspec/specs/enemy-behavior` (modificada, a confirmar en spec): se hace explícito que los enemigos ignoran el mapa
  hasta el campo de flujo.
- `openspec/specs/world-camera` (sin cambios previstos; la sonda del mapa va en `procedural-map`).
- `openspec/specs/asset-provenance` (sin cambios: no entra arte nuevo).

## Lo que queda preparado para el campo de flujo
- Rejilla tipada consultable por celda (hierba, tronco, agua, puente) y una consulta de caminabilidad separada de la
  geometría del círculo del jugador.
- Puentes como celdas del mapa (no decoración), ya contados en la conectividad.
- Ningún enemigo la usa todavía; el change del campo de flujo decidirá si los enemigos chocan.

## Riesgos y dudas
- **Balance en el límite inferior**: con el mejor encaje el bot v2 da 24–28/50 y el ruido es ±3; un 24 queda fuera.
  Cambiar el bot de referencia obliga a revisar `run-outcome` (lo exige la propia spec). Ver pregunta abierta 2.
- **Reordenación por semilla**: aunque el mapa use un flujo propio, la geometría cambia el resultado de cada semilla;
  los E2E con `?e2e&seed=N` que esperan algo concreto de una partida pueden cambiar.
- **E2E de `logic` que asumen posiciones libres** (p. ej. esquinas (16, 16) en `camera.spec`, recorridos a las cuatro
  esquinas en `sprite-rendering`, movimientos de `player-movement`): pueden chocar con troncos o agua. Hace falta una
  forma de fijar un mapa vacío o conocido en E2E o reescribir los recorridos a partir de la sonda del mapa.
- **Render del mapa**: 576 celdas con un objeto por celda pueden costar frames con la CPU frenada (`CI_LIKE`); el
  mapa debe pintarse sin penalizar los E2E `realtime`.
- **Colisión círculo-rejilla**: deslizamiento sin atascos en esquinas de celdas ni "túneles" entre dos troncos en
  diagonal; los escenarios deben fijar estos casos con números.
- **Recolocación de gemas**: empates entre varias celdas caminables a la misma distancia necesitan una regla
  determinista explícita; una gema recolocada puede quedar más lejos del jugador que la posición de la baja.
- **Spawns en agua o troncos**: aceptado mientras los enemigos atraviesan; deja de ser válido con el campo de flujo.
- **Semillas extremas**: 0 y 4.294.967.295 deben generar mapas válidos y conectados.

## Preguntas abiertas para el gate
1. **Tamaño de celda**: ¿60 px (rejilla exacta, el arte se escala luego) o 64 px (como el GDD y el pack, con una fila
   parcial de 56 px en el borde inferior)?
2. **Margen de balance**: ¿se acepta quedar en 25–28 o se añade margen en este change (p. ej. un retoque pequeño de
   contenido) con objetivo en el centro-bajo de la banda (27–30)? Si hay retoque, ¿qué palanca (densidad, stats)?
3. **Densidad**: ¿troncos 12 % o 15 % (más abierto o más laberíntico) y agua ~6 % con un solo río?
4. **Mapa en E2E**: ¿se admite un parámetro de URL solo con `?e2e` para forzar un mapa vacío en los tests de cámara y
   render, o todos los E2E juegan con el mapa real y leen la sonda?
5. **Supuestos 1–3** (zona de inicio caminable sin castillo, "zona clave" = toda celda caminable, flujo de azar
   propio del mapa): ¿se confirman?
6. **Sonda del mapa**: ¿basta con dimensiones, tamaño de celda, recuentos por tipo y un hash del mapa, o se quiere la
   lista completa de celdas?

## Decisiones del gate (2026-11-23)
1. **Tamaño de celda**: 60 px, rejilla exacta de 32 × 18 en el mundo de 1.920 × 1.080. El change de arte escalará
   los tiles de 64 px del pack.
2. **Margen de balance**: no basta con quedar en 25; objetivo ~28/50 con un retoque pequeño de contenido. La palanca
   concreta (densidad, stats…) se decide en design/apply midiendo. La banda de la spec (25–35) no cambia.
3. **Densidad**: troncos 12 %; agua ~6 % con un solo río.
4. **Mapa en E2E**: parámetro de URL `?e2e&map=empty`, solo con `?e2e` y resuelto fuera del núcleo, que carga un
   mapa sin obstáculos. Los E2E de reglas existentes lo usan; los E2E nuevos del mapa juegan con el mapa real.
5. **Supuestos 1–3 confirmados**: zona de inicio de radio 180 px, caminable y sin castillo; "zona clave" = toda
   celda caminable; el mapa usa un flujo de azar propio derivado de la semilla.
6. **Sonda del mapa** (no se preguntó de forma explícita; decidido en spec): lista completa de celdas (576 con el
   contenido por defecto), dimensiones, tamaño de celda, recuentos por tipo y zona de inicio.

### Precisiones de la spec respecto a esta propuesta
- **Gemas atraídas**: el criterio "ninguna gema en celda no caminable" se aplica a las gemas **no atraídas**. Una
  gema atraída por el imán vuela en línea recta hacia el jugador y puede cruzar troncos o agua; si no, una gema
  atraída podría quedarse atascada, contra la regla viva "una gema atraída lo sigue siendo hasta que se recoge".
- **Rejilla con mundos no múltiplos de la celda**: la rejilla tiene ⌈ancho / celda⌉ × ⌈alto / celda⌉ celdas y las de
  la última fila y columna pueden quedar recortadas; así siguen valiendo los escenarios vivos con una arena explícita
  de 4.000 × 4.000. Con el contenido por defecto no hay recorte.

## Criterio de éxito
- **Determinismo**: la misma semilla genera el mismo mapa celda a celda en dos generaciones y en dos partidas; las
  semillas 1..50 producen 50 mapas distintos; generar el mapa no cambia la secuencia de spawns de esa semilla.
- **Conectividad**: con las semillas 1..50 y 1..1000, el 100 % de las celdas caminables es alcanzable desde la zona
  de inicio con el radio del jugador; fracción caminable ≥ 70 % en cada mapa; semillas 0 y 4.294.967.295 válidas.
- **Zona de inicio**: en todas esas semillas, el disco de inicio es enteramente caminable y el jugador aparece en el
  centro del mundo sin solapar ninguna celda no caminable.
- **Colisión**: el jugador no solapa nunca una celda de tronco o agua (escenarios con mapa explícito y una partida
  larga de 36.000 ticks con input aleatorio); desliza a lo largo de un obstáculo con el input diagonal; cruza un río
  por un puente.
- **Gemas**: ninguna gema no atraída del snapshot está en una celda no caminable en ningún tick; recolocar no
  consume azar.
- **Enemigos**: atraviesan troncos y agua sin cambio de trayectoria respecto a un mundo sin mapa.
- **Sonda E2E**: con `?e2e&seed=N`, la sonda expone el mapa de la partida y coincide con el que genera el núcleo para
  esa semilla; sin `?e2e` no existe.
- **Render**: el mapa cubre el mundo entero con un color distinto por tipo de celda, por debajo de todo; suite E2E
  completa verde, también con `CI_LIKE=1 --project=realtime --repeat-each=3`.
- **Balance**: bot de referencia v2 con victorias ≥ 25 y ≤ 35 en las semillas 1..50 (objetivo de calibración ~28,
  decisión 2 del gate) y ningún jugador quieto vivo a 180 s con ninguna de ellas, con el mapa real y con el vacío.
- **Coste**: generación del mapa < 20 ms; `npm run bench` sin regresión apreciable del tick con el tope de enemigos.
- `npm run verify` verde.
