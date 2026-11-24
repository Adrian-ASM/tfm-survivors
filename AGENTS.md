# AGENTS.md

> Contexto maestro para cualquier agente de IA (Claude Code, Copilot, Codex…).
> Es un **índice**: corto, con reglas no negociables y punteros. El detalle vive en skills, specs y ADRs
> y se carga solo cuando hace falta (*lazy loading*).

## 1. Visión general

**Greentide Vanguard** (antes *Sprint Survivors*): juego 2D *survivors-like* para navegador (TFM del Máster de Desarrollo con IA).
El jugador solo se mueve; las armas disparan solas; las oleadas crecen; al subir de nivel se elige 1 de 3 mejoras.

- **Stack**: TypeScript estricto · Vite · **Phaser 4.2.1** (ADR-0001) · Vitest · Playwright · zod.
- **Arquitectura**: Clean Architecture. El **núcleo de simulación es puro y determinista** (`src/domain`, `src/application`);
  el motor de juego es un **adaptador** (`src/infrastructure`). Ver `docs/adr/0002-nucleo-de-simulacion-puro.md`.
- **Estado del proyecto**: bucle de partida completo (changes 0001–0007: movimiento, oleadas, daño, armas,
  XP y mejoras, victoria/derrota, HUD y reinicio, guardado local de récords e historial con export/import JSON y
  CSP estricta). Los E2E aceleran la simulación con `?e2e&speed=N` (1..15, solo en el adaptador; change 0008).
  Menú de inicio (Jugar, Exportar, Importar, Borrar datos con confirmación propia), pausa con Esc y Volver al menú
  (change 0009, ADR-0011). `?e2e` salta el menú **solo al cargar**; Volver al menú sí lo muestra.
  Balance calibrado con el bot de referencia de `tests/support/` sobre las semillas 1..50 (entre 25 y 35
  victorias) e invariante "quieto pierde antes de 180 s" con todas ellas (change 0010).
  Publicado en `https://adrian-asm.github.io/tfm-survivors/` (job `deploy` de `ci.yml` tras `quality` y `e2e` en
  push a `main`); smoke remoto **a demanda**, nunca en push ni PR (change 0011). Backlog Must completo.
  Arte CC0 de Tiny Swords Update 010 (change 0012, ADR-0012): sprites animados del arquero y tres goblins
  (`goblin-torch`, `goblin-tnt`, `goblin-barrel`), cadáveres, flechas, gemas y suelo, con datos en
  `content/appearance.json` y aspecto de reserva si una hoja no carga. Guardarraíl de procedencia
  (`.claude/hooks/guard-assets.mjs` sobre `git ls-files`, nota en `content/asset-provenance.json`): ningún asset
  gráfico sin entrada ni nada del Free Pack. Sonda E2E `window.__sprint.sprites` con recuentos por tipo.
  Mundo de 1.920 × 1.080 con vista de 960 × 540 (change 0013, `content/arena.json`; zod exige mundo ≥ vista):
  cámara que sigue al jugador sin suavizado y recortada al mundo (`CameraRig`), suelo del tamaño del mundo, HUD y
  overlays fijos (`scrollFactor` 0). Sonda E2E con `camera` (rectángulo visible en mundo, null en el menú) y `world`.
  Textos medievales de las mejoras (solo `name`/`description`; ids sin cambios). Balance con el mundo 2x: **25/50**
  victorias, en el límite inferior de la banda, y 0 quietos; plazos de primera subida y pulso quieto a 4.800 ticks.
  Los tests leen el mundo de `content/` (`aDefaultConfig`, bot `referenceBot(config)`); `SCENARIO_ARENA` es solo
  geometría de escenario.
  Avance manual en E2E (change 0014): con `?e2e&manual` la simulación no avanza por reloj y los tests mandan ticks
  exactos con `window.__sprint.step(n)` (gana a `speed`). Playwright tiene dos proyectos: `logic` (suite de
  humo, ~12 tests, uno por flujo, en manual y sin esperas de reloj; lo vigila `tests/support/logicGuard.ts`; es
  lo único que corre `test:e2e` y el CI) y `realtime` (etiqueta `@realtime`: calibración de fps y `speed`; solo a
  demanda, fuera del CI; chore `e2e-lite`).
  Mapa procedural (change 0015, ADR-0013): rejilla de 32 × 18 celdas de 60 px (`content/map.json`) con troncos,
  un río con puentes y zona de inicio libre, generada por semilla con un flujo de azar propio
  (`seededRun`: oleadas con `Mulberry32(seed)`, mapa con `deriveSeed(seed, MAP_STREAM)`). Solo el jugador
  colisiona (barrido por ejes); las gemas que caen en celdas bloqueadas se recolocan; los enemigos lo ignoran.
  Se pinta con un rectángulo por tramo de celdas no-hierba, con colores de `appearance.json` (`terrain`); nunca
  una capa a pantalla completa (partía los fps en CI sin GPU). `player.speed` 210 (gate de balance: 29/50 con el
  bot v2, que esquiva troncos y agua). E2E: `gameUrl` añade `map=empty` por defecto
  (`map: 'real'` para los del mapa); sonda `window.__sprint.map` y `sprites.cells`; firma dorada en
  `tests/support/mapGolden.ts`.
  Arte del mapa y castillo (change 0016): celda `castle` (código 4, no caminable) con huella fija por contenido
  (`map.json` `castle` 5 × 4, columnas 14–18 × filas 6–9) solo en el mapa generado; la **salida es de cada mapa**
  (puerta del castillo, (990, 630); centro del mundo en `open`/`cells` salvo salida declarada) y la zona de inicio
  se centra en ella. Arte de Update 010 (agua, espuma animada, orillas por autotile de 4 vecinos sobre
  `Tilemap_Flat`, árboles con variedad por `DECOR_STREAM`, puentes orientados, `Castle_Blue`) planificado sin
  motor (`src/infrastructure/phaser/map/planMapArt.ts`) y pintado en dos `Layer`: la baja bajo las entidades y la
  alta (copas y tejado) sobre ellas y bajo el HUD; reserva de colores por elemento. Sonda `sprites.mapArt`
  (`painted`/`fallback` por elemento y `objects`), `sprites.cells.castle` y `map.castle`. `player.speed` 215:
  **27/50** victorias y 0 quietos; ≤ 300 objetos del mapa en 42 y 123 (test sin navegador en `verify`).
  Vista a ventana completa (change 0017, ADR-0014/0015/0016): lienzo `Scale.RESIZE` en `#game` con tope
  `arena.maxView` 2.560 × 1.440 (`scaleConfig`, `min`/`snap` 1 × 1, centrado por CSS) y zoom 1; el tope no llega
  al núcleo (`parseContent` → `{ config, maxView }`, `View` borrada). Mundo **3.840 × 2.160** (rejilla 64 × 36,
  castillo 30–34 × 15–18, salida (1.950, 1.170)). Anillo de aparición de contenido `waves.spawn.ringRadius` 1.500
  (zod exige > media diagonal del tope). Tabla de oleadas 1,2/2,4/2,4/3,0/4,2: **25/50** victorias, 0 quietos,
  primera oferta (s7) en el tick 1.527; ≤ 1.000 objetos del mapa. HUD y cartas con layout puro
  (`ScreenFrame`, escala de UI ×1/×2, `hudLayout`/`cardLayout`) recolocados por `watchScreen` en cada RESIZE;
  menú (título en `h1`), pausa, diálogo y resultados (5 líneas DOM) centrados y escalados con `--ui-scale`.
  Sonda E2E `window.__sprint.viewport` (ventana y `uiScale`, también en el menú); Playwright a 1.280 × 720.
  Recorte del arte del mapa por cámara (change 0018): en cada frame, cada caja del plan (`bounds`) se compara con
  la vista del frame que se va a pintar (`rig.nextView()`, sin el desfase de `worldView`) más 1 celda
  (`CULL_MARGIN_CELLS`); `MapCuller` solo llama a `setVisible` donde cambia el estado. Solo infraestructura.
  Sonda `sprites.mapArt.drawn` (0 en el menú; totales sin cambios): 106/667 y 67/750 en 42 y 123. Los tres E2E del
  mapa real conservan `test.slow()` (38,5 / 27,8 / 42,1 s en CI).
  Navegación por campo de flujo (change 0019, ADR-0017): `FlowField` (dominio, propiedad de `Run`) con BFS de
  4 vecinos desde la celda del jugador, perezosa y recalculada solo al cambiar de celda; orden de vecinos y
  empates fijos (parte del determinismo). Línea libre: persecución recta si el segmento entre centros solo cruza
  celdas caminables (en esquinas exactas, ambas laterales); si no, al centro del vecino con distancia − 1. Con
  mapa sin bloqueos la persecución es la de siempre. Las apariciones en celda bloqueada se recolocan en la
  caminable más cercana (1 valor de azar por intento). `waves.maxAlive` 300. Sin separación ni colisión de
  enemigos con el mapa (aplazadas). Balance recalibrado **solo con la curva de XP** (`baseXp` 9, `xpGrowth` 3;
  oleadas y `player.speed` intactos): **26/50** victorias y 0 quietos. Los tests con cifras de XP usan la curva
  de escenario 5/5 (`SCENARIO_PROGRESSION`, `withScenarioCurve`). GDD renumerado: Should 0020–0024.
  Comportamientos de enemigos, parte A (change 0020, ADR-0019): cada tipo declara en `enemies.json` un
  `behavior` con estados de clase cerrada (`chase` con salida por distancia, `fuse`, `charge`, `wait`) y los
  globales `hazards` (`maxDynamites` 24, `dynamiteRadius`, `blastTicks`); `damage` de contacto opcional (el barril
  no tiene). Barril kamikaze (mecha de 40 con aviso, explosión 64/25) y TNT artillero (carga a 100 px, dinamita con
  aviso en el objetivo, espera). `HazardField` en el núcleo: tick con armas → explosiones → segundo `removeDead` →
  lanzamientos → golpe único `max(contacto, explosión)`; fuego amigo, sin cadenas ni azar. Snapshot con
  `state`/`stateKind`, `dynamites`, `warnings` y `blasts`; capa de peligros sobre la capa alta del mapa (un
  `Graphics` y pools) y sonda `warnings`/`dynamites`/`explosions`/`enemyStates`. Arte `Dynamite.png` y
  `Explosions.png` (Update 010). Bot v3 (esquiva avisos) y balance **27/50**, 0 quietos, con curva **9/4**.
  Campamentos goblin (change 0021, ADR-0020): 4 casas y 3 torres por mapa generado (`content/structures.json`,
  huella 2 × 3, vida 60/90) colocadas con un tercer flujo de azar (`STRUCT_STREAM` 3), sin tocar las celdas
  (`MAP_GOLDEN` intacta; `STRUCTURE_GOLDEN` nueva). No bloquean; las armas las apuntan solo sin enemigos en su
  criterio y quedan en ruina al destruirse. Cada casa genera `goblin-tnt-guard` (tope 2, cada 900 ticks) con
  `patrol`/`alert`/`return` en torno a su puerta (`GuardPost`, campos fijos por punto). Barril A3 (activación 60,
  vida 25, radio 80). Arte `Goblin_House`, `Wood_Tower_Red` y sus ruinas (2 aspectos con máscara en el plan, ≤ 4
  objetos por estructura: 695/778 objetos en 42/123). Sonda `sprites.structures`, `map.structures` y
  `snapshot.structures`. Balance sin recalibrar: **27/50**, 0 quietos, **26,9 mechas** y 14,6 explosiones de barril
  por partida (base 16,3/6,6; test "Mechas por partida"), lote ~30 s local; bot v3.
  Fuente de verdad del comportamiento: `openspec/specs/`.

