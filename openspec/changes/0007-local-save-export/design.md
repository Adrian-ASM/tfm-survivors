# Design · 0007-local-save-export

## Resumen
El dominio gana un VO `Progress` (récords + historial canónico) con dos funciones puras, `recordEntry` y
`mergeProgress`; la fusión es conmutativa e idempotente porque el historial se normaliza con un orden total sobre
los 6 campos (ADR-0010). La aplicación añade el puerto síncrono `ProgressRepository`, el puerto `Clock` (reloj de
pared) y tres casos de uso: `LoadProgress`, `RecordRun` (idempotente por partida) e `ImportProgress`, que comparten
un `ProgressSession` en memoria: si el almacenamiento falla, el progreso sigue vivo en la sesión y solo se marca
"no se guarda". Infraestructura pone el codec zod del documento v1, el adaptador `LocalStorageProgressRepository`,
la lectura acotada del fichero y un panel DOM sobre el canvas (récords, Exportar, Importar, mensajes). La CSP va por
`<meta>` en `index.html` con la política estricta de producción; un plugin de Vite solo para `serve` la relaja en
desarrollo. La simulación no cambia.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `progress/Progress.ts`: tipos `Records` (`bestTimeSeconds`, `bestLevel`, `maxKills`), `HistoryEntry` (`playedAt`, `seed`, `outcome: RunOutcome`, `timeSeconds`, `level`, `kills`) y `Progress` (`records`, `history`); `EMPTY_PROGRESS` congelado; `HISTORY_LIMIT = 10` | Nueva | Inmutable (`readonly`, objetos congelados al crear). Sin `schemaVersion` ni `victory`/`defeat`: eso es formato (ADR-0010). Récords independientes del historial: nunca se recalculan desde él (spec, "Historial lleno"). |
| domain | `progress/history.ts`: `compareEntries(a, b)` (orden total: `playedAt` desc, después `seed`, `timeSeconds`, `level`, `kills` asc y `outcome`), `normalizeHistory(entries)` (ordena, quita adyacentes con `compare === 0`, recorta a `HISTORY_LIMIT`) | Nueva | `compare === 0` ⟺ 6 campos iguales: duplicado de la spec. El desempate fijo hace que entradas con igual `playedAt` salgan en el mismo orden sea cual sea el operando (spec, "Fusión conmutativa con fechas empatadas"). |
| domain | `progress/recordEntry.ts`: `recordEntry(p, entry)` y `progress/mergeProgress.ts`: `mergeProgress(a, b)` | Nueva | `recordEntry` = máximo de cada récord con la entrada + `normalizeHistory([entry, ...history])`. `mergeProgress` = máximo campo a campo de récords + `normalizeHistory([...a.history, ...b.history])`. Puras; sin asignaciones fuera de la llamada. |
| domain | `shared/Tick.ts`: `survivedSeconds(tick) = ⌊tick / TICKS_PER_SECOND⌋` | Nueva | Una sola regla para `timeSeconds` (spec progress-persistence) y para "Tiempo sobrevivido" (run-results). `resultsText.survivedClock` pasa a usarla. |
| domain | `shared/Clock.ts`: `interface Clock { nowMs(): number }` | Nueva | Reloj de **pared** (ms desde epoch, entero). No es el tiempo de simulación: el bucle sigue recibiendo deltas del motor. Dos implementaciones: `SystemClock` (infra) y `FixedClock` (tests). Mismo sitio que `RandomGenerator` (AGENTS.md §3.3). |
| application | `ProgressRepository.ts` (puerto): `load(): Result<Progress \| null, ProgressLoadError>`, `save(p): Result<void, ProgressSaveError>`; `ProgressLoadError = { code: 'unavailable' } \| { code: 'corrupt'; reason: string }`, `ProgressSaveError = { code: 'unavailable' \| 'quota-exceeded' }` | Nueva | Síncrono (ADR-0010). `null` = nada guardado. Implementaciones: `LocalStorageProgressRepository` y el fake `InMemoryProgressRepository` (tests); la tercera previsible es Supabase (ADR-0004). |
| application | `ProgressSession.ts`: `progress: Progress`, `persistent: boolean` (resultado del último intento de guardar), `corruptPending: boolean` | Nueva | Estado de la carga compartido por los casos de uso. No es puerto: un único objeto mutable creado por `LoadProgress`. |
| application | `LoadProgress`: `execute(): ProgressSession` + `issue: 'corrupt' \| 'unavailable' \| null` | Nueva | `ok(null)` ⇒ vacío sin aviso. `corrupt` ⇒ vacío, `corruptPending = true`, **no escribe nada** (spec, "Datos guardados dañados"). `unavailable` ⇒ vacío y `persistent = false`. |
| application | `RecordRun`: `constructor(session, repository, clock, seedOf: () => number)`, `execute(run: FinishedRunSource): Result<RecordedRun, RecordRunError>`; `FinishedRunSource = Pick<TickRun, 'status' \| 'snapshot'>`; `RecordedRun = { progress, saved, corrupt }`; `RecordRunError = { code: 'not-over' \| 'already-recorded' }` | Nueva | `TickRun` cumple `FinishedRunSource` sin cambios; los tests pasan un doble con un snapshot construido por *spread* (patrón de `results-overlay.test.ts`), porque una `Run` real no se puede llevar a "tick 1.259, nivel 3, 41 bajas". Comprueba `status` antes de pedir el snapshot y lee `snapshot()` una sola vez por partida (no muta la `Run`). Guarda la referencia del último origen registrado: la 2.ª llamada sobre la misma partida devuelve `already-recorded` sin escribir (spec, "Un guardado por partida": 300 frames ⇒ 1 escritura). Actualiza `session.progress` **siempre** y `persistent` según `save` (spec, "Progreso en memoria durante la carga", "Almacenamiento lleno"). `corrupt` es `corruptPending` antes de limpiarlo: solo la primera partida lo ve. `seedOf` es una función (precedente `nextRandom` de `RestartRun`), no un puerto. |
| application | `ImportProgress`: `execute(imported: Progress): { progress, saved }` | Nueva | Recibe un `Progress` ya validado: un fichero rechazado **nunca llega aquí**, así que "sin modificar lo guardado" se cumple por construcción. Fusiona, actualiza la sesión, guarda (sobrescribe datos dañados) y limpia `corruptPending`. |
| infrastructure | `progress/progressSchema.ts`: `ProgressDocumentSchema` (zod 4) | Nueva | `z.strictObject` en raíz, `records` y entradas; `z.literal(1)`; `z.int().min(0).max(Number.MAX_SAFE_INTEGER)`; `seed` ≤ 4.294.967.295; `level` ≥ 1; `z.enum(['victory','defeat'])`; `history.max(HISTORY_LIMIT)`. `Infinity` (de `1e400`) y decimales los rechaza `z.int()`. Un `"__proto__"` propio de `JSON.parse` es clave extra ⇒ rechazo. |
| infrastructure | `progress/progressCodec.ts`: `encodeProgress(p): string`, `decodeProgress(text): Result<Progress, ProgressDecodeError>` (`'not-json' \| 'invalid' \| 'unknown-version'`) | Nueva | Única traducción documento v1 ⇄ `Progress` (`won`⇄`victory`, `lost`⇄`defeat`) y `normalizeHistory` al decodificar. `JSON.stringify(doc, null, 2)` con claves en orden fijo, para export y almacenamiento. `unknown-version` se detecta leyendo solo `schemaVersion` antes del esquema completo (para el aviso de consola). |
| infrastructure | `progress/LocalStorageProgressRepository.ts`: `constructor(storage: () => Pick<Storage, 'getItem' \| 'setItem'>, key = PROGRESS_STORAGE_KEY)` | Nueva | `storage` es una función porque **acceder** a `window.localStorage` ya puede lanzar `SecurityError`. Todo en `try`: excepción al leer/escribir ⇒ `unavailable`; `DOMException` `QuotaExceededError` al escribir ⇒ `quota-exceeded`; decodificación fallida ⇒ `corrupt` (sin tocar el valor). Clave `sprint-survivors/progress` (ADR-0010: origen compartido en Pages). |
| infrastructure | `progress/readProgressFile.ts`: `MAX_IMPORT_BYTES = 65_536`, `readProgressFile(file: Pick<Blob, 'size' \| 'text'>): Promise<Result<Progress, ImportFileError>>` | Nueva | `file.size > MAX_IMPORT_BYTES` ⇒ `too-large` **sin llamar a `text()`** (spec, "Fichero demasiado grande"). Si no, `decodeProgress(await file.text())`. 65.536 bytes válidos + espacios se aceptan (`JSON.parse` admite espacios finales). |
| infrastructure | `progress/ResultsProgress.ts` (presentador, sin DOM): `sync(snapshot, run): ResultsPanelView \| null`, `importFile(file): Promise<ResultsPanelView>`, `exportText(): string`, getter `view` | Nueva | Orquesta `RecordRun`/`ImportProgress` y los mensajes. En `over` llama a `RecordRun.execute` (idempotente) y, si es una partida nueva, borra el mensaje de import anterior (run-results, "Mensajes que no se arrastran"). Fuera de `over` devuelve `null`. Probable en Node con `File` nativo. |
| infrastructure | `dom/resultsPanelText.ts` (puro): textos (`importado`, `64 KiB`, `no válido`, `no se guarda`, `dañados`) y `resultsPanelView(progress, flags, message)`; `Mejor tiempo` con `formatClock(bestTimeSeconds)` | Nueva | Una sola fuente de los textos que comprueban specs y E2E. |
| infrastructure | `dom/ResultsPanel.ts` (DOM fino): `<section>` con 3 líneas de récords, avisos, mensaje (`role="status"`), botones `Exportar`/`Importar` y `<input type="file" accept=".json,application/json" hidden>` | Nueva | Se crea una vez. `render(view \| null)` solo toca el DOM si la vista cambió (`hidden` para ocultar). Solo `textContent`, nunca `innerHTML`. Tras pulsar un botón hace `blur()` para que R vuelva al juego. Cancelar el selector (`files.length === 0`) no hace nada. Cubierto por E2E. |
| infrastructure | `dom/downloadProgress.ts`: `downloadProgress(text, fileName = 'sprint-survivors-progress.json')` | Nueva | `Blob` `application/json` → `URL.createObjectURL` → `<a download>` → `click()` → `revokeObjectURL`. Sin red. |
| infrastructure | `time/SystemClock.ts`: `nowMs() = Date.now()` | Nueva | Único `Date.now` del juego, fuera del núcleo. |
| infrastructure | `phaser/GameScene.ts` | Mod. | Nuevo parámetro `progress: SceneProgress` (`{ sync(snapshot, run): void }`, definida en la escena). En `render`, tras `results.sync`, llama a `progress.sync(snapshot, started.tickRun)`. Nada más: ni reglas ni detección de flancos en la escena. |
| infrastructure | `phaser/resultsText.ts` | Mod. | `survivedClock` usa `survivedSeconds` del dominio. `ResultsView` no cambia. |
| infrastructure | `index.html` + `src/styles.css` | Mod. / Nueva | `<meta http-equiv="Content-Security-Policy">` como **primer** hijo de `<head>` tras `charset`. El `<style>` inline pasa a `src/styles.css` enlazado con `<link rel="stylesheet">` (Vite lo empaqueta en build), para no necesitar `'unsafe-inline'`. Estilos del panel (superpuesto al canvas con `grid-area: 1 / 1`). |
| infrastructure | `dom/pickedFile.ts` (puro): `pickedFile(files: { length: number; item(i): File \| null } \| null): File \| null` | Nueva | Selector cancelado o vacío ⇒ `null` ⇒ ni import ni mensaje (spec, "Si se cancela el selector…"). Se prueba sin DOM. |
| composition | `main.ts` (+ `progressWiring.ts` si pasa de ~140 líneas) | Mod. | Crea `SystemClock`, `LocalStorageProgressRepository(() => window.localStorage)`, `LoadProgress` (si `issue === 'corrupt'`: **1** `console.warn` con el texto `PROGRESS_CORRUPT_WARNING` de `resultsPanelText`, que contiene `progress`; `unavailable` no avisa por consola), `RecordRun` con `seedOf = () => seeds.current`, `ImportProgress`, `ResultsProgress` y `ResultsPanel` (botones → `downloadProgress(exportText())` / `importFile(file)` → `panel.render`). Pasa el `SceneProgress` a la escena. Probe `?e2e`: añade `progress: { records, history, message, notices } \| null`. |
| config | `config/csp.ts`: `relaxCspForDev(html): string` y `devCsp(): Plugin` (`apply: 'serve'`, `transformIndexHtml`) | Nueva | `vite.config.ts` lo registra. `tsconfig.json` añade `config` a `include`. Ver "CSP". |

