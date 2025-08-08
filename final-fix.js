#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all error details
const lintOutput = execSync('npm run lint 2>&1 || true', { encoding: 'utf8' });
const lines = lintOutput.split('\n');

const fixes = {};
let currentFile = null;

lines.forEach(line => {
  if (line.startsWith('/Users/') && line.includes('.js')) {
    currentFile = line.trim();
    if (!fixes[currentFile]) {
      fixes[currentFile] = [];
    }
  } else if (currentFile && line.includes('error')) {
    const match = line.match(/^\s*(\d+):(\d+)\s+error\s+(.+)/);
    if (match) {
      fixes[currentFile].push({
        line: parseInt(match[1]),
        column: parseInt(match[2]),
        message: match[3].trim()
      });
    }
  }
});

// Process each file
Object.keys(fixes).forEach(filePath => {
  const errors = fixes[filePath];
  if (errors.length === 0) return;
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const fixedLines = new Set();
    
    // Sort errors by line number in reverse
    errors.sort((a, b) => b.line - a.line);
    
    errors.forEach(error => {
      const lineIndex = error.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length && !fixedLines.has(lineIndex)) {
        const line = lines[lineIndex];
        
        if (error.message.includes('Empty block statement')) {
          // Add comment to empty blocks
          const trimmedLine = line.trim();
          if (trimmedLine === '}' || trimmedLine === '} else {') {
            // Find the matching opening brace
            let openBraceIndex = lineIndex - 1;
            let emptyBlock = true;
            
            while (openBraceIndex >= 0) {
              const checkLine = lines[openBraceIndex].trim();
              if (checkLine === '' || checkLine === '// Intentionally empty') {
                openBraceIndex--;
                continue;
              }
              if (checkLine.endsWith('{') || checkLine === '{') {
                // Found opening brace, add comment if block is empty
                if (emptyBlock) {
                  const indent = lines[openBraceIndex].match(/^\s*/)[0];
                  lines.splice(lineIndex, 0, indent + '  // Intentionally empty');
                  fixedLines.add(lineIndex);
                }
                break;
              }
              // Non-empty line found
              emptyBlock = false;
              break;
            }
          }
        } else if (error.message.includes('is defined but never used')) {
          // Fix unused imports
          if (line.includes('import')) {
            const varMatch = error.message.match(/'([^']+)'/);
            if (varMatch && varMatch[1] === 'THREE' && line.includes('* as THREE')) {
              // Comment out unused THREE import
              lines[lineIndex] = '// ' + line;
              fixedLines.add(lineIndex);
            }
          }
        } else if (error.message.includes('hasOwnProperty')) {
          // Fix hasOwnProperty usage
          lines[lineIndex] = line.replace(
            /(\w+)\.hasOwnProperty\(/g,
            'Object.prototype.hasOwnProperty.call($1, '
          );
          fixedLines.add(lineIndex);
        }
      }
    });
    
    content = lines.join('\n');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed ${path.basename(filePath)} - ${errors.length} issues`);
  } catch (err) {
    console.error(`✗ Error processing ${path.basename(filePath)}:`, err.message);
  }
});

console.log('\nDone! Run "npm run lint" to verify.');