import { defineConfig } from 'vitest/config';

// base: GitHub Pages sirve el juego en https://<usuario>.github.io/tfm-survivors/
export default defineConfig({
  base: '/tfm-survivors/',
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
});
