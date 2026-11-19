import { describe, expect, it } from 'vitest';
import { ChoiceKeys, choiceIndex } from '../../src/infrastructure/phaser/ChoiceKeys';

interface FakeKey {
  pressed: boolean;
}

/** Teclado doble: `addKeys` devuelve una tecla por nombre; `JustDown` lee y consume `pressed`. */
function keyboard() {
  const keys = new Map<string, FakeKey>();
  const kb = {
    addKeys(spec: Record<string, string>) {
      const out: Record<string, FakeKey> = {};
      for (const [name, code] of Object.entries(spec)) {
        const key = { pressed: false };
        keys.set(code, key);
        out[name] = key;
      }
      return out;
    },
  };
  const justDown = (k: FakeKey) => {
    const was = k.pressed;
    k.pressed = false;
    return was;
  };
  const press = (code: string) => {
    const k = keys.get(code);
    if (!k) throw new Error(code);
    k.pressed = true;
  };
  return { kb, justDown, press };
}

function keys() {
  const { kb, justDown, press } = keyboard();
  return { choice: new ChoiceKeys(kb as never, justDown as never), press };
}

describe('ChoiceKeys', () => {
  it('teclas 1–3 de la fila y del teclado numérico → índice 0–2; nada pulsado → −1', () => {
    const { choice, press } = keys();
    expect(choice.read()).toBe(-1);
    press('TWO');
    expect(choice.read()).toBe(1);
    expect(choice.read()).toBe(-1);
    press('NUMPAD_THREE');
    expect(choice.read()).toBe(2);
    press('ONE');
    expect(choice.read()).toBe(0);
  });
});

describe('choiceIndex (qué elige la escena en un frame)', () => {
  it('Scenario: Elegir con tecla (tecla 2 con 3 cartas: índice 1)', () => {
    expect(choiceIndex(3, 1, -1)).toBe(1);
  });

  it('Scenario: Elegir con clic (tercera carta: índice 2)', () => {
    expect(choiceIndex(3, -1, 2)).toBe(2);
  });

  it('Scenario: Menos cartas (tecla 3 con 2 cartas: nada)', () => {
    expect(choiceIndex(2, 2, -1)).toBe(-1);
  });

  it('Scenario: Sin oferta (teclas 1, 2 y 3: nada)', () => {
    expect([0, 1, 2].map((k) => choiceIndex(0, k, -1))).toEqual([-1, -1, -1]);
  });

  it('la tecla tiene prioridad sobre el clic del mismo frame', () => {
    expect(choiceIndex(3, 0, 2)).toBe(0);
  });
});
