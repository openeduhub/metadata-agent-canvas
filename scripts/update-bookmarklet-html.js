// Update bookmarklet-simple.html with minified code
const fs = require('fs');
const path = require('path');

const minifiedPath = path.join(__dirname, '../src/bookmarklet-minified.txt');
const htmlPath = path.join(__dirname, '../src/bookmarklet-simple.html');

// Read files
const minifiedCode = fs.readFileSync(minifiedPath, 'utf8').trim();
const html = fs.readFileSync(htmlPath, 'utf8');

// Replace code in HTML by finding the start and end markers
const startMarker = '<div class="code-box" id="bookmarkletCode">';
const endMarker = '</div>';

const startIdx = html.indexOf(startMarker);
if (startIdx === -1) {
  console.error('❌ Could not find bookmarklet code box in HTML');
  process.exit(1);
}

const codeStart = startIdx + startMarker.length;
const codeEnd = html.indexOf(endMarker, codeStart);
if (codeEnd === -1) {
  console.error('❌ Could not find end of code box');
  process.exit(1);
}

const updatedHtml = html.substring(0, codeStart) + minifiedCode + html.substring(codeEnd);

// Write back
fs.writeFileSync(htmlPath, updatedHtml);

console.log('✅ Updated bookmarklet-simple.html with new minified code');
console.log(`📊 Code length: ${minifiedCode.length} chars`);