**Panel DOM y no textos de Phaser para los récords.** Los botones y el selector de fichero exigen DOM, y el import
es asíncrono: actualizar récords y mensajes desde una promesa en objetos de Phaser obligaría a la escena a sondear
estado. Con todo en un panel, la escena solo hace `progress.sync` y el overlay Phaser de 0006 no cambia.

**Sin `InMemoryProgressRepository` en `src/`.** La degradación vive en `ProgressSession` (el progreso sigue en
memoria aunque `save` falle), así que el repositorio en memoria solo hace falta como fake de tests
(`tests/support/`). Evita una tercera implementación sin uso en producción.

**Datos dañados: sin copia de seguridad.** Se ignoran, se avisa y se sobrescriben en el siguiente guardado (fin de
partida o import válido), como fija la spec. Una copia aparte no se podría importar (no pasa el esquema) y añadiría
una segunda clave que limpiar.

## Flujo

**Frame de la escena en el que termina la partida** (lo nuevo en negrita):
1. `restart.read()` (la partida aún está en curso ⇒ `not-over`, como hoy).
2. `tickRun.execute(deltaMs, input)` ⇒ snapshot `over`.
3. `render(snapshot)`: capas, HUD, overlay de Phaser y **`progress.sync(snapshot, tickRun)`**:
   **`RecordRun.execute(tickRun)` ⇒ `recordEntry` ⇒ `repository.save` (síncrono) ⇒ `ResultsPanel.render(view)`**.
