import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { HitSnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { WeaponTypeConfig } from '../../src/domain/weapon/WeaponType';
import { LINTER, aStillType, withCombat, withWeapons } from './builders';
import { aBehaviorConfig } from './runs';
import { weaponsOf } from './weapons';

/** `goblin-torch` quieto (vida 10, radio 10) de los escenarios de golpes (0031). */
export const STILL_TORCH = aStillType({ id: 'goblin-torch', health: 10 });
/** `goblin-tnt` quieto (vida 45, radio 22) de los escenarios de golpes (0031). */
export const STILL_TNT = aStillType({ id: 'goblin-tnt', health: 45, radius: 22 });

/** Salto del jugador en un tick (px): velocidad de escenario para entrar en el pulso a tiempo. */
export const JUMP_PX = 250;
export const LEFT = PlayerInput.of(-1, 0);

/**
 * Contenido de los escenarios de golpes: `aBehaviorConfig` con los dos enemigos quietos (y los
 * tipos dados), las armas dadas, el jugador a `JUMP_PX` por tick y el tope de golpes por tick dado.
 */
export function aHitConfig(
  weapons: readonly WeaponTypeConfig[],
  o: {
    readonly maxHitsPerTick?: number;
    readonly player?: Partial<RunConfig['player']>;
    readonly types?: readonly EnemyTypeConfig[];
  } = {},
): RunConfig {
  const base = aBehaviorConfig([STILL_TORCH, STILL_TNT, ...(o.types ?? [])], {
    player: { speed: JUMP_PX * 60, ...o.player },
  });
  const config = withWeapons(base, weaponsOf(weapons));
  return o.maxHitsPerTick === undefined
    ? config
    : withCombat(config, { maxHitsPerTick: o.maxHitsPerTick });
}

/** Golpes del snapshot registrados en su propio tick. */
export const hitsOfTick = (s: RunSnapshot | undefined): readonly HitSnapshot[] =>
  s ? s.hits.filter((h) => h.tick === s.tick) : [];

/** Ejecuta ticks hasta el primero con golpes propios y devuelve su snapshot (falla tras `max`). */
export function untilHit(run: Run, max = 600, input = PlayerInput.NONE): RunSnapshot {
  for (let i = 0; i < max; i++) {
    run.tick(input);
    const s = run.snapshot();
    if (hitsOfTick(s).length > 0) return s;
  }
  throw new Error('sin golpes');
}

/** Tick en que impacta el primer proyectil del Linter por defecto con el jugador quieto. */
export function linterArrival(start: (weapons: readonly WeaponTypeConfig[]) => Run): number {
  return untilHit(start([LINTER])).tick;
}

/** Ejecuta los ticks 1 … at − 1 quieto y el tick `at` con `input`; devuelve el snapshot de `at`. */
export function jumpAt(run: Run, at: number, input = LEFT): RunSnapshot {
  for (let n = 1; n < at; n++) run.tick(PlayerInput.NONE);
  run.tick(input);
  return run.snapshot();
}
