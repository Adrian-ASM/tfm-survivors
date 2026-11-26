import { describe, expect, it, vi } from 'vitest';
import { audioUrl } from '../../src/composition/assetUrl';
import {
  AudioLoadStatus,
  audioFilesToLoad,
  audioMode,
  hasWebAudio,
  noAudio,
} from '../../src/infrastructure/audio/audioPlan';
import type { AudioContent } from '../../src/infrastructure/content/audioSchema';
import { AudioLoadScene, launchAudioLoad } from '../../src/infrastructure/phaser/AudioLoadScene';
import { imagesToLoad, sheetsToLoad } from '../../src/infrastructure/phaser/bootPlan';
import { AUDIO_LOAD_SCENE_KEY } from '../../src/infrastructure/phaser/sceneKeys';
import { repositoryAudio } from '../support/audio';
import { repoAppearance } from '../support/mapArt';

// Phaser no arranca en Node: la escena solo necesita la clase base y la constante del evento.
vi.mock('phaser', () => ({
  default: {
    Scene: class {
      constructor(readonly config: unknown) {}
    },
    Loader: { Events: { FILE_LOAD_ERROR: 'loaderror' } },
  },
}));

// Spec audio (0035), "Desbloqueo y fallos de audio": modo de audio de la carga, ficheros que se
// piden y carga en paralelo sin retrasar el menú (design D1 y D8).

const withFile = (over: Partial<AudioContent>): AudioContent => ({ ...repositoryAudio(), ...over });

describe('Modo de audio de la carga (D1)', () => {
  it.each([
    [true, true, 'muted'],
    [true, false, 'muted'],
    [false, true, 'web'],
    [false, false, 'unavailable'],
  ] as const)('e2e %s y Web Audio %s ⇒ %s', (e2e, web, mode) => {
    expect(audioMode(e2e, web)).toBe(mode);
  });

  it('Scenario: Navegador sin Web Audio (sin AudioContext: modo no disponible y noAudio en el motor)', () => {
    expect(hasWebAudio({})).toBe(false);
    expect(hasWebAudio({ webkitAudioContext: () => undefined })).toBe(true);
    expect(hasWebAudio({ AudioContext: () => undefined })).toBe(true);
    expect([noAudio('unavailable'), noAudio('muted'), noAudio('web')]).toEqual([true, true, false]);
  });
});

describe('Ficheros de audio que se piden (D8)', () => {
  it('con file null (repositorio hasta la tarea 6.1) no se pide nada', () => {
    expect(audioFilesToLoad(repositoryAudio(), (f) => f)).toEqual([]);
  });

  it('uno por fichero distinto, música primero, con la URL bajo la base', () => {
    const base = repositoryAudio();
    const audio = withFile({
      music: { file: 'loop.ogg' },
      effects: {
        ...base.effects,
        pickupGold: { ...base.effects.pickupGold, file: 'coin.ogg' },
        purchase: { ...base.effects.purchase, file: 'coin.ogg' },
      },
    });

    const files = audioFilesToLoad(audio, (f) => audioUrl('/tfm-survivors/', f));

    expect(files).toEqual([
      { key: 'audio:loop.ogg', url: '/tfm-survivors/assets/audio/loop.ogg' },
      { key: 'audio:coin.ogg', url: '/tfm-survivors/assets/audio/coin.ogg' },
    ]);
  });
});

describe('Carga del audio en paralelo (D8)', () => {
  it('Scenario: Menú sin esperar al audio (BootScene no carga audio: va en otra escena)', () => {
    const appearance = repoAppearance();
    const booted = [...sheetsToLoad(appearance), ...imagesToLoad(appearance)];

    expect(booted.filter((f) => /\.(ogg|mp3|wav)$/i.test(f.file))).toEqual([]);
  });

  it('Scenario: Menú sin esperar al audio (launch, no start: la escena del audio no bloquea)', () => {
    const launched: string[] = [];
    const scenes = { launch: (k: string) => launched.push(k) };

    launchAudioLoad(scenes, true);
    launchAudioLoad(scenes, false);

    expect(launched).toEqual([AUDIO_LOAD_SCENE_KEY]);
  });

  it('Scenario: Fichero que no carga (AudioLoadScene anota el fallo y cuenta lo pedido)', () => {
    const status = new AudioLoadStatus();
    const scene = new AudioLoadScene({
      files: [
        { key: 'audio:a.ogg', url: '/a.ogg' },
        { key: 'audio:b.ogg', url: '/b.ogg' },
      ],
      status,
    });
    const queued: string[] = [];
    let onError: ((file: { key: string }) => void) | undefined;
    Object.assign(scene, {
      load: {
        on: (_event: string, fn: (file: { key: string }) => void) => {
          onError = fn;
        },
        audio: (key: string) => queued.push(key),
      },
    });

    scene.preload();
    onError?.({ key: 'audio:b.ogg' });

    expect(queued).toEqual(['audio:a.ogg', 'audio:b.ogg']);
    expect([status.requested, [...status.failed]]).toEqual([2, ['audio:b.ogg']]);
  });
});
