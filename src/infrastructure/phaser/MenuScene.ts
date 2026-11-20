import Phaser from 'phaser';
import { GAME_SCENE_KEY, MENU_SCENE_KEY } from './sceneKeys';

/** Menú de inicio (DOM): la escena lo muestra al entrar, lo oculta al salir y lee Jugar. */
export interface MenuView {
  show(): void;
  hide(): void;
  /** ¿Se ha pulsado Jugar desde la última lectura? La consume (una sola partida por clic). */
  takePlay(): boolean;
}

const TITLE_Y = 72;
const TITLE_STYLE = { fontFamily: 'monospace', fontSize: '40px', color: '#ffffff' } as const;

/**
 * Pantalla del menú de inicio (ADR-0011): sin partida, sin teclas registradas. Solo pinta el título
 * y enruta: Jugar arranca `GameScene`, que crea la partida al entrar. No contiene reglas: las del
 * menú están en `MenuController`.
 */
export class MenuScene extends Phaser.Scene {
  constructor(
    private readonly menu: MenuView,
    private readonly title: string,
  ) {
    super(MENU_SCENE_KEY);
  }

  create(): void {
    this.add.text(this.scale.width / 2, TITLE_Y, this.title, TITLE_STYLE).setOrigin(0.5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.menu.hide();
    });
    this.menu.show();
  }

  override update(): void {
    if (this.menu.takePlay()) this.scene.start(GAME_SCENE_KEY);
  }
}
