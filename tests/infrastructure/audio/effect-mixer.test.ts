import { describe, expect, it } from 'vitest';
import {
  EffectMixer,
  type EffectRules,
  type MixNow,
} from '../../../src/infrastructure/audio/EffectMixer';
import {
  EFFECT_TYPES,
  zeroCounts,
  type EffectCounts,
  type EffectType,
} from '../../../src/infrastructure/audio/effectTypes';
import { TICK_MS } from '../../support/builders';

/** Reglas de escenario: prioridad 1, sin intervalo y ganancia 1 salvo lo que diga el caso. */
function rules(over: Partial<Record<EffectType, Partial<EffectRules[EffectType]>>> = {}) {
  const out = {} as Record<EffectType, EffectRules[EffectType]>;
  for (const t of EFFECT_TYPES) {
    out[t] = { priority: 1, minIntervalMs: 0, gain: 1, ...over[t] };
  }
  return out;
}

/** Salida de prueba: apunta cada reproducción (tipo y volumen). */
class SpyOut {
  readonly played: { type: EffectType; volume: number }[] = [];
  play(type: EffectType, volume: number): void {
    this.played.push({ type, volume });
  }
}

const now = (over: Partial<MixNow> = {}): MixNow => ({
  renderMs: 0,
  halted: false,
  hidden: false,
  effectsVolume: 0.8,
  sounding: 0,
  canPlay: () => true,
  ...over,
});

const req = (partial: Partial<EffectCounts>): EffectCounts => ({ ...zeroCounts(), ...partial });

describe('EffectMixer (spec audio, "Tope de voces y limitación por tipo")', () => {
  it('Scenario: Avalancha de impactos', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules(), 8, out);

    mixer.decide(req({ impactWeapon: 40 }), now());

    expect(out.played.map((p) => p.type)).toEqual(['impactWeapon']);
    expect(mixer.stats.byType.impactWeapon).toEqual({ requested: 40, played: 1, dropped: 39 });
  });

  it('Scenario: Intervalo mínimo con el reloj de render en modo manual', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules({ impactWeapon: { minIntervalMs: 40 } }), 8, out);

    const played: number[] = [];
    for (let step = 1; step <= 4; step++) {
      const before = out.played.length;
      mixer.decide(req({ impactWeapon: 1 }), now({ renderMs: step * TICK_MS }));
      played.push(out.played.length - before);
    }

    expect(played).toEqual([1, 0, 0, 1]);
  });

  it('Scenario: Tope con voces ocupadas', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(
      rules({ levelUp: { priority: 9 }, enemyDeath: { priority: 5 }, pickup: { priority: 3 } }),
      8,
      out,
    );

    mixer.decide(req({ levelUp: 1, enemyDeath: 1, pickup: 1 }), now({ sounding: 7 }));

    expect(out.played.map((p) => p.type)).toEqual(['levelUp']);
    expect([mixer.stats.byType.enemyDeath.dropped, mixer.stats.byType.pickup.dropped]).toEqual([
      1, 1,
    ]);
  });

  it('Scenario: Tope con voces ocupadas (a igual prioridad, el orden de los tipos)', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules(), 8, out);

    mixer.decide(req({ build: 1, pickup: 1, playerHurt: 1 }), now({ sounding: 6 }));

    expect(out.played.map((p) => p.type)).toEqual(['playerHurt', 'pickup']);
  });

  it('Scenario: Tope lleno', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules(), 8, out);

    mixer.decide(req({ playerHurt: 1 }), now({ sounding: 8 }));

    expect(out.played).toEqual([]);
    expect(mixer.stats.byType.playerHurt).toEqual({ requested: 1, played: 0, dropped: 1 });
  });

  it('Scenario: Efectos a 0', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules(), 8, out);

    mixer.decide(req({ levelUp: 1 }), now({ effectsVolume: 0 }));

    expect([out.played.length, mixer.stats.dropped]).toEqual([0, 1]);
  });

  it('Scenario: Fichero que no carga (solo ese tipo se descarta)', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules(), 8, out);

    mixer.decide(req({ pickup: 1, levelUp: 1 }), now({ canPlay: (t) => t !== 'pickup' }));

    expect(out.played.map((p) => p.type)).toEqual(['levelUp']);
    expect(mixer.stats.byType.pickup).toEqual({ requested: 1, played: 0, dropped: 1 });
  });

  it('Scenario: Pestaña oculta en curso (todo se descarta y no se guarda para después)', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules(), 8, out);

    mixer.decide(req({ impactWeapon: 2 }), now({ hidden: true }));
    mixer.decide(req({}), now({ renderMs: 1000 }));

    expect([out.played.length, mixer.stats.requested, mixer.stats.dropped]).toEqual([0, 2, 2]);
  });

  it('Scenario: Pausa con Esc (con el mundo detenido, todo se descarta)', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules(), 8, out);

    mixer.decide(req({ levelUp: 1, pickup: 3 }), now({ halted: true }));

    expect([out.played.length, mixer.stats.dropped]).toEqual([0, 4]);
  });

  it('Scenario: Volúmenes efectivos (efecto = efectos × ganancia del tipo)', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules({ explosion: { gain: 0.5 } }), 8, out);

    mixer.decide(req({ explosion: 1 }), now({ effectsVolume: 0.8 }));

    expect(out.played[0]?.volume).toBeCloseTo(0.4, 10);
  });

  it('Scenario: Partida nueva como referencia (el intervalo vuelve a empezar)', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules({ pickup: { minIntervalMs: 500 } }), 8, out);
    mixer.decide(req({ pickup: 1 }), now({ renderMs: 300 }));

    mixer.newRun();
    mixer.decide(req({ pickup: 1 }), now({ renderMs: 0 }));

    expect(out.played).toHaveLength(2);
  });

  it('Scenario: Cuentas cuadran (pedidas = reproducidas + descartadas, total y por tipo)', () => {
    const out = new SpyOut();
    const mixer = new EffectMixer(rules({ impactWeapon: { minIntervalMs: 40 } }), 3, out);
    for (let i = 0; i < 20; i++) {
      mixer.decide(
        req({ impactWeapon: i % 4, pickup: 2, levelUp: i % 2 }),
        now({ renderMs: i * TICK_MS, sounding: i % 4 }),
      );
    }
    const { stats } = mixer;
    const perType = EFFECT_TYPES.map((t) => stats.byType[t]);

    expect(perType.every((c) => c.requested === c.played + c.dropped)).toBe(true);
    expect(stats.requested).toBe(stats.played + stats.dropped);
    expect(stats.played).toBe(out.played.length);
  });
});
