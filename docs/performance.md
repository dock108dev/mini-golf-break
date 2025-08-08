# Performance Optimization Guide - Mini Golf Break

*Last Updated: 2025-08-08*

This guide provides comprehensive performance optimization strategies and benchmarks for Mini Golf Break.

## Table of Contents

1. [Performance Targets](#performance-targets)
2. [Monitoring Performance](#monitoring-performance)
3. [Optimization Strategies](#optimization-strategies)
4. [Mobile Optimization](#mobile-optimization)
5. [Memory Management](#memory-management)
6. [Benchmarks](#benchmarks)
7. [Troubleshooting](#troubleshooting)

## Performance Targets

### Desktop
- **Frame Rate**: 60 FPS stable
- **Frame Time**: < 16.67ms
- **Memory Usage**: < 300MB
- **Load Time**: < 1.5 seconds
- **Input Latency**: < 50ms

### Mobile/iOS
- **Frame Rate**: 30-60 FPS (device dependent)
- **Frame Time**: < 33.33ms
- **Memory Usage**: < 200MB
- **Load Time**: < 3 seconds
- **Battery Drain**: < 10% per hour

### Critical Metrics
```javascript
const PERFORMANCE_BUDGETS = {
    fps: { 
        desktop: { target: 60, minimum: 45 },
        mobile: { target: 30, minimum: 25 }
    },
    memory: {
        desktop: { warning: 300, critical: 500 },
        mobile: { warning: 150, critical: 250 }
    },
    updateTimes: {
        physics: 5,      // ms
        rendering: 10,   // ms
        gameLogic: 3,    // ms
        ui: 2           // ms
    }
};
```

## Monitoring Performance

### Built-in Performance Monitor

Press **'p'** during gameplay to toggle the performance overlay:

```javascript
// PerformanceManager provides real-time metrics
const perfManager = new PerformanceManager(game);
perfManager.startMonitoring();

// Metrics available:
- Current FPS
- Average frame time
- Component update times
- Memory usage
- Object counts
- Draw calls
```

### Chrome DevTools Profiling

1. **Performance Tab**
   ```javascript
   // Start recording
   performance.mark('game-start');
   
   // Measure specific operations
   performance.mark('physics-start');
   physicsManager.update(dt);
   performance.mark('physics-end');
   performance.measure('physics', 'physics-start', 'physics-end');
   ```

2. **Memory Tab**
   - Take heap snapshots
   - Monitor allocation timeline
   - Identify memory leaks

3. **Rendering Tab**
   - Monitor paint/composite times
   - Check layer count
   - Verify hardware acceleration

### Lighthouse Audits

Run Lighthouse for overall performance score:
```bash
# Using Chrome DevTools
1. Open DevTools
2. Go to Lighthouse tab
3. Run audit for "Performance"

# Using CLI
npm install -g lighthouse
lighthouse http://localhost:8080 --view
```

## Optimization Strategies

### 1. Rendering Optimizations

#### Reduce Draw Calls
```javascript
// Batch geometries
const mergedGeometry = BufferGeometryUtils.mergeGeometries([geo1, geo2, geo3]);
const mergedMesh = new THREE.Mesh(mergedGeometry, material);

// Use instanced rendering for repeated objects
const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
```

#### Level of Detail (LOD)
```javascript
// Implement LOD for complex objects
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);
lod.addLevel(mediumDetailMesh, 50);
lod.addLevel(lowDetailMesh, 100);
scene.add(lod);
```

#### Frustum Culling
```javascript
// Automatic in Three.js, but ensure it's enabled
mesh.frustumCulled = true; // default

// For custom culling
const frustum = new THREE.Frustum();
const matrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix, 
    camera.matrixWorldInverse
);
frustum.setFromProjectionMatrix(matrix);

if (!frustum.intersectsObject(object)) {
    object.visible = false;
}
```

#### Texture Optimization
```javascript
// Use compressed textures
const loader = new THREE.KTX2Loader();
loader.load('texture.ktx2', (texture) => {
    material.map = texture;
});

// Reduce texture size for mobile
if (isMobile) {
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
```

### 2. Physics Optimizations

#### Simplify Collision Shapes
```javascript
// Use primitives instead of trimeshes
// Bad
const trimeshShape = new CANNON.Trimesh(vertices, indices);

// Good
const boxShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
const sphereShape = new CANNON.Sphere(0.5);
```

#### Optimize Collision Detection
```javascript
// Use collision groups to reduce checks
const CollisionGroups = {
    BALL: 1,
    GROUND: 2,
    WALLS: 4,
    TRIGGERS: 8
};

ballBody.collisionFilterGroup = CollisionGroups.BALL;
ballBody.collisionFilterMask = CollisionGroups.GROUND | CollisionGroups.WALLS;
```

#### Sleep Inactive Bodies
```javascript
// Configure sleep parameters
body.sleepSpeedLimit = 0.1;
body.sleepTimeLimit = 1;
body.allowSleep = true;

// Force sleep for static bodies
staticBody.type = CANNON.Body.STATIC;
```

### 3. JavaScript Optimizations

#### Object Pooling
```javascript
class ObjectPool {
    constructor(createFn, resetFn, maxSize = 100) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.maxSize = maxSize;
    }
    
    get() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return this.createFn();
    }
    
    release(obj) {
        if (this.pool.length < this.maxSize) {
            this.resetFn(obj);
            this.pool.push(obj);
        }
    }
}

// Usage
const particlePool = new ObjectPool(
    () => new THREE.Mesh(geometry, material),
    (mesh) => mesh.position.set(0, 0, 0)
);
```

#### Avoid Garbage Collection
```javascript
// Reuse objects instead of creating new ones
// Bad
function update() {
    const position = new THREE.Vector3(x, y, z);
    mesh.position.copy(position);
}

// Good
const tempVector = new THREE.Vector3();
function update() {
    tempVector.set(x, y, z);
    mesh.position.copy(tempVector);
}
```

#### Optimize Loops
```javascript
// Cache array length
// Bad
for (let i = 0; i < array.length; i++) { }

// Good
const len = array.length;
for (let i = 0; i < len; i++) { }

// Use appropriate iteration method
array.forEach(); // Slowest
for (let item of array) { } // Medium
for (let i = 0; i < len; i++) { } // Fastest
```

## Mobile Optimization

### iOS-Specific Optimizations

The game includes `iOSOptimizations.js` for automatic device optimization:

```javascript
import { iOSOptimizations } from './utils/iOSOptimizations';

// Detect device tier
const deviceTier = iOSOptimizations.getDeviceTier();

// Apply optimizations based on tier
if (deviceTier === 'low') {
    // iPhone 6/7/8
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    scene.fog = null;
} else if (deviceTier === 'medium') {
    // iPhone X/11
    renderer.setPixelRatio(2);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
} else {
    // iPhone 12/13/14 Pro
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
```

### Touch Input Optimization

```javascript
// Debounce touch events
let touchTimeout;
function handleTouch(event) {
    clearTimeout(touchTimeout);
    touchTimeout = setTimeout(() => {
        processTouchEvent(event);
    }, 16); // 60 FPS timing
}

// Use passive listeners for better scrolling
element.addEventListener('touchmove', handler, { passive: true });
```

### Battery Management

```javascript
// Monitor battery level
navigator.getBattery().then(battery => {
    if (battery.level < 0.2) {
        // Reduce quality settings
        reduceQuality();
        
        // Throttle frame rate
        targetFPS = 30;
    }
    
    battery.addEventListener('levelchange', () => {
        adjustQualityBasedOnBattery(battery.level);
    });
});
```

## Memory Management

### Proper Cleanup

```javascript
class ComponentWithCleanup {
    constructor() {
        this.geometries = [];
        this.materials = [];
        this.textures = [];
    }
    
    cleanup() {
        // Dispose geometries
        this.geometries.forEach(geo => geo.dispose());
        
        // Dispose materials
        this.materials.forEach(mat => {
            Object.keys(mat).forEach(key => {
                if (mat[key] && mat[key].dispose) {
                    mat[key].dispose();
                }
            });
            mat.dispose();
        });
        
        // Dispose textures
        this.textures.forEach(tex => tex.dispose());
        
        // Clear arrays
        this.geometries = [];
        this.materials = [];
        this.textures = [];
    }
}
```

### Monitor Memory Usage

```javascript
// Check memory usage
if (performance.memory) {
    const memoryInfo = {
        used: performance.memory.usedJSHeapSize / 1048576,
        total: performance.memory.totalJSHeapSize / 1048576,
        limit: performance.memory.jsHeapSizeLimit / 1048576
    };
    
    if (memoryInfo.used > 200) {
        console.warn('High memory usage:', memoryInfo);
        // Trigger cleanup
        runGarbageCollection();
    }
}
```

### Texture Memory Management

```javascript
// Limit texture size
const maxTextureSize = renderer.capabilities.maxTextureSize;
if (texture.image.width > maxTextureSize) {
    // Resize texture
    resizeTexture(texture, maxTextureSize);
}

// Use mipmaps efficiently
texture.generateMipmaps = true;
texture.minFilter = THREE.LinearMipmapLinearFilter;
```

## Benchmarks

### Performance Test Suite

```javascript
// Run performance benchmarks
class PerformanceBenchmark {
    static async runAllTests() {
        const results = {
            rendering: await this.testRendering(),
            physics: await this.testPhysics(),
            gameLogic: await this.testGameLogic(),
            memory: await this.testMemory()
        };
        
        console.table(results);
        return results;
    }
    
    static async testRendering() {
        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
            renderer.render(scene, camera);
        }
        return performance.now() - start;
    }
    
    static async testPhysics() {
        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
            world.step(1/60);
        }
        return performance.now() - start;
    }
}
```

### Expected Performance Metrics

| Device | FPS | Memory (MB) | Load Time (s) |
|--------|-----|-------------|---------------|
| Desktop (High-end) | 60 | 150-200 | < 1 |
| Desktop (Mid-range) | 60 | 200-250 | 1-2 |
| iPhone 14 Pro | 60 | 100-150 | 1-2 |
| iPhone 12 | 45-60 | 120-180 | 2-3 |
| iPhone X | 30-45 | 150-200 | 2-3 |
| iPad Pro | 60 | 150-200 | 1-2 |
| Android (High-end) | 45-60 | 150-200 | 2-3 |
| Android (Mid-range) | 30-45 | 180-250 | 3-4 |

## Troubleshooting

### Low FPS

1. **Check Performance Monitor** (press 'p')
   - Identify slow components (red values)
   - Look for spikes in update times

2. **Common Causes:**
   - Too many draw calls
   - Complex shaders
   - Unoptimized physics
   - Memory pressure

3. **Solutions:**
   ```javascript
   // Reduce quality settings
   function reduceQuality() {
       renderer.setPixelRatio(1);
       renderer.shadowMap.enabled = false;
       scene.fog = null;
       // Reduce texture quality
       scene.traverse(obj => {
           if (obj.material && obj.material.map) {
               obj.material.map.minFilter = THREE.NearestFilter;
           }
       });
   }
   ```

### Memory Leaks

1. **Identify with Chrome DevTools:**
   - Take heap snapshots
   - Compare snapshots over time
   - Look for detached DOM nodes

2. **Common Sources:**
   - Event listeners not removed
   - Three.js objects not disposed
   - Circular references

3. **Prevention:**
   ```javascript
   // Always remove event listeners
   componentWillUnmount() {
       window.removeEventListener('resize', this.handleResize);
       this.cleanup();
   }
   
   // Dispose Three.js objects
   cleanup() {
       this.scene.traverse(child => {
           if (child.geometry) child.geometry.dispose();
           if (child.material) {
               if (Array.isArray(child.material)) {
                   child.material.forEach(m => m.dispose());
               } else {
                   child.material.dispose();
               }
           }
       });
   }
   ```

### High Battery Drain

1. **Reduce Update Frequency:**
   ```javascript
   // Throttle non-critical updates
   let lastUpdate = 0;
   function throttledUpdate(timestamp) {
       if (timestamp - lastUpdate > 100) { // 10 FPS for background
           updateNonCritical();
           lastUpdate = timestamp;
       }
   }
   ```

2. **Pause When Hidden:**
   ```javascript
   document.addEventListener('visibilitychange', () => {
       if (document.hidden) {
           gameLoop.pause();
       } else {
           gameLoop.resume();
       }
   });
   ```

## Best Practices Summary

1. **Profile First** - Don't optimize blindly
2. **Mobile First** - Design for lowest common denominator
3. **Progressive Enhancement** - Add features for capable devices
4. **Monitor Continuously** - Use performance monitoring in production
5. **Test on Real Devices** - Simulators don't show true performance
6. **Optimize Assets** - Compress textures, simplify models
7. **Clean Up Resources** - Prevent memory leaks
8. **Use Web Workers** - Offload heavy computations
9. **Batch Operations** - Reduce draw calls and state changes
10. **Cache Wisely** - Balance memory vs computation

---

For implementation details, see the [Development Guide](development-guide.md)