/**
 * Pulso visible (registro mutable y reutilizable del pool de `Arsenal`): solo se pinta, no daña
 * después. Disparado en T con visualTicks V: visible en los snapshots de T a T + V − 1.
 */
export class PulseEcho {
  weaponId = '';
  firedAt = 0;
  x = 0;
  y = 0;
  radius = 0;
  private until = 0;

  set(weaponId: string, firedAt: number, x: number, y: number, radius: number, until: number) {
    this.weaponId = weaponId;
    this.firedAt = firedAt;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.until = until;
  }

  expiredAt(n: number): boolean {
    return n >= this.until;
  }
}
