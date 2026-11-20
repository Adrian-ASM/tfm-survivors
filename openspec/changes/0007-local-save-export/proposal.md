# Proposal · 0007-local-save-export

- **Estado**: aprobada (2026-11-20, con las 4 decisiones abiertas tal como se proponen)
- **Issue**: (opcional)
- **Rama / worktree**: `change/0007-local-save-export`

## Problema
Al cerrar o recargar la pestaña se pierde todo: el jugador no ve sus mejores marcas ni sus partidas anteriores, y
no puede llevarse sus datos a otro navegador. El GDD marca el guardado local y el exportar/importar como Must, y
ADR-0004 (fase 1, local-first) los promete junto con una CSP por `<meta>` que `index.html` aún no tiene. Hoy no
hay persistencia de ningún tipo (solo se habla de `ProgressRepository` en la documentación).

## Objetivo
Al terminar una partida (victoria o derrota) el progreso se guarda en el navegador y el overlay de resultados
muestra los récords. Desde ese overlay el jugador puede exportar su progreso a un fichero JSON e importar uno, que
se fusiona con lo guardado. Un fichero inválido o demasiado grande se rechaza con un mensaje y no toca nada. Si el
almacenamiento del navegador no está disponible, el juego se puede jugar igual y avisa de que no se guarda.

## Alcance
- **Dentro**:
  - Puerto `ProgressRepository` (cargar / guardar con `Result` y errores tipados), adaptador
    `LocalStorageProgressRepository` y fake en memoria, con un test de contrato común a ambos.
  - Modelo `Progress` versionado (`schemaVersion`) y validado con zod en cada entrada externa (lectura de
    `localStorage` e import de fichero):
    - **Récords** (mejores marcas): mejor tiempo sobrevivido, mejor nivel alcanzado y máximo de bajas en una partida.
    - **Historial** de las últimas 10 partidas, de más reciente a más antigua. Cada entrada: tiempo sobrevivido,
      nivel, bajas, resultado (victoria/derrota), semilla y fecha. La fecha la da el puerto `Clock` (nunca
      `Date.now` en `domain`/`application`).
  - Guardado automático una sola vez por partida, al terminar (victoria o derrota), antes de que se pueda reiniciar.
  - Overlay de resultados: muestra los récords y dos botones visibles, **Exportar** (descarga un `.json`) e
    **Importar** (selector de fichero), y los mensajes de éxito/error del import y el aviso de "sin persistencia".
  - Import con **fusión**: récords = máximo campo a campo entre lo guardado y lo importado; historial = unión sin
    duplicados, ordenada por fecha y recortada a las 10 más recientes. Rechazo sin modificar lo guardado si el
    fichero supera 64 KiB (64 × 1024 bytes, comprobado antes de leerlo), no es JSON, no cumple el esquema o tiene
    una `schemaVersion` desconocida.
  - Límites de validación en el esquema (tamaño de arrays, enteros no negativos, sin `NaN` ni campos extra).
  - Degradación si `localStorage` no existe o falla (`SecurityError`, `QuotaExceededError`): el juego sigue sin
    persistencia y lo indica en el overlay de resultados.
  - CSP por `<meta http-equiv="Content-Security-Policy">` en `index.html`, según ADR-0004, compatible con la build
    de producción y con la descarga del fichero exportado.
  - Tests unitarios (esquema, fusión, rechazos, contrato del repositorio) y E2E (perder, exportar, recargar,
    importar, fichero inválido).
- **Fuera**:
  - Menú de inicio y botón de borrar datos (change aparte).
  - Meta-progresión (Should del GDD): solo se deja el esquema versionado y extensible.
  - Migraciones reales entre versiones (solo existe la v1; se rechazan versiones desconocidas).
  - Guardado a mitad de partida o al cerrar la pestaña (una partida sin terminar no se guarda).
  - Ajustes/opciones del jugador (aún no existen).
  - Backend, cuentas y sincronización (fase 2, ADR-0004).
  - Cambios en la simulación: `run-state`, `simulation-loop` y el resto del núcleo de partida no cambian.

## Capacidades afectadas
- `openspec/specs/progress-persistence` (nueva): modelo `Progress`, récords, historial, guardado al terminar,
  validación, export, import con fusión, rechazos, degradación sin `localStorage` y CSP.
- `openspec/specs/run-results` (modificada): el requisito "Overlay de resultados" añade récords, botones
  Exportar/Importar, mensajes de import y aviso de sin persistencia; el bucle E2E incluye exportar/importar.

## Riesgos y dudas
- **Qué es un "duplicado" al fusionar** (abierta). Propuesta: dos entradas son la misma si coinciden en todos sus
  campos (fecha, semilla, tiempo, nivel, bajas y resultado); así importar dos veces el mismo fichero no cambia
  nada. Alternativa: identidad por (fecha, semilla). A confirmar antes de spec.
- **Precisión y formato de la fecha** (abierta): propuesta, milisegundos desde epoch (entero). Hoy `Clock` es el
  reloj del bucle; hará falta un reloj de pared detrás del puerto (lo decide design).
- **Contadores de partidas jugadas/ganadas** (abierta): no están en las decisiones; si se añaden, no se pueden
  fusionar sin duplicar. Propuesta: no incluirlos en este change.
- **Desempate del "mejor tiempo"**: una victoria siempre dura `durationSeconds`; el récord es solo el máximo del
  tiempo sobrevivido, sin distinguir resultado. Propuesta: récords independientes entre sí (pueden venir de
  partidas distintas).
- **Datos guardados corruptos** al cargar (abierta): propuesta, tratarlos como vacío, avisar y no sobrescribirlos
  hasta el siguiente guardado (o conservar una copia; lo decide design).
- **Import sin confirmación**: como fusiona y nunca empeora récords, se propone no pedir confirmación.
- **Semilla como entrada no confiable** al reimportar: solo se muestra/guarda; nunca se usa para arrancar una
  partida en este change.
- **CSP**: puede romper el servidor de desarrollo de Vite (scripts inline/HMR) o Phaser (WebGL, `blob:`); hay que
  comprobarla en la build de producción y decidir en design si se relaja en dev.
- **UI fuera del canvas**: el selector de fichero requiere DOM sobre Phaser; afecta a la E2E (plazo ~120 s ya
  ajustado por `results.spec.ts`).

## Criterio de éxito
- Todos los escenarios de `progress-persistence` y del delta de `run-results` en verde (unitarios y E2E).
- El test de contrato de `ProgressRepository` pasa contra el fake en memoria y contra el adaptador `localStorage`.
- E2E: tras perder con `?seed=42`, exportar, recargar e importar, el overlay muestra los mismos récords y el
  historial contiene la partida; un fichero inválido y otro de 65.537 bytes se rechazan y lo guardado no cambia.
- El historial nunca supera 10 entradas (también tras fusionar 10 guardadas con 10 importadas distintas).
- Con `localStorage` lanzando `SecurityError` se puede jugar una partida completa y reiniciar con R.
- `index.html` contiene la CSP y la build de producción arranca sin violaciones de CSP en la consola.
- `npm run verify` en verde; el guardarraíl no detecta usos de `localStorage`/`Date.now` fuera de infraestructura.
