import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Change 0012 (design D1): los ids de enemigo `bug`, `memory-leak` y `merge-conflict` pasan a
// `goblin-torch`, `goblin-tnt` y `goblin-barrel`. La prosa con "bug" como "error" no cuenta: solo
// se buscan los literales entre comillas y los dos ids compuestos.
const ROOT = join(import.meta.dirname, '..', '..');
const SELF = relative(ROOT, import.meta.filename)
  .split(sep)
  .join('/');
const FOLDERS = ['src', 'tests', 'content'];
const LEGACY = [/'bug'/, /"bug"/, /`bug`/, /memory-leak/, /merge-conflict/];

function filesUnder(folder: string): string[] {
  return readdirSync(join(ROOT, folder), { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && /\.(ts|json|mjs)$/.test(d.name))
    .map((d) => relative(ROOT, join(d.parentPath, d.name)).split(sep).join('/'));
}

describe('Ids de enemigo antiguos (0012, design D1)', () => {
  it('ningún fichero de src, tests ni content usa los ids antiguos', () => {
    const hits = FOLDERS.flatMap(filesUnder)
      .filter((file) => file !== SELF)
      .flatMap((file) => {
        const text = readFileSync(join(ROOT, file), 'utf8');
        return LEGACY.filter((re) => re.test(text)).map((re) => `${file}: ${re.source}`);
      });
    expect(hits).toEqual([]);
  });
});
