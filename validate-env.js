#!/usr/bin/env node

/**
 * SECURE Environment Configuration Validator
 * 
 * SECURITY PRINCIPLE: NO API KEY INJECTION!
 * 
 * This script:
 * 1. ✅ Validates that environment files have EMPTY API keys
 * 2. ✅ Sets LLM provider selection from environment variable (optional)
 * 3. ✅ Fails build if ANY API keys found in code (prevents leaks)
 * 
 * API Key Architecture:
 * ┌─────────────────────────────────────────────────────┐
 * │ Frontend (Angular)                                  │
 * │ • apiKey: '' (ALWAYS EMPTY)                        │
 * │ • Only has proxy URLs                              │
 * └──────────────┬──────────────────────────────────────┘
 *                │
 *    ┌───────────┴───────────┐
 *    │                       │
 * Local Dev            Netlify Production
 *    │                       │
 *    ▼                       ▼
 * ┌──────────────┐    ┌────────────────┐
 * │ .env file    │    │ Env Variables  │
 * │ (gitignored) │    │ (Dashboard)    │
 * └──────┬───────┘    └────────┬───────┘
 *        │                     │
 *        ▼                     ▼
 * ┌──────────────┐    ┌────────────────┐
 * │ Universal    │    │ Netlify        │
 * │ Proxy        │    │ Functions      │
 * │ (Port 3001)  │    │ (/.netlify/*)  │
 * └──────┬───────┘    └────────┬───────┘
 *        │                     │
 *        └──────────┬──────────┘
 *                   │
 *                   ▼
 *            External APIs
 *       (OpenAI, B-API, etc.)
 */

// Load .env file if it exists (local development only)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed - that's OK for Netlify
}

const fs = require('fs');
const path = require('path');

const envProdPath = path.join(__dirname, 'src', 'environments', 'environment.prod.ts');
const envDevPath = path.join(__dirname, 'src', 'environments', 'environment.ts');

// LLM Provider Selection (optional - defaults to config file value)
const llmProvider = process.env.LLM_PROVIDER || '';

/**
 * SECURITY: Check if file contains ANY API keys (MUST be empty!)
 * Returns: { hasLeak: boolean, leaks: string[] }
 */
function detectApiKeyLeaks(content) {
  const leaks = [];
  
  // 1. Check for OpenAI keys (starts with 'sk-proj-', 'sk-', or old format)
  const openaiMatches = content.matchAll(/apiKey:\s*['"](sk-[^'"]{10,})['"]/g);
  for (const match of openaiMatches) {
    leaks.push({
      type: 'OpenAI API Key',
      preview: match[1].substring(0, 15) + '...',
      fullMatch: match[0]
    });
  }
  
  // 2. Check for UUID format keys (B-API, typically 36 chars with dashes)
  const uuidMatches = content.matchAll(/apiKey:\s*['"]([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})['"]/gi);
  for (const match of uuidMatches) {
    leaks.push({
      type: 'B-API Key (UUID)',
      preview: match[1].substring(0, 20) + '...',
      fullMatch: match[0]
    });
  }
  
  // 3. Check for any non-empty apiKey values (catch-all for any string > 5 chars)
  const nonEmptyMatches = content.matchAll(/apiKey:\s*['"](.{5,}?)['"]/g);
  for (const match of nonEmptyMatches) {
    const value = match[1];
    // Skip if already caught by above checks
    if (!value.startsWith('sk-') && !/^[a-f0-9-]{36}$/i.test(value)) {
      leaks.push({
        type: 'Unknown API Key',
        preview: value.substring(0, 20) + '...',
        fullMatch: match[0]
      });
    }
  }
  
  // 4. CRITICAL: Verify ALL apiKey fields are empty strings
  const allApiKeyFields = content.matchAll(/apiKey:\s*['"](.*?)['"]/g);
  for (const match of allApiKeyFields) {
    if (match[1] !== '') {
      // Found non-empty apiKey that wasn't caught above
      leaks.push({
        type: 'Non-empty apiKey field',
        preview: match[1].substring(0, 20) + (match[1].length > 20 ? '...' : ''),
        fullMatch: match[0]
      });
    }
  }
  
  return {
    hasLeak: leaks.length > 0,
    leaks
  };
}

/**
 * Validate and optionally configure environment file
 */
function validateEnvFile(filePath, fileName) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${fileName} not found!`);
    console.error(`   Expected at: ${filePath}`);
    process.exit(1);
  }

  console.log(`\n📝 Validating ${fileName}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // CRITICAL SECURITY CHECK: Detect API key leaks
  const leakCheck = detectApiKeyLeaks(content);
  
  if (leakCheck.hasLeak) {
    console.error(`\n❌ SECURITY ERROR: API keys found in ${fileName}!`);
    console.error(`\n🔍 Detected leaks:`);
    leakCheck.leaks.forEach((leak, idx) => {
      console.error(`   ${idx + 1}. ${leak.type}: ${leak.preview}`);
    });
    console.error(`\n💡 How to fix:`);
    console.error(`   1. Set all apiKey fields to empty strings: apiKey: ''`);
    console.error(`   2. API keys are provided at runtime:`);
    console.error(`      • Local: Create .env file (see .env.template)`);
    console.error(`      • Netlify: Set in Dashboard → Environment Variables`);
    console.error(`\n📚 See: NETLIFY_SECRETS_CONTROLLER.md for details`);
    process.exit(1);
  }
  
  console.log(`  ✅ Security check PASSED: No API keys in code`);
  
  // Optional: Set LLM Provider from environment variable
  if (llmProvider) {
    const oldContent = content;
    // Match llmProvider field and replace value
    content = content.replace(
      /llmProvider:\s*['"]\w*['"]/,
      `llmProvider: '${llmProvider}'`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Set LLM_PROVIDER: ${llmProvider}`);
      modified = true;
    }
  }
  
  // Write back if modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ ${fileName} updated`);
  } else {
    console.log(`  ✅ ${fileName} validated (no changes needed)`);
  }
}

// ═══════════════════════════════════════════════════════════
// Main Execution
// ═══════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════');
console.log('🔒 SECURE Environment Configuration Validator');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('🔐 Security Architecture:');
console.log('  ├─ Frontend (Angular): NO API keys, only proxy URLs');
console.log('  ├─ Local Proxy: Reads keys from .env file');
console.log('  └─ Netlify Functions: Reads keys from Environment Variables');
console.log('');
console.log('📋 Configuration:');
if (llmProvider) {
  console.log(`  └─ LLM_PROVIDER: ${llmProvider}`);
} else {
  console.log(`  └─ LLM_PROVIDER: (not set - using default from config)`);
}

// Validate both environment files
validateEnvFile(envDevPath, 'environment.ts');
validateEnvFile(envProdPath, 'environment.prod.ts');

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('✅ Validation COMPLETE - Environment files are secure!');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📡 API Request Flow:');
console.log('  Local Dev:  Angular → http://localhost:3001/* → External APIs');
console.log('             (Keys from .env → local-universal-proxy.js)');
console.log('');
console.log('  Production: Angular → /.netlify/functions/* → External APIs');
console.log('             (Keys from Netlify Environment Variables)');
console.log('');
console.log('💡 API keys are injected server-side at request time');
console.log('💡 Frontend NEVER has access to API keys');
console.log('');
