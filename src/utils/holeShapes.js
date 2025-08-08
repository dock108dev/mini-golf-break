import * as THREE from 'three';

/**
 * @fileoverview Utility functions to generate various geometric shapes for mini-golf hole boundaries
 * @module utils/holeShapes
 * 
 * This module provides functions to create different 2D shape outlines that can be used
 * as boundaries for mini-golf holes. Each function returns an array of THREE.Vector2 points
 * that define the shape's perimeter.
 */

/**
 * Generate a circular or oval shape
 * @param {number} radiusX - The horizontal radius of the shape
 * @param {number} radiusZ - The vertical radius of the shape (use same as radiusX for circle)
 * @param {number} [segments=32] - Number of line segments to approximate the curve
 * @returns {THREE.Vector2[]} Array of 2D points defining the shape perimeter
 */
export function createCircularShape(radiusX, radiusZ, segments = 32) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector2(
      Math.cos(angle) * radiusX,
      Math.sin(angle) * radiusZ
    ));
  }
  return points;
}

/**
 * Generate an equilateral triangle shape
 * @param {number} size - The distance from center to vertex
 * @returns {THREE.Vector2[]} Array of 2D points defining the triangle perimeter
 */
export function createTriangleShape(size) {
  return [
    new THREE.Vector2(0, -size),
    new THREE.Vector2(-size * 0.866, size * 0.5),
    new THREE.Vector2(size * 0.866, size * 0.5),
    new THREE.Vector2(0, -size)
  ];
}

/**
 * Generate a star shape with configurable points
 * @param {number} outerRadius - Distance from center to outer points
 * @param {number} innerRadius - Distance from center to inner points (between star points)
 * @param {number} [points=5] - Number of star points
 * @returns {THREE.Vector2[]} Array of 2D points defining the star perimeter
 */
export function createStarShape(outerRadius, innerRadius, points = 5) {
  const shape = [];
  const angleStep = (Math.PI * 2) / points;
  
  for (let i = 0; i < points; i++) {
    // Outer point
    const outerAngle = i * angleStep - Math.PI / 2;
    shape.push(new THREE.Vector2(
      Math.cos(outerAngle) * outerRadius,
      Math.sin(outerAngle) * outerRadius
    ));
    
    // Inner point
    const innerAngle = outerAngle + angleStep / 2;
    shape.push(new THREE.Vector2(
      Math.cos(innerAngle) * innerRadius,
      Math.sin(innerAngle) * innerRadius
    ));
  }
  
  // Close the shape
  shape.push(shape[0].clone());
  return shape;
}

/**
 * Generate a cross/plus shape
 * @param {number} armLength - Length of each arm from center to end
 * @param {number} armWidth - Width/thickness of each arm
 * @returns {THREE.Vector2[]} Array of 2D points defining the cross perimeter
 */
export function createCrossShape(armLength, armWidth) {
  const w = armWidth / 2;
  const l = armLength;
  
  return [
    // Start at top-left of vertical arm
    new THREE.Vector2(-w, l),
    new THREE.Vector2(w, l),
    new THREE.Vector2(w, w),
    new THREE.Vector2(l, w),
    new THREE.Vector2(l, -w),
    new THREE.Vector2(w, -w),
    new THREE.Vector2(w, -l),
    new THREE.Vector2(-w, -l),
    new THREE.Vector2(-w, -w),
    new THREE.Vector2(-l, -w),
    new THREE.Vector2(-l, w),
    new THREE.Vector2(-w, w),
    new THREE.Vector2(-w, l)
  ];
}

/**
 * Generate a kidney/bean shape using parametric equations
 * @param {number} width - Maximum width of the shape
 * @param {number} height - Maximum height of the shape
 * @returns {THREE.Vector2[]} Array of 2D points defining the kidney shape perimeter
 */
