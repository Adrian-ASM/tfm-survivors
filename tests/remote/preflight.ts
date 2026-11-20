import type { FullConfig } from '@playwright/test';
import { checkReachable, resolveTargetUrl } from './target';

// globalSetup del smoke remoto (design 0011): antes de abrir ninguna página, la URL objetivo debe
// responder 200. Si no, el informe solo muestra "no llegó a estado 200" con la URL, distinguible de
// un fallo de CSP o del bucle de juego (spec "URL objetivo que no responde").
const ATTEMPTS = 3;
const TIMEOUT_MS = 10_000;
const GAP_MS = 5_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export default async function preflight(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  const target = resolveTargetUrl(baseURL);
  if (!target.ok) throw new Error(target.error);
  const reached = await checkReachable(target.value, (input, init) => fetch(input, init), {
    attempts: ATTEMPTS,
    timeoutMs: TIMEOUT_MS,
    gapMs: GAP_MS,
    sleep,
  });
  if (!reached.ok) throw new Error(reached.error);
}
