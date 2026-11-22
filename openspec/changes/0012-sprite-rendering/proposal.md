# Proposal · 0012-sprite-rendering

- **Estado**: aprobada (2026-11-22)
- **Issue**: (opcional)
- **Rama / worktree**: `change/0012-sprite-rendering`
- **Sustituye a**: la proposal aprobada el 2026-11-20 (planificación aparcada con la premisa "arte solo local"), que
  queda obsoleta con la visión v2.0 medieval del GDD y la confirmación CC0 de Tiny Swords Update 010.

## Problema
El juego no tiene identidad visual. Jugador, enemigos, proyectiles y gemas son círculos de color, el fondo es liso,
no se distingue a simple vista qué enemigo es cada uno, el jugador no se ve andar ni hacia dónde mira y los
enemigos desaparecen de golpe al morir. Además, el tema del código y de la interfaz ("Sprint Survivors", enemigos
`bug`, `memory-leak`, `merge-conflict`) ya no encaja con la visión v2.0 del GDD: caballeros contra goblins.

La planificación aparcada de 0012 suponía que el arte no podía versionarse ni publicarse. Con eso, Pages y CI
mostraban placeholders y el arte real solo se veía en local. El autor del pack confirmó el **2026-11-22** que Tiny
Swords "Update 010" es **CC0**. Eso permite versionar el arte y publicarlo, pero también obliga a demostrar en el
repo que solo entra arte con licencia registrada. El Free Pack actual no es CC0 y no puede entrar.

Sigue abierta la deuda **0009 · W2**: no hay E2E que compruebe los sprites tras **Volver al menú** ni el escenario
"Cinco ciclos menú-partida", porque la sonda no cuenta sprites. Su cierre se aplazó "con el change de arte".

## Objetivo
En la partida publicada en Pages, en local y en CI se ve el mismo arte:
- el jugador es el **Arquero** de Tiny Swords Update 010, animado (quieto, andar) y con volteo según la dirección;
- cada tipo de enemigo es un goblin del pack (`goblin-torch`, `goblin-tnt`, `goblin-barrel`), animado al andar,
  con volteo y con indicación de daño;
- los enemigos que mueren reproducen una animación de muerte (`Dead.png`);
- los proyectiles son flechas orientadas según su dirección de avance;
- las gemas de XP tienen sprite;
- el fondo es suelo de hierba.

El título visible pasa a ser **"Greentide Vanguard"** y los ids de enemigo pasan a los de las unidades del pack.
La jugabilidad, el balance, los stats y el núcleo de simulación no cambian. El repo contiene solo assets de Update
010 con procedencia y licencia registradas, y un guardarraíl lo comprueba.

