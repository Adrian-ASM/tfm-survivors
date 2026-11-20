import type { ImportProgress } from '../../application/ImportProgress';
import type { PanelMessage } from '../dom/resultsPanelText';
import { readProgressFile } from './readProgressFile';

/**
 * Import de un fichero elegido por el jugador, igual desde resultados y desde el menú (spec
 * progress-persistence): mismo límite de 64 KiB, misma validación y mismo mensaje. Un fichero
 * rechazado no llega a `ImportProgress`, así que el progreso no cambia.
 */
export async function importFromFile(
  file: Pick<Blob, 'size' | 'text'>,
  importProgress: Pick<ImportProgress, 'execute'>,
): Promise<PanelMessage> {
  const read = await readProgressFile(file);
  if (read.ok) {
    importProgress.execute(read.value);
    return 'imported';
  }
  return read.error.code === 'too-large' ? 'too-large' : 'invalid';
}
