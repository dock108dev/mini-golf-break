import * as THREE from 'three';

/**
 * Creates decorative hero props from type + config.
 * Props are visual only (no physics bodies).
 *
 * @param {THREE.Group} group - Group to add the prop mesh to
 * @param {object} propConfig - { type, position, scale, rotation }
 * @returns {THREE.Mesh[]} Created meshes for tracking/cleanup
 */
export function createHeroProp(group, propConfig) {
  const pos = propConfig.position || new THREE.Vector3(0, 0, 0);
  const scale = propConfig.scale || 1;
  const meshes = [];

  const propGroup = new THREE.Group();
  propGroup.position.copy(pos);
  propGroup.scale.setScalar(scale);

  if (propConfig.rotation) {
    propGroup.rotation.copy(propConfig.rotation);
  }

  switch (propConfig.type) {
    case 'rocket_stand':
      meshes.push(...buildRocketStand(propGroup));
      break;
    case 'moon_rover':
      meshes.push(...buildMoonRover(propGroup));
      break;
    case 'satellite_dish':
      meshes.push(...buildSatelliteDish(propGroup));
      break;
    case 'asteroid_cluster':
      meshes.push(...buildAsteroidCluster(propGroup));
      break;
    case 'wormhole_ring':
      meshes.push(...buildWormholeRing(propGroup));
      break;
    case 'energy_collector':
      meshes.push(...buildEnergyCollector(propGroup));
      break;
    case 'lab_equipment':
      meshes.push(...buildLabEquipment(propGroup));
      break;
    case 'black_hole_core':
      meshes.push(...buildBlackHoleCore(propGroup));
      break;
    case 'station_reactor':
      meshes.push(...buildStationReactor(propGroup));
      break;
    case 'docking_clamp':
      meshes.push(...buildDockingClamp(propGroup));
      break;
    case 'laser_emitter':
      meshes.push(...buildLaserEmitter(propGroup));
      break;
    case 'gravity_vortex':
      meshes.push(...buildGravityVortex(propGroup));
      break;
    default:
      console.warn(
        `[HeroPropFactory] Unknown prop type "${propConfig.type}", using generic placeholder`
      );
      meshes.push(...buildGenericProp(propGroup, propConfig));
      break;
  }

  group.add(propGroup);
  return meshes;
}

function mat(color, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.6,
    ...(emissive && { emissive, emissiveIntensity })
  });
}

function buildRocketStand(g) {
  const meshes = [];
  // Launch pad base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.3, 16), mat(0x555555));
  base.position.y = 0.15;
  g.add(base);
  meshes.push(base);
  // Rocket body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 12), mat(0xcccccc));
  body.position.y = 1.8;
  g.add(body);
  meshes.push(body);
  // Rocket nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 12), mat(0xff4444));
  nose.position.y = 3.7;
  g.add(nose);
  meshes.push(nose);
  // Engine glow
  const engine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.35, 0.3, 12),
    mat(0xff8800, 0xff4400, 0.8)
  );
  engine.position.y = 0.35;
  g.add(engine);
  meshes.push(engine);
  return meshes;
}

function buildMoonRover(g) {
  const meshes = [];
  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.8), mat(0x888888));
  body.position.y = 0.5;
  g.add(body);
  meshes.push(body);
  // Wheels
  for (const [x, z] of [
    [-0.5, -0.35],
    [-0.5, 0.35],
    [0.5, -0.35],
    [0.5, 0.35]
  ]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8), mat(0x333333));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.15, z);
    g.add(wheel);
    meshes.push(wheel);
  }
  // Antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), mat(0xaaaaaa));
  ant.position.set(0.3, 0.9, 0);
  g.add(ant);
  meshes.push(ant);
  return meshes;
}

function buildSatelliteDish(g) {
  const meshes = [];
  // Pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 8), mat(0x666666));
  pole.position.y = 1;
  g.add(pole);
  meshes.push(pole);
  // Dish (flattened sphere)
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3),
    mat(0xaaaacc)
  );
  dish.position.y = 2.2;
  dish.rotation.x = Math.PI;
  g.add(dish);
  meshes.push(dish);
  return meshes;
}

function buildAsteroidCluster(g) {
  const meshes = [];
  const positions = [
    [0, 0.5, 0],
    [-0.8, 0.3, 0.5],
    [0.6, 0.4, -0.4],
    [0.2, 0.8, 0.3]
  ];
  for (const [x, y, z] of positions) {
    const size = 0.2 + Math.random() * 0.4;
    const asteroid = new THREE.Mesh(new THREE.OctahedronGeometry(size, 1), mat(0x776655));
    asteroid.position.set(x, y, z);
    asteroid.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(asteroid);
    meshes.push(asteroid);
  }
  return meshes;
}

function buildWormholeRing(g) {
  const meshes = [];
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.15, 8, 32),
    mat(0x8800ff, 0x8800ff, 0.6)
  );
  ring.position.y = 1.5;
  ring.rotation.x = Math.PI / 6;
  g.add(ring);
  meshes.push(ring);
  // Inner glow disc
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.3, 32),
    new THREE.MeshStandardMaterial({
      color: 0x6600cc,
      emissive: 0x6600cc,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    })
  );
  disc.position.y = 1.5;
  disc.rotation.x = -Math.PI / 2 + Math.PI / 6;
  g.add(disc);
  meshes.push(disc);
  return meshes;
}

