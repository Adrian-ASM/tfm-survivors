# Tasks · 0029-living-map

<!-- Todo el change es infraestructura de render, contenido de aspecto y assets: test-after (ADR-0018), sin
     tareas de dominio ni de aplicación (el núcleo no cambia). Cada grupo = 1 commit con `npm run verify` completo
     en verde; `verify:fast` por tarea. Specs: `specs/sprite-rendering` (SR), `specs/build-sites` (BS),
     `specs/asset-provenance` (AP). Diseño: `design.md`. -->

## 1. Dominio
(sin tareas: el núcleo no cambia)

## 2. Aplicación
(sin tareas)

## 3. Infraestructura y contenido

### Grupo A · Assets y datos de aspecto (commit 1)
- [x] 3.1 Copiar byte a byte `Deco/01`–`03`, `07`–`11` y `16`–`18` del pack Update 010 a
  `public/assets/tiny-swords/Deco/` con sus 11 entradas en `content/asset-provenance.json` (sha256 y bytes reales;
  las entradas de antes, intactas). **Medición**: anotar la última fila opaca de `16`, `17` y `18` y decidir su
  `origin.y` (por defecto 1, design §Comprobación; si se baja, la huella de base lo absorbe). Rehacer
  `tests/infrastructure/stone-provenance.test.ts` ("Solo las tres rocas" → "Solo las rocas y la decoración en
  Deco") y añadir los de la decoración.
  — AP: "Hojas de la decoración registradas", "Integridad de las hojas de la decoración", "Hoja de la decoración sin
  entrada", "Hoja de la decoración del Free Pack", "Calabazas y huesos fuera", "Solo las rocas y la decoración en
  Deco", "Hojas de la piedra registradas" — tests: `stone-provenance.test.ts`, `decor-provenance.test.ts` (nuevo).
  **Medición (apply)**: filas opacas (alfa > 0) de cada hoja: `16` 3–103 de 128, `17` 15–104 de 128, `18` 48–168 de
  192 (columnas 54–140). El pie queda ≈ 24 px de hoja (≈ 22 px de mundo) sobre el borde inferior de la celda, en
  la mitad baja de la celda, como las bajas (01–11, centradas). **Decisión: `origin.y` = 1 en las tres**: bajarlo
  metería la base en la fila de abajo y la huella de base dejaría de ser 1 celda (3 × 1 en 18), que es lo que fija
  la spec. Nota: entradas de la nota 31 → 42.
- [x] 3.2 Esquema y datos: `map.trees` con `idle` en bucle (sin `models`), `map.decor` (`density`, `maxObjects`,
  `castleMargin`, `items` con `tall`; hoja única, no roca, en la nota), `idle` 0–3 a 5 fps de la torre intacta,
  hojas de decoración en `mapSheetsOf` y `sheetsToLoad`. Actualizar `content/appearance.json`.
  — SR: "Datos del repositorio", "Datos del mapa inválidos", "Datos de la decoración inválidos", "Rutas de hoja no
  admitidas", "Hoja de cada elemento", "Solo las hojas usadas", "Animaciones obligatorias y campos desconocidos" —
  tests: `appearance-map.test.ts`, `appearance-repo.test.ts`, `appearance-decor.test.ts` (nuevo),
  `boot-plan.test.ts`.

### Grupo B · Plan puro del arte del mapa (commit 2)
- [x] 3.3 `map/decorChoices.ts` + `planMapArt`: celdas válidas, huella de base, orden por hash con sales
  `DECOR_PLACE_KEY`/`DECOR_KIND_KEY`, aceptación voraz con huellas libres y tope sobre datos; `decor.placed`, piezas
  solo con arte, capas e índices (decoración antes de troncos en la baja y antes de copas en la alta),
  `counts.decor` (`planned`/`painted`/`unpainted`). **Medición**: objetos exactos de 42 y 123 (tope 0 y repositorio)
  y `drawn` a 1.280 × 720, anotados en el test y para el verify-report.
  — SR: "Decoración de los mapas generados", "Zonas excluidas", "Junto a los troncos", "Misma semilla, misma
  decoración", "Otra semilla, otra decoración", "Sin decoración en los mapas explícitos ni en el vacío", "Tope de
  decoración", "Decoración en su sitio", "Hoja de una decoración que no carga", "Elementos en su sitio" (sin
  decoración), "Tope de objetos sin navegador", "Presupuesto de objetos con estructuras", "Tope de objetos con las
  vetas", "Todo el plan se puede ver", "Recorte con aspecto de reserva", "Decoración baja y alta" (orden de capas en
  el plan); BS: "Objetos del mapa sin cambios", "Solares sin decoración" — tests: `plan-decor.test.ts` (nuevo),
  `plan-sites.test.ts`, `plan-map-art.test.ts`, `plan-map-fallback.test.ts`, `map-culling.test.ts`.
  **Medición (apply, contenido por defecto, sin navegador)**: semilla 42 → **820** objetos del mapa (737 con tope
  0 + 83 de decoración: 66 decoraciones, 17 altas, 3 espantapájaros) y `drawn` **119** a 1.280 × 720 con el jugador
  en la salida (108 con tope 0); semilla 123 → **904** (820 + 84: 66 decoraciones, 18 altas, 2 espantapájaros) y
  `drawn` **90** (79 con tope 0). Ambas ≤ 950. En 1..50: 63–71 decoraciones y 76–95 objetos de decoración por
  mapa. Fijadas en `plan-sites.test.ts`, `plan-map-fallback.test.ts` y `sheep-layer.test.ts`. "Recorte con aspecto
  de reserva" está en `render-layers.test.ts` (casos `Deco/18.png` y "ninguna hoja del mapa").
