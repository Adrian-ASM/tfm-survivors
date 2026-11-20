# Tasks · 0007-local-save-export

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → aplicación →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea.
     "Rojo" = el test que debe fallar antes de escribir el código de la tarea. Lección de 0006: los pasos que no
     ponen un test en rojo por sí solos van agrupados con el que sí lo hace.
     PP = spec progress-persistence · RR = spec run-results. Design: design.md (tabla de cobertura). -->

## 0. Medición (antes de tocar `src/`)
- [x] 0.1 Semilla rápida: en el núcleo, contenido por defecto, input (0, 0) y elección fija (opción 0), semillas
  1–200 hasta `over` o 36.000 ticks. Anotar en design §Medición y en `docs/ai-log/`: tick de muerte de la semilla 42
  (esperado 4682) y la semilla `F` que muere antes. Fijarla como regresión `tests/domain/balance.test.ts`
  "semilla F sin input pierde en ≤ T ticks" (T = tick medido redondeado arriba al segundo). Tarea de medición: el
  test entra verde (excepción documentada). — escenario: PP "Almacenamiento bloqueado" (plazo del E2E (2))
- [x] 0.2 Coste E2E: medir el tiempo real de `npx playwright test results.spec.ts` (sin build reutilizada) y
  estimar `progress.spec.ts` (1) = 2 × derrota + carga + export/import. Si la estimación pasa de 240 s, **parar y
  consultar al usuario** (no se cambia la semilla 42 de la spec ni se añade atajo de test: design §Tests). Anotar
  en design §Medición. — escenario: RR "Exportar, recargar e importar en el navegador"

## 1. Dominio
- [x] 1.1 `domain/progress/Progress.ts` (`Records`, `HistoryEntry`, `Progress`, `EMPTY_PROGRESS`,
  `HISTORY_LIMIT`) + `progress/history.ts` (`compareEntries`, `normalizeHistory`) + `shared/Clock.ts` (solo la
  interfaz) + `survivedSeconds` en `shared/Tick.ts`, y `resultsText.survivedClock` pasa a usarla (los tests de 0006
  siguen verdes). Rojo: `tests/domain/progress.test.ts` (vacío; `playedAt` 1.000/3.000/2.000 ⇒ 3.000/2.000/1.000;
  duplicados de 6 campos dentro de un documento ⇒ uno; 6 campos distintos solo en `kills` ⇒ dos; `survivedSeconds`
  59/60/1.259 ⇒ 0/1/20). — escenarios: PP "Progreso vacío", "Orden del historial"
- [x] 1.2 `progress/recordEntry.ts`. Rojo: en `progress.test.ts`, récords (300, 8, 120) + (250 s, 10, 90) ⇒
  (300, 10, 120); victoria tick 36.000 ⇒ (600, 18, 2150); 10 entradas `playedAt` 1–10 + 11 ⇒ 11…2 y récords que no
  bajan. — escenarios: PP "Récords independientes", "Victoria", "Historial lleno"
- [x] 1.3 `progress/mergeProgress.ts`. Rojo: `tests/domain/merge-progress.test.ts`: máximos (300, 8, 120) ∪
  (250, 10, 90) ⇒ (300, 10, 120); impares 1–19 ∪ pares 2–20 ⇒ 20…11; `merge(A, B)` = `merge(B, A)` con `playedAt`
  empatado; `merge(P, P)` = P y `merge(merge(P, F), F)` = `merge(P, F)`; propiedades sobre 200 pares generados con
  `Mulberry32` de semilla fija (conmutativa, idempotente, ≤ 10 entradas, orden descendente). — escenarios: PP
  "Récords máximos", "Importar dos veces el mismo fichero", "Duplicado solo si coinciden todos los campos",
  "Historial recortado al fusionar", "Fusión conmutativa con fechas empatadas"

## 2. Aplicación
- [x] 2.1 Puerto `application/ProgressRepository.ts` (+ tipos de error), `ProgressSession`, `LoadProgress`, fake
  `tests/support/InMemoryProgressRepository.ts` (cuenta escrituras y permite programar errores) y contrato
  `tests/support/progressRepositoryContract.ts` ejecutado contra el fake. Rojo: `tests/application/load-progress
  .test.ts` (nada ⇒ vacío sin `issue`; válido ⇒ ese progreso; `corrupt` ⇒ vacío, `issue 'corrupt'`, 0 escrituras;
  `unavailable` ⇒ vacío, `persistent false`) y el contrato (vacío ⇒ `ok(null)`, `save`+`load`, sobrescritura). —
  escenarios: PP "Progreso vacío", "Datos guardados dañados", "Versión futura guardada" (parte de aplicación)
