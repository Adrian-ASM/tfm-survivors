import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import provenanceJson from '../../content/asset-provenance.json';
import { bootContent, checkAppearanceRefs } from '../../src/composition/contentBoot';
import type { DomainError } from '../../src/domain/shared/Result';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { rawContent } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { chooseFirstWhileOpen, startRun } from '../support/runs';

// Spec sprite-rendering, "Datos de aspecto validados" en el arranque (change 0012, design D9).
const REGISTERED = provenanceJson.files.map((f) => f.path);

type Raw = { content: ReturnType<typeof rawContent>; appearance: Record<string, unknown> };
function raw(): Raw {
  return { content: rawContent(), appearance: structuredClone(appearanceJson) };
}

function boot(r: Raw) {
  const errors: DomainError[] = [];
  const booted = bootContent(r, (e) => errors.push(e), REGISTERED);
  return { booted, errors };
}

describe('bootContent', () => {
  it('Scenario: Datos del repositorio (contenido y aspecto válidos, alineados)', () => {
    const { booted, errors } = boot(raw());
    expect(errors).toEqual([]);
    expect(booted?.appearance.maxCorpses).toBe(64);
    expect(Object.keys(booted?.appearance.enemies ?? {})).toEqual(
      booted?.config.enemies.types.map((t) => t.id),
    );
  });

  it('Scenario: Tipos de enemigo y aspectos desalineados (sin goblin-barrel)', () => {
    const r = raw();
    const enemies = r.appearance.enemies as Record<string, unknown>;
    Reflect.deleteProperty(enemies, 'goblin-barrel');
    const { booted, errors } = boot(r);
    expect(booted).toBeNull();
    expect(errors.map((e) => e.field)).toEqual(['enemies.goblin-barrel']);
  });

  it('Scenario: Tipos de enemigo y aspectos desalineados (aspecto extra goblin-dragon)', () => {
    const r = raw();
    const enemies = r.appearance.enemies as Record<string, unknown>;
    enemies['goblin-dragon'] = enemies['goblin-torch'];
    const { booted, errors } = boot(r);
    expect(booted).toBeNull();
    expect(errors.map((e) => e.field)).toEqual(['enemies.goblin-dragon']);
  });

  it.each(['con ?e2e', 'sin ?e2e'])(
    'Scenario: Datos inválidos en el arranque (sin aspecto del jugador, %s)',
    () => {
      const r = raw();
      Reflect.deleteProperty(r.appearance, 'player');
      const { booted, errors } = boot(r);
      expect(booted).toBeNull();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.field).toBe('player');
    },
  );

  it('el contenido de juego inválido se informa igual que antes', () => {
    const r = raw();
    r.content.player.maxHealth = 0;
    const { booted, errors } = boot(r);
    expect([booted, errors[0]?.field]).toEqual([null, 'player.maxHealth']);
  });

  // Spec world-camera (0013), "Mundo más estrecho que la vista": sin menú ni partida.
  it('Scenario: Mundo más estrecho que la vista (959 × 1.080: arranque bloqueado)', () => {
    const r = raw();
    r.content.arena.width = 959;
    const { booted, errors } = boot(r);
    expect([booted, errors.map((e) => e.field)]).toEqual([null, ['arena.width']]);
  });

  // Spec procedural-map (0015), "Valores fuera de rango": no se muestra el menú ni hay partida.
  it('Scenario: Valores fuera de rango del mapa (rivers 3: arranque bloqueado)', () => {
    const r = raw();
    r.content.map.rivers = 3;
    const { booted, errors } = boot(r);
    expect([booted, errors.map((e) => e.field)]).toEqual([null, ['map.rivers']]);
  });

  it('checkAppearanceRefs acepta el contenido del repositorio', () => {
    const { booted } = boot(raw());
    if (!booted) throw new Error('arranque inválido');
    expect(checkAppearanceRefs(booted.appearance, booted.config).ok).toBe(true);
  });

  it('Scenario: Los aspectos no cambian la simulación (escalas × 2, semilla 42, 1.200 ticks)', () => {
    const doubled = raw();
    const a = doubled.appearance as {
      player: { scale: number };
      enemies: Record<string, { scale: number }>;
      projectile: { scale: number };
      gem: { scale: number };
      ground: { scale: number };
      corpse: { scale: number };
    };
    for (const look of [
      a.player,
      ...Object.values(a.enemies),
      a.projectile,
      a.gem,
      a.ground,
      a.corpse,
    ])
      look.scale *= 2;
    const one = boot(raw()).booted;
    const two = boot(doubled).booted;
    if (!one || !two) throw new Error('arranque inválido');
    const inputs = randomInputs(1200, 7);
    const play = (config: typeof one.config) => {
      const run = startRun(config, {}, new Mulberry32RandomGenerator(42));
      return inputs.map((input) => {
        chooseFirstWhileOpen(run);
        run.tick(input);
        return run.snapshot();
      });
    };
    expect(play(two.config)).toEqual(play(one.config));
    expect(two.appearance.player.scale).toBe(one.appearance.player.scale * 2);
  });
});
