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

## Consecuencias
- Fase 1: cero coste y cero secretos; el progreso se pierde si se borran los datos del navegador (mitigado con export).
- Fase 2: depende de la disponibilidad del plan gratuito (los proyectos inactivos pueden pausarse): comprobar sus
  condiciones actuales antes de empezar.
