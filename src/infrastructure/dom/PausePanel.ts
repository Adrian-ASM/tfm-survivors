import type { PauseAction } from '../phaser/PauseGate';
import { button, setPanelHidden } from './button';
import { MENU_LABELS } from './menuText';
import type { SoundPanel } from './SoundPanel';

/**
 * Overlay DOM de la pausa (ADR-0011): texto `Pausa`, `Reanudar`, `Sonido` (0035) y `Volver al
 * menú`. Los clics de Reanudar y Volver solo dejan una acción que la escena consume en su `update`
 * con `takeAction`; las reglas están en `PauseGate`. `Sonido` abre el panel de audio y bloquea los
 * botones mientras está abierto: Esc y ⏸ los atiende la escena (`soundPanelGate`), no el panel. Se
 * crea una vez y se muestra u oculta con `setVisible`.
 */
export class PausePanel {
  private readonly root: HTMLElement;
  private readonly buttons: HTMLButtonElement[];
  private action: PauseAction = null;

  constructor(
    doc: Document,
    parent: HTMLElement,
    private readonly sound?: Pick<SoundPanel, 'show' | 'close'>,
  ) {
    this.root = doc.createElement('section');
    this.root.className = 'pause-panel';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', MENU_LABELS.pause);
    this.root.hidden = true;
    const title = doc.createElement('h2');
    title.textContent = MENU_LABELS.pause;
    const actions = doc.createElement('div');
    actions.className = 'pause-panel__actions';
    const resume = button(doc, MENU_LABELS.resume, () => {
      this.action = 'resume';
    });
    const toMenu = button(doc, MENU_LABELS.toMenu, () => {
      this.action = 'menu';
    });
    this.buttons = [resume];
    if (sound) {
      const soundButton = button(doc, MENU_LABELS.sound, () => {
        this.setLocked(true);
        sound.show(
          () => {
            this.setLocked(false);
            soundButton.focus();
          },
          { escCloses: false },
        );
      });
      this.buttons.push(soundButton);
    }
    this.buttons.push(toMenu);
    actions.append(...this.buttons);
    this.root.append(title, actions);
    parent.append(this.root);
  }

  /** Botón pulsado desde la última lectura (la consume). */
  takeAction(): PauseAction {
    const action = this.action;
    this.action = null;
    return action;
  }

  setVisible(visible: boolean): void {
    if (!visible) {
      this.action = null;
      this.sound?.close();
    }
    setPanelHidden(this.root, !visible);
  }

  /** Con el panel Sonido abierto, los botones de la pausa no se pueden pulsar. */
  setLocked(locked: boolean): void {
    for (const b of this.buttons) b.disabled = locked;
    if (locked) this.action = null;
  }
}
