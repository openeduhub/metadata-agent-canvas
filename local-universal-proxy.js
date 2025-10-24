#!/usr/bin/env node

/**
 * Universal Local Development Proxy
 * Handles ALL API requests to avoid CORS issues
 * 
 * Supports:
 * - LLM APIs (OpenAI, B-API OpenAI, B-API AcademicCloud)
 * - Geocoding API (Photon)
 * - Repository API (edu-sharing)
 * 
 * Usage: node local-universal-proxy.js
 * Or: npm run proxy
 */

// Load .env file FIRST
require('dotenv').config();

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

// API Credentials from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const B_API_KEY = process.env.B_API_KEY;

// Repository Guest credentials
const REPO_GUEST = {
  username: 'WLO-Upload',
  password: 'wlo#upload!20'
};

console.log('🚀 Starting Universal API Proxy...');
console.log(`📡 Proxy listening on: http://localhost:${PORT}`);
console.log('');
console.log('🔌 Supported endpoints:');
console.log('   • /llm          - LLM APIs (OpenAI, B-API)');
console.log('   • /geocoding   - Photon Geocoding');
console.log('   • /repository  - edu-sharing Repository');
console.log('');

if (OPENAI_API_KEY) {
  console.log(`🔑 OpenAI API Key: ${OPENAI_API_KEY.substring(0, 20)}...`);
}
if (B_API_KEY) {
  console.log(`🔑 B-API Key: ${B_API_KEY.substring(0, 20)}...`);
}
console.log(`🔑 Repository: WLO Guest credentials configured`);
console.log('');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-KEY',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // Route based on pathname
  if (pathname.startsWith('/llm')) {
    handleLLM(req, res);
  } else if (pathname.startsWith('/geocoding')) {
    handleGeocoding(req, res, parsedUrl.query);
  } else if (pathname.startsWith('/repository')) {
    handleRepository(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Not found',
      availableEndpoints: ['/llm', '/geocoding', '/repository']
    }));
  }
});

/**
 * Handle LLM API requests (OpenAI, B-API)
 */
function handleLLM(req, res) {
  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  collectBody(req, async (body) => {
    try {
      const requestData = JSON.parse(body);
      const provider = requestData.provider || 'openai';
      
      let config = getProviderConfig(provider);
      
      console.log(`📤 LLM request: ${provider.toUpperCase()}`);
      console.log(`   Model: ${requestData.model || 'default'}`);
      
      // Remove provider field
      delete requestData.provider;
      
      const result = await proxyRequest(config, requestData);
      sendJSON(res, 200, result);
      
      console.log(`✅ LLM response: ${provider.toUpperCase()}`);
      
    } catch (error) {
      console.error('❌ LLM error:', error.message);
      sendError(res, 500, error.message);
    }
  });
}

/**
 * Handle Geocoding API requests
 */
function handleGeocoding(req, res, query) {
  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  const location = query.q || '';
  
  if (!location) {
    sendError(res, 400, 'Missing q parameter');
    return;
  }

  console.log(`🗺️  Geocoding request: ${location}`);

  const config = {
    hostname: 'photon.komoot.io',
    path: `/api/?q=${encodeURIComponent(location)}&limit=5`,
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'WLO-Metadata-Agent/1.0'
    }
  };

  proxyRequest(config).then(result => {
    sendJSON(res, 200, result);
    console.log(`✅ Geocoding response: ${result.features?.length || 0} results`);
  }).catch(error => {
    console.error('❌ Geocoding error:', error.message);
    sendError(res, 500, error.message);
  });
}

/**
 * Handle Repository API requests
 */
function handleRepository(req, res) {
  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed');
    return;
  }

  collectBody(req, async (body) => {
    try {
      const requestData = JSON.parse(body);
      const action = requestData.action;
      const data = requestData.data;
      
      console.log(`📦 Repository action: ${action}`);
      
      const authHeader = 'Basic ' + Buffer.from(
        `${REPO_GUEST.username}:${REPO_GUEST.password}`
      ).toString('base64');
      
      let result;
      
      switch (action) {
        case 'checkDuplicate':
          result = await checkDuplicate(data.url, authHeader);
          break;
        case 'createNode':
          result = await createNode(data.metadata, authHeader);
          break;
        case 'setMetadata':
          result = await setMetadata(data.nodeId, data.metadata, authHeader);
          break;
        case 'setCollections':
          result = await setCollections(data.nodeId, data.collectionIds, authHeader);
          break;
        case 'startWorkflow':
          result = await startWorkflow(data.nodeId, authHeader);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      sendJSON(res, 200, result);
      console.log(`✅ Repository action complete: ${action}`);
      
    } catch (error) {
      console.error('❌ Repository error:', error.message);
      sendError(res, 500, error.message);
    }
  });
}

