import * as THREE from 'three';

/**
 * SpaceDecorations - Adds cosmic background elements to enhance the space theme
 */
export class SpaceDecorations {
  constructor(scene) {
    this.scene = scene;
    this.decorations = [];
  }

  /**
   * Initialize all space decorations
   */
  init() {
    this.addFloatingPlanets();
    this.addDistantNebula();
    this.addSpaceDebris();
    this.addShootingStars();
  }

  /**
   * Add floating planets in the background
   */
  addFloatingPlanets() {
    // Earth-like planet
    const earthGeometry = new THREE.SphereGeometry(5, 32, 32);
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x2233ff,
      emissive: 0x112244,
      emissiveIntensity: 0.1
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.position.set(-30, 15, -50);
    earth.userData.type = 'decoration';
    this.scene.add(earth);
    this.decorations.push(earth);

    // Mars-like planet
    const marsGeometry = new THREE.SphereGeometry(3, 32, 32);
    const marsMaterial = new THREE.MeshPhongMaterial({
      color: 0xff4444,
      emissive: 0x441111,
      emissiveIntensity: 0.1
    });
    const mars = new THREE.Mesh(marsGeometry, marsMaterial);
    mars.position.set(40, 10, -40);
    mars.userData.type = 'decoration';
    this.scene.add(mars);
    this.decorations.push(mars);

    // Saturn with rings
    const saturnGeometry = new THREE.SphereGeometry(6, 32, 32);
    const saturnMaterial = new THREE.MeshPhongMaterial({
      color: 0xffaa66,
      emissive: 0x332211,
      emissiveIntensity: 0.1
    });
    const saturn = new THREE.Mesh(saturnGeometry, saturnMaterial);
    saturn.position.set(0, 20, -60);

    // Saturn's rings
    const ringGeometry = new THREE.RingGeometry(8, 12, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffddaa,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const rings = new THREE.Mesh(ringGeometry, ringMaterial);
    rings.rotation.x = Math.PI / 2;
    saturn.add(rings);

    saturn.userData.type = 'decoration';
    this.scene.add(saturn);
    this.decorations.push(saturn);
  }

  /**
   * Add nebula clouds in the distance
   */
  addDistantNebula() {
    const nebulaGeometry = new THREE.PlaneGeometry(100, 50);
    const nebulaMaterial = new THREE.MeshBasicMaterial({
      color: 0x6633ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    const nebula1 = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
    nebula1.position.set(-50, 30, -100);
    nebula1.rotation.y = Math.PI / 4;
    nebula1.userData.type = 'decoration';
    this.scene.add(nebula1);
    this.decorations.push(nebula1);

    const nebula2Material = new THREE.MeshBasicMaterial({
      color: 0xff3366,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    const nebula2 = new THREE.Mesh(nebulaGeometry, nebula2Material);
    nebula2.position.set(60, 25, -90);
    nebula2.rotation.y = -Math.PI / 3;
    nebula2.userData.type = 'decoration';
    this.scene.add(nebula2);
    this.decorations.push(nebula2);
  }

  /**
   * Add floating space debris
   */
  addSpaceDebris() {
    const debrisGroup = new THREE.Group();
    debrisGroup.userData.type = 'decoration';

    for (let i = 0; i < 20; i++) {
      const size = Math.random() * 0.5 + 0.2;
      const geometry = new THREE.OctahedronGeometry(size);
      const material = new THREE.MeshPhongMaterial({
        color: 0x888888,
        emissive: 0x222222,
        emissiveIntensity: 0.2
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

      this.scene.add(star);
      this.decorations.push(star);
    }
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
  }
}
