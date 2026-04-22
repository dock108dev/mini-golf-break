import * as THREE from 'three';
import { MATERIAL_PALETTE } from '../themes/palette';

/**
 * SpaceDecorations - Adds cosmic background elements to enhance the space theme
 */
export class SpaceDecorations {
  constructor(scene) {
    this.scene = scene;
    this.decorations = [];
    this._asteroids = [];
  }

  /**
   * Initialize all space decorations
   */
  init() {
    this.addFloatingPlanets();
    this.addDistantNebula();
    this.addSpaceDebris();
    this.addShootingStars();
    this._addAsteroidDrift();
  }

  /**
   * Add floating planets in the background
   */
  addFloatingPlanets() {
    // Earth-like planet
    const earthGeometry = new THREE.SphereGeometry(5, 32, 32);
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x1a2266,
      roughness: MATERIAL_PALETTE.background.planet.roughness,
      emissive: MATERIAL_PALETTE.background.planet.emissive,
      emissiveIntensity: MATERIAL_PALETTE.background.planet.emissiveIntensity
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.position.set(-30, 15, -50);
    earth.userData.type = 'decoration';
    earth.userData.permanent = true;
    this.scene.add(earth);
    this.decorations.push(earth);

    // Mars-like planet
    const marsGeometry = new THREE.SphereGeometry(3, 32, 32);
    const marsMaterial = new THREE.MeshPhongMaterial({
      color: 0x883333,
      emissive: MATERIAL_PALETTE.background.planet.emissive,
      emissiveIntensity: MATERIAL_PALETTE.background.planet.emissiveIntensity
    });
    const mars = new THREE.Mesh(marsGeometry, marsMaterial);
    mars.position.set(40, 10, -40);
    mars.userData.type = 'decoration';
    mars.userData.permanent = true;
    this.scene.add(mars);
    this.decorations.push(mars);

    // Saturn with rings
    const saturnGeometry = new THREE.SphereGeometry(6, 32, 32);
    const saturnMaterial = new THREE.MeshPhongMaterial({
      color: 0x886644,
      emissive: MATERIAL_PALETTE.background.planet.emissive,
      emissiveIntensity: MATERIAL_PALETTE.background.planet.emissiveIntensity
    });
    const saturn = new THREE.Mesh(saturnGeometry, saturnMaterial);
    saturn.position.set(0, 20, -60);

    // Saturn's rings
    const ringGeometry = new THREE.RingGeometry(8, 12, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x887755,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35
    });
    const rings = new THREE.Mesh(ringGeometry, ringMaterial);
    rings.rotation.x = Math.PI / 2;
    saturn.add(rings);

