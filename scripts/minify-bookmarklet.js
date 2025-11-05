// Simple minifier for bookmarklet code
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '../src/bookmarklet-working.js');
const target = path.join(__dirname, '../src/bookmarklet-simple.html');

let code = fs.readFileSync(source, 'utf8');

// Remove line comments (but preserve //)
code = code.split('\n').map(line => {
  // Remove // comments but not in URLs
  const commentIndex = line.indexOf('//');
  if (commentIndex > -1) {
    // Check if it's in a string
    const beforeComment = line.substring(0, commentIndex);
    const singleQuotes = (beforeComment.match(/'/g) || []).length;
    const doubleQuotes = (beforeComment.match(/"/g) || []).length;
    // If odd number of quotes, we're inside a string
    if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
      line = line.substring(0, commentIndex);
    }
  }
  return line;
}).join('\n');

// Remove block comments
code = code.replace(/\/\*[\s\S]*?\*\//g, '');

// Remove multiple spaces/newlines
code = code.replace(/\s+/g, ' ');

// Remove space around operators and punctuation (but not inside strings)
code = code.replace(/\s*([{}();,:])\s*/g, '$1');
code = code.replace(/;\s*}/g, '}');

// Trim
code = code.trim();

// Wrap in javascript: protocol
const bookmarklet = 'javascript:' + encodeURIComponent(code);

console.log('✅ Bookmarklet minified!');
console.log(`📊 Original: ${fs.readFileSync(source, 'utf8').length} chars`);
console.log(`📊 Minified: ${code.length} chars`);
console.log(`📊 Encoded: ${bookmarklet.length} chars`);
console.log('\n📋 Copy this into bookmarklet-simple.html:');
console.log('\n' + bookmarklet);

// Also save to clipboard-ready file
fs.writeFileSync(
  path.join(__dirname, '../src/bookmarklet-minified.txt'),
  bookmarklet
);
console.log('\n✅ Saved to: src/bookmarklet-minified.txt');
