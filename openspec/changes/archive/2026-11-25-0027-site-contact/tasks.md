# Tasks · 0027-site-contact

<!-- ADR-0018: TDD estricto (rojo comprobado) en domain/application; test-after en infraestructura, composición,
     contenido y tests/support. `npm run verify:fast` al cerrar cada tarea; `npm run verify` completo + commit
     (Conventional Commits, `refs: 0027-site-contact`, trailer `Assisted-by`) al cerrar cada grupo. Ningún grupo
     se cierra en rojo.
     Grupos verticales a propósito: G1 cruza dominio, zod y `buildings.json` porque quitar `access` de
     `BuildingRules` rompe la carga del contenido si no cambian juntos; G2 incluye la regeneración de la línea base
     porque el bloqueo desde el tick 0 cambia la partida y `verify` (con el test de balance) no cerraría en verde.
     Escenarios citados por su título de spec; [bs] build-sites, [pm] procedural-map, [eb] enemy-behavior,
     [mv] player-movement, [sh] sheep, [sl] simulation-loop. -->

## 1. Núcleo: contacto, re-armado y oferta con las dos opciones (sin bloqueo todavía)
Al cerrar G1 los solares siguen siendo caminables: el v4 y `STONE_GOLDEN` no cambian (abrir y salir no consumen ni
ticks ni azar) y el v5 ya toca la huella. Design §1.4–§1.7.

- [x] 1.1 Reglas y contenido del re-armado: `BuildingRules` con `contact.rearmDistance` > `CONTACT_EPS` (1 px,
  exportada) y sin `access`/`checkAccess`/`ACCESS_*` ni la regla cruzada con `playerRadius` (rojo en
  `tests/domain/sites/building-rules.test.ts`); después, test-after, `BuildingsSchema` (`contact` strict, mensaje
  `CONTACT_REARM_MUST_EXCEED_EPS`) y `content/buildings.json` `contact { rearmDistance: 64 }`
  (`tests/infrastructure/content/buildings-content.test.ts`). Escenarios [bs]: "Contenido por defecto",
  "Valores inválidos" (incluido el `access` sobrante y X = ε), "Límites válidos" (X = ε + 0,001), "Campo ausente".
- [x] 1.2 Contacto y re-armado en `BuildSite` (`armed`, rectángulo de la huella, `gap`, `touch`) y
  `Settlement.step(x, y, r, canOpen)` en el paso 12, sin exigir nada asequible (rojo en
  `tests/domain/run-sites-open.test.ts`, reescrito con `touchPoint(site, lado)` y `withRearm(x)` de
  `tests/support/sites.ts`, que sustituyen a `TEST_ACCESS`, `NEAR_ACCESS`, `withSiteAccess` y `dAccess`).
  Escenarios [bs]: "Se abre al tocar una cara", "Se abre al tocar una esquina", "Límite del contacto",
  "Se abre aunque nada sea asequible", "Asequibilidad con los recursos del mismo tick", "Re-armado medido desde
  cualquier lado", "Oferta de mejora en el mismo tick", "Tienda y solar en el mismo tick", "Dos solares a la vez",
  "Sin oferta en el tick de la victoria", "Solar construido", "Abrir no consume azar"; [sl] "Solar abierto con los
  recursos del mismo tick".
- [x] 1.3 Oferta con las dos opciones y construcción por asequibilidad: `BuildOptionSnapshot` con `affordable` y
  `missing`, `Run.build` rechaza por `canAfford` (`not-building` → `unknown-kind` → `not-affordable`), y fuera
  `access` de `BuildSite`, `MapSnapshot.sites`, `RunSnapshot.sites` y `resolveSites.fits`; `placeSites` solo
  renombra (`routeCellOf`, `ROUTE_CELL_HALF`). Rojo en `tests/domain/run-build.test.ts`,
  `tests/domain/run-building-frozen.test.ts`, `tests/domain/determinism-sites.test.ts` y
  `tests/domain/sites/place-sites.test.ts`; `tests/application/build-on-site.test.ts` y
  `fixed-step-building.test.ts` se adaptan (la aplicación no cambia). Escenarios [bs]: "Oferta en el snapshot",
  "La torre no asequible por la piedra", "Coste exacto", "Solo la torre asequible", "Madera a 1 de la casa",
  "Sin oferta fuera de la obra", "Construir una casa", "Construir una torre con el coste exacto", "Torre no
  asequible", "Nada asequible", "Tipo desconocido", "Construir fuera de la obra", "Un solo edificio por visita",
  "Construir no consume azar", "Solares al crear la partida" (sin acceso; la parte "no caminables" queda para 2.1),
  "Lista estable", "Sin solares en el mapa vacío"; [sl] "Solares y flechas en el snapshot", "Snapshot de los
  solares no mutable desde fuera"; [pm] "Firma de referencia de los solares" (`SITE_GOLDEN` intacta).