## 2. Comandos

> En Windows con PowerShell usa `npm.cmd` si la política de ejecución bloquea `npm.ps1`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (`http://localhost:5173/tfm-survivors/`) |
| `npm run verify` | lint + typecheck + guardarraíl sobre todo el repo + tests unitarios. **Ejecútalo al cerrar cada grupo de tareas y antes de cada commit. No cierres un grupo en rojo.** |
| `npm run verify:fast` | Bucle rojo → verde: lint con caché + typecheck + solo los tests afectados por los cambios sin commitear (`vitest --changed`), sin el test de balance. No sustituye a `verify` |
| `npm run test:e2e` | Build + `vite preview` + Playwright (chromium), solo el proyecto `logic`: la suite de humo (`smoke`, `progress` y `gameplay`.spec), la misma que el CI. Para una sola: `npm run test:e2e -- gameplay.spec` (filtro por ruta: con `.spec`, porque el nombre del worktree también casa) o `-- --grep "<título>"` |
| `npm run test:e2e:realtime` | Proyecto `realtime` (calibración de fps y `speed`). A demanda: fuera de `test:e2e` y del CI; en Actions, workflow `e2e-realtime` (`workflow_dispatch`). Diagnóstico opcional, nunca obligatorio antes de push: `CI_LIKE=1` (sin GPU, CPU frenada por CDP con `CPU_THROTTLE`, 25 por defecto, sin reintentos) |
| `npm run smoke:public` | Smoke de Playwright contra la URL pública (o `SMOKE_URL`). A demanda: fuera de `verify` y de CI; en Actions, workflow `smoke-public` (`workflow_dispatch`) |
| `npm run bench` | Benchmark del núcleo (Vitest bench). Depende de la máquina: no bloquea `verify` ni CI |
| `npm run build` | Build de producción (`dist/`) |
| `npm run guard:all` | Reglas de `.claude/hooks/` sobre todos los ficheros versionados (lo que hace el CI) |