4. Frames siguientes en `over`: `RecordRun` devuelve `already-recorded` (O(1), sin escribir); el panel no se toca.
5. R en el frame siguiente ⇒ `RestartRun` ⇒ el primer `render` de la partida nueva da `sync(...) ⇒ null` ⇒ panel
   oculto. El guardado ya está hecho antes de que la partida nueva ejecute su tick 1 (spec, "Reinicio inmediato").

**Import** (fuera del frame, al elegir fichero): `ResultsPanel` (change del `input`) → `ResultsProgress.importFile`
→ `readProgressFile` (tamaño ⇒ `text()` ⇒ `decodeProgress`) → si `ok`: `ImportProgress.execute` ⇒ `mergeProgress`
⇒ `save`; si `err`: mensaje `64 KiB` o `no válido` y **nada más** → `panel.render(view)`. La escena y la `Run` no
intervienen: el snapshot terminado no cambia (run-results, "Exportar no cambia la partida").

**Export**: `ResultsProgress.exportText()` = `encodeProgress(session.progress)` → `downloadProgress`. Solo lectura.

**Carga**: `LoadProgress` antes de crear el `Phaser.Game`; un fallo de almacenamiento nunca lanza (todo `Result`).

## CSP

**Política de producción** (literal en `index.html`):
```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self';
object-src 'none'; base-uri 'none'; form-action 'none'
```
- `img-src data:`: Phaser crea sus texturas por defecto (`__DEFAULT`, `__MISSING`, `__WHITE`) desde PNG en `data:`
  (comprobado en `node_modules/phaser/dist/phaser.esm.js`, `Config`). Sin él, la escena arranca con texturas rotas.
