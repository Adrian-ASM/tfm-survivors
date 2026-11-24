// Línea base M0 del change 0022 (tasks 0.1), generada con el código de `main` (5dc4163) antes de
// tocar nada. Spec resources, "Balance sin recalibrar con los recursos": cada semilla debe terminar
// igual (resultado, tick y bajas) con el contenido final. No se edita a mano: si cambia, es un fallo de
// determinismo, no un balance que recalibrar.

/** [semilla, resultado, tick final, bajas] del bot de referencia v3 sobre las semillas 1..50. */
export const BALANCE_BASELINE: readonly (readonly [number, 'won' | 'lost', number, number])[] = [
  [1, 'lost', 25407, 584],
  [2, 'lost', 18364, 390],
  [3, 'lost', 8716, 181],
  [4, 'won', 36000, 862],
  [5, 'won', 36000, 883],
  [6, 'lost', 17241, 363],
  [7, 'won', 36000, 903],
  [8, 'lost', 32019, 699],
  [9, 'won', 36000, 900],
  [10, 'lost', 14173, 303],
  [11, 'lost', 21969, 450],
  [12, 'won', 36000, 890],
  [13, 'won', 36000, 916],
  [14, 'lost', 8141, 153],
  [15, 'won', 36000, 896],
  [16, 'won', 36000, 909],
  [17, 'lost', 13905, 295],
  [18, 'lost', 8165, 173],
  [19, 'won', 36000, 895],
  [20, 'lost', 34980, 872],
  [21, 'lost', 6642, 122],
  [22, 'won', 36000, 892],
  [23, 'won', 36000, 903],
  [24, 'lost', 9969, 207],
  [25, 'won', 36000, 855],
  [26, 'won', 36000, 865],
  [27, 'won', 36000, 892],
  [28, 'won', 36000, 884],
  [29, 'lost', 14194, 309],
  [30, 'won', 36000, 899],
  [31, 'won', 36000, 923],
  [32, 'won', 36000, 869],
  [33, 'lost', 6342, 119],
  [34, 'lost', 18110, 376],
  [35, 'won', 36000, 884],
  [36, 'won', 36000, 893],
  [37, 'won', 36000, 884],
  [38, 'won', 36000, 891],
  [39, 'lost', 21890, 463],
  [40, 'won', 36000, 852],
  [41, 'won', 36000, 891],
  [42, 'lost', 11505, 240],
  [43, 'won', 36000, 901],
  [44, 'won', 36000, 913],
  [45, 'won', 36000, 899],
  [46, 'lost', 6646, 127],
  [47, 'lost', 16312, 354],
  [48, 'lost', 24828, 548],
  [49, 'lost', 14001, 287],
  [50, 'lost', 15869, 344],
];

/** Media de mechas de `goblin-barrel` por partida del bot v3 (sin redondear). */
export const BASELINE_FUSES_PER_RUN = 26.88;

/**
 * Huella (sha256 de JSON canónico, claves ordenadas) de los campos de combate del contenido de
 * `main` (spec resources, "Contenido de combate intacto"). Progresión: solo los campos de XP.
 */
export const COMBAT_CONTENT_SHA256 = {
  waves: 'ad7b9a6c23c3dce1f8d80473273e7e481ee83fd11fff41c3393db968f846ecc7',
  enemies: '5ab431721ced0525c9b2fe802808e328c222d20b4d5f6dc8d2243e551066c07c',
  weapons: '4aa8c55f7bfdf02d1b2e8700e23120d59dc04d5a0a811973395b47c6a3cda0f9',
  upgrades: 'ad0bfdcaa189586f880535d0e8ae2e05e37d5bc477593a35ce8790593d270751',
  player: '625622ed673953ac1cce75e60c9effecc1fecdf3c5174685e21ede1175ff88f0',
  progression: 'd794f9130929587446e03b8052c1a8d0ba7b86876548c90e34303e6fd464133b',
  structures: '2ebda39bdcf9091295b115fb84b4e8569184dfd9fed3fa0b400cbc36bfbfa105',
} as const;
