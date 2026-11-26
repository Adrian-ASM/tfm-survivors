/**
 * Lo que se usa de la Fullscreen API y de la Screen Orientation API (costura sin DOM, 0033). La
 * composición lo construye con `document.fullscreenEnabled`, `documentElement.requestFullscreen`,
 * `document.exitFullscreen` y `screen.orientation.lock`; cualquiera puede faltar (iPhone).
 */
export interface FullscreenLike {
  readonly enabled: boolean;
  /** Elemento a pantalla completa (null fuera de ella). */
  readonly element: unknown;
  readonly request?: () => Promise<unknown>;
  readonly exit?: () => Promise<unknown>;
  readonly lockLandscape?: () => Promise<unknown>;
}

/**
 * Botón ⛶ (spec touch-controls 0033, design §4.3): fuera de pantalla completa la pide para el
 * documento y, si se concede, intenta bloquear la orientación en horizontal; dentro, sale. Todo es
 * *best effort*: un rechazo o un error se tragan y nunca llegan a la partida ni al menú.
 */
export class FullscreenControl {
  constructor(private readonly api: FullscreenLike) {}

  /** El navegador ofrece la pantalla completa (sin ella, ⛶ no existe). */
  get available(): boolean {
    return this.api.enabled && typeof this.api.request === 'function';
  }

  async toggle(): Promise<void> {
    const { api } = this;
    if (api.element) {
      try {
        await api.exit?.();
      } catch {
        // best effort: seguir en pantalla completa no cambia la partida
      }
      return;
    }
    try {
      if (!api.request) return;
      await api.request();
    } catch {
      return; // pantalla completa rechazada: sin bloqueo de orientación
    }
    try {
      await api.lockLandscape?.();
    } catch {
      // bloqueo rechazado o no admitido: la pantalla completa ya está concedida
    }
  }
}
