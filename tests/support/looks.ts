import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { resolveLooks, type Looks } from '../../src/infrastructure/phaser/art/looks';
import { REGISTERED, rawAppearance, type RawAppearance } from './appearance';

/**
 * Aspectos resueltos del fixture de `appearance.ts` (todas las hojas cargadas con 100 frames salvo
 * las de `missing`), tras aplicar `edit` a los datos crudos.
 */
export function someLooks(
  edit: (raw: RawAppearance) => void = () => undefined,
  missing: readonly string[] = [],
): Looks {
  const raw = rawAppearance();
  edit(raw);
  const r = parseAppearance(raw, REGISTERED);
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return resolveLooks(r.value, (key) => (missing.includes(key) ? null : 100));
}