- **Sin `blob:`**: Phaser solo usa `URL.createObjectURL` en su Loader (no cargamos ficheros) y en vídeo. La descarga
  del export es una navegación de `<a download>` a `blob:`, que ninguna directiva de la meta restringe.
- **WebGL** no está sujeto a CSP (shaders compilados por la API, no `eval`). El `new Function` del runtime de webpack
  de Phaser solo se alcanza si no existe `globalThis`: no ocurre en navegadores soportados, así que no hace falta
  `'unsafe-eval'`.
- Phaser asigna estilos por CSSOM (`el.style.x = …`, `cssText`), que `style-src` no bloquea; el único
  `setAttribute('style')` es para iOS (`GetInnerHeight`). El panel usa clases de `styles.css` y el atributo `hidden`.
- Fuera de la meta: `frame-ancestors`, `report-uri` y `sandbox` se ignoran en `<meta>` y Chrome **lo avisa por
  consola**, lo que rompería los E2E (`collect(['error','warning'])`). No se incluyen.

**Desarrollo (Vite dev/HMR).** En `serve` Vite inyecta el CSS importado y su overlay de errores con `<style>` y el
HMR abre un WebSocket. `devCsp()` (solo `apply: 'serve'`) reescribe la meta con `relaxCspForDev`: añade
`'unsafe-inline'` a `style-src` y `ws: wss:` a `connect-src`; `script-src` no cambia (el cliente de Vite es un script
externo de `'self'`). La build nunca pasa por el plugin, así que `dist/index.html` lleva exactamente la política
estricta y una sola meta.

