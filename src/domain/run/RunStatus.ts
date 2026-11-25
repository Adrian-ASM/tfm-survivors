import type { RunPhase } from './RunPhase';

/**
 * Estado de la partida (spec run-state): en curso, eligiendo mejora (oferta abierta: simulación
 * congelada), en tienda (0024, también congelada), en obra (0026, también congelada) o terminada. El paso a `over` es irreversible y solo ocurre desde `running`.
 */
export type RunStatus = RunPhase['status'];
