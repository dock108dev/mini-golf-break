import * as THREE from 'three';

/**
 * Manages visual effects like particle bursts, trails, and celebration effects.
 */
export class VisualEffectsManager {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.effects = [];
    this.ballTrail = null;
    this.trailPositions = [];
    this.maxTrailLength = 20;
  }

  /**
   * Initializes the manager (if needed for complex setup).
   */
  init() {}

  /**
   * Creates a particle burst effect at the specified position
   * @private
   * @param {THREE.Vector3} position - Position for the effect
   * @param {Object} options - Configuration options
   * @returns {Object} Particle system object
   */
  createParticleBurst(position, options = {}) {
    const {
      particleCount = 30,
      color = 0xff4444,
      size = 0.15,
      speed = 3,
      lifetime = 1000,
      spread = Math.PI
    } = options;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const theta = Math.random() * spread;
      const phi = Math.random() * Math.PI * 2;
      velocities.push(
        new THREE.Vector3(
          Math.sin(theta) * Math.cos(phi) * speed,
          Math.cos(theta) * speed + Math.random() * 2,
          Math.sin(theta) * Math.sin(phi) * speed
        )
      );
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 1,
      sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);

    return {
      mesh: particles,
      velocities,
      startTime: Date.now(),
      lifetime,
      update: dt => {
        const age = (Date.now() - this.startTime) / this.lifetime;
        if (age > 1) {
          return true;
        }

        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < velocities.length; i++) {
          positions[i * 3] += velocities[i].x * dt;
          positions[i * 3 + 1] += velocities[i].y * dt - 9.8 * dt * dt * 0.5;
          positions[i * 3 + 2] += velocities[i].z * dt;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.material.opacity = Math.max(0, 1 - age);

        return age >= 1;
      }
    };
  }

  /**
   * Creates a ball trail effect
   * @private
   * @param {THREE.Vector3} position - Current ball position
   */
  createBallTrail(position) {
    if (!this.ballTrail) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.5,
        linewidth: 2
      });

      this.ballTrail = new THREE.Line(geometry, material);
      this.scene.add(this.ballTrail);
    }

    this.trailPositions.push(position.clone());
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.shift();
    }

    const positions = new Float32Array(this.trailPositions.length * 3);
    this.trailPositions.forEach((pos, i) => {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y + 0.1;
      positions[i * 3 + 2] = pos.z;
    });

    this.ballTrail.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.ballTrail.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Triggers a visual effect for hole rejection.
   * @param {THREE.Vector3} position - The world position where the effect should occur.
   */
  triggerRejectionEffect(position) {
    if (!this.scene) {
      return;
    }

    const effect = this.createParticleBurst(position, {
      color: 0xff0000,
      particleCount: 20,
      speed: 2,
      lifetime: 800
    });

    this.effects.push(effect);
  }

  /**
   * Triggers a celebration effect for hole completion
   * @param {THREE.Vector3} position - The world position where the effect should occur
   */
  triggerHoleCompleteEffect(position) {
    if (!this.scene) {
      return;
    }

    const colors = [0xffff00, 0x00ff00, 0x00ffff, 0xff00ff];
    colors.forEach((color, i) => {
      setTimeout(() => {
        const effect = this.createParticleBurst(position, {
          color,
          particleCount: 40,
          speed: 4,
          lifetime: 1500,
          spread: Math.PI * 0.5
        });
        this.effects.push(effect);
      }, i * 100);
    });
  }

  /**
   * Triggers a hole-in-one celebration effect
   * @param {THREE.Vector3} position - The world position where the effect should occur
   */
  triggerHoleInOneEffect(position) {
    if (!this.scene) {
      return;
    }

    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const effect = this.createParticleBurst(position, {
          color: 0xffd700,
          particleCount: 60,
          speed: 5,
          lifetime: 2000,
          size: 0.25
        });
        this.effects.push(effect);
      }, i * 200);
    }
  }

  /**
   * Updates ball trail based on current ball position
   * @param {THREE.Vector3} ballPosition - Current ball position
   * @param {number} ballSpeed - Current ball speed
   */
  updateBallTrail(ballPosition, ballSpeed) {
    if (ballSpeed > 1) {
      this.createBallTrail(ballPosition);
    } else if (this.ballTrail && this.trailPositions.length > 0) {
      this.trailPositions = [];
      this.ballTrail.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(0), 3)
      );
    }
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

    this.trailPositions = [];
    if (this.ballTrail) {
      this.ballTrail.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(0), 3)
      );
    }
  }

  /**
   * Updates active effects (e.g., particle animations).
   * @param {number} dt - Delta time.
   */
  update(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      const finished = effect.update(dt);

      if (finished) {
        this.scene.remove(effect.mesh);
        if (effect.mesh.geometry) {
          effect.mesh.geometry.dispose();
        }
        if (effect.mesh.material) {
          effect.mesh.material.dispose();
        }
        this.effects.splice(i, 1);
      }
    }
  }

  /**
   * Cleans up resources used by the manager.
   */
  cleanup() {
    this.effects.forEach(effect => {
      if (effect.mesh) {
        this.scene.remove(effect.mesh);
        if (effect.mesh.geometry) {
          effect.mesh.geometry.dispose();
        }
        if (effect.mesh.material) {
          effect.mesh.material.dispose();
        }
      }
    });

    if (this.ballTrail) {
      this.scene.remove(this.ballTrail);
      if (this.ballTrail.geometry) {
        this.ballTrail.geometry.dispose();
      }
      if (this.ballTrail.material) {
        this.ballTrail.material.dispose();
      }
      this.ballTrail = null;
    }

    this.effects = [];
    this.trailPositions = [];
  }
}
