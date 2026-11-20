import { defineConfig } from 'vitest/config';
import { devCsp } from './config/csp.ts';

// base: GitHub Pages sirve el juego en https://<usuario>.github.io/tfm-survivors/
export default defineConfig({
  base: '/tfm-survivors/',
  // CSP de index.html relajada solo en `vite` (HMR); la build lleva la estricta (design 0007).
  plugins: [devCsp()],
  build: {
    target: 'es2022',
    // Phaser 4 completo ocupa ~1,4 MB (≈380 KB gzip); medido en el change 0001. El aviso salta por encima de esto.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    // `npm run bench` (aparte de `npm test`, que solo incluye *.test.ts): design 0002-enemy-spawning.
    benchmark: { include: ['tests/bench/**/*.bench.ts'] },
  },
});
