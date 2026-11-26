import { describe, expect, it } from 'vitest';
import upgradesJson from '../../content/upgrades.json';
import type { OfferSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  CARD_FONT_SIZE,
  CARD_LINE_HEIGHT,
  CARD_TEXT_GAP,
  cardLayout,
  cardTextLayout,
  wrapLines,
  type CardRect,
} from '../../src/infrastructure/phaser/cardLayout';
import { choiceIndex } from '../../src/infrastructure/phaser/ChoiceKeys';
import { createUpgradeOverlay } from '../../src/infrastructure/phaser/sceneWidgets';
import { cardName, cardLevel } from '../../src/infrastructure/phaser/UpgradeOverlay';
import {
  nineSliceGeometry,
  screenCorners,
  uiMargins,
} from '../../src/infrastructure/phaser/ui/nineSlice';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { MONO_CHAR_RATIO } from '../../src/infrastructure/phaser/ui/uiLayout';
import {
  NineSlicePanel,
  createUiPanel,
  type UiPanelScene,
} from '../../src/infrastructure/phaser/ui/uiPanel';
import { repoLooks } from '../support/looks';
import { fakeUiScene, repoUi, uiWithMargins, type UiMade } from '../support/phaserUi';

// Spec upgrades (0032), "Cartas de mejora con piezas de UI", y sprite-rendering ("Carta sin
// textura", "Pieza de UI que falla sin reserva de sprites", "Familia con caída…" en las cartas).
const ui = repoUi();
const BUTTON = ui.pieces.button.image;
const option = (id: string, level = 0): OfferSnapshot => {
  const u = upgradesJson.character.find((x) => x.id === id);
  return {
    id,
    name: u?.name ?? id,
    description: u?.description ?? id,
    level,
    nextLevel: level + 1,
  };
};
const THREE = ['guardrail', 'shortcuts', 'hunter'].map((id) => option(id));
const slices = (made: UiMade[]) => made.filter((m) => m.kind === 'nineslice');
const near = (a: number, b: number) => Math.abs(a - b) <= 1;
const inRect = (m: UiMade, r: CardRect) =>
  near(m.x, r.x) &&
  near(m.y, r.y) &&
  near(m.width * m.scale, r.width) &&
  near(m.height * m.scale, r.height);

function overlayIn(
  view: { width: number; height: number },
  opts: { textures?: (k: string) => boolean; webgl?: boolean; ui?: typeof ui } = {},
) {
  const { scene, made } = fakeUiScene({ view, textures: opts.textures, webgl: opts.webgl });
  const overlay = createUpgradeOverlay(scene, screenFrame(view.width, view.height), opts.ui ?? ui);
  // Zona de clic de cada carta: los rectángulos interactivos, en orden.
  const boxes = made.filter((m) => m.kind === 'rectangle' && m.interactive);
  const click = (x: number, y: number) => {
    const hit = boxes.find(
      (b) => b.visible && Math.abs(x - b.x) <= b.width / 2 && Math.abs(y - b.y) <= b.height / 2,
    );
    hit?.handlers.get('pointerdown')?.();
  };
  return { overlay, made, boxes, click };
}

describe('Geometría nine-slice (0032)', () => {
  it('nineSliceGeometry: escala k, tamaño sin escalar = rect / k y mínimo l + r × t + b', () => {
    const m = { left: 20, top: 20, right: 20, bottom: 28 };
    expect(nineSliceGeometry({ x: 10, y: 20, width: 240, height: 170 }, 1, m)).toEqual({
      x: 10,
      y: 20,
      width: 240,
      height: 170,
      scale: 1,
    });
    expect(nineSliceGeometry({ x: 10, y: 20, width: 480, height: 340 }, 2, m)).toMatchObject({
      width: 240,
      height: 170,
      scale: 2,
    });
    expect(nineSliceGeometry({ x: 0, y: 0, width: 10, height: 10 }, 1, m)).toMatchObject({
      width: 40,
      height: 48,
    });
  });

  it('createUiPanel: NineSlice con los márgenes de la pieza; null sin textura o con Canvas', () => {
    const fake = (textures: boolean, webgl: boolean) =>
      fakeUiScene({ view: { width: 960, height: 540 }, textures: () => textures, webgl });
    const ok = fake(true, true);
    expect(createUiPanel(ok.scene as unknown as UiPanelScene, ui.pieces.button, 5)).toBeInstanceOf(
      NineSlicePanel,
    );
    expect(ok.made[0]?.slices).toEqual([20, 20, 20, 28]);
    expect([ok.made[0]?.depth, ok.made[0]?.scrollFactor]).toEqual([5, 0]);
    for (const [t, w] of [
      [false, true],
      [true, false],
    ] as const) {
      const f = fake(t, w);
      expect(createUiPanel(f.scene as unknown as UiPanelScene, ui.pieces.button, 5)).toBeNull();
      expect(f.made).toEqual([]);
    }
  });
});

