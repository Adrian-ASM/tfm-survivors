import { invalidConfig, type DomainError } from '../shared/Result';

/** Mensaje de la invariante; la validación de contenido (zod) usa el mismo. */
export const LEVEL_UP_HEAL_PERCENT_OUT_OF_RANGE =
  'La curación por subida sin mejoras debe ser un entero entre 1 y 100 (% de la vida máxima).';

/** Curación por subida sin mejoras de personaje disponibles (content/progression.json, 0024). */
export interface LevelUpHealConfig {
  readonly levelUpHealPercent: number;
}

/** ¿Es un entero en [1, 100]? (`null` si lo es; si no, el error que nombra el campo). */
export function checkLevelUpHeal(config: LevelUpHealConfig): DomainError | null {
  const p = config.levelUpHealPercent;
  if (Number.isInteger(p) && p >= 1 && p <= 100) return null;
  return invalidConfig('progression.levelUpHealPercent', LEVEL_UP_HEAL_PERCENT_OUT_OF_RANGE);
}

/**
 * Vida que cura cada subida sin mejoras (spec leveling 0024): `max(1, ⌊% × máx / 100⌋)` con la
 * vida máxima efectiva de ese momento.
 */
export const levelUpHeal = (percent: number, maxHealth: number): number =>
  Math.max(1, Math.floor((percent * maxHealth) / 100));
