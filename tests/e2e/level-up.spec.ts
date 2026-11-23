import { expect, test } from './fixtures';
import {
  collect,
  expectManual,
  focusGame,
  gameUrl,
  snapshotOf,
  step,
  stepUntil,
  waitForRun,
} from './probe';

// Recorrido matar → recoger → subir → elegir → seguir (spec upgrades, "Recorrido en el navegador").
// Núcleo, semilla 7 sin input: primera oferta en el tick 4.346 con el mundo 2x (0013; plazo 4.800,
// ≈ 72 s de juego). El nivel que pinta la barra es el del snapshot (XpBar, probada en Node) y el
// overlay se ve si y solo si hay oferta. En modo manual (change 0014) la partida avanza solo con
// step: el snapshot que cierra la oferta es el de `step(1)`, sin carrera con la segunda oferta.
const FIRST_OFFER_LIMIT = 80 * 60;
/** Antes de cualquier oferta posible de la semilla 7 (para leer el nivel 1). */
const BEFORE_OFFER = 3000;

test('Recorrido en el navegador: con ?seed=7 sin input aparece el overlay, se pulsa 1 y se sigue', async ({
  page,
}) => {
  const problems = collect(page, ['error', 'warning']);
  await page.goto(gameUrl({ seed: 7, manual: true }));
  await expectManual(page);
  await waitForRun(page);
  await focusGame(page);

  const before = await stepUntil(page, (s) => s.tick >= BEFORE_OFFER, FIRST_OFFER_LIMIT);
  const offered = await stepUntil(page, (s) => s.offer.length > 0, FIRST_OFFER_LIMIT);

  expect(before?.progression.level).toBe(1);
  expect(offered?.status).toBe('choosing');
  expect(offered?.offer).toHaveLength(3);
  expect(offered?.tick).toBeLessThanOrEqual(FIRST_OFFER_LIMIT);
  // Con la oferta abierta la partida no avanza aunque se pida.
  expect(await step(page, 30)).toBe(0);
  expect((await snapshotOf(page))?.tick).toBe(offered?.tick);

  await page.keyboard.press('1');
  expect(await step(page, 1)).toBe(1);
  const after = await snapshotOf(page);
  expect(after?.offer).toHaveLength(0);
  expect(after?.progression.level).toBe(2);
  expect(after?.upgrades).toEqual([{ id: offered?.offer[0]?.id, level: 1 }]);
  expect(after?.tick).toBe((offered?.tick ?? 0) + 1);
  expect(problems).toEqual([]);
});
