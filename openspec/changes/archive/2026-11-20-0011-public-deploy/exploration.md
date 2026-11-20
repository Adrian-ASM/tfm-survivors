# Exploración 0011-public-deploy

## Contexto actual
- `.github/workflows/ci.yml` YA contiene el despliegue: `quality` sube `upload-pages-artifact@v3` (`dist`) solo en push a main;
  `deploy` (needs quality+e2e, solo push a main, permisos `pages: write` + `id-token: write`, environment `github-pages`,
  `deploy-pages@v4`). Permisos globales `contents: read`; concurrency `ci-${{ github.ref }}` con cancel-in-progress.
  Push a main ignora docs/openspec/.claude/agents|skills (no despliega en cambios solo de docs).
- `vite.config.ts`: `base: '/tfm-survivors/'`. No hay `public/`. `index.html` usa rutas `/src/...` que Vite reescribe con la base.
  En `src/` no hay rutas absolutas a assets: el contenido (`content/*.json`) se importa en build; sin fetch.
- CSP: `<meta http-equiv>` en `index.html` (default-src 'self', style-src 'self', connect-src 'self', object-src/base-uri/form-action 'none').
  Sin `frame-ancestors`/`report-uri`/`sandbox` (el test lo exige: meta los ignora). `config/csp.ts` solo relaja en `serve`.
- E2E: `playwright.config.ts` ya sirve `npm run build && npm run preview` en `localhost:4173/tfm-survivors/`, es decir, base real.
  `smoke.spec.ts` y `menu-flow.spec.ts` comprueban 0 violaciones CSP y 1 meta (`watchCsp`/`cspState` en `tests/e2e/probe.ts`).
- `tests/guardrails/ci.test.ts` lee `ci.yml` con regex: exige un único `paths-ignore` (solo en push), `pull_request:` sin filtros y el
  patrón `docs='(...)'`. Un workflow nuevo no lo rompe; reformatear `ci.yml` sí podría.

## Specs / ADRs afectadas
- `progress-persistence` (requisito CSP y guardado/export/import); `main-menu` (flujo en E2E). ADR-0004 (local-first, "CSP por meta";
  cita GitHub Pages). Probablemente no cambia ninguna spec de comportamiento; podría añadirse requisito "despliegue" (capacidad nueva
  tipo `public-deploy`) o dejarlo como change solo de infraestructura.

## Opciones
1. **Verificar y cerrar lo ya hecho** (ci.yml tal cual) + activar Pages (Settings > Pages > Source: GitHub Actions, manual) + comprobación
   manual de la URL. Pros: coste cero, sin minutos extra. Contras: la CSP en producción solo se comprueba a mano; sin evidencia automática.
2. **Smoke post-despliegue** en ci.yml: job tras `deploy` con Playwright contra `page_url` (carga, 0 violaciones CSP, guardar/export/import
   mínimo). Pros: evidencia real de "producción", cubre diferencias de Pages (rutas, MIME, 404). Contras: +1-2 min de CI por push, requiere
   parametrizar `baseURL`/webServer en Playwright, alcance de tests sobre el ci.test.ts; fallo tras desplegar (ya publicado).
3. **Workflow separado `deploy.yml`** (`workflow_run` o `on: push` con sus propios `needs`). Pros: separa responsabilidades. Contras: duplica
   build/instalación (minutos), `workflow_run` complica el gating por `quality`, riesgo de duplicar paths-ignore y tocar ci.test.ts.

## Riesgos e incógnitas
- Pages puede no estar habilitado con fuente "GitHub Actions": `deploy` fallaría (acción manual del usuario; ¿repo público para plan gratuito?).
- GitHub Pages no admite cabeceras propias: `frame-ancestors` inaplicable (clickjacking, aceptado; documentar en ADR-0004). Pages añade
  sus propias cabeceras; no se espera conflicto con la meta.
- Diferencias local/producción: `vite preview` ≈ Pages, pero Pages es HTTPS y sirve 404 propio; `localStorage` por origen
  `<usuario>.github.io` (compartido con otros proyectos del mismo usuario: colisión de claves, a revisar el prefijo de clave).
- Descarga de export (Blob/`a[download]`) e importación en HTTPS: sin diferencia esperada, no verificado.
- Gate: `deploy` depende de `e2e`; el concurrency cancela despliegues obsoletos (aceptable). Un push solo de docs no redeploya.
- Minutos de CI: ya hay quality + e2e; la opción 2 añade uno más.
- Nunca se ha ejecutado `deploy` con éxito, no se ha confirmado (ver Preguntas).

## Mediciones previas
No aplican (no hay objetivo de balance ni rendimiento). Opcional: tamaño de `dist/` (Phaser ~1,4 MB, límite Pages sobra).

## Preguntas para el usuario
1. ¿Pages está ya activado con fuente GitHub Actions y el repo es público (o plan que lo permita)? ¿Hubo ya algún `deploy` en main?
2. ¿Basta el E2E local sobre `vite preview` con base, o quieres un smoke contra la URL pública tras desplegar (opción 2)?
3. ¿Se acepta que `frame-ancestors` quede fuera por limitación de Pages (documentado en ADR-0004)?
4. ¿Revisamos la clave de `localStorage` por la compartición de origen `*.github.io`?
