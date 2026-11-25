import type { StateCounts } from './EnemyLayer';
import type { SpriteCount } from './PlayerView';
import type { PickupCounts } from './PickupLayer';
import { zeroSheepCounts, type SheepCounts } from './SheepLayer';
import { zeroCells, zeroMapArt, type CellCounts, type MapArtProbe } from './TerrainView';
import { zeroStructureCounts, type StructureCount } from './StructureArt';

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
  /** Recogibles visibles por tipo (0022). */
  readonly pickups: PickupCounts;
  /** Alias de `pickups.xp` (el mismo objeto), para las sondas de antes de 0022. */
  readonly gems: SpriteCount;
  /** Ovejas pintadas, con reserva y por estado (0023). */
  readonly sheep: SheepCounts;
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
  /** Por tipo de estructura (0021): intactas, ruinas y cuántas con reserva; del plan y del estado. */
  readonly structures: Record<string, StructureCount>;
  /** Vetas pintadas (0022): activas, agotadas y cuántas con su círculo de reserva. */
  readonly veins: VeinCount;
}

/** Clave de las vetas en su `StructureArt` (un solo "tipo"). */
export const VEIN_KEY = 'vein';

/** Vetas de la sonda `sprites.veins` (0022). */
export interface VeinCount {
  readonly active: number;
  readonly depleted: number;
  readonly fallback: number;
}

/**
 * Vista viva de los recuentos de `StructureArt` con los nombres de las vetas: activa = intacta,
 * agotada = ruina. Sin copiar: la sonda lee siempre el estado actual.
 */
export function veinCounts(c: StructureCount | undefined): VeinCount {
  const source = c ?? { intact: 0, ruin: 0, fallback: 0 };
  return {
    get active() {
      return source.intact;
    },
    get depleted() {
      return source.ruin;
    },
    get fallback() {
      return source.fallback;
    },
  };
}

const zero = (): SpriteCount => ({ visible: 0, placeholder: 0 });

/** Recuentos a 0 (modo menú) con las claves de enemigo y de estructura preasignadas. */
export function emptyCounts(
  enemyIds: Iterable<string>,
  structureTypes: Iterable<string> = [],
): SpriteCounts {
  const enemyPlaceholders: Record<string, number> = {};
  for (const id of enemyIds) enemyPlaceholders[id] = 0;
  const pickups = { xp: zero(), gold: zero(), wood: zero(), meat: zero(), stone: zero() };
  return {
    ground: zero(),
    player: zero(),
    enemies: zero(),
    corpses: zero(),
    projectiles: zero(),
    pulses: zero(),
    pickups,
    gems: pickups.xp,
    sheep: zeroSheepCounts(),
    enemyPlaceholders,
    enemyStates: { chase: 0, fuse: 0, charge: 0, wait: 0, patrol: 0, alert: 0, return: 0 },
    warnings: zero(),
    dynamites: zero(),
    explosions: zero(),
    cells: zeroCells(),
    mapArt: zeroMapArt(),
    structures: zeroStructureCounts(structureTypes),
    veins: { active: 0, depleted: 0, fallback: 0 },
  };
}
