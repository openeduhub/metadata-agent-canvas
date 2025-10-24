/**
 * Smart Build Script - Platform-Aware
 * 
 * Reads DEPLOYMENT_PLATFORM from:
 * 1. Environment variable (Netlify/Vercel/CI)
 * 2. .env file (local development)
 * 3. Defaults to 'auto' (runtime detection)
 * 
 * Then triggers the appropriate Angular build configuration.
 */

require('dotenv').config();
const { execSync } = require('child_process');

// Read platform from environment
const platform = process.env.DEPLOYMENT_PLATFORM || 'auto';

console.log('═══════════════════════════════════════════════════════');
console.log('🏗️  Smart Build Script - Platform-Aware');
console.log('═══════════════════════════════════════════════════════');
console.log(`📦 DEPLOYMENT_PLATFORM: ${platform}`);

// Map platform to Angular build configuration
let buildConfig = 'production'; // Always use production config
let platformMsg = '';

switch (platform.toLowerCase()) {
  case 'vercel':
    platformMsg = '✅ DEPLOYMENT_PLATFORM=vercel → /api/* endpoints';
    break;
  case 'netlify':
    platformMsg = '✅ DEPLOYMENT_PLATFORM=netlify → /.netlify/functions/* endpoints';
    break;
  case 'local':
    buildConfig = 'development'; // Only local uses dev config
    platformMsg = '✅ DEPLOYMENT_PLATFORM=local → http://localhost:3001/* endpoints';
    break;
  case 'auto':
  default:
    platformMsg = '✅ DEPLOYMENT_PLATFORM=auto → runtime hostname detection';
    break;
}

console.log(platformMsg);
console.log(`🔨 Build configuration: ${buildConfig}`);

// Step 1: Inject platform into environment.prod.ts (if not local)
if (platform.toLowerCase() !== 'local') {
  console.log('📝 Step 1: Injecting DEPLOYMENT_PLATFORM into environment.prod.ts...');
  try {
    execSync('node inject-platform-env.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Failed to inject platform environment');
    process.exit(1);
  }
}

// Step 2: Build
const buildCommand = `ng build --configuration ${buildConfig}`;

console.log(`🔨 Step 2: Building with: ${buildCommand}`);
console.log('═══════════════════════════════════════════════════════');

try {
  execSync(buildCommand, { stdio: 'inherit' });
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ Build completed successfully!');
  console.log('═══════════════════════════════════════════════════════');
} catch (error) {
  console.error('❌ Build failed!');
  process.exit(1);
}
