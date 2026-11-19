import type { Input } from "./scenario";

// Input por DOM, común a los tres motores para que no influya en la comparación.
const pressed = new Set<string>();
window.addEventListener("keydown", (e) => pressed.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => pressed.delete(e.key.toLowerCase()));

export function readInput(): Input {
  const x = (pressed.has("d") || pressed.has("arrowright") ? 1 : 0)
    - (pressed.has("a") || pressed.has("arrowleft") ? 1 : 0);
  const y = (pressed.has("s") || pressed.has("arrowdown") ? 1 : 0)
    - (pressed.has("w") || pressed.has("arrowup") ? 1 : 0);
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}
