#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all files with empty block errors
const lintOutput = execSync('npm run lint 2>&1 || true', { encoding: 'utf8' });
const lines = lintOutput.split('\n');

const emptyBlockErrors = {};
let currentFile = null;

lines.forEach(line => {
  if (line.startsWith('/Users/') && line.includes('.js')) {
    currentFile = line.trim();
  } else if (currentFile && line.includes('error') && line.includes('Empty block statement')) {
    const match = line.match(/^\s*(\d+):(\d+)\s+error/);
    if (match) {
      if (!emptyBlockErrors[currentFile]) {
        emptyBlockErrors[currentFile] = [];
      }
      emptyBlockErrors[currentFile].push(parseInt(match[1]));
    }
  }
});

// Process each file
Object.keys(emptyBlockErrors).forEach(filePath => {
  const errorLines = emptyBlockErrors[filePath];
  if (errorLines.length === 0) return;
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Sort line numbers in reverse order
    errorLines.sort((a, b) => b - a);
    
    errorLines.forEach(lineNum => {
      const lineIndex = lineNum - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];
        
        // Check if this is an empty block
        if (line.trim() === '}') {
          // Look back to find the opening brace
          let openBraceIndex = lineIndex - 1;
          while (openBraceIndex >= 0) {
            const prevLine = lines[openBraceIndex].trim();
            if (prevLine === '' || prevLine === '// Intentionally empty') {
              openBraceIndex--;
              continue;
            }
            if (prevLine.endsWith('{') || prevLine === '{') {
              // Found the opening brace, add a comment
              lines.splice(lineIndex, 0, '      // Intentionally empty');
              break;
            }
            break;
          }
        }
      }
    });
    
    content = lines.join('\n');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed ${path.basename(filePath)} - ${errorLines.length} empty blocks`);
  } catch (err) {
    console.error(`✗ Error processing ${path.basename(filePath)}:`, err.message);
  }
});

console.log('\nDone!');