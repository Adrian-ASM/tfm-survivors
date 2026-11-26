import { describe, expect, it } from 'vitest';
import upgradesJson from '../../content/upgrades.json';
import shopJson from '../../content/shop.json';
import type { OfferSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  IconBook,
  iconCatalog,
  iconKey,
  type IconIds,
} from '../../src/infrastructure/icons/upgradeIcons';
import {
  cardContentLayout,
  cardLayout,
  cardTextLayout,
  wrapLines,
  CARD_FONT_SIZE,
  type CardMargins,
  type CardRect,
} from '../../src/infrastructure/phaser/cardLayout';
import { choiceIndex } from '../../src/infrastructure/phaser/ChoiceKeys';
import { createUpgradeOverlay } from '../../src/infrastructure/phaser/sceneWidgets';
import { cardName } from '../../src/infrastructure/phaser/UpgradeOverlay';
import { uiMargins } from '../../src/infrastructure/phaser/ui/nineSlice';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { MONO_CHAR_RATIO } from '../../src/infrastructure/phaser/ui/uiLayout';
import { fakeUiScene, repoUi, type UiMade } from '../support/phaserUi';

// Spec upgrades (0034), "Icono en la carta de mejora" y "Overlay de elección" (design D4), con dobles
// de Phaser. Datos de iconos de prueba con la forma de los del repositorio (llegan en la tarea 6.1).
const ui = repoUi();
const BUTTON = ui.pieces.button.image;
const IDS: IconIds = {
  character: upgradesJson.character.map((u) => u.id),
  weapon: [...upgradesJson.weapons.map((u) => u.id), shopJson.heal.id],
};
const FALLBACK = { character: 'fallback-character.png', weapon: 'fallback-weapon.png' };
const BY_ID = Object.fromEntries([...IDS.character, ...IDS.weapon].map((id) => [id, `${id}.png`]));
const ALL_KEYS = [...Object.values(BY_ID), FALLBACK.character, FALLBACK.weapon].map(iconKey);

function bookWith(opts: { drop?: string[]; unloaded?: string[] } = {}): IconBook {
  const byId = { ...BY_ID };
  for (const id of opts.drop ?? []) Reflect.deleteProperty(byId, id);
  const book = new IconBook(iconCatalog({ fallback: FALLBACK, byId }, IDS));
  const unloaded = new Set((opts.unloaded ?? []).map(iconKey));
  book.setLoaded(ALL_KEYS.filter((k) => !unloaded.has(k)));
  return book;
}

const option = (id: string): OfferSnapshot => {
  const u = upgradesJson.character.find((x) => x.id === id);
  return { id, name: u?.name ?? id, description: u?.description ?? id, level: 0, nextLevel: 1 };
};
const offerOf = (...ids: string[]) => ids.map(option);
const THREE = offerOf('guardrail', 'shortcuts', 'hunter');

interface Setup {
  view?: { width: number; height: number };
  book?: IconBook;
  textures?: (key: string) => boolean;
  webgl?: boolean;
}

