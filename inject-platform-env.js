/**
 * Inject Platform Environment Variable
 * 
 * Priority (highest first):
 * 1. Environment Variable (Vercel/Netlify/CI)
 * 2. .env file (local development)
 * 3. Default 'auto' (if nothing set)
 * 
 * Reads DEPLOYMENT_PLATFORM and injects it into environment.prod.ts at build time.
 * This ensures Environment Variables always have priority over hardcoded values.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Priority: ENV Variable > .env file > default 'auto'
const platform = process.env.DEPLOYMENT_PLATFORM || 'auto';
const envProdPath = path.join(__dirname, 'src/environments/environment.prod.ts');

console.log('═══════════════════════════════════════════════════════');
console.log('📝 Platform Environment Injection');
console.log('═══════════════════════════════════════════════════════');
console.log(`🔍 Checking DEPLOYMENT_PLATFORM...`);

// Check where the value comes from
if (process.env.DEPLOYMENT_PLATFORM) {
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    if (envContent.includes('DEPLOYMENT_PLATFORM=')) {
      console.log(`✅ Source: .env file (local)`);
    } else {
      console.log(`✅ Source: Environment Variable (Vercel/Netlify/CI)`);
    }
  } else {
    console.log(`✅ Source: Environment Variable (Vercel/Netlify/CI)`);
  }
  console.log(`📦 Value: ${platform}`);
} else {
  console.log(`⚠️  Not set - using default: auto`);
  console.log(`💡 Tip: Set DEPLOYMENT_PLATFORM in .env (local) or Environment Variables (Vercel/Netlify)`);
}

console.log(`🎯 Injecting '${platform}' into environment.prod.ts...`);

try {
  let content = fs.readFileSync(envProdPath, 'utf8');
  
  // Replace deploymentPlatform value
  content = content.replace(
    /deploymentPlatform:\s*['"]([^'"]+)['"]/,
    `deploymentPlatform: '${platform}'`
  );
  
  fs.writeFileSync(envProdPath, content, 'utf8');
  console.log(`✅ Successfully injected into environment.prod.ts`);
  console.log('═══════════════════════════════════════════════════════');
} catch (error) {
  console.error(`❌ Error injecting platform:`, error.message);
  process.exit(1);
}
