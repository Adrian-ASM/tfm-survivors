import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STILL_DEFEAT_SEED } from '../support/balanceSeeds';

// Spec run-outcome, "Semillas de los tests de balance": ninguna semilla ganadora suelta ni la 2 o
// la 90 como semillas de victoria o derrota.
const root = join(import.meta.dirname, '..', '..');
const SELF = 'tests/guardrails/balance-seeds.test.ts';

const files = readdirSync(join(root, 'tests'), { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && /\.ts$/.test(d.name))
  .map((d) => relative(root, join(d.parentPath, d.name)).replaceAll('\\', '/'))
  .filter((f) => f !== SELF);

describe('Semillas de balance', () => {
  it('Scenario: Sin semillas sueltas de balance (sin WIN_SEED ni la 2 o la 90 como semilla fija)', () => {
    const constant = files.filter((f) => readFileSync(join(root, f), 'utf8').includes('WIN_SEED'));
    const fixed = /(WIN|LOSS|DEFEAT|LOSE)_SEED\s*=\s*(2|90)\b/;
    const seeded = files.filter((f) => fixed.test(readFileSync(join(root, f), 'utf8')));
    expect([constant, seeded]).toEqual([[], []]);
    expect([2, 90]).not.toContain(STILL_DEFEAT_SEED);
  });
});
