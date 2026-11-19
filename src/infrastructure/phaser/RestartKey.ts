import type Phaser from 'phaser';

/** Lo mínimo que se usa de una tecla del motor: su evento `down` (primera pulsación). */
interface DownKey {
  on(event: 'down', handler: () => void): unknown;
}

/**
 * Adaptador de input del reinicio: tecla R. Mismo patrón que `ChoiceKeys`: escucha el evento
 * `down`, que el motor emite una vez por pulsación (no al mantenerla), y no usa `JustDown` (en
 * Phaser 4.2.1 una pulsación que empieza y acaba en el mismo frame se perdería). Sin reglas de
 * juego: la escena decide con `RestartRun` si el reinicio procede.
 */
export class RestartKey {
  private pressed = false;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    const key = keyboard.addKey('R') as DownKey;
    key.on('down', () => {
      this.pressed = true;
    });
  }

  /** ¿Se ha pulsado R desde la última lectura? La consume. */
  read(): boolean {
    const pressed = this.pressed;
    this.pressed = false;
    return pressed;
  }
}
