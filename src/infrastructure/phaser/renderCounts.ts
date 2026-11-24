import type { StateCounts } from './EnemyLayer';
import type { SpriteCount } from './PlayerView';
import { zeroCells, zeroMapArt, type CellCounts, type MapArtProbe } from './TerrainView';

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
  /** Sprites de enemigo vivo por clase de estado de comportamiento (0020). */
  readonly enemyStates: StateCounts;
  /** Avisos en el suelo pintados (nunca reserva), dinamitas y explosiones (0020). */
  readonly warnings: SpriteCount;
  readonly dynamites: SpriteCount;
  readonly explosions: SpriteCount;
  /** Celdas del mapa pintadas por tipo (0015, `castle` desde 0016); no son fondo ni reserva. */
  readonly cells: CellCounts;
  /** Elementos del mapa pintados, con su reserva, y objetos de escena del mapa (0016). */
  readonly mapArt: MapArtProbe;
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
    enemyStates: { chase: 0, fuse: 0, charge: 0, wait: 0 },
    warnings: zero(),
    dynamites: zero(),
    explosions: zero(),
    cells: zeroCells(),
    mapArt: zeroMapArt(),
  };
}
