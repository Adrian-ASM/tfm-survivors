/** Nombre del fichero exportado (spec progress-persistence). */
export const PROGRESS_FILE_NAME = 'sprint-survivors-progress.json';

/**
 * La URL `blob:` se revoca un poco después del clic: revocarla en el mismo instante puede cortar la
 * descarga, que el navegador empieza de forma asíncrona.
 */
const REVOKE_DELAY_MS = 1000;

/** Descarga el texto como fichero JSON, sin red: `Blob` → `blob:` → `<a download>` → clic. */
export function downloadProgress(text: string, fileName = PROGRESS_FILE_NAME): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}
