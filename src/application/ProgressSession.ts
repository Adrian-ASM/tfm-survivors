import type { Progress } from '../domain/progress/Progress';

/**
 * Progreso en uso durante una carga de la página, compartido por `RecordRun` e `ImportProgress`
 * (design 0007). Si el almacenamiento falla, el progreso sigue aquí en memoria.
 */
export interface ProgressSession {
  /** Progreso en uso (canónico). */
  progress: Progress;
  /** Resultado del último intento de lectura o escritura: false ⇒ "no se guarda". */
  persistent: boolean;
  /** Los datos guardados estaban dañados y aún no se han sobrescrito ni avisado en resultados. */
  corruptPending: boolean;
}
