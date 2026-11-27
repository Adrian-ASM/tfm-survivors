import { describe, expect, it } from 'vitest';
import type { OfferSnapshot } from '../../src/domain/run/RunSnapshot';
import { cardLayout } from '../../src/infrastructure/phaser/cardLayout';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import {
  UpgradeOverlay,
  type CardBox,
  type CardIcon,
  type CardText,
  type OverlayPart,
} from '../../src/infrastructure/phaser/UpgradeOverlay';
import { NO_PANEL } from '../../src/infrastructure/phaser/ui/uiPanel';
import { mobileFrameRule } from '../../src/infrastructure/phaser/ui/mobileFrame';
import { DEFAULT_UPGRADE_LIST } from '../support/builders';
import { HUD_METRICS } from '../support/hud';

class FakePart implements OverlayPart {
  visible = false;
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  setSize(w: number, h: number): this {
    this.width = w;
    this.height = h;
    return this;
  }
  setVisible(v: boolean): this {
    this.visible = v;
    return this;
  }
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
}

class FakeText extends FakePart implements CardText {
  text = '';
  writes = 0;
  fontSize = 0;
  wrap = 0;
  setFontSize(size: number): this {
    this.fontSize = size;
    return this;
  }
  setWordWrapWidth(width: number): this {
    this.wrap = width;
    return this;
  }
  setText(t: string): this {
    this.text = t;
    this.writes += 1;
    return this;
  }
}

class FakeBox extends FakePart implements CardBox {
  private handler: (() => void) | null = null;
  onPointerDown(cb: () => void): void {
    this.handler = cb;
  }
  click(): void {
    this.handler?.();
  }
}

/** Icono doble (0034): textura y tamaño en pantalla. */
class FakeIcon extends FakePart implements CardIcon {
  texture = '';
  textures = 0;
  setTexture(key: string): this {
    this.texture = key;
    this.textures += 1;
    return this;
  }
  setDisplaySize(w: number, h: number): this {
    return this.setSize(w, h);
  }
}

const VIEW = screenFrame(960, 540);

function overlay() {
  const veil = new FakePart();
  const cards = Array.from({ length: 3 }, () => ({
    frame: NO_PANEL,
    box: new FakeBox(),
    name: new FakeText(),
    description: new FakeText(),
    level: new FakeText(),
    icon: new FakeIcon(),
  }));
  return { veil, cards, o: new UpgradeOverlay(veil, cards, VIEW) };
}

const option = (id: string, level = 0): OfferSnapshot => ({
  id,
  name: `Nombre ${id}`,
  description: `Descripción ${id}`,
  level,
  nextLevel: level + 1,
});
const THREE = [option('fast-ci'), option('guardrail', 2), option('coverage')];

describe('cardLayout', () => {
  it('centra 1, 2 o 3 cartas en la vista sin solaparlas', () => {
    for (const n of [1, 2, 3]) {
      const cards = cardLayout(VIEW, n);
      expect(cards).toHaveLength(n);
      const left = cards[0]?.x ?? 0;
      const right = cards.at(-1)?.x ?? 0;
      expect((left + right) / 2).toBeCloseTo(VIEW.width / 2, 6);
      for (const c of cards) expect(c.y).toBeCloseTo(VIEW.height / 2, 6);
      for (let i = 1; i < n; i++) {
        const gap = (cards[i]?.x ?? 0) - (cards[i - 1]?.x ?? 0);
        expect(gap).toBeGreaterThan(cards[i]?.width ?? 0);
      }
    }
  });
});

