import type { StartedRun } from '../../application/StartRun';

/**
 * Lo que `GameScene` pide al entrar (design 0009): una partida nueva, creada en ese momento.
 * `null` significa que la composición ya ha pintado el error de contenido. Es un tipo de la
 * escena, no un puerto: lo implementa la composición (`createRunLauncher`).
 */
export interface RunLauncher {
  launch(): StartedRun | null;
}
