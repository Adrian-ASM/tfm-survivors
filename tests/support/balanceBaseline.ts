// Línea base M2 del change 0024 (tasks 5.3), medida con el bot de referencia v4 y el contenido final
// (dos catálogos, tienda, oro por baja). Spec castle-shop, "Línea base nueva congelada": cada semilla
// debe terminar igual (resultado, tick y bajas). Sustituye a propósito la de 0022/0023 (bot v3). No
// se edita a mano: si cambia, es un fallo de determinismo o un cambio de balance que exige un change.

/** [semilla, resultado, tick final, bajas] del bot de referencia v4 sobre las semillas 1..50. */
export const BALANCE_BASELINE: readonly (readonly [number, 'won' | 'lost', number, number])[] = [
  [1, 'won', 36000, 900],
  [2, 'won', 36000, 847],
  [3, 'lost', 17322, 367],
  [4, 'lost', 15354, 304],
  [5, 'won', 36000, 911],
  [6, 'won', 36000, 900],
  [7, 'won', 36000, 862],
  [8, 'lost', 13364, 278],
  [9, 'lost', 8568, 160],
  [10, 'won', 36000, 882],
  [11, 'lost', 18182, 365],
  [12, 'won', 36000, 908],
  [13, 'lost', 14777, 321],
  [14, 'lost', 10672, 222],
  [15, 'won', 36000, 865],
  [16, 'lost', 25688, 552],
  [17, 'won', 36000, 880],
  [18, 'won', 36000, 873],
  [19, 'won', 36000, 879],
  [20, 'won', 36000, 901],
  [21, 'won', 36000, 870],
  [22, 'won', 36000, 827],
  [23, 'won', 36000, 871],
  [24, 'won', 36000, 904],
  [25, 'won', 36000, 882],
  [26, 'won', 36000, 853],
  [27, 'won', 36000, 878],
  [28, 'lost', 20925, 419],
  [29, 'won', 36000, 895],
  [30, 'won', 36000, 887],
  [31, 'lost', 12146, 275],
  [32, 'won', 36000, 892],
  [33, 'won', 36000, 878],
  [34, 'won', 36000, 878],
  [35, 'won', 36000, 877],
  [36, 'lost', 13494, 296],
  [37, 'won', 36000, 871],
  [38, 'lost', 17197, 358],
  [39, 'won', 36000, 888],
  [40, 'lost', 23981, 516],
  [41, 'lost', 19703, 402],
  [42, 'lost', 3939, 61],
  [43, 'lost', 17005, 344],
  [44, 'lost', 20290, 429],
  [45, 'lost', 9026, 185],
  [46, 'won', 36000, 885],
  [47, 'won', 36000, 881],
  [48, 'lost', 19530, 411],
  [49, 'lost', 12848, 282],
  [50, 'won', 36000, 866],
];

/** Media de mechas de `goblin-barrel` por partida del bot v4 (sin redondear). */
export const BASELINE_FUSES_PER_RUN = 30.44;

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
