import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// verify-report W6: un PR que solo toque las reglas (.claude/hooks/**) debe pasar por el job `quality`.
const workflow = readFileSync(
  join(import.meta.dirname, '..', '..', '.github', 'workflows', 'ci.yml'),
  'utf8',
);
const pathsIgnore = [...workflow.matchAll(/paths-ignore:\s*\[([^\]]*)\]/g)].map((m) => m[1] ?? '');

describe('CI · paths-ignore', () => {
  it('push y pull_request declaran paths-ignore', () => {
    expect(pathsIgnore).toHaveLength(2);
  });

  it.each([0, 1])('el trigger %i no ignora .claude/** (ni, por tanto, .claude/hooks/**)', (i) => {
    expect(pathsIgnore[i]).not.toContain("'.claude/**'");
    expect(pathsIgnore[i]).not.toContain('.claude/hooks');
    expect(pathsIgnore[i]).toContain("'.claude/agents/**'");
    expect(pathsIgnore[i]).toContain("'.claude/skills/**'");
  });
});