describe('UpgradeOverlay', () => {
  it('Scenario: Tres cartas (visible, en orden, con nombre, descripción y nivel actual → siguiente)', () => {
    const { veil, cards, o } = overlay();
    o.sync(THREE);
    expect([veil.visible, o.visible]).toEqual([true, true]);
    expect(
      cards.map((c) => [c.box.visible, c.name.text, c.description.text, c.level.text]),
    ).toEqual([
      [true, '[1] Nombre fast-ci', 'Descripción fast-ci', 'Nv 0 → 1'],
      [true, '[2] Nombre guardrail', 'Descripción guardrail', 'Nv 2 → 3'],
      [true, '[3] Nombre coverage', 'Descripción coverage', 'Nv 0 → 1'],
    ]);
    const xs = cards.map((c) => c.box.x);
    expect(xs).toEqual(cardLayout(VIEW, 3).map((c) => c.x));
  });

  // Spec upgrades (0013): los textos salen del contenido por defecto.
  it('Scenario: La carta muestra el texto nuevo (strict-rules, guardrail, shortcuts)', () => {
    const { cards, o } = overlay();
    const fromContent = (id: string): OfferSnapshot => {
      const u = DEFAULT_UPGRADE_LIST.find((x) => x.id === id);
      return { id, name: u?.name ?? '', description: u?.description ?? '', level: 0, nextLevel: 1 };
    };

    o.sync(['strict-rules', 'guardrail', 'shortcuts'].map(fromContent));

    expect(cards.map((c) => [c.name.text, c.description.text, c.level.text])).toEqual([
      ['[1] Puntas de acero', 'Las flechas del arco hacen más daño.', 'Nv 0 → 1'],
      ['[2] Cota de malla', 'Más vida máxima (y la misma cantidad de vida actual).', 'Nv 0 → 1'],
      ['[3] Botas de viajero', 'Te mueves más rápido.', 'Nv 0 → 1'],
    ]);
  });

  it('Scenario: Menos cartas (2 opciones: la tercera oculta)', () => {
    const { cards, o } = overlay();
    o.sync(THREE.slice(0, 2));
    expect(cards.map((c) => [c.box.visible, c.name.visible])).toEqual([
      [true, true],
      [true, true],
      [false, false],
    ]);
  });

  it('Scenario: Sin oferta (overlay oculto)', () => {
    const { veil, cards, o } = overlay();
    o.sync(THREE);
    o.sync([]);
    expect([veil.visible, o.visible, ...cards.map((c) => c.box.visible)]).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('rellena los textos solo cuando cambia la oferta', () => {
    const { cards, o } = overlay();
    o.sync(THREE);
    o.sync(THREE.map((x) => ({ ...x })));
    o.sync(THREE);
    expect(cards[0]?.name.writes).toBe(1);
    o.sync([option('fast-ci', 1), ...THREE.slice(1)]);
    expect(cards[0]?.level.text).toBe('Nv 1 → 2');
  });

  it('Scenario: Elegir con clic (tercera carta: índice 2, una sola vez)', () => {
    const { cards, o } = overlay();
    o.sync(THREE);
    expect(o.takeClicked()).toBe(-1);
    cards[2]?.box.click();
    expect(o.takeClicked()).toBe(2);
    expect(o.takeClicked()).toBe(-1);
  });

  it('un clic sin oferta o en una carta oculta no elige nada', () => {
    const { cards, o } = overlay();
    o.sync(THREE.slice(0, 2));
    cards[2]?.box.click();
    expect(o.takeClicked()).toBe(-1);
    o.sync([]);
    cards[0]?.box.click();
    expect(o.takeClicked()).toBe(-1);
  });
});

// Spec world-camera (0017), "Redimensionado con la oferta abierta" (parte unitaria) y "Overlay de
// elección con la cámara movida": el overlay solo depende del frame del lienzo.
describe('UpgradeOverlay.relayout (0017)', () => {
  it('Scenario: Clic tras redimensionar (1.000 × 600: cartas recolocadas, misma oferta, índice 2)', () => {
    const { veil, cards, o } = overlay();
    o.sync(THREE);
    const writes = cards.map((c) => c.name.writes);
    const frame = screenFrame(1000, 600);

    o.relayout(frame);

    const expected = cardLayout(frame, 3);
    expect(cards.map((c) => [c.box.x, c.box.y, c.box.width, c.box.height])).toEqual(
      expected.map((r) => [r.x, r.y, r.width, r.height]),
    );
    expect([veil.visible, veil.x, veil.y, veil.width, veil.height]).toEqual([
      true,
      500,
      300,
      1000,
      600,
    ]);
    expect(cards.map((c) => c.name.writes)).toEqual(writes);
    expect(cards.map((c) => c.name.text)).toEqual([
      '[1] Nombre fast-ci',
      '[2] Nombre guardrail',
      '[3] Nombre coverage',
    ]);
    cards[2]?.box.click();
    expect(o.takeClicked()).toBe(2);
  });

  it('el velo no elige nada (sin clic en carta, takeClicked da −1)', () => {
    const { o } = overlay();
    o.sync(THREE);
    o.relayout(screenFrame(1000, 600));

    expect(o.takeClicked()).toBe(-1);
  });

  it('Scenario: Overlay de elección con la cámara movida (las cartas solo dependen del frame)', () => {
    const a = overlay();
    const b = overlay();
    for (const { o } of [a, b]) {
      o.sync(THREE);
      o.relayout(screenFrame(1280, 720));
    }

    expect(a.cards.map((c) => [c.box.x, c.box.y])).toEqual(b.cards.map((c) => [c.box.x, c.box.y]));
  });

  it('×1 → ×2: textos a la fuente y al ajuste de línea nuevos, posiciones escaladas', () => {
    const { cards, o } = overlay();
    o.sync(THREE);
    o.relayout(screenFrame(1920, 1080));

    const [first] = cardLayout(screenFrame(1920, 1080), 3);
    expect(cards[0]?.name.fontSize).toBe(28);
    // 0032: área útil de 16 px por lado sin pieza (el overlay de prueba no la tiene); 0034: el
    // nombre empieza bajo el hueco del icono, (64 + 6)·k.
    expect(cards[0]?.name.wrap).toBe(2 * 208);
    expect(cards[0]?.name.y).toBe((first?.y ?? 0) - (first?.height ?? 0) / 2 + 2 * (16 + 64 + 6));
  });
});

// Spec mobile-display (0033), "Toque en una carta escalada": k fraccionario (844 × 390).
describe('UpgradeOverlay con k fraccionario (0033)', () => {
  it('Scenario: Toque en una carta escalada (centro de la tercera carta → índice 2)', () => {
    const { cards, o } = overlay();
    o.sync(THREE);
    const frame = mobileFrameRule(12, HUD_METRICS)(
      { width: 1385.03, height: 640 },
      { width: 844, height: 390 },
    );
    o.relayout(frame);
    const s = 390 / 640;
    const rects = cardLayout(frame, 3);
    const third = rects[2];
    if (!third) throw new Error('sin tercera carta');
    // Toque en px CSS en el centro de la tercera carta; el motor lo pasa a unidades del lienzo.
    const css = { x: third.x * s, y: third.y * s };
    const touch = { x: css.x / s, y: css.y / s };

    const hit = cards.findIndex(
      (c) =>
        c.box.visible &&
        Math.abs(touch.x - c.box.x) <= c.box.width / 2 &&
        Math.abs(touch.y - c.box.y) <= c.box.height / 2,
    );
    cards[hit]?.box.click();

    expect(frame.uiScale).toBeCloseTo(1.4066, 3);
    expect(cards.map((c) => [c.box.width, c.box.height])).toEqual(
      rects.map((r) => [r.width, r.height]),
    );
    expect(hit).toBe(2);
    expect(o.takeClicked()).toBe(2);
    expect(cards[0]?.name.fontSize).toBeCloseTo(14 * frame.uiScale, 6);
  });
});
