import { describe, expect, it } from 'vitest';
import type { UpgradeTypeConfig } from '../../src/domain/upgrade/UpgradeType';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig, withUpgrades } from '../support/builders';
import { advance, startRun } from '../support/runs';

// Spec upgrades (0013), "Misma partida con los textos nuevos": los textos no tocan la simulación.
const TEN_MINUTES = 36_000;
const SEED = 42;

/** Textos de content/upgrades.json en `main` antes del change (id → [name, description]). */
const PREVIOUS_TEXTS: Readonly<Record<string, readonly [string, string]>> = {
  'strict-rules': ['Skill: reglas estrictas', 'El Linter hace más daño.'],
  'fast-ci': ['Skill: CI rápido', 'El Linter dispara más a menudo.'],
  'wide-analysis': ['Skill: análisis amplio', 'El Linter alcanza objetivos más lejanos.'],
  'hard-asserts': ['Skill: asserts estrictos', 'Los Tests hacen más daño.'],
  'watch-mode': ['Skill: modo watch', 'Los Tests se lanzan más a menudo.'],
  coverage: ['Skill: más cobertura', 'El pulso de los Tests llega más lejos.'],
  guardrail: ['Guardrail', 'Más vida máxima (y la misma cantidad de vida actual).'],
  shortcuts: ['Atajos de teclado', 'Te mueves más rápido.'],
  'context-window': ['Ventana de contexto', 'Atraes las gemas desde más lejos.'],
};

/** El contenido por defecto con los textos del tema anterior. */
const withPreviousTexts = (config: RunConfig): RunConfig => {
  // 0024: las mejoras de personaje nuevas no tenían texto anterior y conservan el suyo.
  const previous = (u: UpgradeTypeConfig): UpgradeTypeConfig => {
    const [name, description] = PREVIOUS_TEXTS[u.id] ?? [u.name, u.description];
    return { ...u, name, description };
  };
  const { character, weapons } = config.upgrades;
  return withUpgrades(config, {
    character: character.map(previous),
    weapons: weapons.map(previous),
  });
};

/** Snapshot sin `name` ni `description` en las opciones de la oferta. */
const withoutTexts = (s: RunSnapshot) => ({
  ...s,
  offer: s.offer.map(({ id, level, nextLevel }) => ({ id, level, nextLevel })),
  // 0024: los productos de la tienda repiten los textos de las mejoras de arma.
  shop: { ...s.shop, products: s.shop.products.map(({ id, price }) => ({ id, price })) },
});

/** Partida quieta con la política de elección fija, hasta que termina o hasta el tick 36.000. */
function play(config: RunConfig): RunSnapshot[] {
  const run = startRun(config, undefined, new Mulberry32RandomGenerator(SEED));
  const snaps: RunSnapshot[] = [];
  while (run.status !== 'over' && snaps.length < TEN_MINUTES) snaps.push(...advance(run, 1));
  return snaps;
}

describe('Renombrado medieval sin efecto en la simulación (0013)', () => {
  it('Scenario: Misma partida con los textos nuevos (semilla 42, iguales tick a tick)', () => {
    const current = play(aDefaultConfig());
    const previous = play(withPreviousTexts(aDefaultConfig()));

    expect(current.at(-1)?.status).toBe('over');
    expect(current.some((s) => s.offer.length > 0)).toBe(true);
    expect(previous).toHaveLength(current.length);
    for (let i = 0; i < current.length; i++) {
      expect(withoutTexts(previous[i] as RunSnapshot)).toStrictEqual(
        withoutTexts(current[i] as RunSnapshot),
      );
    }
  });
});
