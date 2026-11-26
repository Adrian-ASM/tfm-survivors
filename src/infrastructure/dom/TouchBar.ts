import type { MuteRequests } from '../audio/MuteRequests';
import { TOUCH_ICONS } from './touchIcons';

/** Etiquetas accesibles de la barra (el icono es una imagen sin texto alternativo propio). */
export const TOUCH_LABELS = {
  bar: 'Controles táctiles',
  pause: 'Pausa',
  restart: 'Reiniciar',
  fullscreen: 'Pantalla completa',
  mute: 'Silenciar',
  unmute: 'Activar sonido',
} as const;

/** Lo que la escena necesita de la barra (la implementa `TouchBar`). */
export interface TouchBarView {
  /** ¿Se ha tocado ⏸ desde la última lectura? La consume (una pulsación de Esc). */
  takePause(): boolean;
  /** ¿Se ha tocado ↻ desde la última lectura? La consume (una pulsación de R). */
  takeRestart(): boolean;
  /** ⏸ con partida no terminada; ↻ con la partida terminada. */
  sync(state: { readonly inRun: boolean; readonly ended: boolean }): void;
}

/**
 * Lectura combinada de dos fuentes de una misma pulsación (tecla y botón): las dos se leen y se
 * consumen antes de combinarse, así que pulsar las dos en el mismo frame cuenta como una sola.
 */
export const pressedOnce = (key: boolean, button: boolean): boolean => key || button;

function iconButton(doc: Document, label: string, icon: string, onTap: () => void) {
  const b = doc.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  const img = doc.createElement('img');
  img.setAttribute('alt', '');
  img.setAttribute('src', icon);
  b.append(img);
  b.addEventListener('click', () => {
    onTap();
    b.blur();
  });
  return b;
}

/**
 * Barra táctil DOM (spec touch-controls 0033, design §4.2): ⏸, ↻, silencio (0035) y, si el
 * navegador ofrece la pantalla completa, ⛶. Los toques de ⏸ y ↻ solo dejan una pulsación en cola
 * que la escena consume (patrón `PausePanel`); el de silencio marca una petición en `MuteRequests`
 * (equivale a M); ⛶ llama a su control directamente (gesto del usuario). Solo alterna `hidden` y
 * atributos.
 */
export class TouchBar implements TouchBarView {
  private pause = false;
  private restart = false;
  private readonly pauseButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly muteButton: HTMLButtonElement | undefined;

  constructor(
    doc: Document,
    parent: HTMLElement,
    fullscreen?: { toggle(): unknown },
    mute?: MuteRequests,
  ) {
    const bar = doc.createElement('nav');
    bar.className = 'touch-bar';
    bar.setAttribute('aria-label', TOUCH_LABELS.bar);
    this.pauseButton = iconButton(doc, TOUCH_LABELS.pause, TOUCH_ICONS.pause, () => {
      this.pause = true;
    });
    this.restartButton = iconButton(doc, TOUCH_LABELS.restart, TOUCH_ICONS.restart, () => {
      this.restart = true;
    });
    bar.append(this.pauseButton, this.restartButton);
    if (mute) {
      // Siempre visible en modo móvil (menú y partida): equivale a una pulsación de M.
      this.muteButton = iconButton(doc, TOUCH_LABELS.mute, TOUCH_ICONS.sound, () => {
        mute.mark();
      });
      bar.append(this.muteButton);
      this.setMuted(false);
    }
    if (fullscreen) {
      bar.append(
        iconButton(doc, TOUCH_LABELS.fullscreen, TOUCH_ICONS.fullscreen, () => {
          void fullscreen.toggle();
        }),
      );
    }
    this.sync({ inRun: false, ended: false });
    parent.append(bar);
  }

  /** Icono, etiqueta y `aria-pressed` del botón de silencio con el estado de los ajustes. */
  setMuted(muted: boolean): void {
    const b = this.muteButton;
    if (!b) return;
    b.setAttribute('aria-label', muted ? TOUCH_LABELS.unmute : TOUCH_LABELS.mute);
    b.setAttribute('aria-pressed', String(muted));
    b.children[0]?.setAttribute('src', muted ? TOUCH_ICONS.muted : TOUCH_ICONS.sound);
  }

  takePause(): boolean {
    const p = this.pause;
    this.pause = false;
    return p;
  }

  takeRestart(): boolean {
    const r = this.restart;
    this.restart = false;
    return r;
  }

  sync(state: { readonly inRun: boolean; readonly ended: boolean }): void {
    const pauseHidden = !(state.inRun && !state.ended);
    const restartHidden = !state.ended;
    // Una pulsación de un botón que se oculta no queda pendiente para otra pantalla.
    if (pauseHidden) this.pause = false;
    if (restartHidden) this.restart = false;
    this.pauseButton.hidden = pauseHidden;
    this.restartButton.hidden = restartHidden;
  }
}
