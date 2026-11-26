import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import audioJson from '../../content/audio.json';
import { AUDIO_DIR, type AudioContent } from '../../src/infrastructure/content/audioSchema';
import { audioFilesOf } from '../../src/infrastructure/content/loadAudio';
import { repositoryAudio } from '../support/audio';

// Spec audio (0035, design D14), "Ficheros de audio usados y peso": cada audio versionado está citado
// por el contenido de audio, cada fichero citado está versionado y la suma de bytes no pasa de 6 MiB.

/** Tope de peso de todo el audio versionado (6 MiB, spec audio rev. tras el gate). */
const AUDIO_MAX_BYTES = 6_291_456;
const AUDIO = /\.(ogg|mp3|wav|flac)$/i;

/**
 * Problemas de uso y de peso, pura: `files` es la lista versionada, `sizes` da los bytes de cada
 * fichero y `audio` es el contenido validado.
 */
function audioFileProblems(
  files: readonly string[],
  sizes: (path: string) => number,
  audio: AudioContent,
): string[] {
  const versioned = files.filter((f) => AUDIO.test(f));
  const cited = new Set(audioFilesOf(audio).map(([, file]) => AUDIO_DIR + file));
  const problems: string[] = [];
  for (const f of versioned) {
    if (!cited.has(f)) problems.push(`${f}: fichero de audio sin uso en content/audio.json.`);
  }
  const present = new Set(files);
  for (const f of cited) {
    if (!present.has(f)) problems.push(`${f}: citado en content/audio.json pero no versionado.`);
  }
  const total = versioned.reduce((sum, f) => sum + sizes(f), 0);
  if (total > AUDIO_MAX_BYTES) {
    problems.push(`Audio versionado: ${String(total)} bytes > ${String(AUDIO_MAX_BYTES)}.`);
  }
  return problems;
}

const root = join(import.meta.dirname, '..', '..');
const versioned = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const diskBytes = (path: string): number => statSync(join(root, path)).size;

describe('Ficheros de audio usados y peso (spec audio 0035, D14)', () => {
  it('Scenario: Todos usados (repositorio: cada audio versionado citado y cada citado versionado)', () => {
    expect(audioFileProblems(versioned, diskBytes, repositoryAudio())).toEqual([]);
  });

  it('Scenario: Fichero de audio de más', () => {
    const extra = `${AUDIO_DIR}extra.ogg`;

    const out = audioFileProblems([...versioned, extra], () => 10, repositoryAudio());

    expect(out.join('\n')).toContain('extra.ogg');
  });

  it('Scenario: Fichero de audio de más (un fichero citado sin versionar también falla)', () => {
    const audio = structuredClone(audioJson) as unknown as AudioContent;
    const cited = { ...audio, music: { file: 'music-loop.ogg' } };

    const out = audioFileProblems(versioned, diskBytes, cited);

    expect(out.join('\n')).toContain(`${AUDIO_DIR}music-loop.ogg`);
  });

  it('Scenario: Tope de peso (repositorio: ≤ 6.291.456 bytes)', () => {
    const total = versioned.filter((f) => AUDIO.test(f)).reduce((s, f) => s + diskBytes(f), 0);

    expect(total).toBeLessThanOrEqual(AUDIO_MAX_BYTES);
  });

  it('Scenario: Tope de peso (lista simulada con 6.291.457 bytes: falla y da el total)', () => {
    const big = `${AUDIO_DIR}music-loop.ogg`;
    const hit = `${AUDIO_DIR}hit.flac`;
    const audio = structuredClone(audioJson) as unknown as AudioContent;
    const cited: AudioContent = {
      ...audio,
      music: { file: 'music-loop.ogg' },
      effects: { ...audio.effects, pickupGold: { ...audio.effects.pickupGold, file: 'hit.flac' } },
    };
    const sizes = (p: string): number => (p === big ? 6_291_456 : 1);

    const out = audioFileProblems([...versioned, big, hit], sizes, cited);

    expect(out).toEqual(['Audio versionado: 6291457 bytes > 6291456.']);
  });

  it('Scenario: Tope de peso (lista simulada con exactamente 6.291.456 bytes: pasa)', () => {
    const big = `${AUDIO_DIR}music-loop.ogg`;
    const audio = structuredClone(audioJson) as unknown as AudioContent;
    const cited: AudioContent = { ...audio, music: { file: 'music-loop.ogg' } };

    const out = audioFileProblems([...versioned, big], () => 6_291_456, cited);

    expect(out).toEqual([]);
  });
});
