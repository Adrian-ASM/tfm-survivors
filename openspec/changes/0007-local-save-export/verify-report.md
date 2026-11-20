# Verify report · 0007-local-save-export

Verificador independiente. Rama `change/0007-local-save-export` (21 commits sobre `95c3038`).

## Ejecución
- `npm run verify`: verde (lint, typecheck, guard 392 ficheros, Vitest 90 ficheros / 1045 tests).
- `npm run test:e2e`: 13 de 13 verdes en 4,1 min (bucle completo 2,7 min, almacenamiento bloqueado 1,3 min).

## Escenario → Test → Estado
Los 47 escenarios (34 de progress-persistence, 13 de run-results) tienen un test cuyo nombre incluye el escenario, salvo
el último, cubierto dentro de un test más grande. Muestreados los de mayor riesgo: los asertos son reales (valores de la
spec, conteo de escrituras, igualdad campo a campo, `securitypolicyviolation` vacío).

| Escenarios | Test | Estado |
|---|---|---|
| PP modelo, registro, fusión (vacío, orden, primera derrota, récords, victoria, historial lleno, máximos, doble import, duplicado, recorte, conmutativa, import sobre dañados) | `progress.test.ts`, `merge-progress.test.ts`, `record-run.test.ts`, `import-progress.test.ts` | OK |
| PP guardado (un guardado, reinicio inmediato, varias partidas, sin terminar, recarga, dañados, versión futura, primer guardado) | `record-run.test.ts`, `results-progress.test.ts`, `load-progress.test.ts`, contrato, `progress.spec.ts` (3), `results.spec.ts` | OK |
| PP validación y export (válido, límites, inválidos, exportar, ida y vuelta, tamaño máximo) | `progress-codec.test.ts`, `results-progress.test.ts`, `progress.spec.ts` (1) | OK |
| PP rechazo de imports (grande, límite, no JSON/esquema) | `read-progress-file.test.ts`, `results-progress.test.ts` | OK |
| PP sin almacenamiento (bloqueado, en memoria, lleno) | `local-storage-progress.test.ts`, `record-run.test.ts`, `progress.spec.ts` (2) | OK |
| PP CSP (presente y restrictiva, sin violaciones) | `csp.test.ts`, `smoke.spec.ts`, `progress.spec.ts` (1) | OK |
| RR acciones sin efecto (exportar, R tras botones, mensajes no se arrastran) | `progress.spec.ts` (1), `results-progress.test.ts` | OK |
| RR overlay (derrota, victoria, sin overlay, mismo frame, récords x3, aviso sin persistencia, dañados solo 1.ª) | `results-overlay` de 0006, `results-panel-text.test.ts`, `results-progress.test.ts`, `smoke.spec.ts` | OK |
| RR navegador (derrota y reinicio, exportar-recargar-importar) | `results.spec.ts`, `progress.spec.ts` (1) | OK |
| RR "Imports rechazados en el navegador" | `progress.spec.ts` (1), líneas 156-159 y 164-175 (no tiene test propio con el nombre) | OK (ver S3) |

Textos y claves comprobados contra la spec: `importado`, `64 KiB`, `no válido`, `no se guarda`, `dañados`, `Mejor tiempo`,
`Mejor nivel`, `Máx. bajas`, `sprint-survivors-progress.json`, `schemaVersion` 1 y `victory`/`defeat` (traducción
`won`/`lost` solo en el codec). Todo coincide.

## Arquitectura (AGENTS.md §3)
Sin hallazgos. `domain` y `application` no importan capas externas ni usan `Date.now`, `window` ni `localStorage`
(grep limpio). `Clock` está en el dominio y `SystemClock` en infraestructura. zod valida el valor guardado y el fichero
importado (`z.strictObject`, `z.int`, versión exacta). Solo `composition/` ensambla las implementaciones. El tamaño del
fichero se comprueba antes de `text()`. El panel usa solo `textContent`. `index.html` lleva una sola meta CSP idéntica
al literal del design: `default-src 'self'`, sin `unsafe-eval` ni `unsafe-inline` en `script-src`, `object-src 'none'`,
sin orígenes externos. Es coherente con ADR-0004.

## Desviaciones declaradas
1. **zod `jitless`: aceptada.** `cspSafeZod` es el primer import de `main.ts`. Los módulos ES se evalúan en orden de
   importación, así que ningún esquema (`schemas.ts`, `progressSchema.ts`, `resolveSeed.ts`, `loadRunConfig.ts`) se
   construye antes. El E2E con CSP real y 0 violaciones lo confirma. Es un orden implícito: ver W1.
