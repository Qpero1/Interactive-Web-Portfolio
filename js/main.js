// Import Three.js (ES-module form)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

let scene, camera, renderer, ground;
let train;
const keys = {};
const clock = new THREE.Clock(); 
const groundDepth = 50;
const groundWidth = 50;
let poiList = [];

let controlsEnabled = true;     // lock/unlock player input
let currentHUDText = '';        // stores the label text while panel is open
let hudRestoreUntil = 0;        // ms timestamp; while in future, HUD updates are ignored
let hudPresent = false;   // do we currently have a bottom HUD in the DOM?


// panel animation handles
let panelCurtainAnim = null;
let headerFadeAnim  = null;

// header elements
let headerEl, titleChipEl, closeFloatBtn;

// ---------------- SETUP ----------------
function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xF0EAD6); // white with light tan: 0xF0EAD6

  // Camera (slightly tilted top-down)
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // Ground
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundWidth, groundDepth),
    new THREE.MeshLambertMaterial({ color: 0xFFF1A9 }) // light tan
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Create your train instance
  train = new Train(0xE55934);

  // Create some POIs
  const firstStop = new POI(10, "First Stop");
  const secondStop = new POI(-10, "Second Stop");
  
  // Add to POI list
  poiList.push(firstStop);
  poiList.push(secondStop);


  // Add objects to scene
  scene.add(secondStop.mesh);
  scene.add(firstStop.mesh);
  scene.add(train.mesh);

  // Events
  addEventListener('resize', onResize);
  addEventListener('keydown', e => keys[e.code] = true);
  addEventListener('keyup', e => keys[e.code] = false);

  createHUD();
  createInfoPanel();
  animate();
}

// ---------------- CLASSES ----------------
class Train {
  constructor(color) {
    const bodyGeo = new THREE.BoxGeometry(2, 1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ color });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.position.y = 0.5;

    // Tweak these to taste (units are "per second" or "per second squared")
    this.v = 0;                 // current velocity along X
    this.maxSpeed = 6;          // units/second
    this.accel = 3;             // hold key to accelerate
    this.brakeAccel = 8;        // stronger when changing direction
    this.coastDecel = 5;        // when no input, slow down at this rate
  }

  update(dt) {
    const left  = keys.KeyA || keys.ArrowLeft  ? 1 : 0;
    const right = keys.KeyD || keys.ArrowRight ? 1 : 0;
    const input = right - left;

    if (!controlsEnabled) {
      // Ignore input and brake to a stop smoothly
      this.v = approach(this.v, 0, (this.brakeAccel + this.coastDecel) * dt);
    } else {
      if (input !== 0) {
        const acceleratingAgainstMotion =
          Math.sign(this.v) !== 0 && Math.sign(input) !== Math.sign(this.v);
        const a = acceleratingAgainstMotion ? this.brakeAccel : this.accel;
        this.v += input * a * dt;
      } else {
        this.v = approach(this.v, 0, this.coastDecel * dt);
      }
    }

    this.v = clamp(this.v, -this.maxSpeed, this.maxSpeed);
    this.mesh.position.x += this.v * dt;

    if (this.mesh.position.x > groundWidth / 2) this.mesh.position.x = -groundWidth / 2;
    if (this.mesh.position.x < -groundWidth / 2) this.mesh.position.x =  groundWidth / 2;
  }
}

class POI {
  constructor(trackX, name) {
    const bodyGeo = new THREE.BoxGeometry(.8, .8, .8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d2ba8, transparent: true, opacity: 0.3 });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.position.set(trackX, 0.5, 0);
    this.name = name;

    // attach a building and remember it
    this.building = new Building(trackX, -5, 3, 3, 5, 0x93C0A4);
    scene.add(this.building.mesh);

    // trigger control
    this._wasInside = false;
    this.radius = .8;  // distance from center to trigger
    this.cooldown = 0;  // seconds until we can pop again
  }

  update(trainX, dt) {
    const dist = Math.abs(this.mesh.position.x - trainX);
    const inside = dist < this.radius;

    // cool down timer
    if (this.cooldown > 0) this.cooldown -= dt;

    // rising edge trigger
    if (inside && !this._wasInside && this.cooldown <= 0) {
      this.building.pop();
      this.cooldown = 5; // prevent machine-gunning the effect
    }

    this._wasInside = inside;

    // advance the building animation
    this.building.update(dt);
  }
}


