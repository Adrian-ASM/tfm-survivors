import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { damageNumberStyle } from '../../src/infrastructure/phaser/art/combatFeedback';
import { createHud } from '../../src/infrastructure/phaser/sceneWidgets';
import { uiMargins } from '../../src/infrastructure/phaser/ui/nineSlice';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import {
  hudLayout,
  hudPanels,
  type CenteredRect,
} from '../../src/infrastructure/phaser/ui/uiLayout';
import { aDefaultConfig } from '../support/builders';
import { REPO_COMBAT } from '../support/feedback';
import { fakeUiScene, repoUi, type UiMade } from '../support/phaserUi';
import { startRun } from '../support/runs';

// Spec hud (0032), "Paneles del HUD con piezas de UI", y sprite-rendering ("HUD sin textura", "Los
// números de daño conservan su fuente", "Familia con caída…" en el HUD). Con dobles de Phaser.
const ui = repoUi();
const PANEL = ui.pieces.panel.image;
const ICONS = {
  gold: { texture: 'Resources/Resources/G_Idle.png', frame: 0, color: 0xe8c547 },
  wood: { texture: 'Resources/Resources/W_Idle.png', frame: 0, color: 0x9c6b3c },
  stone: { texture: 'Deco/05.png', frame: 0, color: 0x9aa0a6 },
};
const fresh = (): RunSnapshot => startRun(aDefaultConfig()).snapshot();
const slices = (made: UiMade[]) => made.filter((m) => m.kind === 'nineslice');
/** Rectángulo en pantalla de un NineSlice (centro y tamaño escalado). */
const rectOf = (m: UiMade): CenteredRect => ({
  x: m.x,
  y: m.y,
  width: m.width * m.scale,
  height: m.height * m.scale,
});
const expectedPanels = (w: number, h: number) => {
  const p = hudPanels(hudLayout(screenFrame(w, h)), uiMargins(ui.pieces.panel));
  return [p.left, p.center, p.right];
};
const near = (a: CenteredRect, b: CenteredRect | undefined) =>
  !!b &&
  [a.x - b.x, a.y - b.y, a.width - b.width, a.height - b.height].every((d) => Math.abs(d) <= 1);

function hudIn(
  view: { width: number; height: number },
  opts: { textures?: (k: string) => boolean; webgl?: boolean } = {},
) {
  const { scene, made } = fakeUiScene({ view, ...opts });
  const hud = createHud(scene, screenFrame(view.width, view.height), ICONS, ui);
  return { hud, made };
}

describe('Paneles del HUD con piezas de UI (hud 0032)', () => {
  it.each([
    [960, 540, 1],
    [2560, 1440, 2],
  ])('Scenario: Tres paneles con su contenido (%i × %i, k = %i)', (w, h, k) => {
    const { hud, made } = hudIn({ width: w, height: h });
    hud.sync(fresh());
    const pieces = slices(made);
    expect(pieces).toHaveLength(3);
    expect(pieces.every((p) => p.texture === PANEL && p.scale === k)).toBe(true);
    // Detrás de barras y textos: profundidad menor que la del resto del HUD.
    const others = made.filter((m) => m.kind !== 'nineslice');
    const top = Math.min(...others.map((m) => m.depth ?? 0));
    expect(pieces.every((p) => (p.depth ?? 0) < top)).toBe(true);
    const want = expectedPanels(w, h);
    pieces.forEach((p, i) => {
      expect(near(rectOf(p), want[i]), `panel ${String(i)}`).toBe(true);
    });
    // Esquinas de margen × k: márgenes de la hoja por la escala.
    for (const p of pieces)
      expect((p.slices ?? []).map((v) => v * p.scale)).toEqual([16 * k, 16 * k, 16 * k, 16 * k]);
  });

  it('Scenario: Paneles independientes del snapshot (recién creada y con los valores largos)', () => {
    const { hud, made } = hudIn({ width: 1280, height: 720 });
    hud.sync(fresh());
    const first = slices(made).map(rectOf);
    const base = fresh();
    hud.sync({
      ...base,
      kills: 12345,
      player: { ...base.player, health: 120, maxHealth: 120 },
      progression: { ...base.progression, level: 99 },
      resources: { gold: 123456, wood: 12345, stone: 12345 },
    });
    const second = slices(made).map(rectOf);
    expect(second).toEqual(first);
  });

  it('Scenario: Seiscientos frames sin crear objetos (RESIZE en los frames 200 y 400)', () => {
    const { hud, made } = hudIn({ width: 1280, height: 720 });
    const base = fresh();
    hud.sync(base);
    const created = made.length;
    const pieces = slices(made);
    for (let f = 1; f <= 600; f++) {
      if (f === 200) hud.relayout(hudLayout(screenFrame(2560, 1440)));
      if (f === 400) hud.relayout(hudLayout(screenFrame(960, 540)));
      hud.sync({
        ...base,
        tick: f,
        kills: f,
        player: { ...base.player, health: Math.max(1, base.player.health - (f % 50)) },
        progression: { ...base.progression, xp: f % 5 },
        resources: { gold: f, wood: f % 7, stone: f % 3 },
      });
    }
    expect(made.length).toBe(created);
    expect(slices(made)).toEqual(pieces);
    const want = expectedPanels(960, 540);
    pieces.forEach((p, i) => {
      expect(near(rectOf(p), want[i])).toBe(true);
      expect(p.scale).toBe(1);
    });
  });

  it('Scenario: Fuente pixel en los textos del HUD (y tinta text de panel)', () => {
    const { made } = hudIn({ width: 960, height: 540 });
    const texts = made.filter((m) => m.kind === 'text');
    expect(texts).toHaveLength(7);
    expect(texts.every((t) => t.style?.fontFamily === '"Departure Mono", monospace')).toBe(true);
    expect(texts.every((t) => t.style?.color === '#2b1d0e')).toBe(true);
  });
});

describe('HUD en reserva (sprite-rendering 0032)', () => {
  it.each([
    ['sin la textura de panel', { textures: (k: string) => k !== PANEL }],
    ['con Canvas', { webgl: false }],
  ])('Scenario: HUD sin textura (%s)', (_name, opts) => {
    const { hud, made } = hudIn({ width: 960, height: 540 }, opts);
    hud.sync(fresh());
    expect(slices(made)).toEqual([]);
    const texts = made.filter((m) => m.kind === 'text');
    expect(texts.every((t) => t.style?.color === '#ffffff')).toBe(true);
    const l = hudLayout(screenFrame(960, 540));
    const bars = made.filter((m) => m.kind === 'rectangle');
    const backs = bars.filter((b) => b.fill === 0x2a2a3a);
    expect(backs).toHaveLength(2);
    // Vida llena: el relleno mide el ancho de la barra (relleno 1).
    const healthFill = bars.find((b) => b.fill === 0xe05561);
    expect(healthFill?.width).toBe(l.barWidth);
  });

  it('Scenario: Familia con caída en el DOM y en Phaser (HUD)', () => {
    const { made } = hudIn({ width: 960, height: 540 }, { textures: () => false });
    // Sin pieza también: la familia no depende de la textura.
    const texts = made.filter((m) => m.kind === 'text');
    expect(texts.every((t) => t.style?.fontFamily === '"Departure Mono", monospace')).toBe(true);
  });

  it('Scenario: Los números de daño conservan su fuente (estilo de antes, sin familia)', () => {
    expect(damageNumberStyle(REPO_COMBAT.numbers.fontPx)).toEqual({
      fontSize: '16px',
      color: '#ffffff',
    });
  });
});
