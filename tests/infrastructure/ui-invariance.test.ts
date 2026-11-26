import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import guideJson from '../../content/guide.json';
import audioJson from '../../content/audio.json';
import provenanceJson from '../../content/asset-provenance.json';
import { bootContent } from '../../src/composition/contentBoot';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { UiAppearance } from '../../src/infrastructure/content/appearanceSchema';
import { registeredPaths } from '../../src/infrastructure/content/loadAppearance';
import { repositoryContent } from '../../src/infrastructure/content/loadRunConfig';
import { createHud, createUpgradeOverlay } from '../../src/infrastructure/phaser/sceneWidgets';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { randomInputs } from '../support/inputs';
import { planFor } from '../support/mapArt';
import { fakeUiScene } from '../support/phaserUi';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';
import { GENERATED_PATHS } from '../support/generated';

// Spec sprite-rendering (0032), "La interfaz no cambia la simulación ni el mapa": la sección `ui`
// es presentación pura (no la lee ningún flujo de azar ni ninguna colocación).
const REGISTERED = registeredPaths(provenanceJson);
const ICONS = {
  gold: { texture: null, frame: 0, color: 0xe8c547 },
  wood: { texture: null, frame: 0, color: 0x9c6b3c },
  stone: { texture: null, frame: 0, color: 0x9aa0a6 },
};

/** `ui` válida distinta de la del repositorio: márgenes 0, otros colores y otra familia. */
function otherUi(): unknown {
  const ui = structuredClone(appearanceJson.ui);
  for (const piece of Object.values(ui.pieces) as Record<string, unknown>[]) {
    const slice = piece.slice as Record<string, number>;
    for (const k of Object.keys(slice)) slice[k] = 0;
    piece.fill = '#ffffff';
    piece.ink = { text: '#000000', muted: '#111111', accent: '#0a0a40', danger: '#8b0000' };
  }
  ui.font.family = 'Courier New';
  return ui;
}

function boot(ui: unknown) {
  const booted = bootContent(
    {
      content: repositoryContent(),
      appearance: { ...appearanceJson, ui },
      guide: guideJson,
      audio: audioJson,
    },
    (e) => {
      throw new Error(`${e.field}: ${e.message}`);
    },
    REGISTERED,
    GENERATED_PATHS,
  );
  if (!booted) throw new Error('arranque fallido');
  return booted;
}

/** 1.200 ticks de la 42 con inputs fijos y opción 0, pintando HUD y cartas con esa `ui`. */
function play(ui: UiAppearance, config: ReturnType<typeof boot>['config']): string[] {
  const run = startSeededRun(config, 42);
  const { scene } = fakeUiScene({ view: { width: 1280, height: 720 } });
  const frame = screenFrame(1280, 720);
  const hud = createHud(scene, frame, ICONS, ui);
  const offer = createUpgradeOverlay(scene, frame, ui);
  const out: string[] = [];
  for (const input of randomInputs(1200, 32)) {
    chooseFirstWhileOpen(run);
    run.tick(input);
    const s: RunSnapshot = run.snapshot();
    hud.sync(s);
    offer.sync(s.status === 'choosing' ? s.offer : []);
    out.push(JSON.stringify(s));
  }
  return out;
}

describe('Interfaz e invariancia (sprite-rendering 0032)', () => {
  it('Scenario: La interfaz no cambia la simulación ni el mapa (1.200 ticks de la 42)', () => {
    const repo = boot(appearanceJson.ui);
    const other = boot(otherUi());
    expect(other.appearance.ui.font.family).toBe('Courier New');
    expect(other.config).toEqual(repo.config);
    expect(play(other.appearance.ui, other.config)).toEqual(play(repo.appearance.ui, repo.config));
  });

  it('Scenario: La interfaz no cambia la simulación ni el mapa (objetos del mapa 820 y 904)', () => {
    const other = boot(otherUi()).appearance.ui;
    for (const [seed, objects] of [
      [42, 820],
      [123, 904],
    ] as const) {
      const map = startSeededRun(boot(appearanceJson.ui).config, seed).map;
      expect(planFor(map, seed).objects).toBe(objects);
      expect(planFor(map, seed, [], { appearance: (a) => ({ ...a, ui: other }) }).objects).toBe(
        objects,
      );
    }
  });
});
