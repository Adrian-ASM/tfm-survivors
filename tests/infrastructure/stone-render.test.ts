import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { PickupLayer } from '../../src/infrastructure/phaser/PickupLayer';
import {
  ROCK_LARGE_FILE,
  ROCK_MEDIUM_FILE,
  ROCK_SMALL_FILE,
  type RawAppearance,
} from '../support/appearance';
import { aDefaultConfig } from '../support/builders';
import { fakeKit } from '../support/FakeSprite';
import { randomInputs } from '../support/inputs';
import { someLooks } from '../support/looks';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Spec sprite-rendering (0025), "Pintar la piedra no cambia la simulación": la roca es solo
// presentación; con las hojas de la piedra sin cargar, otras escalas y otra roca por tipo, la misma
// partida.
type Json = Record<string, unknown>;

/** Rocas al doble de escala y la `rock` de todos los tipos de enemigo cambiada. */
function otherRocks(r: RawAppearance): void {
  const rocks = (r.pickups.stone as { rocks: Record<string, Json> }).rocks;
  for (const rock of Object.values(rocks)) rock.scale = (rock.scale as number) * 2;
  const next: Record<string, string> = { small: 'large', medium: 'small', large: 'medium' };
  for (const enemy of Object.values(r.enemies) as Json[]) {
    enemy.rock = next[enemy.rock as string];
  }
}

describe('Pintar la piedra no cambia la simulación (sprite-rendering 0025)', () => {
  it('Scenario: Pintar la piedra no cambia la simulación (semilla 42, 1.200 ticks)', () => {
    const inputs = randomInputs(1200, 2026);
    const play = (edit?: (r: RawAppearance) => void, missing: readonly string[] = []) => {
      const run = startSeededRun(aDefaultConfig(), 42);
      const looks = someLooks(edit, missing);
      const pickups = new PickupLayer(436, fakeKit(), looks.pickups, looks.stones);
      const snaps: RunSnapshot[] = [];
      let stones = 0;
      for (const input of inputs) {
        chooseFirstWhileOpen(run);
        run.tick(input);
        const s = run.snapshot();
        pickups.sync(s.pickups);
        stones = Math.max(stones, pickups.counts.stone.visible);
        snaps.push(s);
      }
      return { snaps, stones, placeholder: pickups.counts.stone.placeholder };
    };
    const painted = play();
    const fallback = play(otherRocks, [ROCK_SMALL_FILE, ROCK_MEDIUM_FILE, ROCK_LARGE_FILE]);

    expect(painted.stones).toBeGreaterThan(0);
    expect(painted.placeholder).toBe(0);
    expect(fallback.snaps).toStrictEqual(painted.snaps);
  });
});
