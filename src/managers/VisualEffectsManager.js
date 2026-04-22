import * as THREE from 'three';
import { EventTypes } from '../events/EventTypes';

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
    if (!this.game?.eventManager?.subscribe) {
      return;
    }
    this._onBallInHole = data => {
      const pos = this._resolveCupSinkPosition(data);
      if (pos) {
        this.triggerCupSinkEffect(pos);
      }
    };
    this.game.eventManager.subscribe(EventTypes.BALL_IN_HOLE, this._onBallInHole);

    // Chromatic aberration: 1-frame CSS filter on the canvas on ball strike
    this._onBallHit = () => {
      const canvas = this.game?.renderer?.domElement;
      if (!canvas) {
        return;
      }
      canvas.style.filter =
        'drop-shadow(2px 0 0 rgba(255,0,0,0.5)) drop-shadow(-2px 0 0 rgba(0,0,255,0.5))';
      requestAnimationFrame(() => {
        canvas.style.filter = '';
      });
    };
    this.game.eventManager.subscribe(EventTypes.BALL_HIT, this._onBallHit);
  }

  _resolveCupSinkPosition(data) {
    if (data?.cupPosition) {
      return data.cupPosition;
    }
    const holePos = this.game?.course?.currentHole?.holePosition;
    if (holePos) {
      return holePos;
    }
    const p = data?.ballBody?.position;
    if (!p) {
      return null;
    }
    return new THREE.Vector3(p.x, p.y, p.z);
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
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 4
        )
      );
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
   * Triggers a 12-quad particle burst at the cup position when the ball sinks.
   * @param {THREE.Vector3} position - World position of the cup.
   */
  triggerCupSinkEffect(position) {
    if (!this.scene) {
      return;
    }

    const count = 12;
    const meshes = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(0.15, 0.15);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 1.0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(position.x, position.y, position.z);
      this.scene.add(mesh);
      meshes.push(mesh);

      const angle = (i / count) * Math.PI * 2;
      const speed = 1 + Math.random();
      velocities.push(
        new THREE.Vector3(Math.cos(angle) * speed, Math.random() * 2 + 0.5, Math.sin(angle) * speed)
      );
    }

    this.effects.push({
      meshes,
      velocities,
      age: 0,
      lifetime: 0.5
    });

    // Brief camera zoom to cup when controller supports it
    this.game?.cameraController?.zoomToPosition?.(position, 0.3);
  }

  /**
   * Fires a 25-sprite particle burst to celebrate a new top-3 high score.
   * Sprites use a rainbow palette and burst outward over 1.5 s.
   */
  triggerHighScoreCelebration() {
    if (!this.scene) {
      return;
    }

    const count = 25;
    const palette = [
      0xff4444, 0xffaa00, 0xffff00, 0x44ff44, 0x44aaff, 0xaa44ff, 0xff44aa, 0xffd700
    ];
    const meshes = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(0.2, 0.2);
      const mat = new THREE.MeshBasicMaterial({
        color: palette[i % palette.length],
        transparent: true,
        opacity: 1.0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 4,
        1 + Math.random() * 2,
        (Math.random() - 0.5) * 4
      );
      this.scene.add(mesh);
      meshes.push(mesh);

      const angle = (i / count) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      velocities.push(
        new THREE.Vector3(Math.cos(angle) * speed, Math.random() * 4 + 2, Math.sin(angle) * speed)
      );
    }

    this.effects.push({
      meshes,
      velocities,
      age: 0,
      lifetime: 1.5,
      isCelebration: true
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
        this._disposeEffect(effect);
        this.effects.splice(i, 1);
        continue;
      }

      const progress = effect.age / effect.lifetime;

      if (effect.points) {
        // Points-based effect (e.g. rejection burst)
        const posAttr = effect.points.geometry.getAttribute('position');
        const positionsArray = posAttr.array;

        for (let j = 0; j < effect.velocities.length; j++) {
          effect.velocities[j].y += gravity * dt;
          positionsArray[j * 3] += effect.velocities[j].x * dt;
          positionsArray[j * 3 + 1] += effect.velocities[j].y * dt;
          positionsArray[j * 3 + 2] += effect.velocities[j].z * dt;
        }

        posAttr.needsUpdate = true;
        effect.points.material.opacity = 1.0 - progress;
      }

      if (effect.meshes) {
        // Quad-based effect (e.g. cup sink burst)
        for (let j = 0; j < effect.meshes.length; j++) {
          effect.velocities[j].y += gravity * dt;
          effect.meshes[j].position.x += effect.velocities[j].x * dt;
          effect.meshes[j].position.y += effect.velocities[j].y * dt;
          effect.meshes[j].position.z += effect.velocities[j].z * dt;
          effect.meshes[j].material.opacity = 1.0 - progress;
        }
      }
    }
  }

  _disposeEffect(effect) {
    if (effect.points) {
      this.scene.remove(effect.points);
      effect.points.geometry.dispose?.();
      effect.points.material.dispose?.();
    }
    if (effect.meshes) {
      for (const mesh of effect.meshes) {
        this.scene.remove(mesh);
        mesh.geometry.dispose?.();
        mesh.material.dispose?.();
      }
    }
  }

  /**
   * Cleans up resources used by the manager.
   */
  cleanup() {
    if (this._onBallInHole && this.game?.eventManager?.unsubscribe) {
      this.game.eventManager.unsubscribe(EventTypes.BALL_IN_HOLE, this._onBallInHole);
      this._onBallInHole = null;
    }
    if (this._onBallHit && this.game?.eventManager?.unsubscribe) {
      this.game.eventManager.unsubscribe(EventTypes.BALL_HIT, this._onBallHit);
      this._onBallHit = null;
    }
    for (const effect of this.effects) {
      this._disposeEffect(effect);
    }
    this.effects = [];
  }
}