**Cómo se prueba:**
- Unitario (`tests/guardrails/csp.test.ts`, en `verify`): lee `index.html` y comprueba una sola meta, primera en
  `<head>`, con `default-src 'self'` y `object-src 'none'`, sin `'unsafe-eval'`, sin `'unsafe-inline'` en
  `script-src`/`default-src`, sin `http:`/`https:`/`*`; y que `relaxCspForDev` solo toca `style-src` y
  `connect-src`.
- E2E sobre la build (`vite preview`): un `addInitScript` registra los eventos `securitypolicyviolation` en una lista;
  el smoke y el E2E de export/import exigen lista vacía y ninguna consola con `Content Security Policy`. Además,
  `collect(['error','warning'])` de los E2E existentes ya falla ante cualquier violación.
- Manual (una vez, anotado en tasks): `npm run dev`, cargar, editar `styles.css` (HMR) y comprobar consola limpia.

## Tests
- **Dominio**: `progress.test.ts` (vacío, orden, `recordEntry`, récords independientes, historial lleno, victoria),
  `merge-progress.test.ts` (máximos, duplicados de 6 campos, recorte 20 ⇒ 10, conmutatividad e idempotencia por
  propiedades: 200 pares de progresos generados con `Mulberry32` de semilla fija, incluidos empates de `playedAt`).
- **Application**: `record-run.test.ts` con `InMemoryProgressRepository` contador de escrituras y `FixedClock`
  (300 llamadas ⇒ 1 escritura; `not-over` en `running`/`choosing`; 3 partidas con `RestartRun` ⇒ 3 entradas en
  orden; `save` en error ⇒ sesión actualizada y `saved: false`; aviso `corrupt` solo en la 1.ª);
  `import-progress.test.ts`; `load-progress.test.ts` (corrupto no escribe).
- **Contrato** `tests/support/progressRepositoryContract.ts` (patrón de `randomContract.ts`): vacío ⇒ `ok(null)`;
  `save` + `load` ⇒ igual campo a campo; segundo `save` sobrescribe; instancia nueva sobre el mismo almacenamiento ve
  lo guardado. Se ejecuta contra el fake y contra `LocalStorageProgressRepository` con un `Storage` falso en memoria
  (Vitest corre en `node`, sin jsdom; no se usa el `localStorage` experimental de Node).
