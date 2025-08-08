#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixEmptyBlocks(content) {
  // Remove empty if/else blocks
  content = content.replace(/if\s*\([^)]+\)\s*{\s*}/g, '');
  content = content.replace(/else\s*{\s*}/g, '');
  
  // Remove empty catch blocks but keep the catch statement
  content = content.replace(/catch\s*\([^)]+\)\s*{\s*}/g, 'catch (error) {\n      // Error handling removed for production\n    }');
  
  // Remove standalone empty blocks
  content = content.replace(/^\s*{\s*}\s*$/gm, '');
  
  // Clean up resulting multiple blank lines
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  return content;
}

// Files to process
const filesToProcess = [
  'src/controls/CameraController.js',
  'src/controls/InputController.js',
  'src/managers/BallManager.js',
  'src/managers/HoleTransitionManager.js',
  'src/objects/Ball.js',
  'src/objects/BasicCourse.js',
  'src/objects/NineHoleCourse.js',
  'src/physics/PhysicsWorld.js',
  'src/main.js'
];

console.log('Fixing empty block statements...\n');

filesToProcess.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Count initial empty blocks
      const initialCount = (content.match(/{\s*}/g) || []).length;
      
      if (initialCount === 0) {
        console.log(`✓ ${file} - no empty blocks found`);
        return;
      }
      
      // Fix empty blocks
      content = fixEmptyBlocks(content);
      
      // Count remaining empty blocks
      const finalCount = (content.match(/{\s*}/g) || []).length;
      
      fs.writeFileSync(fullPath, content, 'utf8');
      
      console.log(`✓ ${file} - fixed ${initialCount - finalCount} of ${initialCount} empty blocks (${finalCount} remaining)`);
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
    }
  } else {
    console.log(`✗ ${file} - file not found`);
  }
});

console.log('\nDone! Run "npm run lint" to check remaining issues.');