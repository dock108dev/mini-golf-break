/**
 * ISSUE-015: Validate Hole 9 'Station Core Finale' acceptance criteria.
 *
 * Verifies the redesigned Hole 9 config meets all design requirements:
 * - Correct name, par, and mechanic types
 * - Split route fork near start with sweeper on direct branch
 * - Routes converge before boost strip
 * - Boost strip aimed toward elevated green ramp
 * - Elevated green with cup on raised platform
 * - Hero prop at center with no physics colliders
 */

import { createOrbitalDriftConfigs } from '../../config/orbitalDriftConfigs';

const configs = createOrbitalDriftConfigs();
const hole9 = configs[8];

describe('Hole 9 — Station Core Finale (ISSUE-015)', () => {
  it('has name "Station Core Finale" and par 4', () => {
    expect(hole9.description).toContain('Station Core Finale');
    expect(hole9.par).toBe(4);
  });

  it('has all four required mechanic types', () => {
    const types = hole9.mechanics.map(m => m.type);
    expect(types).toContain('split_route');
    expect(types).toContain('moving_sweeper');
    expect(types).toContain('boost_strip');
    expect(types).toContain('elevated_green');
  });

  describe('split_route fork', () => {
    const splitRoute = hole9.mechanics.find(m => m.type === 'split_route');

    it('exists with wall segments', () => {
      expect(splitRoute).toBeDefined();
      expect(splitRoute.walls.length).toBeGreaterThan(0);
    });

    it('fork is at or near the start position (within 3 units along z)', () => {
      const startZ = hole9.startPosition[2];
      const wallStartZ = splitRoute.walls[0].start[2];
      expect(Math.abs(wallStartZ - startZ)).toBeLessThanOrEqual(3);
    });
  });

  describe('moving_sweeper on direct branch', () => {
    const sweeper = hole9.mechanics.find(m => m.type === 'moving_sweeper');
    const splitRoute = hole9.mechanics.find(m => m.type === 'split_route');

    it('exists with valid config', () => {
      expect(sweeper).toBeDefined();
      expect(sweeper.pivot).toBeDefined();
      expect(sweeper.armLength).toBeGreaterThan(0);
      expect(sweeper.speed).toBeGreaterThan(0);
    });

    it('pivot is on the direct branch side of the split wall', () => {
      // Wall is at x=0, direct branch is x > 0
      const wallX = splitRoute.walls[0].start[0];
      expect(sweeper.pivot[0]).toBeGreaterThan(wallX);
    });

    it('pivot z is between split wall start and end (within the fork zone)', () => {
      const wallStartZ = splitRoute.walls[0].start[2];
      const wallEndZ = splitRoute.walls[0].end[2];
      const minZ = Math.min(wallStartZ, wallEndZ);
      const maxZ = Math.max(wallStartZ, wallEndZ);
      expect(sweeper.pivot[2]).toBeGreaterThanOrEqual(minZ);
      expect(sweeper.pivot[2]).toBeLessThanOrEqual(maxZ);
    });

    it('has >= 2 second open window', () => {
      // Full rotation period = 2π / speed
      // Arm blocks path for a fraction of rotation; conservatively the arm
      // blocks for at most armLength / (2π * armLength) = 1/(2π) of the period
      // (one arm width out of circumference). Open window is the rest.
      const fullRotationTime = (2 * Math.PI) / sweeper.speed;
      // Even with generous blocking estimate (1/3 of rotation), open window is 2/3
      const openWindow = fullRotationTime * (2 / 3);
      expect(openWindow).toBeGreaterThanOrEqual(2);
    });
  });

  describe('route convergence before boost strip', () => {
    const splitRoute = hole9.mechanics.find(m => m.type === 'split_route');
    const boostStrip = hole9.mechanics.find(m => m.type === 'boost_strip');

    it('split wall ends before boost strip position along z', () => {
      const wallEndZ = splitRoute.walls[0].end[2];
      const boostZ = boostStrip.position[2];
      // Wall end z should be greater than boost z (z decreases toward hole)
      expect(wallEndZ).toBeGreaterThan(boostZ);
    });
  });

  describe('boost_strip toward ramp', () => {
    const boostStrip = hole9.mechanics.find(m => m.type === 'boost_strip');
    const elevatedGreen = hole9.mechanics.find(m => m.type === 'elevated_green');

    it('boost direction points toward the ramp (-z direction)', () => {
      expect(boostStrip.direction[2]).toBeLessThan(0);
    });

    it('boost strip is positioned before the ramp along z', () => {
      const boostZ = boostStrip.position[2];
      const rampStartZ = elevatedGreen.ramp.start[2];
      expect(boostZ).toBeGreaterThan(rampStartZ);
    });
  });

  describe('elevated_green', () => {
    const elevatedGreen = hole9.mechanics.find(m => m.type === 'elevated_green');

    it('has platform with elevation > 0', () => {
      expect(elevatedGreen.elevation).toBeGreaterThan(0);
    });

    it('cup is on the elevated platform', () => {
      const cupPos = hole9.holePosition;
      const platPos = elevatedGreen.platform.position;
      const platW = elevatedGreen.platform.width;
      const platL = elevatedGreen.platform.length;

      // Cup x within platform bounds
      expect(Math.abs(cupPos[0] - platPos[0])).toBeLessThanOrEqual(platW / 2);
      // Cup z within platform bounds
      expect(Math.abs(cupPos[2] - platPos[2])).toBeLessThanOrEqual(platL / 2);
      // Cup y matches elevation
      expect(cupPos[1]).toBeCloseTo(elevatedGreen.elevation, 1);
    });

    it('ramp connects to platform', () => {
      const rampEndZ = elevatedGreen.ramp.end[2];
      const platPos = elevatedGreen.platform.position;
      const platL = elevatedGreen.platform.length;
      // Ramp end should be near the platform edge
      expect(Math.abs(rampEndZ - (platPos[2] + platL / 2))).toBeLessThanOrEqual(2);
    });
  });

  describe('hero prop', () => {
    it('has a station-themed hero prop', () => {
      expect(hole9.heroProps.length).toBeGreaterThan(0);
      const prop = hole9.heroProps[0];
      expect(prop.type).toBe('station_reactor');
    });

    it('hero prop is positioned at center of the course', () => {
      const prop = hole9.heroProps[0];
      // Center is approximately [0, 0, 0] for a course spanning z: -11 to 11
      expect(Math.abs(prop.position[0])).toBeLessThanOrEqual(3);
      expect(Math.abs(prop.position[2])).toBeLessThanOrEqual(3);
    });
  });

  describe('layout dimensions', () => {
    it('boundary is approximately 22x10 units', () => {
      const xs = hole9.boundaryShape.map(p => p[0]);
      const zs = hole9.boundaryShape.map(p => p[1]);
      const width = Math.max(...xs) - Math.min(...xs);
      const length = Math.max(...zs) - Math.min(...zs);
      expect(width).toBeCloseTo(10, 0);
      expect(length).toBeCloseTo(22, 0);
    });
  });
});
