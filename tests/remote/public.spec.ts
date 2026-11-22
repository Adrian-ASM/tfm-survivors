import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';
import type { Progress } from '../../src/domain/progress/Progress';
import { PROGRESS_STORAGE_KEY } from '../../src/infrastructure/progress/LocalStorageProgressRepository';
import { decodeProgress } from '../../src/infrastructure/progress/progressCodec';
import {
  collect,
  cspState,
  expectSpeed,
  focusGame,
  gameUrl,
  menuPanel,
  playChoosingFirst,
  probe,
  snapshotOf,
  watchCsp,
} from '../e2e/probe';
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

/** Velocidad del bucle en el smoke: el máximo de `resolveSpeed` (spec public-deploy). */
const REMOTE_SPEED = 15;
/** Margen de reloj (no es la aserción): la derrota quieta con la semilla 42 son ~312 frames. */
const PLAY_TIMEOUT_MS = 40_000;
const FILE_NAME = 'sprint-survivors-progress.json';

const stored = (page: Page): Promise<string | null> =>
  page.evaluate((key) => window.localStorage.getItem(key), PROGRESS_STORAGE_KEY);

const decoded = (text: string | null): Progress | null => {
  const d = decodeProgress(text ?? '');
  return d.ok ? d.value : null;
};

/** Progreso en uso según la sonda (récords e historial). */
const probedProgress = async (page: Page) => {
  const p = (await probe(page))?.progress;
  return p ? { records: p.records, history: p.history } : null;
};

// Copias de los helpers de tests/e2e/progress.spec.ts (design: no se toca tests/e2e).
async function exportFile(page: Page): Promise<{ name: string; text: string; failure: unknown }> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar' }).click();
  const file = await download;
  const path = await file.path();
  return {
    name: file.suggestedFilename(),
    text: readFileSync(path, 'utf8'),
    failure: await file.failure(),
  };
}

async function importFile(page: Page, content: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importar' }).click();
  await (
    await chooser
  ).setFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(content) });
}

test('Scenario: Jugar, guardar, exportar e importar en producción y persistencia tras recargar', async ({
  page,
  watch,
}) => {
  let downloads = 0;
  page.on('download', () => (downloads += 1));
  await page.goto(gameUrl({ seed: 42, speed: REMOTE_SPEED }));
  await expectSpeed(page, REMOTE_SPEED);
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);

  // Quieto (solo se elige la primera mejora) hasta la derrota.
  const ended = await playChoosingFirst(page, (s) => s.status === 'over', PLAY_TIMEOUT_MS);
  expect(ended?.outcome).toBe('lost');
  await expect(page.getByRole('region', { name: 'Progreso' })).toBeVisible();
  const saved = await stored(page);
  const progress = decoded(saved);
  expect(progress?.history).toHaveLength(1);
  expect(progress?.history[0]).toMatchObject({ seed: 42, outcome: 'lost' });

  // Exportar: 1 descarga, el fichero del juego e igual campo a campo a lo guardado.
  const exported = await exportFile(page);
  expect(exported.failure).toBeNull();
  expect(exported.name).toBe(FILE_NAME);
  expect(decoded(exported.text)).toStrictEqual(progress);
  expect(downloads).toBe(1);

  // Importar ese mismo fichero: éxito e idempotente (sigue habiendo 1 entrada).
  await importFile(page, exported.text);
  await expect(page.getByRole('status')).toContainText('importado');
  expect(decoded(await stored(page))?.history).toHaveLength(1);
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(pageErrors(watch.messages)).toEqual([]);

  // Scenario: Persistencia tras recargar en producción.
  const before = decoded(await stored(page));
  const afterReload = collect(page, ['error', 'warning']);
  await page.reload();
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();

  expect(await probedProgress(page)).toStrictEqual(before);
  expect(afterReload.filter((m) => /progress/i.test(m))).toEqual([]);
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(pageErrors(watch.messages)).toEqual([]);
  expect(new Set(watch.documents)).toEqual(new Set([TARGET.origin]));
});

// Change 0012 (spec sprite-rendering, "Arte en la URL pública"): cada hoja de los datos de aspecto
// se pide bajo la base y responde 200 image/png, sin violaciones de CSP ni errores no capturados.
// Se lee con fs: el cargador de Playwright exige `with { type: 'json' }` para importar JSON.
interface AspectSheet {
  sheet: { file: string };
}
const appearanceJson = JSON.parse(
  readFileSync(new URL('../../content/appearance.json', import.meta.url), 'utf8'),
) as Record<'player' | 'projectile' | 'gem' | 'ground' | 'corpse', AspectSheet> & {
  enemies: Record<string, AspectSheet>;
};
const SHEETS = [
  ...new Set(
    [
      appearanceJson.player,
      ...Object.values(appearanceJson.enemies),
      appearanceJson.projectile,
      appearanceJson.gem,
      appearanceJson.ground,
      appearanceJson.corpse,
    ].map((a) => a.sheet.file),
  ),
];

test('Scenario: Arte en la URL pública (cada hoja 200 image/png bajo la base)', async ({
  page,
  watch,
}) => {
  const sheets = new Map<string, { status: number; type: string }>();
  page.on('response', (r) => {
    const path = decodeURIComponent(new URL(r.url()).pathname);
    const file = SHEETS.find((f) => path === `${TARGET.pathname}assets/tiny-swords/${f}`);
    if (file) sheets.set(file, { status: r.status(), type: r.headers()['content-type'] ?? '' });
  });
  await page.goto('./');
  await menuPanel(page).getByRole('button', { name: 'Jugar', exact: true }).click();
  await expect(menuPanel(page)).toBeHidden();
  await expect.poll(() => sheets.size).toBe(SHEETS.length);

  for (const file of SHEETS) {
    expect(sheets.get(file), file).toEqual({ status: 200, type: 'image/png' });
  }
  expect(await cspState(page)).toEqual({ violations: [], metas: 1 });
  expect(pageErrors(watch.messages)).toEqual([]);
});
