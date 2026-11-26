import { describe, expect, it } from 'vitest';
import {
  FONT_WAIT_MS,
  loadUiFont,
  withDeadline,
  type FontFaceLike,
  type FontSetLike,
} from '../../../src/infrastructure/dom/uiFont';
import { TestTimer, flush } from '../../support/testTimer';

// Spec sprite-rendering (0032), "Fuente pixel local": carga con FontFace y plazo de 3.000 ms.
const URL = '/tfm-survivors/assets/fonts/DepartureMono-Regular.woff2';
const FAMILY = 'Departure Mono';

/** `document.fonts` falso: `check` dice si se añadió alguna cara (o lo que se le fuerce). */
function fontSet(checkResult?: boolean) {
  const added: FontFaceLike[] = [];
  const set: FontSetLike = {
    add: (f) => added.push(f),
    check: () => checkResult ?? added.length > 0,
  };
  return { set, added };
}

describe('loadUiFont y withDeadline (0032, design §6)', () => {
  it('carga la cara con la URL de la base en woff2, la añade y resuelve true', async () => {
    const { set, added } = fontSet();
    const made: [string, string][] = [];
    const ok = await loadUiFont(
      set,
      (family, source) => {
        made.push([family, source]);
        return { load: () => Promise.resolve() };
      },
      FAMILY,
      URL,
    );
    expect(ok).toBe(true);
    expect(made).toEqual([[FAMILY, `url("${URL}") format("woff2")`]]);
    expect(added).toHaveLength(1);
  });

  it('Scenario: Fuente que no carga (load rechaza → false, sin errores no capturados)', async () => {
    const { set, added } = fontSet();
    const ok = await loadUiFont(
      set,
      () => ({ load: () => Promise.reject(new Error('404')) }),
      FAMILY,
      URL,
    );
    expect(ok).toBe(false);
    expect(added).toEqual([]);
  });

  it('Scenario: Fuente que no carga (falla sin error del cargador: check da false)', async () => {
    const { set } = fontSet(false);
    const ok = await loadUiFont(set, () => ({ load: () => Promise.resolve() }), FAMILY, URL);
    expect(ok).toBe(false);
  });

  it('una fábrica que lanza también da false', async () => {
    const { set } = fontSet();
    const ok = await loadUiFont(
      set,
      () => {
        throw new Error('FontFace no existe');
      },
      FAMILY,
      URL,
    );
    expect(ok).toBe(false);
  });

  it('Scenario: Fuente que no responde (al vencer 3.000 ms, false; antes, pendiente)', async () => {
    expect(FONT_WAIT_MS).toBe(3000);
    const clock = new TestTimer();
    let result: boolean | null = null;
    void withDeadline(new Promise<boolean>(() => undefined), FONT_WAIT_MS, clock.timer).then(
      (r) => {
        result = r;
      },
    );
    await clock.advance(2999);
    expect(result).toBeNull();
    await clock.advance(1);
    expect(result).toBe(false);
    expect(clock.elapsed).toBe(3000);
  });

  it('una fuente que llega antes del plazo gana', async () => {
    const clock = new TestTimer();
    const r = withDeadline(Promise.resolve(true), FONT_WAIT_MS, clock.timer);
    await flush();
    expect(await r).toBe(true);
  });
});
