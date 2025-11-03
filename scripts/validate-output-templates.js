const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'schemata');

// Schema files to check
const SCHEMA_FILES = [
  'core.json',
  'event.json',
  'tool_service.json',
  'education_offer.json',
  'organization.json',
  'person.json',
  'source.json',
  'didactic_planning_tools.json',
  'learning_material.json',
  'occupation.json',
  'prompt.json'
];

console.log('═══════════════════════════════════════════════════════');
console.log('📋 Output Template Validator');
console.log('═══════════════════════════════════════════════════════\n');

let totalIssues = 0;

SCHEMA_FILES.forEach(filename => {
  const filePath = path.join(SCHEMA_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${filename} - File not found, skipping\n`);
    return;
  }

  const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  console.log(`\n📄 ${filename}`);
  console.log('─'.repeat(50));
  
  // Extract field IDs from fields array
  const fieldIds = new Set();
  if (schema.fields && Array.isArray(schema.fields)) {
    schema.fields.forEach(field => {
      if (field.id && field.system?.path) {
        fieldIds.add(field.system.path);
      }
    });
  }
  
  // Get output template keys
  const templateKeys = new Set();
  if (schema.output_template && typeof schema.output_template === 'object') {
    Object.keys(schema.output_template).forEach(key => {
      templateKeys.add(key);
    });
  } else {
    console.log('❌ Missing output_template');
    totalIssues++;
    return;
  }
  
  console.log(`\nFields defined: ${fieldIds.size}`);
  console.log(`Template keys: ${templateKeys.size}`);
  
  // Find missing fields (defined but not in template)
  const missingInTemplate = [];
  fieldIds.forEach(fieldId => {
    if (!templateKeys.has(fieldId)) {
      missingInTemplate.push(fieldId);
    }
  });
  
  // Find extra fields (in template but not defined)
  const extraInTemplate = [];
  templateKeys.forEach(key => {
    if (!fieldIds.has(key)) {
      extraInTemplate.push(key);
    }
  });
  
  // Check for @type (special case, not a field but should be in template for some schemas)
  const hasTypeField = Array.from(templateKeys).some(k => k === '@type');
  
  // Report
  if (missingInTemplate.length === 0 && extraInTemplate.length === 0) {
    console.log('✅ Perfect match!');
  } else {
    if (missingInTemplate.length > 0) {
      console.log(`\n⚠️  Missing in output_template (${missingInTemplate.length}):`);
      missingInTemplate.forEach(field => {
        console.log(`   - ${field}`);
        totalIssues++;
      });
    }
    
    if (extraInTemplate.length > 0) {
      console.log(`\n⚠️  Extra in output_template (${extraInTemplate.length}):`);
      extraInTemplate.forEach(field => {
        // @type is special and may be expected
        if (field === '@type') {
          console.log(`   - ${field} (may be intentional)`);
        } else {
          console.log(`   - ${field}`);
          totalIssues++;
        }
      });
    }
  }
  
  // Additional checks
  if (hasTypeField) {
    console.log('\nℹ️  Has @type field (schema.org type)');
  }
});

console.log('\n═══════════════════════════════════════════════════════');
if (totalIssues === 0) {
  console.log('✅ All output_templates are valid!');
} else {
  console.log(`⚠️  Found ${totalIssues} issues`);
}
console.log('═══════════════════════════════════════════════════════\n');
