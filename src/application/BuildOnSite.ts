import type { Run } from '../domain/run/Run';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import { ok, type Result } from '../domain/shared/Result';
import type { BuildError } from '../domain/site/BuildError';

/**
 * Caso de uso: construir un tipo de edificio en el solar abierto (spec build-sites 0026). Devuelve el
 * snapshot tras construir, sin ejecutar ticks; un error tipado no cambia la partida ni consume azar.
 */
export class BuildOnSite {
  constructor(private readonly run: Run) {}

  execute(kind: string): Result<RunSnapshot, BuildError> {
    const built = this.run.build(kind);
    return built.ok ? ok(this.run.snapshot()) : built;
  }
}