- [x] 1.4 Bots en tests/support (test-after): `REFERENCE_BUILD_POLICY` filtra por `affordable`; `builderBot` (v5)
  apunta a `(x del centro, (row + rows) · cellSize)` del solar libre y armado más cercano por ruta, con desempate por
  id; v4 sin cambios (sale con `chooseWhileOpen`). Comprobación: `tests/domain/balance.test.ts` (v4 idéntico a
  `BALANCE_BASELINE`) y `tests/domain/balance-builder.test.ts` (v5 en 25–35, ≥ 1 casa y ≥ 1 torre). Sin regenerar
  nada en este grupo.

## 2. Núcleo: solar libre bloqueante desde el tick 0, validaciones y nueva línea base
Design §1.1–§1.3, §1.7 y §5. Este grupo cambia la partida: termina regenerando la línea base y `STONE_GOLDEN`.

- [x] 2.1 Marcado de las huellas libres en `Run.start` (tras `initialState`, en orden de id, sin azar),
  `GameMap.build` que sube `revision` solo si cambia alguna celda y `Flock.spawnAway` sin la guarda
  `revision > 0`. Rojo en `tests/domain/map/game-map-build.test.ts`, `map/flow-field-build.test.ts`,
  `player/collision-build.test.ts`, `enemy/guard-post-build.test.ts`, `run-build-clearance.test.ts`,
  `sheep-respawn.test.ts`, `invariants-build.test.ts` y `map/connectivity.test.ts`. Escenarios [bs]: "El jugador
  choca con el solar libre", "Deslizar junto al solar libre", "El enemigo rodea el solar libre", "El solar libre corta
  la línea libre", "Campo de distancias en el tick 0", "Aparición sobre el solar libre", "Recogible creado sobre el
  solar libre", "Marcar no consume azar", "Solares al crear la partida" (celdas no caminables y `grass`), "Salir no
  reabre", "Volver sin alejarse lo suficiente", "Volver tras alejarse", "Construir no cambia la caminabilidad por
  defecto", "El edificio corta la línea libre", "El jugador choca con la casa", "Aparición sobre el edificio",
  "El tipo de las celdas no cambia", "Enemigo dentro de la huella", "Recogibles dentro de la huella", "Oveja tangente
  a la huella", "Despejar no consume azar"; [pm] "Caminabilidad de las celdas de obra", "Mapa explícito con solares
  declarados", "Campo con un solar", "Toda celda caminable con distancia con los solares libres", "Sin zonas
  aisladas con los solares", "Celdas intactas con solares", "Misma semilla, mismos solares", "Semillas distintas,
  solares distintos", "Los solares no cambian nada más", "Colocar solares no consume el azar de la partida",
  "Contenido sin hueco suficiente", "Sin solares", "Reglas de colocación con las semillas del conjunto"; [eb] "El
  enemigo rodea un solar libre desde el tick 0", "El guardia vuelve rodeando un solar", "Mismo movimiento con la
  misma obra en otro momento", "Semillas del conjunto", "Semillas del conjunto con edificios", "Jugador quieto junto
  al castillo"; [mv] "Choque con un solar libre a velocidad máxima", "Partida larga sin solapes con los solares
  libres"; [sh] "Sin reaparición en un solar", "Solo celdas de obra disponibles".
