// Firma dorada de los solares (spec procedural-map 0026, "Firma de referencia de los solares"). Sin
// imports: la pueden usar los E2E. Solares del contenido por defecto para las semillas 42 y 123,
// colocados con `SITE_STREAM` 7: `site@col,row` (ancla de la huella) en orden de id. Cambia con
// content/buildings.json (`sites`) o con la colocación; `MAP_GOLDEN`, `STRUCTURE_GOLDEN`,
// `RESOURCE_GOLDEN`, `SHEEP_GOLDEN` y `STONE_GOLDEN` no cambian con ella.
export const SITE_GOLDEN: Readonly<Record<42 | 123, readonly string[]>> = {
  42: ['site@40,7', 'site@20,31', 'site@51,2', 'site@8,10', 'site@53,15', 'site@18,22'],
  123: ['site@20,23', 'site@50,31', 'site@43,9', 'site@60,18', 'site@11,12', 'site@22,6'],
};
