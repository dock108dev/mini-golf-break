import * as THREE from 'three';
import { CoursesManager } from '../managers/CoursesManager.js';
import { HoleEntity } from './HoleEntity';
import { createOrbitalDriftConfigs } from '../config/orbitalDriftConfigs';
import { hydrateHoleConfig } from '../config/hydrateHoleConfig';
import { debug } from '../utils/debug';

/**
 * OrbitalDriftCourse - space-themed course with advanced mechanics.
 */
export class OrbitalDriftCourse extends CoursesManager {
  constructor(game, options = {}) {
    super(undefined, undefined, { autoCreate: false });
    this.game = game;
    this.options = { debug: options.debug || false };
    this.scene = game.scene;
    this.physicsWorld = game.physicsWorld;

    this.holeConfigs = createOrbitalDriftConfigs().map(hydrateHoleConfig);
    this.totalHoles = this.holeConfigs.length;

    this.holeGroups = [];
    this.holeEntities = [];

    for (let i = 0; i < this.totalHoles; i++) {
      const holeGroup = new THREE.Group();
      holeGroup.name = `OD_Hole_${i + 1}_Group`;
      holeGroup.userData = { holeIndex: i };
      this.scene.add(holeGroup);
      this.holeGroups.push(holeGroup);
    }

    this.currentHoleIndex = 0;
    this.currentHoleEntity = null;
  }

  static async create(game) {
    const physicsWorld = game.physicsManager.getWorld();
    if (!physicsWorld) {
      throw new Error('Physics world not available');
    }

    const course = new OrbitalDriftCourse(game, { physicsWorld });
    const success = await course.initializeHole(0);

    if (!success || !course.startPosition || !course.currentHoleEntity) {
      throw new Error('Failed to initialize first hole');
    }

    return course;
  }

  async initializeHole(holeIndex) {
    if (holeIndex < 0 || holeIndex >= this.totalHoles) {
      return false;
    }

    const holeGroup = this.holeGroups[holeIndex];
    const holeConfig = this.holeConfigs[holeIndex];
    if (!holeConfig || !holeGroup) {
      return false;
    }

    if (!holeGroup.parent) {
      this.scene.add(holeGroup);
    }

    if (this.currentHoleEntity && this.currentHoleEntity.config.index === holeIndex) {
      this.holeGroups[holeIndex].visible = true;
      this.currentHoleIndex = holeIndex;
      this.currentHole = this.currentHoleEntity;
      return true;
    }

    this.holeGroups.forEach(g => {
      g.visible = false;
    });

    const physicsWorld = this.game.physicsManager.getWorld();
    this.currentHoleEntity = new HoleEntity(physicsWorld, holeConfig, holeGroup);
    this.currentHoleEntity.audioManager = this.game.audioManager || null;
    await this.currentHoleEntity.init();

    holeGroup.visible = true;
    this.currentHoleIndex = holeIndex;
    this.currentHole = this.currentHoleEntity;
    this.setStartPosition(holeConfig.startPosition);
    return true;
  }

  setStartPosition(position) {
    if (position instanceof THREE.Vector3) {
      this.startPosition = position.clone();
    }
  }

  async createCourse(targetHoleNumber) {
    if (targetHoleNumber < 1 || targetHoleNumber > this.totalHoles) {
      return false;
    }
    await this.clearCurrentHole();
    return await this.initializeHole(targetHoleNumber - 1);
  }

  clearCurrentHole() {
    if (this.currentHoleEntity) {
      this.currentHoleEntity.destroy();
      this.currentHoleEntity = null;
      this.currentHole = null;
    }
    if (
      this.holeGroups &&
      this.currentHoleIndex >= 0 &&
      this.currentHoleIndex < this.holeGroups.length
    ) {
      this.holeGroups[this.currentHoleIndex].visible = false;
    }
    return Promise.resolve();
  }

  getCurrentHoleNumber() {
    return this.currentHoleIndex + 1;
  }
  getCurrentHoleConfig() {
    return this.holeConfigs[this.currentHoleIndex] || null;
  }
  hasNextHole() {
    return this.currentHoleIndex < this.totalHoles - 1;
  }
  getHolePosition() {
    return this.getCurrentHoleConfig()?.holePosition || null;
  }
  getHoleStartPosition() {
    return this.getCurrentHoleConfig()?.startPosition || null;
  }
  getHolePar() {
    return this.getCurrentHoleConfig()?.par || 0;
  }
  getAllHolePars() {
    return this.holeConfigs.map(c => c.par || 0);
  }
  getCameraHint() {
    return this.getCurrentHoleConfig()?.cameraHint || null;
  }

  // update(dt) is inherited from CoursesManager — it threads ballBody to currentHoleEntity
}
