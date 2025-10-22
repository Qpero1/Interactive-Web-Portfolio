import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { Building } from './Building.js';

export class POI {
  constructor(trackX, name, scene) {
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d2ba8, transparent: true, opacity: 0.3 });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.position.set(trackX, 0.5, 0);

    this.name = name;

    this.building = new Building(trackX, -5, 3, 3, 5, 0x93C0A4);
    scene.add(this.building.mesh);

    this._wasInside = false;
    this.radius = 0.8;
    this.cooldown = 0;
  }

  update(trainX, dt) {
    const dist = Math.abs(this.mesh.position.x - trainX);
    const inside = dist < this.radius;

    if (this.cooldown > 0) this.cooldown -= dt;

    if (inside && !this._wasInside && this.cooldown <= 0) {
      this.building.pop();
      this.cooldown = 5;
    }

    this._wasInside = inside;
    this.building.update(dt);
  }
}
