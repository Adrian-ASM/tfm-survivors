// Firma dorada del mapa (design 0015 §3.5). Sin imports: la usan los E2E, que no importan `src/`.
// La fija `tests/support/map-golden.test.ts` contra el núcleo (`mapForSeed`): si el generador,
// `deriveSeed` o `MAP_STREAM` cambian, ese test falla y hay que regenerarla (y re-medir el balance).
// 0016: regenerada con el castillo. 0017: regenerada con el mundo de 3.840 × 2.160 (64 × 36) y revisada
// a mano: 20 `C` en columnas 30–34 × filas 15–18 y ningún `~`/`=` en filas 16..22 × columnas 29..35.

/** Carácter de cada tipo de celda en la firma. */
export const CELL_CODE = {
  grass: '.',
  trunk: 'T',
  water: '~',
  bridge: '=',
  castle: 'C',
} as const;

/** Firma de una lista de tipos de celda en orden de filas (un carácter por celda). */
export const signatureOf = (cells: readonly string[]): string =>
  cells.map((t) => (t in CELL_CODE ? CELL_CODE[t as keyof typeof CELL_CODE] : '?')).join('');

/** Mapas del contenido por defecto (64 × 36, una cadena por fila) para las semillas 42 y 123. */
export const MAP_GOLDEN: Readonly<Record<42 | 123, string>> = {
  42: [
    '........................T......TTTT..TTTT.....~.................',
    '..........TTTT..........TT............TT......~.................',
    '............TTT...T...................TT......~.................',
    '................TTTT......T...................~.................',
    '...TT............TT.....TTT...TT..............~.................',
    '..TT......................T...TTT.............~..............T..',
    '...T...TTT.....TT..............T..............~.............TT..',
    '....TTT..T.....TTT.............T..............~..............T..',
    '....T.................T.T.....................~.................',
    '....T...............TTTTT....................~~..TTT............',
    '....T..........................TT............~......T...........',
    '...............................T.............~......T....T....T.',
    '...........................................TT~~.....TTT..T.T.TT.',
    '............................................T.~......TT..TTT.T..',
    '.TT........................................TT.=...T.............',
    '.T............................CCCCC...........~...TT.....TTT....',
    'TT..T.........................CCCCC..T....TT..~...T........T....',
    'TTT.TT..........TT............CCCCC.TTT....TT~~.................',
    '....TT..........TTTT..T.......CCCCC.T......TT~..................',
    '...............T..T...TT..................TT.~......TT.....T....',
    '...........T..TT.............................=......TT.....T....',
    '...........T..TTT......................TT....~~.....TTT....T....',
    '..........TT............................T.....~......T....TTT...',
    '...........T..T...............................~.................',
    '............TTT......T..T.....T...............~.................',
    '.....................T..T.....TT............T.~..T..............',
    '....................TT..TTT...TT............TT~..TT.TTTT........',
    '.....................TTT.TT...T............TTT~..TT....T........',
    '....TTT............TT.T.......................~...T.............',
    '...................T..........................~.................',
    '.T............................T..............~~.........T.......',
    '.T.........TT.................TTTT...........~..........TT..T...',
    'TT.TTTT....TTT.....................T.........=..........TT..TT..',
    'TT...TT...TT............TT........TTT.TTT...~~..........T...T...',
    '......T..........TT...TTT..........TTT.T...~~...................',
    '.................TT....T...............T...~....................',
  ].join(''),
  123: [
    '....................................TTTT........................',
    '..............~~~~....~=~=~~~~~~~~~.TTT....~~~~~.......T........',
    '.........~~~~~~..~~..~~...........~~~~~~=~~~...~~~~...TT........',
    '~~~~~~..~~...TT...~~~~............................~~~~~T........',
    '.....~~~~...TT........................................~~~~~~~~~~',
    '........................................................T..T....',
    '......................................TTT...............T..TT...',
    '..TTT..............T....................TT.............TTT.TT...',
    'T...TTT.....TT....TTT................................T...T.TT...',
    'TTT.T.T....TTTTT.........TT........T...T.............TT....T....',
    'TT................T.....TTT........TT..T........T.......TT......',
    '.TT..............TT....TT.........TTTT.TTT......T........T......',
    '.........T.......T................T.............T.............TT',
    '.........T....TT....................T...........TT............TT',
    '.......TTT.....T...................TTT...............TTT.......T',
    '.T..T..T.T.................T..CCCCCT.................TT.........',
    'TTT.T............TT........TT.CCCCCT.................T..........',
    'T...T.........TT.T..........T.CCCCC................TT...........',
    '...TT........TT............TT.CCCCC.................TTTT........',
    '...T..........T.............T........................TT.........',
    '...........T..T.....................TT...........TTTT...........',
    'TTTT.....T.T........................T..............TTT.........T',
    '.......TTT.TT............TTT........T.......................TTTT',
    '........TT.TT..............T..TTTT...........................T.T',
    '.........T.T...................T.....T.................T.....T..',
    '..............................TT.....TTT...............T........',
    '...............TT.....................................TT........',
    '................T...............................................',
    '........................................................T.......',
    '..........T.T....T.....................T..............TTTT...TT.',
    '..........TTT....T...................TTT...............TT.....T.',
    '..........T......T...................TT...................T.....',
    '.......T...T...TTT....................T..................TT.....',
    '.......TT.TT....T........T................TTTT............T.....',
    '......TT..TT.............TT................T.T..................',
    '......T................TTTT.TTT.................................',
  ].join(''),
};

