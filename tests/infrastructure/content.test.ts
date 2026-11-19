import { describe, expect, it } from 'vitest';
import { StartRun } from '../../src/application/StartRun';
import { loadRunConfig, parseRunConfig } from '../../src/infrastructure/content/loadRunConfig';

const arena = { width: 960, height: 540 };

describe('Contenido del jugador validado', () => {
  it('Contenido válido', () => {
    const r = parseRunConfig({ player: { speed: 200, radius: 16 }, arena });
    expect(r.ok && r.value.player).toEqual({ speed: 200, radius: 16 });
  });

  it('el contenido versionado es válido', () => {
    expect(loadRunConfig().ok).toBe(true);
  });

  it('Velocidad negativa', () => {
    const r = parseRunConfig({ player: { speed: -5, radius: 16 }, arena });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe('player.speed');
  });

  it('Radio que no cabe en la arena', () => {
    const r = parseRunConfig({ player: { speed: 200, radius: 300 }, arena });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe('player.radius');
  });

  it('el dominio mantiene la invariante del radio como defensa', () => {
    const started = new StartRun().execute({ player: { speed: 200, radius: 300 }, arena });
    expect(started.ok).toBe(false);
    if (!started.ok) expect(started.error.field).toBe('player.radius');
  });

  it('rechaza campos desconocidos y tipos erróneos', () => {
    expect(parseRunConfig({ player: { speed: '200', radius: 16 }, arena }).ok).toBe(false);
    expect(parseRunConfig({ player: { speed: 200, radius: 16, hp: 3 }, arena }).ok).toBe(false);
    expect(
      parseRunConfig({ player: { speed: 200, radius: 16 }, arena: { width: 9.5, height: 5 } }).ok,
    ).toBe(false);
  });
});