// Class to create buildings for POIs
class Building {
  constructor(x, z, width, depth, height, color) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({ color });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, height / 2, z);

    // pop animation state
    this.popT = 1;          // 0 -> anim just started, >=1 -> idle
    this.popDur = .67;     // seconds
    this.popAmp = .1;     // how big the first overshoot is (scale 1 + amp)
    this.popDamp = 2;     // higher = dies out faster
    this.popFreq = 1;     // oscillations per second
  }

  pop() {
    this.popT = 0;
  }

  update(dt) {
    if (this.popT < 1) {
      this.popT += dt / this.popDur;
      const t = this.popT;

      // springy scale: 1 + A * e^(-damp*t) * sin(2π f t)
      const s = 1 + this.popAmp * Math.exp(-this.popDamp * t) * Math.sin(2 * Math.PI * this.popFreq * t);
      this.mesh.scale.setScalar(s);

      // stop and reset cleanly near the end
      if (t >= 1) {
        this.mesh.scale.set(1, 1, 1);
        this.popT = 1;
      }
    }
  }
}



// ---------------- LOOP ----------------
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  train.update(dt);

  // update all POIs (this advances building pops)
  for (const poi of poiList) {
    poi.update(train.mesh.position.x, dt);
  }

  updateHUD(train.mesh.position.x);
  updateCam();
  renderer.render(scene, camera);
}



// ---------------- CAMERA ----------------
function updateCam() {
  const camOffset = new THREE.Vector3(0, 10, 10);
  const targetPos = train.mesh.position.clone().add(camOffset);

  // lerp camera only if train is close, otherwise snap to mask teleporting
  // normalize lerp amount based on distance to edge of groundWidth
  // const distance = camera.position.distanceTo(targetPos);

  const groundHalfWidth = groundWidth / 2;
  const distanceToEdge = groundHalfWidth - Math.abs(train.mesh.position.x);
  // lerp amount: .1 when far from edge, smooth to 1 when within affectRange of edge
  const affectRange = 10;
  const lerpAmount = distanceToEdge > affectRange ? 0.01 : 0.01 + (1 - 0.01) * Math.pow(1 - (distanceToEdge / affectRange), 4);


  camera.position.lerp(targetPos, lerpAmount);
  camera.lookAt(train.mesh.position);
}

// ---------------- RESIZE ----------------
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

// --- HUD: one bottom banner ---
let hudEl, hudLabelEl;
let containerAnim, textAnim;
let wantOpen = false;     // target state
let textVisible = false;  // whether text has finished fading in



function createHUD() {
  // wrapper for hover lift
  const wrap = document.createElement('div');
  wrap.id = 'poiHUDWrap';
  document.body.appendChild(wrap);

  // actual HUD
  hudEl = document.createElement('div');
  hudEl.id = 'poiHUD';

  hudLabelEl = document.createElement('span');
  hudLabelEl.className = 'hud-text';
  hudEl.appendChild(hudLabelEl);

  wrap.appendChild(hudEl);

  // === INIT WAAPI ANIMATIONS HERE ===
  const revealMs = ms(getCSS('--reveal-dur')) || 600;
  const textMs   = ms(getCSS('--text-dur'))   || 350;

  // Container: expand Y (0->50%) then X (50%->100%)
  containerAnim = hudEl.animate(
    [
      { transform: 'scaleY(0) scaleX(0.1)', opacity: 0, offset: 0,    composite: 'replace' },
      { transform: 'scaleY(1) scaleX(0.1)', opacity: 1, offset: 0.5, composite: 'replace' },
      { transform: 'scaleY(1) scaleX(1.0)', opacity: 1, offset: 1,   composite: 'replace' }
    ],
    { duration: revealMs, easing: 'ease-out', fill: 'both' }
  );
  containerAnim.pause();
  containerAnim.currentTime = 0;

  // Text: fade/blur
  textAnim = hudLabelEl.animate(
    [
      { opacity: 0, filter: 'blur(2px)' },
      { opacity: 1, filter: 'blur(0)' }
    ],
    { duration: textMs, easing: 'ease', fill: 'both' }
  );
  textAnim.pause();
  textAnim.currentTime = 0;
  hudPresent = true;
}


