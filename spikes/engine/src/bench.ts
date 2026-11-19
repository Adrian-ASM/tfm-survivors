// Medidor común: cuenta frames reales del navegador (requestAnimationFrame), así que mide igual
// a los tres motores. 2 s de calentamiento + 10 s de medición. Resultado en pantalla y en consola.

const WARMUP_MS = 2000;
const DURATION_MS = 10000;

export interface BenchResult {
  engine: string;
  n: number;
  avgFps: number;
  low1Fps: number;
  frames: number;
  userAgent: string;
}

export function startBench(engine: string, n: number): void {
  const overlay = document.createElement("pre");
  overlay.style.cssText =
    "position:fixed;top:8px;left:8px;margin:0;padding:6px 8px;background:#000c;color:#fff;" +
    "font:12px monospace;z-index:10;pointer-events:none";
  document.body.appendChild(overlay);

  const frameTimes: number[] = [];
  const start = performance.now();
  let last = start;
  let smoothed = 60;
  let done = false;

  const frame = (now: number): void => {
    const dt = now - last;
    last = now;
    const elapsed = now - start;
    if (dt > 0) smoothed = smoothed * 0.9 + (1000 / dt) * 0.1;

    if (elapsed > WARMUP_MS && elapsed <= WARMUP_MS + DURATION_MS) frameTimes.push(dt);

    if (!done && elapsed > WARMUP_MS + DURATION_MS) {
      done = true;
      const sorted = [...frameTimes].sort((a, b) => b - a);
      const p99 = sorted[Math.floor(sorted.length * 0.01)] ?? sorted[0] ?? 0;
      const result: BenchResult = {
        engine,
        n,
        avgFps: Math.round((frameTimes.length / (DURATION_MS / 1000)) * 10) / 10,
        low1Fps: p99 > 0 ? Math.round((1000 / p99) * 10) / 10 : 0,
        frames: frameTimes.length,
        userAgent: navigator.userAgent,
      };
      (window as unknown as { __bench: BenchResult }).__bench = result;
      console.log("[bench]", JSON.stringify(result));
    }

    const phase = done ? "HECHO" : elapsed < WARMUP_MS ? "calentando" : "midiendo";
    const res = (window as unknown as { __bench?: BenchResult }).__bench;
    overlay.textContent =
      `${engine} · n=${n} · ${phase}\nFPS ahora: ${smoothed.toFixed(0)}` +
      (res ? `\nMEDIA: ${res.avgFps}  ·  1% LOW: ${res.low1Fps}` : "");
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