**E2E ligeros (regla de proceso, chore `e2e-lite`)**: un escenario de spec se cubre por defecto con un test
unitario o de aplicación. Un E2E solo si el escenario exige navegador (DOM, render, almacenamiento real), en
modo manual (`?e2e&manual` + `step(n)`) y como **máximo 1–2 E2E nuevos por change**, preferiblemente ampliando un
test de la suite de humo. Nada de umbrales de fps ni de tiempo real en el gate. Un escenario vivo que solo cubría
un E2E retirado en `e2e-lite` se acepta sin test automático (no es hallazgo de verify).

## 3. Reglas de arquitectura (no negociables)

1. `src/domain` no importa nada de `application`, `infrastructure`, `composition` ni del motor.
2. `src/application` no importa `infrastructure`, `composition` ni el motor.
3. `domain` y `application` **no** usan `Math.random`, `Date.now`, `performance.now`, `window`, `document` ni `localStorage`.
   Usan los puertos `RandomGenerator` y `Clock`.
4. Solo `src/composition/` conoce las implementaciones concretas (composition root).
5. El contenido del juego (armas, enemigos, mejoras, oleadas) vive en `content/*.json` validado con zod. Sin números mágicos.
6. Toda entrada externa (fichero importado, `localStorage`, red) se valida con zod antes de llegar al dominio.

