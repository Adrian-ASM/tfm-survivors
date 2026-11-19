import { expect, test, type Page } from '@playwright/test';

interface Probe {
  __sprint?: { snapshot: { tick: number; player: { x: number; y: number } } | null };
}

const playerX = (page: Page): Promise<number | null> =>
  page.evaluate(() => (window as unknown as Probe).__sprint?.snapshot?.player.x ?? null);

test('el juego carga sin errores y el jugador se mueve con la flecha derecha', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('./?e2e');
  const canvas = page.locator('#game canvas');
  await expect(canvas).toBeVisible();
  await expect.poll(() => playerX(page)).not.toBeNull();

  const before = await playerX(page);
  await canvas.click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  const after = await playerX(page);

  // 200 px/s durante ~0,5 s ⇒ ~100 px; margen amplio para runners lentos.
  expect(after).not.toBeNull();
  expect((after ?? 0) - (before ?? 0)).toBeGreaterThan(40);
  expect(errors).toEqual([]);
});
