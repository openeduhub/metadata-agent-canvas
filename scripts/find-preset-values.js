const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'schemata');

console.log('═══════════════════════════════════════════════════════');
console.log('🔍 Find Preset Values in Output Templates');
console.log('═══════════════════════════════════════════════════════\n');

const schemaFiles = fs.readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.json'));

let foundIssues = false;

schemaFiles.forEach(filename => {
  const filePath = path.join(SCHEMA_DIR, filename);
  const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!schema.output_template) return;
  
  const presetValues = [];
  
  Object.keys(schema.output_template).forEach(key => {
    const value = schema.output_template[key];
    
    // Skip @type (intentional)
    if (key === '@type') return;
    
    // Check for preset values (not empty defaults)
    let isPreset = false;
    
    if (Array.isArray(value) && value.length > 0) {
      isPreset = true;
    } else if (typeof value === 'number' && value !== null && value !== 0) {
      isPreset = true;
    } else if (typeof value === 'string' && value !== '') {
      isPreset = true;
    } else if (typeof value === 'boolean' && value !== false) {
      isPreset = true;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Check if object has non-empty values
      const hasPresetInObject = Object.values(value).some(v => {
        if (Array.isArray(v) && v.length > 0) return true;
        if (typeof v === 'number' && v !== null && v !== 0) return true;
        if (typeof v === 'string' && v !== '') return true;
        if (typeof v === 'boolean' && v !== false) return true;
        return false;
      });
      if (hasPresetInObject) isPreset = true;
    }
    
    if (isPreset) {
      presetValues.push({ key, value });
    }
  });
  
  if (presetValues.length > 0) {
    foundIssues = true;
    console.log(`⚠️  ${filename}`);
    presetValues.forEach(({ key, value }) => {
      console.log(`   ${key}: ${JSON.stringify(value)}`);
    });
    console.log('');
  }
});

if (!foundIssues) {
  console.log('✅ All output_templates are clean (no preset values)');
}

console.log('═══════════════════════════════════════════════════════\n');
