import { describe, expect, it } from 'vitest';
import { describeRandomGeneratorContract } from '../support/randomContract';
import { StubRandom } from '../support/random';

describeRandomGeneratorContract('StubRandom', () => new StubRandom(0.625));

describe('StubRandom', () => {
  it('devuelve el valor fijado desde el test y cuenta las llamadas', () => {
    const stub = new StubRandom(0.25);
    expect(stub.next()).toBe(0.25);
    stub.value = 0.625;
    expect(stub.next()).toBe(0.625);
    expect(stub.calls).toBe(2);
  });

  it('rechaza valores fuera de [0, 1)', () => {
    expect(() => new StubRandom(1)).toThrow(RangeError);
    const stub = new StubRandom(0);
    expect(() => {
      stub.value = -0.1;
    }).toThrow(RangeError);
  });
});
