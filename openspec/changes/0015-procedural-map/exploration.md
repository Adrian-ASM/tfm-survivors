# Exploración · 0015-procedural-map

Intención: mapa procedural por semilla con colisión del jugador (troncos y agua bloquean, la copa no) y zona de
inicio reservada para el castillo. El GDD aún lo llama "0014" (renumerado; corregir al archivar).

## Contexto actual
- Mundo 1.920 × 1.080 y vista 960 × 540 en `content/arena.json`. `Arena` (`src/domain/arena/Arena.ts`) es solo un
  rectángulo con `clampCircle`; `Player.move` (`src/domain/player/Player.ts`) lo usa y no conoce obstáculos.
  Jugador: radio 16, velocidad 200 px/s (`content/player.json`). Rejilla de 64 px = 30 × 17 celdas.
- Azar: `Run.start(config, random: RandomGenerator, setup)` recibe un flujo ya sembrado (Mulberry32 en
  `src/infrastructure/random/`), no un número. Quien lo consume antes (el mapa) desplaza la secuencia de oleadas.
- Render: `GroundView.ts` pinta un mosaico de un solo frame (`ground`, frame 11 de `Tilemap_Flat.png`) con reserva
  lisa; `CameraRig`, `appearance.json` (`ground`) y la sonda `window.__sprint` (`camera`, `world`, `sprites`).
- Bot: `tests/support/policies.ts` (`fleeInput`) huye de enemigos y de las 4 paredes; no conoce obstáculos.
- Arte versionado: solo 8 PNG (`content/asset-provenance.json`); terreno = `Tilemap_Flat.png`.
- Ya existen specs vivas relevantes: `world-camera`, `player-movement`, `enemy-spawning`, `xp-gems`,
  `sprite-rendering`, `asset-provenance`, `run-outcome` (balance).

## Specs afectadas
Nuevo `procedural-map` (generación, determinismo, conectividad, reserva de inicio); `player-movement` (colisión);
`world-camera` (sonda del mapa); `sprite-rendering` y `asset-provenance` (hojas nuevas); `run-outcome` (banda de
victorias con el mapa); posiblemente `enemy-spawning` y `xp-gems` (ver riesgos).

## Arte (riesgo "spike previo: autotiling y si se ve bien")
Pack Update 010 en disco (`C:\Users\Adri\TFM\Tiny Swords (Update 010)`), CC0, fuera del Free Pack. Útiles, aún no
versionados (habría que copiarlos con sha256 a la nota de procedencia):
- `Terrain/Ground/Tilemap_Flat.png` (ya versionado, 640 × 256, 10 columnas de 64 px): hierba en bloque 3×3 con
  orla oscura + tira vertical + tira horizontal + pieza suelta. Es un autotile de 4 vecinos (16 combinaciones), sin
  esquinas diagonales ni "blob" completo. Sirve para orillas hierba-agua.
- `Terrain/Water/Water.png` (64 × 64, color liso) y `Water/Foam/Foam.png` (8 frames de espuma animada).
- `Resources/Trees/Tree.png` (768 × 576, 6 árboles de 192 px + tocón): la copa es alta, el tronco es la base
  pequeña; encaja con "tronco bloquea, copa no".
- `Terrain/Bridge/Bridge_All.png` (192 × 256): puente de tablas horizontal y vertical, con piezas sueltas.
- Aviso: el pack es isométrico-plano con orla en la propia hierba; el agua se ve como "marco" de la isla, no como
  río con orilla propia. Un río de 1–2 celdas con este autotile puede quedar tosco.

**Recomendación**: no hace falta un spike desechable aparte. El riesgo es solo visual y se acota: (1) renderizar
con autotile de 4 vecinos y aspecto de reserva (rectángulos de color) si una hoja no carga, patrón ya probado en
0012; (2) puerta visual como primera tarea del apply (captura de 3–4 semillas, el usuario decide), igual que el
punto de control de balance de 0013; (3) partir el change (ver Opciones) para que el aspecto no bloquee la lógica.

## Opciones de alcance
- **A. Todo en un change** (mapa + colisión + render con arte + balance). Pros: entrega completa; contras: es el
  patrón de 0012 (33 tareas, 46 min de apply), mezcla lógica pura, arte, procedencia y balance.
- **B. Partir en dos**: 0015a mapa puro + colisión + sonda + bot/balance con aspecto de reserva (colores);
  0015b arte (autotile, árboles, agua, puente, procedencia). Pros: el núcleo y el balance se cierran con
  independencia del arte; contras: un change más y un estado intermedio feo pero jugable.
