/**
 * Peticiones de silencio (design 0035 D11): la tecla M y el botón táctil solo marcan; la composición
 * consume una vez por frame del juego. Dos marcas en el mismo frame son un solo cambio.
 */
export class MuteRequests {
  private pending = false;

  mark(): void {
    this.pending = true;
  }

  /** ¿Hay petición desde la última lectura? La consume. */
  take(): boolean {
    const p = this.pending;
    this.pending = false;
    return p;
  }
}

/** Consume la petición del frame y, si la hay, conmuta el silencio (1 cambio y 1 escritura). */
export function applyMute(
  requests: MuteRequests,
  store: { readonly settings: { readonly muted: boolean }; setMuted(muted: boolean): void },
): void {
  if (requests.take()) store.setMuted(!store.settings.muted);
}
