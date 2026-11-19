import type { Run } from '../domain/run/Run';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import { ok, type Result } from '../domain/shared/Result';
import type { UpgradeChoiceError } from '../domain/upgrade/UpgradeChoiceError';

/**
 * Caso de uso: elegir por índice una opción de la oferta abierta (spec upgrades). Devuelve el
 * snapshot tras la elección; un error tipado no cambia la partida ni consume azar.
 */
export class ChooseUpgrade {
  constructor(private readonly run: Run) {}

  execute(index: number): Result<RunSnapshot, UpgradeChoiceError> {
    const chosen = this.run.chooseUpgrade(index);
    return chosen.ok ? ok(this.run.snapshot()) : chosen;
  }
}