- **Infra**: `progress-codec.test.ts` (todos los válidos/inválidos de la spec, `1e400`, `__proto__`, ida y vuelta,
  tamaño máximo < 65.536 bytes), `local-storage-progress.test.ts` (`SecurityError` al acceder, al leer y al escribir,
  `QuotaExceededError`, valor dañado intacto), `read-progress-file.test.ts` (65.537 sin llamar a `text()`, 65.536
  válido), `results-progress.test.ts` (mensajes, limpieza entre partidas), `results-panel-text.test.ts`.
- **E2E**:
  - `tests/e2e/progress.spec.ts` (1), bucle completo con `?seed=42`: perder → Exportar (nombre y contenido) → 60
    frames con el snapshot igual → borrar almacenamiento → recargar → perder → importar el exportado (récords =
    máximo, `importado`, nuevo export con 2 entradas) → `hola` y 65.537 bytes rechazados (`no válido`, `64 KiB`,
    export igual) → R crea 1 partida nueva → sin `securitypolicyviolation` y meta CSP única en la página servida.
  - `progress.spec.ts` (2), almacenamiento bloqueado: `addInitScript` hace que el getter de `localStorage` lance
    `SecurityError` → perder con la semilla rápida de la tarea 0 → aviso `no se guarda`, récords, botones → R ⇒
    `running` y sin errores de consola.
  - `progress.spec.ts` (3), carga sin jugar (barata): valor truncado y, por separado, `schemaVersion` 2 sembrados con
    `addInitScript` ⇒ exactamente 1 `console.warn` con `progress` y el valor guardado intacto tras 2 s de partida;
    después, recargar a mitad de partida no escribe nada ("Partida sin terminar").
  - `results.spec.ts` (existente) añade: justo después de pulsar R, el valor guardado ya tiene 1 entrada
    ("Reinicio inmediato" en el navegador).
- **Atajo de test: no.** Un "terminar ya" solo para E2E sería una entrada nueva al núcleo que la proposal deja
  fuera (la simulación no cambia) y probaría otro camino que el del jugador. Coste asumido: (1) ≈ 2 × 78 s de juego
  + carga ≈ 180 s (`test.setTimeout(260_000)`); (2) con la semilla rápida; (3) < 10 s. Si la tarea 0 da un coste de
  (1) mayor de 240 s, se vuelve al usuario antes de seguir (no se cambia la semilla de la spec por cuenta propia).

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. zod 4.6.7 (ya instalado) valida; `Blob`, `URL`, `File` y `localStorage` son del navegador; Node 22 trae `File`/`Blob` para los tests. | `idb-keyval` / IndexedDB: innecesario para ~3 KB; jsdom para tests: el `Storage` falso inyectado basta. |

## Rendimiento y seguridad
- **Presupuesto por tick**: sin cambios (media ≤ 2 ms/tick con 200 vivos). Nada nuevo corre por tick. Por frame en
  `over`: una comparación de referencia en `RecordRun`. Una vez por partida: `snapshot` + `recordEntry` + `encode` +
  `setItem` de ~3 KB, < 1 ms (camino frío, fuera del bucle de simulación).
- **Objetos**: 0 objetos del motor nuevos; el panel DOM (≈ 10 nodos) se crea una vez en la composición.
- **Bundle**: +3–5 KB sin comprimir (sin dependencias).
- **Datos persistidos**: una clave `sprint-survivors/progress` en `localStorage`, documento v1 de ≤ ~3 KB (10
  entradas con números máximos). Sin datos personales: fecha, semilla y estadísticas de partida.
- **Entradas externas**:
  - Valor guardado y fichero importado pasan por `decodeProgress` (zod estricto, versión exacta, sin migración).
  - Fichero: tamaño comprobado con `file.size` **antes** de leerlo; nunca se interpreta como HTML ni código (solo
    `textContent`).
  - La semilla importada solo se guarda y exporta; no llega a `Mulberry32RandomGenerator` (spec).
  - `localStorage` del origen `*.github.io` es compartido con otros repos del usuario: clave con espacio de nombres y
    validación en cada lectura (otro proyecto podría escribirla).
