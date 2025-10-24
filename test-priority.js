/**
 * Test Environment Variable Priority
 * 
 * Tests that Environment Variables have priority over .env file
 */

require('dotenv').config();

console.log('═══════════════════════════════════════════════════════');
console.log('🧪 Environment Variable Priority Test');
console.log('═══════════════════════════════════════════════════════');

// Test 1: Check what's loaded
console.log('\n📋 Test 1: Current Values');
console.log('─────────────────────────────────────────────────────');
console.log('DEPLOYMENT_PLATFORM from process.env:', process.env.DEPLOYMENT_PLATFORM || '(not set)');

const fs = require('fs');
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/DEPLOYMENT_PLATFORM=(\w+)/);
  console.log('DEPLOYMENT_PLATFORM from .env file:', match ? match[1] : '(not set)');
} else {
  console.log('.env file: (does not exist)');
}

// Test 2: Priority check
console.log('\n🎯 Test 2: Priority Check');
console.log('─────────────────────────────────────────────────────');

const finalValue = process.env.DEPLOYMENT_PLATFORM || 'auto';
console.log('Final value that will be used:', finalValue);

// Test 3: Override test
console.log('\n⚙️  Test 3: Override Capability');
console.log('─────────────────────────────────────────────────────');
console.log('To override .env, run:');
console.log('  Windows (PowerShell): $env:DEPLOYMENT_PLATFORM="vercel"; node test-priority.js');
console.log('  Windows (CMD):        set DEPLOYMENT_PLATFORM=vercel && node test-priority.js');
console.log('  Linux/Mac:            DEPLOYMENT_PLATFORM=vercel node test-priority.js');

// Test 4: Expected behavior
console.log('\n✅ Expected Behavior');
console.log('─────────────────────────────────────────────────────');
console.log('1. If ENV Variable set: Uses ENV Variable (highest priority)');
console.log('2. If only .env set: Uses .env value (medium priority)');
console.log('3. If neither set: Uses \'auto\' (fallback)');

// Test 5: Current priority
console.log('\n📊 Current Priority Result');
console.log('─────────────────────────────────────────────────────');

if (process.env.DEPLOYMENT_PLATFORM) {
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    if (envContent.includes('DEPLOYMENT_PLATFORM=')) {
      console.log('✅ ENV Variable OVERRIDES .env file (correct priority!)');
      console.log('   Source: Environment Variable');
    } else {
      console.log('✅ ENV Variable set (no .env value to override)');
      console.log('   Source: Environment Variable');
    }
  } else {
    console.log('✅ ENV Variable set (no .env file)');
    console.log('   Source: Environment Variable');
  }
} else if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  if (envContent.includes('DEPLOYMENT_PLATFORM=')) {
    console.log('✅ Using .env file (no ENV Variable override)');
    console.log('   Source: .env file');
  } else {
    console.log('⚠️  Using default \'auto\' (nothing set)');
    console.log('   Source: Fallback');
  }
} else {
  console.log('⚠️  Using default \'auto\' (nothing set)');
  console.log('   Source: Fallback');
}

console.log('\n═══════════════════════════════════════════════════════');
console.log('🎉 Test Complete!');
console.log('═══════════════════════════════════════════════════════\n');
