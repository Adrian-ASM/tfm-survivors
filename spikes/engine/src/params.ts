export function readCount(): number {
  const n = Number(new URLSearchParams(location.search).get("n") ?? 500);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 500;
}