2. **Menores: aceptadas.**
   - `allowImportingTsExtensions` es inocuo con `noEmit`.
   - Tratar el fallo de `file.text()` como "no válido" tiene test.
   - Revocar la URL a 1 s es razonable.
   - `place-content` y el campo `shown` del probe no afectan a la spec.
   - Ninguna está recogida en design.md (ver W2).
3. **E2E 4.1-4.4 sin rojo y 1.3 con código antes del rojo: aceptada con reserva.** Está declarado en el ai-log. En 1.3
   se apartó el fichero para ver el rojo después, y las tareas 4.x son de verificación sobre comportamiento ya cableado
   en 3.7.
4. **Heredoc en `probe.ts`: fichero íntegro.** Typecheck, lint y los 13 E2E pasan, y el fichero no tiene `\` alterados.
   El incidente no está en el ai-log (ver W3).
5. **Semilla 90 en `balance.test.ts`: aceptada.** Verifica `over` y `lost` en ≤ 4.560 ticks (medido 4.501); no es
   tautológico. Es frágil ante cambios de balance (ver S2).

## Hallazgos
**Critical: ninguno.**

**Warning**
- **W1**: el orden de import de `cspSafeZod` es la única protección contra una violación CSP. Un test unitario no lo
  detecta (Vitest no importa ese módulo). Solo el E2E lo cazaría. Falta un guardarraíl (test que compruebe que
  `main.ts` lo importa primero, o regla de lint) o un comentario en cada módulo con esquemas.
- **W2**: design.md y ADR-0004 no recogen la desviación del `jitless`. design.md §CSP sigue afirmando que no hay más
  fuente de `eval` que Phaser, y la desviación de `allowImportingTsExtensions` solo está en el ai-log. Hay que
  actualizar el design (o registrarlo) antes de archivar.
- **W3**: el uso de heredoc (AGENTS.md §8.1) no consta en `docs/ai-log/2026-11-20-0007-apply.md`. Hay que registrar el
  incidente.

**Suggestion**
- **S1**: ADR-0010 sigue con estado "propuesta" aunque ya está implementado. Pasarlo a "aceptada" al archivar.
- **S2**: la semilla 90 fijada en `balance.test.ts` caduca si cambia el balance. El test avisa, pero el E2E (2) depende
  de ella. Mantenerlo documentado.
- **S3**: dar a "Imports rechazados en el navegador" un test propio, o al menos un comentario con el nombre del
  escenario en `progress.spec.ts`, para que sea trazable.
- **S4**: `wireProgress(root, () => probe.seed)` hace que la semilla del historial dependa del objeto `probe`
  (declarado después, vía closure). Funciona, pero conviene usar una fuente de semilla propia, como dice el design
  (`seeds.current`).

**C: 0 · W: 3 · S: 4**

## Re-verify (2026-11-20, HEAD 1a558ab)
Alcance: commits 07ac2fb, 931f8dd, 06d13d4, 3a608eb y a2ba89c. `npm run verify`: verde (91 ficheros, 1046 tests).
`progress.spec.ts` ya ejecutado por el coordinador (5/5); no se relanza la suite completa.

| Hallazgo | Estado |
|---|---|
| W1 orden de import de `cspSafeZod` | Resuelto: `tests/guardrails/csp-zod-import.test.ts` exige que sea el primer import de `main.ts`. |
| W2 design y ADR-0004 sin la desviación | Resuelto: design §CSP recoge `jitless` y `allowImportingTsExtensions`; nota en ADR-0004. |
| W3 heredoc sin registrar | Resuelto: incidente anotado en el ai-log. |
| S1 ADR-0010 "propuesta" | Resuelto: pasa a "aceptada". |
| S3 trazabilidad de "Imports rechazados" | Resuelto: `test.step` con el nombre del escenario en `progress.spec.ts`. |
| S2 semilla 90 frágil ante el balance | Deuda aprobada por el usuario; sin cambios. |
| S4 semilla del historial vía `probe.seed` | Deuda aprobada por el usuario; sin cambios. |

Sin hallazgos nuevos. El test de W1 es un chequeo textual del primer import, suficiente para la regresión descrita.

**Recuento final: C: 0 · W: 0 · S: 2 (deuda aprobada)**
