import type Phaser from 'phaser';
import {
  hudIconSheet,
  type Appearance,
  type HudLooks,
  type UiAppearance,
  type UiPieceRole,
} from '../content/appearanceSchema';
import { cssHex, fontStack } from '../dom/uiKit';
import type { IconChoice } from '../icons/upgradeIcons';
import { Hud, type HudPlacement } from './Hud';
import { ResultsOverlay, type ResultsTexts } from './ResultsOverlay';
import {
  PLAIN_CARD_MARGINS,
  UpgradeOverlay,
  noIcons,
  type CardBox,
  type CardParts,
  type CardText,
} from './UpgradeOverlay';
import { XpBar } from './XpBar';
import { JoystickView } from './touch/JoystickView';
import type { CorpseLook, FrameCount, Looks, PickupLook } from './art/looks';
import { cropPose, type CropRect, type FrameSize } from './ui/hudIconPose';
import { uiMargins } from './ui/nineSlice';
import type { ScreenFrame } from './ui/screenFrame';
import {
  hudLayout,
  hudPanels,
  veilLayout,
  type BarAnchor,
  type CounterAnchor,
  type HudLayout,
  type HudMetrics,
  type PanelMargins,
  type TextAnchor,
} from './ui/uiLayout';
import { NO_PANEL, createUiPanel, type UiPanelPart } from './ui/uiPanel';

/** Sin datos de UI: el HUD no tiene paneles, así que sus márgenes no importan. */
const NO_MARGINS: PanelMargins = { left: 0, top: 0, right: 0, bottom: 0 };
/** Estilo de los textos del HUD y de las cartas. */
interface TextStyle {
  readonly fontFamily: string;
  readonly fontSize: string;
  readonly color: string;
}

// Fábricas de objetos del motor para el HUD y los overlays (presentación, sin lógica). Se llaman
// una vez en `GameScene.create()`; la lógica vive en `Hud`, `UpgradeOverlay` y `ResultsOverlay`.

/** HUD y overlays: por encima del mundo y fijos a la cámara. */
const HUD_DEPTH = 100;
const OVERLAY_DEPTH = 200;
/** Textura vacía que Phaser crea siempre (`TextureManager`): la de los iconos antes de la oferta. */
const DEFAULT_TEXTURE = '__DEFAULT';
const RESULTS_DEPTH = 300;
const BAR_BACK = 0x2a2a3a;
const HEALTH_FILL = 0xe05561;
const XP_FILL = 0x4fd1c5;
const VEIL_COLOR = 0x000000;
const VEIL_ALPHA = 0.6;
const RESULTS_VEIL_ALPHA = 0.75;
const CARD_COLOR = 0x23233a;
const CARD_BORDER = 0x7ce2fe;
/** Texto blanco de siempre: el de la reserva (sin pieza). */
const PLAIN_TEXT = '#ffffff';
const TEXT_STYLE: TextStyle = { fontFamily: 'monospace', fontSize: '14px', color: PLAIN_TEXT };

type Scene = Phaser.Scene;

/** Estilo de texto con la familia de `ui` y su caída (0032) y el color dado. */
function textStyle(ui: UiAppearance | undefined, color: string): TextStyle {
  return { ...TEXT_STYLE, fontFamily: ui ? fontStack(ui) : TEXT_STYLE.fontFamily, color };
}

/** Pieza de UI en Phaser o `null` (sin datos de UI, sin textura o sin WebGL: reserva). */
function uiPanel(scene: Scene, ui: UiAppearance | undefined, role: UiPieceRole, depth: number) {
  if (!ui) return null;
  return createUiPanel(scene, ui.pieces[role], depth);
}

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

function hudText(scene: Scene, l: HudLayout, at: TextAnchor, style = TEXT_STYLE): Txt {
  return scene.add
    .text(at.x, at.y, '', { ...style, fontSize: l.fontSize })
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
  readonly kills: Counter;
  readonly gold: Counter;
  readonly wood: Counter;
  readonly stone: Counter;
}

