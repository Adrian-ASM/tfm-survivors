import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Escenarios "Reglas de capas en ESLint" (spec architecture-guardrails). Las reglas dependen de la ruta, así que se
// lintea texto en memoria (`lintText`) sin escribir en src/ (verify-report S11). El project service de
// typescript-eslint solo acepta ficheros que existen en el tsconfig, así que la ruta es la de un fichero REAL de
// la capa: su contenido se sustituye solo en memoria. Severidad 2 = error ⇒ `npm run lint` sale con código ≠ 0.
const root = join(import.meta.dirname, '..', '..');
const eslint = new ESLint({ cwd: root });
const ERROR = 2;
const LAYER_FILE: Record<string, string> = {
  domain: 'src/domain/run/Run.ts',
  application: 'src/application/StartRun.ts',
  infrastructure: 'src/infrastructure/phaser/GameScene.ts',
};

async function lintIn(layer: string, code: string): Promise<ESLint.LintResult['messages']> {
  const filePath = join(root, LAYER_FILE[layer] ?? `src/${layer}/missing.ts`);
  const [result] = await eslint.lintText(code, { filePath });
  const messages = result?.messages ?? [];
  expect(messages.filter((m) => m.fatal)).toEqual([]); // un error de parseo no cuenta como regla cumplida
  return messages;
}

const errorsOf = (msgs: ESLint.LintResult['messages'], rule: string) =>
  msgs.filter((m) => m.ruleId === rule && m.severity === ERROR);

describe('ESLint · capas y pureza', () => {
  it('Aplicación importa infraestructura', async () => {
    const msgs = await lintIn(
      'application',
      "import { loadRunConfig } from '../infrastructure/content/loadRunConfig';\nexport const f = loadRunConfig;\n",
    );
    expect(errorsOf(msgs, 'no-restricted-imports')).toHaveLength(1);
  });

  it('Infraestructura importa el motor', async () => {
    const msgs = await lintIn(
      'infrastructure',
      "import Phaser from 'phaser';\nexport const P = Phaser;\n",
    );
    expect(msgs.filter((m) => m.ruleId === 'no-restricted-imports')).toEqual([]);
  });

  it('el dominio no puede importar el motor', async () => {
    const msgs = await lintIn('domain', "import Phaser from 'phaser';\nexport const P = Phaser;\n");
    expect(errorsOf(msgs, 'no-restricted-imports')).toHaveLength(1);
  });

  it('Math.random, Date.now y window están prohibidos en el núcleo', async () => {
    const msgs = await lintIn(
      'domain',
      'export const a = Math.random();\nexport const b = Date.now();\nexport const c = window.innerWidth;\n',
    );
    expect(errorsOf(msgs, 'no-restricted-properties')).toHaveLength(2);
    expect(errorsOf(msgs, 'no-restricted-globals')).toHaveLength(1);
  });

  it('no escribe ficheros en src/ para lintear', async () => {
    const before = readdirSync(join(root, 'src', 'domain'));
    await lintIn('domain', 'export const a = 1;\n');
    expect(readdirSync(join(root, 'src', 'domain'))).toEqual(before);
  });
});

describe('ESLint · evasiones de las reglas del núcleo (verify-report W2)', () => {
  it.each(['domain', 'application'])('import() dinámico del motor en %s', async (layer) => {
    const msgs = await lintIn(layer, "export const load = () => import('phaser');\n");
    expect(errorsOf(msgs, 'no-restricted-syntax')).toHaveLength(1);
  });

  it.each([
    ['globalThis.localStorage', 'export const s = globalThis.localStorage;\n'],
    ['self.document', 'export const d = self.document;\n'],
    ['alias de globalThis', 'const g = globalThis;\nexport const s = g.localStorage;\n'],
  ])('acceso vía %s en el dominio', async (_name, code) => {
    const msgs = await lintIn('domain', code);
    expect(errorsOf(msgs, 'no-restricted-globals')).toHaveLength(1);
  });

  it('infraestructura puede usar import() y globalThis', async () => {
    const msgs = await lintIn(
      'infrastructure',
      "export const load = () => import('phaser');\nexport const g = globalThis.localStorage;\n",
    );
    expect(msgs.filter((m) => m.ruleId?.startsWith('no-restricted'))).toEqual([]);
  });
});
