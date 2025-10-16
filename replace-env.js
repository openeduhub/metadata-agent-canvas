#!/usr/bin/env node

/**
 * Replace environment variables in environment files at build time
 * Supports multiple LLM providers: OpenAI, B-API OpenAI, and B-API AcademicCloud
 * 
 * Environment Variables:
 * - LLM_PROVIDER: 'openai', 'b-api-openai', or 'b-api-academiccloud'
 * - OPENAI_API_KEY: OpenAI API key
 * - OPENAI_MODEL: OpenAI model name
 * - B_API_KEY: B-API key (used for both b-api-openai and b-api-academiccloud)
 * - B_MODEL: B-API model name (optional, defaults are set per provider)
 * 
 * Works for both development and production
 */

const fs = require('fs');
const path = require('path');

const envProdPath = path.join(__dirname, 'src', 'environments', 'environment.prod.ts');
const envDevPath = path.join(__dirname, 'src', 'environments', 'environment.ts');

// LLM Provider Selection
const llmProvider = process.env.LLM_PROVIDER || '';

// OpenAI Configuration
const apiKey = process.env.OPENAI_API_KEY || '';
const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const baseUrl = process.env.OPENAI_BASE_URL || '';
const gpt5ReasoningEffort = process.env.GPT5_REASONING_EFFORT || 'medium';
const gpt5Verbosity = process.env.GPT5_VERBOSITY || 'low';

// B-API Configuration (shared across both B-API providers)
const bApiKey = process.env.B_API_KEY || '';
const bModel = process.env.B_MODEL || ''; // Empty means use provider default

// Template for environment.prod.ts if it doesn't exist
const envProdTemplate = `export const environment = {
  production: true,
  
  // OpenAI Configuration
  openai: {
    apiKey: '${apiKey}', // ${apiKey ? 'Injected from Vercel environment variable' : 'Empty - user will be prompted'}
    baseUrl: '', // Optional: Custom OpenAI-compatible endpoint
    model: 'gpt-4o-mini', // Standard model
    temperature: 0.3,
    
    // GPT-5 specific settings (only used if model starts with 'gpt-5')
    gpt5: {
      reasoningEffort: 'medium', // 'low' | 'medium' | 'high'
      verbosity: 'low' // 'low' | 'medium' | 'high'
    }
  },

  // Canvas Settings
  canvas: {
    batchSize: 10,
    batchDelayMs: 100,
    timeout: 60000
  }
};
`;

/**
 * Check if file already has an API key (OpenAI or B-API providers)
 */
