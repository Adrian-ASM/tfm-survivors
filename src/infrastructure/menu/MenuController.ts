/** `idle`: menú operativo; `confirming`: diálogo de Borrar datos abierto; `leaving`: Jugar pulsado. */
export type MenuState = 'idle' | 'confirming' | 'leaving';

/**
 * Reglas del menú de inicio (ADR-0011), sin DOM ni motor: se prueban en Node. Jugar solo actúa
 * una vez (doble clic ⇒ 1 partida) y, con el diálogo abierto, ninguna opción del menú tiene efecto
 * (spec main-menu). Los paneles DOM solo llaman a estos métodos; la escena consume `takePlay`.
 */
export class MenuController {
  private current: MenuState = 'idle';
  private playPending = false;

  get state(): MenuState {
    return this.current;
  }

  /** Jugar: solo en `idle`; deja una petición que la escena consume una vez con `takePlay`. */
  requestPlay(): boolean {
    if (this.current !== 'idle') return false;
    this.current = 'leaving';
    this.playPending = true;
    return true;
  }

  takePlay(): boolean {
    const pending = this.playPending;
    this.playPending = false;
    return pending;
  }

  requestExport(): boolean {
    return this.current === 'idle';
  }

  requestImport(): boolean {
    return this.current === 'idle';
  }

  /** Borrar datos: abre el diálogo de confirmación. */
  openConfirm(): boolean {
    if (this.current !== 'idle') return false;
    this.current = 'confirming';
    return true;
  }

  /** Confirmar: solo la primera vez con el diálogo abierto; el llamante borra si da true. */
  confirm(): boolean {
    return this.closeDialog();
  }

  /** Cancelar: cierra el diálogo sin pedir nada más. */
  cancel(): boolean {
    return this.closeDialog();
  }

  /** El menú vuelve a mostrarse (al cargar o tras Volver al menú). */
  show(): void {
    this.current = 'idle';
    this.playPending = false;
  }

  private closeDialog(): boolean {
    if (this.current !== 'confirming') return false;
    this.current = 'idle';
    return true;
  }
}
