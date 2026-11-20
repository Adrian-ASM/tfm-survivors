import type Phaser from 'phaser';

/** Lo mínimo que se usa de una tecla del motor: su evento `down` (primera pulsación). */
interface DownKey {
  on(event: 'down', handler: () => void): unknown;
}

/**
 * Adaptador de input de la pausa: tecla Esc (`KeyCodes.ESC`, 27 en Phaser 4.2.1). Mismo patrón que
 * `RestartKey`: el evento `down` se emite una vez por pulsación aunque se mantenga (spec main-menu,
 * "Esc mantenido"). Sin reglas: `PauseGate` decide si la pulsación cambia la pausa.
 */
export class PauseKey {
  private pressed = false;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    const key = keyboard.addKey('ESC') as DownKey;
    key.on('down', () => {
      this.pressed = true;
    });
  }

  /** ¿Se ha pulsado Esc desde la última lectura? La consume. */
  read(): boolean {
    const pressed = this.pressed;
    this.pressed = false;
    return pressed;
  }
}
