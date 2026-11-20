# Proposal · 0012-sprite-rendering

- **Estado**: aprobada (2026-11-20)
- **Issue**: (opcional)
- **Rama / worktree**: `change/0012-sprite-rendering`

## Problema
El jugador, los enemigos, los proyectiles y las gemas son círculos de color. No se distingue a simple vista qué
enemigo es cada uno, el jugador no se ve andar ni hacia dónde mira, y los enemigos desaparecen de golpe al morir.
El spike `spike/sprites` (`f88216c`, diario `docs/ai-log/2026-11-20-spike-sprites.md`) confirmó que pasar a
sprites animados es un cambio del adaptador de tamaño medio-bajo. También dejó tres problemas para el change real:
constantes mágicas de escala, falta de tests y una CSP que bloquea el Loader de Phaser.

Además está abierta la deuda **0009 · W2** del GDD: no hay E2E que compruebe los sprites tras **Volver al menú**
ni el escenario "Cinco ciclos menú-partida", porque la sonda no cuenta sprites. Su cierre se aplazó "con el change
de arte".

## Objetivo
En la partida, el jugador y cada tipo de enemigo se ven como sprites animados (quieto, andar, muerte; volteo
según la dirección), los proyectiles tienen un aspecto propio por arma y las gemas tienen sprite. Todo el aspecto
se define en un manifiesto de datos, `content/appearance.json`, validado con zod en el arranque. **Para cambiar de
pack basta con editar ese JSON y colocar los PNG**, sin tocar código.

El repositorio **no incluye ningún pack de arte**. Sin el pack, el juego usa texturas de reserva generadas por
código (placeholders), y así funcionan CI, los E2E y el despliegue público. Con el pack en local, el mismo build
muestra el arte. La jugabilidad, el snapshot observable por la sonda (salvo el campo nuevo `weapon`) y los E2E
existentes no cambian.

## Alcance
- **Dentro**:
  - **Jugador**: animaciones quieto / andar / muerte y volteo horizontal según la dirección del movimiento. Se
    conserva el parpadeo de invulnerabilidad (`playerVisible`, spec `player-health`).
  - **Enemigos** (`bug`, `memory-leak`, `merge-conflict`): animación de andar, volteo según la dirección y destello
    de daño (sustituye al cambio de color de relleno y sigue fiel a `damaged` del snapshot).
  - **Animación de muerte de enemigos** (decisión 4): cuando un enemigo desaparece del snapshot porque ha muerto,
    se reproduce una vez su animación de muerte en la última posición conocida y después deja de verse. Los
    cadáveres en curso se limpian al reiniciar (R) y al **Volver al menú**: no queda ninguno visible en la partida
    siguiente.
  - **Proyectil con aspecto por arma** (decisión 5): `ProjectileSnapshot` expone el arma que lo disparó (`weapon`).
    Es el único cambio en `src/domain` / `src/application`: un campo de solo lectura, sin efecto en la simulación ni
    en el determinismo. El sprite se orienta según la dirección de avance.
  - **Gemas** con sprite propio.
  - **Pulso de Tests**: conserva el anillo actual (sin sprite).
  - **Manifiesto `content/appearance.json`** (decisión 3): por cada id lógico (jugador, cada tipo de enemigo, cada
    arma de proyectil, gema) define la hoja, el tamaño de frame, las animaciones por estado (frames, fps, bucle),
    la escala visual separada de la hitbox, el origen y, si hace falta, el tinte. Incluye un aspecto **por
    defecto** obligatorio. Se valida con zod en el arranque (regla 5). Se cruza con los ids de
    `content/enemies.json` y de las armas de proyectil: un id sin entrada usa el aspecto por defecto, y una entrada
    cuyo id no existe en el contenido es un error. Si el manifiesto es inválido, el juego falla en el arranque de
    forma ruidosa, igual que con el resto del contenido.
  - **Estrategia de assets** (decisión 2): los PNG del pack viven en local, fuera de git, en una ruta que ignora
    `.gitignore`. Hay placeholders procedurales siempre disponibles. Si una textura no está o falla al cargar, ese
    elemento se pinta con el placeholder sin romper la partida ni la consola con errores no capturados.
  - **Carga compatible con la CSP de 0007**, sin relajar `img-src 'self' data:`. Funciona igual arrancando desde el
    menú y con `?e2e` (que salta el menú).
  - **Sonda de render para E2E** (cierra **0009 · W2**): los E2E pueden contar los sprites visibles por tipo
    (jugador, enemigo vivo, cadáver, proyectil, pulso, gema). Con eso se automatizan "Cinco ciclos menú-partida" y
    la limpieza tras **Volver al menú** y tras R.
  - **Tests unitarios de las capas** con dobles, que sustituyen a la costura `CircleSprite`, y tests del esquema y
    del cruce del manifiesto.
