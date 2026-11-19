/** Relleno de la barra de XP (spec leveling): XP actual / XP para el siguiente nivel, en [0, 1]. */
export function xpBarFill(xp: number, xpToNext: number): number {
  if (!(xpToNext > 0)) return 0;
  return Math.min(1, Math.max(0, xp / xpToNext));
}
