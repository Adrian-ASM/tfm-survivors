import type Phaser from 'phaser';
import { PlayerInput } from '../../domain/player/PlayerInput';

type Key = Phaser.Input.Keyboard.Key;
interface MoveKeys {
  up: Key;
  down: Key;
  left: Key;
  right: Key;
  w: Key;
  a: Key;
  s: Key;
  d: Key;
}

/** Adaptador de input: WASD y flechas → PlayerInput. Sin lógica de juego. */
export class KeyboardInput {
  private readonly keys: MoveKeys;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    this.keys = keyboard.addKeys({
      up: 'UP',
      down: 'DOWN',
      left: 'LEFT',
      right: 'RIGHT',
      w: 'W',
      a: 'A',
      s: 'S',
      d: 'D',
    }) as MoveKeys;
  }

  read(): PlayerInput {
    const k = this.keys;
    const axis = (pos: boolean, neg: boolean): number => (pos ? 1 : 0) - (neg ? 1 : 0);
    return PlayerInput.of(
      axis(k.right.isDown || k.d.isDown, k.left.isDown || k.a.isDown),
      axis(k.down.isDown || k.s.isDown, k.up.isDown || k.w.isDown),
    );
  }
}