- [x] 2.2 Validaciones de arranque y despeje inicial: `MAP_SITE_OVERLAPS_PLAYER` con `map.sites.<i>` para todo
  solar (tangente legal; fuera `SETUP_SITE_OVERLAPS_PLAYER`), revalidación de las ovejas declaradas tras el marcado
  (`MAP_SHEEP_ILLEGAL`, `map.sheep.<i>`), `clearFootprint` inicial (enemigos y recogibles de `RunSetup`, puestos y
  puntos de patrulla) y `RunSetup.sites[i].armed`. Rojo en `tests/domain/run-setup-sites.test.ts` y
  `tests/domain/enemy/guard-post-build.test.ts`; la política se compara en
  `tests/domain/determinism-build.test.ts`. Escenarios [bs]: "Solar declarado sobre el jugador", "Oveja declarada
  sobre el solar libre", "Punto de patrulla sobre el solar libre"; [pm] "Solar declarado sobre la posición inicial",
  "Solar declarado fuera de la rejilla"; [sl] "La política de obra fija no cambia la partida" (solares
  `armed: false` con `withRearm(1e6)`).
- [x] 2.3 Bots y huellas (test-after en tests/support): `botWorld(config, map)` marca las huellas de `map.sites`;
  fuera `builderBot.syncBuilt`; el control de huellas de `balance-builder.test.ts` vigila las celdas de obra desde el
  tick 0 (no solo tras construir). Escenario [bs]: "Nada en las celdas de obra" (v5, semillas 1..50).
- [x] 2.4 Regenerar y medir (test-after): `BALANCE_BASELINE` (v4: resultado, tick final y bajas por semilla) y la
  nueva referencia del v5 (`BUILDER_REFERENCE` en `tests/support/balanceBaseline.ts`: victorias), y `STONE_GOLDEN`
  (`tests/support/stoneGolden.ts`) con el comentario de por qué: las huellas bloqueantes cambian qué bajas ocurren y
  en qué orden, y con ellas la secuencia de tiradas del flujo `STONE_STREAM`; las otras cinco firmas no se tocan.
  **Gate**: v4 y v5 en 25–35 (prototipo 34/50 los dos), ≥ 1 casa y ≥ 1 torre en el lote del v5, quieto 0 victorias y
  muerte < 10.800 en las 50 semillas con mapa generado y con mapa vacío, sin pasar por obra. Si el v4 o el v5 salen
  de banda, **parar y volver a propose** (no recalibrar). Anotar para el verify-report: victorias v4/v5, casas y
  torres por partida, muerte más tardía del quieto y tiempo de cada lote en local y ×2,8 (previa 37,7/43,9 s,
  CI ~105/123 s; tope 180 s, que no se sube). Escenarios [bs]: "Bot v4 en banda y línea base", "Victorias del bot
  v5", "Quieto pierde con los solares"; [pm] "Firma de la piedra regenerada".

## 3. Infraestructura y composición: panel de obra con iconos y sonda
Design §3. Test-after.

- [x] 3.1 `dom/resourceIcons` (función pura `(appearance, assetUrl) → { wood, stone }`, las URL de `W_Idle` y
  `Deco/05`) y `menuText` (`buildMissing(n)`, `alt` `madera`/`piedra`). Tests
  `tests/infrastructure/dom/resource-icons.test.ts` (nuevo) y el de `menuText` si existe.
- [x] 3.2 `BuildPanel` con siempre dos filas (casa, torre), nombre y coste en elementos distintos, coste 0 omitido,
  `.is-unavailable` + `disabled` + `aria-disabled`, `.is-short` y «faltan N», saldo con iconos, sin atributo `style`;
  CSS en `styles.css` (grid con `column-gap` 1,25em, icono 2em `pixelated`, recorte al frame 0 por
  `object-fit`/`object-position`). Tests `tests/infrastructure/dom/build-panel.test.ts` y
  `tests/infrastructure/phaser/build-gate.test.ts`. Escenarios [bs]: "Panel con las dos opciones asequibles",
  "Panel con la torre no asequible", "Panel sin nada asequible", "Nombre y coste separados", "Clic en la casa",
  "Salir con Esc o con el botón", "Sin panel fuera de la obra".