function buildEnergyCollector(g) {
  const meshes = [];
  // Central tower
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), mat(0x444466));
  tower.position.y = 1.5;
  g.add(tower);
  meshes.push(tower);
  // Solar panels (3 angled discs)
  for (let i = 0; i < 3; i++) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.05, 0.8),
      mat(0x2244aa, 0x1122aa, 0.3)
    );
    panel.position.y = 2.5;
    panel.rotation.y = (i * Math.PI * 2) / 3;
    panel.position.x = Math.cos((i * Math.PI * 2) / 3) * 0.8;
    panel.position.z = Math.sin((i * Math.PI * 2) / 3) * 0.8;
    g.add(panel);
    meshes.push(panel);
  }
  return meshes;
}

function buildLabEquipment(g) {
  const meshes = [];
  // Console box
  const console_box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), mat(0x556677));
  console_box.position.set(0, 0.6, 0);
  g.add(console_box);
  meshes.push(console_box);
  // Screen
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), mat(0x44aaff, 0x44aaff, 0.5));
  screen.position.set(0, 0.9, 0.21);
  g.add(screen);
  meshes.push(screen);
  // Floating drone
  const drone = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), mat(0xcccccc, 0x44aaff, 0.3));
  drone.position.set(0.5, 1.5, 0.3);
  g.add(drone);
  meshes.push(drone);
  return meshes;
}

function buildBlackHoleCore(g) {
  const meshes = [];
  // Core sphere with dark material
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0, metalness: 1 })
  );
  core.position.y = 1.5;
  g.add(core);
  meshes.push(core);
  // Accretion disc
  const disc = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.2, 6, 32),
    mat(0xff6600, 0xff4400, 0.6)
  );
  disc.position.y = 1.5;
  disc.rotation.x = Math.PI / 3;
  g.add(disc);
  meshes.push(disc);
  return meshes;
}

function buildStationReactor(g) {
  const meshes = [];
  // Core cylinder
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 3, 16),
    mat(0x446688, 0x2244aa, 0.2)
  );
  core.position.y = 1.5;
  g.add(core);
  meshes.push(core);
  // Top ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.1, 8, 24),
    mat(0x88aacc, 0x44aaff, 0.4)
  );
  ring.position.y = 2.8;
  g.add(ring);
  meshes.push(ring);
  // Bottom ring
  const ring2 = ring.clone();
  ring2.position.y = 0.2;
  g.add(ring2);
  meshes.push(ring2);
  // Glow sphere at center
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), mat(0x44ddff, 0x44ddff, 0.8));
  glow.position.y = 1.5;
  g.add(glow);
  meshes.push(glow);
  return meshes;
}

function buildDockingClamp(g) {
  const meshes = [];
  // Vertical post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2, 8), mat(0x556677));
  post.position.y = 1;
  g.add(post);
  meshes.push(post);
  // Upper clamp arm
  const upperArm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.2), mat(0x778899));
  upperArm.position.set(0.6, 1.8, 0);
  g.add(upperArm);
  meshes.push(upperArm);
  // Lower clamp arm
  const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.2), mat(0x778899));
  lowerArm.position.set(0.6, 0.6, 0);
  g.add(lowerArm);
  meshes.push(lowerArm);
  // Clamp tip indicator light
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat(0x44ff44, 0x44ff44, 0.6));
  light.position.set(1.2, 1.8, 0);
  g.add(light);
  meshes.push(light);
  return meshes;
}

function buildLaserEmitter(g) {
  const meshes = [];
  // Pylon base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.3, 8), mat(0x444466));
  base.position.y = 0.15;
  g.add(base);
  meshes.push(base);
  // Pylon column
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 8), mat(0x555577));
  column.position.y = 0.9;
  g.add(column);
  meshes.push(column);
  // Emitter head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), mat(0xff2222, 0xff2222, 0.6));
  head.position.y = 1.5;
  g.add(head);
  meshes.push(head);
  // Emitter ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.03, 6, 16),
    mat(0x666688, 0xff2222, 0.2)
  );
  ring.position.y = 1.35;
  g.add(ring);
  meshes.push(ring);
  return meshes;
}

function buildGravityVortex(g) {
  const meshes = [];
  // Swirling vortex disc at funnel center
  const vortexDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 48),
    new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      emissive: 0x4488ff,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    })
  );
  vortexDisc.rotation.x = -Math.PI / 2;
  vortexDisc.position.y = 0.01;
  g.add(vortexDisc);
  meshes.push(vortexDisc);
  // Inner glowing ring
  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.08, 8, 32),
    mat(0x66aaff, 0x66aaff, 0.7)
  );
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.05;
  g.add(innerRing);
  meshes.push(innerRing);
  // Outer glowing ring
  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.06, 8, 48),
    mat(0x4488ff, 0x4488ff, 0.5)
  );
  outerRing.rotation.x = Math.PI / 2;
  outerRing.position.y = 0.03;
  g.add(outerRing);
  meshes.push(outerRing);
  // Core glow sphere
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), mat(0xaaddff, 0xaaddff, 0.9));
  core.position.y = 0.3;
  g.add(core);
  meshes.push(core);
  return meshes;
}

function buildGenericProp(g, config) {
  const meshes = [];
  const prop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8),
    mat(config.color || 0x888888, config.color || 0x888888, 0.2)
  );
  prop.position.y = 0.75;
  g.add(prop);
  meshes.push(prop);
  return meshes;
}
