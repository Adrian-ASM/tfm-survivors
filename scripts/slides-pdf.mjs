// Exporta la presentación (`slides/`) a PDF con el modo de impresión de reveal.js.
// Uso: `npm run slides:pdf` (hace la build y luego ejecuta este script sobre `dist/`).
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const OUT = 'docs/slides/greentide-vanguard.pdf';
const PORT = 4175;

const server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/tfm-survivors/slides/?print-pdf`);
  // reveal.js añade `.pdf-page` cuando ha maquetado todas las slides para imprimir.
  await page.waitForSelector('.pdf-page');
  // Espera a que carguen las hojas de sprites (fondos y sprites animados).
  await page.waitForLoadState('networkidle');
  await mkdir(dirname(OUT), { recursive: true });
  await page.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true });
  console.log(`PDF generado: ${OUT}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
