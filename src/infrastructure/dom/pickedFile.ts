/** Lo que se lee de `HTMLInputElement.files` (un `FileList`). */
export interface PickedFiles {
  readonly length: number;
  item(index: number): File | null;
}

/** Fichero elegido en el selector, o `null` si se canceló (ni import ni mensaje). */
export const pickedFile = (files: PickedFiles | null): File | null =>
  files && files.length > 0 ? files.item(0) : null;
