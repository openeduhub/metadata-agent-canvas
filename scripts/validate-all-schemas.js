/**
 * Comprehensive schema validation
 * Tests structure, i18n, and compatibility with the app
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '../src/schemata');
const schemaFiles = fs.readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.json'));

console.log('🔍 Validating all schemas for app compatibility\n');

let totalErrors = 0;
let totalWarnings = 0;

schemaFiles.forEach(file => {
  console.log(`\n📄 Checking ${file}...`);
  const filePath = path.join(SCHEMA_DIR, file);
  const schema = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  let errors = 0;
  let warnings = 0;
  
  // 1. Check required top-level properties
  if (!schema.profileId) {
    console.log(`  ❌ Missing profileId`);
    errors++;
  }
  
  if (!schema.version) {
    console.log(`  ⚠️  Missing version`);
    warnings++;
  }
  
  if (!schema['@context']) {
    console.log(`  ⚠️  Missing @context`);
    warnings++;
  }
  
  // 2. Check groups
  if (!schema.groups || !Array.isArray(schema.groups)) {
    console.log(`  ❌ Missing or invalid groups array`);
    errors++;
  } else {
    schema.groups.forEach((group, idx) => {
      if (!group.id) {
        console.log(`  ❌ Group ${idx} missing id`);
        errors++;
      }
      
      if (!group.label) {
        console.log(`  ❌ Group "${group.id}" missing label`);
        errors++;
      } else if (typeof group.label !== 'object') {
        console.log(`  ❌ Group "${group.id}" label is not an i18n object`);
        errors++;
      } else {
        if (!group.label.de) {
          console.log(`  ❌ Group "${group.id}" missing label.de`);
          errors++;
        }
        if (!group.label.en) {
          console.log(`  ⚠️  Group "${group.id}" missing label.en`);
          warnings++;
        }
      }
      
      if (group.system) {
        console.log(`  ❌ Group "${group.id}" has invalid system property (should only be in fields!)`);
        errors++;
      }
    });
  }
  
  // 3. Check fields
  if (!schema.fields || !Array.isArray(schema.fields)) {
    console.log(`  ❌ Missing or invalid fields array`);
    errors++;
  } else {
    schema.fields.forEach((field, idx) => {
      if (!field.id) {
        console.log(`  ❌ Field ${idx} missing id`);
        errors++;
      }
      
      if (!field.group) {
        console.log(`  ⚠️  Field "${field.id}" missing group`);
        warnings++;
      }
      
      if (!field.label) {
        console.log(`  ❌ Field "${field.id}" missing label`);
        errors++;
      } else if (typeof field.label !== 'object') {
        console.log(`  ❌ Field "${field.id}" label is not an i18n object`);
        errors++;
      } else {
        if (!field.label.de) {
          console.log(`  ❌ Field "${field.id}" missing label.de`);
          errors++;
        }
        if (!field.label.en) {
          console.log(`  ⚠️  Field "${field.id}" missing label.en`);
          warnings++;
        }
      }
      
      if (!field.system) {
        console.log(`  ❌ Field "${field.id}" missing system`);
        errors++;
      } else {
        if (!field.system.datatype) {
          console.log(`  ⚠️  Field "${field.id}" missing system.datatype`);
          warnings++;
        }
        
        // Check vocabulary structure
        if (field.system.vocabulary) {
          const vocab = field.system.vocabulary;
          if (!vocab.type) {
            console.log(`  ⚠️  Field "${field.id}" vocabulary missing type`);
            warnings++;
          }
          
          if (vocab.concepts && Array.isArray(vocab.concepts)) {
            vocab.concepts.forEach((concept, cidx) => {
              if (!concept.label) {
                console.log(`  ⚠️  Field "${field.id}" concept ${cidx} missing label`);
                warnings++;
              } else if (typeof concept.label === 'object') {
                if (!concept.label.de) {
                  console.log(`  ⚠️  Field "${field.id}" concept ${cidx} missing label.de`);
                  warnings++;
                }
                if (!concept.label.en) {
                  console.log(`  ⚠️  Field "${field.id}" concept ${cidx} missing label.en`);
                  warnings++;
                }
              }
            });
          }
        }
      }
    });
  }
  
  totalErrors += errors;
  totalWarnings += warnings;
  
  if (errors === 0 && warnings === 0) {
    console.log(`  ✅ Perfect!`);
  } else {
    console.log(`  📊 ${errors} errors, ${warnings} warnings`);
  }
});

console.log(`\n\n📊 Summary:`);
console.log(`  Total schemas checked: ${schemaFiles.length}`);
console.log(`  Total errors: ${totalErrors}`);
console.log(`  Total warnings: ${totalWarnings}`);

if (totalErrors === 0 && totalWarnings === 0) {
  console.log(`\n✅ All schemas are perfect and app-compatible!`);
  process.exit(0);
} else if (totalErrors === 0) {
  console.log(`\n⚠️  All schemas valid, but some warnings to review`);
  process.exit(0);
} else {
  console.log(`\n❌ Some schemas have errors that need fixing!`);
  process.exit(1);
}