/** Huella de una estructura para su firma (la de `map.structures` del núcleo y de la sonda). */
export interface StructureFootprint {
  readonly type: string;
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
}

/** Firma de las estructuras: `tipo@col,row,cols,rows` en orden de id (design 0021 §10). */
export const structureSignatureOf = (list: readonly StructureFootprint[]): string[] =>
  list.map(
    (s) => `${s.type}@${String(s.col)},${String(s.row)},${String(s.cols)},${String(s.rows)}`,
  );

/**
 * Estructuras del contenido por defecto (0021) para las semillas 42 y 123, colocadas con
 * `STRUCT_STREAM`. Cambia con content/structures.json o con la colocación: se regenera con
 * `map-golden.test.ts` (y se vuelve a medir el balance). `MAP_GOLDEN` no cambia con ellas.
 */
export const STRUCTURE_GOLDEN: Readonly<Record<42 | 123, readonly string[]>> = {
  42: [
    'goblin-house@18,14,2,3',
    'goblin-house@28,31,2,3',
    'goblin-house@59,27,2,3',
    'goblin-house@34,5,2,3',
    'goblin-tower@41,27,2,3',
    'goblin-tower@53,23,2,3',
    'goblin-tower@3,24,2,3',
  ],
  123: [
    'goblin-house@33,28,2,3',
    'goblin-house@6,23,2,3',
    'goblin-house@52,23,2,3',
    'goblin-house@27,3,2,3',
    'goblin-tower@45,26,2,3',
    'goblin-tower@22,13,2,3',
    'goblin-tower@4,11,2,3',
  ],
};

/** Vetas y montones de un mapa para su firma (los de `map.veins`/`map.woodPiles` y de la sonda). */
export interface ResourceLayout {
  readonly veins: readonly { readonly x: number; readonly y: number }[];
  readonly woodPiles: readonly { readonly x: number; readonly y: number }[];
}

/** Firma de los recursos: `vein@col,row` y luego `wood@col,row`, en su orden (celdas de 60 px). */
export const resourceSignatureOf = (map: ResourceLayout, cellSize = 60): string[] => {
  const at = (p: { x: number; y: number }) =>
    `${String(Math.floor(p.x / cellSize))},${String(Math.floor(p.y / cellSize))}`;
  return [...map.veins.map((v) => `vein@${at(v)}`), ...map.woodPiles.map((p) => `wood@${at(p)}`)];
};

/**
 * Vetas y montones del contenido por defecto (0022) para las semillas 42 y 123, colocados con
 * `RESOURCE_STREAM` tras las estructuras. Cambia con content/resources.json o con la colocación: se
 * regenera con `map-golden.test.ts`. `MAP_GOLDEN` y `STRUCTURE_GOLDEN` no cambian con ellos.
 */
export const RESOURCE_GOLDEN: Readonly<Record<42 | 123, readonly string[]>> = {
  42: [
    'vein@0,14',
    'vein@30,29',
    'vein@42,18',
    'wood@8,18',
    'wood@12,26',
    'wood@48,24',
    'wood@51,17',
    'wood@48,6',
    'wood@50,34',
    'wood@59,25',
    'wood@63,2',
  ],
  123: [
    'vein@16,14',
    'vein@18,22',
    'vein@11,16',
    'wood@3,1',
    'wood@48,6',
    'wood@12,34',
    'wood@6,6',
    'wood@16,6',
    'wood@61,16',
    'wood@5,18',
    'wood@44,13',
  ],
};
