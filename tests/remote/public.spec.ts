import { test as base, expect } from '@playwright/test';
import { collect, cspState, menuPanel, watchCsp } from '../e2e/probe';
import {
  IGNORED_META_DIRECTIVES,
  isPublicTarget,
  localAssetRefs,
  metaCspDirectives,
  misplacedRefs,
  resolveTargetUrl,
} from './target';

// Smoke remoto (change 0011, spec public-deploy): la build publicada carga sin violaciones de CSP ni
// recursos rotos y el bucle jugar → guardar → exportar → importar → recargar funciona igual que en
// local. Corre contra la URL pública o la de SMOKE_URL (ya validada por la config). Cada test usa un
// contexto nuevo de Playwright: no depende de datos previos ni deja nada fuera del navegador.
const resolved = resolveTargetUrl(process.env.SMOKE_URL);
if (!resolved.ok) throw new Error(resolved.error);
const TARGET = resolved.value;
const PUBLIC = isPublicTarget(TARGET);

/** Lo que el fixture común recoge de cada página desde antes de cargarla. */
interface LoadWatch {
  /** `pageerror` y mensajes de consola `error`/`warning` (sin el ruido del driver de GPU). */
  readonly messages: string[];
  /** Respuestas ≥ 400 y peticiones fallidas del mismo origen que la URL objetivo. */
  readonly broken: string[];
  /** Origen de cada petición de documento. */
  readonly documents: string[];
}

const test = base.extend<{ watch: LoadWatch }>({
  watch: async ({ page }, use) => {
    await watchCsp(page);
    const messages = collect(page, ['error', 'warning']);
    const broken: string[] = [];
    const documents: string[] = [];
    const sameOrigin = (url: string) => new URL(url).origin === TARGET.origin;
    page.on('response', (r) => {
      if (r.status() >= 400 && sameOrigin(r.url())) broken.push(`${String(r.status())} ${r.url()}`);
    });
    page.on('requestfailed', (r) => {
      if (sameOrigin(r.url())) broken.push(`${r.failure()?.errorText ?? 'fallo'} ${r.url()}`);
    });
    page.on('request', (r) => {
      if (r.resourceType() === 'document') documents.push(new URL(r.url()).origin);
    });
    await use({ messages, broken, documents });
  },
});

const pageErrors = (messages: string[]) => messages.filter((m) => m.startsWith('pageerror:'));
const cspMessages = (messages: string[]) =>
  messages.filter((m) => m.includes('Content Security Policy'));

test('Scenario: Carga limpia y sin recursos rotos en la URL objetivo', async ({ page, watch }) => {
  const response = await page.goto('./');
  await expect(menuPanel(page)).toBeVisible();
  await page.waitForLoadState('networkidle');
  const html = (await response?.text()) ?? '';
  const refs = localAssetRefs(html);

  expect(response?.status()).toBe(200);
  // La URL final es HTTPS si el objetivo es la pública (localhost sirve por HTTP).
  expect(page.url().startsWith('https://') || !PUBLIC).toBe(true);
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(cspMessages(watch.messages)).toEqual([]);
  expect(pageErrors(watch.messages)).toEqual([]);
  // Scenario: Rutas del index.html publicado (el HTML servido es el dist/index.html publicado).
  expect(refs.length).toBeGreaterThan(0);
  expect(misplacedRefs(refs, TARGET.pathname)).toEqual([]);
  // Scenario: Directivas que la meta ignora (parte servida).
  expect(metaCspDirectives(html).filter((d) => IGNORED_META_DIRECTIVES.includes(d))).toEqual([]);
  expect(watch.broken).toEqual([]);
  // Scenario: URL objetivo alternativa: todo documento va al origen objetivo.
  expect(watch.documents).toEqual([TARGET.origin]);
});

// vite preview devuelve index.html con 200 en rutas inexistentes y no sirve HTTPS: T2 y T3 solo
// tienen sentido contra GitHub Pages.
const ONLY_PUBLIC = 'solo contra la URL pública (GitHub Pages)';

test('Scenario: Ruta inexistente bajo la base', async ({ page, watch }) => {
  test.skip(!PUBLIC, ONLY_PUBLIC);

  const response = await page.goto('./no-existe');

  expect(response?.status()).toBe(404);
  expect(await page.locator('#game canvas').count()).toBe(0);
  expect(watch.documents).toEqual([TARGET.origin]);
});

test('Scenario: HTTP redirige a HTTPS', async ({ request }) => {
  test.skip(!PUBLIC, ONLY_PUBLIC);
  const http = new URL(TARGET.href);
  http.protocol = 'http:';

  const response = await request.get(http.href);

  expect(response.status()).toBe(200);
  expect(response.url().startsWith(TARGET.href)).toBe(true);
  expect(http.href).toBe('http://adrian-asm.github.io/tfm-survivors/');
});
