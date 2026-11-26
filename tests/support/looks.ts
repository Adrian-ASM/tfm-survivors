import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Appearance } from '../../src/infrastructure/content/appearanceSchema';
import { ASSET_DIR } from '../../src/infrastructure/content/appearanceSchema';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import {
  resolveLooks,
  type FrameCount,
  type Looks,
} from '../../src/infrastructure/phaser/art/looks';
import { sheetsToLoad } from '../../src/infrastructure/phaser/bootPlan';
import { REGISTERED, rawAppearance, type RawAppearance } from './appearance';
import { repoAppearance } from './mapArt';
import { GENERATED_PATHS } from './generated';

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
  const r = parseAppearance(raw, REGISTERED, GENERATED_PATHS);
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return resolveLooks(r.value, (key) => (missing.includes(key) ? null : 100));
}

const root = join(import.meta.dirname, '..', '..');

/**
 * Frames reales de las hojas de unos datos de aspecto (como `frameTotal − 1` en Phaser): la rejilla
 * de su tamaño de frame sobre el PNG versionado (cabecera IHDR), salvo las de `missing`.
 */
export function pngFrames(appearance: Appearance, missing: readonly string[] = []): FrameCount {
  const counts = new Map<string, number>();
  for (const sheet of sheetsToLoad(appearance)) {
    const png = readFileSync(join(root, ASSET_DIR, sheet.file));
    const cols = Math.floor(png.readUInt32BE(16) / sheet.frameWidth);
    const rows = Math.floor(png.readUInt32BE(20) / sheet.frameHeight);
    counts.set(sheet.file, cols * rows);
  }
  return (key) => (missing.includes(key) ? null : (counts.get(key) ?? null));
}

/** Aspectos de los datos del repositorio contra sus PNG reales (0030), salvo las hojas de `missing`. */
export function repoLooks(
  missing: readonly string[] = [],
  edit: (a: Appearance) => Appearance = (a) => a,
): Looks {
  const a = edit(repoAppearance());
  return resolveLooks(a, pngFrames(a, missing));
}
