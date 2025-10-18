// Import Three.js (ES-module form)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

let scene, camera, renderer, ground;
let train;
let firstStop;
const keys = {};
const clock = new THREE.Clock(); 
const groundDepth = 50;
const groundWidth = 50;

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
    new THREE.MeshLambertMaterial({ color: 0x228b22 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Create your train instance
  train = new Train(0xff0000);
  firstStop = new POI(10);
  scene.add(firstStop.mesh);

  scene.add(train.mesh);

  // Events
  addEventListener('resize', onResize);
  addEventListener('keydown', e => keys[e.code] = true);
  addEventListener('keyup', e => keys[e.code] = false);

  animate();
}

// ---------------- CLASS ----------------
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
  constructor(trackX) {
    const bodyGeo = new THREE.BoxGeometry(.8, .8, .8);
    const color = 0x1d2ba8;
    const bodyMat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.3 });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.position.y = 0.5;
    this.mesh.position.x = trackX;
  }
}


// ---------------- LOOP ----------------
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();   // seconds since last frame
  train.update(dt);              // pass dt

  // Update camera to follow train
  updateCam();

  renderer.render(scene, camera);
}

// ---------------- CAMERA ----------------
function updateCam() {
  const camOffset = new THREE.Vector3(0, 10, 10);
  const targetPos = train.mesh.position.clone().add(camOffset);

  // lerp camera only if train is close, otherwise snap to mask teleporting
  // normalize lerp amount based on distance to edge of groundWidth
  const distance = camera.position.distanceTo(targetPos);

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

// ---------------- START ----------------
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
