import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { clamp, approach } from '../utils/math.js';

export class Train {
  constructor(color, groundWidth) {
    const bodyGeo = new THREE.BoxGeometry(2, 1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({ color });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.position.y = 0.5;

    this.groundWidth = groundWidth;

    this.v = 0;
    this.maxSpeed = 6;
    this.accel = 3;
    this.brakeAccel = 8;
    this.coastDecel = 5;
  }

  addToScene(scene) {
    scene.add(this.mesh);
  }

  update(dt, axis, controlsEnabled) {
    if (!controlsEnabled) {
      this.v = approach(this.v, 0, (this.brakeAccel + this.coastDecel) * dt);
    } else {
      if (axis !== 0) {
        const acceleratingAgainstMotion = Math.sign(this.v) !== 0 && Math.sign(axis) !== Math.sign(this.v);
        const a = acceleratingAgainstMotion ? this.brakeAccel : this.accel;
        this.v += axis * a * dt;
      } else {
        this.v = approach(this.v, 0, this.coastDecel * dt);
      }
    }

    this.v = clamp(this.v, -this.maxSpeed, this.maxSpeed);
    this.mesh.position.x += this.v * dt;

    const halfWidth = this.groundWidth / 2;
    if (this.mesh.position.x > halfWidth) this.mesh.position.x = -halfWidth;
    if (this.mesh.position.x < -halfWidth) this.mesh.position.x = halfWidth;
  }
}