- [x] 3.4 Fases y grupos de animación: `treeChoices` (`phase = h mod n`, volteo igual), `TOWER_PHASE_KEY`,
  `phasedFrameAt`, `mapLooks` con todos los frames de `idle` (árbol y aspectos de estructura) y
  `MapArtPlan.animations` (tronco+copa y partes de torre intacta en el mismo grupo; ruinas, vetas, solares, castillo
  y decoración sin grupo).
  — SR: "Frame de un árbol según su fase", "Frame de una torre según su fase", "Fases deterministas", "Mismas fases con
  la misma semilla", "Variedad dentro de un mapa", "Otra semilla, otras fases", "Caja de los objetos animados",
  "Reserva de árbol y torre", "Reserva de cada elemento", "Reserva de las estructuras" — tests:
  `tree-choices.test.ts`, `animation.test.ts`, `map-looks.test.ts`, `plan-map-animation.test.ts` (nuevo).

### Grupo C · Animación y sonda en el adaptador (commit 3)
- [x] 3.5 `MapAnimator` (puro) + `MapCuller.isVisible` + `MapArtCanvas.frame` (`phaserArt`: `setFrame` sobre el
  sprite pintado) + `RenderLayers` (mismo `AnimClock` que la espuma, `tick` tras los `sync` de estructuras, cebado
  en `cullMap` con un `MapVisibility` creado una vez).
  — SR: "Árbol y torre al reaparecer", "Torre que cae en ruina", "Elementos estáticos", "Árboles y torres congelados en
  pausa, oferta, tienda, obra y fin", "Torre intacta animada", "Pausa, oferta, tienda, obra y partida terminada",
  "Espuma al reaparecer", "Movimiento continuo sin huecos", "`drawn` igual al recorte", "Totales del mapa con
  estructuras y vetas" — tests: `map-animation.test.ts` (nuevo), `render-layers.test.ts`, `map-art-canvas.test.ts`,
  `structure-art.test.ts`.
- [x] 3.6 Sonda `sprites.mapArt.decor` (`planned`/`painted`/`unpainted`; objetos solo pintados) en `paintMap`,
  `zeroMapArt` y el tipo de la sonda E2E; invariancia de la simulación con y sin decoración/animación.
  — SR: "Recuento de la decoración sin una hoja", "Sonda en el menú", "Partida nueva y menú", "Mapa vacío"
  (recuentos), "Recuento coherente con el snapshot" (decoración constante), "Elegir la decoración no consume azar",
  "Pintar la decoración no cambia la simulación", "Animar no cambia la simulación", "La variedad no toca la
  simulación", "Los aspectos no cambian la simulación", "Ovejas fuera del plan del mapa" — tests:
  `render-layers.test.ts`, `terrain-view.test.ts`, `render-invariance.test.ts` (nuevo o ampliado), `tests/e2e/probe.ts`.

## 4. E2E y documentación

### Grupo D · E2E de humo y docs (commit 4)
- [ ] 4.1 Ampliar (sin E2E nuevos, modo manual `?e2e&manual` + `step(n)`) "Recuentos del mapa pintado [E2E]"
  (`decor.planned ≥ 1`, `painted = planned`, `unpainted 0`) y "Hojas del mapa bloqueadas [E2E]" (además
  `Deco/18.png`: `unpainted` = espantapájaros del plan, resto pintado, tick 60, sin errores no capturados).
  — SR: esos dos escenarios — tests: `tests/e2e/gameplay.spec.ts` (`npm run test:e2e`).
- [ ] 4.2 Docs: estado de 0029 en `AGENTS.md` (§1) con las cifras medidas (objetos 42/123, `drawn`) y entrada del
  diario de IA; medición informativa `realtime` con `CI_LIKE=1` (fps 42/123) si se ejecuta, para el verify-report
  ("Fps con el mapa real [realtime]", "Objetos del mapa [realtime]": a demanda, no bloquean).
