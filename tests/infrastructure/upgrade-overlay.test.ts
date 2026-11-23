import { describe, expect, it } from 'vitest';
import type { OfferSnapshot } from '../../src/domain/run/RunSnapshot';
import { cardLayout } from '../../src/infrastructure/phaser/cardLayout';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import {
  UpgradeOverlay,
  type CardBox,
  type CardText,
  type OverlayPart,
} from '../../src/infrastructure/phaser/UpgradeOverlay';
import { DEFAULT_UPGRADE_LIST } from '../support/builders';

class FakePart implements OverlayPart {
  visible = false;
  x = 0;
  y = 0;
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
  setText(t: string): this {
    this.text = t;
    this.writes += 1;
    return this;
  }
}

class FakeBox extends FakePart implements CardBox {
  width = 0;
  height = 0;
  private handler: (() => void) | null = null;
  setSize(w: number, h: number): this {
    this.width = w;
    this.height = h;
    return this;
  }
  onPointerDown(cb: () => void): void {
    this.handler = cb;
  }
  click(): void {
    this.handler?.();
  }
}

const VIEW = screenFrame(960, 540);

function overlay() {
  const veil = new FakePart();
  const cards = Array.from({ length: 3 }, () => ({
    box: new FakeBox(),
    name: new FakeText(),
    description: new FakeText(),
    level: new FakeText(),
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