## Alcance
- **Dentro**:
  - **Jugador (decisión 1)**: sprite del Arquero de Update 010 con animaciones quieto y andar, y volteo horizontal
    según la dirección del movimiento. Se conserva el parpadeo de invulnerabilidad (`playerVisible`, spec
    `player-health`).
  - **Enemigos (decisión 2)**: cada tipo usa la hoja de su unidad goblin (Torch, TNT, Barrel), con animación de
    andar, volteo según la dirección e indicación visual de daño fiel a `damaged` del snapshot (sustituye al cambio
    de color de relleno y a `enemyPalette.ts`). Solo cambian el arte y el aspecto. El movimiento sigue siendo el
    actual para los tres.
  - **Animación de muerte (decisión 4)**: cuando un enemigo muere, se reproduce una vez la animación de `Dead.png`
    en su última posición conocida y después deja de verse. Las salidas del snapshot que no son muertes (reinicio,
    fin de partida, Volver al menú) no la disparan. Los cadáveres en curso se limpian al reiniciar (R) y al
    **Volver al menú**.
  - **Proyectiles (decisión 4)**: sprite de flecha (`Arrow.png`) orientado según la dirección de avance.
  - **Gemas de XP (decisión 4)**: sprite propio, sacado del subconjunto de Update 010. La hoja concreta se decide en
    el design.
  - **Fondo (decisión 4)**: suelo de hierba de Update 010 que cubre el área de juego visible. Es solo un fondo:
    sin mundo mayor que la pantalla, sin cámara que siga al jugador y sin mapa (0013 y 0014).
  - **Pulso**: conserva el anillo actual, sin sprite.
  - **Renombrado de ids de enemigo (decisión 2)**: `bug`, `memory-leak` y `merge-conflict` se sustituyen por
    `goblin-torch`, `goblin-tnt` y `goblin-barrel` en `content/` (`enemies.json`, `waves.json`), en los tests y
    soportes (`tests/support`, bench, tests de dominio y de capas) y en las specs vivas afectadas, mediante deltas
    de este change. Qué id actual corresponde a cada goblin se decide en el **design**. Los stats (vida, velocidad,
    radio, daño, XP) se copian tal cual, y el bot de referencia de 0010 sigue dando entre 25 y 35 victorias sobre las
    semillas 1..50 sin recalibrar.
  - **Renombrado del título (decisión 3)**: "Greentide Vanguard" sustituye a "Sprint Survivors" en el menú, el
    `<title>` de `index.html`, los textos de la pantalla de resultados, `README.md` y `AGENTS.md`.
  - **Assets versionados con procedencia (decisión 5)**: un subconjunto mínimo de PNG de Update 010 entra en el repo
    junto con una nota de procedencia y licencia (`PROVENANCE` o similar) al lado de los assets. La nota registra el
    pack, el autor, la versión, la licencia CC0, la fecha de la confirmación del autor (2026-11-22) y la lista de
    ficheros incluidos. Sin ficheros de sistema (`.DS_Store`), fuentes (`.aseprite`) ni comprimidos.
  - **Guardarraíl de procedencia (decisión 5)**: un test o guardarraíl, ejecutado por `npm run verify` y por el CI,
    falla si `git ls-files` contiene un asset de imagen sin entrada en la nota de procedencia o cualquier fichero del
    Free Pack.
  - **Sustitución del ADR-0012 aparcado (decisión 5)**: `docs/adr/0012-arte-local-descubierto-en-build.md` (arte
    local con `import.meta.glob`, `@art`, `SPRINT_ART_DIR`, build E2E con fixtures sintéticas) queda sustituido. El
    ADR nuevo (estrategia de assets versionados, carga y CSP) lo escribe el `sdd-architect` en el design.
  - **Carga compatible con la CSP de 0007**, sin relajar `img-src 'self' data:` y sin cambiar las directivas de la
    CSP. Funciona igual arrancando desde el menú y con `?e2e` (que salta el menú), y en local, en CI y en Pages bajo
    la base `/tfm-survivors/`.
  - **Fallback de seguridad**: si una textura falla al cargar, ese elemento se pinta con un aspecto de reserva y la
    partida no se rompe ni deja errores no capturados en consola. Ya no es el camino normal: sirve para tests de
    capas y para fallos de carga.
  - **Sonda de render para E2E (decisión 6, cierra 0009 · W2)**: los E2E pueden contar los sprites visibles por tipo
    (jugador, enemigo vivo, cadáver, proyectil, pulso, gema). Con eso se automatizan "Cinco ciclos menú-partida" y
    la limpieza tras **Volver al menú** y tras R.
  - **Tests unitarios de las capas** con dobles, que sustituyen a la costura `CircleSprite`.
- **Fuera**:
  - Elección de personaje y el Guerrero (change **0017**, Should). En 0012 el jugador es siempre el Arquero.
  - Comportamientos propios de cada goblin (barril kamikaze, TNT que lanza dinamita, guardias, etc.), casas y
    campamentos (change **0016**). Animaciones de ataque de enemigos o del jugador.
  - Cambios de stats, de balance o de `content/run.json`. La duración de la partida (objetivo de 5 a 10 min) queda
    fuera (decisión 7).
  - Mundo mayor que la pantalla, cámara y límites (0013). Mapa procedural, tiles de agua y bosque, autotiling y
    colisión (0014).
  - Claves técnicas con "sprint": la clave de `localStorage` `sprint-survivors/progress`, el nombre del fichero de
    export `sprint-survivors-progress.json` y la sonda `window.__sprint`. Tampoco se renombran el repositorio ni la
    URL de Pages.
  - Assets del Free Pack (en ningún caso), variantes de color adicionales, `Buildings`, `UI` del pack, `Pawn` y
    `HappySheep`.
  - Atlas o spritesheets empaquetados o recortados por script (opción 3 de la exploración).
  - UI, HUD y menú con arte del pack. Audio.
  - Sprite para el pulso. Partículas.
  - Separación entre enemigos (horda amontonada).

