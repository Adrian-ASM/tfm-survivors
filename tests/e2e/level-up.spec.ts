import { expect, test } from '@playwright/test';
import { collect, focusGame, snapshotOf, type SnapshotView } from './probe';

// Recorrido matar → recoger → subir → elegir → seguir (spec upgrades, "Recorrido en el navegador").
// Núcleo, semilla 7 sin input: primera oferta en el tick 3332 (≈ 56 s de juego). El nivel que pinta
// la barra es el del snapshot (XpBar, probada en Node) y el overlay se ve si y solo si hay oferta.
const FIRST_OFFER_LIMIT = 60 * 60;

test('Recorrido en el navegador: con ?seed=7 sin input aparece el overlay, se pulsa 1 y se sigue', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = collect(page, ['error', 'warning']);
  await page.goto('./?e2e&seed=7');
  await expect.poll(async () => (await snapshotOf(page))?.tick ?? null).not.toBeNull();
  await focusGame(page);

  let before: SnapshotView | null = null;
  let offered: SnapshotView | null = null;
  const deadline = Date.now() + 100_000;
  while (!offered && Date.now() < deadline) {
    const snap = await snapshotOf(page);
    if (snap && snap.offer.length > 0) offered = snap;
    else if (snap) before = snap;
    await page.waitForTimeout(100);
  }

  expect(before?.progression.level).toBe(1);
  expect(offered?.status).toBe('choosing');
  expect(offered?.offer).toHaveLength(3);
  expect(offered?.tick).toBeLessThanOrEqual(FIRST_OFFER_LIMIT);
  await page.waitForTimeout(500);
  expect((await snapshotOf(page))?.tick).toBe(offered?.tick);

  await page.keyboard.press('1');
  await expect.poll(async () => (await snapshotOf(page))?.offer.length).toBe(0);
  const after = await snapshotOf(page);
  expect(after?.progression.level).toBe(2);
  expect(after?.upgrades).toEqual([{ id: offered?.offer[0]?.id, level: 1 }]);
  await expect
    .poll(async () => (await snapshotOf(page))?.tick ?? 0)
    .toBeGreaterThan((offered?.tick ?? 0) + 30);
  expect(problems).toEqual([]);
});
