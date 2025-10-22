import { getCSS, ms } from '../utils/css.js';

export class HUDPanelManager {
  constructor({ inputManager, showThreshold = 0.8, hideThreshold = 1.0 } = {}) {
    this.inputManager = inputManager;
    this.showThreshold = showThreshold;
    this.hideThreshold = hideThreshold;

    this.controlsEnabled = true;
    this.currentHUDText = '';

    this.hudPresent = false;
    this.wantOpen = false;
    this.panelOpen = false;

    this._hudClickBound = false;

    this._togglePanelIfAny = this._togglePanelIfAny.bind(this);
    this._handleEscape = this._handleEscape.bind(this);

    this._createInfoPanel();
    this._ensureHUD();
  }

  areControlsEnabled() {
    return this.controlsEnabled;
  }

  update(trainX, poiList) {
    if (!this.containerAnim || !this.textAnim) return;
    if (!this.hudPresent) return;
    if (this.panelOpen) return;

    let closest = null;
    let closestDist = Infinity;
    for (const poi of poiList) {
      const d = Math.abs(poi.mesh.position.x - trainX);
      if (d < closestDist) {
        closestDist = d;
        closest = poi;
      }
    }

    if (!closest) {
      if (this.wantOpen) this.hideHUD();
      return;
    }

    if (!this.wantOpen && closestDist < this.showThreshold) {
      this.showHUD(closest.name);
    } else if (this.wantOpen) {
      if (closestDist > this.hideThreshold) {
        this.hideHUD();
      } else if (closest.name !== this.hudLabelEl?.textContent) {
        this.showHUD(closest.name);
      }
    }
  }

  showHUD(text) {
    this.currentHUDText = text;
    this.wantOpen = true;
    this._ensureHUD();

    if (!this.hudEl || !this.hudLabelEl || !this.containerAnim || !this.textAnim) return;

    this.hudLabelEl.textContent = text;
    this.containerAnim.playbackRate = 1;
    this.containerAnim.play();

    this.containerAnim.finished.then(() => {
      if (!this.wantOpen) return;
      if (this.textAnim.playbackRate < 0 || this.textAnim.currentTime === 0) {
        this.textAnim.playbackRate = 1;
        this.textAnim.play();
        this.textAnim.finished.catch(() => {});
      }
      this.enableHUDInteractions();
      if (this.panelContentEl) {
        this.panelContentEl.innerHTML = `
          <h3 style="margin:0 0 8px 0;font-size:18px;font-weight:600;">${text}</h3>
          <p style="margin:0;opacity:.9;">Info about ${text} goes here.</p>
        `;
      }
    }).catch(() => {});
  }

  hideHUD() {
    if (!this.wantOpen) return;
    this.wantOpen = false;

    if (this.panelOpen) {
      this.collapsePanel();
      return;
    }

    if (!this.textAnim || !this.containerAnim) return;

    const proceed = () => {
      this.containerAnim.playbackRate = -1;
      this.containerAnim.play();
      const cleanup = () => {
        if (!this.wantOpen) {
          this.disableHUDInteractions();
          if (this.hudLabelEl) this.hudLabelEl.textContent = '';
        }
        this.containerAnim.pause();
        this.containerAnim.currentTime = 0;
      };
      this.containerAnim.finished.then(cleanup).catch(cleanup);
    };

    if (this.textAnim.currentTime > 0) {
      this.textAnim.playbackRate = -1;
      this.textAnim.play();
      this.textAnim.finished.then(() => {
        this.textAnim.pause();
        this.textAnim.currentTime = 0;
        proceed();
      }).catch(() => {
        this.textAnim.pause();
        this.textAnim.currentTime = 0;
        proceed();
      });
    } else {
      proceed();
    }
  }

  enableHUDInteractions() {
    if (!this.hudEl) return;
    const wrap = document.getElementById('poiHUDWrap');
    wrap?.classList.add('interactive');
    if (!this._hudClickBound) {
      this.hudEl.addEventListener('click', this._togglePanelIfAny);
      this._hudClickBound = true;
    }
  }

  disableHUDInteractions() {
    const wrap = document.getElementById('poiHUDWrap');
    wrap?.classList.remove('interactive');
    if (this._hudClickBound && this.hudEl) {
      this.hudEl.removeEventListener('click', this._togglePanelIfAny);
      this._hudClickBound = false;
    }
  }

  expandPanel() {
    if (this.panelOpen) return;
    this.panelOpen = true;
    this._lockControls();

    this.currentHUDText = this.hudLabelEl ? this.hudLabelEl.textContent : this.currentHUDText;
    this.destroyHUD();

    this.panelEl.style.opacity = '1';
    this.panelEl.style.pointerEvents = 'auto';

    if (this.panelCurtainAnim) this.panelCurtainAnim.cancel();
    this.panelCurtainAnim = this.panelEl.animate(
      [
        { clipPath: 'inset(0 0 100% 0)', opacity: 1 },
        { clipPath: 'inset(0 0   0% 0)', opacity: 1 }
      ],
      { duration: 420, easing: 'cubic-bezier(.22,.9,.24,1)', fill: 'both' }
    );

    this.panelCurtainAnim.finished.then(() => {
      if (!this.titleChipEl) return;
      this.titleChipEl.textContent = this.currentHUDText || '';
      this.headerEl.classList.add('visible');
      if (this.headerFadeAnim) this.headerFadeAnim.cancel();
      this.headerFadeAnim = this.headerEl.animate(
        [
          { opacity: 0, transform: 'translateX(-50%) translateY(-6px)' },
          { opacity: 1, transform: 'translateX(-50%) translateY(0)' }
        ],
        { duration: 180, easing: 'ease-out', fill: 'both' }
      );
    }).catch(() => {});
  }

