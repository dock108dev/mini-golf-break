#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to process
const filesToProcess = [
  'src/managers/DebugManager.js',
  'src/managers/HoleCompletionManager.js',
  'src/managers/PerformanceManager.js',
  'src/managers/PhysicsManager.js',
  'src/managers/StateManager.js',
  'src/managers/UIManager.js',
  'src/objects/CourseElementRegistry.js',
  'src/objects/HoleEntity.js',
  'src/scenes/Game.js'
];

filesToProcess.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Remove empty else blocks
      content = content.replace(/\}\s*else\s*\{\s*\}/g, '}');
      
      // Remove else blocks that only have comments
      content = content.replace(/\}\s*else\s*\{\s*\/\/[^\n]*\s*\}/g, '}');
      
      // Remove standalone empty blocks  
      content = content.replace(/^\s*\{\s*\}\s*$/gm, '');
      
      // Clean up double blank lines
      content = content.replace(/\n\n\n+/g, '\n\n');
      
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✓ Fixed ${file}`);
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
    }
  }
});

console.log('\nDone!');