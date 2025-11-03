const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'schemata');

// Files that need output_template generation
const FILES_TO_FIX = [
  'tool_service.json',
  'learning_material.json',
  'occupation.json',
  'prompt.json'
];

console.log('═══════════════════════════════════════════════════════');
console.log('🔧 Generate Output Templates');
console.log('═══════════════════════════════════════════════════════\n');

FILES_TO_FIX.forEach(filename => {
  const filePath = path.join(SCHEMA_DIR, filename);
  
  console.log(`\n📄 Processing ${filename}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return;
  }
  
  const schema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (schema.output_template) {
    console.log(`⚠️  Already has output_template, skipping`);
    return;
  }
  
  if (!schema.fields || !Array.isArray(schema.fields)) {
    console.log(`❌ No fields array found`);
    return;
  }
  
  // Generate output template
  const outputTemplate = {};
  
  schema.fields.forEach(field => {
    if (!field.system?.path) {
      console.log(`  ⚠️  Field ${field.id} has no system.path`);
      return;
    }
    
    const fieldPath = field.system.path;
    const datatype = field.system.datatype || 'string';
    const isMultiple = field.system.multiple === true;
    
    // Determine default value based on datatype
    let defaultValue;
    
    if (isMultiple || datatype === 'array') {
      defaultValue = [];
    } else if (datatype === 'object') {
      // Check if field has shape
      if (field.system.items?.shape) {
        const shape = field.system.items.shape;
        defaultValue = {};
        Object.keys(shape).forEach(key => {
          const shapeType = shape[key];
          if (shapeType === 'string' || shapeType === 'uri') {
            defaultValue[key] = '';
          } else if (shapeType === 'number') {
            defaultValue[key] = null;
          } else if (shapeType === 'boolean') {
            defaultValue[key] = false;
          } else if (typeof shapeType === 'object' && shapeType.type === 'array') {
            defaultValue[key] = [];
          } else {
            defaultValue[key] = '';
          }
        });
      } else {
        defaultValue = {};
      }
    } else if (datatype === 'number' || datatype === 'integer') {
      defaultValue = null;
    } else if (datatype === 'boolean') {
      defaultValue = false;
    } else if (datatype === 'date') {
      defaultValue = '';
    } else {
      // string, uri, etc.
      defaultValue = '';
    }
    
    outputTemplate[fieldPath] = defaultValue;
  });
  
  console.log(`  ✅ Generated template with ${Object.keys(outputTemplate).length} fields`);
  
  // Add output_template to schema
  schema.output_template = outputTemplate;
  
  // Write back to file with pretty formatting
  const jsonString = JSON.stringify(schema, null, 2);
  fs.writeFileSync(filePath, jsonString + '\n', 'utf8');
  
  console.log(`  💾 Saved ${filename}`);
});

console.log('\n═══════════════════════════════════════════════════════');
console.log('✅ Done!');
console.log('═══════════════════════════════════════════════════════\n');
