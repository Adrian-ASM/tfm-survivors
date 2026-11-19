import type Phaser from 'phaser';

/** Lo mínimo que se usa de una tecla del motor: su evento `down` (primera pulsación). */
interface DownKey {
  on(event: 'down', handler: () => void): unknown;
}

/** Teclas de cada opción (fila de números y teclado numérico), en orden de índice. */
const CODES = [
  ['ONE', 'NUMPAD_ONE'],
  ['TWO', 'NUMPAD_TWO'],
  ['THREE', 'NUMPAD_THREE'],
] as const;

/**
 * Adaptador de input de la elección: teclas 1–3 → índice 0–2 (−1 si ninguna). Escucha el evento
 * `down` de cada tecla, que el motor emite una sola vez por pulsación (no al mantenerla), así que
 * mantener una tecla no elige también en la oferta siguiente. No usa `JustDown`: en Phaser 4.2.1
 * `Key.onUp` borra `_justDown`, y una pulsación que empieza y acaba dentro del mismo frame (un toque
 * rápido o `keyboard.press` de Playwright) se perdería. Sin reglas de juego.
 */
export class ChoiceKeys {
  private pending = -1;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    CODES.forEach((codes, i) => {
      const spec = Object.fromEntries(codes.map((c) => [c, c]));
      const keys = Object.values(keyboard.addKeys(spec) as Record<string, DownKey>);
      for (const key of keys) {
        key.on('down', () => {
          if (this.pending === -1) this.pending = i;
        });
      }
    });
  }

  /** Primera tecla de opción pulsada desde la última lectura (−1 si ninguna); la consume. */
  read(): number {
    const i = this.pending;
    this.pending = -1;
    return i;
  }
}

/**
 * Qué opción elige la escena en un frame: la tecla y, si no, el clic, solo si hay carta para ese
 * índice (`0 ≤ i < offerSize`). −1 si nada.
 */
export function choiceIndex(offerSize: number, key: number, click: number): number {
  const i = key >= 0 ? key : click;
  return i >= 0 && i < offerSize ? i : -1;
}
