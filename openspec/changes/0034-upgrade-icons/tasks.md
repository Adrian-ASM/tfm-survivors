# Tasks · 0034-upgrade-icons

<!-- Sin núcleo: no hay tareas de domain/application, todo es test-after (ADR-0018). Cada grupo es una unidad de
     commit: `npm run verify:fast` al cerrar cada tarea; `npm run verify` completo y commit al cerrar el grupo
     (Conventional Commits, `refs: 0034-upgrade-icons`, trailer `Assisted-by:`). Nunca `--no-verify`, tampoco en
     commits WIP. Al cerrar cada grupo: `git fetch` y `git rebase origin/main` antes de seguir.
     Los grupos 1–5 cierran el código sin ningún PNG (sección `icons` ausente, todo `none`, juego jugable). El grupo 6
     integra los iconos que genera el autor y puede ir por lotes. El 7 (E2E) solo pasa con los 16 + 2. -->

## 1. Guardarraíl de procedencia IA
- [x] 1.1 `guard-assets.mjs`: lista `generated[]` y `generatedPolicy` (D8, reglas 1–6), con `checkAssets` puro y
  `digest` inyectado; los casos "tras el change" usan una nota simulada con una entrada IA de prueba (la real llega en
  6.1) — escenarios `asset-provenance`: "Registro de imagen con IA incompleto o incorrecto" (los 9 casos, fecha
  `2026-02-30` incluida), "Imagen con IA sin registro", "Registro de imagen con IA sin fichero", "Imagen con IA fuera
  de los iconos", "Política sin ADR", "Ruta en dos listas", "Imagen con IA sin versión del pack", "Imágenes con IA sin
  red"; sin regresión en "Nota incompleta", "Entrada repetida", "PNG sin registrar", "Asset gráfico fuera de la carpeta
  de assets", "Entrada sin fichero", "Ficheros prohibidos", "Mayúsculas en la extensión", "Ruta del Free Pack en el
  repositorio" y "Origen del Free Pack" — test: `tests/guardrails/assets.test.ts`

## 2. Infraestructura · datos y resolución de iconos
- [x] 2.1 Esquema `icons` en `appearanceSchema.ts` (`IconFile`, `byId`, `fallback` obligatorio, `strictObject`;
  sección `icons` **opcional de forma transitoria** hasta 6.1), `ICON_DIR`, `generatedPaths` en `loadAppearance.ts` y
  comprobación de hojas/piezas contra la lista de arte e iconos contra la IA (`ICON_NOT_REGISTERED`, D1/D8) —
  escenarios: "Datos de iconos inválidos" (los 11 casos), "Aspecto con una imagen con IA" (`goblin-torch`, oveja,
  `panel`) — test: `tests/infrastructure/icons-appearance.test.ts` (nuevo) y `appearance-schema.test.ts`
- [x] 2.2 `src/infrastructure/icons/upgradeIcons.ts`: `IconCatalog`, `IconCategory`, `IconState`
  (`painted | fallback | none`), `resolveIcon` puro e `IconBook` (D2/D3) — escenarios: "Tabla de resolución", "Reserva
  de otra categoría sin efecto" — test: `tests/infrastructure/upgrade-icons.test.ts`

## 3. Infraestructura · carta de mejora y carga
- [x] 3.1 `cardLayout.ts`: `CARD_HEIGHT` 240, `CARD_ICON_SIZE` 64, `CARD_TEXT_GAP`, `cardContentLayout` (D4), con los
  textos reales de las 9 mejoras de personaje a k ∈ {1, 2, 1,4066} — escenarios: "Hueco escalado con k entero y
  fraccionario", "Descripción más larga con icono"; regresión de "Ventana mínima con cartas enteras" y "Texto mínimo
  en un móvil horizontal" — test: `tests/infrastructure/card-layout.test.ts` (+ `mobile-frame.test.ts` sin cambios
  de cifras)
- [x] 3.2 `UpgradeOverlay` + `sceneWidgets`: `CardIcon` (3 `Image` preasignados, sin `setInteractive`), `iconFor`,
  `setTexture` solo al cambiar la oferta, `setVisible(false)` en `none`, recolocado en RESIZE e `iconStates` —
  escenarios `upgrades`: "Un icono por carta", "Mejora sin icono propio", "Icono y reserva que no cargan", "Icono en la
  carta de reserva", "Clic sobre el icono y RESIZE sin crear iconos", "Tres cartas", "Menos cartas", "Sin oferta";
  regresión de "Elegir con tecla" y "Elegir con clic" — test: `tests/infrastructure/upgrade-overlay.test.ts`
- [x] 3.3 `bootPlan.iconImagesOf` y `BootScene` (petición con `deps.iconUrl`, `NEAREST` por clave cargada,
  `onIconsLoaded`, fallos sin lanzar ni contar como reserva) — escenarios: "Filtro sin suavizado", "Icono que falla
  sin reserva de sprites" — test: `tests/infrastructure/boot-plan.test.ts`

