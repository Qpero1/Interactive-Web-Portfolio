import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { InputManager } from './InputManager.js';
import { Train } from '../objects/Train.js';
import { POI } from '../objects/POI.js';
import { HUDPanelManager } from '../ui/HUDPanelManager.js';

export class Experience {
  constructor() {
    this.animate = this.animate.bind(this);
    this.onResize = this.onResize.bind(this);

    this.clock = new THREE.Clock();
    this.groundDepth = 50;
    this.groundWidth = 50;

    this._initScene();
    this._initCamera();
    this._initRenderer();
    this._initLights();
    this._initGround();

    this.input = new InputManager();
    this.ui = new HUDPanelManager({
      inputManager: this.input,
      showThreshold: 0.8,
      hideThreshold: 1.0
    });

    this._initTrain();
    this._initPOIs();

    addEventListener('resize', this.onResize);

    this.animate();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xF0EAD6);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    this.camera.position.set(0, 10, 10);
    this.camera.lookAt(0, 0, 0);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    document.body.appendChild(this.renderer.domElement);
  }

  _initLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);
  }

  _initGround() {
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.groundWidth, this.groundDepth),
      new THREE.MeshLambertMaterial({ color: 0xFFF1A9 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);
  }

  _initTrain() {
    this.train = new Train(0xE55934, this.groundWidth);
    this.train.addToScene(this.scene);
  }

  _initPOIs() {
    this.pois = [];

    const firstStop = new POI(10, 'First Stop', this.scene);
    const secondStop = new POI(-10, 'Second Stop', this.scene);

    this.pois.push(firstStop, secondStop);

    for (const poi of this.pois) {
      this.scene.add(poi.mesh);
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();

    const axis = this.input.getHorizontalAxis();
    this.train.update(dt, axis, this.ui.areControlsEnabled());

    for (const poi of this.pois) {
      poi.update(this.train.mesh.position.x, dt);
    }

    this.ui.update(this.train.mesh.position.x, this.pois);
    this._updateCamera();
    this.renderer.render(this.scene, this.camera);
  }

  _updateCamera() {
    const camOffset = new THREE.Vector3(0, 10, 10);
    const targetPos = this.train.mesh.position.clone().add(camOffset);

    const groundHalfWidth = this.groundWidth / 2;
    const distanceToEdge = groundHalfWidth - Math.abs(this.train.mesh.position.x);
    const affectRange = 10;
    const lerpAmount = distanceToEdge > affectRange
      ? 0.01
      : 0.01 + (1 - 0.01) * Math.pow(1 - (distanceToEdge / affectRange), 4);

    this.camera.position.lerp(targetPos, lerpAmount);
    this.camera.lookAt(this.train.mesh.position);
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}
