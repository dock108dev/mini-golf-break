#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function removeComplexConsoleStatements(content) {
  const lines = content.split('\n');
  const outputLines = [];
  let inConsoleStatement = false;
  let parenCount = 0;
  let consoleStartIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts a console statement
    if (!inConsoleStatement && line.match(/^\s*console\.(log|warn|error|info|debug)\s*\(/)) {
      inConsoleStatement = true;
      consoleStartIndex = i;
      parenCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      
      // Check if the console statement ends on the same line
      if (parenCount <= 0) {
        inConsoleStatement = false;
        continue; // Skip this line
      }
    } else if (inConsoleStatement) {
      // Count parentheses to track when the statement ends
      parenCount += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
      
      if (parenCount <= 0) {
        inConsoleStatement = false;
        continue; // Skip this line which ends the console statement
      }
    } else {
      // Regular line, not part of a console statement
      outputLines.push(line);
    }
  }
  
  return outputLines.join('\n');
}

// Files to process
const filesToProcess = [
  'src/controls/CameraController.js',
  'src/controls/InputController.js',
  'src/managers/BallManager.js',
  'src/managers/CoursesManager.js',
  'src/managers/HoleTransitionManager.js',
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
  'src/game/ScoringSystem.js',
  'src/main.js'
];

console.log('Removing remaining console statements from source files...\n');

filesToProcess.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Count initial console statements
      const initialCount = (content.match(/console\.(log|warn|error|info|debug)/g) || []).length;
      
      if (initialCount === 0) {
        console.log(`✓ ${file} - no console statements found`);
        return;
      }
      
      // Remove complex multi-line console statements
      content = removeComplexConsoleStatements(content);
      
      // Clean up any resulting multiple blank lines
      content = content.replace(/\n\n\n+/g, '\n\n');
      
      // Count remaining console statements
      const finalCount = (content.match(/console\.(log|warn|error|info|debug)/g) || []).length;
      
      fs.writeFileSync(fullPath, content, 'utf8');
      
      console.log(`✓ ${file} - removed ${initialCount - finalCount} of ${initialCount} console statements (${finalCount} remaining)`);
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
    }
  } else {
    console.log(`✗ ${file} - file not found`);
  }
});

console.log('\nDone! Run "npm run lint" to check remaining issues.');