# Exploración · 0007-local-save-export

Intención: guardado local + exportar/importar (GDD Must; ADR-0004 fase 1).

## Contexto actual
- No existe persistencia: `grep` de `localStorage`/`ProgressRepository` solo da docs. Los puertos actuales son
  `RandomGenerator` (`src/domain/shared`) y `Clock`/FixedStepLoop (`src/application`).
- Un solo `GameScene` (`src/infrastructure/phaser/GameScene.ts`); **no hay menú ni pausa** (GDD los lista como Must,
  pero ninguna spec los cubre). Tampoco hay botones DOM; solo overlays Phaser con teclado (R, 1-3) y clic en cartas.
- Resultado de partida ya disponible: `RunSnapshot` con `tick`, nivel, bajas, `outcome` (victoria/derrota);
  `ResultsOverlay` lo pinta (`run-results`). `main.ts` (composition) crea todo y arranca el juego; `resolveSeed` ya
  trata la URL como entrada externa.
- `index.html` **no tiene la CSP por `<meta>`** que promete ADR-0004. `zod 4.6.7` ya instalado y usado en
  `src/infrastructure/content/schemas.ts`.

## Specs afectadas
- Nueva capability sugerida: `progress-persistence` (guardado, esquema versionado, import/export).
- `run-results` (indicar récord/guardado y acciones de export/import) y `hud`/menú solo si se añade UI.
- `run-state`/`simulation-loop`: no cambian (el núcleo no se toca).

## Opciones de alcance (sin elegir)
A. **Mínimo**: puerto `ProgressRepository` + `LocalStorageProgressRepository` + fake en memoria; se guarda al terminar
   la partida un `Progress` v1 {mejor tiempo, mejor nivel, máx. bajas, partidas jugadas/ganadas}; export/import por
   atajos de teclado en el overlay de resultados. Pros: pequeño, sin menú. Contras: UX pobre, descubribilidad baja.
B. **A + historial** (últimas N partidas, p. ej. 20) y botones DOM/Phaser en el overlay de resultados (Exportar/
   Importar con `<input type=file>` oculto). Pros: demuestra versionado/migración con más datos. Contras: más UI y E2E.
C. **B + menú de inicio** con Exportar/Importar/Borrar datos. Pros: cumple "menú" del GDD y da sitio natural a los
   botones. Contras: cambia el flujo de arranque (afecta E2E y `?seed=`), mezcla dos changes.
Meta-progresión (Should): fuera; solo dejar `schemaVersion` y campos extensibles.

## Diseño de datos y robustez (a decidir en design)
- JSON `{schemaVersion, savedAt?, ...}` con zod estricto; `savedAt` exigiría `Clock` (hoy no hay reloj real fuera
  del bucle): decidir si se incluye.
- Migraciones: v1 sin migrar aún, pero estructura `migrate(vN→vN+1)` testada con un fixture de v0 inventado.
- Datos ausentes -> estado vacío; corruptos (JSON inválido/zod falla) -> no pisar silenciosamente: avisar y
  conservar copia o ignorar; import corrupto -> rechazo con mensaje, sin tocar lo guardado.
- Tamaño máximo del import (propuesta: 64 KiB, comprobar `file.size` antes de leer); límites en arrays/números.
- `localStorage` no disponible o lleno (modo privado, `SecurityError`, `QuotaExceededError`): el juego sigue y el
  repositorio devuelve `Result` con error tipado; adaptador en memoria como degradación.
- Escritura/lectura solo en infraestructura; el dominio recibe `Progress` ya validado (regla 6).

## Tests
- Contrato reutilizable (`tests/support/`, como `randomContract.ts`) ejecutado contra fake en memoria y contra
  `LocalStorage...` con `localStorage` falso/jsdom-like (comprobar entorno Vitest).
- Unitarios: esquema, migración, rechazo (corrupto, versión futura, oversize, campos extra, NaN/negativos).
- E2E Playwright: jugar hasta derrota (patrón de `results.spec.ts`), exportar (evento `download`), recargar,
  importar fichero y comprobar; fichero inválido muestra error. Ojo al plazo de ~120 s ya existente.

## Riesgos e incógnitas
- La UI de import/export no tiene hogar sin menú; el input de fichero requiere DOM fuera del canvas Phaser.
- Lecciones de 0006: evitar tareas que no pongan test en rojo (agrupar pasos); esperar a todas las specs antes de
  cerrar cobertura del design; medir antes (aquí: tamaño real del JSON exportado).
- Guardar solo en partida terminada pierde datos si se cierra la pestaña (aceptable, a confirmar).
- Semilla de la partida: ¿guardarla en el historial? (útil para reproducir; es entrada no confiable al reimportar).
- Falta la CSP de ADR-0004; con descargas por `Blob` conviene incluirla (¿en este change o aparte?).

## Preguntas para el usuario
1. ¿Alcance A, B o C? ¿El menú entra aquí o en un change aparte?
2. ¿Qué se persiste: solo récords, o también historial de partidas (cuántas)? ¿Opciones/ajustes aún no existen?
3. Import: ¿reemplaza o fusiona con lo guardado? ¿Pide confirmación?
4. ¿Se guarda la semilla y la fecha (`savedAt`, requiere `Clock`)?
5. ¿Añadimos la CSP pendiente de ADR-0004 en este change?
6. ¿Botones visibles (DOM) o atajos de teclado?
