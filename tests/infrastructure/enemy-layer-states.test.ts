import { describe, expect, it } from 'vitest';
import type { EnemySnapshot, StateKind } from '../../src/domain/run/RunSnapshot';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { PLACEHOLDER_TEXTURE, resolveLooks } from '../../src/infrastructure/phaser/art/looks';
import { EnemyLayer, type CorpseSink } from '../../src/infrastructure/phaser/EnemyLayer';
import { BARREL_FILE, REGISTERED, rawAppearance } from '../support/appearance';
import { fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';

// Spec sprite-rendering (0020): animación por clase de estado (mecha y carga), reserva del tipo
// entero si falta un frame de mecha y recuento por clase de estado.
const FRAME_MS = 1000 / 60;
const FUSE = [30, 31, 32];
const THROW = [14, 15, 16];

const NO_CORPSES: CorpseSink = { spawn: () => true };

const enemy = (id: number, type: string, x: number, kind: StateKind): EnemySnapshot => ({
  id,
  type,
  x,
  y: 100,
  radius: 16,
  health: 10,
  damaged: false,
  state: kind,
  stateKind: kind,
});

function layer(looks = someLooks()) {
  const kit = fakeKit();
  const l = new EnemyLayer(4, kit, looks.enemies, NO_CORPSES);
  return { l, sprites: kit.created };
}

describe('EnemyLayer · mecha y lanzamiento', () => {
  it('Scenario: Mecha y lanzamiento', () => {
    const { l, sprites } = layer();
    const [barrel, tnt] = [sprites[0], sprites[1]];
    // Ticks 1..3 andando (persecución); en el tick n = 4 el barril entra en mecha y el TNT en carga.
    for (let t = 1; t <= 3; t++) {
      l.sync(
        [enemy(0, 'goblin-barrel', 100 + t, 'chase'), enemy(1, 'goblin-tnt', 300 + t, 'chase')],
        t,
        t * FRAME_MS,
      );
    }
    expect(barrel?.frame).toBeGreaterThanOrEqual(6);
    const A = 3;
    for (let t = 4; t < 4 + A; t++) {
      l.sync(
        [enemy(0, 'goblin-barrel', 103, 'fuse'), enemy(1, 'goblin-tnt', 303, 'charge')],
        t,
        t * FRAME_MS,
      );
      if (t === 4) {
        expect(barrel?.frame).toBe(FUSE[0]);
        expect(tnt?.frame).toBe(THROW[0]);
      }
      expect(FUSE).toContain(barrel?.frame);
      expect(THROW).toContain(tnt?.frame);
    }
    l.sync(
      [enemy(0, 'goblin-barrel', 103, 'fuse'), enemy(1, 'goblin-tnt', 303, 'wait')],
      4 + A,
      (4 + A) * FRAME_MS,
    );
    expect(FUSE).toContain(barrel?.frame);
    expect([0, 1]).toContain(tnt?.frame);
  });

  it('Scenario: Mundo detenido (barril en mecha: mismo frame de hoja en 300 frames)', () => {
    const { l, sprites } = layer();
    l.sync([enemy(0, 'goblin-barrel', 100, 'fuse')], 500, 1234);
    const first = sprites[0]?.frame;
    for (let k = 0; k < 300; k++) {
      l.sync([enemy(0, 'goblin-barrel', 100, 'fuse')], 500, 1234);
      expect(sprites[0]?.frame).toBe(first);
    }
  });

  it('cuenta los sprites de enemigo por clase de estado (sonda 0020)', () => {
    const { l } = layer();
    l.sync(
      [
        enemy(0, 'goblin-barrel', 1, 'fuse'),
        enemy(1, 'goblin-tnt', 2, 'charge'),
        enemy(2, 'goblin-tnt', 3, 'wait'),
        enemy(3, 'goblin-torch', 4, 'chase'),
      ],
      1,
      0,
    );
    expect(l.states).toEqual({
      chase: 1,
      fuse: 1,
      charge: 1,
      wait: 1,
      patrol: 0,
      alert: 0,
      return: 0,
    });
    l.sync([enemy(1, 'goblin-tnt', 2, 'wait')], 2, 0);
    expect(l.states).toEqual({
      chase: 0,
      fuse: 0,
      charge: 0,
      wait: 1,
      patrol: 0,
      alert: 0,
      return: 0,
    });
    l.clear();
    expect(l.states).toEqual({
      chase: 0,
      fuse: 0,
      charge: 0,
      wait: 0,
      patrol: 0,
      alert: 0,
      return: 0,
    });
  });
});

describe('EnemyLayer · reserva por frames de comportamiento', () => {
  it('Scenario: Frame de mecha fuera de la hoja (frames 0 a 29: el tipo entero con reserva)', () => {
    const r = parseAppearance(rawAppearance(), REGISTERED);
    if (!r.ok) throw new Error(r.error.message);
    const looks = resolveLooks(r.value, (key) => (key === BARREL_FILE ? 30 : 100));
    const { l, sprites } = layer(looks);
    l.sync([enemy(0, 'goblin-barrel', 100, 'chase'), enemy(1, 'goblin-barrel', 200, 'fuse')], 1, 0);
    expect(sprites.slice(0, 2).map((s) => s.texture)).toEqual([
      PLACEHOLDER_TEXTURE,
      PLACEHOLDER_TEXTURE,
    ]);
    expect(l.counts).toEqual({ visible: 2, placeholder: 2 });
  });
});