- **CSP** por `<meta>` (sección CSP): cierra scripts externos, `eval`, plugins y `<base>` inyectado.

## ADRs
- `docs/adr/0010-formato-y-fusion-del-progreso.md`: documento v1 propio de infraestructura, forma canónica del
  historial con orden total sobre 6 campos, fusión conmutativa/idempotente y puerto síncrono.
- ADR-0004 no cambia (este change implementa su fase 1); la CSP de dev es reversible y no merece ADR.

## Cobertura de las specs delta
Contraste final (2026-11-20) contra las specs definitivas: 10 requisitos / 34 escenarios de `progress-persistence`
y 1 añadido + 2 modificados (13 escenarios) de `run-results`. La columna Tarea remite a `tasks.md`.

| Spec · Escenario | Pieza | Test | Tarea |
|---|---|---|---|
| PP · Progreso vacío | `EMPTY_PROGRESS`, `LoadProgress` | `progress.test.ts`, `load-progress.test.ts` | 1.1, 2.1 |
| PP · Orden del historial | `normalizeHistory` | `progress.test.ts` | 1.1 |
| PP · Primera derrota | `RecordRun` + `recordEntry` + `survivedSeconds` + `FixedClock` | `record-run.test.ts` | 1.2, 2.2 |
| PP · Récords independientes / Victoria / Historial lleno | `recordEntry` | `progress.test.ts` | 1.2 |
| PP · Un guardado por partida | `RecordRun` (`already-recorded`) vía `ResultsProgress.sync` | `record-run.test.ts`, `results-progress.test.ts` | 2.2, 3.6 |
| PP · Reinicio inmediato | `progress.sync` dentro de `render` del frame del fin | `results-progress.test.ts` (sync ⇒ `RestartRun`), `results.spec.ts` | 3.6, 4.4 |
| PP · Varias partidas en la misma carga | `RecordRun` + `RestartRun` | `record-run.test.ts` | 2.2 |
| PP · Partida sin terminar | `RecordRun` `not-over` | `record-run.test.ts`, `progress.spec.ts` (3) | 2.2, 4.1 |
| PP · Recarga tras una partida | `LocalStorageProgressRepository` | contrato (instancia nueva, mismo almacenamiento) | 3.2 |
| PP · Datos guardados dañados / Versión futura | `decodeProgress`, `LoadProgress`, warn en composición | `load-progress.test.ts`, `local-storage-progress.test.ts`, `progress.spec.ts` (3) | 2.1, 3.3, 4.1 |
| PP · Primer guardado tras datos dañados | `RecordRun` sobrescribe | `record-run.test.ts` | 2.2 |
| PP · Documento válido / Límites / Inválidos | `ProgressDocumentSchema` + `decodeProgress` | `progress-codec.test.ts` | 3.1 |
| PP · Exportar tras una partida | `exportText` + `downloadProgress` | `results-progress.test.ts`, `progress.spec.ts` (1) | 3.6, 4.2 |
| PP · Ida y vuelta / Tamaño máximo | `encodeProgress`/`decodeProgress`, `readProgressFile` | `progress-codec.test.ts`, `read-progress-file.test.ts` | 3.1, 3.4 |
| PP · Récords máximos / Dos veces / Duplicado 6 campos / Recorte / Conmutativa | `mergeProgress` + `ImportProgress` | `merge-progress.test.ts`, `import-progress.test.ts` | 1.3, 2.3 |
| PP · Import sobre datos dañados | `ImportProgress` limpia `corruptPending` y guarda | `import-progress.test.ts` | 2.3 |
| PP · Fichero demasiado grande / En el límite / No JSON o fuera de esquema | `readProgressFile`; el rechazo no llega a application | `read-progress-file.test.ts`, `results-progress.test.ts` | 3.4, 3.6 |
| PP · Almacenamiento bloqueado | adaptador `unavailable` + `ProgressSession` | `local-storage-progress.test.ts`, `progress.spec.ts` (2) | 3.3, 4.3 |
| PP · Progreso en memoria / Almacenamiento lleno | `RecordRun` actualiza sesión aunque `save` falle | `record-run.test.ts`, `local-storage-progress.test.ts` | 2.2, 3.3 |
| PP · CSP presente y restrictiva | `index.html` + `devCsp` | `csp.test.ts`, `progress.spec.ts` (1) | 3.8, 4.2 |
| PP · Sin violaciones en el bucle completo | política de la sección CSP | `progress.spec.ts` (1), `smoke.spec.ts` | 3.8, 4.2 |
| RR · Exportar no cambia la partida | export fuera del frame, sin `Run` | `progress.spec.ts` (1) | 4.2 |
| RR · R tras usar los botones | `blur()` en `ResultsPanel` | `progress.spec.ts` (1) | 4.2 |
| RR · Mensajes que no se arrastran | `ResultsProgress` limpia el mensaje por partida | `results-progress.test.ts` | 3.6 |
| RR · Derrota / Victoria / Mismo frame | `ResultsOverlay` (sin cambios) | tests existentes de 0006 | — |
| RR · Sin overlay durante la partida (ni botones) | `ResultsProgress.sync ⇒ null` | `results-progress.test.ts`, `smoke.spec.ts` | 3.6, 3.7 |
| RR · Récords en la primera partida / anteriores mejores / tras importar | `resultsPanelView` (`formatClock`) | `results-panel-text.test.ts`, `results-progress.test.ts` | 3.5, 3.6 |
| RR · Aviso sin persistencia / dañados solo en la 1.ª | `RecordedRun.saved`/`corrupt` → avisos | `results-progress.test.ts` | 3.6 |
| RR · Derrota y reinicio en el navegador | sin cambios | `results.spec.ts` | 4.4 |
| RR · Exportar, recargar e importar / Imports rechazados | panel + presentador + E2E | `progress.spec.ts` (1) | 4.2 |

