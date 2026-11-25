/**
 * `idle`: menú operativo; `confirming`: diálogo de Borrar datos abierto; `guide`: guía «Cómo jugar»
 * abierta (0028); `leaving`: Jugar pulsado.
 */
export type MenuState = 'idle' | 'confirming' | 'guide' | 'leaving';

/**
 * Reglas del menú de inicio (ADR-0011), sin DOM ni motor: se prueban en Node. Jugar solo actúa
 * una vez (doble clic ⇒ 1 partida) y, con el diálogo o la guía abiertos, ninguna opción del menú
 * tiene efecto (spec main-menu y menu-guide). Los paneles DOM solo llaman a estos métodos; la
 * escena consume `takePlay`.
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

  /** Cómo jugar: abre la guía, solo con el menú operativo. */
  openGuide(): boolean {
    if (this.current !== 'idle') return false;
    this.current = 'guide';
    return true;
  }

  /** La guía se ha cerrado (Cerrar o Esc): el menú vuelve a estar operativo. */
  closeGuide(): boolean {
    if (this.current !== 'guide') return false;
    this.current = 'idle';
    return true;
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
