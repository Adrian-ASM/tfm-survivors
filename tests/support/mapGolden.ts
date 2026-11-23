// Firma dorada del mapa (design 0015 §3.5). Sin imports: la usan los E2E, que no importan `src/`.
// La fija `tests/support/map-golden.test.ts` contra el núcleo (`mapForSeed`): si el generador,
// `deriveSeed` o `MAP_STREAM` cambian, ese test falla y hay que regenerarla (y re-medir el balance).

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

/** Mapas del contenido por defecto (32 × 18, una cadena por fila) para las semillas 42 y 123. */
export const MAP_GOLDEN: Readonly<Record<42 | 123, string>> = {
  42: [
    '...TT..................~........',
    '..TTTT...........TT....~........',
    '...T..............T....~........',
    '.T.....................~........',
    '.TT....................=...T....',
    '..T....................~..TTT...',
    '.T.....T...............~.TTT....',
    'TTT..TTTT..............~..T..TT.',
    '.T...TTT...........T...=.....TT.',
    '.TT................TTT~~......T.',
    '...TT..............T..~.........',
    '..TTTT................~.........',
    '......................~~........',
    '...........TTTTTT......~........',
    '....TT.........TT......~........',
    '....T..................~....T...',
    '.......................~..TTT...',
    '.......................~.TT.....',
  ].join(''),
  123: [
    '................................',
    '~~~=~~..~~~~=~~..~~~~~..........',
    '.....~~~~.....~~~~T..~~.........',
    '.T......TTT.......TT..~~........',
    'TT......TT......T.TT...~~~~~~=~~',
    '........T.....TTT..T...........T',
    '........TT....................TT',
    '......................TTT......T',
    '......................TTT.TTT..T',
    '.......T...TT........T..T.TTT...',
    '.......T...TT........TT.....T...',
    '.......TTT.TT.........T.........',
    '........TT......................',
    '.........T......T.............T.',
    '................T...........TTTT',
    '..............TTT............TT.',
    '..............T.................',
    '................................',
  ].join(''),
};
