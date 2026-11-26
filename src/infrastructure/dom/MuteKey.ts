import type { MuteRequests } from '../audio/MuteRequests';

/** Lo mínimo del documento que escucha la tecla M. */
export interface KeyTarget {
  addEventListener(type: 'keydown', fn: (e: KeyboardEvent) => void): void;
}

/**
 * Tecla M (spec audio 0035, "Tecla M", design D11): un `keydown` en el documento con `code` `KeyM`,
 * sin repetición y sin Alt, Ctrl ni Meta, marca una petición de silencio. No está en el teclado del
 * motor, así que no mueve al jugador ni lo ve la guía; no llama a `preventDefault`. Vive lo que la
 * página.
 */
export function listenMuteKey(target: KeyTarget, requests: MuteRequests): void {
  target.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyM' || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    requests.mark();
  });
}
