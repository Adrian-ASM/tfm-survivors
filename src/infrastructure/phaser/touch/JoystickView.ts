import type { PlayerInput } from '../../../domain/player/PlayerInput';
import type { ScreenFrame } from '../ui/screenFrame';
import { HUD_BASE } from '../ui/uiLayout';
import { isStill } from './preferKeyboard';
import type { StickState } from './TouchJoystick';

/** Lo que se usa de un `Phaser.GameObjects.Graphics` (costura sin motor). */
export interface StickCanvas {
  clear(): unknown;
  fillStyle(color: number, alpha?: number): unknown;
  fillCircle(x: number, y: number, radius: number): unknown;
}

/** Lo que se usa de un `Phaser.GameObjects.Text` para la indicación. */
export interface HintText {
  setText(text: string): unknown;
  setPosition(x: number, y: number): unknown;
  setFontSize(size: number): unknown;
  setVisible(visible: boolean): unknown;
}

// Presentación del joystick (no es contenido de juego): base clara y pomo, tenues en reposo.
const BASE_COLOR = 0xffffff;
const KNOB_COLOR = 0xffffff;
const ACTIVE_BASE_ALPHA = 0.18;
const ACTIVE_KNOB_ALPHA = 0.5;
const HINT_BASE_ALPHA = 0.1;
const HINT_KNOB_ALPHA = 0.25;
/** Radio del pomo en fracción del radio de la base. */
const KNOB_FRACTION = 0.45;
/** Separación entre la base en reposo y el texto, en múltiplos del margen del HUD. */
const HINT_TEXT_GAP = 0.5;
/** Decimales de la clave de repintado (unidades del lienzo). */
const KEY_DECIMALS = 1;

/**
 * Joystick pintado e indicación en reposo (spec touch-controls 0033, design §4.1): un `Graphics` y
 * un `Text` creados una vez en el HUD (`scrollFactor` 0). Activo: base en el centro y pomo en
 * centro + vector · radio. En reposo, si no ha habido movimiento en la partida y se juega, la base
 * tenue abajo a la izquierda con el texto encima (el `Text` llega con origen (0, 1)). Solo repinta
 * si cambia lo que se ve. No es interactivo: tocar encima crea el joystick.
 */
export class JoystickView {
  private moved = false;
  private key = '';
  private frame: ScreenFrame = { width: 1, height: 1, uiScale: 1 };
  private radius: number;
  private hintShown = false;

  constructor(
    private readonly canvas: StickCanvas,
    private readonly text: HintText,
    hint: string,
    private readonly radiusPx: number,
  ) {
    this.radius = radiusPx;
    text.setText(hint);
    text.setVisible(false);
  }

  /** Indicación visible en el último `sync` (para la sonda E2E). */
  get hintVisible(): boolean {
    return this.hintShown;
  }

  /** Frame nuevo: radio en unidades del lienzo (el del contenido está en px CSS) y texto × k. */
  relayout(frame: ScreenFrame, cssPerUnit: number): void {
    this.frame = frame;
    const s = Number.isFinite(cssPerUnit) && cssPerUnit > 0 ? cssPerUnit : 1;
    this.radius = this.radiusPx / s;
    this.text.setFontSize(HUD_BASE.fontSize * frame.uiScale);
    this.key = '';
  }

  /** Partida nueva: la indicación vuelve (spec "Vuelve en cada partida nueva"). */
  resetHint(): void {
    this.moved = false;
  }

  /** Input que ha leído la escena: el primero no nulo de la partida quita la indicación. */
  noteInput(input: PlayerInput): void {
    if (!isStill(input)) this.moved = true;
  }

  /** Pinta el estado del joystick; `playing` = en curso sin pausa, oferta, tienda, obra ni aviso. */
  sync(stick: StickState, playing: boolean): void {
    const hint = playing && !this.moved && !stick.active;
    const rest = this.restCenter();
    const r = this.radius;
    const parts = stick.active
      ? ['a', stick.origin.x, stick.origin.y, stick.vector.x * r, stick.vector.y * r]
      : ['h', hint ? 1 : 0, rest.x, rest.y, r];
    const key = parts.map((p) => (typeof p === 'number' ? p.toFixed(KEY_DECIMALS) : p)).join(':');
    this.hintShown = hint;
    if (key === this.key) return;
    this.key = key;
    this.canvas.clear();
    if (stick.active) {
      const knob = {
        x: stick.origin.x + stick.vector.x * this.radius,
        y: stick.origin.y + stick.vector.y * this.radius,
      };
      this.paint(stick.origin, knob, ACTIVE_BASE_ALPHA, ACTIVE_KNOB_ALPHA);
    } else if (hint) {
      this.paint(rest, rest, HINT_BASE_ALPHA, HINT_KNOB_ALPHA);
    }
    this.text.setVisible(hint);
    if (hint) {
      const gap = HUD_BASE.margin * this.frame.uiScale * HINT_TEXT_GAP;
      this.text.setPosition(rest.x - this.radius, rest.y - this.radius - gap);
    }
  }

  /** Centro de la base en reposo: margen del HUD × k más el radio, abajo a la izquierda. */
  private restCenter(): { x: number; y: number } {
    const m = HUD_BASE.margin * this.frame.uiScale + this.radius;
    return { x: m, y: this.frame.height - m };
  }

  private paint(
    base: { x: number; y: number },
    knob: { x: number; y: number },
    baseAlpha: number,
    knobAlpha: number,
  ): void {
    this.canvas.fillStyle(BASE_COLOR, baseAlpha);
    this.canvas.fillCircle(base.x, base.y, this.radius);
    this.canvas.fillStyle(KNOB_COLOR, knobAlpha);
    this.canvas.fillCircle(knob.x, knob.y, this.radius * KNOB_FRACTION);
  }
}
