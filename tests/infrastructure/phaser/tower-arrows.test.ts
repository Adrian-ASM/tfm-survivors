import { describe, expect, it } from 'vitest';
import type { RingSprite } from '../../../src/infrastructure/phaser/PulseLayer';
import { emptyCounts } from '../../../src/infrastructure/phaser/renderCounts';
import { RenderLayers } from '../../../src/infrastructure/phaser/RenderLayers';
import { DEFAULT_WEAPONS, LINTER, aStillType, withWeapons } from '../../support/builders';
import { FAKE_HAZARD_CAPACITY, FakeGraphics, fakeKit } from '../../support/FakeSprite';
import { someLooks } from '../../support/looks';
import { ticks } from '../../support/runs';
import {
  aSiteConfig,
  buildNow,
  startWithSites,
  TOUCH,
  untilBuilding,
  withStock,
} from '../../support/sites';

// Spec sprite-rendering 0026, "Pintado de las flechas de torre": segunda capa de flechas con su pool
// y su recuento (`sprites.towerArrows`), aparte de los proyectiles del jugador.
class FakeRing implements RingSprite {
  visible = true;
  setPosition(): this {
    return this;
  }
  setRadius(): this {
    return this;
  }
  setAlpha(): this {
    return this;
  }
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
}

describe('Flechas de torre pintadas (spec sprite-rendering 0026)', () => {
  it('Scenario: Flechas coherentes con el snapshot (60 snapshots con torre y Linter)', () => {
    const target = aStillType({ id: 'goblin-torch', health: 1e9 });
    const config = withWeapons(aSiteConfig({ player: { maxHealth: 1e6 } }, [target]), {
      ...DEFAULT_WEAPONS,
      weapons: [{ ...LINTER, cooldownTicks: 5 }],
    });
    const run = startWithSites(config, {
      player: TOUCH,
      ...withStock(30, 15),
      enemies: [{ type: 'goblin-torch', x: 1260, y: 450 }],
    });
    untilBuilding(run, 1);
    buildNow(run, 'tower');
    const layers = new RenderLayers(
      {
        kit: fakeKit(),
        ring: () => new FakeRing(),
        warnings: () => new FakeGraphics(),
        looks: someLooks(),
        capacity: {
          enemies: 8,
          projectiles: 32,
          towerProjectiles: config.buildings.tower.maxProjectiles,
          pulses: 2,
          pickups: 8,
          corpses: 8,
          visualTicks: new Map(),
          hazards: FAKE_HAZARD_CAPACITY,
        },
      },
      { visible: 1, placeholder: 0 },
    );
    let both = 0;
    for (const s of ticks(run, 60)) {
      layers.render(s);
      expect(layers.counts.towerArrows.visible).toBe(s.towerProjectiles.length);
      expect(layers.counts.projectiles.visible).toBe(s.projectiles.length);
      if (s.towerProjectiles.length > 0 && s.projectiles.length > 0) both++;
    }
    expect(both).toBeGreaterThan(10);
    layers.clear();
    expect(layers.counts.towerArrows.visible).toBe(0);
  });

  it('0 en modo menú', () => {
    expect(emptyCounts([]).towerArrows).toEqual({ visible: 0, placeholder: 0 });
    expect(emptyCounts([]).sites).toEqual({ empty: 0, house: 0, tower: 0, fallback: 0 });
  });
});
