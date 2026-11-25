import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { SiteArt } from '../../../src/infrastructure/phaser/SiteArt';
import { aDefaultConfig } from '../../support/builders';
import { randomInputs } from '../../support/inputs';
import { planFor, repoAppearance } from '../../support/mapArt';
import { startSeededRun } from '../../support/runs';
import { buildNow } from '../../support/sites';

// Spec sprite-rendering 0026, "Pintado de los solares y de los edificios": aspecto vigente y sonda
// `sprites.sites` sin motor, con snapshots de la partida y una máscara de prueba.
const APPEARANCE = repoAppearance();

class FakeMask {
  readonly on = new Map<number, boolean>();
  setEnabled(i: number, on: boolean): void {
    this.on.set(i, on);
  }
}

/** Partida de la semilla 42 con el jugador tangente al primer solar y madera para la casa. */
function atFirstSite() {
  const { sites, cellSize } = startSeededRun(aDefaultConfig(), 42).map;
  const first = sites[0];
  if (!first) throw new Error('sin solares');
  return startSeededRun(aDefaultConfig(), 42, 'generated', {
    player: { x: first.x, y: (first.row + first.rows) * cellSize + 16 },
    resources: { gold: 0, wood: 15, stone: 0 },
  });
}

describe('SiteArt (spec sprite-rendering 0026)', () => {
  it('Scenario: Solar en obra y casa construida (semilla 42, todas las hojas)', () => {
    const run = atFirstSite();
    const plan = planFor(run.map, 42);
    const art = new SiteArt();
    const mask = new FakeMask();
    art.reset(plan.sites, mask);
    art.sync(run.snapshot().sites);
    expect(art.counts).toEqual({ empty: 6, house: 0, tower: 0, fallback: 0 });
    run.tick(PlayerInput.NONE);
    buildNow(run, 'house');
    art.sync(run.snapshot().sites);
    expect(art.counts).toEqual({ empty: 5, house: 1, tower: 0, fallback: 0 });
    const [first] = plan.sites;
    const all = [...plan.low, ...plan.high];
    expect(first?.free.every((i) => mask.on.get(i) === false)).toBe(true);
    expect(first?.house.every((i) => mask.on.get(i) === true)).toBe(true);
    expect(first?.tower.every((i) => mask.on.get(i) === false)).toBe(true);
    const texture = (i: number) => {
      const d = all[i];
      return d?.kind === 'sprite' ? d.texture : null;
    };
    expect(first?.house.map(texture)).toEqual([
      APPEARANCE.sites.house.sheet.file,
      APPEARANCE.sites.house.sheet.file,
    ]);
  });

  it('Scenario: Reserva de los edificios (torre sin hoja: la sonda cuenta 1 torre con reserva)', () => {
    const run = atFirstSite();
    const missing = [APPEARANCE.sites.tower.sheet.file];
    const art = new SiteArt();
    art.reset(planFor(run.map, 42, missing).sites, new FakeMask());
    const s = run.snapshot();
    const built: RunSnapshot['sites'] = s.sites.map((x, i) =>
      i === 0 ? { ...x, state: 'tower' } : x,
    );
    art.sync(built);
    expect(art.counts).toEqual({ empty: 5, house: 0, tower: 1, fallback: 1 });
  });

  it('Scenario: Pintar los solares no cambia la simulación (semilla 42, 1.200 ticks, con y sin hojas)', () => {
    const inputs = randomInputs(1200, 2026);
    const play = (missing: readonly string[]) => {
      const run = atFirstSite();
      const art = new SiteArt();
      art.reset(planFor(run.map, 42, missing).sites, new FakeMask());
      const out: string[] = [];
      for (const input of inputs) {
        if (run.status === 'building') buildNow(run, 'house');
        if (run.status === 'choosing') run.chooseUpgrade(0);
        if (run.status === 'shopping') run.leaveShop();
        run.tick(input);
        const snap = run.snapshot();
        art.sync(snap.sites);
        out.push(JSON.stringify(snap));
      }
      return out;
    };
    const files = Object.values(APPEARANCE.sites).map((a) => a.sheet.file);
    expect(play([])).toEqual(play(files));
  });
});