/**
 * Contador del HUD (0022): icono (imagen recortada o cuadrado de reserva) y número. `place` lo
 * recoloca en cada RESIZE sin crear objetos (0036: la imagen cambia de escala, no de tamaño).
 */
interface Counter {
  readonly icon: Phaser.GameObjects.Image | Rect;
  readonly label: Txt;
  place(icon: CounterAnchor['icon']): void;
}

/**
 * Icono de un contador (0036, design D5): hoja y frame del aspecto, o `null` y su color de reserva,
 * con el recorte del frame que se ve (`appearance.json` `hud.icons`) y el tamaño del frame.
 */
export interface CounterIcon {
  readonly texture: string | null;
  readonly frame: number;
  readonly color: number;
  readonly crop: CropRect;
  readonly frameSize: FrameSize;
}

const sizeOf = (sheet: { frameWidth: number; frameHeight: number }): FrameSize => ({
  width: sheet.frameWidth,
  height: sheet.frameHeight,
});

/** Icono de un contador a partir del aspecto de su recogible: su hoja o, sin ella, su reserva. */
export const counterIcon = (
  look: PickupLook,
  crop: CropRect,
  frameSize: FrameSize,
): CounterIcon => ({
  texture: look.placeholder ? null : look.texture,
  frame: look.idle.frames[0] ?? 0,
  color: look.color,
  crop,
  frameSize,
});

/**
 * Calavera de las bajas (0036): el frame declarado de la hoja del cadáver, sin animación. Hay arte si
 * la hoja cargó y el frame existe (`frame < FrameCount`); si no, el cuadrado del color del cadáver.
 */
export function killsIcon(
  look: CorpseLook,
  kills: HudLooks['icons']['kills'],
  frameSize: FrameSize,
  frameCount: number | null,
): CounterIcon {
  const painted = !look.placeholder && frameCount !== null && kills.frame < frameCount;
  return {
    texture: painted ? look.texture : null,
    frame: kills.frame,
    color: look.color,
    crop: kills.crop,
    frameSize,
  };
}

/** Iconos de los 4 contadores del HUD, de arriba abajo (0036). */
export interface HudIcons {
  readonly kills: CounterIcon;
  readonly gold: CounterIcon;
  readonly wood: CounterIcon;
  readonly stone: CounterIcon;
}

/** Los 4 iconos con los aspectos resueltos y los recortes de `appearance.json` `hud`. */
export function hudIcons(appearance: Appearance, looks: Looks, frames: FrameCount): HudIcons {
  const { icons } = appearance.hud;
  const size = (key: 'kills' | 'gold' | 'wood' | 'stone') => sizeOf(hudIconSheet(appearance, key));
  return {
    kills: killsIcon(
      looks.corpse,
      icons.kills,
      size('kills'),
      frames(appearance.corpse.sheet.file),
    ),
    gold: counterIcon(looks.pickups.gold, icons.gold.crop, size('gold')),
    wood: counterIcon(looks.pickups.wood, icons.wood.crop, size('wood')),
    stone: counterIcon(looks.pickups.stone, icons.stone.crop, size('stone')),
  };
}

/**
 * Icono y número de un contador, creados una vez (sin errores si la hoja no cargó: reserva). Con
 * hoja: `setCrop` del frame (una vez), origen en el centro del recorte y escala lado / recorte.
 */
function counter(
  scene: Scene,
  l: HudLayout,
  at: CounterAnchor,
  look: CounterIcon,
  style: TextStyle,
): Counter {
  const { x, y, size } = at.icon;
  const label = hudText(scene, l, at.label, style);
  if (look.texture) {
    const { crop } = look;
    const pose = cropPose(crop, look.frameSize, size);
    const image = scene.add
      .image(x, y, look.texture, look.frame)
      .setCrop(crop.x, crop.y, crop.width, crop.height)
      .setOrigin(pose.originX, pose.originY)
      .setScale(pose.scale)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    return {
      icon: image,
      label,
      place: (a) => {
        image.setPosition(a.x, a.y).setScale(cropPose(crop, look.frameSize, a.size).scale);
      },
    };
  }
  const rect = scene.add
    .rectangle(x, y, size, size, look.color)
    .setScrollFactor(0)
    .setDepth(HUD_DEPTH);
  return {
    icon: rect,
    label,
    place: (a) => {
      rect.setPosition(a.x, a.y).setDisplaySize(a.size, a.size);
    },
  };
}

