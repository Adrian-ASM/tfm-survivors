import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:4173/tfm-survivors/';
const CI_LIKE = Boolean(process.env.CI_LIKE);
const SLOW_ENV = Boolean(process.env.CI) || CI_LIKE;

// Chromium de escritorio; con CI_LIKE=1, render por software como el runner de Actions sin GPU.
const chrome = {
  ...devices['Desktop Chrome'],
  ...(CI_LIKE ? { launchOptions: { args: ['--disable-gpu', '--use-angle=swiftshader'] } } : {}),
};

// Smoke E2E contra el build de producción (vite preview), solo chromium (plan gratuito de GitHub Actions).
export default defineConfig({
  testDir: 'tests/e2e',
  // Las esperas son de reloj real y el runner de Actions (sin GPU, 4 vCPU) pinta a menos fps:
  // en CI y con CI_LIKE se da más margen (0012: poll del tick 120 en 5 s fallaba).
  timeout: SLOW_ENV ? 60_000 : 30_000,
  expect: { timeout: SLOW_ENV ? 15_000 : 5_000 },
  // Design 0008: tests independientes (contexto y localStorage propios); 2 workers en local y CI.
  fullyParallel: true,
  workers: 2,
  // Con CI_LIKE se quieren ver los flakes: sin reintentos. En CI real, 1 (se revisan en el HTML).
  retries: CI_LIKE ? 0 : process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  // Change 0014: `logic` (reglas, en modo manual, sin reloj) y `realtime` (frames y tiempo reales,
  // etiqueta @realtime). Un test sin etiqueta cae en `logic`.
  projects: [
    { name: 'logic', grepInvert: /@realtime/, use: { ...chrome } },
    { name: 'realtime', grep: /@realtime/, use: { ...chrome } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
