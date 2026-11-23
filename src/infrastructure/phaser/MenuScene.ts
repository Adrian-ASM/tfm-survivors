import Phaser from 'phaser';
import { GAME_SCENE_KEY, MENU_SCENE_KEY } from './sceneKeys';

/** Menú de inicio (DOM): la escena lo muestra al entrar, lo oculta al salir y lee Jugar. */
export interface MenuView {
  show(): void;
  hide(): void;
  /** ¿Se ha pulsado Jugar desde la última lectura? La consume (una sola partida por clic). */
  takePlay(): boolean;
}

/**
 * Pantalla del menú de inicio (ADR-0011): sin partida, sin teclas registradas. No pinta nada (el
 * título es el `h1` del panel DOM, 0017 D11): solo enruta. Jugar arranca `GameScene`, que crea
 * la partida al entrar. No contiene reglas: las del menú están en `MenuController`.
 */
export class MenuScene extends Phaser.Scene {
  constructor(private readonly menu: MenuView) {
    super(MENU_SCENE_KEY);
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.menu.hide();
    });
    this.menu.show();
  }

  override update(): void {
    if (this.menu.takePlay()) this.scene.start(GAME_SCENE_KEY);
  }
}
