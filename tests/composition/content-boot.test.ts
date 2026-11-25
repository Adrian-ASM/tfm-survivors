import { describe, expect, it } from 'vitest';
import guideJson from '../../content/guide.json';
import appearanceJson from '../../content/appearance.json';
import arenaJson from '../../content/arena.json';
import provenanceJson from '../../content/asset-provenance.json';
import { bootContent, checkAppearanceRefs } from '../../src/composition/contentBoot';
import type { DomainError } from '../../src/domain/shared/Result';
import { TILE_SCALE_MISMATCH } from '../../src/infrastructure/content/loadAppearance';
import { canopyCut, roofCut } from '../../src/infrastructure/phaser/map/mapCuts';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { rawContent } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { chooseFirstWhileOpen, startRun, startSeededRun } from '../support/runs';

// Spec sprite-rendering, "Datos de aspecto validados" en el arranque (change 0012, design D9).
const REGISTERED = provenanceJson.files.map((f) => f.path);

type Json = Record<string, unknown>;
type Raw = { content: ReturnType<typeof rawContent>; appearance: Json; guide: unknown };
function raw(): Raw {
  return { content: rawContent(), appearance: structuredClone(appearanceJson), guide: guideJson };
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
    // Spec world-camera (0017): el tope de vista llega a la presentación (no al núcleo).
    expect(booted?.maxView).toEqual(arenaJson.maxView);
    expect(booted && 'maxView' in booted.config.arena).toBe(false);
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

  // Spec sprite-rendering (0015), "Colores inválidos": no se muestra el menú ni hay partida.
  it('Scenario: Colores inválidos (water "blue": arranque bloqueado)', () => {
    const r = raw();
    (r.appearance.terrain as Record<string, string>).water = 'blue';
    const { booted, errors } = boot(r);
    expect([booted, errors.map((e) => e.field)]).toEqual([null, ['terrain.water']]);
  });

  // Spec sprite-rendering (0016), "Baldosas del mapa a la escala de la celda".
  it('Scenario: Escala del repositorio (fondo, agua y orilla de 60 × 60; castillo 300 × 240)', () => {
    const { booted } = boot(raw());
    if (!booted) throw new Error('arranque inválido');
    const { ground, map } = booted.appearance;
    const cell = booted.config.map.cellSize;
    for (const a of [ground, map.water, map.shore]) {
      expect(a.sheet.frameWidth * a.scale).toBe(cell);
      expect(a.sheet.frameHeight * a.scale).toBe(cell);
    }
    const { castle } = map;
    const { cols, rows } = booted.config.map.castle;
    expect(castle.sheet.frameWidth * castle.scale).toBe(cols * cell);
    expect(castle.sheet.frameHeight * castle.scale).toBe(rows * cell);
  });

  it('Scenario: Escala del repositorio (cortes de copa y tejado dentro del dibujo)', () => {
    const { booted } = boot(raw());
    if (!booted) throw new Error('arranque inválido');
    const { trees, castle } = booted.appearance.map;
    const cell = booted.config.map.cellSize;
    const tree = canopyCut(trees, cell);
    const roof = roofCut(castle, cell);
    expect(tree > 0 && tree < trees.sheet.frameHeight).toBe(true);
    expect(roof).toBe(192);
  });

  it.each([
    ['ground.scale', (a: Record<string, unknown>) => ((a.ground as { scale: number }).scale = 1)],
    [
      'map.water.scale',
      (a: Record<string, unknown>) =>
        (((a.map as Record<string, { scale: number }>).water ?? { scale: 0 }).scale = 0.94),
    ],
    [
      'map.shore.scale',
      (a: Record<string, unknown>) =>
        (((a.map as Record<string, { scale: number }>).shore ?? { scale: 0 }).scale = 1),
    ],
  ])('Scenario: Escala que no casa con la celda (%s: arranque bloqueado)', (field, mutate) => {
    const r = raw();
    mutate(r.appearance);
    const { booted, errors } = boot(r);
    expect([booted, errors.map((e) => e.field)]).toEqual([null, [field]]);
    expect(errors[0]?.message).toBe(TILE_SCALE_MISMATCH);
  });

  it('una escala que casa con un error de redondeo ≤ 0,001 vale', () => {
    const r = raw();
    (r.appearance.ground as { scale: number }).scale = 0.9375 + 0.00001;
    expect(boot(r).errors).toEqual([]);
  });

  it('checkAppearanceRefs acepta el contenido del repositorio', () => {
    const { booted } = boot(raw());
    if (!booted) throw new Error('arranque inválido');
    expect(checkAppearanceRefs(booted.appearance, booted.config).ok).toBe(true);
  });

  it('Scenario: Los aspectos no cambian la simulación (entidades y estructuras × 2, colores cambiados, decoración 0)', () => {
    const doubled = raw();
    const a = doubled.appearance as {
      player: { scale: number };
      enemies: Record<string, { scale: number }>;
      projectile: { scale: number };
      pickups: Record<'gold' | 'wood', { scale: number }>;
      corpse: { scale: number };
      dynamite: { scale: number };
      explosion: { scale: number };
      terrain: Record<string, string>;
      warnings: Record<string, { color: string }>;
    };
    // 0016: el fondo ya no se dobla (su baldosa debe medir la celda); la spec habla de entidades.
    const entities = [
      a.player,
      ...Object.values(a.enemies),
      a.projectile,
      a.pickups.gold,
      a.pickups.wood,
      a.corpse,
    ];
    for (const look of [...entities, a.dynamite, a.explosion]) look.scale *= 2;
    // 0020: también los colores de los avisos.
    for (const w of Object.values(a.warnings)) w.color = '#0a0b0c';
    a.terrain = { trunk: '#010101', water: '#020202', bridge: '#030303', castle: '#040404' };
    // 0021: también las escalas de las estructuras y sus colores de reserva.
    const looks = (doubled.appearance as { structures: Record<string, Record<string, Json>> })
      .structures;
    for (const aspects of Object.values(looks)) {
      for (const aspect of Object.values(aspects)) aspect['scale'] = Number(aspect['scale']) * 2;
    }
    doubled.appearance['structureColors'] = {
      'goblin-house': '#050505',
      'goblin-tower': '#060606',
      ruin: '#070707',
    };
    // 0029: y el tope de decoración 0.
    const map = doubled.appearance['map'] as { decor: { maxObjects: number } };
    map.decor.maxObjects = 0;
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
    // Con el mapa generado de la semilla 42 (con casas y torres).
    const seeded = (config: typeof one.config) => {
      const run = startSeededRun(config, 42);
      return inputs.map((input) => {
        chooseFirstWhileOpen(run);
        run.tick(input);
        return run.snapshot();
      });
    };
    const generated = seeded(one.config);
    expect(generated[0]?.structures.length).toBeGreaterThan(0);
    expect(seeded(two.config)).toEqual(generated);
    expect(two.appearance.player.scale).toBe(one.appearance.player.scale * 2);
    const house = (b: typeof one) => b.appearance.structures['goblin-house']?.intact.scale ?? 0;
    expect(house(two)).toBe(house(one) * 2);
    expect(two.appearance.map.decor.maxObjects).toBe(0);
  });
});
