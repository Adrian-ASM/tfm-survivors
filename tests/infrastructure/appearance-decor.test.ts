import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import provenanceJson from '../../content/asset-provenance.json';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { REGISTERED, rawAppearance, type RawAppearance } from '../support/appearance';

// Spec sprite-rendering (0029), "Decoración del mapa generado": datos de la decoración validados con
// zod en el arranque; cada error nombra el campo o la hoja.
type Json = Record<string, unknown>;
type Item = { sheet: { file: string } } & Json;
const decorOf = (raw: RawAppearance) => raw.map.decor as { items: Item[] } & Json;

function failure(raw: unknown, registered: readonly string[] = REGISTERED) {
  const r = parseAppearance(raw, registered);
  if (r.ok) throw new Error('se esperaba un error de datos de aspecto');
  return { field: r.error.field, text: `${r.error.field} ${r.error.message}` };
}

/** Datos del repositorio crudos (para los casos del escenario sobre ellos). */
const repoRaw = (): RawAppearance => structuredClone(appearanceJson);
const repoFiles = provenanceJson.files.map((f) => f.path);

describe('Datos de la decoración', () => {
  it('el fixture y el repositorio, con su decoración, son válidos', () => {
    expect(parseAppearance(rawAppearance(), REGISTERED).ok).toBe(true);
    expect(parseAppearance(repoRaw(), repoFiles).ok).toBe(true);
  });

  it('Scenario: Datos de la decoración inválidos (lista de aspectos [])', () => {
    const raw = repoRaw();
    decorOf(raw).items = [];
    expect(failure(raw, repoFiles).field).toBe('map.decor.items');
  });

  it.each([-1, 2.5])('Scenario: Datos de la decoración inválidos (tope %d)', (v) => {
    const raw = repoRaw();
    decorOf(raw).maxObjects = v;
    expect(failure(raw, repoFiles).field).toBe('map.decor.maxObjects');
  });

  it('Scenario: Datos de la decoración inválidos (densidad 0)', () => {
    const raw = repoRaw();
    decorOf(raw).density = 0;
    expect(failure(raw, repoFiles).field).toBe('map.decor.density');
  });

  it('Scenario: Datos de la decoración inválidos (dos aspectos con la hoja Deco/07.png)', () => {
    const raw = repoRaw();
    const items = decorOf(raw).items;
    const copy = structuredClone(items.find((i) => i.sheet.file === 'Deco/07.png'));
    if (!copy) throw new Error('falta Deco/07.png');
    items.push(copy);
    const { field, text } = failure(raw, repoFiles);
    expect(field).toBe(`map.decor.items.${String(items.length - 1)}.sheet.file`);
    expect(text).toContain('Deco/07.png');
  });

  it('Scenario: Datos de la decoración inválidos (hoja Deco/05.png, roca medium)', () => {
    const raw = repoRaw();
    const first = decorOf(raw).items[0];
    if (!first) throw new Error('sin decoración');
    first.sheet.file = 'Deco/05.png';
    const { field, text } = failure(raw, repoFiles);
    expect(field).toBe('map.decor.items.0.sheet.file');
    expect(text).toContain('Deco/05.png');
  });

  it('Scenario: Datos de la decoración inválidos (hoja Deco/12.png, fuera de la nota)', () => {
    const raw = repoRaw();
    const first = decorOf(raw).items[0];
    if (!first) throw new Error('sin decoración');
    first.sheet.file = 'Deco/12.png';
    const { field, text } = failure(raw, repoFiles);
    expect(field).toBe('map.decor.items.0.sheet.file');
    expect(text).toContain('Deco/12.png');
  });

  it('Scenario: Rutas de hoja no admitidas (decoración de Deco/09 con una ruta fuera de la nota)', () => {
    const raw = repoRaw();
    const items = decorOf(raw).items;
    const i = items.findIndex((x) => x.sheet.file === 'Deco/09.png');
    const item = items[i];
    if (!item) throw new Error('falta Deco/09.png');
    item.sheet.file = 'Deco/Otra.png';
    expect(failure(raw, repoFiles).field).toBe(`map.decor.items.${String(i)}.sheet.file`);
  });

  it('un campo desconocido en un aspecto de decoración (weight) falla nombrándolo', () => {
    const raw = repoRaw();
    const first = decorOf(raw).items[0];
    if (!first) throw new Error('sin decoración');
    first.weight = 2;
    expect(failure(raw, repoFiles).field).toBe('map.decor.items.0.weight');
  });

  it('sin tall, o con escala 0, el aspecto de decoración falla nombrando el campo', () => {
    const noTall = repoRaw();
    const a = decorOf(noTall).items[0];
    if (!a) throw new Error('sin decoración');
    Reflect.deleteProperty(a, 'tall');
    expect(failure(noTall, repoFiles).field).toBe('map.decor.items.0.tall');
    const zero = repoRaw();
    const b = decorOf(zero).items[1];
    if (!b) throw new Error('sin decoración');
    b.scale = 0;
    expect(failure(zero, repoFiles).field).toBe('map.decor.items.1.scale');
  });
});
