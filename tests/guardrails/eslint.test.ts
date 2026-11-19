import { randomUUID } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { afterEach, describe, expect, it } from 'vitest';

// Escenarios "Reglas de capas en ESLint" (spec architecture-guardrails). Se escribe un fichero temporal en la capa
// real porque las reglas dependen de la ruta; se borra siempre al terminar.
const root = join(import.meta.dirname, '..', '..');
const created: string[] = [];

async function lintIn(layer: string, code: string): Promise<string[]> {
  const file = join(root, 'src', layer, `__guardrail_${randomUUID().slice(0, 8)}.ts`);
  writeFileSync(file, code);
  created.push(file);
  const [result] = await new ESLint({ cwd: root }).lintFiles([file]);
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'parser'}: ${m.message}`);
}

afterEach(() => {
  for (const file of created.splice(0)) rmSync(file, { force: true });
});

describe('ESLint · capas y pureza', () => {
  it('Aplicación importa infraestructura', async () => {
    const msgs = await lintIn(
      'application',
      "import { loadRunConfig } from '../infrastructure/content/loadRunConfig';\nexport const f = loadRunConfig;\n",
    );
    expect(msgs.some((m) => m.startsWith('no-restricted-imports'))).toBe(true);
  });

  it('Infraestructura importa el motor', async () => {
    const msgs = await lintIn(
      'infrastructure',
      "import Phaser from 'phaser';\nexport const P = Phaser;\n",
    );
    expect(msgs.filter((m) => m.startsWith('no-restricted-imports'))).toEqual([]);
  });

  it('el dominio no puede importar el motor', async () => {
    const msgs = await lintIn('domain', "import Phaser from 'phaser';\nexport const P = Phaser;\n");
    expect(msgs.some((m) => m.startsWith('no-restricted-imports'))).toBe(true);
  });

  it('Math.random, Date.now y window están prohibidos en el núcleo', async () => {
    const msgs = await lintIn(
      'domain',
      'export const a = Math.random();\nexport const b = Date.now();\nexport const c = window.innerWidth;\n',
    );
    expect(msgs.filter((m) => m.startsWith('no-restricted-properties'))).toHaveLength(2);
    expect(msgs.some((m) => m.startsWith('no-restricted-globals'))).toBe(true);
  });
});

describe('ESLint · evasiones de las reglas del núcleo (verify-report W2)', () => {
  it.each(['domain', 'application'])('import() dinámico del motor en %s', async (layer) => {
    const msgs = await lintIn(layer, "export const load = () => import('phaser');\n");
    expect(msgs.some((m) => m.startsWith('no-restricted-syntax'))).toBe(true);
  });

  it.each([
    ['globalThis.localStorage', 'export const s = globalThis.localStorage;\n'],
    ['self.document', 'export const d = self.document;\n'],
    ['alias de globalThis', 'const g = globalThis;\nexport const s = g.localStorage;\n'],
  ])('acceso vía %s en el dominio', async (_name, code) => {
    const msgs = await lintIn('domain', code);
    expect(msgs.some((m) => m.startsWith('no-restricted-globals'))).toBe(true);
  });

  it('infraestructura puede usar import() y globalThis', async () => {
    const msgs = await lintIn(
      'infrastructure',
      "export const load = () => import('phaser');\nexport const g = globalThis.localStorage;\n",
    );
    expect(msgs.filter((m) => m.startsWith('no-restricted'))).toEqual([]);
  });
});
