# Exploración 0027 · site-contact

Intención: abrir la oferta de obra al tocar el solar (sin punto de acceso), solar libre bloqueante desde el tick 0 y
`BuildPanel` legible (texto, iconos, casa y torre siempre visibles).

## Contexto actual (rutas)
- Acceso: `BuildSite` (`src/domain/site/BuildSite.ts`) crea `access` (centro de la huella, borde inferior + `ACCESS_OFFSET_CELLS` 1,5)
  y un `ProximityGate` (`src/domain/shared/ProximityGate.ts`, compartido con la tienda, que se queda) armado al empezar.
  Contenido: `content/buildings.json` `access {radius 40, rearmDistance 160}`; zod en `src/infrastructure/content/schemas.ts`
  (~600-650); reglas y cruces (`radius + playerRadius < 1,5 celdas`, `ACCESS_*`) en `BuildingRules.ts`; snapshot `armed`/`access`
  (`siteSnapshots.ts`, `RunSnapshot.ts`); `resolveSites.fits` y `placeSites` (la zona exige huella, anillo de 1 celda y fila de
  acceso libres; ruta a la puerta medida en la celda de acceso).
- Apertura: `Settlement.step` (paso 12, `Run.tick`) abre solo si `canOpen` y algún tipo es asequible; la oferta (`offered`) son
  solo los asequibles, de ahí que la torre desaparezca (`toBuildSnapshot` -> `BuildPanel.sync` pinta `build.options`).
- Obra: `GameMap.build` marca `BUILT` 5 en la capa viva `live` (`typeAt` y firmas leen `cells`, inmutable) y sube `revision`;
  `FlowField` y `GuardPost` se invalidan por revisión. `Run.raise` -> `clearFootprint` (enemigos, recogibles, ovejas, puestos).
  Hoy la huella libre es caminable (hierba); los enemigos la cruzan y el jugador también.
- Colisión del jugador: `GameMap.limitMoveX/Y` (`sweep`): primer contacto con celda no caminable, tangente a la cara
  (`near - reach`); `overlapsBlocked` con `TANGENCY_EPS` 1e-6 en d². El jugador queda pegado a la huella y nunca la penetra
  (invariante ya comprobada en `clearFootprint`).
- Tests que tocan el acceso: `tests/domain/run-sites-open.test.ts` (30 refs), `run-build*.test.ts`, `sites/building-rules.test.ts`,
  `sites/place-sites.test.ts`, `tests/support/sites.ts` (`TEST_ACCESS`, `NEAR_ACCESS`, `withSiteAccess`, `dAccess`),
  `tests/support/policies.ts` (`builderBot` va a `site.access`), `buildings-content.test.ts`, `E2E gameplay.spec.ts:651` (camina a
  `site.access`) y `tests/e2e/probe.ts`.
- `BuildPanel` (`src/infrastructure/dom/BuildPanel.ts`, CSS `styles.css:293`, tests `tests/infrastructure/dom/build-panel.test.ts`):
  nombre y coste son dos `span` dentro del `button`, sin separación; el botón es `display:flex; width:100%` pero el panel es
  de ancho "a contenido", así que `space-between` no tiene holgura (hipótesis, sin verificar en navegador). La tienda ya tiene
  patrón de "no disponible" (`.shop-panel__product.is-unavailable`, aviso). Etiquetas en `menuText.ts`
  (`buildWood`/`buildStone`). Los iconos del HUD son texturas Phaser (`counterIcon(looks.pickups.*)`, hojas `G_Idle`/`W_Idle`
  de 128 px y roca `Deco/04-06` en `appearance.json`), no DOM; CSP `style-src 'self'; img-src 'self' data:` (sin estilos inline).

## Capacidades/specs afectadas
`openspec/specs/build-sites` (apertura con re-armado, panel, acceso, despeje), `procedural-map` (capa de obra, solares),
`sprite-rendering` (solar), posiblemente `hud`/`enemy-pathfinding` (FlowField), `reference-bot`. ADR-0025 se matiza; probable ADR nuevo.

## Opciones
**A. Definir "tocar"** (dominio, sin azar): `d(centro jugador, AABB de la huella) <= playerRadius + ε`, con
`ex,ey = gap` por eje como en `overlapsBlocked`, `hypot`. Como el barrido deja al jugador tangente, `d ≈ r` (error de float ~1e-12).
 - A1 `ε` constante de dominio (p. ej. 1 px): robusto, sin contenido; cubre caras y esquinas. Con ε grande, "rozar" a 1 px abre.
 - A2 `ε` en `buildings.json` (`contactMargin`): tunable, un campo zod nuevo. Ambas no cambian azar.
 - A3 contacto "empujando" (exigir input hacia la huella): evita aperturas al pasar rozando, pero acopla dominio a la entrada.

**B. Re-armado** (decisión con el usuario):
 - B1 al dejar de tocar (`d > r + ε`) 1 tick: sin parámetros; pegado y quieto no reabre (Salir no avanza ticks), pero rozar o
   "picar" la pared reabre una y otra vez.
 - B2 histéresis por distancia a la huella (`rearmDistance` ahora desde el borde, p. ej. 60-160 px): no hay bucle por
   vibración; conserva un parámetro y `ProximityGate` necesita una variante por distancia a rectángulo.
 - B3 temporizador (N ticks sin tocar o desde que se sale): si no exige separarse, reabre cada N ticks pegado (mala); solo vale
   combinado con B1.

