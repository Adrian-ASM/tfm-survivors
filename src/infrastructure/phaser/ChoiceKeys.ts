import type Phaser from 'phaser';

type Key = Phaser.Input.Keyboard.Key;
type JustDown = (key: Key) => boolean;

/** Teclas de cada opción (fila de números y teclado numérico), en orden de índice. */
const CODES = [
  ['ONE', 'NUMPAD_ONE'],
  ['TWO', 'NUMPAD_TWO'],
  ['THREE', 'NUMPAD_THREE'],
] as const;

/**
 * Adaptador de input de la elección: teclas 1–3 → índice 0–2 (−1 si ninguna). Usa `JustDown`
 * (se pasa desde la escena: `Phaser.Input.Keyboard.JustDown`), así que mantener una tecla pulsada
 * no elige también en la oferta siguiente. Sin reglas de juego.
 */
export class ChoiceKeys {
  private readonly keys: readonly (readonly Key[])[];

  constructor(
    keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
    private readonly justDown: JustDown,
  ) {
    this.keys = CODES.map((codes) => {
      const spec = Object.fromEntries(codes.map((c) => [c, c]));
      return Object.values(keyboard.addKeys(spec) as Record<string, Key>);
    });
  }

  read(): number {
    let chosen = -1;
    this.keys.forEach((group, i) => {
      // Se consulta cada tecla (JustDown consume el flanco) aunque ya haya una elegida.
      const down = group.map((k) => this.justDown(k)).some(Boolean);
      if (down && chosen === -1) chosen = i;
    });
    return chosen;
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
