import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { WeaponType, type WeaponTypeConfig } from './WeaponType';

export const WEAPON_ID_MUST_BE_UNIQUE = 'Identificador de arma repetido';
export const MAX_PROJECTILES_MUST_BE_INTEGER =
  'El tope de proyectiles debe ser un número entero ≥ 1.';
export const HIT_FLASH_TICKS_MUST_BE_INTEGER =
  'La duración del destello de daño debe ser un número entero de ticks ≥ 1.';

const PATH = 'weapons';

/** Forma del contenido de armas (content/weapons.json). */
export interface WeaponsConfig {
  readonly maxProjectiles: number;
  readonly hitFlashTicks: number;
  readonly weapons: readonly WeaponTypeConfig[];
}

const isCount = (v: number): boolean => Number.isInteger(v) && v >= 1;

/**
 * Armas equipadas al empezar (value object), en el orden del contenido, que es el orden en que
 * actúan en cada tick. Invariantes: ids únicos; tope de proyectiles y destello enteros ≥ 1. Una
 * lista vacía es válida en el dominio: que el fichero exija ≥ 1 arma es una regla de forma (zod).
 */
export class WeaponLoadout {
  /**
   * Cota exacta de pulsos visibles a la vez: Σ ⌈visualTicks / cooldownTicks⌉ de las armas de pulso
   * (un arma no dispara más de una vez cada `cooldownTicks`).
   */
  readonly pulseCapacity: number;

  private constructor(
    readonly weapons: readonly WeaponType[],
    readonly maxProjectiles: number,
    readonly hitFlashTicks: number,
  ) {
    let pulses = 0;
    for (const w of weapons) {
      if (w.attack.type === 'pulse') pulses += Math.ceil(w.attack.visualTicks / w.cooldownTicks);
    }
    this.pulseCapacity = pulses;
    Object.freeze(this);
  }

  static create(config: WeaponsConfig): Result<WeaponLoadout, DomainError> {
    const { maxProjectiles, hitFlashTicks } = config;
    if (!isCount(maxProjectiles)) {
      return err(invalidConfig(`${PATH}.maxProjectiles`, MAX_PROJECTILES_MUST_BE_INTEGER));
    }
    if (!isCount(hitFlashTicks)) {
      return err(invalidConfig(`${PATH}.hitFlashTicks`, HIT_FLASH_TICKS_MUST_BE_INTEGER));
    }
    const weapons: WeaponType[] = [];
    const ids = new Set<string>();
    for (const [i, entry] of config.weapons.entries()) {
      const path = `${PATH}.weapons.${String(i)}`;
      const type = WeaponType.create(entry, path);
      if (!type.ok) return type;
      if (ids.has(entry.id)) {
        return err(invalidConfig(`${path}.id`, `${WEAPON_ID_MUST_BE_UNIQUE}: ${entry.id}`));
      }
      ids.add(entry.id);
      weapons.push(type.value);
    }
    return ok(new WeaponLoadout(Object.freeze(weapons), maxProjectiles, hitFlashTicks));
  }
}
