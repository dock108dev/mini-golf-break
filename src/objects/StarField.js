import * as THREE from 'three';

const NEAR_COUNT = 2000;
const MID_COUNT = 3000;
const FAR_COUNT = 5000;
const SPREAD = 1000;

// Parallax scale factors — near layer shifts most (appears closest)
const PARALLAX_NEAR = 0.04;
const PARALLAX_MID = 0.025;
const PARALLAX_FAR = 0.01;

/**
 * Three-layer parallax star field for the space environment backdrop.
 * Near/mid/far layers shift by different amounts relative to camera movement,
 * creating the illusion of depth.
 */
export class StarField {
  constructor(scene) {
    this.scene = scene;
    this._nearLayer = null;
    this._midLayer = null;
    this._farLayer = null;
    this._prevCamX = 0;
    this._prevCamZ = 0;
  }

  /**
   * Create and add the three star layers to the scene.
   */
  init() {
    this._nearLayer = this._createLayer(NEAR_COUNT, 2.5, 0.7);
    this._midLayer = this._createLayer(MID_COUNT, 1.5, 0.5);
    this._farLayer = this._createLayer(FAR_COUNT, 0.8, 0.3);
    this.scene.add(this._nearLayer);
    this.scene.add(this._midLayer);
    this.scene.add(this._farLayer);
  }

  _createLayer(count, size, opacity) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * SPREAD * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size,
      sizeAttenuation: false,
      transparent: true,
      opacity,
      depthWrite: false
    });
    const layer = new THREE.Points(geometry, material);
    layer.userData.type = 'starfield';
    return layer;
  }

  /**
   * Shift each star layer relative to camera movement to produce parallax.
   * @param {THREE.Camera} camera
   */
  update(camera) {
    if (!camera) {
      return;
    }
    const dx = camera.position.x - this._prevCamX;
    const dz = camera.position.z - this._prevCamZ;

    // Camera panned right → layers shift left (near more than far)
    this._nearLayer.position.x -= dx * PARALLAX_NEAR;
    this._nearLayer.position.z -= dz * PARALLAX_NEAR;
    this._midLayer.position.x -= dx * PARALLAX_MID;
    this._midLayer.position.z -= dz * PARALLAX_MID;
    this._farLayer.position.x -= dx * PARALLAX_FAR;
    this._farLayer.position.z -= dz * PARALLAX_FAR;

    this._prevCamX = camera.position.x;
    this._prevCamZ = camera.position.z;
  }

  /**
   * Remove layers from the scene and dispose GPU resources.
   */
  cleanup() {
    for (const layer of [this._nearLayer, this._midLayer, this._farLayer]) {
      if (layer) {
        this.scene.remove(layer);
        layer.geometry.dispose();
        layer.material.dispose();
      }
    }
    this._nearLayer = null;
    this._midLayer = null;
    this._farLayer = null;
  }
}