/** Los 3 paneles del HUD (0032): piezas de `panel` o, en reserva, ninguno. */
interface HudFrames {
  readonly left: UiPanelPart;
  readonly center: UiPanelPart;
  readonly right: UiPanelPart;
  readonly margins: PanelMargins;
}

function placement(o: HudObjects, frames: HudFrames): HudPlacement {
  const placeBar = (b: { back: Rect; fill: Rect }, at: BarAnchor, l: HudLayout): void => {
    b.back.setPosition(at.x, at.y).setSize(l.barWidth, l.barHeight);
    b.fill.setPosition(at.x, at.y);
  };
  const texts: [Txt, (l: HudLayout) => TextAnchor][] = [
    [o.healthLabel, (l) => l.health.label],
    [o.level, (l) => l.xp.label],
    [o.clock, (l) => l.clock],
    [o.kills.label, (l) => l.kills.label],
    [o.gold.label, (l) => l.gold.label],
    [o.wood.label, (l) => l.wood.label],
    [o.stone.label, (l) => l.stone.label],
  ];
  const icons: [Counter, (l: HudLayout) => CounterAnchor][] = [
    [o.kills, (l) => l.kills],
    [o.gold, (l) => l.gold],
    [o.wood, (l) => l.wood],
    [o.stone, (l) => l.stone],
  ];
  return {
    place(l, rescale) {
      // Paneles fijos por ventana y k (0032): solo aquí, nunca por frame.
      const p = hudPanels(l, frames.margins);
      frames.left.place(p.left, l.uiScale);
      frames.center.place(p.center, l.uiScale);
      frames.right.place(p.right, l.uiScale);
      placeBar(o.health, l.health.bar, l);
      placeBar(o.xp, l.xp.bar, l);
      for (const [t, at] of texts) {
        const a = at(l);
        t.setPosition(a.x, a.y);
        if (rescale) t.setFontSize(l.fontSize);
      }
      for (const [c, at] of icons) c.place(at(l).icon);
    },
  };
}

/**
 * HUD (spec hud): vida y XP arriba a la izquierda, tiempo arriba en el centro y, a la derecha, los 4
 * contadores con icono (0036: bajas con calavera, oro, madera y piedra).
 */
export function createHud(
  scene: Scene,
  frame: ScreenFrame,
  icons: HudIcons,
  /** Lado de los iconos y paso entre contadores (0036, `appearance.json` `hud`). */
  metrics: HudMetrics,
  /** Interfaz (0032): 3 paneles de `panel` detrás de los textos y la fuente pixel. */
  ui?: UiAppearance,
): Hud {
  const l = hudLayout(frame, metrics);
  // Paneles antes que el resto: detrás de barras y textos (profundidad HUD − 1).
  // La textura y el renderizador son los mismos para los 3: o hay 3 piezas o ninguna.
  const left = uiPanel(scene, ui, 'panel', HUD_DEPTH - 1);
  const center = left ? uiPanel(scene, ui, 'panel', HUD_DEPTH - 1) : null;
  const right = left ? uiPanel(scene, ui, 'panel', HUD_DEPTH - 1) : null;
  const ink = left && ui ? cssHex(ui.pieces.panel.ink.text) : PLAIN_TEXT;
  const style = textStyle(ui, ink);
  const frames: HudFrames = {
    left: left ?? NO_PANEL,
    center: center ?? NO_PANEL,
    right: right ?? NO_PANEL,
    margins: ui ? uiMargins(ui.pieces.panel) : NO_MARGINS,
  };
  const o: HudObjects = {
    health: bar(scene, l, l.health.bar, HEALTH_FILL),
    healthLabel: hudText(scene, l, l.health.label, style),
    xp: bar(scene, l, l.xp.bar, XP_FILL),
    level: hudText(scene, l, l.xp.label, style),
    clock: hudText(scene, l, l.clock, style),
    kills: counter(scene, l, l.kills, icons.kills, style),
    gold: counter(scene, l, l.gold, icons.gold, style),
    wood: counter(scene, l, l.wood, icons.wood, style),
    stone: counter(scene, l, l.stone, icons.stone, style),
  };
  const xpBar = new XpBar(o.xp.fill, o.level, l.barWidth, l.barHeight);
  const parts = {
    xpBar,
    healthFill: o.health.fill,
    healthLabel: o.healthLabel,
    clock: o.clock,
    kills: o.kills.label,
    gold: o.gold.label,
    wood: o.wood.label,
    stone: o.stone.label,
    placement: placement(o, frames),
  };
  const hud = new Hud(parts, l.barWidth, l.barHeight);
  hud.relayout(l);
  return hud;
}

