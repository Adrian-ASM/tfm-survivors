import { defineConfig, devices } from '@playwright/test';
import { resolveTargetUrl } from './tests/remote/target';

// Smoke remoto a demanda (change 0011, spec public-deploy): `npm run smoke:public` contra la URL
// pública o la de SMOKE_URL. Config aparte de la de test:e2e: su testDir no ve tests/e2e ni al revés.
// Sin servidor local: para un objetivo en localhost, antes `npm run build && npm run preview`.
const target = resolveTargetUrl(process.env.SMOKE_URL);
if (!target.ok) throw new Error(target.error);

export default defineConfig({
  testDir: 'tests/remote',
  // Solo *.spec.ts: target.test.ts es un unitario de Vitest (npm test) y no debe cargarse aquí.
  testMatch: '*.spec.ts',
  // Comprobación previa (≤ ~40 s): sin estado 200 en la raíz, aborta antes de abrir páginas.
  globalSetup: './tests/remote/preflight.ts',
  // Presupuesto del design: 130 s de tests + 40 s de preflight < 180 s de reloj.
  globalTimeout: 130_000,
  timeout: 60_000,
  // 1 reintento absorbe un fallo puntual de red (sale como flaky); 2 superarían el tope.
  retries: 1,
  workers: 1,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/smoke', open: 'never' }]],
  outputDir: 'test-results/smoke',
  use: {
    baseURL: target.value.href,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
