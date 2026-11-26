import type { PauseAction } from './PauseGate';

/** Lo que la escena necesita del panel Sonido abierto desde la pausa (0035, design D10). */
export interface SoundPanelLike {
  readonly open: boolean;
  close(): void;
}

/** Captura global del teclado del motor (`KeyboardPlugin`, Phaser 4.2.1). */
export interface KeyCapture {
  enableGlobalCapture(): unknown;
  disableGlobalCapture(): unknown;
}

/** Entradas del frame que el panel puede consumir. */
export interface FrameKeys {
  /** Esc o ⏸ ya combinados (`pressedOnce`). */
  readonly esc: boolean;
  readonly action: PauseAction;
  readonly restart: boolean;
  /** Índice de la opción elegida (−1 si ninguna). */
  readonly index: number;
}

const NOTHING: FrameKeys = { esc: false, action: null, restart: false, index: -1 };

/**
 * Puerta del panel Sonido en la escena (spec main-menu y touch-controls 0035, design D10), sin
 * motor (patrón `PauseGate`): con el panel abierto, Esc o ⏸ lo cierran y se consumen (la pausa
 * sigue), y la acción de la pausa, R y la elección se descartan. Además apaga la captura global del
 * teclado mientras está abierto (las flechas mueven el deslizador con el foco) y la vuelve a
 * encender al cerrarse.
 */
export class SoundPanelGate {
  private captureOff = false;

  constructor(
    private readonly panel: SoundPanelLike | undefined,
    private readonly capture: KeyCapture,
  ) {}

  step(keys: FrameKeys): FrameKeys {
    const panel = this.panel;
    if (!panel?.open) {
      this.setCapture(false);
      return keys;
    }
    if (keys.esc) panel.close();
    this.setCapture(panel.open);
    return NOTHING;
  }

  private setCapture(off: boolean): void {
    if (off === this.captureOff) return;
    this.captureOff = off;
    if (off) this.capture.disableGlobalCapture();
    else this.capture.enableGlobalCapture();
  }
}
