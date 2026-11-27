import type { AudioSettings } from '../audio/audioVolumes';
import { closeButton, setPanelHidden } from './button';
import { MENU_LABELS, soundPercent } from './menuText';

/** Paso de los deslizadores (spec audio, convenciones): constante de interfaz, no de contenido. */
export const SLIDER_STEP = 5;

/** Lo que el panel necesita de los ajustes (lo implementa `AudioSettingsStore`). */
export interface SoundSettings {
  readonly settings: AudioSettings;
  preview(field: 'music' | 'effects', value: number): void;
  commit(): void;
  setMuted(muted: boolean): void;
  subscribe(listener: (settings: AudioSettings) => void): void;
}

/** Estado observable del panel para los tests de Node (no es una sonda E2E). */
export interface SoundPanelView {
  readonly open: boolean;
  readonly music: string;
  readonly effects: string;
  readonly muted: boolean;
  /** Si su escucha de `keydown` (Esc desde el menú) está registrada en el documento. */
  readonly listening: boolean;
}

/** Cómo se abre: desde el menú el panel cierra con Esc; desde la pausa, Esc lo lleva la escena. */
export interface SoundPanelOpen {
  readonly escCloses: boolean;
}

const TITLE_ID = 'sound-panel-title';

interface Slider {
  readonly input: HTMLInputElement;
  readonly output: HTMLElement;
}

/**
 * Panel modal `Sonido` (spec audio 0035, design D10), con el patrón de `GuideModal`: deslizadores
 * `Música` y `Efectos` (0..100, paso 5, con su `N %`), la casilla `Silenciar todo` y la ×
 * (`Cerrar`). El `input` aplica al instante (`preview`) y el `change` guarda (`commit`): 1 escritura
 * por flecha o por arrastre soltado. Refleja cualquier cambio de los ajustes (M, botón táctil). Solo
 * `textContent`, atributos, clases, `hidden` y `addEventListener` (CSP estricta, sin `style`).
 */
export class SoundPanel {
  private readonly root: HTMLElement;
  private readonly music: Slider;
  private readonly effects: Slider;
  private readonly mute: HTMLInputElement;
  private onClosed: (() => void) | null = null;
  private listening = false;

  constructor(
    private readonly doc: Document,
    parent: HTMLElement,
    private readonly store: SoundSettings,
  ) {
    this.root = doc.createElement('div');
    this.root.className = 'sound-panel';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', TITLE_ID);
    this.root.setAttribute('tabindex', '-1');
    this.root.hidden = true;

    const header = doc.createElement('header');
    header.className = 'sound-panel__header';
    const title = doc.createElement('h2');
    title.setAttribute('id', TITLE_ID);
    title.textContent = MENU_LABELS.sound;
    header.append(title);

    const body = doc.createElement('div');
    body.className = 'sound-panel__body';
    const [musicRow, music] = this.slider(MENU_LABELS.soundMusic, 'music');
    const [effectsRow, effects] = this.slider(MENU_LABELS.soundEffects, 'effects');
    this.music = music;
    this.effects = effects;

    const muteRow = doc.createElement('label');
    muteRow.className = 'sound-panel__check';
    this.mute = doc.createElement('input');
    this.mute.type = 'checkbox';
    this.mute.addEventListener('change', () => {
      store.setMuted(this.mute.checked);
    });
    const muteText = doc.createElement('span');
    muteText.textContent = MENU_LABELS.soundMute;
    muteRow.append(this.mute, muteText);
    body.append(musicRow, effectsRow, muteRow);

    // 0036: la × de la esquina (nombre accesible `Cerrar`) sustituye a `.sound-panel__actions`.
    const close = closeButton(doc, MENU_LABELS.soundClose, () => {
      this.close();
    });

    this.root.append(header, body, close);
    parent.append(this.root);
    store.subscribe((s) => {
      this.sync(s);
    });
    this.sync(store.settings);
  }

  get open(): boolean {
    return this.onClosed !== null;
  }

  get view(): SoundPanelView {
    return {
      open: this.open,
      music: this.music.output.textContent,
      effects: this.effects.output.textContent,
      muted: this.mute.checked,
      listening: this.listening,
    };
  }

  /** Abre con los ajustes en uso y el foco en el primer deslizador; abierto ya, no hace nada. */
  show(onClosed: () => void, how: SoundPanelOpen): void {
    if (this.onClosed !== null) return;
    this.onClosed = onClosed;
    this.sync(this.store.settings);
    setPanelHidden(this.root, false);
    if (how.escCloses) {
      this.doc.addEventListener('keydown', this.onKey);
      this.listening = true;
    }
    this.music.input.focus();
  }

  /** Idempotente: solo si estaba abierto quita la escucha, oculta y llama a `onClosed` una vez. */
  close(): void {
    const onClosed = this.onClosed;
    if (onClosed === null) return;
    this.onClosed = null;
    if (this.listening) this.doc.removeEventListener('keydown', this.onKey);
    this.listening = false;
    setPanelHidden(this.root, true);
    onClosed();
  }

  /** Esc desde el menú (misma referencia en el alta y en la baja). */
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    if (e.repeat) return;
    this.close();
  };

  private slider(label: string, field: 'music' | 'effects'): [HTMLElement, Slider] {
    const row = this.doc.createElement('label');
    row.className = 'sound-panel__row';
    const text = this.doc.createElement('span');
    text.textContent = label;
    const input = this.doc.createElement('input');
    input.type = 'range';
    input.className = 'sound-panel__slider';
    input.setAttribute('min', '0');
    input.setAttribute('max', '100');
    input.setAttribute('step', String(SLIDER_STEP));
    input.setAttribute('aria-label', label);
    const output = this.doc.createElement('output');
    output.className = 'sound-panel__value';
    input.addEventListener('input', () => {
      this.store.preview(field, Number(input.value));
    });
    input.addEventListener('change', () => {
      this.store.commit();
    });
    row.append(text, input, output);
    return [row, { input, output }];
  }

  private sync(s: AudioSettings): void {
    this.music.input.value = String(s.music);
    this.music.output.textContent = soundPercent(s.music);
    this.effects.input.value = String(s.effects);
    this.effects.output.textContent = soundPercent(s.effects);
    this.mute.checked = s.muted;
  }
}
