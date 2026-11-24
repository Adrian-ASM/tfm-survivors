import type { EnemyCatalog } from '../enemy/EnemyCatalog';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import {
  STRUCTURE_PLACEMENT_MUST_BE_INTEGER,
  StructureType,
  type StructureGrid,
  type StructurePlacementConfig,
  type StructuresConfig,
} from './StructureType';

const PATH = 'structures';

/** Distancias de colocación (enteros ≥ 0) y `maxAttempts` (entero ≥ 1), o el campo inválido. */
function checkPlacement(p: StructurePlacementConfig): DomainError | null {
  const distances = ['minStartCells', 'minCastleCells', 'minWaterCells', 'minGapCells'] as const;
  const bad = distances.find((k) => !Number.isInteger(p[k]) || p[k] < 0);
  const field =
    bad ?? (Number.isInteger(p.maxAttempts) && p.maxAttempts >= 1 ? null : 'maxAttempts');
  return field
    ? invalidConfig(`${PATH}.placement.${field}`, STRUCTURE_PLACEMENT_MUST_BE_INTEGER)
    : null;
}

/**
 * Reglas de las estructuras de la partida (value object, ADR-0020): parámetros de colocación y
 * tipos en el orden del contenido, que es el de colocación.
 */
export class StructureRules {
  private constructor(
    readonly placement: StructurePlacementConfig,
    readonly types: readonly StructureType[],
  ) {
    Object.freeze(this);
  }

  /** Tipo por id, o `undefined`. */
  byId(id: string): StructureType | undefined {
    return this.types.find((t) => t.id === id);
  }

  static create(
    config: StructuresConfig,
    grid: StructureGrid,
    catalog: EnemyCatalog,
  ): Result<StructureRules, DomainError> {
    const placementError = checkPlacement(config.placement);
    if (placementError) return err(placementError);
    const types: StructureType[] = [];
    for (const [id, t] of Object.entries(config.types)) {
      const type = StructureType.create(id, t, grid, catalog, `${PATH}.types.${id}`);
      if (!type.ok) return type;
      types.push(type.value);
    }
    return ok(new StructureRules(Object.freeze({ ...config.placement }), Object.freeze(types)));
  }
}
