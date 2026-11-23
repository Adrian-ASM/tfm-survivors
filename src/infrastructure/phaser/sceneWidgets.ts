import type Phaser from 'phaser';
import { CARD_WIDTH } from './cardLayout';
import { Hud } from './Hud';
import { ResultsOverlay, type ShowableText } from './ResultsOverlay';
import { UpgradeOverlay, type CardBox, type CardParts, type CardText } from './UpgradeOverlay';
import { XpBar } from './XpBar';
import { screenFrame } from './ui/screenFrame';

// Fábricas de objetos del motor para el HUD y los overlays (presentación, sin lógica). Se llaman
// una vez en `GameScene.create()`; la lógica vive en `Hud`, `UpgradeOverlay` y `ResultsOverlay`.

/** HUD y overlays: por encima del mundo y fijos a la cámara. */
const HUD_DEPTH = 100;
const OVERLAY_DEPTH = 200;
const RESULTS_DEPTH = 300;
const MARGIN = 16;
const BAR_WIDTH = 240;
const BAR_HEIGHT = 10;
const HEALTH_Y = 16;
const XP_Y = 34;
const LABEL_GAP = 8;
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

/** Barra (fondo + relleno con origen a la izquierda) en la capa del HUD. */
function bar(scene: Scene, y: number, color: number): Phaser.GameObjects.Rectangle {
  scene.add
    .rectangle(MARGIN, y, BAR_WIDTH, BAR_HEIGHT, BAR_BACK)
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(HUD_DEPTH);
  return scene.add
    .rectangle(MARGIN, y, 0, BAR_HEIGHT, color)
    .setOrigin(0, 0.5)
    .setScrollFactor(0)
    .setDepth(HUD_DEPTH);
}

function hudText(scene: Scene, x: number, y: number, originX: number): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, '', TEXT_STYLE)
    .setOrigin(originX, 0.5)
    .setScrollFactor(0)
    .setDepth(HUD_DEPTH);
}

/** HUD (spec hud): vida y XP arriba a la izquierda, tiempo arriba en el centro y bajas a la derecha. */
export function createHud(scene: Scene): Hud {
  const { width } = scene.scale;
  const labelX = MARGIN + BAR_WIDTH + LABEL_GAP;
  const healthFill = bar(scene, HEALTH_Y, HEALTH_FILL);
  const healthLabel = hudText(scene, labelX, HEALTH_Y, 0);
  const xpBar = new XpBar(
    bar(scene, XP_Y, XP_FILL),
    hudText(scene, labelX, XP_Y, 0),
    BAR_WIDTH,
    BAR_HEIGHT,
  );
  const clock = hudText(scene, width / 2, HEALTH_Y, 0.5);
  const kills = hudText(scene, width - MARGIN, HEALTH_Y, 1);
  return new Hud({ xpBar, healthFill, healthLabel, clock, kills }, BAR_WIDTH, BAR_HEIGHT);
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