/**
 * Overlay de elección (spec upgrades): velo y 3 cartas preasignadas. 0032: con la textura de
 * `button` y WebGL, cada carta tiene su `NineSlice` y el `Rectangle` queda transparente como zona de
 * clic; si no, el `Rectangle` de siempre. Textos con la familia de `ui` y la tinta de `button`.
 */
export function createUpgradeOverlay(
  scene: Scene,
  frame: ScreenFrame,
  ui?: UiAppearance,
  /** Icono de cada opción (0034): un `Image` preasignado por carta, sin `setInteractive`. */
  iconFor: (id: string) => IconChoice = noIcons,
): UpgradeOverlay {
  const { width, height } = frame;
  const veil = scene.add
    .rectangle(width / 2, height / 2, width, height, VEIL_COLOR, VEIL_ALPHA)
    .setScrollFactor(0)
    .setDepth(OVERLAY_DEPTH);
  // Marcos primero (OVERLAY_DEPTH + 1), luego la zona de clic (+ 1, creada después) y los textos.
  const frames = [0, 1, 2].map(() => uiPanel(scene, ui, 'button', OVERLAY_DEPTH + 1));
  const framed = frames.every((f) => f !== null);
  const ink = framed && ui ? cssHex(ui.pieces.button.ink.text) : PLAIN_TEXT;
  const style = textStyle(ui, ink);
  const text = (originY: number): CardText =>
    scene.add
      .text(0, 0, '', { ...style, align: 'center', wordWrap: { width: 1 } })
      .setOrigin(0.5, originY)
      .setScrollFactor(0)
      .setDepth(OVERLAY_DEPTH + 2);
  const cards: CardParts[] = frames.map((f) => {
    const rect = framed
      ? scene.add.rectangle(0, 0, 1, 1, CARD_COLOR, 0)
      : scene.add.rectangle(0, 0, 1, 1, CARD_COLOR).setStrokeStyle(2, CARD_BORDER);
    rect
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
      frame: framed && f ? f : NO_PANEL,
      box,
      // Nombre anclado arriba, descripción bajo él y nivel anclado abajo (área útil, 0032).
      name: text(0),
      description: text(0),
      level: text(1),
      // 0034: textura transparente por defecto hasta la primera oferta; oculto hasta entonces.
      icon: scene.add
        .image(0, 0, DEFAULT_TEXTURE)
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(OVERLAY_DEPTH + 2)
        .setVisible(false),
    };
  });
  const margins = ui ? uiMargins(ui.pieces.button) : PLAIN_CARD_MARGINS;
  return new UpgradeOverlay(veil, cards, frame, margins, iconFor);
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

/**
 * Joystick e indicación en reposo del modo móvil (0033): un `Graphics` y un `Text` en la capa del
 * HUD, fijos a la cámara y bajo los overlays. Solo se crean con el modo móvil.
 */
export function createJoystickView(
  scene: Scene,
  hint: string,
  radiusPx: number,
  ui?: UiAppearance,
): JoystickView {
  const canvas = scene.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH);
  const text = scene.add
    .text(0, 0, '', textStyle(ui, PLAIN_TEXT))
    .setOrigin(0, 1)
    .setScrollFactor(0)
    .setDepth(HUD_DEPTH);
  return new JoystickView(canvas, text, hint, radiusPx);
}
