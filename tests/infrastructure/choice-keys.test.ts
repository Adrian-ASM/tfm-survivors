import { describe, expect, it } from 'vitest';
import { ChoiceKeys, choiceIndex } from '../../src/infrastructure/phaser/ChoiceKeys';

/** Tecla doble: guarda el manejador de `down` y lo dispara al pulsar. */
class FakeKey {
  private handler: (() => void) | null = null;
  on(_event: 'down', handler: () => void): void {
    this.handler = handler;
  }
  down(): void {
    this.handler?.();
  }
}

function keys() {
  const byCode = new Map<string, FakeKey>();
  const kb = {
    addKeys(spec: Record<string, string>) {
      const out: Record<string, FakeKey> = {};
      for (const [name, code] of Object.entries(spec)) {
        const key = new FakeKey();
        byCode.set(code, key);
        out[name] = key;
      }
      return out;
    },
  };
  const press = (code: string) => {
    const k = byCode.get(code);
    if (!k) throw new Error(code);
    k.down();
  };
  return { choice: new ChoiceKeys(kb as never), press };
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

  it('una pulsación que empieza y acaba en el mismo frame no se pierde; gana la primera', () => {
    const { choice, press } = keys();
    press('THREE');
    press('ONE');
    expect(choice.read()).toBe(2);
    expect(choice.read()).toBe(-1);
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