describe('Cartas de mejora con piezas de UI (upgrades 0032)', () => {
  it.each([3, 2])('Scenario: Una pieza por carta (oferta de %i)', (n) => {
    const view = { width: 1280, height: 720 };
    const { overlay, made, boxes } = overlayIn(view);
    overlay.sync(THREE.slice(0, n));
    const rects = cardLayout(screenFrame(1280, 720), n);
    const visible = slices(made).filter((s) => s.visible);
    expect(visible).toHaveLength(n);
    visible.forEach((s, i) => {
      expect(s.texture).toBe(BUTTON);
      expect(inRect(s, rects[i] as CardRect)).toBe(true);
    });
    // Zona de clic sin relleno ni trazo visibles; textos con la tinta `text` de `button`.
    for (const b of boxes) expect([b.fillAlpha, b.stroke]).toEqual([0, null]);
    const texts = made.filter((m) => m.kind === 'text');
    expect(texts.every((t) => t.style?.color === '#10222e')).toBe(true);
  });

  it('Scenario: Esquinas y texto de la carta a ×1 y a ×2 (pieza de prueba 20, 12, 20, 28)', () => {
    const m = { left: 20, top: 12, right: 20, bottom: 28 };
    for (const [w, h, k] of [
      [1280, 720, 1],
      [2560, 1440, 2],
    ] as const) {
      const c = screenCorners(m, k);
      expect([c.topLeft, c.topRight, c.bottomLeft, c.bottomRight]).toEqual([
        { width: 20 * k, height: 12 * k },
        { width: 20 * k, height: 12 * k },
        { width: 20 * k, height: 28 * k },
        { width: 20 * k, height: 28 * k },
      ]);
      const { overlay, made } = overlayIn(
        { width: w, height: h },
        { ui: uiWithMargins('button', m) },
      );
      overlay.sync(THREE);
      const rects = cardLayout(screenFrame(w, h), 3);
      const texts = made.filter((t) => t.kind === 'text');
      rects.forEach((r, i) => {
        const t = cardTextLayout(r, m, k);
        const left = r.x - r.width / 2;
        expect(t.left - left).toBeGreaterThanOrEqual(20 * k);
        expect(t.nameTop - (r.y - r.height / 2)).toBeGreaterThanOrEqual(12 * k);
        expect(r.y + r.height / 2 - t.levelBottom).toBeGreaterThanOrEqual(28 * k);
        expect(t.wrapWidth).toBeLessThanOrEqual(r.width - 40 * k);
        // El nombre (origen arriba) y el nivel (origen abajo) se colocan en esos bordes.
        const [name, , level] = texts.slice(i * 3, i * 3 + 3);
        expect([name?.y, name?.originY]).toEqual([t.nameTop, 0]);
        expect([level?.y, level?.originY]).toEqual([t.levelBottom, 1]);
      });
      // Esquinas en pantalla de la pieza: márgenes de la hoja × la escala del NineSlice.
      for (const s of slices(made).filter((x) => x.visible)) {
        expect(s.scale).toBe(k);
        expect((s.slices ?? []).map((v) => v * s.scale)).toEqual([20 * k, 20 * k, 12 * k, 28 * k]);
      }
    }
  });

  it('Scenario: Descripción más larga del catálogo (bloque de texto en el área útil, ×1 y ×2)', () => {
    const longest = [...upgradesJson.character]
      .sort((a, b) => b.description.length - a.description.length)
      .slice(0, 3);
    const offer = longest.map((u) => option(u.id));
    const m = uiMargins(ui.pieces.button);
    for (const [w, h, k] of [
      [960, 540, 1],
      [2560, 1440, 2],
    ] as const) {
      const rects = cardLayout(screenFrame(w, h), 3);
      rects.forEach((r, i) => {
        const o = offer[i] as OfferSnapshot;
        const t = cardTextLayout(r, m, k);
        const font = CARD_FONT_SIZE * k;
        const chars = t.wrapWidth / (font * MONO_CHAR_RATIO);
        const lines =
          wrapLines(cardName(i, o), chars) +
          wrapLines(o.description, chars) +
          wrapLines(cardLevel(o), chars);
        const block = lines * font * CARD_LINE_HEIGHT + 2 * CARD_TEXT_GAP * k;
        expect(block, o.id).toBeLessThanOrEqual(t.levelBottom - t.nameTop);
        expect(r.x - r.width / 2).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width / 2).toBeLessThanOrEqual(w);
        expect(r.y - r.height / 2).toBeGreaterThanOrEqual(0);
        expect(r.y + r.height / 2).toBeLessThanOrEqual(h);
      });
      for (let i = 1; i < rects.length; i++) {
        const a = rects[i - 1] as CardRect;
        const b = rects[i] as CardRect;
        expect(a.x + a.width / 2).toBeLessThanOrEqual(b.x - b.width / 2);
      }
    }
  });

  it('Scenario: Clic en el margen de la carta (4 px dentro: elige 2; 1 px fuera: nada)', () => {
    const m = { left: 20, top: 12, right: 20, bottom: 28 };
    const view = { width: 1280, height: 720 };
    const { overlay, click } = overlayIn(view, { ui: uiWithMargins('button', m) });
    overlay.sync(THREE);
    const third = cardLayout(screenFrame(1280, 720), 3)[2] as CardRect;
    click(third.x - third.width / 2 + 4, third.y - third.height / 2 + 4);
    expect(overlay.takeClicked()).toBe(2);
    click(third.x + third.width / 2 + 1, third.y);
    expect(overlay.takeClicked()).toBe(-1);
    expect(overlay.visible).toBe(true);
  });

  it('Scenario: Redimensionar sin crear piezas (1.280 → 1.000 → 2.560 → 960)', () => {
    const { overlay, made, click } = overlayIn({ width: 1280, height: 720 });
    overlay.sync(THREE);
    const pieces = slices(made);
    expect(pieces).toHaveLength(3);
    for (const [w, h] of [
      [1000, 600],
      [2560, 1440],
      [960, 540],
    ] as const) {
      overlay.relayout(screenFrame(w, h));
      expect(slices(made)).toEqual(pieces);
      const rects = cardLayout(screenFrame(w, h), 3);
      pieces.forEach((p, i) => {
        expect(inRect(p, rects[i] as CardRect)).toBe(true);
      });
    }
    const second = cardLayout(screenFrame(960, 540), 3)[1] as CardRect;
    click(second.x, second.y);
    expect(overlay.takeClicked()).toBe(1);
  });
});

