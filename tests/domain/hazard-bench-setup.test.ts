import { describe, expect, it } from 'vitest';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { LONG_RUN_HEALTH, aDefaultConfig, withPlayer } from '../support/builders';
import { HAZARD_BLOCK_TICKS, HAZARD_GROUP, hazardWorstCase } from '../support/hazardBench';
import { advance, startSeededRun } from '../support/runs';

// Spec simulation-loop (0020), "Peor caso con peligros": la preparación del bench cumple sus
// condiciones en cada bloque de 60 ticks (el bench la rehace fuera del tiempo medido).
const SEED = 7;

/** Como el bench: contenido por defecto con la vida del jugador y de cada tipo inalcanzables. */
const config: RunConfig = (() => {
  const base = withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH });
  const types = base.enemies.types.map((t) => ({ ...t, health: LONG_RUN_HEALTH }));
  return { ...base, enemies: { ...base.enemies, types } };
})();

const inside = (s: RunSnapshot, b: RunSnapshot['blasts'][number]) =>
  s.enemies.filter((e) => Math.hypot(e.x - b.x, e.y - b.y) < b.radius + e.radius).length;

describe('Preparación del peor caso con peligros', () => {
  it('Scenario: Peor caso con peligros (condiciones de la preparación)', () => {
    const at = startSeededRun(config, SEED).snapshot().player;
    const run = startSeededRun(config, SEED, 'generated', hazardWorstCase(config, at));
    const s0 = run.snapshot();
    const kinds = (kind: string, type: string) =>
      s0.enemies.filter((e) => e.type === type && e.stateKind === kind).length;
    expect(s0.enemies).toHaveLength(3 * HAZARD_GROUP);
    expect(kinds('fuse', 'goblin-barrel')).toBeGreaterThanOrEqual(100);
    expect(kinds('charge', 'goblin-tnt')).toBeGreaterThanOrEqual(100);
    const snaps = advance(run, HAZARD_BLOCK_TICKS);
    const max = config.enemies.hazards.maxDynamites;
    expect(snaps.every((s) => s.dynamites.length === max)).toBe(true);
    for (let w = 0; w < HAZARD_BLOCK_TICKS; w += 10) {
      const window = snaps.slice(w, w + 10);
      const big = window.some((s) => s.blasts.some((b) => b.tick === s.tick && inside(s, b) >= 50));
      expect(big, `ventana ${String(w + 1)}–${String(w + 10)}`).toBe(true);
    }
    expect(snaps.at(-1)?.status).toBe('running');
  });
});