function hasExistingApiKey(content) {
  // Check for OpenAI key (starts with 'sk-')
  const openaiKeyMatch = content.match(/openai:\s*{[^}]*apiKey:\s*['"](sk-[^'"]+)['"]/s);
  if (openaiKeyMatch && openaiKeyMatch[1] && openaiKeyMatch[1].length > 10) {
    return true;
  }
  
  // Check for B-API OpenAI key (UUID format)
  const bApiOpenaiKeyMatch = content.match(/bApiOpenai:\s*{[^}]*apiKey:\s*['"]([a-f0-9-]{36})['"]/s);
  if (bApiOpenaiKeyMatch && bApiOpenaiKeyMatch[1] && bApiOpenaiKeyMatch[1].length > 10) {
    return true;
  }
  
  // Check for B-API AcademicCloud key (UUID format)
  const bApiAcademicCloudKeyMatch = content.match(/bApiAcademicCloud:\s*{[^}]*apiKey:\s*['"]([a-f0-9-]{36})['"]/s);
  if (bApiAcademicCloudKeyMatch && bApiAcademicCloudKeyMatch[1] && bApiAcademicCloudKeyMatch[1].length > 10) {
    return true;
  }
  
  return false;
}

/**
 * Process an environment file
 */
function processEnvFile(filePath, fileName) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${fileName} not found, skipping...`);
    return;
  }

  console.log(`\n📝 Processing ${fileName}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file already has an API key
  const hasKey = hasExistingApiKey(content);
  if (hasKey) {
    console.log(`  ℹ️  File already contains an API key, skipping injection`);
    console.log(`  💡 To inject from environment variables, remove the existing key first`);
    return;
  }

  // Replace API Key
  if (apiKey) {
    const oldContent = content;
    content = content.replace(
      /apiKey:\s*['"][^'"]*['"]\s*,?\s*\/\/.*$/m,
      `apiKey: '${apiKey}', // Injected from environment variable`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Injected OPENAI_API_KEY`);
      modified = true;
    }
  }

  // Replace Model
  if (model) {
    const oldContent = content;
    content = content.replace(
      /model:\s*['"][^'"]*['"]\s*,?\s*\/\/.*$/m,
      `model: '${model}', // Injected from environment variable`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Injected OPENAI_MODEL: ${model}`);
      modified = true;
    }
  }

  // Replace Base URL
  if (baseUrl) {
    const oldContent = content;
    content = content.replace(
      /baseUrl:\s*['"][^'"]*['"]\s*,?\s*\/\/.*$/m,
      `baseUrl: '${baseUrl}', // Injected from environment variable`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Injected OPENAI_BASE_URL`);
      modified = true;
    }
  }

  // Replace GPT-5 Reasoning Effort
  if (gpt5ReasoningEffort) {
    const oldContent = content;
    content = content.replace(
      /reasoningEffort:\s*['"][^'"]*['"]\s*,?\s*\/\/.*$/m,
      `reasoningEffort: '${gpt5ReasoningEffort}', // Injected from environment variable`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Injected GPT5_REASONING_EFFORT: ${gpt5ReasoningEffort}`);
      modified = true;
    }
  }

  // Replace GPT-5 Verbosity
  if (gpt5Verbosity) {
    const oldContent = content;
    content = content.replace(
      /verbosity:\s*['"][^'"]*['"]\s*,?\s*\/\/.*$/m,
      `verbosity: '${gpt5Verbosity}' // Injected from environment variable`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Injected GPT5_VERBOSITY: ${gpt5Verbosity}`);
      modified = true;
    }
  }

  // Replace LLM Provider Selection
  if (llmProvider) {
    const oldContent = content;
    content = content.replace(
      /llmProvider:\s*['"][^'"]*['"]\s*,?\s*\/\/.*$/m,
      `llmProvider: '${llmProvider}', // Injected from environment variable`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Injected LLM_PROVIDER: ${llmProvider}`);
      modified = true;
    }
  }

  // Replace B-API OpenAI API Key
  if (bApiKey) {
    const oldContent = content;
    // Match bApiOpenai apiKey specifically
    content = content.replace(
      /(bApiOpenai:\s*{[^}]*apiKey:\s*)['"][^'"]*['"]/s,
      `$1'${bApiKey}'`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Injected B_API_KEY for bApiOpenai`);
      modified = true;
    }
  }

  // Replace B-API AcademicCloud API Key
  if (bApiKey) {
    const oldContent = content;
    // Match bApiAcademicCloud apiKey specifically
    content = content.replace(
      /(bApiAcademicCloud:\s*{[^}]*apiKey:\s*)['"][^'"]*['"]/s,
      `$1'${bApiKey}'`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Injected B_API_KEY for bApiAcademicCloud`);
      modified = true;
    }
  }

  // Replace B-API OpenAI Model (if provided)
  if (bModel) {
    const oldContent = content;
    // Match bApiOpenai model specifically
    content = content.replace(
      /(bApiOpenai:\s*{[^}]*\n[^}]*model:\s*)['"][^'"]*['"]/s,
      `$1'${bModel}'`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Injected B_MODEL for bApiOpenai: ${bModel}`);
      modified = true;
    }
  }

  // Replace B-API AcademicCloud Model (if provided)
  if (bModel) {
    const oldContent = content;
    // Match bApiAcademicCloud model specifically
    content = content.replace(
      /(bApiAcademicCloud:\s*{[^}]*\n[^}]*model:\s*)['"][^'"]*['"]/s,
      `$1'${bModel}'`
    );
    if (content !== oldContent) {
      console.log(`  ✅ Injected B_MODEL for bApiAcademicCloud: ${bModel}`);
      modified = true;
    }
  }

  // Write back if modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ ${fileName} updated`);
  } else {
    console.log(`  ℹ️  No changes needed for ${fileName}`);
  }
}

// Process both environment files
console.log('🔧 Processing environment files...');
console.log(`📋 Environment variables:`);
console.log(`\n🔹 LLM Provider:`);
console.log(`  - LLM_PROVIDER: ${llmProvider || '(not set - using config default)'}`);
console.log(`\n🔹 OpenAI Configuration:`);
console.log(`  - OPENAI_API_KEY: ${apiKey ? '✅ Found' : '❌ Not set'}`);
console.log(`  - OPENAI_MODEL: ${model}`);
console.log(`  - OPENAI_BASE_URL: ${baseUrl || '(empty)'}`);
console.log(`  - GPT5_REASONING_EFFORT: ${gpt5ReasoningEffort}`);
console.log(`  - GPT5_VERBOSITY: ${gpt5Verbosity}`);
console.log(`\n🔹 B-API Configuration (shared for both endpoints):`);
console.log(`  - B_API_KEY: ${bApiKey ? '✅ Found' : '❌ Not set'}`);
console.log(`  - B_MODEL: ${bModel || '(using provider defaults: gpt-4.1-mini / deepseek-r1)'}`);
console.log(`  - Endpoints:`);
console.log(`    • b-api-openai: https://b-api.staging.openeduhub.net/api/v1/llm/openai`);
console.log(`    • b-api-academiccloud: https://b-api.staging.openeduhub.net/api/v1/llm/academiccloud`);

processEnvFile(envDevPath, 'environment.ts');
processEnvFile(envProdPath, 'environment.prod.ts');

console.log('\n✅ Environment processing complete');

if (!apiKey && !bApiKey) {
  console.log('\n⚠️  Warning: No API keys found in environment variables');
  console.log('💡 For OpenAI: set OPENAI_API_KEY=sk-your-key-here');
  console.log('💡 For Provider B: set B_API_KEY=your-uuid-key-here');
  console.log('💡 Or edit the environment files directly');
} else {
  console.log('\n💡 Note: Existing API keys in files are preserved');
  console.log('💡 To use environment variables, ensure apiKey fields are empty in the files');
  if (llmProvider) {
    console.log(`💡 Active provider will be: ${llmProvider.toUpperCase()}`);
  }
}