function overlayIn(setup: Setup = {}) {
  const view = setup.view ?? { width: 1280, height: 720 };
  const { scene, made } = fakeUiScene({ view, textures: setup.textures, webgl: setup.webgl });
  const book = setup.book ?? bookWith();
  const overlay = createUpgradeOverlay(scene, screenFrame(view.width, view.height), ui, (id) =>
    book.resolve(id),
  );
  const images = made.filter((m) => m.kind === 'image');
  const texts = made.filter((m) => m.kind === 'text');
  const boxes = made.filter((m) => m.kind === 'rectangle' && m.interactive);
  const click = (x: number, y: number) => {
    const hit = boxes.find(
      (b) => b.visible && Math.abs(x - b.x) <= b.width / 2 && Math.abs(y - b.y) <= b.height / 2,
    );
    hit?.handlers.get('pointerdown')?.();
  };
  return { overlay, made, images, texts, click };
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1;

/** Hueco esperado del icono de la carta `i` de `offer` en un frame (cardContentLayout). */
function slotOf(
  w: number,
  h: number,
  offer: readonly OfferSnapshot[],
  i: number,
  m: CardMargins = uiMargins(ui.pieces.button),
) {
  const frame = screenFrame(w, h);
  const k = frame.uiScale;
  const rect = cardLayout(frame, offer.length)[i] as CardRect;
  const { wrapWidth } = cardTextLayout(rect, m, k);
  const o = offer[i] as OfferSnapshot;
  const lines = wrapLines(cardName(i, o), wrapWidth / (CARD_FONT_SIZE * k * MONO_CHAR_RATIO));
  return cardContentLayout(rect, m, k, lines);
}

function expectInSlot(image: UiMade | undefined, slot: ReturnType<typeof slotOf>): void {
  expect(image).toBeDefined();
  if (!image) return;
  expect([image.originX, image.originY]).toEqual([0.5, 0]);
  expect(near(image.x, slot.icon.x)).toBe(true);
  expect(near(image.y, slot.icon.top)).toBe(true);
  expect(near(image.width, slot.icon.size)).toBe(true);
  expect(near(image.height, slot.icon.size)).toBe(true);
}

describe('icono en la carta de mejora (spec upgrades 0034)', () => {
  it.each([
    [1280, 720],
    [2560, 1440],
  ])('Scenario: Un icono por carta (%i × %i)', (w, h) => {
    const { overlay, images, texts } = overlayIn({ view: { width: w, height: h } });
    overlay.sync(THREE);

    expect(images).toHaveLength(3);
    expect(images.map((im) => [im.texture, im.visible])).toEqual([
      [iconKey('guardrail.png'), true],
      [iconKey('shortcuts.png'), true],
      [iconKey('hunter.png'), true],
    ]);
    images.forEach((im, i) => {
      const slot = slotOf(w, h, THREE, i);
      expectInSlot(im, slot);
      // Sin solaparse con el nombre (origen arriba), la descripción ni el nivel (bajo el nombre).
      const [name, description, level] = texts.slice(i * 3, i * 3 + 3);
      expect(im.y + im.height).toBeLessThanOrEqual((name?.y ?? 0) + 1e-9);
      expect(name?.y ?? 0).toBeLessThan(description?.y ?? 0);
      expect(im.y + im.height).toBeLessThan(level?.y ?? 0);
      // Sin zona de clic propia y sobre el marco de la carta.
      expect(im.interactive).toBe(false);
    });
    expect(overlay.iconStates).toEqual([
      { id: 'guardrail', icon: 'painted' },
      { id: 'shortcuts', icon: 'painted' },
      { id: 'hunter', icon: 'painted' },
    ]);
  });

  it('Scenario: Mejora sin icono propio (armor en el índice 1: reserva de personaje)', () => {
    const offer = offerOf('guardrail', 'armor', 'hunter');
    const { overlay, images } = overlayIn({ book: bookWith({ drop: ['armor'] }) });
    overlay.sync(offer);

    expect(images[1]?.texture).toBe(iconKey(FALLBACK.character));
    expect(images[1]?.visible).toBe(true);
    expect([images[1]?.width, images[1]?.height]).toEqual([images[0]?.width, images[0]?.height]);
    expect(images[1]?.y).toBe(images[0]?.y);
    expectInSlot(images[1], slotOf(1280, 720, offer, 1));
    expect(overlay.iconStates[1]).toEqual({ id: 'armor', icon: 'fallback' });
  });

  it('Scenario: Icono y reserva que no cargan (shortcuts en el índice 1, tecla 2)', () => {
    const full = overlayIn();
    full.overlay.sync(THREE);
    const noIcon = overlayIn({ book: bookWith({ unloaded: ['shortcuts.png'] }) });
    noIcon.overlay.sync(THREE);
    const none = overlayIn({
      book: bookWith({ unloaded: ['shortcuts.png', FALLBACK.character] }),
    });
    none.overlay.sync(THREE);

    expect(noIcon.images[1]?.texture).toBe(iconKey(FALLBACK.character));
    expect(noIcon.images[1]?.visible).toBe(true);
    expect(none.images[1]?.visible).toBe(false);
    expect(none.overlay.iconStates.map((s) => s.icon)).toEqual(['painted', 'none', 'painted']);
    // Los textos de la carta sin icono están donde con icono.
    const pos = (t: UiMade[]) => t.slice(3, 6).map((x) => [x.x, x.y]);
    expect(pos(none.texts)).toEqual(pos(full.texts));
    // La tecla 2 elige el índice 1 en ambos casos.
    for (const { overlay } of [noIcon, none]) {
      expect(choiceIndex(overlay.iconStates.length, 1, overlay.takeClicked())).toBe(1);
    }
  });

  it.each([
    ['sin textura de button', { textures: (k: string) => k !== BUTTON }],
    ['renderizador Canvas', { webgl: false }],
  ])('Scenario: Icono en la carta de reserva (%s)', (_label, setup) => {
    const { overlay, images, made } = overlayIn(setup);
    overlay.sync(THREE);

    expect(made.filter((m) => m.kind === 'nineslice' && m.visible)).toHaveLength(0);
    // El área útil sigue siendo la de los márgenes de `button` con o sin pieza (0032): mismo hueco.
    images.forEach((im, i) => {
      expect(im.visible).toBe(true);
      expectInSlot(im, slotOf(1280, 720, THREE, i));
    });
  });

  it('Scenario: Clic sobre el icono y RESIZE sin crear iconos', () => {
    const { overlay, images, made, click } = overlayIn();
    overlay.sync(THREE);
    const first = [...images];
    const sizes: [number, number][] = [
      [1000, 600],
      [2560, 1440],
      [960, 540],
    ];
    for (const [w, h] of sizes) {
      overlay.relayout(screenFrame(w, h));
      expect(made.filter((m) => m.kind === 'image')).toEqual(first);
      first.forEach((im, i) => {
        expectInSlot(im, slotOf(w, h, THREE, i));
      });
    }
    const icon = first[2] as UiMade;
    click(icon.x, icon.y + icon.height / 2);

    expect(made.filter((m) => m.kind === 'image')).toHaveLength(3);
    expect(overlay.takeClicked()).toBe(2);
  });

  it('cambia la textura solo al cambiar la oferta (no por RESIZE ni por la misma oferta)', () => {
    const { overlay, images } = overlayIn();
    overlay.sync(THREE);
    overlay.sync(THREE.map((o) => ({ ...o })));
    overlay.relayout(screenFrame(2560, 1440));
    expect(images.map((im) => im.texture)).toEqual(
      ['guardrail', 'shortcuts', 'hunter'].map((id) => iconKey(`${id}.png`)),
    );
    overlay.sync(offerOf('armor', 'shortcuts', 'hunter'));
    expect(images[0]?.texture).toBe(iconKey('armor.png'));
  });
});

describe('overlay de elección con iconos (spec upgrades 0034)', () => {
  it('Scenario: Tres cartas (cada una con su icono resuelto)', () => {
    const { overlay, images } = overlayIn();
    overlay.sync(THREE);
    expect(images.filter((im) => im.visible)).toHaveLength(3);
    expect(overlay.iconStates.map((s) => s.id)).toEqual(['guardrail', 'shortcuts', 'hunter']);
  });

  it('Scenario: Menos cartas (2 cartas con 2 iconos; tecla 3 no elige)', () => {
    const { overlay, images } = overlayIn();
    overlay.sync(THREE.slice(0, 2));
    expect(images.map((im) => im.visible)).toEqual([true, true, false]);
    expect(overlay.iconStates).toHaveLength(2);
    expect(choiceIndex(overlay.iconStates.length, 2, overlay.takeClicked())).toBe(-1);
    expect(overlay.visible).toBe(true);
  });

  it('Scenario: Sin oferta (ningún icono de carta visible; teclas sin efecto)', () => {
    const { overlay, images } = overlayIn();
    overlay.sync(THREE);
    overlay.sync([]);
    expect(images.some((im) => im.visible)).toBe(false);
    expect(overlay.iconStates).toEqual([]);
    expect([0, 1, 2].map((k) => choiceIndex(0, k, overlay.takeClicked()))).toEqual([-1, -1, -1]);
    expect(overlay.visible).toBe(false);
  });

  it('Scenario: Elegir con clic (tercera carta con icono: índice 2)', () => {
    const { overlay, click } = overlayIn();
    overlay.sync(THREE);
    const third = cardLayout(screenFrame(1280, 720), 3)[2] as CardRect;
    click(third.x, third.y);
    expect(overlay.takeClicked()).toBe(2);
  });

  it('Scenario: Elegir con tecla (tecla 2 con 3 cartas e iconos: índice 1)', () => {
    const { overlay } = overlayIn();
    overlay.sync(THREE);
    expect(choiceIndex(overlay.iconStates.length, 1, overlay.takeClicked())).toBe(1);
  });

  it('sin catálogo (sin iconFor) los iconos quedan ocultos y la carta no cambia', () => {
    const { scene, made } = fakeUiScene({ view: { width: 1280, height: 720 } });
    const overlay = createUpgradeOverlay(scene, screenFrame(1280, 720), ui);
    overlay.sync(THREE);
    expect(made.filter((m) => m.kind === 'image').map((m) => m.visible)).toEqual([
      false,
      false,
      false,
    ]);
    expect(overlay.iconStates.map((s) => s.icon)).toEqual(['none', 'none', 'none']);
  });
});
