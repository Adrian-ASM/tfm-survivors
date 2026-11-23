import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOGIC_GUARDED_SPECS, findClockWaits } from '../support/logicGuard';

const E2E_DIR = join(import.meta.dirname, '..', 'e2e');

const rulesOf = (source: string): string[] => findClockWaits(source).map((v) => v.rule);

describe('findClockWaits (design 0014 §5: sin esperas de reloj en logic)', () => {
  it('detecta waitForTimeout, playChoosingFirst y expect.poll del tick en un test sin etiqueta', () => {
    const source = [
      "test('reglas', async ({ page }) => {",
      '  await page.waitForTimeout(100);',
      '  await playChoosingFirst(page, (s) => s.status === "over", 1000);',
      '  await expect.poll(async () => (await snapshotOf(page))?.tick ?? 0).toBeGreaterThan(3);',
      '});',
    ].join('\n');

    expect(rulesOf(source)).toEqual(['waitForTimeout', 'playChoosingFirst', 'poll-tick']);
  });

  it('da la línea de cada espera', () => {
    const source = ["test('a', async ({ page }) => {", '  await page.waitForTimeout(5);', '});'];

    expect(findClockWaits(source.join('\n'))).toEqual([{ line: 2, rule: 'waitForTimeout' }]);
  });

  it('ignora los tests y describe con @realtime', () => {
    const source = [
      "test('reloj', { tag: '@realtime' }, async ({ page }) => {",
      '  await page.waitForTimeout(2_000);',
      '});',
      "test.describe('tiempo real (2 s)', { tag: '@realtime' }, () => {",
      "  test('x', async ({ page }) => {",
      '    await playChoosingFirst(page, () => true, 10);',
      '  });',
      '});',
    ].join('\n');

    expect(rulesOf(source)).toEqual([]);
  });

  it('entra en los describe sin etiqueta', () => {
    const source = [
      "test.describe('reglas', () => {",
      "  test('step(60)', async ({ page }) => {",
      '    await page.waitForTimeout(1);',
      '  });',
      "  test('reloj', { tag: '@realtime' }, async ({ page }) => {",
      '    await page.waitForTimeout(1);',
      '  });',
      '});',
    ].join('\n');

    expect(findClockWaits(source)).toEqual([{ line: 3, rule: 'waitForTimeout' }]);
  });

  it('vigila el preámbulo si el fichero no es entero de tiempo real, sin contar los imports', () => {
    const helper = [
      "import { playChoosingFirst } from './probe';",
      'const wait = (page: Page) => page.waitForTimeout(10);',
    ];
    const logic = ["test('a', async () => {", '  await step(page, 1);', '});'];
    const clock = ["test('b', { tag: '@realtime' }, async () => {", '  await wait(page);', '});'];

    expect(rulesOf([...helper, ...logic, ...clock].join('\n'))).toEqual(['waitForTimeout']);
    expect(rulesOf([...helper, ...clock].join('\n'))).toEqual([]);
  });

  it('no se confunde con comentarios, textos ni polls que no son del tick', () => {
    const source = [
      '// antes: page.waitForTimeout(500) y playChoosingFirst(...)',
      "test('sin waitForTimeout( en el título', async ({ page }) => {",
      '  /* expect.poll(() => snapshot.tick) */',
      "  await expect.poll(async () => (await probe(page))?.screen).toBe('paused');",
      '  await expect.poll(async () => (await snapshotOf(page)) !== null).toBe(true);',
      '});',
    ].join('\n');

    expect(rulesOf(source)).toEqual([]);
  });

  it('paréntesis dentro de textos y plantillas no rompen el troceo', () => {
    const source = [
      'test(`Scenario: step(${String(1)}) (oferta)`, async ({ page }) => {',
      "  const t = 'paréntesis ) sueltos (';",
      '  await page.waitForTimeout(1);',
      '});',
    ].join('\n');

    expect(findClockWaits(source)).toEqual([{ line: 3, rule: 'waitForTimeout' }]);
  });
});

describe('Specs vigiladas', () => {
  it('la lista empieza con manual-step.spec.ts', () => {
    expect(LOGIC_GUARDED_SPECS[0]).toBe('manual-step.spec.ts');
  });

  it.each(LOGIC_GUARDED_SPECS)('%s no tiene esperas de reloj fuera de @realtime', (file) => {
    const source = readFileSync(join(E2E_DIR, file), 'utf8');

    expect(findClockWaits(source)).toEqual([]);
  });
});