function showHUD(text) {
  wantOpen = true;                     // <-- set target state
  hudLabelEl.textContent = text;

  // open container from current progress
  containerAnim.playbackRate = 1;
  containerAnim.play();

  containerAnim.finished.then(() => {
    if (!wantOpen) return;             // user left during open
    if (textAnim.playbackRate < 0 || textAnim.currentTime === 0) {
      textAnim.playbackRate = 1;
      textAnim.play();
      textAnim.finished.catch(() => {});
    }
    // update panel content (so click uses fresh text)
    panelContentEl.innerHTML = `
      <h3 style="margin:0 0 8px 0;font-size:18px;font-weight:600;">${text}</h3>
      <p style="margin:0;opacity:.9;">Info about ${text} goes here.</p>
    `;
    enableHUDInteractions();
  }).catch(() => {});
}

function hideHUD() {
  if (!wantOpen) return;               // already targeting closed
  wantOpen = false;                    // <-- set target state

  if (panelOpen) collapsePanel();

  // reverse text from wherever it is
  if (textAnim.currentTime > 0) {
    textAnim.playbackRate = -1;
    textAnim.play();
    textAnim.finished.then(() => collapseContainer()).catch(() => collapseContainer());
  } else {
    collapseContainer();
  }
}

function destroyHUD() {
  try { containerAnim?.cancel(); } catch {}
  try { textAnim?.cancel(); } catch {}
  containerAnim = null;
  textAnim = null;

  if (_hudClickBound && hudEl) {
    hudEl.removeEventListener('click', togglePanelIfAny);
    _hudClickBound = false;
  }

  const wrap = document.getElementById('poiHUDWrap');
  if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);

  hudEl = null;
  hudLabelEl = null;
  hudPresent = false;
  wantOpen = false; // nothing to show while removed
}

function collapseContainer() {
  containerAnim.playbackRate = -1;
  containerAnim.play();
  closeAnim.finished.then(() => {
    panelEl.style.pointerEvents = 'none';

    // remove the old HUD entirely
    destroyHUD();

    // recreate HUD fresh and replay the original appear sequence
    createHUD();

    // force the small pause until the container has expanded,
    // then let showHUD() run the container + delayed text anims
    const textToRestore = currentHUDText; // stash
    requestAnimationFrame(() => {
      // createHUD set up animations at time 0 and paused
      // showHUD sets wantOpen=true and plays container, then fades text after
      showHUD(textToRestore);
    });

    controlsEnabled = true; // unlock movement
  }).catch(() => {
    // same as success path
    panelEl.style.pointerEvents = 'none';
    destroyHUD();
    createHUD();
    requestAnimationFrame(() => showHUD(currentHUDText));
    controlsEnabled = true;
  });
}

let _hudClickBound = false;

function enableHUDInteractions() {
  document.getElementById('poiHUDWrap')?.classList.add('interactive');
  if (!_hudClickBound) {
    hudEl.addEventListener('click', togglePanelIfAny);
    _hudClickBound = true;
  }
}
function disableHUDInteractions() {
  document.getElementById('poiHUDWrap')?.classList.remove('interactive');
  if (_hudClickBound) {
    hudEl.removeEventListener('click', togglePanelIfAny);
    _hudClickBound = false;
  }
}

function togglePanelIfAny() {
  if (panelOpen) collapsePanel(); else expandPanel();
}

function expandPanel() {
  if (panelOpen) return;
  panelOpen = true;
  controlsEnabled = false;

  // capture current label text, then nuke the HUD
  currentHUDText = hudLabelEl ? hudLabelEl.textContent : currentHUDText;
  destroyHUD(); // removes the bottom block entirely

  // make panel receptive and run curtain as you already do
  panelEl.style.opacity = '1';
  panelEl.style.pointerEvents = 'auto';

  if (panelCurtainAnim) panelCurtainAnim.cancel();
  panelCurtainAnim = panelEl.animate(
    [
      { clipPath: 'inset(0 0 100% 0)', opacity: 1 },
      { clipPath: 'inset(0 0   0% 0)', opacity: 1 }
    ],
    { duration: 420, easing: 'cubic-bezier(.22,.9,.24,1)', fill: 'both' }
  );

  panelCurtainAnim.finished.then(() => {
    titleChipEl.textContent = currentHUDText || '';
    headerEl.classList.add('visible');
    if (headerFadeAnim) headerFadeAnim.cancel();
    headerFadeAnim = headerEl.animate(
      [
        { opacity: 0, transform: 'translateX(-50%) translateY(-6px)' },
        { opacity: 1, transform: 'translateX(-50%) translateY(0)' }
      ],
      { duration: 180, easing: 'ease-out', fill: 'both' }
    );
  }).catch(() => {});
}

