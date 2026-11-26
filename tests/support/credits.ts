import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Texto de `CREDITS.md` del repositorio (0035 rev. 4): el guardarraíl lo exige para las entradas CC-BY de
 * la lista de audio, así que las comprobaciones de `checkAssets` sobre la nota real lo pasan como `credits`.
 */
export const REPO_CREDITS = readFileSync(
  join(import.meta.dirname, '..', '..', 'CREDITS.md'),
  'utf8',
);