- **C. Tres piezas**: 0015a generador + conectividad (sin colisión), 0015b colisión + balance, 0015c arte.
  Pros: cada pieza pequeña; contras: 0015a no entrega valor jugable.

## Para el flow-field (0016)
- Dejar en el mapa una **rejilla de celdas con tipo** (hierba, tronco, agua, puente, castillo) consultable por
  celda, y una consulta `isWalkable(celda)` separada de la geometría del círculo; puentes como celdas del mapa
  (el generador ya las necesita para la conectividad del jugador). Sin enemigos usándolas todavía.
- Pregunta de diseño: hasta 0016 los enemigos ignoran troncos y agua (atraviesan) o quedan bloqueados.

## Riesgos e incógnitas
- **Balance**: hoy 25/50 (límite inferior de 25–35). El bot no esquiva troncos: se atasca y puede bajar de la
  banda; o con obstáculos que solo frenan al jugador baja más. Un obstáculo a favor del jugador (enemigos que no
  atraviesan) lo subiría. Hace falta medir (abajo). Cualquier cambio de consumo del RNG reordena las 50 semillas.
- **RNG**: generar el mapa con el mismo flujo cambia las oleadas de cada semilla; un flujo derivado de la semilla
  exige cambiar la API (`Run.start` no recibe número). Decisión de diseño.
- **Gemas y spawns**: `placeSpawn` y la caída de gemas ignoran obstáculos; una gema en agua o tronco es
  inalcanzable (el imán de 128 px ayuda, no garantiza). Posible spec delta en `xp-gems`/`enemy-spawning`.
- **Colisión círculo-rejilla**: deslizamiento sin atascos en esquinas, radio 16 frente a celdas de 64; tests
  deterministas por semilla.
- **Conectividad "zonas clave"**: hoy no existen (campamentos, solares, minas llegan en 0016–0020). Definir qué es
  zona clave en este change (inicio, esquinas, bordes) y cómo se comprueba (BFS con radio del jugador).
- **Zona de inicio**: tamaño del castillo y su colisión (¿bloquea?); `RunSetup` ya coloca al jugador con `at`.
- **E2E**: los tests de `logic` asumen posiciones (p. ej. esquinas (16,16) de `camera.spec`) que ahora pueden ser
  agua o troncos; la sonda necesita exponer el mapa (hash/celdas) y quizá un mapa vacío por URL para tests de
  cámara. Render de miles de celdas: usar un único RenderTexture o tilemap, no un sprite por celda (60 fps con
  CPU frenada, `CI_LIKE`).
- La ruta del bot de 0010 y los E2E con `?e2e&seed=N` pueden cambiar de resultado.

## Mediciones previas (las lanza el orquestador antes de propose)
1. Con un generador prototipo (desechable) y colisión, bot actual sobre semillas 1..50: victorias, tiempo de primera
   subida, tiempo medio de derrota; umbral: 25–35 victorias y los jugadores quietos mueren < 180 s en las 50.
2. Lo mismo con el bot "consciente de obstáculos" (repulsión de celdas bloqueadas) y con enemigos que atraviesan
   frente a enemigos bloqueados; umbral idéntico. Con la densidad de obstáculos en tres niveles (p. ej. 5/10/20 %).
3. Conectividad: BFS desde el inicio sobre 1..50 (y 1..1000 para cola) con radio 16; umbral 100 % de celdas
   caminables alcanzables; fracción de mapa caminable ≥ 70 %.
4. Coste: generar y colisionar < 0,2 ms/tick en `npm run bench`; generación del mapa < 20 ms.

## Preguntas para el usuario
1. ¿Partimos en 0015a (lógica) y 0015b (arte)? ¿O todo junto?
2. Hasta 0016, ¿los enemigos atraviesan troncos y agua?
3. ¿Qué cuenta como "zona clave" en este change (inicio, esquinas, bordes) dado que campamentos y solares no existen?
4. ¿El castillo es un obstáculo sólido o solo decorativo hasta 0019? ¿Tamaño?
5. ¿Se acepta mover la banda de victorias o se retoca el bot / densidad para mantenerla en 25–35?
6. ¿Una gema que cae en agua o tronco se recoloca en la celda caminable más cercana?
7. ¿Densidad de agua y bosque (mapa más abierto o más laberíntico)?
