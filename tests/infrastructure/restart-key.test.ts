import { describe, expect, it } from 'vitest';
import { RestartKey } from '../../src/infrastructure/phaser/RestartKey';

/**
 * Tecla doble con la semántica de Phaser 4.2.1 (`Key.onDown`): emite `down` solo en la primera
 * pulsación; mientras sigue pulsada, las repeticiones del sistema no emiten (`emitOnRepeat` false).
 */
class FakeKey {
  private handler: (() => void) | null = null;
  private isDown = false;
  on(_event: 'down', handler: () => void): void {
    this.handler = handler;
  }
  keydown(): void {
    if (this.isDown) return;
    this.isDown = true;
    this.handler?.();
  }
  keyup(): void {
    this.isDown = false;
  }
}

function restartKey() {
  const added: string[] = [];
  const key = new FakeKey();
  const kb = {
    addKey(code: string) {
      added.push(code);
      return key;
    },
  };
  return { added, key, restart: new RestartKey(kb as never) };
}

describe('RestartKey (spec run-results)', () => {
  it('escucha la tecla R; sin pulsar, read() es false', () => {
    const { added, restart } = restartKey();

    expect([added, restart.read()]).toEqual([['R'], false]);
  });

  it('read() consume la pulsación', () => {
    const { key, restart } = restartKey();
    key.keydown();

    expect([restart.read(), restart.read()]).toEqual([true, false]);
  });

  it('Scenario: Una pulsación, una partida nueva (mantenida 60 frames: un solo true)', () => {
    const { key, restart } = restartKey();
    key.keydown();

    const reads = Array.from({ length: 60 }, () => {
      key.keydown();
      return restart.read();
    });
    key.keyup();

    expect(reads.filter(Boolean)).toHaveLength(1);
    expect(restart.read()).toBe(false);
  });
});