- [x] 3.3 Composición y sonda: `main`/`contentBoot` pasan `resourceIcons(appearance, assetUrl)` al `BuildPanel`;
  `__sprint.sites` sin `access` y con `options[].affordable`/`missing`; `tests/infrastructure/phaser/site-art.test.ts`
  y `plan-sites.test.ts` sin acceso. Objetos del mapa 737/820 en 42/123 (test sin navegador existente). Escenarios
  [bs]: "Objetos del mapa sin cambios", "Sonda de solares en el menú" (cubierta por el E2E de humo existente que la
  lee; si no la lee, se añade la aserción en 4.1).
- [x] 3.4 Regresión "solo se podían construir casas" (informe del usuario jugando en `main` tras 0026: nunca vio
  la torre, ni con recursos aparentemente suficientes). Análisis del orquestador: en el dominio la oferta sí incluye
  la torre con ≥ 30 madera y ≥ 15 piedra (`run-sites-open` lo cubre con la config de prueba), pero (a) el panel solo
  listaba lo asequible, (b) abría en cuanto la casa era asequible (15 madera), así que el jugador solía gastar en
  casas antes de reunir 30, y (c) en el caso observado (20 madera / 18 piedra) la torre de verdad no alcanzaba. No se
  ha reproducido un fallo de código, pero hay que **descartarlo de extremo a extremo**: test de composición (sin
  navegador, DOM de prueba) con el contenido real de `content/` (`loadContent`, no la config de escenario), una
  partida en el mapa generado con `RunSetup` que deja 30 madera y 15 piedra y al jugador tocando un solar: la sonda
  y el `BuildPanel` muestran la torre **activada**, el clic produce `{ kind: 'build', building: 'tower' }` y, tras
  el paso, el solar queda en `tower` con madera −30 y piedra −15. Si falla, es un bug: arreglarlo aquí y anotarlo
  en el diario de IA. En 4.1, además, la sonda del E2E comprueba que la fila de la torre existe siempre.

## 4. E2E y documentación
- [x] 4.1 **0 E2E nuevos**: ampliar "Construir una casa en el juego real" (`tests/e2e/gameplay.spec.ts`,
  `?e2e&manual&seed=42`, `map: 'real'`) y `tests/e2e/probe.ts`: la ruta trata las huellas de `map.sites` como no
  caminables, camina a la celda bajo la huella más cercana y empuja hacia arriba con `step(n)` hasta la obra; con
  ≥ 15 de madera y < 15 de piedra comprueba la sonda (`house` asequible, `tower` no, sin clave `access`), la fila de
  la torre desactivada con «faltan», cada icono ≥ 20 × 20 px y ≥ 8 px entre nombre y coste
  (`getBoundingClientRect`); tras el clic y `step(1)`: solar en `house`, panel oculto, madera −15,
  `sprites.sites` 1 casa y 5 solares en obra, sin errores. Ejecutar `npm run test:e2e -- gameplay.spec`.
  Escenario [bs]: "Construir una casa en el juego real".
- [x] 4.2 GDD (delegar en el subagente `game-designer`): entrada **0027 `site-contact`**, renumerar
  `goblin-tower-archers` → **0028** y `characters` → **0029**, con las referencias de `balance-pass-2` y la mención
  "bloque 0020-0028" (líneas señaladas en `exploration.md`).
- [x] 4.3 Al cerrar (fase archive): párrafo de 0027 en AGENTS.md §1 (solar libre bloqueante desde el tick 0 con
  `BUILT`, contacto g ≤ ε con `CONTACT_EPS` 1 px y re-armado `contact.rearmDistance` 64, oferta siempre con casa y
  torre, panel con iconos y «faltan N», `MAP_SITE_OVERLAPS_PLAYER`, cifras finales v4/v5 y lotes), nota "matizada
  por ADR-0026" en ADR-0025 y comprobación de que `docs/adr/0026-solar-bloqueante-y-oferta-por-contacto.md` recoge
  las correcciones del §8 del design.
