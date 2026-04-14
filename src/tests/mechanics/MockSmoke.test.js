import { MechanicBase } from '../../mechanics/MechanicBase';

describe('Mechanics mock smoke test', () => {
  let world, group;

  beforeEach(() => {
    world = new CANNON.World();
    group = new THREE.Group();
  });

  test('MechanicBase subclass works with extended mocks', () => {
    class TestMechanic extends MechanicBase {
      constructor(world, group, config, surfaceHeight) {
        super(world, group, config, surfaceHeight);

        // Create a mesh with emissive material
        const material = new THREE.MeshStandardMaterial();
        material.emissive = 0xff0000;
        material.emissiveIntensity = 0.5;
        material.transparent = true;
        material.opacity = 0.6;
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(), material);
        group.add(mesh);
        this.meshes.push(mesh);

        // Create a trigger body
        const body = new CANNON.Body();
        body.isTrigger = true;
        world.addBody(body);
        this.bodies.push(body);
      }

      update(dt, ballBody) {
        if (!ballBody) {
          return;
        }
        const force = new CANNON.Vec3(1, 0, 0);
        ballBody.applyForce(force, new CANNON.Vec3(0, 0, 0));
      }
    }

    const mechanic = new TestMechanic(world, group, {}, 0.2);

    expect(mechanic.meshes).toHaveLength(1);
    expect(mechanic.bodies).toHaveLength(1);
    expect(mechanic.bodies[0].isTrigger).toBe(true);

    // Test applyForce via update
    const ballBody = new CANNON.Body();
    mechanic.update(1 / 60, ballBody);
    expect(ballBody.applyForce).toHaveBeenCalled();

    // Test Vec3 distanceTo
    const v1 = new CANNON.Vec3(3, 0, 4);
    const v2 = new CANNON.Vec3(0, 0, 0);
    expect(v1.distanceTo(v2)).toBe(5);

    // Test Group traverse
    expect(typeof group.traverse).toBe('function');
    const visited = [];
    group.traverse(obj => visited.push(obj));
    expect(visited.length).toBeGreaterThan(0);

    // Test MeshStandardMaterial extended properties
    const mat = new THREE.MeshStandardMaterial();
    expect(mat).toHaveProperty('emissive');
    expect(mat).toHaveProperty('emissiveIntensity');
    expect(mat).toHaveProperty('transparent');
    expect(mat).toHaveProperty('opacity');

    // Cleanup
    mechanic.destroy();
    expect(mechanic.meshes).toHaveLength(0);
    expect(mechanic.bodies).toHaveLength(0);
  });
});
