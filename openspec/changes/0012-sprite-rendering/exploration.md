# Exploración 0012-sprite-rendering (retomada para la v2.0 medieval)

Intención: sustituir los círculos por sprites animados de caballeros y goblins (Tiny Swords "Update 010", CC0) en el
adaptador Phaser, versionando el arte con su licencia, y renombrar título visible e ids de enemigos al tema.
Esta exploración sustituye a la del 2026-11-20 (premisa "arte solo local"), que ya no aplica.

## Contexto actual
- Código sin cambios respecto a la exploración previa: capas sobre `SlotPool` en `src/infrastructure/phaser/`
  (`EnemyLayer`, `ProjectileLayer`, `GemLayer`, `PulseLayer`), jugador = `Arc` en `GameScene.create`, color por tipo en
  `enemyPalette.ts`, sin `preload`, CSP `img-src 'self' data:`, base de Vite `/tfm-survivors/`, sin `public/` ni PNG.
- Rama aparcada (rebasada): `exploration/proposal/design/tasks` + `specs/{sprite-rendering,auto-weapons}` en
  `openspec/changes/0012-sprite-rendering/`, `docs/adr/0012-arte-local-descubierto-en-build.md` y el diario del spike.
- Assets (fuera del repo): `C:\Users\Adri\TFM\Tiny Swords (Update 010)\` con `Factions/{Knights,Goblins}/{Troops,Buildings}`,
  `Resources`, `Terrain`, `UI`. Hojas de 192 px por frame, una fila por animación (p. ej. Torch: idle 7, run 6, ataques;
  Archer: idle 6, run 6, disparo en 8 direcciones), 4 colores por unidad, con sombra incluida. Existe `Dead.png`
  común, `Arrow.png`, `Dynamite.png`, `Barrel_*`, `TNT_*`, `Torch_*`, `Archer_*`, `Warrior_*`, `Pawn_*`,
  `HappySheep_*`, `Resources/*` (W/G/M) para gemas o recogibles. El `Free Pack` está en carpeta hermana: no tocar.
- Ids de enemigo `bug`, `memory-leak`, `merge-conflict` aparecen en: `content/enemies.json`, `content/waves.json`,
  `enemyPalette.ts`, `tests/support/{builders,finishedRuns}.ts`, `tests/bench/run.bench.ts`, tests de dominio y de
  capas (~300 apariciones, muchas en prosa) y 8 specs vivas (~110: `auto-weapons`, `enemy-spawning`, `enemy-behavior`,
  `simulation-loop`, `xp-gems`, `upgrades`, `run-outcome`, `run-state`).
- El documento de progreso (`progressSchema.ts`) **no guarda ids de enemigo** (solo `kills` numérico, semilla, nivel,
  tiempo): renombrar ids no afecta a `localStorage` ni a exports antiguos. El dominio no ordena por id (`EnemyCatalog`
  usa `Map`; `sort` solo en historial): el renombrado no altera determinismo ni balance de 0010.
- "Sprint Survivors" visible en: `index.html` (`<title>`), `main.ts` (`TITLE`), `menuText.ts`, `resultsPanelText.ts` (2
  mensajes), `README.md`, `package.json` (description), `AGENTS.md`. Ninguna spec fija el texto del título.
  Claves técnicas con "sprint": `sprint-survivors/progress` (localStorage), `sprint-survivors-progress.json`
  (export, fijado por 4 specs y ~8 tests E2E/unitarios), sonda `window.__sprint`.

## Qué se reutiliza de la planificación aparcada y qué queda obsoleto
- **Reutilizable**: la lógica de render pura sin Phaser (`frameAt`, estado andar/quieto por delta, volteo), costura
  `SpriteLike` para tests con dobles, muerte frente a desaparición, sonda de recuento de sprites (cierra 0009·W2),
  `imageLoadType: 'HTMLImageElement'` por la CSP, BootScene/preload común a menú y `?e2e`, `AnimClock` que se congela
  con el mundo detenido, tamaños escala/hitbox en datos, `weapon` en `ProjectileSnapshot` (único toque al núcleo).
- **Obsoleto**: ADR-0012 (arte local con `import.meta.glob`, `@art`, `SPRINT_ART_DIR`, build E2E con fixtures sintéticas);
  placeholders procedurales como camino por defecto de CI/Pages; tasks de "E2E con arte sintético"; el texto de
  proposal/design sobre "Pages muestra placeholders" y "git ls-files no lista ningún PNG"; la lista de ids de enemigos;
  `enemyPalette.ts`. Probablemente ADR nuevo (p. ej. "arte CC0 versionado en `public/`") que sustituya al 0012.
- **A revisar**: manifiesto `appearance.json` (el esquema se simplifica: hojas de rejilla regular de 192 px, filas
  estándar); el placeholder pasa de camino principal a fallback de seguridad (tests y fallo de carga).

## Capacidades/specs afectadas
- Nueva `sprite-rendering`; delta en `auto-weapons` (destello como tinte, `weapon` en proyectil) y `main-menu`
  (0009·W2 verificable). Nueva capacidad o requisito para la procedencia: "solo assets CC0 registrados" (historia 1).
- Renombrado de ids: deltas (o edición en archive) sobre las 8 specs listadas. `player-health`, `hud`, `progress-persistence`
  sin cambio de comportamiento. ADR-0004/0007 (CSP) y ADR-0006 (sprite ligado al id) aplican.

## Opciones
### Estrategia de assets
1. **Subconjunto en `public/assets/tinyswords/` + `LICENSE/PROVENANCE.md`** (copiado, sin `.DS_Store`, `.aseprite` ni
   zips). Pros: simple, CI/E2E/Pages ven el arte real, sin glob ni build especial. Contras: hay que verificar la licencia
   por escrito (captura/URL de la confirmación del autor, fecha 2026-11-22) y un guardarraíl de `git ls-files` que la
   compruebe; `public/` se copia entero a `dist/`.
2. **Importar desde `src/assets/` con Vite** (hash en nombre, tree-shaking de lo no usado). Pros: solo se publica lo
   referenciado; Contras: `assetsInlineLimit` por debajo del tamaño real para no crear `data:`/`blob:`; menos legible para manifiesto por datos.
3. **Spritesheets recortados/empaquetados por script** (atlas único). Pros: menos peticiones y peso; Contras: se
   modifica el arte (derivado CC0, anotarlo), añade tooling y una dependencia posible.
### Manifiesto de aspecto
A. `content/appearance.json` + zod (como antes, esquema reducido). B. Tabla TS tipada (más simple, pero cambiar de arte
exige tocar código). C. Manifiesto junto a los PNG cargado en runtime (ya no tiene sentido sin licencia restrictiva).
### Renombrado de ids
R1. En 0012: `content/`, tests y specs a la vez (un solo PR, diff grande pero mecánico). R2. Solo título visible en 0012 y
ids en un change pequeño propio (0012 queda con `bug`… mapeados a sprites de goblin por manifiesto). R3. Ids por rol
(`goblin-scout`) frente a ids por unidad del pack (`goblin-torch`, `goblin-tnt`, `goblin-barrel`): los últimos
adelantan comportamientos de 0016 (barril = kamikaze, TNT = guardia) que 0012 no implementa.

## Subconjunto de arte y tamaño (a medir en apply)
Mínimo: Knights `Archer_Blue`+`Arrow` (o `Warrior_Blue`), `Dead.png`, Goblins `Torch/TNT/Barrel` en un color (3 hojas),
`Resources` para gemas (G/M/W_Idle). Unas 8-10 PNG, estimadas en pocas decenas de KB cada una (hojas de ~1344×960 con
mucho espacio vacío): del orden de 0,3-0,6 MB en repo y bundle; **sin medir** (no he podido leer tamaños en bytes).
Más variantes de color (4) o `Buildings`/`Terrain`/`UI` quedan para 0013-0020. Pawn y Sheep no se usan aún.

## Riesgos e incógnitas
- Procedencia: la nota CC0 se apoya en la confirmación del autor; conviene guardar enlace/captura y avisar de que la
  confirmación es posterior a la página de itch; un `.DS_Store` o PNG del Free Pack colado rompe la historia 1 (guardarraíl).
- Hojas de 192 px con personaje de ~50-60 px visibles: escala y origen (anclar a los pies: la sombra viene en el sprite).
- Mapeo de 3 enemigos a 3 goblins con radios 10/22/16 y velocidades 90/45/70; Arrow con `rotation` según dirección.
- Pausa/animación congelada, cadáveres en reinicio y Volver al menú (0009·W2): mismo riesgo que antes.
- Fallo de carga de una textura (404) ensucia la consola: con arte versionado deja de ser caso normal, pero el fallback
  sigue siendo necesario para tests de capas.
- Renombrado: volumen de diff en tests/specs; el guardarraíl o grep de `bug` en prosa (la palabra aparece también como
  "bug" de errores). `smoke:public` y E2E no dependen de ids.
- Archer vs Warrior: GDD dice "caballero" (concepto) y "jugador arquero" (fila 0012); con arco ya reconvertido (0004
  `linter` proyectil) el Arquero encaja, pero decide el sprite del jugador.
- `pixelArt: true` y texto del HUD (heredado).

## Mediciones previas
No se fija objetivo de balance/ritmo/duración: no procede. Cambiar ids no toca balance; `run.json` queda intacto, y
el test de banda 25-35 (0010) debe seguir verde sin recalibrar. Sugerencia no bloqueante: medir en `verify` el peso de
`dist/` y repetir el micro-bench de 200 enemigos animados (>= 60 fps).

## Preguntas para el usuario
1. Jugador: ¿Arquero (fila del GDD y arma de arco) o Guerrero/caballero genérico? Fijar un único texto en el GDD.
2. Título definitivo "Greentide Vanguard" (¿también `README`, `package.json`, `AGENTS.md`?) y qué hacer con las claves
   técnicas `sprint-survivors/progress` y `sprint-survivors-progress.json` (propuesta: no tocar; cambiarlas perdería
   guardados e invalidaría specs/tests).
3. Ids de goblins: por rol (`goblin-scout`…) o por unidad (`goblin-torch`, `goblin-tnt`, `goblin-barrel`) y
   qué unidad cubre cada enemigo actual. ¿Renombrado dentro de 0012 (R1) o aparte (R2)?
4. Estrategia de assets: ¿opción 1 (`public/`) o 2 (importados)? ¿Atlas empaquetado (3) fuera de alcance?
5. ¿Animación de muerte (`Dead.png`) y sprite de proyectil/gemas entran en 0012, o solo jugador y enemigos
   (historia 2)? Pulso conserva el anillo.
6. ¿Se guarda la prueba de licencia (URL/captura) en el repo junto a `PROVENANCE.md`?
