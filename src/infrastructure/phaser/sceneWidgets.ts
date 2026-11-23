import type Phaser from 'phaser';
import { CARD_WIDTH } from './cardLayout';
import { Hud, type HudPlacement } from './Hud';
import { ResultsOverlay, type ShowableText } from './ResultsOverlay';
import { UpgradeOverlay, type CardBox, type CardParts, type CardText } from './UpgradeOverlay';
import { XpBar } from './XpBar';
import { screenFrame, type ScreenFrame } from './ui/screenFrame';
import { hudLayout, type BarAnchor, type HudLayout, type TextAnchor } from './ui/uiLayout';

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
const TITLE_STYLE = { ...TEXT_STYLE, fontSize: '40px' } as const;
const RESULTS_STYLE = { ...TEXT_STYLE, fontSize: '20px' } as const;
const CARD_TEXT_PADDING = 16;
/** Separación vertical de las líneas del overlay de resultados respecto al centro. */
const RESULTS_LINES_DY = [-90, -20, 15, 50, 110] as const;

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
    },
  };
}

/** HUD (spec hud): vida y XP arriba a la izquierda, tiempo arriba en el centro y bajas a la derecha. */
export function createHud(scene: Scene, frame: ScreenFrame): Hud {
  const l = hudLayout(frame);
  const o: HudObjects = {
    health: bar(scene, l, l.health.bar, HEALTH_FILL),
    healthLabel: hudText(scene, l, l.health.label),
    xp: bar(scene, l, l.xp.bar, XP_FILL),
    level: hudText(scene, l, l.xp.label),
    clock: hudText(scene, l, l.clock),
    kills: hudText(scene, l, l.kills),
  };
  const xpBar = new XpBar(o.xp.fill, o.level, l.barWidth, l.barHeight);
  const parts = {
    xpBar,
    healthFill: o.health.fill,
    healthLabel: o.healthLabel,
    clock: o.clock,
    kills: o.kills,
    placement: placement(o),
  };
  const hud = new Hud(parts, l.barWidth, l.barHeight);
  hud.relayout(l);
  return hud;
}

/** Overlay de elección (spec upgrades): velo y 3 cartas preasignadas. */
export function createUpgradeOverlay(scene: Scene): UpgradeOverlay {
  const { width, height } = scene.scale;
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
    const wrap = CARD_WIDTH - 2 * CARD_TEXT_PADDING;
    return { box, name: text(wrap), description: text(wrap), level: text(wrap) };
  });
  return new UpgradeOverlay(veil, cards, screenFrame(width, height));
}

/** Overlay de resultados (spec run-results): velo y 5 líneas centradas, por encima de todo. */
export function createResultsOverlay(scene: Scene): ResultsOverlay {
  const { width, height } = scene.scale;
  const veil = scene.add
    .rectangle(width / 2, height / 2, width, height, VEIL_COLOR, RESULTS_VEIL_ALPHA)
    .setScrollFactor(0)
    .setDepth(RESULTS_DEPTH);
  const [title, time, level, kills, hint] = RESULTS_LINES_DY.map((dy, i): ShowableText =>
    scene.add
      .text(width / 2, height / 2 + dy, '', i === 0 ? TITLE_STYLE : RESULTS_STYLE)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(RESULTS_DEPTH + 1),
  );
  if (!title || !time || !level || !kills || !hint) throw new Error('Faltan líneas de resultados');
  return new ResultsOverlay(veil, { title, time, level, kills, hint });
}
