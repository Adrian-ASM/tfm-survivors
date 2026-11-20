import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Spec public-deploy, "Documentación del despliegue" y "Riesgo aceptado documentado".
const ROOT = join(import.meta.dirname, '..', '..');
const README = readFileSync(join(ROOT, 'README.md'), 'utf8');
const ADR_0004 = readFileSync(join(ROOT, 'docs', 'adr', '0004-seguridad-local-first.md'), 'utf8');

describe('Documentación del despliegue (spec public-deploy)', () => {
  it('Scenario: README con URL e instrucciones', () => {
    const required = [
      'https://adrian-asm.github.io/tfm-survivors/',
      'npm run smoke:public',
      'SMOKE_URL',
      'smoke-public',
      'workflow_dispatch',
    ];

    expect(required.filter((text) => !README.includes(text))).toEqual([]);
  });

  it('Scenario: Riesgo aceptado documentado (ADR-0004)', () => {
    const required = ['frame-ancestors', 'report-uri', 'sandbox', 'clickjacking'];

    expect(ADR_0004).toMatch(/Riesgo aceptado: cabeceras en GitHub Pages/);
    expect(required.filter((text) => !ADR_0004.includes(text))).toEqual([]);
  });
});
