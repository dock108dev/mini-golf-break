#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to process
const filesToProcess = [
  'src/controls/CameraController.js',
  'src/controls/InputController.js',
  'src/controls/PowerController.js',
  'src/managers/UIManager.js',
  'src/managers/BallManager.js',
  'src/managers/AudioManager.js',
  'src/managers/CoursesManager.js',
  'src/managers/DebugManager.js',
  'src/managers/EventManager.js',
  'src/managers/GameLoopManager.js',
  'src/managers/HoleCompletionManager.js',
  'src/managers/HoleTransitionManager.js',
  'src/managers/PerformanceManager.js',
  'src/managers/PhysicsManager.js',
  'src/managers/StateManager.js',
  'src/managers/VisualEffectsManager.js',
  'src/managers/debug/DebugCourseUI.js',
  'src/managers/debug/DebugErrorOverlay.js',
  'src/objects/Ball.js',
  'src/objects/BaseElement.js',
  'src/objects/BasicCourse.js',
  'src/objects/BunkerElement.js',
  'src/objects/Course.js',
  'src/objects/CourseElementRegistry.js',
  'src/objects/HoleEntity.js',
  'src/objects/NineHoleCourse.js',
  'src/objects/WallElement.js',
  'src/objects/hazards/HazardFactory.js',
  'src/physics/PhysicsWorld.js',
  'src/physics/utils.js',
  'src/scenes/Game.js',
  'src/game/ScoringSystem.js',
  'src/utils/CannonDebugRenderer.js',
  'src/utils/debug.js',
  'src/main.js'
];

function removeConsoleStatements(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Count initial console statements
    const initialCount = (content.match(/console\.(log|warn|error|info|debug)/g) || []).length;
    
    if (initialCount === 0) {
      console.log(`✓ ${filePath} - no console statements found`);
      return;
    }
    
    // Remove simple single-line console statements
    content = content.replace(/^\s*console\.(log|warn|error|info|debug)\([^)]*\);?\s*$/gm, '');
    
    // Remove multi-line console statements
    content = content.replace(/^\s*console\.(log|warn|error|info|debug)\([^)]*\n([^)]*\n)*[^)]*\);?\s*$/gm, '');
    
    // Remove console statements that span multiple lines with proper indentation
    content = content.replace(/console\.(log|warn|error|info|debug)\(\s*\n\s*[^)]+\s*\n\s*\);?/gm, '');
    
    // Remove console statements with template literals
    content = content.replace(/^\s*console\.(log|warn|error|info|debug)\(`[^`]*`\);?\s*$/gm, '');
    
    // Remove inline commented console statements
    content = content.replace(/^\s*\/\/\s*console\.(log|warn|error|info|debug)\([^)]*\);?\s*$/gm, '');
    
    // Clean up any resulting double blank lines
    content = content.replace(/\n\n\n+/g, '\n\n');
    
    // Clean up blank lines at the start of blocks
    content = content.replace(/{\n\n/g, '{\n');
    
    // Count remaining console statements
    const finalCount = (content.match(/console\.(log|warn|error|info|debug)/g) || []).length;
    
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log(`✓ ${filePath} - removed ${initialCount - finalCount} of ${initialCount} console statements (${finalCount} remaining)`);
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
}

console.log('Removing console statements from source files...\n');

filesToProcess.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    removeConsoleStatements(fullPath);
  } else {
    console.log(`✗ ${file} - file not found`);
  }
});

console.log('\nDone! Run "npm run lint" to check remaining issues.');