**C. Solar libre bloqueante**: marcar la huella en la capa viva al crear `Run` (tras `resolveSites`, antes/después de `initialState`).
 - C1 código nuevo `SITE` 6 no caminable, `isBuilt` solo `BUILT`: distingue "libre" de "construido" (el despeje y `isBuiltAt` no
   cambian) y `build` lo sobrescribe a 5. Pros: semántica clara. Contras: más código en `CellType`/`FlowField`.
 - C2 reutilizar `BUILT` (5) desde el tick 0: mínimo código, pero `isBuilt`/despeje/`revision > 0` (Flock.ts:254) quedan ambiguos.
 - En ambos: no cambian `typeAt`, `MAP_GOLDEN`, `STRUCTURE/RESOURCE/SHEEP/STONE/SITE_GOLDEN` (colocación anterior, el azar de
   `SITE_STREAM` igual) **si `placeSites` no cambia**; quitar la fila de acceso de la zona libre (opcional) sí cambiaría `SITE_GOLDEN`.
   El anillo de 1 celda de hierba mantiene la conectividad (rodea la huella), así que el mapa no se parte.

## Riesgos e incógnitas
- Contacto + bloqueo = modal al chocar: con solares como obstáculos, correr huyendo y rozar uno congelaría la partida.
  Mitigar con B2 o con A3, o dejando la apertura solo si hay algo asequible (ver pregunta 2).
- Orden de creación: marcar tras `initialState`/`prebuild` (el check `SETUP_SITE_OVERLAPS_PLAYER` y `overlapsBlocked` de
  `RunSetup:176` deben decidir si la salida dentro de un solar declarado es error). Escenarios de test con huellas en `TEST_SITE`.
- `Flock.ts:254` usa `revision > 0` para filtrar reapariciones: con bloqueo desde el tick 0 hay que revisarlo y las ovejas deben
  respetar la huella libre (`legalPosition` ya usa `overlapsBlocked`). Si la marca sube `revision` a 1, cambia ese filtro.
- Enemigos: siguen ignorando el mapa y solo se encaminan por `FlowField`; apariciones y gemas caen vía `nearestWalkable` (O(celdas)
  en bajas sobre bloqueadas). `clearFootprint` sigue haciendo falta como red (enemigos que se cuelan por esquina) pero ya no
  desaloja a nadie por construcción en la práctica; decisión del design.
- El rodeo por `FlowField` cambia la trayectoria de los enemigos en todas las semillas: `BALANCE_BASELINE` (v4, 30/50, 0 quietos),
  mechas por partida y v5 (29/50) cambian con casi seguridad; los tests de conteos exactos hay que regenerarlos tras medir.
- Bots: v4 ya sale de la obra (verlo pegado al solar sin construir); v5 debe apuntar a una celda caminable adyacente a la huella
  (no existe `access`) y entrar en contacto; `routeFrom` del E2E y `walk` usan el mapa del probe (sin huellas libres): hay que
  incluirlas en la ruta.
- Tiempo del lote: CI 94 s (v4) y 140 s (v5) con timeout 180 s; más BFS por solares bloqueados podría rozar el límite.
- `BuildPanel`: iconos del HUD son texturas Phaser; en DOM habría que usar recorte CSS de la hoja (URL en `appearance.json`;
  CSP ok con `img-src 'self'`, sin `style=`) o `data:` URL generada del canvas (permitido). Determinar procedencia del icono de piedra
  (roca `medium` 64 px) y la tabla de pegado (gap/min-width). Casa y torre siempre: sonda `sites.panel.options` y tests
  de `build-panel.test.ts`/`Settlement` (`offered` hoy = asequibles) cambian; `Run.build` debe seguir rechazando lo no asequible.

## Mediciones previas (las lanza el orquestador antes de la propuesta)
Cambio provisional mínimo (rama desechable): marcar huellas libres como no caminables (C2, tras `initialState`), contacto A1 con
ε = 1 px y re-armado B1, `builderBot` apuntando a una celda adyacente por debajo de la huella. Medir con la semilla 1..50:
(1) `balance.test.ts` v4: victorias en [25, 35] (hoy 30/50) y quieto pierde < 180 s con las 50; (2) v5 (`determinism-build.test.ts` y
el lote del bot constructor) victorias y solares construidos; (3) tiempo del lote local y su proyección a CI (x2,8; debe quedar
< 180 s en ambos); (4) objetos del mapa 42/123 (<= 1.000, hoy 737/820) y bench `run-tick-buildings`.
Umbral: banda de victorias, 0 quietos, lote < 150 s proyectado.

## Preguntas para el usuario
1. Re-armado: ¿B1 (al dejar de tocar), B2 (distancia desde el borde) o B3 combinado?
2. ¿La oferta abre aunque nada sea asequible (se verá desactivada con lo que falta) o solo si hay algo asequible? Con bloqueo, riesgo de modal al rozar.
3. ¿Tocar es solo contacto físico (ε fijo de dominio) o con margen en `buildings.json`?
4. ¿Se elimina del contenido y del snapshot `access`/`armed` (rompe la sonda) y se quita la fila de acceso de la zona libre (cambia `SITE_GOLDEN`)?
5. ¿Iconos en el panel reutilizando las hojas (CSS) o iconos propios; y el aviso de lo que falta, como "te faltan 5 madera"?
6. GDD: crear 0027 `site-contact`, renumerar `goblin-tower-archers` -> 0028 y `characters` -> 0029 (líneas `docs/gdd.md` 82, 123, 129, 143-160,
   255, 277, 286, 333-334 y la mención "bloque 0020-0028"), más `balance-pass-2` ("después de 0028" -> 0029).
