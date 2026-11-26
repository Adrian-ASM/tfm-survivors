import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { AudioCues } from '../../../src/infrastructure/audio/audioCues';
import { AudioDirector } from '../../../src/infrastructure/audio/AudioDirector';
import { EffectMixer } from '../../../src/infrastructure/audio/EffectMixer';
import { EFFECT_TYPES } from '../../../src/infrastructure/audio/effectTypes';
import {
  mutedSoundOut,
  unavailableSoundOut,
  type SoundOut,
} from '../../../src/infrastructure/audio/SoundOut';
import { FakeSoundOut, repositoryAudio } from '../../support/audio';
import { aDefaultConfig, TICK_MS } from '../../support/builders';
import { randomInputs } from '../../support/inputs';
import { referenceBot } from '../../support/policies';
import { chooseFirstWhileOpen, playReferenceBot, startSeededRun } from '../../support/runs';

const SETTINGS = { music: 50, effects: 80, muted: false };

/** Director con el contenido de audio del repositorio y la salida dada, con la partida empezada. */
function directorFor(out: SoundOut): { d: AudioDirector; mixer: EffectMixer } {
  const audio = repositoryAudio();
  const mixer = new EffectMixer(audio.effects, audio.maxVoices, out);
  const cues = new AudioCues({ towerMatchPx: audio.towerMatchPx, maxTowerProjectiles: 16 });
  const d = new AudioDirector({ out, cues, mixer, settings: SETTINGS });
  d.newRun();
  d.screen('playing');
  return { d, mixer };
}

const balanced = (c: { requested: number; played: number; dropped: number }): boolean =>
  c.requested === c.played + c.dropped;

describe('Audio con partidas reales, sin navegador (spec audio)', () => {
  it('Scenario: Cuentas cuadran', () => {
    const config = aDefaultConfig();
    const run = startSeededRun(config, 42);
    const bot = referenceBot(config, run.map);
    const { d, mixer } = directorFor(new FakeSoundOut());
    d.frame(run.snapshot(), 0, false);
    const broken: string[] = [];
    let processed = 0;
    for (let block = 1; block <= 60 && run.status !== 'over'; block++) {
      const s = playReferenceBot(run, bot, 60);
      d.frame(s, block * 60 * TICK_MS, false);
      processed += 1;
      const { stats } = mixer;
      for (const t of EFFECT_TYPES) {
        const c = stats.byType[t];
        if (!balanced(c) || c.played > processed) broken.push(`${String(block)}:${t}`);
      }
      if (!balanced(stats)) broken.push(`${String(block)}:total`);
    }

    expect(broken).toEqual([]);
    expect(mixer.stats.requested).toBeGreaterThan(0);
  });

  it('Scenario: Contadores coherentes con el snapshot', () => {
    const run = startSeededRun(aDefaultConfig(), 42, 'empty');
    const { d } = directorFor(mutedSoundOut());
    d.frame(run.snapshot(), 0, false);
    let s: RunSnapshot = run.snapshot();
    let unbalanced = 0;
    for (let t = 1; t <= 20_000 && s.kills < 1 && run.status !== 'over'; t++) {
      chooseFirstWhileOpen(run);
      run.tick(PlayerInput.NONE);
      s = run.snapshot();
      d.frame(s, t * TICK_MS, false);
      if (!balanced(d.view())) unbalanced += 1;
    }
    const view = d.view();

    expect(s.kills).toBeGreaterThanOrEqual(1);
    expect(view.byType.enemyDeath.requested).toBe(s.kills);
    expect([unbalanced, view.filesRequested, view.sounding]).toEqual([0, 0, 0]);
  });

  it('Scenario: Misma partida con y sin audio', () => {
    const config = aDefaultConfig();
    const inputs = randomInputs(3600, 7);
    const withAudio = startSeededRun(config, 42);
    const without = startSeededRun(config, 42);
    const a = directorFor(new FakeSoundOut());
    const b = directorFor(unavailableSoundOut());
    let muted = false;
    let differing = 0;
    for (let t = 0; t < inputs.length; t++) {
      if (t === 100 || t === 900) {
        muted = !muted;
        a.d.setSettings({ ...SETTINGS, muted });
      }
      const input = inputs[t];
      if (!input) continue;
      chooseFirstWhileOpen(withAudio);
      chooseFirstWhileOpen(without);
      withAudio.tick(input);
      without.tick(input);
      const sa = withAudio.snapshot();
      const sb = without.snapshot();
      a.d.frame(sa, t * TICK_MS, false);
      b.d.frame(sb, t * TICK_MS, false);
      if (JSON.stringify(sa) !== JSON.stringify(sb)) differing += 1;
    }

    expect(differing).toBe(0);
    expect(b.mixer.stats.played).toBe(0);
  });
});

/** Ficheros `.ts` bajo una carpeta, recursivo. */
function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return tsFiles(path);
    return e.name.endsWith('.ts') ? [path] : [];
  });
}

describe('Audio sin efecto en la simulación (spec audio 0035)', () => {
  it('Scenario: Balance y firmas (el núcleo no conoce el audio; balance y firmas los vigila verify)', () => {
    const root = join(import.meta.dirname, '..', '..', '..', 'src');
    const core = [...tsFiles(join(root, 'domain')), ...tsFiles(join(root, 'application'))];
    const touching = core.filter((f) => /audio|sound/i.test(readFileSync(f, 'utf8')));

    // BALANCE_BASELINE (tests/domain/balance.test.ts) y las seis firmas doradas corren en `verify`
    // sin regenerarlas; aquí, que ningún fichero del núcleo nombra el audio.
    expect(core.length).toBeGreaterThan(0);
    expect(touching).toEqual([]);
  });
});
