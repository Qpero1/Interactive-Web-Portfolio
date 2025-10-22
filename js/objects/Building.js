import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

export class Building {
  constructor(x, z, width, depth, height, color) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({ color });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, height / 2, z);

    this.popT = 1;
    this.popDur = 0.67;
    this.popAmp = 0.1;
    this.popDamp = 2;
    this.popFreq = 1;
  }

  pop() {
    this.popT = 0;
  }

  update(dt) {
    if (this.popT < 1) {
      this.popT += dt / this.popDur;
      const t = this.popT;
      const s = 1 + this.popAmp * Math.exp(-this.popDamp * t) * Math.sin(2 * Math.PI * this.popFreq * t);
      this.mesh.scale.setScalar(s);

      if (t >= 1) {
        this.mesh.scale.set(1, 1, 1);
        this.popT = 1;
      }
    }
  }
}
