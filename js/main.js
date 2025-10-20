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
  scene.background = new THREE.Color(0x87ceeb); // sky blue

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
    new THREE.MeshLambertMaterial({ color: 0xffd24d })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Create your train instance
  train = new Train(0xff0000);

  // Create some POIs
  const firstStop = new POI(10, "First Stop");
  const secondStop = new POI(0, "Second Stop");
  
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
    this.building = new Building(trackX, -5, 3, 3, 5, 0x8B4513);
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
let hudEl;

function createHUD() {
  hudEl = document.createElement('div');
  hudEl.id = 'poiHUD';
  document.body.appendChild(hudEl);
}

function updateHUD(trainX) {
  let closest = null;
  let closestDist = Infinity;
  for (const poi of poiList) {
    const d = Math.abs(poi.mesh.position.x - trainX);
    if (d < closestDist) { closestDist = d; closest = poi; }
  }

  const threshold = 2.5;
  if (closestDist < threshold) {
    hudEl.textContent = closest.name;
    hudEl.classList.add('visible');

  } else {
    hudEl.classList.remove('visible');
  }
}


// start
init();


// Helpers
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function approach(value, target, delta) {
  // move value toward target by up to delta, without overshoot
  if (value < target) return Math.min(value + delta, target);
  if (value > target) return Math.max(value - delta, target);
  return value;
}
