import { z } from 'zod';

/*
 * Sin JIT de zod (design 0007, CSP). zod 4 sondea `new Function("")` al construir cada esquema de
 * objeto y, aunque capture el error, la CSP sin `'unsafe-eval'` registra un
 * `securitypolicyviolation`. Con `jitless` no hay sonda ni `eval`; la validación es la misma.
 * Módulo de efecto: la composición lo importa el primero, antes de cualquier módulo con esquemas.
 */
z.config({ jitless: true });
