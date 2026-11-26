// Rutas de la lista de imágenes con IA de la nota del repositorio (0034, `generated[]`): las únicas
// que valen como icono en `parseAppearance` / `bootContent` (design D8).
import provenanceJson from '../../content/asset-provenance.json';
import { generatedPaths } from '../../src/infrastructure/content/loadAppearance';

export const GENERATED_PATHS: readonly string[] = generatedPaths(provenanceJson);
