import type { Arena } from '../arena/Arena';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { ENEMY_ID_MUST_BE_UNIQUE, EnemyType, type EnemyTypeConfig } from './EnemyType';

const PATH = 'enemies.types';

/** Catálogo de tipos de enemigo (value object). Invariante: identificadores únicos. */
export class EnemyCatalog {
  /** El tipo de mayor coste (el primero en caso de empate); `undefined` si el catálogo está vacío. */
  readonly mostExpensive: EnemyType | undefined;

  private constructor(private readonly byId: ReadonlyMap<string, EnemyType>) {
    let top: EnemyType | undefined;
    for (const type of byId.values()) if (!top || type.cost > top.cost) top = type;
    this.mostExpensive = top;
    Object.freeze(this);
  }

  /** Coste del tipo más caro (0 si el catálogo está vacío). */
  get maxCost(): number {
    return this.mostExpensive?.cost ?? 0;
  }

  static create(
    configs: readonly EnemyTypeConfig[],
    arena: Arena,
  ): Result<EnemyCatalog, DomainError> {
    const byId = new Map<string, EnemyType>();
    for (const [i, config] of configs.entries()) {
      const type = EnemyType.create(config, arena, `${PATH}.${String(i)}`);
      if (!type.ok) return type;
      if (byId.has(config.id)) {
        const message = `${ENEMY_ID_MUST_BE_UNIQUE}: ${config.id}`;
        return err(invalidConfig(`${PATH}.${String(i)}.id`, message));
      }
      byId.set(config.id, type.value);
    }
    return ok(new EnemyCatalog(byId));
  }

  get ids(): readonly string[] {
    return [...this.byId.keys()];
  }

  get(id: string): EnemyType | undefined {
    return this.byId.get(id);
  }
}
