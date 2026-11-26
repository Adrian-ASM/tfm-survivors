import { describe, expect, it } from 'vitest';
import guideJson from '../../content/guide.json';
import appearanceJson from '../../content/appearance.json';
import provenanceJson from '../../content/asset-provenance.json';
import { BuildOnSite } from '../../src/application/BuildOnSite';
import { LeaveSite } from '../../src/application/LeaveSite';
import { TickRun } from '../../src/application/TickRun';
import { assetUrl } from '../../src/composition/assetUrl';
import { bootContent } from '../../src/composition/contentBoot';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { repositoryContent } from '../../src/infrastructure/content/loadRunConfig';
import { BuildPanel } from '../../src/infrastructure/dom/BuildPanel';
import { resourceIcons } from '../../src/infrastructure/dom/resourceIcons';
import { BuildGate } from '../../src/infrastructure/phaser/BuildGate';
import { TICK_MS } from '../support/builders';
import { fakeDom, type FakeElement } from '../support/fakeDom';
import { startSeededRun } from '../support/runs';
import { registeredPaths } from '../../src/infrastructure/content/loadAppearance';

// Regresión de tasks 0027 §3.4 ("solo se podían construir casas"): de extremo a extremo sin
// navegador, con el contenido y el aspecto reales del repositorio (como `main`), el mapa generado de
// la semilla 42, 30 de madera y 15 de piedra y el jugador tocando el primer solar. La torre debe
// salir activada en el panel y en su vista (la de la sonda), y el clic, construirla.
describe('Torre construible con el contenido real (regresión 0027 §3.4)', () => {
  it('panel y sonda con la torre activada; el clic la construye (madera −30, piedra −15)', () => {
    const booted = bootContent(
      { content: repositoryContent(), appearance: appearanceJson, guide: guideJson },
      (e) => {
        throw new Error(`${e.field}: ${e.message}`);
      },
      registeredPaths(provenanceJson),
    );
    if (!booted) throw new Error('el contenido real no arranca');
    const { config, appearance } = booted;
    const { sites, cellSize } = startSeededRun(config, 42).map;
    const first = sites[0];
    if (!first) throw new Error('sin solares');
    // Tangente a la cara inferior de la huella del primer solar.
    const touch = { x: first.x, y: (first.row + first.rows) * cellSize + config.player.radius };
    const run = startSeededRun(config, 42, 'generated', {
      player: touch,
      resources: { gold: 0, wood: 30, stone: 15 },
    });
    const tickRun = new TickRun(run);
    const opened = tickRun.execute(TICK_MS, PlayerInput.NONE);
    expect([opened.status, opened.build.siteId]).toEqual(['building', first.id]);

    const { doc, root, fake } = fakeDom();
    const icons = resourceIcons(appearance, (file) => assetUrl('/tfm-survivors/', file));
    const panel = new BuildPanel(doc, root, icons);
    panel.sync(opened);
    panel.setVisible(true);
    const rows = (fake.children[0] as FakeElement).findAll((e) => e.dataset.building !== undefined);
    const tower = rows.find((r) => r.dataset.building === 'tower');
    expect(rows.map((r) => r.dataset.building)).toEqual(['house', 'tower']);
    expect(tower?.getAttribute('disabled')).toBeNull();
    expect(tower?.className.split(' ')).not.toContain('is-unavailable');
    expect(panel.view.options[1]).toEqual({
      kind: 'tower',
      wood: 30,
      stone: 15,
      affordable: true,
      missing: { wood: 0, stone: 0 },
    });

    tower?.click();
    const action = panel.takeAction();
    expect(action).toEqual({ kind: 'build', building: 'tower' });
    const uc = { buildOnSite: new BuildOnSite(run), leaveSite: new LeaveSite(run) };
    const step = new BuildGate().step(false, action, opened.status, uc);
    const built = step.snapshot ?? run.snapshot();

    expect(built.sites[first.id]?.state).toBe('tower');
    expect([built.resources.wood, built.resources.stone]).toEqual([
      opened.resources.wood - 30,
      opened.resources.stone - 15,
    ]);
    expect(built.status).toBe('running');
  });
});