/**
 * Get provider configuration
 */
function getProviderConfig(provider) {
  switch (provider) {
    case 'b-api-openai':
      if (!B_API_KEY) {
        throw new Error('B_API_KEY not configured');
      }
      return {
        hostname: 'b-api.staging.openeduhub.net',
        path: '/api/v1/llm/openai/chat/completions',
        method: 'POST',
        headers: {
          'X-API-KEY': B_API_KEY,
          'Content-Type': 'application/json'
        }
      };
      
    case 'b-api-academiccloud':
      if (!B_API_KEY) {
        throw new Error('B_API_KEY not configured');
      }
      return {
        hostname: 'b-api.staging.openeduhub.net',
        path: '/api/v1/llm/academiccloud/chat/completions',
        method: 'POST',
        headers: {
          'X-API-KEY': B_API_KEY,
          'Content-Type': 'application/json'
        }
      };
      
    default: // openai
      if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured');
      }
      return {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };
  }
}

/**
 * Generic proxy request handler
 */
function proxyRequest(config, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(config, (response) => {
      let responseBody = '';
      
      response.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            resolve(responseBody);
          }
        } else {
          reject(new Error(`HTTP ${response.statusCode}: ${responseBody}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

/**
 * Repository API helpers
 */
async function checkDuplicate(url, authHeader) {
  const config = {
    hostname: 'repository.staging.openeduhub.net',
    // Add query parameters like browser plugin does
    path: '/edu-sharing/rest/search/v1/queries/-home-/mds_oeh/ngsearch?contentType=FILES&maxItems=1&skipCount=0&propertyFilter=-all-',
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  // Match browser plugin format: only criteria, no facettes
  const searchBody = {
    criteria: [{ property: 'ccm:wwwurl', values: [url] }]
  };
  
  const data = await proxyRequest(config, searchBody);
  
  if (data.nodes && data.nodes.length > 0) {
    const node = data.nodes[0];
    return {
      exists: true,
      nodeId: node.ref.id,
      title: node.title || node.properties?.['cclom:title']?.[0] || 'Unbekannter Titel'
    };
  }
  
  return { exists: false };
}

async function createNode(metadata, authHeader) {
  const inboxId = '21144164-30c0-4c01-ae16-264452197063';
  
  // For createNode: Only send CCM/CCLOM fields (standard repository fields)
  // Exclude EVENT fields (schema:*, oeh:eventType) - they will be set later via setMetadata
  const cleanMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    // Skip virtual fields
    if (key.startsWith('virtual:')) {
      continue;
    }
    
    // EXCLUDE Event/Schema.org fields - they are not supported at createNode
    if (key.startsWith('schema:') || key === 'oeh:eventType') {
      console.log(`   ⏭️  Skipping event field (will be set later): ${key}`);
      continue;
    }
    
    // Skip null or undefined values
    if (value === null || value === undefined) {
      continue;
    }
    
    // Skip empty arrays
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    
    // Skip empty strings
    if (value === '') {
      continue;
    }
    
    // Only allow ESSENTIAL basic fields for node creation
    // All other metadata (taxonid, educationalcontext, etc.) will be set via setMetadata
    const essentialFields = [
      'cclom:title',
      'cclom:general_description',
      'cclom:general_keyword',
      'ccm:wwwurl',
      'cclom:general_language'
    ];
    
    if (essentialFields.includes(key)) {
      cleanMetadata[key] = value;
    }
  }
  
  // CRITICAL: Repository requires ALL values as arrays (even single values)
  // Convert all string values to arrays, but don't double-wrap arrays
  const normalizedMetadata = {};
  for (const [key, value] of Object.entries(cleanMetadata)) {
    if (Array.isArray(value)) {
      // Already an array, use as-is
      normalizedMetadata[key] = value;
    } else if (value !== null && value !== undefined && value !== '') {
      // Single value, wrap in array
      normalizedMetadata[key] = [value];
    }
    // Skip null/undefined/empty values
  }
  
  console.log(`   📤 Sending ${Object.keys(normalizedMetadata).length} CCM/CCLOM fields for node creation`);
  console.log(`   📋 Fields: ${Object.keys(normalizedMetadata).join(', ')}`);
  console.log(`   📊 Data preview:`, JSON.stringify(normalizedMetadata, null, 2).substring(0, 500));
  
  const config = {
    hostname: 'repository.staging.openeduhub.net',
    path: `/edu-sharing/rest/node/v1/nodes/-home-/${inboxId}/children?type=ccm%3Aio&renameIfExists=true&versionComment=MAIN_FILE_UPLOAD`,
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  const data = await proxyRequest(config, normalizedMetadata);
  return { nodeId: data.node.ref.id };
}

async function setMetadata(nodeId, metadata, authHeader) {
  // Filter metadata: Only send fields that browser plugin uses (proven to work)
  // + Testing additional URI fields (Fach, Bildungsstufe, Zielgruppe)
  const supportedFields = [
    'cclom:title',
    'cclom:general_description',
    'cclom:general_keyword',
    'ccm:wwwurl',
    'cclom:general_language',                // Language - works!
    'ccm:taxonid',                           // Fach (Discipline)
    'ccm:educationalcontext',                // Bildungsstufe - TESTING
    'ccm:educationalintendedenduserrole',    // Zielgruppe - TESTING
    'ccm:commonlicense_key',                 // License
    'ccm:commonlicense_cc_version',          // License version
    'ccm:custom_license'                     // Will be transformed to above
  ];
  
  const cleanMetadata = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    // Skip virtual fields
    if (key.startsWith('virtual:')) {
      continue;
    }
    
    // Only allow supported fields
    if (!supportedFields.includes(key)) {
      console.log(`   ⏭️  Skipping unsupported field: ${key}`);
      continue;
    }
    
    // Skip null/undefined/empty
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    
    console.log(`   ✓ Including field ${key}:`, typeof value, Array.isArray(value) ? `Array[${value.length}]` : '');
    cleanMetadata[key] = value;
  }
  
  // Transform license (ccm:custom_license URL to ccm:commonlicense_key + version)
  // Frontend may send either: URL string or object {label, uri}
  if (cleanMetadata['ccm:custom_license']) {
    let licenseUrl = Array.isArray(cleanMetadata['ccm:custom_license']) 
      ? cleanMetadata['ccm:custom_license'][0] 
      : cleanMetadata['ccm:custom_license'];
    
    // Extract URL from object if needed
    if (typeof licenseUrl === 'object' && licenseUrl !== null) {
      licenseUrl = licenseUrl.uri || licenseUrl.label || '';
    }
    
    if (licenseUrl && typeof licenseUrl === 'string') {
      const license = licenseUrl.substring(licenseUrl.lastIndexOf('/') + 1);
      
      if (license.endsWith('_40')) {
        cleanMetadata['ccm:commonlicense_key'] = [license.slice(0, -3)];
        cleanMetadata['ccm:commonlicense_cc_version'] = ['4.0'];
      } else if (license === 'OTHER') {
        cleanMetadata['ccm:commonlicense_key'] = ['CUSTOM'];
      } else {
        cleanMetadata['ccm:commonlicense_key'] = [license];
      }
      
      delete cleanMetadata['ccm:custom_license'];
    }
  }
  
  // Transform license key: Object {label: "CC BY-SA"} → String "CC_BY_SA"
  if (cleanMetadata['ccm:commonlicense_key']) {
    const licenseKey = Array.isArray(cleanMetadata['ccm:commonlicense_key'])
      ? cleanMetadata['ccm:commonlicense_key'][0]
      : cleanMetadata['ccm:commonlicense_key'];
      
    if (typeof licenseKey === 'object' && licenseKey !== null) {
      // Extract from object - use label (e.g., "CC BY-SA")
      const label = licenseKey.label || '';
      if (label) {
        // Convert "CC BY-SA" to "CC_BY_SA" (spaces AND hyphens to underscores, uppercase)
        cleanMetadata['ccm:commonlicense_key'] = [label.replace(/[\s\-]+/g, '_').toUpperCase()];
      }
    }
  }
  
  // Transform license version: ensure it's a string
  if (cleanMetadata['ccm:commonlicense_cc_version']) {
    const version = Array.isArray(cleanMetadata['ccm:commonlicense_cc_version'])
      ? cleanMetadata['ccm:commonlicense_cc_version'][0]
      : cleanMetadata['ccm:commonlicense_cc_version'];
      
    if (typeof version === 'object' && version !== null) {
      const versionStr = version.label || version.value || '';
      if (versionStr) {
        cleanMetadata['ccm:commonlicense_cc_version'] = [versionStr];
      }
    }
  }
  
  // Fallback: If license is set but version is empty, default to "4.0"
  if (cleanMetadata['ccm:commonlicense_key'] && 
      (!cleanMetadata['ccm:commonlicense_cc_version'] || 
       cleanMetadata['ccm:commonlicense_cc_version'].length === 0 ||
       cleanMetadata['ccm:commonlicense_cc_version'][0] === '')) {
    console.log(`   ℹ️  License set but no version - defaulting to 4.0`);
    cleanMetadata['ccm:commonlicense_cc_version'] = ['4.0'];
  }
  
  // CRITICAL: Repository requires ALL values as arrays (even single values)
  // Extract URIs from objects, keep strings as-is
  const normalizedMetadata = {};
  for (const [key, value] of Object.entries(cleanMetadata)) {
    if (Array.isArray(value)) {
      // Special case: Text/String fields - no URI extraction
      const textFields = [
        'cclom:general_keyword', 
        'cclom:title', 
        'cclom:general_description', 
        'ccm:wwwurl', 
        'cclom:general_language',
        'ccm:commonlicense_key',      // Already transformed to "CC_BY" format
        'ccm:commonlicense_cc_version' // Already a version string like "4.0"
      ];
      if (textFields.includes(key)) {
        normalizedMetadata[key] = value.filter(item => item && item !== '');
      } else {
        // URI fields (taxonid, educationalcontext, etc.): Extract ONLY URI
        // Repository auto-maps to *_display fields for labels
        normalizedMetadata[key] = value.map(item => {
          if (typeof item === 'object' && item !== null) {
            // Object with {label, uri} → extract ONLY uri
            return item.uri || '';
          }
          return item;
        }).filter(item => item !== '');
      }
    } else if (typeof value === 'object' && value !== null) {
      // Single object → extract ONLY uri and wrap in array
      if (value.uri) {
        normalizedMetadata[key] = [value.uri];
      }
    } else if (value !== null && value !== undefined && value !== '') {
      // Single string value, wrap in array
      normalizedMetadata[key] = [value];
    }
    // Skip null/undefined/empty values
  }
  
  console.log(`   📤 Sending ${Object.keys(normalizedMetadata).length} fields to setMetadata`);
  console.log(`   📋 Fields:`, Object.keys(normalizedMetadata).join(', '));
  console.log(`   📊 Complete data being sent:`, JSON.stringify(normalizedMetadata, null, 2));
  
  const config = {
    hostname: 'repository.staging.openeduhub.net',
    path: `/edu-sharing/rest/node/v1/nodes/-home-/${nodeId}/metadata?versionComment=METADATA_UPDATE`,
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  await proxyRequest(config, normalizedMetadata);
  return { success: true };
}

async function setCollections(nodeId, collectionIds, authHeader) {
  const results = [];
  
  // Extract collection IDs from URLs (e.g., "http://.../.../UUID" -> "UUID")
  const extractedIds = collectionIds
    .filter(id => id && id.trim())
    .map(id => {
      // If it's a URL, extract the last part
      if (typeof id === 'string' && id.includes('/')) {
        return id.substring(id.lastIndexOf('/') + 1);
      }
      return id;
    });
  
  for (const collectionId of extractedIds) {
    try {
      const config = {
        hostname: 'repository.staging.openeduhub.net',
        path: `/edu-sharing/rest/collection/v1/collections/-home-/${collectionId}/references/${nodeId}`,
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      };
      
      await proxyRequest(config);
      results.push({ collectionId, success: true });
    } catch (error) {
      results.push({ collectionId, success: false, error: error.message });
    }
  }
  
  return { results };
}

async function startWorkflow(nodeId, authHeader) {
  const config = {
    hostname: 'repository.staging.openeduhub.net',
    path: `/edu-sharing/rest/node/v1/nodes/-home-/${nodeId}/workflow`,
    method: 'PUT',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  const workflowBody = {
    receiver: [{ authorityName: 'GROUP_ORG_WLO-Uploadmanager' }],
    comment: 'Upload via Canvas Webkomponente (Gast)',
    status: '200_tocheck'
  };
  
  await proxyRequest(config, workflowBody);
  return { success: true };
}

/**
 * Utility functions
 */
function collectBody(req, callback) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => callback(body));
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJSON(res, statusCode, { error: message });
}

/**
 * Start server
 */
server.listen(PORT, () => {
  console.log('✅ Universal Proxy ready!');
  console.log('');
  console.log('📋 Usage:');
  console.log('   LLM:        POST http://localhost:3001/llm');
  console.log('   Geocoding:  GET  http://localhost:3001/geocoding?q=Berlin');
  console.log('   Repository: POST http://localhost:3001/repository');
  console.log('');
  console.log('💡 Next steps:');
  console.log('   1. Keep this terminal running');
  console.log('   2. In another terminal: npm start');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down proxy...');
  server.close(() => {
    console.log('✅ Proxy stopped');
    process.exit(0);
  });
});
