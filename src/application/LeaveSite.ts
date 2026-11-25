import type { Run } from '../domain/run/Run';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import { ok, type Result } from '../domain/shared/Result';
import type { BuildError } from '../domain/site/BuildError';

/**
 * Caso de uso: salir de la obra sin construir (spec build-sites 0026). Devuelve el snapshot en curso
 * sin ejecutar ticks; fuera de la obra, un error tipado sin cambios.
 */
export class LeaveSite {
  constructor(private readonly run: Run) {}

  execute(): Result<RunSnapshot, BuildError> {
    const left = this.run.leaveSite();
    return left.ok ? ok(this.run.snapshot()) : left;
  }
}
