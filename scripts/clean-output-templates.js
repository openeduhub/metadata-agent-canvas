const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'schemata');

console.log('═══════════════════════════════════════════════════════');
console.log('🧹 Clean Output Templates - Remove Preset Values');
console.log('═══════════════════════════════════════════════════════\n');

// Get all schema files
const schemaFiles = fs.readdirSync(SCHEMA_DIR)
  .filter(f => f.endsWith('.json'));

let totalCleaned = 0;
let totalTemplates = 0;

schemaFiles.forEach(filename => {
  const filePath = path.join(SCHEMA_DIR, filename);
  const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (!schema.output_template || typeof schema.output_template !== 'object') {
    console.log(`⚠️  ${filename} - No output_template, skipping`);
    return;
  }
  
  totalTemplates++;
  console.log(`\n📄 ${filename}`);
  console.log('─'.repeat(50));
  
  let cleanedCount = 0;
  const fieldMap = new Map();
  
  // Build field map for reference
  if (schema.fields && Array.isArray(schema.fields)) {
    schema.fields.forEach(field => {
      if (field.system?.path) {
        fieldMap.set(field.system.path, field);
      }
    });
  }
  
  // Clean output_template
  const cleanedTemplate = {};
  
  Object.keys(schema.output_template).forEach(key => {
    const currentValue = schema.output_template[key];
    const field = fieldMap.get(key);
    
    let cleanValue;
    
    // Special case: @type should be preserved (schema.org types)
    if (key === '@type') {
      cleanValue = currentValue;
      cleanedTemplate[key] = cleanValue;
      return;
    }
    
    // Get datatype from field definition
    const datatype = field?.system?.datatype || 'string';
    const isMultiple = field?.system?.multiple === true;
    
    // Determine clean default based on datatype
    if (isMultiple || datatype === 'array') {
      cleanValue = [];
    } else if (datatype === 'object') {
      // For objects, check if it has nested structure
      if (typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)) {
        // Keep structure but clean values
        cleanValue = {};
        Object.keys(currentValue).forEach(subKey => {
          const subValue = currentValue[subKey];
          if (Array.isArray(subValue)) {
            cleanValue[subKey] = [];
          } else if (typeof subValue === 'number') {
            cleanValue[subKey] = null;
          } else if (typeof subValue === 'boolean') {
            cleanValue[subKey] = false;
          } else {
            cleanValue[subKey] = '';
          }
        });
      } else {
        cleanValue = {};
      }
    } else if (datatype === 'number' || datatype === 'integer') {
      cleanValue = null;
    } else if (datatype === 'boolean') {
      cleanValue = false;
    } else {
      // string, uri, date, etc.
      cleanValue = '';
    }
    
    cleanedTemplate[key] = cleanValue;
    
    // Check if we changed something
    const currentStr = JSON.stringify(currentValue);
    const cleanStr = JSON.stringify(cleanValue);
    
    if (currentStr !== cleanStr) {
      cleanedCount++;
      console.log(`  🧹 ${key}: ${currentStr} → ${cleanStr}`);
    }
  });
  
  if (cleanedCount === 0) {
    console.log('  ✅ Already clean');
  } else {
    console.log(`  ✅ Cleaned ${cleanedCount} fields`);
    totalCleaned += cleanedCount;
    
    // Update schema
    schema.output_template = cleanedTemplate;
    
    // Write back
    const jsonString = JSON.stringify(schema, null, 2);
    fs.writeFileSync(filePath, jsonString + '\n', 'utf8');
    console.log(`  💾 Saved ${filename}`);
  }
});

console.log('\n═══════════════════════════════════════════════════════');
console.log(`🧹 Cleaned ${totalCleaned} preset values across ${totalTemplates} schemas`);
console.log('═══════════════════════════════════════════════════════\n');