  collapsePanel() {
    if (!this.panelOpen) return;
    this.panelOpen = false;

    this.headerEl.classList.remove('visible');
    if (this.headerFadeAnim) this.headerFadeAnim.cancel();
    this.headerFadeAnim = this.headerEl.animate(
      [
        { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
        { opacity: 0, transform: 'translateX(-50%) translateY(-6px)' }
      ],
      { duration: 120, easing: 'ease-in', fill: 'forwards' }
    );

    if (this.panelCurtainAnim) this.panelCurtainAnim.cancel();
    const closeAnim = this.panelEl.animate(
      [
        { clipPath: 'inset(0 0   0% 0)', opacity: 1 },
        { clipPath: 'inset(0 0 100% 0)', opacity: 1 }
      ],
      { duration: 260, easing: 'ease-in', fill: 'forwards' }
    );

    const rebuildHUD = () => {
      this.panelEl.style.pointerEvents = 'none';
      this._unlockControls();
      this._ensureHUD();
      const textToRestore = this.currentHUDText;
      requestAnimationFrame(() => {
        if (textToRestore) {
          this.showHUD(textToRestore);
        }
      });
    };

    closeAnim.finished.then(rebuildHUD).catch(rebuildHUD);
  }

  destroyHUD() {
    try { this.containerAnim?.cancel(); } catch (e) {}
    try { this.textAnim?.cancel(); } catch (e) {}
    this.containerAnim = null;
    this.textAnim = null;

    this.disableHUDInteractions();

    const wrap = document.getElementById('poiHUDWrap');
    if (wrap && wrap.parentNode) {
      wrap.parentNode.removeChild(wrap);
    }

    this.hudEl = null;
    this.hudLabelEl = null;
    this.hudPresent = false;
    this.wantOpen = false;
  }

  _ensureHUD() {
    if (this.hudPresent) return;
    this._createHUD();
  }

  _createHUD() {
    const existing = document.getElementById('poiHUDWrap');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    const wrap = document.createElement('div');
    wrap.id = 'poiHUDWrap';
    document.body.appendChild(wrap);

    this.hudEl = document.createElement('div');
    this.hudEl.id = 'poiHUD';

    this.hudLabelEl = document.createElement('span');
    this.hudLabelEl.className = 'hud-text';
    this.hudEl.appendChild(this.hudLabelEl);

    wrap.appendChild(this.hudEl);

    const revealMs = ms(getCSS('--reveal-dur')) || 600;
    const textMs = ms(getCSS('--text-dur')) || 350;

    this.containerAnim = this.hudEl.animate(
      [
        { transform: 'scaleY(0) scaleX(0.1)', opacity: 0, offset: 0, composite: 'replace' },
        { transform: 'scaleY(1) scaleX(0.1)', opacity: 1, offset: 0.5, composite: 'replace' },
        { transform: 'scaleY(1) scaleX(1.0)', opacity: 1, offset: 1, composite: 'replace' }
      ],
      { duration: revealMs, easing: 'ease-out', fill: 'both' }
    );
    this.containerAnim.pause();
    this.containerAnim.currentTime = 0;

    this.textAnim = this.hudLabelEl.animate(
      [
        { opacity: 0, filter: 'blur(2px)' },
        { opacity: 1, filter: 'blur(0)' }
      ],
      { duration: textMs, easing: 'ease', fill: 'both' }
    );
    this.textAnim.pause();
    this.textAnim.currentTime = 0;

    this.hudPresent = true;
  }

  _createInfoPanel() {
    this.panelEl = document.createElement('div');
    this.panelEl.id = 'poiPanel';
    this.panelContentEl = document.createElement('div');
    this.panelContentEl.className = 'panel-content';
    this.panelEl.appendChild(this.panelContentEl);
    document.body.appendChild(this.panelEl);

    this.headerEl = document.createElement('div');
    this.headerEl.id = 'poiPanelHeader';

    this.titleChipEl = document.createElement('div');
    this.titleChipEl.className = 'title-chip';
    this.headerEl.appendChild(this.titleChipEl);

    this.closeFloatBtn = document.createElement('button');
    this.closeFloatBtn.className = 'close-btn';
    this.closeFloatBtn.textContent = '✕';
    this.closeFloatBtn.addEventListener('click', () => this.collapsePanel());
    this.headerEl.appendChild(this.closeFloatBtn);

    document.body.appendChild(this.headerEl);

    addEventListener('keydown', this._handleEscape);
  }

  _togglePanelIfAny() {
    if (this.panelOpen) this.collapsePanel();
    else this.expandPanel();
  }

  _handleEscape(event) {
    if (event.key === 'Escape' && this.panelOpen) {
      this.collapsePanel();
    }
  }

  _lockControls() {
    this.controlsEnabled = false;
    this.inputManager?.disable();
  }

  _unlockControls() {
    this.controlsEnabled = true;
    this.inputManager?.enable();
  }
}