export function createKidneyShape(width, height) {
  const points = [];
  const segments = 32;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI * 2;
    
    // Parametric kidney shape
    const r = 1 + 0.3 * Math.cos(angle * 2);
    const x = r * Math.cos(angle) * width;
    const z = r * Math.sin(angle) * height;
    
    points.push(new THREE.Vector2(x, z));
  }
  
  return points;
}

/**
 * Generate a figure-8 (lemniscate) shape
 * @param {number} width - Maximum width of one lobe
 * @param {number} height - Maximum height at the crossing point
 * @returns {THREE.Vector2[]} Array of 2D points defining the figure-8 perimeter
 */
export function createFigure8Shape(width, height) {
  const points = [];
  const segments = 64;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI * 2;
    
    // Lemniscate parametric equation
    const scale = 1 / (1 + Math.sin(angle) * Math.sin(angle));
    const x = scale * Math.cos(angle) * width;
    const z = scale * Math.sin(angle) * Math.cos(angle) * height * 2;
    
    points.push(new THREE.Vector2(x, z));
  }
  
  return points;
}

/**
 * Generate a spiral shape that expands outward
 * @param {number} innerRadius - Starting radius at the center
 * @param {number} outerRadius - Ending radius at the outer edge
 * @param {number} [turns=2] - Number of complete rotations
 * @returns {THREE.Vector2[]} Array of 2D points defining the spiral path with thickness
 */
export function createSpiralShape(innerRadius, outerRadius, turns = 2) {
  const points = [];
  const segments = 64;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI * 2 * turns;
    const radius = innerRadius + (outerRadius - innerRadius) * t;
    
    points.push(new THREE.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    ));
  }
  
  // Create outer edge back
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const angle = t * Math.PI * 2 * turns;
    const radius = innerRadius + (outerRadius - innerRadius) * t + 0.5;
    
    points.push(new THREE.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    ));
  }
  
  points.push(points[0].clone());
  return points;
}

/**
 * Generate a snake/S-curve shape with sinusoidal curves
 * @param {number} length - Total length of the shape
 * @param {number} width - Amplitude of the curves
 * @param {number} [curves=3] - Number of S-curves
 * @returns {THREE.Vector2[]} Array of 2D points defining the snake shape perimeter
 */
export function createSnakeShape(length, width, curves = 3) {
  const points = [];
  const segments = 32;
  
  // Top edge
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = t * length - length/2;
    const z = Math.sin(t * Math.PI * curves) * width + width/2;
    points.push(new THREE.Vector2(x, z));
  }
  
  // Bottom edge
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const x = t * length - length/2;
    const z = Math.sin(t * Math.PI * curves) * width - width/2;
    points.push(new THREE.Vector2(x, z));
  }
  
  points.push(points[0].clone());
  return points;
}

/**
 * Generate a diamond (rhombus) shape
 * @param {number} width - Maximum width (horizontal diagonal)
 * @param {number} height - Maximum height (vertical diagonal)
 * @returns {THREE.Vector2[]} Array of 2D points defining the diamond perimeter
 */
export function createDiamondShape(width, height) {
  return [
    new THREE.Vector2(0, -height),
    new THREE.Vector2(-width, 0),
    new THREE.Vector2(0, height),
    new THREE.Vector2(width, 0),
    new THREE.Vector2(0, -height)
  ];
}

/**
 * Generate an L-shaped boundary
 * @param {number} width - Total width of the L shape
 * @param {number} height - Total height of the L shape
 * @param {number} thickness - Thickness of the L arms
 * @returns {THREE.Vector2[]} Array of 2D points defining the L-shape perimeter
 */
export function createLShape(width, height, thickness) {
  return [
    new THREE.Vector2(-width/2, -height/2),
    new THREE.Vector2(-width/2, height/2),
    new THREE.Vector2(width/2, height/2),
    new THREE.Vector2(width/2, height/2 - thickness),
    new THREE.Vector2(-width/2 + thickness, height/2 - thickness),
    new THREE.Vector2(-width/2 + thickness, -height/2),
    new THREE.Vector2(-width/2, -height/2)
  ];
}