- **Fuera**:
  - **Elegir el pack final y su licencia** (decisión 1). El pack del spike ("Tiny RPG Character Asset Pack v2.0 ·
    Soldier & Orc") es **solo provisional**: sirvió para validar el enfoque, no se versiona y no es el arte del
    juego. Pages muestra placeholders hasta que se elija un arte con licencia que permita publicarlo.
  - Inyectar el pack en el despliegue (artefactos privados, secretos, descargas en CI).
  - Mapa / tiles / fondo con arte, UI y HUD con arte, menú con arte, audio.
  - Separación entre enemigos o cualquier cambio de jugabilidad o de balance (la horda amontonada es un change
    propio).
  - Sprite para el pulso, animaciones de ataque o de golpe del jugador, partículas.
  - Cargar el manifiesto en runtime junto a los PNG (opción C de la exploración).

## Capacidades afectadas
- `openspec/specs/sprite-rendering` (nueva): manifiesto de aspecto (esquema, aspecto por defecto, cruce con el
  contenido, error de arranque), placeholders y degradación ante una textura ausente, animación por estado del
  jugador y de los enemigos, volteo, muerte de enemigos y su limpieza en R y en **Volver al menú**, aspecto de
  proyectil por arma y de gema, carga sin violar la CSP con y sin `?e2e`, y sonda de recuento de sprites.
- `openspec/specs/auto-weapons` (modificada): *Indicación visual de daño, proyectiles y pulsos* (el destello deja
  de ser un cambio de color y pasa a ser cualquier indicación visual fiel a `damaged`). El snapshot de proyectil
  añade `weapon` y hay un escenario nuevo que lo cubre.
- `openspec/specs/main-menu` (modificada): *Cinco ciclos menú-partida* y la limpieza tras **Volver al menú** pasan
  a ser verificables con la sonda de sprites. Hay que precisar que "sprites visibles de enemigo" cuenta los
  enemigos **vivos** y que los cadáveres se cuentan aparte.
- `openspec/specs/player-health` (sin cambios previstos): el parpadeo se conserva tal cual. Si en la fase spec hace
  falta decir que el parpadeo afecta al sprite animado, será un escenario y no un requisito nuevo.
- `openspec/specs/run-results` (posiblemente modificada): no queda ningún cadáver visible tras reiniciar con R.
- `openspec/specs/simulation-loop`, `xp-gems`, `hud` (sin cambios previstos). La sonda de estado existente y su
  formato no cambian, salvo el campo `weapon` de los proyectiles.

## Riesgos y dudas
- **CSP y Loader**: el Loader de Phaser descarga por XHR y crea URLs `blob:`, y `img-src 'self' data:` las bloquea.
  El spike lo resolvió con `loader.imageLoadType: 'HTMLImageElement'`. Hay que documentarlo (design o ADR) y tener
  un E2E que compruebe que no hay violaciones de la CSP. Los placeholders no deben depender de URLs `blob:` (si se
  generan como `data:` o como textura de canvas lo decide el `design`).
- **Preload y arranque con `?e2e`**: hoy no hay `preload`. La carga tiene que ocurrir en un sitio por el que pasen
  las dos rutas (menú → Jugar y arranque directo con `?e2e`), y la partida no puede empezar a pintar texturas
  ausentes. En CI no hay pack: hay que asegurar que la ausencia de PNG no deja errores no capturados ni ralentiza
  el arranque de los E2E (timeouts).
- **Limpieza de cadáveres**: ADR-0006 libera el hueco cuando el enemigo sale del snapshot, y la animación de muerte
  necesita un pool aparte (el spike usó 64). Riesgos: cadáveres que sobreviven a R o a **Volver al menú**, pool
  agotado en una muerte masiva (el pulso de Tests puede matar varios enemigos en el mismo tick) y animaciones que
  quedan colgadas si la escena se apaga a mitad. La spec tiene que fijar qué pasa al llegar al tope (por ejemplo,
  no mostrar la muerte sobrante) con números concretos.
- **Muerte frente a desaparición**: el adaptador ve que un id sale del snapshot, pero no siempre sabe por qué. Si
  hay salidas que no son muertes (reinicio, fin de partida), la animación no debe dispararse en esos casos. Hay que
  decidir si basta con el delta del snapshot o si hace falta un indicador explícito (lo decide el `design`; la
  spec fija el comportamiento observable).
- **`pixelArt: true` y texto**: activar el filtrado *nearest* para todo el juego puede degradar el texto del HUD
  pintado en canvas. Hay que comprobar que el HUD sigue siendo legible o limitar el filtrado a las texturas del
  pack.
- **Escala y hitbox**: en el pack provisional, el personaje ocupa ~18 px de un frame de 100 px. La escala visual
  va en el manifiesto y no se deriva con constantes en código. Como el pack final no está elegido, el esquema del
  manifiesto corre el riesgo de quedarse corto o de ser excesivo: conviene limitarlo a lo que exige este alcance.
- **Volteo y estado por hueco**: la dirección y el paso de quieto a andar salen del delta de posición entre frames.
  Un hueco reutilizado o un reinicio no deben heredar la posición previa (volteo o animación incorrectos en el
  primer frame).
- **Contenido de presentación junto al de balance**: `appearance.json` convive con los `content/*.json` de
  dominio. El cruce con los ids de enemigos y armas no puede vivir en `buildRunRules` (dominio): va en
  infraestructura o en composition, sin romper las reglas 1-4.
- **Cambio en el snapshot**: añadir `weapon` a `ProjectileSnapshot` toca la sonda E2E y los tests de dominio. No
  debe alterar el determinismo ni los escenarios existentes.
- **Rendimiento**: el riesgo es bajo (el spike midió 200 enemigos animados a ~165 fps, y con el balance real hay
  ≤ 17 vivos), pero hay que comprobarlo con las capas definitivas.

## Criterio de éxito
- Los escenarios de `sprite-rendering` y los deltas de `auto-weapons` y `main-menu` (y `run-results`, si se
  modifica) están en verde en unitarios y en E2E.
- **Sin pack** (estado del repo y de CI), la suite E2E completa pasa sin tocar ningún `goto` existente, con 0
  errores no capturados en consola y 0 violaciones de la CSP. Todos los elementos se pintan con placeholders.
- **Con el pack provisional en local**, `npm run build` + `vite preview` muestra el jugador y los 3 enemigos
  animados, con 0 violaciones de la CSP y sin cambiar `index.html`.
- Un manifiesto con una entrada para un id de enemigo inexistente, o sin aspecto por defecto, hace fallar la
  validación en el arranque con un error que nombra el campo. Un tipo de enemigo sin entrada se pinta con el
  aspecto por defecto.
- Cinco ciclos `Jugar` → 600 frames → Esc → `Volver al menú`, seguidos de un sexto `Jugar` y 600 frames: en cada
  frame, los sprites visibles de enemigo vivo, proyectil, pulso y gema coinciden con el snapshot, y tras cada
  **Volver al menú** y cada R hay 0 cadáveres visibles. Esto cierra **0009 · W2**.
- Un enemigo que muere en el tick T muestra su animación de muerte en su última posición y deja de verse cuando
  termina la animación (duración fijada en el manifiesto); no queda ningún sprite de ese enemigo después.
- `git ls-files` no lista ningún PNG del pack. El cambio de pack queda demostrado editando solo
  `content/appearance.json` y la carpeta local de PNG, con 0 ficheros de `src/` modificados.
- Benchmark opcional (no bloqueante): 200 enemigos animados con las capas del change a ≥ 60 fps en la máquina de
  desarrollo.
- `npm run verify` en verde.
