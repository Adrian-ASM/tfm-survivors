// Pose de un icono recortado del HUD (change 0036, design D5): función pura, sin motor.
// `TextureCrop.setCrop` (Phaser 4) recorta en coordenadas del frame sin cambiar el tamaño del
// objeto, que sigue midiendo el frame entero; el origen también es relativo al frame. Con el origen
// en el centro del recorte, ese centro cae en la posición del objeto (el ancla del icono), y con la
// escala lado / ancho del recorte, lo visible mide `size` en pantalla.

/** Recorte en px del frame (x, y, ancho y alto). */
export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Tamaño del frame de la hoja en px. */
export interface FrameSize {
  readonly width: number;
  readonly height: number;
}

/** Origen (relativo al frame) y escala del objeto del icono. */
export interface IconPose {
  readonly originX: number;
  readonly originY: number;
  readonly scale: number;
}

/** Pose para que el recorte, centrado en el ancla, mida `size` px de lado (recorte cuadrado). */
export function cropPose(crop: CropRect, frame: FrameSize, size: number): IconPose {
  return {
    originX: (crop.x + crop.width / 2) / frame.width,
    originY: (crop.y + crop.height / 2) / frame.height,
    scale: size / crop.width,
  };
}
