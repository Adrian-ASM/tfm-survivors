import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:4173/tfm-survivors/';
const SLOW_ENV = Boolean(process.env.CI || process.env.CI_LIKE);

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
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // CI_LIKE=1: render por software, como el runner de Actions sin GPU (reproducir en local).
        ...(process.env.CI_LIKE
          ? { launchOptions: { args: ['--disable-gpu', '--use-angle=swiftshader'] } }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
