import type { PlayerInput } from '../../../domain/player/PlayerInput';

/** Fuente de movimiento de un frame: el teclado, el joystick o su combinación. */
export interface MoveSource {
  read(): PlayerInput;
}

/** ¿Es el input nulo (0, 0)? */
export const isStill = (input: PlayerInput): boolean =>
  input.direction.x === 0 && input.direction.y === 0;

/**
 * Precedencia del teclado (spec touch-controls 0033): si hay alguna tecla de movimiento pulsada,
 * manda el teclado; si no, el joystick. Las dos fuentes se leen siempre (el joystick sondea su dedo
 * en cada lectura), aunque mande el teclado.
 */
export function preferKeyboard(keyboard: MoveSource, touch: MoveSource): MoveSource {
  return {
    read: () => {
      const keys = keyboard.read();
      const stick = touch.read();
      return isStill(keys) ? stick : keys;
    },
  };
}
