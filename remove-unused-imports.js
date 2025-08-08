#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/objects/BaseElement.js',
  'src/managers/HoleTransitionManager.js',
  'src/managers/CoursesManager.js',
  'src/managers/PerformanceManager.js',
  'src/managers/PhysicsManager.js',
  'src/objects/Course.js',
  'src/objects/BasicCourse.js'
];

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Remove unused imports with underscore prefix
      content = content.replace(/^import\s+\*\s+as\s+_THREE\s+from\s+['"]three['"];?\s*$/gm, '');
      content = content.replace(/^import\s+\*\s+as\s+_CANNON\s+from\s+['"]cannon-es['"];?\s*$/gm, '');
      content = content.replace(/^import\s+{\s*_CSG\s*}\s+from\s+['"]three-csg-ts['"];?\s*$/gm, '');
      
      // Clean up resulting double blank lines at the start of files
      content = content.replace(/^(\n)+/, '');
      
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✓ Fixed ${file}`);
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
    }
  }
});

console.log('\nDone!');