## Capacidades afectadas
- `openspec/specs/sprite-rendering` (nueva): aspecto del jugador (Arquero) y de cada tipo de enemigo, animación por
  estado (quieto y andar), volteo, indicación de daño, muerte de enemigos y su limpieza en R y en **Volver al
  menú**, flecha orientada, sprite de gema, fondo de hierba, fallback ante textura ausente, carga sin violar la CSP
  con y sin `?e2e`, y sonda de recuento de sprites.
- Procedencia de assets (nueva capacidad o requisito dentro de `sprite-rendering`; lo decide la fase spec): solo
  assets de Update 010 con entrada en la nota de procedencia, nada del Free Pack, comprobado sobre `git ls-files`.
- `openspec/specs/auto-weapons` (modificada): *Indicación visual de daño, proyectiles y pulsos* (el destello deja de
  ser un cambio de color y pasa a ser cualquier indicación fiel a `damaged`). También se renombran los ids de enemigo
  en sus escenarios.
- `openspec/specs/main-menu` (modificada): *Cinco ciclos menú-partida* y la limpieza tras **Volver al menú** pasan a
  ser verificables con la sonda. "Sprites visibles de enemigo" cuenta los vivos; los cadáveres se cuentan aparte.
  Si alguna spec fija el texto del título del menú, se actualiza a "Greentide Vanguard".
- `openspec/specs/run-results` (posiblemente modificada): 0 cadáveres visibles tras reiniciar con R. Textos de
  resultados con el título nuevo si la spec los fija.
- Renombrado de ids (modificadas, solo los ids, sin cambiar el comportamiento): `enemy-spawning`, `enemy-behavior`,
  `simulation-loop`, `xp-gems`, `upgrades`, `run-outcome`, `run-state` (y `auto-weapons`, ya citada).
- Sin cambios: `player-health` (el parpadeo se conserva; como mucho, un escenario que lo aplique al sprite),
  `hud`, `progress-persistence` (el documento de progreso no guarda ids de enemigo, así que guardados y exports
  antiguos siguen siendo válidos).

## Riesgos y dudas
- **Procedencia y licencia**: la CC0 se apoya en una confirmación del autor posterior a la página de itch. Si la
  nota no deja constancia verificable (fecha, medio, enlace o captura), la historia 1 queda débil. Un `.DS_Store`,
  un `.aseprite` o un PNG del Free Pack que se cuele rompe la historia, y por eso hay guardarraíl. Duda para la fase
  spec: si la prueba (captura o enlace) se versiona junto a la nota.
- **Peso del repo y de `dist/`**: estimado en 0,3-0,6 MB para unas 8-10 hojas, **sin medir**. Si se usa `public/`,
  se copia entero a `dist/`, así que todo lo que haya ahí se publica. La estrategia (`public/` frente a importados
  con Vite) la decide el design.
- **CSP y Loader**: el Loader de Phaser crea URLs `blob:`, que `img-src 'self' data:` bloquea. La planificación
  aparcada lo resolvía con `imageLoadType: 'HTMLImageElement'`. Hay que documentarlo en el ADR nuevo y comprobar con
  E2E que no hay violaciones, también en Pages (`smoke:public` a demanda).
- **Preload común**: hoy no hay `preload`. La carga tiene que pasar por las dos rutas (menú → Jugar y `?e2e`) sin
  pintar texturas ausentes y sin alargar el arranque de los E2E hasta provocar timeouts.
- **Escala y origen**: los frames son de 192 px y el personaje visible ocupa unos 50-60 px, con la sombra dentro de
  la hoja. Los radios de hitbox son 10, 22 y 16. La escala visual y el anclaje a los pies van en datos, no en
  constantes mágicas. La hitbox no cambia.
- **Muerte frente a desaparición** y **cadáveres**: hace falta un pool aparte. Riesgos: cadáveres que sobreviven a R
  o a Volver al menú, pool agotado cuando el pulso mata varios enemigos en el mismo tick y animaciones colgadas si la
  escena se apaga a mitad. La spec debe fijar con números qué pasa al llegar al tope.
- **Pausa**: con el mundo detenido (Esc o resultados), las animaciones quedan congeladas.
- **Volteo y estado por hueco**: un hueco reutilizado o un reinicio no deben heredar la posición previa (volteo o
  animación incorrectos en el primer frame).
