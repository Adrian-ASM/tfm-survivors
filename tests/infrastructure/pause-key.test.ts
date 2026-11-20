import { describe, expect, it } from 'vitest';
import { PauseKey } from '../../src/infrastructure/phaser/PauseKey';

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

function pauseKey() {
  const added: string[] = [];
  const key = new FakeKey();
  const kb = {
    addKey(code: string) {
      added.push(code);
      return key;
    },
  };
  return { added, key, pause: new PauseKey(kb as never) };
}

describe('PauseKey (spec main-menu)', () => {
  it('escucha la tecla Esc; sin pulsar, read() es false', () => {
    const { added, pause } = pauseKey();

    expect([added, pause.read()]).toEqual([['ESC'], false]);
  });

  it('read() consume la pulsación', () => {
    const { key, pause } = pauseKey();
    key.keydown();

    expect([pause.read(), pause.read()]).toEqual([true, false]);
  });

  it('Scenario: Esc mantenido (mantenida 60 frames: un solo true)', () => {
    const { key, pause } = pauseKey();
    key.keydown();

    const reads = Array.from({ length: 60 }, () => {
      key.keydown();
      return pause.read();
    });
    key.keyup();

    expect(reads.filter(Boolean)).toHaveLength(1);
    expect(pause.read()).toBe(false);
  });
});
