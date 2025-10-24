#!/usr/bin/env node

/**
 * Security Check: Verify NO API keys in production bundle
 * 
 * Run after build to ensure bundle is clean:
 * npm run build && node check-bundle-security.js
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

console.log('═══════════════════════════════════════════════════════════');
console.log('🔒 Bundle Security Check - API Key Scanner');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

const distPath = path.join(__dirname, 'dist');

if (!fs.existsSync(distPath)) {
  console.error('❌ dist/ folder not found!');
  console.error('   Run "npm run build" first.');
  process.exit(1);
}

console.log('📂 Scanning: dist/');
console.log('');

let totalFiles = 0;
let totalLeaks = 0;
const leakedFiles = [];

/**
 * Detect potential API keys in content
 */
function detectLeaks(content, filePath) {
  const leaks = [];
  
  // 1. OpenAI Keys (sk-...)
  const openaiPattern = /sk-[a-zA-Z0-9]{20,}/g;
  let match;
  while ((match = openaiPattern.exec(content)) !== null) {
    leaks.push({
      type: 'OpenAI Key',
      value: match[0].substring(0, 15) + '...',
      position: match.index,
      context: getContext(content, match.index, 50)
    });
  }
  
  // 2. UUID Keys (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
  while ((match = uuidPattern.exec(content)) !== null) {
    // Skip common false positives (Angular component IDs, etc.)
    const contextBefore = content.substring(Math.max(0, match.index - 30), match.index);
    if (!contextBefore.includes('component') && !contextBefore.includes('module')) {
      leaks.push({
        type: 'UUID (potential API Key)',
        value: match[0],
        position: match.index,
        context: getContext(content, match.index, 50)
      });
    }
  }
  
  // 3. Bearer tokens
  const bearerPattern = /Bearer\s+[a-zA-Z0-9._-]{20,}/gi;
  while ((match = bearerPattern.exec(content)) !== null) {
    leaks.push({
      type: 'Bearer Token',
      value: match[0].substring(0, 30) + '...',
      position: match.index,
      context: getContext(content, match.index, 50)
    });
  }
  
  // 4. apiKey with non-empty value (fixed regex to only capture between quotes)
  const apiKeyPattern = /apiKey:\s*["']([^"']*)["']/gi;
  while ((match = apiKeyPattern.exec(content)) !== null) {
    // Only flag if the captured value is NOT empty (ignore empty strings)
    if (match[1] !== '') {
      leaks.push({
        type: 'Non-empty apiKey field',
        value: match[1].substring(0, 30) + (match[1].length > 30 ? '...' : ''),
        position: match.index,
        context: getContext(content, match.index, 80)
      });
    }
  }
  
  return leaks;
}

/**
 * Get context around position
 */
function getContext(content, position, length) {
  const start = Math.max(0, position - length);
  const end = Math.min(content.length, position + length);
  return content.substring(start, end)
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Scan JavaScript files in dist/
 */
async function scanBundle() {
  // Find all JS files
  const jsFiles = await glob('**/*.js', { cwd: distPath, absolute: false });
  
  console.log(`📊 Found ${jsFiles.length} JavaScript files\n`);
  
  for (const file of jsFiles) {
    totalFiles++;
    const filePath = path.join(distPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const leaks = detectLeaks(content, file);
    
    if (leaks.length > 0) {
      totalLeaks += leaks.length;
      leakedFiles.push({ file, leaks });
      
      console.log(`❌ ${file}`);
      leaks.forEach((leak, idx) => {
        console.log(`   ${idx + 1}. ${leak.type}: ${leak.value}`);
        console.log(`      Context: ...${leak.context}...`);
      });
      console.log('');
    }
  }
}

// ═══════════════════════════════════════════════════════════
// Main Execution
// ═══════════════════════════════════════════════════════════

(async () => {
  try {
    await scanBundle();
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Scan Results:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Files scanned: ${totalFiles}`);
    console.log(`  Leaks found: ${totalLeaks}`);
    console.log('');
    
    if (totalLeaks > 0) {
      console.log('❌ SECURITY ERROR: API keys detected in bundle!');
      console.log('');
      console.log('🔍 Files with leaks:');
      leakedFiles.forEach(({ file, leaks }) => {
        console.log(`   - ${file} (${leaks.length} leak${leaks.length > 1 ? 's' : ''})`);
      });
      console.log('');
      console.log('💡 How to fix:');
      console.log('   1. Check src/environments/environment.prod.ts');
      console.log('   2. Ensure ALL apiKey fields are empty: apiKey: \'\'');
      console.log('   3. Rebuild: npm run build');
      console.log('   4. Run this check again: node check-bundle-security.js');
      console.log('');
      console.log('📚 See: ENVIRONMENT_CONFIGURATION_ANALYSIS.md');
      console.log('');
      process.exit(1);
    } else {
      console.log('✅ SUCCESS: No API keys found in bundle!');
      console.log('');
      console.log('🎉 Bundle is secure and ready for deployment.');
      console.log('');
      console.log('🔐 API Keys Architecture:');
      console.log('   ├─ Frontend: NO API keys (verified ✅)');
      console.log('   ├─ Local Proxy: Reads from .env');
      console.log('   └─ Netlify Functions: Reads from Environment Variables');
      console.log('');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error during scan:', error.message);
    process.exit(1);
  }
})();
