import { describe, expect, it, vi } from 'vitest';
import {
  StepCountSchema,
  requestStep,
  type StepRequester,
} from '../../src/infrastructure/e2e/stepRequest';

/** Doble del stepper: registra las peticiones y devuelve los ticks pedidos. */
function aStepper(): StepRequester & { calls: number[] } {
  const calls: number[] = [];
  return {
    calls,
    request: (ticks: number) => {
      calls.push(ticks);
      return Promise.resolve(ticks);
    },
  };
}

const INVALID: readonly unknown[] = [
  0,
  -1,
  2.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  '10',
  undefined,
];

describe('requestStep (spec simulation-loop, "Avance manual con step")', () => {
  it('Scenario: n inválido (7 valores: 0 al momento, sin request, 1 aviso de step)', async () => {
    const stepper = aStepper();
    const warn = vi.fn<(msg: string) => void>();

    const results = await Promise.all(INVALID.map((n) => requestStep(n, stepper, warn)));

    expect(results).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(stepper.calls).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(7);
    for (const [msg] of warn.mock.calls) {
      expect(msg).toContain('step');
      expect(msg).not.toContain('manual');
    }
  });

  it.each(INVALID)('cada valor inválido avisa una vez por llamada (%s)', async (n) => {
    const warn = vi.fn<(msg: string) => void>();

    await requestStep(n, aStepper(), warn);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('Scenario: n muy grande (MAX_SAFE_INTEGER y 1 llegan a request sin aviso)', async () => {
    const stepper = aStepper();
    const warn = vi.fn<(msg: string) => void>();

    await requestStep(Number.MAX_SAFE_INTEGER, stepper, warn);
    await requestStep(1, stepper, warn);

    expect(stepper.calls).toEqual([Number.MAX_SAFE_INTEGER, 1]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('devuelve lo que resuelve el stepper', async () => {
    await expect(requestStep(60, aStepper(), () => undefined)).resolves.toBe(60);
  });

  it('Scenario: Step sin modo manual (0 y 1 aviso de manual, sin la palabra step)', async () => {
    const warn = vi.fn<(msg: string) => void>();

    const result = await requestStep(60, undefined, warn);

    expect(result).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    const [msg] = warn.mock.calls[0] ?? [''];
    expect(msg).toContain('manual');
    expect(msg).not.toContain('step');
  });

  it('un BigInt o un objeto cíclico no hacen lanzar al aviso', async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const warn = vi.fn<(msg: string) => void>();

    const results = [
      await requestStep(10n, aStepper(), warn),
      await requestStep(cyclic, aStepper(), warn),
    ];

    expect(results).toEqual([0, 0]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('trunca el valor del aviso a 32 caracteres', async () => {
    const warn = vi.fn<(msg: string) => void>();

    await requestStep('9'.repeat(500), aStepper(), warn);

    const [msg] = warn.mock.calls[0] ?? [''];
    expect(msg).toContain('9'.repeat(32));
    expect(msg).not.toContain('9'.repeat(33));
  });

  it('StepCountSchema admite [1, MAX_SAFE_INTEGER] enteros', () => {
    expect(StepCountSchema.safeParse(1).success).toBe(true);
    expect(StepCountSchema.safeParse(Number.MAX_SAFE_INTEGER).success).toBe(true);
    expect(StepCountSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
  });
});