- [x] 2.2 `RecordRun` con `FinishedRunSource` + `tests/support/FixedClock.ts` + doble de partida terminada por
  *spread* de snapshot. Rojo: `tests/application/record-run.test.ts`: derrota tick 1.259, nivel 3, 41 bajas,
  semilla 42, reloj 1.763.596.800.000 ⇒ entrada y récords de la spec; 300 llamadas ⇒ 1 escritura; `running` y
  `choosing` ⇒ `not-over` sin escribir; 3 partidas reales encadenadas con `RestartRun` ⇒ 3 entradas en orden;
  `save` con `unavailable` y con `quota-exceeded` ⇒ sesión con la partida, `saved false`; dos partidas en memoria
  (20, 3, 41) y (15, 5, 30) ⇒ (20, 5, 41); tras `corrupt`, `corrupt true` solo en la 1.ª y el valor se sobrescribe.
  — escenarios: PP "Primera derrota", "Un guardado por partida", "Varias partidas en la misma carga", "Partida sin
  terminar", "Primer guardado tras datos dañados", "Progreso en memoria durante la carga", "Almacenamiento lleno al
  guardar"
- [x] 2.3 `ImportProgress`. Rojo: `tests/application/import-progress.test.ts`: (300, 8, 120) + fichero
  (250, 10, 90) ⇒ sesión y guardado (300, 10, 120); dos imports de F ⇒ igual al primero; sobre sesión con
  `corruptPending` ⇒ guardado = F normalizado y aviso limpiado; `save` falla ⇒ sesión fusionada, `saved false`. —
  escenarios: PP "Récords máximos", "Importar dos veces el mismo fichero", "Import sobre datos guardados dañados"

## 3. Infraestructura y composición
- [x] 3.1 `infrastructure/progress/progressSchema.ts` + `progressCodec.ts`. Rojo: `tests/infrastructure/progress-
  codec.test.ts`: documento válido literal de la spec; límites (`seed` 0 y 4.294.967.295, `maxKills` 2⁵³ − 1, 10
  entradas); cada variante inválida de la spec (incluidos `1e400`, `null`, `[]`, texto vacío y `"note":"<script>"`
  en los 3 niveles) y `{"__proto__":…}`; `schemaVersion` 2 ⇒ `unknown-version`; ida y vuelta P ⇒ P; documento con
  10 entradas y números máximos ⇒ `encodeProgress` < 65.536 bytes. — escenarios: PP "Documento válido", "Valores en
  los límites", "Documentos inválidos", "Ida y vuelta", "Tamaño del fichero máximo"
