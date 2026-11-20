import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// verify-report W6: un PR que solo toque las reglas (.claude/hooks/**) debe pasar por el job `quality`.
// Desde PR #22, pull_request no lleva paths-ignore (el check `quality` informa siempre) y el job `setup`
// detecta los PR de solo documentación con una expresión regular sobre las rutas: ninguna de las dos
// listas puede tratar .claude/hooks/** como documentación.
const workflow = readFileSync(
  join(import.meta.dirname, '..', '..', '.github', 'workflows', 'ci.yml'),
  'utf8',
);
const pathsIgnore = [...workflow.matchAll(/paths-ignore:\s*\[([^\]]*)\]/g)].map((m) => m[1] ?? '');
const docsPattern = /docs='\(([^']*)\)'/.exec(workflow)?.[1] ?? '';
const pullRequestTrigger = /\n {2}pull_request:([^\n]*)\n/.exec(workflow)?.[1] ?? '';

describe('CI · paths-ignore y detección de solo documentación', () => {
  it('solo el push declara paths-ignore; pull_request corre siempre', () => {
    expect(pathsIgnore).toHaveLength(1);
    expect(pullRequestTrigger.trim()).toBe('');
  });

  it('el paths-ignore del push no ignora .claude/** (ni, por tanto, .claude/hooks/**)', () => {
    const [push = ''] = pathsIgnore;
    expect(push).not.toContain("'.claude/**'");
    expect(push).not.toContain('.claude/hooks');
    expect(push).toContain("'.claude/agents/**'");
    expect(push).toContain("'.claude/skills/**'");
  });

  it('la detección de solo documentación no cuenta .claude/hooks/** como documentación', () => {
    const docs = new RegExp(docsPattern);
    expect(docsPattern).not.toBe('');
    expect(docs.test('.claude/hooks/guard-architecture.mjs')).toBe(false);
    expect(docs.test('.claude/settings.json')).toBe(false);
    expect(docs.test('src/main.ts')).toBe(false);
    expect(docs.test('docs/gdd.md')).toBe(true);
    expect(docs.test('openspec/specs/run-outcome/spec.md')).toBe(true);
    expect(docs.test('.claude/agents/sdd-verifier.md')).toBe(true);
    expect(docs.test('.claude/skills/sdd-workflow/SKILL.md')).toBe(true);
  });
});
