import { describe, expect, it } from 'vitest';
import appearanceJson from '../../../content/appearance.json';
import audioJson from '../../../content/audio.json';
import guideJson from '../../../content/guide.json';
import provenanceJson from '../../../content/asset-provenance.json';
import { bootContent } from '../../../src/composition/contentBoot';
import type { DomainError } from '../../../src/domain/shared/Result';
import { EFFECT_TYPES } from '../../../src/infrastructure/audio/effectTypes';
import { AUDIO_NOT_REGISTERED } from '../../../src/infrastructure/content/audioSchema';
import { registeredPaths } from '../../../src/infrastructure/content/loadAppearance';
import { parseAudio, soundPaths } from '../../../src/infrastructure/content/loadAudio';
import { repositoryContent } from '../../../src/infrastructure/content/loadRunConfig';
import { GENERATED_PATHS } from '../../support/generated';

type Json = Record<string, unknown>;
const fresh = (): Json => structuredClone(audioJson);
const effects = (a: Json) => a['effects'] as Record<string, Json>;
const defaults = (a: Json) => a['defaults'] as Json;

/** Arranque completo con el audio dado: devuelve el contenido arrancado (o null) y los errores. */
function boot(audio: unknown, sounds: readonly string[] = soundPaths(provenanceJson)) {
  const errors: DomainError[] = [];
  const booted = bootContent(
    { content: repositoryContent(), appearance: appearanceJson, guide: guideJson, audio },
    (e) => errors.push(e),
    registeredPaths(provenanceJson),
    GENERATED_PATHS,
    sounds,
  );
  return { booted, errors };
}

/** Arranque correcto con el contenido del repositorio. */
function booted() {
  const { booted: b } = boot(audioJson);
  if (!b) throw new Error('el contenido del repositorio no arranca');
  return b;
}

/** El primer error del arranque con el audio modificado por `change` (y el menú sin crear). */
function failure(change: (a: Json) => void, sounds?: readonly string[]): DomainError {
  const a = fresh();
  change(a);
  const { booted, errors } = boot(a, sounds);
  expect(booted).toBeNull();
  const [first] = errors;
  if (!first) throw new Error('se esperaba un error de contenido');
  return first;
}

describe('Contenido de audio validado (spec audio, 0035)', () => {
  it('Scenario: Contenido por defecto válido', () => {
    const { booted, errors } = boot(audioJson);
    const audio = booted?.audio;
    const files = new Set([audio?.music.file, ...EFFECT_TYPES.map((t) => audio?.effects[t].file)]);

    expect(errors).toEqual([]);
    expect(Object.keys(audio?.effects ?? {})).toEqual([...EFFECT_TYPES]);
    expect([audio?.music.file, files.size]).toEqual(['song.mp3', 11]);
    expect(audio?.maxVoices).toBeGreaterThanOrEqual(1);
    expect(audio?.defaults).toEqual({ music: 50, effects: 80, muted: false });
  });

  it('Scenario: Contenido por defecto válido (file null ya no es válido)', () => {
    const e = failure((a) => {
      (effects(a)['build'] as Json)['file'] = null;
    });

    expect(e.field).toBe('audio.effects.build.file');
  });

  it('Scenario: Contenido por defecto válido (música sin fichero tampoco)', () => {
    const e = failure((a) => {
      (a['music'] as Json)['file'] = null;
    });

    expect(e.field).toBe('audio.music.file');
  });

  it('Scenario: Fichero compartido (dos tipos citan el mismo fichero, cada uno con su ganancia)', () => {
    const audio = booted().audio;

    expect(audio.effects.impactWeapon.file).toBe(audio.effects.impactTower.file);
    expect(audio.effects.explosion.file).toBe(audio.effects.impactBlast.file);
    expect(audio.effects.explosion.gain).not.toBe(audio.effects.impactBlast.gain);
  });

  it('Scenario: Tipo de efecto ausente o desconocido (sin build)', () => {
    const e = failure((a) => {
      delete effects(a)['build'];
    });

    expect(e.field).toBe('audio.effects.build');
  });

  it('Scenario: Tipo de efecto ausente o desconocido (con jump)', () => {
    const e = failure((a) => {
      effects(a)['jump'] = { ...effects(a)['pickupGold'] };
    });

    expect(e.field).toBe('audio.effects.jump');
  });

  it.each([
    ['tope de voces 0', (a: Json) => (a['maxVoices'] = 0), 'audio.maxVoices'],
    ['música por defecto 101', (a: Json) => (defaults(a)['music'] = 101), 'audio.defaults.music'],
    [
      'efectos por defecto 12,5',
      (a: Json) => (defaults(a)['effects'] = 12.5),
      'audio.defaults.effects',
    ],
    [
      'ganancia de pickupWood 1,2',
      (a: Json) => ((effects(a)['pickupWood'] as Json)['gain'] = 1.2),
      'audio.effects.pickupWood.gain',
    ],
    [
      'intervalo de enemyDeath −1',
      (a: Json) => ((effects(a)['enemyDeath'] as Json)['minIntervalMs'] = -1),
      'audio.effects.enemyDeath.minIntervalMs',
    ],
    ['tolerancia de torre 0', (a: Json) => (a['towerMatchPx'] = 0), 'audio.towerMatchPx'],
  ])('Scenario: Valores fuera de rango (%s)', (_name, change, field) => {
    expect(failure(change).field).toBe(field);
  });

  it('Scenario: Fichero sin procedencia', () => {
    const e = failure((a) => {
      (effects(a)['levelUp'] as Json)['file'] = 'level-up.ogg';
    });

    expect(e.field).toBe('audio.effects.levelUp.file');
    expect(e.message).toContain(AUDIO_NOT_REGISTERED);
    expect(e.message).toContain('public/assets/audio/level-up.ogg');
  });

  it('Scenario: Fichero sin procedencia (un fichero registrado arranca)', () => {
    const a = fresh();
    (effects(a)['levelUp'] as Json)['file'] = 'level-up.ogg';

    const parsed = parseAudio(a, [
      ...soundPaths(provenanceJson),
      'public/assets/audio/level-up.ogg',
    ]);

    expect(parsed.ok).toBe(true);
  });

  it('Scenario: Fichero sin procedencia (un nombre con carpeta o mayúsculas no vale)', () => {
    const e = failure((a) => {
      (effects(a)['levelUp'] as Json)['file'] = '../Level.OGG';
    });

    expect(e.field).toBe('audio.effects.levelUp.file');
  });

  it('Scenario: Campo desconocido', () => {
    const e = failure((a) => {
      (effects(a)['explosion'] as Json)['pan'] = 0.3;
    });

    expect(e.field).toBe('audio.effects.explosion.pan');
  });
});