## 4. Infraestructura · fila de la tienda (DOM)
- [x] 4.1 `ShopPanel` con `IconBook`: un `<img class="shop-panel__icon" alt="">` por fila (URL propia, `hidden` y sin
  `src` en `none`), `ShopProductView.icon`; `styles.css` con la rejilla de 4 columnas, 32 px × `--ui-scale`,
  `pixelated` y `[hidden]`; instantánea de `dom-unchanged` regenerada (solo 1 imagen más por fila) — escenarios
  `castle-shop`: "Siete filas con su icono", "Producto sin icono propio", "Imagen que no carga", "Reglas del icono de
  fila", "Clic sobre el icono", "Overlay con oro justo", "Clic en un producto", "Clic sin oro"; `sprite-rendering`:
  "DOM sin cambios", "Los siete paneles con la pieza de panel" — test: `tests/infrastructure/shop-panel.test.ts`,
  `dom/ui-kit.test.ts`, `dom/dom-unchanged.test.ts`

## 5. Composición · cruce de ids, cableado y sonda
- [x] 5.1 `checkIconRefs` en `contentBoot.ts` (ids de los dos catálogos y `heal`, `ICON_UNKNOWN_ID`,
  `BootedContent.icons`, `heal` con la reserva de arma) — escenarios: "Id desconocido" (con y sin `?e2e`), "Mejora
  sin entrada" — test: `tests/composition/content-boot.test.ts`
- [x] 5.2 `assetUrl.iconUrl`, `IconBook` en `main.ts`, `iconFor` a `GameScene`/`UpgradeOverlay`, sondas
  `__sprint.offerIcons` y `shop.products[i].icon`; partida con iconos sin cargar y simulación igual con y sin sección
  `icons` — escenarios: "URLs de los iconos bajo la base", "Estados en la sonda", "Partida entera con todos los iconos
  sin cargar", "Los iconos no cambian la simulación ni el mapa" (snapshots; 820/904, balance y firmas por los gates
  existentes de `verify`) — test: `tests/composition/asset-url.test.ts` (o el de URLs de 0032),
  `tests/infrastructure/ui-fallback-run.test.ts`, test de sonda con dobles

## 6. Contenido · iconos generados con IA (por lotes; requiere los PNG del autor)
- [x] 6.1 Lote 0 (en 0034 un solo lote con 6.2 y 6.3; sin `remove-white-bg.ps1`: los 18 los genera
  `scripts/icons/draw-icons.mjs`, design D8), las 2 reservas en `public/assets/icons/` con su entrada en `generated[]`, `generatedPolicy` y la sección
  `icons` (`byId` vacío); quitar el `optional` transitorio de 2.1; lector `tests/support/pngProbe.ts` (`node:zlib`) y
  "Solo las hojas usadas" ampliado a la lista IA — escenarios: "Nota del repositorio", "Estado real del repositorio",
  "Icono registrado solo como imagen con IA", "Iconos del repositorio medidos" (sobre lo que haya), "Icono con otro
  tamaño o sin alfa", "Icono de más", "Hoja de cada elemento" — test: `tests/content/upgrade-icons.test.ts` (nuevo),
  `tests/infrastructure/appearance-repo.test.ts`, `guard:all`
- [x] 6.2 Lotes 1..n (repetible, un commit por lote): por cada PNG listo, post-proceso, sha256/bytes, entrada en
  `generated[]` y clave en `byId`; las 4 de prueba solo con prompt recuperado y términos válidos — escenarios:
  "Iconos del repositorio medidos", "Estado real del repositorio" — test: `tests/content/upgrade-icons.test.ts`,
  `guard:all`
- [x] 6.3 Cierre de cobertura: activar en `upgrade-icons.test.ts` la comprobación de las 16 claves exactas y las 2
  reservas — escenarios: "Iconos del repositorio", "Lista del repositorio", "Iconos del repositorio medidos"
  (completo) — test: `tests/content/upgrade-icons.test.ts`, `guard:all`, gate de balance en `verify`

## 7. E2E
- [x] 7.1 Ampliar el test "Tienda: se abre al volver a la puerta…" de `gameplay.spec` (`?e2e&manual&seed=42`, mapa
  real): escucha de `securitypolicyviolation`, las 7 filas `painted` en tienda y, tras salir, `stepUntil` hasta la
  primera oferta con las 3 cartas `painted`; ampliar `tests/remote/public.spec.ts` para pedir los iconos (a demanda,
  no se lanza) — escenarios: "Iconos en la oferta y en la tienda [E2E]", "Arte en la URL pública"; regresión de
  "Desde el menú" y "Con e2e" — test: `npm run test:e2e -- gameplay.spec` y la suite `logic` entera

## 8. Documentación
- [ ] 8.1 ADR-0030 a "aceptada" al archivar (ya escrito); `docs/gdd.md` (línea ~387 "no se dibuja con IA" y Won't
  de la línea 129: la IA solo en iconos de mejora, ADR-0030); estado de 0034 en `AGENTS.md` §1; nota en
  `docs/ai-log/` (herramienta, cupo, prompts, términos leídos) — escenario: — (documental) — test: `npm run verify`
