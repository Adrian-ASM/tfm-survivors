import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Hooks de .claude/hooks/ en modo Claude Code: JSON por stdin, código 2 = escritura bloqueada.
const root = join(import.meta.dirname, '..', '..');

function hook(name: string, filePath: string, content: string) {
  const r = spawnSync(process.execPath, [join(root, '.claude', 'hooks', name)], {
    cwd: root,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({ tool_input: { file_path: join(root, filePath), content } }),
    encoding: 'utf8',
  });
  return { code: r.status, out: r.stderr };
}

const architecture = (filePath: string, content: string) =>
  hook('guard-architecture.mjs', filePath, content);

describe('guard-architecture · evasiones (verify-report W2)', () => {
  it.each([
    ['import() dinámico del motor', "export const load = () => import('phaser');\n"],
    ['import de efecto del motor', "import 'phaser';\n"],
    ['import() de otra capa', "export const f = () => import('../infrastructure/x');\n"],
    [
      'import() con ruta calculada',
      'const m = "pha" + "ser";\nexport const f = () => import(m);\n',
    ],
    ['desestructuración de Math', 'const { random } = Math;\nexport const r = random();\n'],
    ['acceso calculado a Math', "export const r = Math['random']();\n"],
    ['referencia sin llamada', 'export const now = Date.now;\n'],
    ['globalThis.localStorage', 'export const s = globalThis.localStorage;\n'],
    ['self.document', 'export const d = self.document;\n'],
  ])('bloquea %s en el dominio', (_name, code) => {
    expect(architecture('src/domain/x.ts', code).code).toBe(2);
  });

  it('bloquea import() dinámico en la aplicación', () => {
    const { code, out } = architecture('src/application/a.ts', "void import('phaser');\n");
    expect(code).toBe(2);
    expect(out).toContain('src/application/a.ts');
  });

  it('no bloquea código limpio del dominio', () => {
    const code = [
      "import { Vector2 } from '../shared/Vector2';",
      'const selfish = { random: 1 };',
      'export const v = Vector2.of(selfish.random, Math.max(1, 2));',
      '',
    ].join('\n');
    expect(architecture('src/domain/x.ts', code)).toEqual({ code: 0, out: '' });
  });

  it('no bloquea import() ni globalThis en infraestructura', () => {
    const code = "export const f = () => import('phaser');\nexport const g = globalThis.window;\n";
    expect(architecture('src/infrastructure/x.ts', code).code).toBe(0);
  });
});
