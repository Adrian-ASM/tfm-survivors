# ADR-0004 · Seguridad y persistencia: local-first, Supabase opcional

- **Estado**: aceptada (fase 1) · propuesta (fase 2)
- **Fecha**: 2026-11-19

## Contexto
El juego es estático (GitHub Pages). Guardar progreso no exige backend, y cada servicio externo añade superficie de
ataque, secretos y coste. Aun así, un login real con Google aporta valor al TFM si se hace bien.

## Decisión

### Fase 1 · Local-first (sin cuentas)
- Puerto `ProgressRepository` con adaptadores `LocalStorageProgressRepository` (o IndexedDB si crece) e `InMemory…`.
- **Exportar / importar** progreso como JSON versionado (`schemaVersion`).
- El import es una **entrada no confiable**: tamaño máximo, `JSON.parse` protegido, validación estricta con zod,
  migración de versiones y rechazo con mensaje claro. Nunca se interpreta como HTML ni código.
- Sin secretos, sin cookies, sin analítica de terceros. CSP restrictiva por `<meta>` en `index.html`.

### Fase 2 · Supabase (plan gratuito) + login con Google (si da tiempo)
- Nuevo adaptador `SupabaseProgressRepository` del mismo puerto (los tests de contrato lo cubren).
- En el cliente solo la clave pública (anon/publishable). **Row Level Security en todas las tablas**, con políticas
  `auth.uid() = user_id`. La clave de servicio nunca sale del panel de Supabase.
- OAuth de Google configurado en Supabase; redirect URLs limitadas al dominio de Pages y a localhost.
- El modo local sigue funcionando sin cuenta; sincronizar es opcional.
- Si el proyecto tiene login, el README incluirá un usuario de prueba (requisito del TFM). Con Google OAuth,
  documentar un acceso de invitado o una cuenta de prueba dedicada.

### Nota (2026-11-20, change 0007-local-save-export)
- La CSP de la fase 1 está implementada en `index.html` sin `'unsafe-eval'` ni `'unsafe-inline'` en scripts. zod 4
  sondea `new Function` al construir sus esquemas y, con esa CSP, provoca un `securitypolicyviolation` aunque
  capture el error. Se desactiva su JIT con `z.config({ jitless: true })`
  (`src/infrastructure/validation/cspSafeZod.ts`, primer import de `main.ts`, protegido por un test de
  guardarraíl). La validación de entradas externas no cambia. Detalle en `openspec/changes/0007-local-save-export/
  design.md`, sección CSP.

### Riesgo aceptado: cabeceras en GitHub Pages (2026-11-20, change 0011-public-deploy)
- GitHub Pages no permite definir cabeceras HTTP propias. La CSP solo se aplica por `<meta>`, y el navegador
  ignora en una meta las directivas `frame-ancestors`, `report-uri`/`report-to` y `sandbox`. Por eso no se declaran
  (lo comprueba `tests/guardrails/csp.test.ts`) y **no se aplican en producción**.
- Consecuencias aceptadas en la fase 1:
  - **Clickjacking**: cualquier página ajena puede incrustar el juego en un iframe. El impacto es bajo: no hay
    cuentas ni datos sensibles, el progreso es local y exportable, y "Borrar datos" pide confirmación propia.
  - **Sin informes de violaciones**: una violación de CSP en producción no se notifica a nadie. Se detecta con el
    smoke a demanda contra la URL pública (`npm run smoke:public` o el workflow `smoke-public`).
- Alternativa descartada: *frame-busting* por JS (`top !== self`). Se puede saltar con `<iframe sandbox>` y no
  compensa sin datos que proteger.
- **Revisar** si el juego se sirve desde un hosting que admita cabeceras (p. ej. `_headers`) o al empezar la
  fase 2 con login. Con cuentas, el clickjacking deja de ser aceptable y habrá que aplicar `frame-ancestors 'none'`
  por cabecera.

## Consecuencias
- Fase 1: cero coste y cero secretos; el progreso se pierde si se borran los datos del navegador (mitigado con export).
- Fase 2: depende de la disponibilidad del plan gratuito (los proyectos inactivos pueden pausarse): comprobar sus
  condiciones actuales antes de empezar.
