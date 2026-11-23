import type { SpriteCount } from './PlayerView';
import { zeroCells, type CellCounts } from './TerrainView';

/**
 * Sonda de sprites para E2E (design D7, cierra 0009 · W2): visibles y con aspecto de reserva por
 * tipo, y reservas por tipo de enemigo. Las capas mantienen sus contadores de forma incremental.
 */
export interface SpriteCounts {
  readonly ground: SpriteCount;
  readonly player: SpriteCount;
  readonly enemies: SpriteCount;
  readonly corpses: SpriteCount;
  readonly projectiles: SpriteCount;
  readonly pulses: SpriteCount;
  readonly gems: SpriteCount;
  readonly enemyPlaceholders: Record<string, number>;
  /** Celdas del mapa pintadas por tipo (0015); no cuentan como fondo ni como reserva. */
  readonly cells: CellCounts;
}

const zero = (): SpriteCount => ({ visible: 0, placeholder: 0 });

/** Recuentos a 0 (modo menú) con las claves de enemigo preasignadas. */
export function emptyCounts(enemyIds: Iterable<string>): SpriteCounts {
  const enemyPlaceholders: Record<string, number> = {};
  for (const id of enemyIds) enemyPlaceholders[id] = 0;
  return {
    ground: zero(),
    player: zero(),
    enemies: zero(),
    corpses: zero(),
    projectiles: zero(),
    pulses: zero(),
    gems: zero(),
    enemyPlaceholders,
    cells: zeroCells(),
  };
}
