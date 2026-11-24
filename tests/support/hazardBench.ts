import type { RunSetup } from '../../src/domain/run/RunSetup';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { StateConfig } from '../../src/domain/enemy/behavior/BehaviorConfig';

/** Enemigos de cada grupo del peor caso con peligros (spec simulation-loop 0020): 3 × 100 = 300. */
export const HAZARD_GROUP = 100;
/** Ticks de cada bloque medido: la partida se rehace con `RunSetup` cada 60, fuera del tiempo. */
export const HAZARD_BLOCK_TICKS = 60;

function stateOf(config: RunConfig, typeId: string, kind: StateConfig['kind']): StateConfig {
  const type = config.enemies.types.find((t) => t.id === typeId);
  const state = type?.behavior.states.find((s) => s.kind === kind);
  if (!state) throw new Error(`${typeId} sin estado ${kind}`);
  return state;
}

/**
 * Preparación del "Peor caso con peligros" (spec simulation-loop, 0020) para el contenido dado y el
 * jugador quieto en `at` (su salida): 100 `goblin-torch` encima del jugador (cada explosión en él
 * tiene ≥ 50 enemigos dentro), 100 `goblin-barrel` en mecha escalonada (explotan del tick 1 al 40)
 * y 100 `goblin-tnt` en carga ya lista (relanzan en cuanto hay sitio), más el tope de dinamitas en
 * vuelo hacia el jugador con los vuelos repartidos. Los enemigos no comparten celda con el jugador
 * salvo los del montón; las mechas y las cargas no se mueven.
 */
export function hazardWorstCase(config: RunConfig, at: { x: number; y: number }): RunSetup {
  const fuse = stateOf(config, 'goblin-barrel', 'fuse');
  const charge = stateOf(config, 'goblin-tnt', 'charge');
  if (fuse.kind !== 'fuse' || charge.kind !== 'charge') throw new Error('clases inesperadas');
  const grid = (i: number, dx: number) => ({
    x: at.x + dx + 40 * (i % 10),
    y: at.y - 200 + 40 * Math.floor(i / 10),
  });
  const torches = Array.from({ length: HAZARD_GROUP }, () => ({ type: 'goblin-torch', ...at }));
  const barrels = Array.from({ length: HAZARD_GROUP }, (_, i) => ({
    type: 'goblin-barrel',
    ...grid(i, 300),
    state: fuse.name,
    elapsed: i % fuse.ticks,
  }));
  const tnts = Array.from({ length: HAZARD_GROUP }, (_, i) => ({
    type: 'goblin-tnt',
    ...grid(i, -700),
    state: charge.name,
    elapsed: charge.ticks - 1,
  }));
  const { maxDynamites } = config.enemies.hazards;
  const flight = charge.dynamite.flightTicks;
  const dynamites = Array.from({ length: maxDynamites }, (_, i) => ({
    x: at.x - 700,
    y: at.y,
    targetX: at.x,
    targetY: at.y,
    ticksLeft: 1 + Math.floor((i * flight) / maxDynamites),
    radius: charge.dynamite.radius,
    damage: charge.dynamite.damage,
  }));
  return { player: at, enemies: [...torches, ...barrels, ...tnts], dynamites };
}
