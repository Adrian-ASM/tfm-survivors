// Línea base del change 0027 (tasks 2.4), medida con el bot de referencia v4 y el contenido final:
// los solares libres bloquean desde el tick 0 (ADR-0026) y el v4 los rodea. Sustituye a propósito la
// M2 de 0024 (30/50), que siguió intacta en 0025 y 0026; con 0027: 34/50, 29,9 mechas por partida.
// Spec build-sites, "Bot v4 en banda y línea base": cada semilla debe terminar igual (resultado, tick
// y bajas). No se edita a mano: si cambia, es un fallo de determinismo o un cambio de balance que
// exige un change.

/** [semilla, resultado, tick final, bajas] del bot de referencia v4 sobre las semillas 1..50. */
export const BALANCE_BASELINE: readonly (readonly [number, 'won' | 'lost', number, number])[] = [
  [1, 'won', 36000, 863],
  [2, 'won', 36000, 858],
  [3, 'lost', 16803, 347],
  [4, 'won', 36000, 884],
  [5, 'won', 36000, 891],
  [6, 'won', 36000, 883],
  [7, 'lost', 12467, 255],
  [8, 'lost', 15796, 315],
  [9, 'lost', 23834, 526],
  [10, 'won', 36000, 898],
  [11, 'won', 36000, 885],
  [12, 'won', 36000, 901],
  [13, 'lost', 11671, 254],
  [14, 'lost', 15266, 329],
  [15, 'won', 36000, 875],
  [16, 'won', 36000, 881],
  [17, 'won', 36000, 880],
  [18, 'won', 36000, 873],
  [19, 'won', 36000, 892],
  [20, 'lost', 14268, 313],
  [21, 'won', 36000, 878],
  [22, 'won', 36000, 855],
  [23, 'won', 36000, 899],
  [24, 'won', 36000, 887],
  [25, 'won', 36000, 881],
  [26, 'won', 36000, 857],
  [27, 'won', 36000, 878],
  [28, 'lost', 19606, 386],
  [29, 'won', 36000, 873],
  [30, 'lost', 10812, 250],
  [31, 'lost', 21036, 433],
  [32, 'won', 36000, 910],
  [33, 'won', 36000, 890],
  [34, 'lost', 8825, 180],
  [35, 'won', 36000, 869],
  [36, 'lost', 7886, 151],
  [37, 'won', 36000, 870],
  [38, 'won', 36000, 865],
  [39, 'lost', 13390, 284],
  [40, 'won', 36000, 879],
  [41, 'won', 36000, 877],
  [42, 'won', 36000, 907],
  [43, 'won', 36000, 884],
  [44, 'won', 36000, 892],
  [45, 'won', 36000, 879],
  [46, 'lost', 30381, 684],
  [47, 'won', 36000, 885],
  [48, 'lost', 14354, 302],
  [49, 'lost', 18000, 353],
  [50, 'won', 36000, 862],
];

/** Media de mechas de `goblin-barrel` por partida del bot v4 (sin redondear; 30,44 en M2). */
export const BASELINE_FUSES_PER_RUN = 29.9;

/**
 * Referencia versionada del bot v5 (0027, tasks 2.4; spec build-sites, "Victorias del bot v5"):
 * victorias sobre las semillas 1..50 con el contenido por defecto final (29/50 en 0026).
 */
export const BUILDER_REFERENCE = { wins: 34 } as const;

/**
 * Huella (sha256 de JSON canónico, claves ordenadas) del contenido de `main` antes de 0024 que el
 * change no puede tocar (spec run-outcome, "Presupuesto de oleadas y stats intactos"): oleadas,
 * enemigos, armas y estructuras completos, el jugador sin `regenIntervalTicks` y la progresión solo
 * con los campos de XP y gemas.
 */
export const COMBAT_CONTENT_SHA256 = {
  waves: 'ad7b9a6c23c3dce1f8d80473273e7e481ee83fd11fff41c3393db968f846ecc7',
  enemies: '5ab431721ced0525c9b2fe802808e328c222d20b4d5f6dc8d2243e551066c07c',
  weapons: '4aa8c55f7bfdf02d1b2e8700e23120d59dc04d5a0a811973395b47c6a3cda0f9',
  player: '625622ed673953ac1cce75e60c9effecc1fecdf3c5174685e21ede1175ff88f0',
  progression: 'd794f9130929587446e03b8052c1a8d0ba7b86876548c90e34303e6fd464133b',
  structures: '2ebda39bdcf9091295b115fb84b4e8569184dfd9fed3fa0b400cbc36bfbfa105',
} as const;

/**
 * Huella del contenido final de 0024 (M2): los ficheros calibrados enteros. Un precio, un oro o una
 * curación cambiados en 1 la rompen (spec castle-shop, "Línea base nueva congelada").
 */
export const BALANCE_CONTENT_SHA256 = {
  upgrades: '9a93d344f3d239a00d9781f7d1e754f974f8ade30cb5ea2d05056c3bc14a09a7',
  player: '4e9a87f231c360f05a6d115e4690e4f85612573bb6a3e7fd7fae3245d5ad22f0',
  resources: '518d3ec381209c897736a614b13de443cdde5fe69101106965ff8b816522c87d',
  progression: '43351a63986f766c1dae881873b73a79a6634cadca2948a8e57c603619672659',
  shop: 'fb83c18046f4755af1ebb34942994bd7321d2162ff9a31bd6fb5800d847a3275',
} as const;
