import type Phaser from 'phaser';
import { CARD_TEXT_WRAP } from './cardLayout';
import { Hud, type HudPlacement } from './Hud';
import { ResultsOverlay, type ResultsTexts } from './ResultsOverlay';
import { UpgradeOverlay, type CardBox, type CardParts, type CardText } from './UpgradeOverlay';
import { XpBar } from './XpBar';
import type { PickupLook } from './art/looks';
import type { ScreenFrame } from './ui/screenFrame';
import {
  hudLayout,
  veilLayout,
  type BarAnchor,
  type CounterAnchor,
  type HudLayout,
  type TextAnchor,
} from './ui/uiLayout';

// Fábricas de objetos del motor para el HUD y los overlays (presentación, sin lógica). Se llaman
// una vez en `GameScene.create()`; la lógica vive en `Hud`, `UpgradeOverlay` y `ResultsOverlay`.

/** HUD y overlays: por encima del mundo y fijos a la cámara. */
const HUD_DEPTH = 100;
const OVERLAY_DEPTH = 200;
const RESULTS_DEPTH = 300;
const BAR_BACK = 0x2a2a3a;
const HEALTH_FILL = 0xe05561;
const XP_FILL = 0x4fd1c5;
const VEIL_COLOR = 0x000000;
const VEIL_ALPHA = 0.6;
const RESULTS_VEIL_ALPHA = 0.75;
const CARD_COLOR = 0x23233a;
const CARD_BORDER = 0x7ce2fe;
const TEXT_STYLE = { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' } as const;

type Scene = Phaser.Scene;

type Rect = Phaser.GameObjects.Rectangle;
type Txt = Phaser.GameObjects.Text;

/** Barra (fondo + relleno con origen a la izquierda) en la capa del HUD. */
function bar(scene: Scene, l: HudLayout, at: BarAnchor, color: number): { back: Rect; fill: Rect } {
  const make = (w: number, c: number): Rect =>
    scene.add
      .rectangle(at.x, at.y, w, l.barHeight, c)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
  return { back: make(l.barWidth, BAR_BACK), fill: make(0, color) };
}

function hudText(scene: Scene, l: HudLayout, at: TextAnchor): Txt {
  return scene.add
    .text(at.x, at.y, '', { ...TEXT_STYLE, fontSize: l.fontSize })
    .setOrigin(at.originX, 0.5)
    .setScrollFactor(0)
    .setDepth(HUD_DEPTH);
}

/** Objetos del motor del HUD, recolocados por `HudPlacement` en cada RESIZE (0017). */
interface HudObjects {
  readonly health: { back: Rect; fill: Rect };
  readonly xp: { back: Rect; fill: Rect };
  readonly healthLabel: Txt;
  readonly level: Txt;
  readonly clock: Txt;
  readonly kills: Txt;
  readonly gold: Counter;
  readonly wood: Counter;
  readonly stone: Counter;
}

/** Contador del HUD (0022): icono (imagen o cuadrado de reserva) y número. */
interface Counter {
  readonly icon: Phaser.GameObjects.Image | Rect;
  readonly label: Txt;
}

/** Icono de un contador: hoja y frame del aspecto del recogible, o `null` y su color de reserva. */
export interface CounterIcon {
  readonly texture: string | null;
  readonly frame: number;
  readonly color: number;
}

/** Icono de un contador a partir del aspecto de su recogible: su hoja o, sin ella, su reserva. */
export const counterIcon = (look: PickupLook): CounterIcon => ({
  texture: look.placeholder ? null : look.texture,
  frame: look.idle.frames[0] ?? 0,
  color: look.color,
});

/** Icono y número de un contador, creados una vez (sin errores si la hoja no cargó: reserva). */
function counter(scene: Scene, l: HudLayout, at: CounterAnchor, look: CounterIcon): Counter {
  const { x, y, size } = at.icon;
  const icon = look.texture
    ? scene.add.image(x, y, look.texture, look.frame).setDisplaySize(size, size)
    : scene.add.rectangle(x, y, size, size, look.color);
  icon.setScrollFactor(0).setDepth(HUD_DEPTH);
  return { icon, label: hudText(scene, l, at.label) };
}

function placement(o: HudObjects): HudPlacement {
  const placeBar = (b: { back: Rect; fill: Rect }, at: BarAnchor, l: HudLayout): void => {
    b.back.setPosition(at.x, at.y).setSize(l.barWidth, l.barHeight);
    b.fill.setPosition(at.x, at.y);
  };
  const texts: [Txt, (l: HudLayout) => TextAnchor][] = [
    [o.healthLabel, (l) => l.health.label],
    [o.level, (l) => l.xp.label],
    [o.clock, (l) => l.clock],
    [o.kills, (l) => l.kills],
    [o.gold.label, (l) => l.gold.label],
    [o.wood.label, (l) => l.wood.label],
    [o.stone.label, (l) => l.stone.label],
  ];
  const icons: [Counter, (l: HudLayout) => CounterAnchor][] = [
    [o.gold, (l) => l.gold],
    [o.wood, (l) => l.wood],
    [o.stone, (l) => l.stone],
  ];
  return {
    place(l, rescale) {
      placeBar(o.health, l.health.bar, l);
      placeBar(o.xp, l.xp.bar, l);
      for (const [t, at] of texts) {
        const a = at(l);
        t.setPosition(a.x, a.y);
        if (rescale) t.setFontSize(l.fontSize);
      }
      for (const [c, at] of icons) {
        const { x, y, size } = at(l).icon;
        c.icon.setPosition(x, y).setDisplaySize(size, size);
      }
    },
  };
}

/** HUD (spec hud): vida y XP arriba a la izquierda, tiempo arriba en el centro y bajas a la derecha. */
export function createHud(
  scene: Scene,
  frame: ScreenFrame,
  icons: { readonly gold: CounterIcon; readonly wood: CounterIcon; readonly stone: CounterIcon },
): Hud {
  const l = hudLayout(frame);
  const o: HudObjects = {
    health: bar(scene, l, l.health.bar, HEALTH_FILL),
    healthLabel: hudText(scene, l, l.health.label),
    xp: bar(scene, l, l.xp.bar, XP_FILL),
    level: hudText(scene, l, l.xp.label),
    clock: hudText(scene, l, l.clock),
    kills: hudText(scene, l, l.kills),
    gold: counter(scene, l, l.gold, icons.gold),
    wood: counter(scene, l, l.wood, icons.wood),
    stone: counter(scene, l, l.stone, icons.stone),
  };
  const xpBar = new XpBar(o.xp.fill, o.level, l.barWidth, l.barHeight);
  const parts = {
    xpBar,
    healthFill: o.health.fill,
    healthLabel: o.healthLabel,
    clock: o.clock,
    kills: o.kills,
    gold: o.gold.label,
    wood: o.wood.label,
    stone: o.stone.label,
    placement: placement(o),
  };
  const hud = new Hud(parts, l.barWidth, l.barHeight);
  hud.relayout(l);
  return hud;
}

/** Overlay de elección (spec upgrades): velo y 3 cartas preasignadas. */
export function createUpgradeOverlay(scene: Scene, frame: ScreenFrame): UpgradeOverlay {
  const { width, height } = frame;
  const veil = scene.add
    .rectangle(width / 2, height / 2, width, height, VEIL_COLOR, VEIL_ALPHA)
    .setScrollFactor(0)
    .setDepth(OVERLAY_DEPTH);
  const text = (wrap: number): CardText =>
    scene.add
      .text(0, 0, '', { ...TEXT_STYLE, align: 'center', wordWrap: { width: wrap } })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH + 2);
  const cards: CardParts[] = [0, 1, 2].map(() => {
    const rect = scene.add
      .rectangle(0, 0, 1, 1, CARD_COLOR)
      .setStrokeStyle(2, CARD_BORDER)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    const box: CardBox = {
      setVisible: (v) => rect.setVisible(v),
      setPosition: (x, y) => rect.setPosition(x, y),
      // Rectangle.setSize también ajusta el área de clic (no es personalizada).
      setSize: (w, h) => rect.setSize(w, h),
      onPointerDown: (handler) => {
        rect.on('pointerdown', handler);
      },
    };
    return {
      box,
      name: text(CARD_TEXT_WRAP),
      description: text(CARD_TEXT_WRAP),
      level: text(CARD_TEXT_WRAP),
    };
  });
  return new UpgradeOverlay(veil, cards, frame);
}

/**
 * Overlay de resultados (spec run-results): en Phaser solo el velo, por encima de todo; las 5 líneas
 * son DOM y llegan ya creadas (`DomResultsLines`, design 0017 D11).
 */
export function createResultsOverlay(
  scene: Scene,
  frame: ScreenFrame,
  texts: ResultsTexts,
): { overlay: ResultsOverlay; veil: Phaser.GameObjects.Rectangle } {
  const v = veilLayout(frame);
  const veil = scene.add
    .rectangle(v.x, v.y, v.width, v.height, VEIL_COLOR, RESULTS_VEIL_ALPHA)
    .setScrollFactor(0)
    .setDepth(RESULTS_DEPTH);
  return { overlay: new ResultsOverlay(veil, texts), veil };
}