describe('Cartas en reserva (sprite-rendering 0032)', () => {
  it.each([
    ['sin la textura de button', { textures: (k: string) => k !== BUTTON }],
    ['con Canvas', { webgl: false }],
  ])('Scenario: Carta sin textura (%s)', (_name, opts) => {
    const { overlay, made, boxes } = overlayIn({ width: 1280, height: 720 }, opts);
    overlay.sync(THREE);
    expect(slices(made)).toEqual([]);
    expect(boxes).toHaveLength(3);
    const rects = cardLayout(screenFrame(1280, 720), 3);
    boxes.forEach((b, i) => {
      expect([b.fill, b.fillAlpha, b.stroke]).toEqual([0x23233a, 1, 0x7ce2fe]);
      expect(inRect(b, rects[i] as CardRect)).toBe(true);
    });
    expect(made.filter((t) => t.kind === 'text').every((t) => t.style?.color === '#ffffff')).toBe(
      true,
    );
    // Tecla 2 → índice 1 (la elección no depende de la pieza).
    expect(choiceIndex(3, 1, overlay.takeClicked())).toBe(1);
  });

  it('Scenario: Pieza de UI que falla sin reserva de sprites (0 aspectos de reserva)', () => {
    // La gema `xp` es una forma de color por diseño (0022): el aspecto es el mismo con o sin la
    // textura de `button`, y ningún otro aspecto cae a reserva.
    const flags = (missing: string[]): boolean[] => {
      const looks = repoLooks(missing);
      const all: { readonly placeholder: boolean }[] = [
        looks.player,
        looks.projectile,
        ...looks.enemies.values(),
        ...Object.values(looks.pickups),
      ];
      return all.map((l) => l.placeholder);
    };
    expect(flags([BUTTON])).toEqual(flags([]));
    expect(flags([BUTTON]).filter(Boolean)).toHaveLength(1);
  });

  it('Scenario: Familia con caída en el DOM y en Phaser (cartas)', () => {
    const { overlay, made } = overlayIn({ width: 1280, height: 720 });
    overlay.sync(THREE);
    const texts = made.filter((t) => t.kind === 'text');
    expect(texts).toHaveLength(9);
    expect(texts.every((t) => t.style?.fontFamily === '"Departure Mono", monospace')).toBe(true);
  });
});