- [x] 3.2 `LocalStorageProgressRepository` (camino feliz, clave `sprint-survivors/progress`). Rojo: el contrato de
  2.1 ejecutado contra el adaptador con un `Storage` falso en memoria (incluida "instancia nueva sobre el mismo
  almacenamiento ve lo guardado"). — escenario: PP "Recarga tras una partida"
- [x] 3.3 Fallos del adaptador. Rojo: `tests/infrastructure/local-storage-progress.test.ts`: proveedor que lanza
  `SecurityError` ⇒ `load`/`save` `unavailable` sin lanzar; `setItem` con `QuotaExceededError` ⇒ `quota-exceeded` y
  valor previo intacto; valor `{"schemaVersion":1,"records":` y versión 2 ⇒ `corrupt` y valor intacto. —
  escenarios: PP "Almacenamiento bloqueado", "Almacenamiento lleno al guardar", "Datos guardados dañados", "Versión
  futura guardada"
- [ ] 3.4 `progress/readProgressFile.ts` (`MAX_IMPORT_BYTES`) + `dom/pickedFile.ts`. Rojo: `tests/infrastructure/
  read-progress-file.test.ts` con `File`/doble de Node: 65.537 bytes ⇒ `too-large` y `text()` no llamado; 65.536
  bytes válidos + espacios ⇒ `ok`; `hola`, versión 2 y campo extra ⇒ error; `pickedFile(null)` y lista vacía ⇒
  `null`. — escenarios: PP "Fichero demasiado grande", "Fichero en el límite", "Fichero no JSON o fuera de esquema"
- [ ] 3.5 `dom/resultsPanelText.ts` (textos y `resultsPanelView`, `PROGRESS_CORRUPT_WARNING`). Rojo: `tests/
  infrastructure/results-panel-text.test.ts`: récords (20, 3, 41) ⇒ `Mejor tiempo 00:20`, `Mejor nivel 3`,
  `Máx. bajas 41`; (300, 10, 120) ⇒ `05:00`; (250, 10, 90) ⇒ `04:10`; textos contienen `importado`, `64 KiB`,
  `no válido`, `no se guarda`, `dañados`; el aviso de consola contiene `progress`. — escenarios: RR "Récords en la
  primera partida", "Récords anteriores mejores que la partida", "Récords tras importar"
- [ ] 3.6 `progress/ResultsProgress.ts` (presentador). Rojo: `tests/infrastructure/results-progress.test.ts`:
  `running`/`choosing` ⇒ `null`; `over` ⇒ vista con récords y 300 `sync` ⇒ 1 escritura; `sync` en `over` seguido de
  `RestartRun` ⇒ guardado hecho antes del tick 1 de la nueva; import válido ⇒ récords fusionados + `importado`;
  65.537 bytes / `hola` ⇒ mensaje y progreso y guardado sin cambios; mensaje de rechazo no aparece en la vista de la
  partida siguiente; `saved false` ⇒ `no se guarda`; `corrupt` ⇒ `dañados` solo en la 1.ª; `exportText()` decodifica
  igual al progreso en uso. — escenarios: PP "Un guardado por partida", "Reinicio inmediato", "Exportar tras una
  partida", "Fichero demasiado grande", "Fichero no JSON o fuera de esquema"; RR "Sin overlay durante la partida",
  "Mensajes que no se arrastran", "Aviso sin persistencia", "Aviso de datos dañados solo en la primera partida",
  "Récords tras importar"
- [ ] 3.7 Cableado en el navegador (agrupado: nada de esto pone un test unitario en rojo): `SystemClock`,
  `dom/ResultsPanel.ts` (`textContent`, `hidden`, `blur()`, `pickedFile`), `dom/downloadProgress.ts`, parámetro
  `SceneProgress` en `GameScene` (`progress.sync` en `render`), `src/styles.css` (estilos movidos de `index.html` +
  panel) enlazado con `<link>`, `main.ts` (`LoadProgress`, `console.warn` único si `corrupt`, casos de uso,
  `seedOf`, probe `progress`) y `tests/e2e/probe.ts` con `progress`. Rojo: `smoke.spec.ts` amplía: `probe.progress`
  no nulo con récords a 0 y botones `Exportar`/`Importar` no visibles durante la partida. Comprobar a mano una
  derrota con `npm run build && npm run preview`. — escenario: RR "Sin overlay durante la partida"
- [ ] 3.8 CSP: `<meta http-equiv="Content-Security-Policy">` en `index.html` (política de design §CSP),
  `config/csp.ts` (`relaxCspForDev`, `devCsp` con `apply: 'serve'`), registro en `vite.config.ts` y `config` en
  `tsconfig.json`. Rojo: `tests/guardrails/csp.test.ts` (una sola meta, primera tras `charset`, `default-src 'self'`,
  `object-src 'none'`, sin `'unsafe-eval'`, sin `'unsafe-inline'` en `script-src`/`default-src`, sin `http:`/
  `https:`/`*`; `relaxCspForDev` solo cambia `style-src` y `connect-src`) y `smoke.spec.ts` con `addInitScript` que
  recoge `securitypolicyviolation` ⇒ lista vacía y 1 meta en la página servida. — escenarios: PP "CSP presente y
  restrictiva", "Sin violaciones en el bucle completo" (carga)

## 4. E2E y documentación
- [ ] 4.1 `tests/e2e/progress.spec.ts` (3), carga sin jugar: valor truncado y, en otro test, `schemaVersion` 2
  sembrados con `addInitScript` ⇒ exactamente 1 `console.warn` con `progress` y valor intacto tras 2 s de partida;
  recargar a mitad de partida sin progreso previo ⇒ almacenamiento sigue vacío. — escenarios: PP "Datos guardados
  dañados", "Versión futura guardada", "Partida sin terminar"
- [ ] 4.2 `progress.spec.ts` (1), bucle completo `?seed=42` con `test.setTimeout` de la tarea 0.2: perder →
  Exportar (`suggestedFilename` `sprint-survivors-progress.json`, 1 entrada `seed 42`, `defeat`) → 60 frames con
  snapshot igual → borrar almacenamiento → recargar → perder → importar ⇒ `importado`, récords = máximo, nuevo
  export con 2 entradas → `hola` ⇒ `no válido` y 65.537 bytes ⇒ `64 KiB`, récords y export sin cambios → R ⇒ 1
  partida nueva en curso → 0 `securitypolicyviolation` y 0 errores/avisos de consola. — escenarios: RR "Exportar,
  recargar e importar en el navegador", "Imports rechazados en el navegador", "Exportar no cambia la partida", "R
  tras usar los botones"; PP "Exportar tras una partida", "Sin violaciones en el bucle completo", "CSP presente y
  restrictiva"
- [ ] 4.3 `progress.spec.ts` (2), almacenamiento bloqueado: `addInitScript` con getter de `localStorage` que lanza
  `SecurityError`, semilla `F` de 0.1 ⇒ overlay con `no se guarda`, récords y botones → R ⇒ `running`, sin errores de
  consola. — escenarios: PP "Almacenamiento bloqueado"; RR "Aviso sin persistencia"
- [ ] 4.4 `results.spec.ts`: nada más observar `over`, pulsar R y comprobar que el valor guardado ya tiene 1 entrada
  con el tick de la derrota; el resto del test no cambia. — escenarios: PP "Reinicio inmediato"; RR "Derrota y
  reinicio en el navegador"
- [ ] 4.5 Cierre: comprobación manual de `npm run dev` (carga, una edición de `styles.css` por HMR, consola sin
  violaciones de CSP) anotada en `docs/ai-log/`; tiempos reales de los E2E en design §Medición; AGENTS.md §1
  (estado: 0001–0007, guardado local + export/import); `npm run verify` y `npm run test:e2e` en verde. — escenario:
  PP "Política de seguridad de contenido" (dev, fuera de spec)
