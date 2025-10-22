export class InputManager {
  constructor() {
    this.enabled = true;
    this.keys = new Set();

    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);

    addEventListener('keydown', this._handleKeyDown);
    addEventListener('keyup', this._handleKeyUp);
  }

  destroy() {
    removeEventListener('keydown', this._handleKeyDown);
    removeEventListener('keyup', this._handleKeyUp);
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  isEnabled() {
    return this.enabled;
  }

  getHorizontalAxis() {
    if (!this.enabled) return 0;
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  _handleKeyDown(event) {
    this.keys.add(event.code);
  }

  _handleKeyUp(event) {
    this.keys.delete(event.code);
  }
}