- **Renombrado de ids**: el diff es grande pero mecánico (unas 300 apariciones en código y tests y unas 110 en specs).
  Riesgo de falsos positivos con la palabra "bug" en prosa, y de que un test de la banda 25-35 dependa del orden de
  los ids (la exploración indica que no: `EnemyCatalog` usa `Map`).
- **Núcleo intacto**: la planificación aparcada añadía `weapon` a `ProjectileSnapshot`. Con una sola arma de
  proyectil y una sola flecha no hace falta, y el criterio de este change es que domain y application no cambian
  salvo los ids de contenido. Si el design encuentra una razón para tocar el núcleo, debe justificarla y volver al
  gate.
- **`pixelArt: true`**: el filtrado *nearest* global puede degradar el texto del HUD pintado en canvas. Hay que
  comprobar que sigue legible o limitar el filtrado a las texturas del pack.
- **GDD desalineado**: el GDD aún tiene el título y los ids como pregunta abierta. El `game-designer` debe recoger
  las decisiones del 2026-11-22 (título, Arquero, ids) antes de archivar.

## Criterio de éxito
- Los escenarios de `sprite-rendering` (y de procedencia, si va aparte) y los deltas de `auto-weapons`, `main-menu`,
  `run-results` y de las specs con ids renombrados están en verde en unitarios y en E2E.
- **Núcleo**: el diff de `src/domain` y `src/application` es 0 líneas, salvo los ids de contenido si aparecieran
  (no se espera ninguno: los ids viven en `content/`). `content/run.json` no cambia, y en `content/enemies.json`
  solo cambian los ids.
- **Balance**: el test de la banda de 0010 sigue verde sin recalibrar (entre 25 y 35 victorias del bot de
  referencia sobre las semillas 1..50) y el invariante "quieto pierde antes de 180 s" se cumple con todas ellas.
- **Ids**: tras el change, `content/`, `src/`, `tests/` y las specs vivas (tras archivar) tienen 0 apariciones de
  los ids `bug`, `memory-leak` y `merge-conflict` como id de enemigo.
- **Título**: el menú, el `<title>` de `index.html`, los textos de resultados, `README.md` y `AGENTS.md` dicen
  "Greentide Vanguard". La clave `sprint-survivors/progress`, el fichero `sprint-survivors-progress.json` y
  `window.__sprint` no cambian. Un export generado antes del change se importa sin errores y se mantienen los
  récords.
- **Arte en todos los entornos**: con `npm run build` + `vite preview` y en Pages, el jugador Arquero, los 3 goblins
  animados, las flechas, las gemas y el fondo de hierba se ven, con 0 violaciones de la CSP, 0 errores no capturados
  en consola y sin cambiar las directivas de la CSP. La suite E2E completa pasa sin tocar ningún `goto` existente.
- **Procedencia**: el guardarraíl falla, en un test con una lista de ficheros simulada, (a) con un PNG que no
  figura en la nota de procedencia y (b) con un fichero cuya ruta u origen corresponde al Free Pack. Pasa con el
  estado real del repo. La nota incluye la fecha 2026-11-22 de la confirmación del autor.
- **Muerte**: un enemigo que muere en el tick T muestra la animación de `Dead.png` en su última posición y deja de
  verse al terminar (duración fijada en datos). No queda ningún sprite suyo después. Las salidas por R o por Volver
  al menú no disparan la animación.
- **0009 · W2**: cinco ciclos `Jugar` → 600 frames → Esc → `Volver al menú`, seguidos de un sexto `Jugar` y 600
  frames. En cada frame, los sprites visibles de enemigo vivo, proyectil, pulso y gema coinciden con el snapshot,
  y tras cada Volver al menú y cada R hay 0 cadáveres visibles.
- **Fallback**: si se fuerza el fallo de carga de una textura en un test, ese elemento se pinta con el aspecto de
  reserva, sin excepción no capturada.
- El ADR que sustituye al ADR-0012 aparcado existe y está enlazado desde el design. El ADR-0012 aparcado queda
  marcado como sustituido o se retira.
- Benchmark opcional (no bloqueante): 200 enemigos animados a ≥ 60 fps en la máquina de desarrollo. Se mide el peso
  de `dist/` y se anota en el verify-report.
- `npm run verify` en verde.
