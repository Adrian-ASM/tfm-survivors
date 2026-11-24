import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot, WarningSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig, withPlayer } from '../support/builders';
import { cellsWith, mapRules } from '../support/mapLayouts';
import { botWorld, dodgeInput, isBlockedMove, referenceBot } from '../support/policies';
import { startRun } from '../support/runs';

// Spec run-outcome (0020), "Bot de referencia para el balance" v3: esquiva de avisos amenazantes
// (d < r_aviso + r_jugador + v/60) por suma de vectores unitarios, con la huida como respaldo.
// Mapa vacío, jugador de radio 16 y velocidad 215 (s = 3,5833) salvo que se diga otra cosa.

const directionOf = (input: PlayerInput) => ({ x: input.direction.x, y: input.direction.y });
const warning = (x: number, y: number, radius = 50): WarningSnapshot => ({
  x,
  y,
  radius,
  source: 'dynamite',
  explodesAt: 100,
});

/** Input del bot de referencia sobre el snapshot de una partida con los avisos dados. */
function botInput(
  setup: RunSetup,
  warnings: readonly WarningSnapshot[],
  config: RunConfig = aDefaultConfig(),
  run: Run = startRun(config, setup),
): PlayerInput {
  const snapshot: RunSnapshot = { ...run.snapshot(), warnings };
  return referenceBot(config, run.map).input(snapshot);
}

const PLAYER = { x: 1920, y: 1080 };

describe('dodgeInput (esquiva del bot de referencia v3)', () => {
  it('Scenario: La esquiva gana a la huida', () => {
    const setup = { player: PLAYER, enemies: [{ type: 'goblin-torch', x: 1870, y: 1080 }] };
    expect(directionOf(botInput(setup, []))).toEqual({ x: 1, y: 0 });
    expect(directionOf(botInput(setup, [warning(1960, 1080)]))).toEqual({ x: -1, y: 0 });
  });

  it('Scenario: Aviso no amenazante (a exactamente 50 + 16 + 3,5833 px)', () => {
    const threshold = 50 + 16 + 215 / 60;
    // El centro más cercano representable cuya distancia en coma flotante no baja del umbral.
    let x = 1920 + threshold;
    while (x - 1920 < threshold) x += 1e-12;
    expect(x - 1920 - threshold).toBeLessThan(1e-9);
    const input = botInput({ player: PLAYER }, [warning(x, 1080)]);
    expect(input).toBe(PlayerInput.NONE);
  });

  it('Scenario: Dos avisos que se anulan', () => {
    const setup = { player: PLAYER, enemies: [{ type: 'goblin-torch', x: 1920, y: 1180 }] };
    const input = botInput(setup, [warning(1880, 1080), warning(1960, 1080)]);
    expect(directionOf(input)).toEqual({ x: 0, y: -1 });
  });

  it('Scenario: Esquiva bloqueada por un tronco', () => {
    const config = withPlayer(aDefaultConfig(), { speed: 200 });
    const r = Run.start(
      config,
      new Mulberry32RandomGenerator(1),
      { player: { x: 584, y: 270 } },
      { kind: 'cells', cells: cellsWith(mapRules(), { '10,4': 'trunk' }) },
    );
    if (!r.ok) throw new Error(r.error.message);
    const snapshot = { ...r.value.snapshot(), warnings: [warning(560, 270)] };
    const world = botWorld(config, r.value.map);
    const blocked = (dx: number, dy: number) => isBlockedMove(snapshot, world, dx, dy);
    expect([blocked(1, 0), blocked(1, 1), blocked(1, -1)]).toEqual([true, true, true]);
    expect(directionOf(dodgeInput(snapshot, world))).toEqual({ x: 0, y: 1 });
  });

  it('en el centro exacto de todos los avisos amenazantes usa la huida', () => {
    const setup = { player: PLAYER, enemies: [{ type: 'goblin-torch', x: 2020, y: 1080 }] };
    expect(directionOf(botInput(setup, [warning(1920, 1080)]))).toEqual({ x: -1, y: 0 });
  });
});