function collapsePanel() {
  if (!panelOpen) return;
  panelOpen = false;

  // Hide header first
  headerEl.classList.remove('visible');
  if (headerFadeAnim) headerFadeAnim.cancel();
  headerFadeAnim = headerEl.animate(
    [
      { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
      { opacity: 0, transform: 'translateX(-50%) translateY(-6px)' }
    ],
    { duration: 120, easing: 'ease-in', fill: 'forwards' }
  );

  // Curtain close: 100% -> 0% height
  if (panelCurtainAnim) panelCurtainAnim.cancel();
  const closeAnim = panelEl.animate(
    [
      { clipPath: 'inset(0 0   0% 0)', opacity: 1 },
      { clipPath: 'inset(0 0 100% 0)', opacity: 1 }
    ],
    { duration: 260, easing: 'ease-in', fill: 'forwards' }
  );

  closeAnim.finished.then(() => {
    panelEl.style.pointerEvents = 'none';

    // fully rebuild the bottom HUD fresh
    createHUD();

    // replay original appear: container expand (Y then X), then text fade
    const textToRestore = currentHUDText;
    requestAnimationFrame(() => {
      showHUD(textToRestore); // this already plays the container, then the delayed text animation
    });

    controlsEnabled = true;
  }).catch(() => {
    panelEl.style.pointerEvents = 'none';
    createHUD();
    requestAnimationFrame(() => showHUD(currentHUDText));
    controlsEnabled = true;
  });
}


// -- INFO PANEL --
let panelEl, panelContentEl, panelOpen = false;

function createInfoPanel() {
  // Panel body
  panelEl = document.createElement('div');
  panelEl.id = 'poiPanel';
  panelContentEl = document.createElement('div');
  panelContentEl.className = 'panel-content';
  panelEl.appendChild(panelContentEl);
  document.body.appendChild(panelEl);

  // Floating header wrapper (fixed, above panel)
  headerEl = document.createElement('div');
  headerEl.id = 'poiPanelHeader';

  // Title chip (left)
  titleChipEl = document.createElement('div');
  titleChipEl.className = 'title-chip';
  headerEl.appendChild(titleChipEl);

  // Close button (right)
  closeFloatBtn = document.createElement('button');
  closeFloatBtn.className = 'close-btn';
  closeFloatBtn.textContent = '✕';
  closeFloatBtn.addEventListener('click', () => collapsePanel());
  headerEl.appendChild(closeFloatBtn);

  document.body.appendChild(headerEl);

  // Esc closes panel
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && panelOpen) collapsePanel();
  });
}

// update HUD based on train position
const showThreshold = 0.8;
const hideThreshold = 1.0;

function updateHUD(trainX) {
    if (!containerAnim || !textAnim) return;
    if (!hudPresent) return;  // nothing to update if HUD is removed
    if (panelOpen || performance.now() < hudRestoreUntil) return;

  let closest = null, closestDist = Infinity;
  for (const poi of poiList) {
    const d = Math.abs(poi.mesh.position.x - trainX);
    if (d < closestDist) { closestDist = d; closest = poi; }
  }

  if (!closest) { if (wantOpen) hideHUD(); return; }

  if (!wantOpen && closestDist < showThreshold) {
    showHUD(closest.name);
  } else if (wantOpen) {
    if (closestDist > hideThreshold) hideHUD();
    else if (closest.name !== hudLabelEl.textContent) showHUD(closest.name);
  }
}

// start //
init();


// Helpers //
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// for smooth value approach (to avoid overshoot)
function approach(value, target, delta) {
  // move value toward target by up to delta, without overshoot
  if (value < target) return Math.min(value + delta, target);
  if (value > target) return Math.max(value - delta, target);
  return value;
}

// for hud timing
function getCSS(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName); }
function ms(str) {
  const t = String(str).trim();
  if (!t) return 0;
  return t.endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000;
}