    saturn.userData.type = 'decoration';
    saturn.userData.permanent = true;
    this.scene.add(saturn);
    this.decorations.push(saturn);
  }

  /**
   * Add nebula clouds in the distance
   */
  addDistantNebula() {
    const nebulaGeometry = new THREE.PlaneGeometry(100, 50);
    const nebulaMaterial = new THREE.MeshBasicMaterial({
      color: 0x332266,
      transparent: true,
      opacity: MATERIAL_PALETTE.background.nebula.opacity,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    const nebula1 = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
    nebula1.position.set(-50, 30, -100);
    nebula1.rotation.y = Math.PI / 4;
    nebula1.userData.type = 'decoration';
    nebula1.userData.nebulaIndex = 0;
    nebula1.userData.permanent = true;
    this.scene.add(nebula1);
    this.decorations.push(nebula1);

    const nebula2Material = new THREE.MeshBasicMaterial({
      color: 0x662233,
      transparent: true,
      opacity: MATERIAL_PALETTE.background.nebula.opacity,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    const nebula2 = new THREE.Mesh(nebulaGeometry, nebula2Material);
    nebula2.position.set(60, 25, -90);
    nebula2.rotation.y = -Math.PI / 3;
    nebula2.userData.type = 'decoration';
    nebula2.userData.nebulaIndex = 1;
    nebula2.userData.permanent = true;
    this.scene.add(nebula2);
    this.decorations.push(nebula2);
  }

  /**
   * Add floating space debris
   */
  addSpaceDebris() {
    const debrisGroup = new THREE.Group();
    debrisGroup.userData.type = 'decoration';
    debrisGroup.userData.permanent = true;

    for (let i = 0; i < 20; i++) {
      const size = Math.random() * 0.5 + 0.2;
      const geometry = new THREE.OctahedronGeometry(size);
      const material = new THREE.MeshPhongMaterial({
        color: 0x555555,
        emissive: MATERIAL_PALETTE.background.debris.emissive,
        emissiveIntensity: MATERIAL_PALETTE.background.debris.emissiveIntensity
      });

      const debris = new THREE.Mesh(geometry, material);
      debris.position.set(
        (Math.random() - 0.5) * 80,
        Math.random() * 20 + 10,
        (Math.random() - 0.5) * 80 - 20
      );
      debris.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      debrisGroup.add(debris);
    }

    this.scene.add(debrisGroup);
    this.decorations.push(debrisGroup);
  }

  /**
   * Add animated shooting stars
   */
  addShootingStars() {
    // This would be animated in the game loop
    const starGeometry = new THREE.ConeGeometry(0.1, 2, 4);
    const starMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1
    });

    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(starGeometry, starMaterial);
      star.position.set(Math.random() * 100 - 50, Math.random() * 20 + 30, -50);
      star.rotation.z = Math.PI / 2;
      star.visible = false; // Will be animated
      star.userData.type = 'shootingStar';
      star.userData.permanent = true;

      this.scene.add(star);
      this.decorations.push(star);
    }
  }

  /**
   * Add 5 slow-drifting asteroid meshes off the playfield. No physics body — purely visual.
   * Each loops across a ±90 unit band so it never intersects the course geometry.
   */
  _addAsteroidDrift() {
    const BAND_MIN = 45;
    const BAND_RANGE = 30;
    const LOOP_BOUND = 90;
    const HEIGHT_MIN = 5;
    const HEIGHT_RANGE = 13;

    for (let i = 0; i < 5; i++) {
      const size = 0.6 + Math.random() * 1.2;
      const geo = new THREE.IcosahedronGeometry(size, 1);
      const mat = new THREE.MeshPhongMaterial({
        color: 0x776655,
        emissive: 0x221100,
        emissiveIntensity: 0.15
      });
      const mesh = new THREE.Mesh(geo, mat);

      // Place off the playfield on alternating sides
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (BAND_MIN + Math.random() * BAND_RANGE);
      const y = HEIGHT_MIN + Math.random() * HEIGHT_RANGE;
      const z = (Math.random() - 0.5) * BAND_MIN * 2;
      mesh.position.set(x, y, z);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      mesh.userData.type = 'asteroid';
      mesh.userData.permanent = true;

      const driftAxis = Math.random() < 0.5 ? 'x' : 'z';
      const driftSpeed = (0.8 + Math.random() * 1.7) * (Math.random() < 0.5 ? 1 : -1);
      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4
      );

      this.scene.add(mesh);
      this.decorations.push(mesh);
      this._asteroids.push({ mesh, driftAxis, driftSpeed, loopBound: LOOP_BOUND, rotSpeed });
    }
  }

  setThemeVariant(theme) {
    if (!theme?.nebula) {
      return;
    }
    this.decorations.forEach(decoration => {
      if (decoration.userData.type !== 'decoration' || !decoration.material) {
        return;
      }
      if (
        decoration.geometry &&
        decoration.geometry.type === 'PlaneGeometry' &&
        decoration.material.blending === THREE.AdditiveBlending
      ) {
        decoration.material.color.set(
          decoration.userData.nebulaIndex === 0 ? theme.nebula.color1 : theme.nebula.color2
        );
      }
    });
  }

  /**
   * Animate decorations (call from game loop)
   */
  update(deltaTime) {
    // Rotate planets
    this.decorations.forEach(decoration => {
      if (decoration.userData.type === 'decoration') {
        // Gentle rotation for planets
        if (decoration.geometry && decoration.geometry.type === 'SphereGeometry') {
          decoration.rotation.y += deltaTime * 0.1;
        }
      }
    });

    // Animate shooting stars
    this.decorations.forEach(decoration => {
      if (decoration.userData.type === 'shootingStar') {
        if (decoration.visible) {
          // Move the shooting star
          decoration.position.x += deltaTime * 40;
          decoration.position.y -= deltaTime * 10;
          // Hide when it moves off screen
          if (decoration.position.x > 80) {
            decoration.visible = false;
          }
        } else if (Math.random() < deltaTime * 0.05) {
          // Randomly trigger a shooting star
          decoration.position.set(
            Math.random() * 60 - 80,
            Math.random() * 20 + 25,
            -40 - Math.random() * 30
          );
          decoration.visible = true;
        }
      }
    });

    // Drift background asteroids; wrap position when they exit the loop band
    for (const asteroid of this._asteroids) {
      const { mesh, driftAxis, driftSpeed, loopBound, rotSpeed } = asteroid;
      mesh.position[driftAxis] += driftSpeed * deltaTime;
      if (driftSpeed > 0 && mesh.position[driftAxis] > loopBound) {
        mesh.position[driftAxis] = -loopBound;
      } else if (driftSpeed < 0 && mesh.position[driftAxis] < -loopBound) {
        mesh.position[driftAxis] = loopBound;
      }
      mesh.rotation.x += rotSpeed.x * deltaTime;
      mesh.rotation.y += rotSpeed.y * deltaTime;
      mesh.rotation.z += rotSpeed.z * deltaTime;
    }
  }

  /**
   * Clean up decorations
   */
  cleanup() {
    this.decorations.forEach(decoration => {
      if (decoration.parent) {
        decoration.parent.remove(decoration);
      }
      if (decoration.geometry) {
        decoration.geometry.dispose();
      }
      if (decoration.material) {
        if (Array.isArray(decoration.material)) {
          decoration.material.forEach(mat => mat.dispose());
        } else {
          decoration.material.dispose();
        }
      }
    });
    this.decorations = [];
    this._asteroids = [];
  }
}
