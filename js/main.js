// Import Three.js (ES-module form)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

let scene, camera, renderer, ground;
let train;
const keys = {};
const clock = new THREE.Clock(); 
const groundDepth = 50;
const groundWidth = 50;
let poiList = [];

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
    // Input: -1, 0, or +1
    const left  = keys.KeyA || keys.ArrowLeft  ? 1 : 0;
    const right = keys.KeyD || keys.ArrowRight ? 1 : 0;
    const input = right - left;

    if (input !== 0) {
      // If input is opposite the current motion, apply stronger braking
      const acceleratingAgainstMotion = Math.sign(this.v) !== 0 && Math.sign(input) !== Math.sign(this.v);
      const a = acceleratingAgainstMotion ? this.brakeAccel : this.accel;
      this.v += input * a * dt;
    } else {
      // No input: coast toward zero at a fixed decel rate
      this.v = approach(this.v, 0, this.coastDecel * dt);
    }

    // Clamp speed
    this.v = clamp(this.v, -this.maxSpeed, this.maxSpeed);

    // Integrate position
    this.mesh.position.x += this.v * dt;
    if (this.mesh.position.x > groundWidth / 2) this.mesh.position.x = -groundWidth / 2;
    if (this.mesh.position.x < -groundWidth / 2) this.mesh.position.x = groundWidth / 2;
  
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
    this.radius = .8;
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
      this.cooldown = 0.5; // prevent machine-gunning the effect
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

function collapseContainer() {
  containerAnim.playbackRate = -1;
  containerAnim.play();
  containerAnim.finished.then(() => {
    disableHUDInteractions();
  }).catch(() => {
    disableHUDInteractions();
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
  hudEl.classList.add('expanded');
  panelEl.classList.add('open');
  panelOpen = true;
}
function collapsePanel() {
  panelEl.classList.remove('open');
  hudEl.classList.remove('expanded');
  panelOpen = false;
}


// -- INFO PANEL --
let panelEl, panelContentEl, panelOpen = false;

function createInfoPanel() {
  panelEl = document.createElement('div');
  panelEl.id = 'poiPanel';

  const closeBtn = document.createElement('div');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => collapsePanel());

  panelContentEl = document.createElement('div');
  panelContentEl.className = 'panel-content';

  panelEl.appendChild(closeBtn);
  panelEl.appendChild(panelContentEl);
  document.body.appendChild(panelEl);

  // optional: Esc closes panel
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && panelOpen) collapsePanel();
  });
}

// update HUD based on train position
const showThreshold = 0.8;
const hideThreshold = 1.0;

function updateHUD(trainX) {
  if (!containerAnim || !textAnim) return; // animations not ready yet

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