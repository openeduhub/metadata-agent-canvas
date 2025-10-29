/**
 * Validate all translations in schemas
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '../src/schemata');

function checkTranslations(obj, path = '', issues = []) {
  if (obj && typeof obj === 'object') {
    // Check if this is an i18n object with de/en
    if (obj.de !== undefined && obj.en !== undefined) {
      const deText = typeof obj.de === 'string' ? obj.de : '';
      const enText = typeof obj.en === 'string' ? obj.en : '';
      
      // Skip technical codes (all uppercase with less than 10 chars)
      const isTechnicalCode = /^[A-Z_\-]{2,10}$/.test(deText);
      
      // Check if identical and not empty and not technical code
      if (deText === enText && deText !== '' && !isTechnicalCode) {
        issues.push(`${path}: "${deText.slice(0, 60)}..."`);
      }
    }
    
    // Recursively check nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        checkTranslations(value, path ? `${path}.${key}` : key, issues);
      }
    }
  }
  
  return issues;
}

function validateSchema(filename) {
  if (filename === 'core.json') {
    console.log(`⏩ ${filename} (skipped)`);
    return { ok: true, issues: [] };
  }
  
  const filePath = path.join(SCHEMA_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  const schema = JSON.parse(content);
  
  const issues = checkTranslations(schema);
  
  if (issues.length === 0) {
    console.log(`✅ ${filename}`);
    return { ok: true, issues: [] };
  } else {
    console.log(`❌ ${filename} (${issues.length} issues):`);
    issues.slice(0, 5).forEach(i => console.log(`   ${i}`));
    if (issues.length > 5) {
      console.log(`   ... and ${issues.length - 5} more`);
    }
    return { ok: false, issues };
  }
}

function main() {
  console.log('🔍 Validating translations in all schemas...\n');
  
  const files = fs.readdirSync(SCHEMA_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  const results = files.map(validateSchema);
  
  const failed = results.filter(r => !r.ok);
  const totalIssues = failed.reduce((sum, r) => sum + r.issues.length, 0);
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ ${results.length - failed.length} schemas OK`);
  console.log(`   ❌ ${failed.length} schemas with issues`);
  console.log(`   📝 ${totalIssues} total untranslated texts`);
  
  if (failed.length === 0) {
    console.log('\n🎉 All translations complete!\n');
  }
}

main();
