import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import type { RunStatus } from '../../domain/run/RunStatus';
import type { Result } from '../../domain/shared/Result';
import type { BuildError } from '../../domain/site/BuildError';

/** Acción pulsada en el panel de obra en este frame. */
export type BuildAction =
  { readonly kind: 'build'; readonly building: string } | { readonly kind: 'leave' } | null;

/** Los casos de uso de la obra (los de `StartedRun`). */
export interface BuildUseCases {
  readonly buildOnSite: { execute(kind: string): Result<RunSnapshot, BuildError> };
  readonly leaveSite: { execute(): Result<RunSnapshot, BuildError> };
}

/** Resultado del paso: si Esc queda libre para la pausa y el snapshot nuevo (si cambió algo). */
export interface BuildStep {
  readonly esc: boolean;
  readonly snapshot: RunSnapshot | null;
}

/** El panel de obra se ve si y solo si la partida está en obra y no en pausa. */
export const buildVisible = (status: RunStatus | undefined, paused: boolean): boolean =>
  !paused && status === 'building';

/**
 * Reglas del panel de obra en la escena (spec build-sites y main-menu 0026; patrón `ShopGate`, sin
 * import del motor): con la partida en obra, Esc o `Salir` ⇒ `LeaveSite` y Esc se consume (nunca
 * abre la pausa ese frame); una opción ⇒ `BuildOnSite` (un error no cambia nada). Fuera de la obra
 * no hace nada y deja pasar Esc. Va entre `ShopGate` y `PauseGate` en `GameScene.update`.
 */
export class BuildGate {
  step(esc: boolean, action: BuildAction, status: RunStatus, run: BuildUseCases): BuildStep {
    if (status !== 'building') return { esc, snapshot: null };
    if (esc || action?.kind === 'leave') {
      const left = run.leaveSite.execute();
      return { esc: false, snapshot: left.ok ? left.value : null };
    }
    if (action?.kind === 'build') {
      const built = run.buildOnSite.execute(action.building);
      return { esc: false, snapshot: built.ok ? built.value : null };
    }
    return { esc: false, snapshot: null };
  }
}