Estas reglas se aplican en tres capas, con **una sola fuente** (`.claude/hooks/`) para todos los autores:
1. **Agente**: hooks de Claude Code al escribir (solo dentro de Claude Code).
2. **Commit** (cualquier autor: persona, Claude desde la app, otros agentes): `.husky/pre-commit` ejecuta
   lint-staged (ESLint con reglas de capas y pureza) y `scripts/guard-staged.mjs`, que lanza los mismos hooks
   sobre el contenido preparado.
3. **CI**: `npm run verify` incluye `guard:all` y ESLint sobre todo el repo.

Si un guardarraíl te bloquea, **corrige el diseño; no desactives la regla**. Prohibido `git commit --no-verify`
y escribir en `main` sin PR (también con la API de GitHub): los cambios entran por PR con el check `quality` verde.

## 4. Convenciones

- Entidades y VOs en PascalCase (`Run`, `Health`); casos de uso con verbo (`StartRun`, `ChooseUpgrade`).
- Puertos con nombre de dominio (`ProgressRepository`); adaptadores con prefijo técnico (`LocalStorageProgressRepository`).
- Errores de dominio tipados; `Result` en lugar de excepciones para fallos esperables.
- Líneas ≤ 100, indentación 2, sin `import *` salvo el motor en infraestructura (equivalencias del `checkstyle.xml` del curso).
- Commits: Conventional Commits, `refs: <change-id>` y trailer `Assisted-by: <herramienta/modelo>` si interviene la IA.

## 5. Flujo de trabajo: Spec-Driven Development

Nivel **Spec-Anchored**: las specs viven y evolucionan con el código.