Huecos encontrados en el contraste y resueltos en este design: (a) `RecordRun` no se podía probar con los valores
de la spec recibiendo un `TickRun` real ⇒ `FinishedRunSource`; (b) el `console.warn` único y "Partida sin
terminar" no tenían test ⇒ E2E (3); (c) cancelar el selector no tenía pieza probable sin DOM ⇒ `pickedFile`;
(d) "Reinicio inmediato" en el navegador ⇒ comprobación añadida a `results.spec.ts`.

## Medición
Tarea 0 de apply (antes de tocar `src/`): semilla rápida sin input, coste real de `results.spec.ts` y estimación de
`progress.spec.ts` (1). Se rellena aquí y en el diario de IA.

- **0.1** (núcleo, contenido por defecto, input (0, 0), opción 0, semillas 1–200 hasta 36.000 ticks): la semilla
  42 muere en el tick **4682** (esperado). La más rápida es la **90**, tick **4501** (≈ 75,02 s); siguientes: 122
  (4525), 143 (4540), 194 (4553). Regresión: `balance.test.ts`, semilla 90 pierde en ≤ 4.560 ticks (76 s).
- **0.2** (`npx playwright test results.spec.ts`, con build y `vite preview` nuevos): **83 s** de reloj (test
  1,3 min). Estimación de `progress.spec.ts` (1): 2 × ~80 s de derrota con carga + ~10 s de export/import ≈
  **170 s** < 240 s ⇒ se sigue con `test.setTimeout(260_000)`.
- **Tiempos reales** (tarea 4.5, `npm run test:e2e`, 7 workers, 13 tests en 4,2 min de reloj):
  `progress.spec.ts` (1) bucle completo **2,7 min** (≈ 163 s, < 240 s y dentro de `setTimeout(260_000)`); (2)
  almacenamiento bloqueado con la semilla 90 **1,3 min**; (3) carga sin jugar **3–4 s** cada uno; `results.spec.ts`
  1,3 min (sin cambios).
