import { test as base, type CDPSession, type Page } from '@playwright/test';

/** Opción de proyecto: factor de frenado de la CPU de la página (1 = sin frenar). */
export interface ThrottleOptions {
  cpuThrottle: number;
}

/** Frena la CPU del hilo principal de la página por CDP (solo chromium). */
async function throttle(page: Page, rate: number): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return cdp;
}

/**
 * `test` de todas las specs (design 0014 §4.2; ESLint prohíbe el de @playwright/test en las
 * specs). Con `cpuThrottle > 1` (proyecto `realtime` con CI_LIKE), frena la CPU de `page` antes
 * de que el test empiece. El rasterizado de swiftshader corre en el proceso GPU y no se frena.
 */
export const test = base.extend<ThrottleOptions & { throttleCpu: undefined }>({
  cpuThrottle: [1, { option: true }],
  throttleCpu: [
    async ({ page, cpuThrottle, browserName }, use) => {
      if (cpuThrottle > 1 && browserName === 'chromium') await throttle(page, cpuThrottle);
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
