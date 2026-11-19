/**
 * Estado de la partida (spec run-state): en curso, eligiendo mejora (oferta abierta: simulación
 * congelada) o terminada. El paso a `over` es irreversible y solo ocurre desde `running`.
 */
export type RunStatus = 'running' | 'choosing' | 'over';
