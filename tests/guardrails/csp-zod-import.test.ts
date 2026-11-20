import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// verify-report W1 (0007): zod 4 sondea `new Function` al construir cada esquema y la CSP lo registra
// como violación. `cspSafeZod` lo desactiva, pero solo si se evalúa antes que cualquier módulo con
// esquemas, es decir, si es el primer import de la composición.
const main = readFileSync(
  join(import.meta.dirname, '..', '..', 'src', 'composition', 'main.ts'),
  'utf8',
);
const imports = [...main.matchAll(/^import\s[^;]*;/gm)].map((m) => m[0]);

describe('Orden de imports de main.ts (CSP sin eval)', () => {
  it('el primer import es el módulo de efecto cspSafeZod', () => {
    expect(imports[0]).toBe("import '../infrastructure/validation/cspSafeZod';");
  });
});
