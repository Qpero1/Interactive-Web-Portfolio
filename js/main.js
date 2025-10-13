// Import Three.js (ES-module form)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

let scene, camera, renderer;
let train;
const keys = {};
const clock = new THREE.Clock(); 

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
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshLambertMaterial({ color: 0x228b22 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Create your train instance
  train = new Train(0xff0000);
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
  }
}


// ---------------- LOOP ----------------
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();   // seconds since last frame
  train.update(dt);              // pass dt
  
  const camOffset = new THREE.Vector3(0, 10, 10);
  const targetPos = train.mesh.position.clone().add(camOffset);
  camera.position.lerp(targetPos, 0.05);
  camera.lookAt(train.mesh.position);

  renderer.render(scene, camera);
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
