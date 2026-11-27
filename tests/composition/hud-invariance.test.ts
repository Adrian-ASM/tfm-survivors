import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import guideJson from '../../content/guide.json';
import audioJson from '../../content/audio.json';
import provenanceJson from '../../content/asset-provenance.json';
import { bootContent } from '../../src/composition/contentBoot';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { Appearance } from '../../src/infrastructure/content/appearanceSchema';
import { registeredPaths } from '../../src/infrastructure/content/loadAppearance';
import { repositoryContent } from '../../src/infrastructure/content/loadRunConfig';
import { resolveLooks } from '../../src/infrastructure/phaser/art/looks';
import { createHud, hudIcons } from '../../src/infrastructure/phaser/sceneWidgets';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { hudLayout } from '../../src/infrastructure/phaser/ui/uiLayout';
import { GENERATED_PATHS, SOUND_PATHS } from '../support/generated';
import { randomInputs } from '../support/inputs';
import { pngFrames } from '../support/looks';
import { planFor } from '../support/mapArt';
import { fakeUiScene } from '../support/phaserUi';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Spec sprite-rendering (0036), "Los datos del HUD no cambian la simulación ni el mapa": el bloque
// `hud` de `appearance.json` es presentación pura (no lo lee ningún flujo de azar ni colocación).
const REGISTERED = registeredPaths(provenanceJson);

/** Datos del HUD válidos distintos de los del repositorio: s 40, p 48 y otro frame de calavera. */
function otherHud(): unknown {
  const hud = structuredClone(appearanceJson.hud);
  hud.iconSize = 40;
  hud.pitch = 48;
  hud.icons.kills.frame = 6;
  return hud;
}

function boot(hud: unknown) {
  const booted = bootContent(
    {
      content: repositoryContent(),
      appearance: { ...appearanceJson, hud },
      guide: guideJson,
      audio: audioJson,
    },
    (e) => {
      throw new Error(`${e.field}: ${e.message}`);
    },
    REGISTERED,
    GENERATED_PATHS,
    SOUND_PATHS,
  );
  if (!booted) throw new Error('arranque fallido');
  return booted;
}

/** 1.200 ticks de la 42 con inputs fijos y opción 0, pintando el HUD con esos datos. */
function play(appearance: Appearance, config: ReturnType<typeof boot>['config']): string[] {
  const run = startSeededRun(config, 42);
  const { scene } = fakeUiScene({ view: { width: 1280, height: 720 } });
  const frame = screenFrame(1280, 720);
  const frames = pngFrames(appearance);
  const icons = hudIcons(appearance, resolveLooks(appearance, frames), frames);
  const hud = createHud(scene, frame, icons, appearance.hud, appearance.ui);
  const out: string[] = [];
  for (const input of randomInputs(1200, 32)) {
    chooseFirstWhileOpen(run);
    run.tick(input);
    const s: RunSnapshot = run.snapshot();
    hud.sync(s);
    out.push(JSON.stringify(s));
  }
  return out;
}

describe('Datos del HUD e invariancia (sprite-rendering 0036)', () => {
  it('Scenario: Los datos del HUD no cambian la simulación ni el mapa (1.200 ticks de la 42)', () => {
    const repo = boot(appearanceJson.hud);
    const other = boot(otherHud());
    expect([other.appearance.hud.iconSize, other.appearance.hud.pitch]).toEqual([40, 48]);
    expect(other.config).toEqual(repo.config);
    // Los datos sí cambian el HUD (otro lado y otro paso) y no la simulación.
    const l = (a: Appearance) => hudLayout(screenFrame(1280, 720), a.hud);
    expect(l(other.appearance).stone.icon).not.toEqual(l(repo.appearance).stone.icon);
    expect(play(other.appearance, other.config)).toEqual(play(repo.appearance, repo.config));
  });

  it('Scenario: Los datos del HUD no cambian la simulación ni el mapa (objetos del mapa 820 y 904)', () => {
    const other = boot(otherHud()).appearance.hud;
    for (const [seed, objects] of [
      [42, 820],
      [123, 904],
    ] as const) {
      const map = startSeededRun(boot(appearanceJson.hud).config, seed).map;
      expect(planFor(map, seed).objects).toBe(objects);
      expect(planFor(map, seed, [], { appearance: (a) => ({ ...a, hud: other }) }).objects).toBe(
        objects,
      );
    }
  });
});
