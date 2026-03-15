import { debug } from '../utils/debug';
import * as THREE from 'three';

/**
 * Manages visual effects like particle bursts.
 */
export class VisualEffectsManager {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.effects = [];
  }

  init() {
    // No setup needed
  }

  /**
   * Triggers a visual effect for hole rejection.
   * @param {THREE.Vector3} position - The world position where the effect should occur.
   */
  triggerRejectionEffect(position) {
    if (!this.scene) {
      return;
    }

    const particleCount = 40;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      // Random red/orange colors
      colors[i * 3] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 1] = Math.random() * 0.4;
      colors[i * 3 + 2] = 0;

      // Random outward velocity
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      ));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);

    this.effects.push({
      points,
      velocities,
      age: 0,
      lifetime: 1.0
    });
  }

  /**
   * Resets any visual effects applied to the ball.
   * @param {Ball} ball - The ball object.
   */
  resetBallVisuals(ball) {
    if (ball && ball.mesh && ball.defaultMaterial) {
      ball.mesh.material = ball.defaultMaterial;
      ball.mesh.scale.set(1, 1, 1);
    }
  }

  /**
   * Updates active effects.
   * @param {number} dt - Delta time or ball reference (ignored if not a number).
   */
  update(dt) {
    // dt might be a ball reference from GameLoopManager, handle gracefully
    if (typeof dt !== 'number') {
      dt = 0.016;
    }

    const gravity = -9.81;

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.age += dt;

      if (effect.age >= effect.lifetime) {
        this.scene.remove(effect.points);
        effect.points.geometry.dispose();
        effect.points.material.dispose();
        this.effects.splice(i, 1);
        continue;
      }

      // Update positions
      const posAttr = effect.points.geometry.getAttribute('position');
      const positionsArray = posAttr.array;

      for (let j = 0; j < effect.velocities.length; j++) {
        effect.velocities[j].y += gravity * dt;
        positionsArray[j * 3] += effect.velocities[j].x * dt;
        positionsArray[j * 3 + 1] += effect.velocities[j].y * dt;
        positionsArray[j * 3 + 2] += effect.velocities[j].z * dt;
      }

      posAttr.needsUpdate = true;

      // Fade opacity
      const progress = effect.age / effect.lifetime;
      effect.points.material.opacity = 1.0 - progress;
    }
  }

  /**
   * Cleans up resources used by the manager.
   */
  cleanup() {
    for (const effect of this.effects) {
      this.scene.remove(effect.points);
      effect.points.geometry.dispose();
      effect.points.material.dispose();
    }
    this.effects = [];
  }
}
