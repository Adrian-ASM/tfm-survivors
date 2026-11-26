import { describe, expect, it } from 'vitest';
import {
  FullscreenControl,
  type FullscreenLike,
} from '../../src/infrastructure/dom/FullscreenControl';

/** Fullscreen API falsa: cuenta peticiones y resuelve o rechaza según se pida. */
class FakeFullscreen implements FullscreenLike {
  enabled = true;
  element: unknown = null;
  requests = 0;
  exits = 0;
  locks = 0;
  readonly lockLandscape?: () => Promise<unknown>;

  constructor(
    private readonly opts: {
      request?: 'ok' | 'reject';
      lock?: 'ok' | 'reject' | 'throw' | 'missing';
    } = {},
  ) {
    if (opts.lock !== 'missing') {
      this.lockLandscape = () => {
        this.locks += 1;
        if (opts.lock === 'throw') throw new Error('lock no admitido');
        return opts.lock === 'reject' ? Promise.reject(new Error('no')) : Promise.resolve();
      };
    }
  }

  readonly request = (): Promise<unknown> => {
    this.requests += 1;
    if (this.opts.request === 'reject') return Promise.reject(new Error('rechazada'));
    this.element = {};
    return Promise.resolve();
  };

  readonly exit = (): Promise<unknown> => {
    this.exits += 1;
    this.element = null;
    return Promise.resolve();
  };
}

// Spec touch-controls (0033), "Pantalla completa y orientación".
describe('FullscreenControl (0033)', () => {
  it('Scenario: Entrar en pantalla completa (1 petición y, tras concederse, 1 bloqueo)', async () => {
    const api = new FakeFullscreen({ lock: 'ok' });
    await new FullscreenControl(api).toggle();
    expect([api.requests, api.locks, api.exits]).toEqual([1, 1, 0]);
    expect(api.element).not.toBeNull();
  });

  it.each(['reject', 'throw', 'missing'] as const)(
    'Scenario: Bloqueo rechazado o ausente (%s: entra y no lanza)',
    async (lock) => {
      const api = new FakeFullscreen({ lock });
      await expect(new FullscreenControl(api).toggle()).resolves.toBeUndefined();
      expect(api.element).not.toBeNull();
    },
  );

  it('Scenario: Pantalla completa rechazada (sin bloqueo y sin errores)', async () => {
    const api = new FakeFullscreen({ request: 'reject', lock: 'ok' });
    await expect(new FullscreenControl(api).toggle()).resolves.toBeUndefined();
    expect([api.requests, api.locks]).toEqual([1, 0]);
  });

  it('Scenario: Salir de pantalla completa (en pantalla completa, ⛶ sale)', async () => {
    const api = new FakeFullscreen();
    api.element = {};
    await new FullscreenControl(api).toggle();
    expect([api.exits, api.requests, api.element]).toEqual([1, 0, null]);
  });

  it('disponible solo con la API activa y la petición (iPhone: no)', () => {
    expect(new FullscreenControl(new FakeFullscreen()).available).toBe(true);
    expect(new FullscreenControl({ enabled: false, element: null }).available).toBe(false);
    expect(new FullscreenControl({ enabled: true, element: null }).available).toBe(false);
  });
});