| Situación | Enfoque |
|---|---|
| Pequeño y claro (texto, color, constante) | Prompt directo + test si aplica. Sin change. |
| Mediano/grande y claro (mecánica, guardado…) | **SDD completo** → skill `sdd-workflow` |
| Incierto ("¿es divertido?", "¿qué motor?") | **Spike** desechable en rama `spike/*`; si funciona, SDD |
| Grande y confuso ("hazlo más divertido") | Volver al GDD (`docs/gdd.md`) antes de especificar |

Fases: `explore → propose → [gate humano] → spec ∥ design → tasks → apply (TDD) → verify → [gate humano] → archive`.

**TDD por capa** (ADR-0018): TDD estricto (rojo comprobado) en `domain` y `application`; *test-after* en
infraestructura, composición y contenido. Tareas por escenario, agrupadas por capa; `verify:fast` por tarea y
`verify` completo + commit por grupo. Todo escenario sigue necesitando su test (el verifier lo exige).
Cada change trabaja en **su propio git worktree y rama** (`change/<id>`). Ver skill `worktree-flow`.

Gates humanos: **nunca** avances de *propose* a *spec/design* ni de *verify* a *archive* sin aprobación explícita del usuario.

## 6. Seguridad

- Fase 1 **local-first**: sin backend, sin cuentas, sin secretos. Guardado en el navegador + exportar/importar JSON.
- Todo lo que empiece por `VITE_` acaba en el bundle: **es público**. Nunca pongas claves privadas en el cliente.
- Fase 2 (opcional): Supabase + login con Google. Solo `anon key` en el cliente y **RLS obligatoria** en todas las tablas.
- No leas ni escribas `.env*` (salvo `.env.example`). No añadas dependencias sin justificarlo en el design del change.
- Ver `docs/adr/0004-seguridad-local-first.md`.

## 7. Registro de skills (cárgalas solo cuando apliquen)

| Skill | Cuándo (triggers ES / EN) |
|---|---|
| `sdd-workflow` | nueva funcionalidad, mecánica, change, spec, propuesta / feature, proposal |
| `sdd-archive` | archivar, cerrar change, retrospectiva / archive, retro, close change |
| `worktree-flow` | worktree, rama de change, trabajo en paralelo / branch, parallel |
| `domain-modeling` | entidad, value object, invariante, agregado, evento de dominio / entity, aggregate |
| `test-writer` | test, TDD, cobertura, doble, contrato / coverage, mock, fake |

## 8. Subagentes (`.claude/agents/`)

| Agente | Fase | Puede escribir | Modelo |
|---|---|---|---|
| `game-designer` | GDD, backlog MoSCoW, historias | `docs/gdd.md` | sonnet |
| `sdd-explorer` | explore | solo `openspec/changes/<id>/exploration.md` | sonnet |
| `sdd-spec-writer` | propose + spec | `proposal.md`, `specs/**` del change | opus |
| `sdd-architect` | design + tasks | `design.md`, `tasks.md`, ADRs | opus |
| `sdd-implementer` | apply (TDD) | `src/**`, `tests/**`, `content/**` | opus |
| `sdd-verifier` | verify | solo `verify-report.md` | sonnet |

Quien explora no diseña; quien implementa no verifica. El modelo se fija en el frontmatter de cada agente:
Opus donde se decide o se escribe código; Sonnet en lectura, contraste y diseño de juego (ahorro de créditos;
además, verificar con un modelo distinto del que implementa refuerza la independencia).

## 8.1 Uso eficiente del contexto (créditos)

- Salidas cortas: `npm run verify 2>&1 | tail -20`; abre el log completo solo si algo falla.
- En Windows (Git Bash), escribe código y JSON con Edit/Write, **nunca con heredocs**: alteran `\` y rompen ficheros.
- Devuelve al orquestador resúmenes, no volcados de ficheros ni de comandos.

## 9. Documentación clave

- Plan y decisiones de arranque: `docs/exploration/2026-11-19-kickoff.md`
- GDD: `docs/gdd.md` · ADRs: `docs/adr/` · Diario de IA: `docs/ai-log/`
- API de Phaser: MCP `phaser-docs` (`.mcp.json`, público y sin token) o `https://phaser.io/llms.txt`.
  Su API publicada puede ir por detrás de la 4.2.1 instalada: en caso de duda mandan los tipos de `node_modules/phaser`.
