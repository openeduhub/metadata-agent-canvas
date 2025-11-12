// Metadata Agent Canvas - Secure Proxy Server
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001', 'http://localhost:4200'];

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'b-api-openai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const B_API_KEY = process.env.B_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

// Rate Limit Configuration (configurable via environment)
const RATE_LIMIT_LLM_MAX = parseInt(process.env.RATE_LIMIT_LLM_MAX || '150', 10);
const RATE_LIMIT_API_MAX = parseInt(process.env.RATE_LIMIT_API_MAX || '1500', 10);

// WLO Guest Configuration (for uploads in local, bookmarklet and container mode)
const WLO_GUEST_USERNAME = process.env.WLO_GUEST_USERNAME;
const WLO_GUEST_PASSWORD = process.env.WLO_GUEST_PASSWORD;
const WLO_REPOSITORY_BASE_URL = process.env.WLO_REPOSITORY_BASE_URL || 'https://repository.staging.openeduhub.net/edu-sharing';

// Validate required environment variables
if (LLM_PROVIDER === 'openai' && !OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY is required when LLM_PROVIDER is "openai"');
  process.exit(1);
}

if ((LLM_PROVIDER === 'b-api-openai' || LLM_PROVIDER === 'b-api-academiccloud') && !B_API_KEY) {
  console.error('❌ B_API_KEY is required when LLM_PROVIDER is "b-api-openai" or "b-api-academiccloud"');
  process.exit(1);
}

if (!WLO_GUEST_USERNAME || !WLO_GUEST_PASSWORD) {
  console.error('❌ WLO_GUEST_USERNAME and WLO_GUEST_PASSWORD are required for repository uploads');
  process.exit(1);
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],  
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3000", "http://localhost:3001"],
      frameSrc: ["'self'"],
      frameAncestors: ["* chrome-extension://*"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());

// Serve static Angular app FIRST (before CORS for static files)
app.use(express.static(path.join(__dirname, '../dist'), {
  setHeaders: (res, filepath) => {
    // Set proper CORS headers for static files
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Set proper content types
    if (filepath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

app.use(express.json({ limit: '10mb' }));

// CORS Configuration (for API routes)
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const isExplicitlyAllowed = ALLOWED_ORIGINS.indexOf(origin) !== -1 || ALLOWED_ORIGINS.includes('*');
    const isLocalhostOrigin = /^https?:\/\/localhost(:\d+)?$/i.test(origin);

    if (isExplicitlyAllowed || isLocalhostOrigin) {
      console.log(`✅ Allowed request from origin: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`❌ Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting - Configured for parallel worker usage
// With 20 parallel workers, we need higher limits
// Can be adjusted via RATE_LIMIT_API_MAX and RATE_LIMIT_LLM_MAX env vars
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: RATE_LIMIT_API_MAX,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const proxyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: RATE_LIMIT_LLM_MAX,
  message: 'Too many LLM requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    provider: LLM_PROVIDER,
    version: '1.0.0'
  });
});

// Geocode Proxy Endpoint (matches local proxy)
const handleGeocodeRequest = async (req, res) => {
  try {
    // Accept both 'q' (Photon-style) and 'address' (legacy)
    const { q, address, lang = 'de', limit = '1' } = req.query;
    const query = q || address;

    if (!query) {
      return res.status(400).json({ 
        error: 'Missing query parameter (q or address)'
      });
    }

    console.log(`🗺️  Geocoding request: ${query}`);

    // Call Photon API (Komoot)
    const photonUrl = 'https://photon.komoot.io/api/';
    const params = new URLSearchParams({
      q: query,
      lang: lang,
      limit: limit
    });

    const response = await axios.get(`${photonUrl}?${params}`, {
      headers: {
        'User-Agent': 'WLO-Metadata-Canvas/1.0',
        'Accept': 'application/json'
      }
    });

    // Return Photon GeoJSON format (already correct)
    if (response.data && response.data.features && response.data.features.length > 0) {
      console.log(`✅ Geocoding response: ${response.data.features.length} result(s)`);
      res.json(response.data);
    } else {
      res.json({
        type: 'FeatureCollection',
        features: []
      });
    }

  } catch (error) {
    console.error('❌ Geocoding error:', error.message);
    res.status(500).json({
      error: 'Geocoding API error',
      message: error.message
    });
  }
};

// Register Geocode endpoints (both styles)
app.get('/geocoding', apiLimiter, handleGeocodeRequest);
app.get('/api/geocode-proxy', apiLimiter, handleGeocodeRequest);

// Repository Proxy Endpoint (matches local proxy)
const handleRepositoryRequest = async (req, res) => {
  try {
    const { action, data } = req.body;
    
    console.log(`📦 Repository action: ${action}`);

    // WLO Guest credentials from environment variables
    const GUEST_CONFIG = {
      username: WLO_GUEST_USERNAME,
      password: WLO_GUEST_PASSWORD,
      baseUrl: WLO_REPOSITORY_BASE_URL
    };

    const authHeader = 'Basic ' + Buffer.from(`${GUEST_CONFIG.username}:${GUEST_CONFIG.password}`).toString('base64');

    let result;

    switch (action) {
      case 'checkDuplicate':
        result = await checkDuplicate(data.url, authHeader, GUEST_CONFIG.baseUrl);
        break;
      case 'createNode':
        result = await createNode(data.metadata, authHeader, GUEST_CONFIG.baseUrl);
        break;
      case 'setMetadata':
        result = await setMetadata(data.nodeId, data.metadata, authHeader, GUEST_CONFIG.baseUrl);
        break;
      case 'setCollections':
        result = await setCollections(data.nodeId, data.collectionIds, authHeader, GUEST_CONFIG.baseUrl);
        break;
      case 'startWorkflow':
        result = await startWorkflow(data.nodeId, authHeader, GUEST_CONFIG.baseUrl);
        break;
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    console.log(`✅ Repository action complete: ${action}`);
    res.json(result);

  } catch (error) {
    console.error('❌ Repository proxy error:', error.message);
    
    // Log detailed error info for debugging
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data));
    }
    
    res.status(500).json({
      error: error.message,
      details: error.toString(),
      status: error.response?.status,
      data: error.response?.data
    });
  }
};

// Register Repository endpoints (both styles)
app.post('/repository', apiLimiter, handleRepositoryRequest);
app.post('/api/repository-proxy', apiLimiter, handleRepositoryRequest);

// LLM Proxy Endpoint (matches local proxy)
// Support both /llm (local proxy style) and /api/openai-proxy (old style)
const handleLLMRequest = async (req, res) => {
  try {
    // Security: Validate request body
    if (!req.body.messages || !Array.isArray(req.body.messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    // Security: Limit message size
    const totalSize = JSON.stringify(req.body).length;
    if (totalSize > 100000) { // 100KB limit
      return res.status(400).json({ error: 'Request too large' });
    }

    // Get provider from request body (like local proxy), fallback to env var
    const provider = req.body.provider || LLM_PROVIDER;
    
    // Remove provider field before forwarding (like local proxy)
    const requestData = { ...req.body };
    delete requestData.provider;
    
    console.log(`📤 LLM request: ${provider.toUpperCase()}`);
    console.log(`   Model: ${requestData.model || 'default'}`);

    if (provider === 'openai') {
      // Direct OpenAI API Call
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: requestData.model || OPENAI_MODEL,
          messages: requestData.messages,
          temperature: requestData.temperature || 0.7,
          max_tokens: requestData.max_tokens || 2000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          timeout: 60000,
        }
      );

      console.log(`✅ LLM response: ${provider.toUpperCase()}`);
      res.json(response.data);

    } else if (provider === 'b-api-openai') {
      // B-API OpenAI-compatible endpoint (same as Netlify function)
      const response = await axios.post(
        'https://b-api.staging.openeduhub.net/api/v1/llm/openai/chat/completions',
        {
          model: requestData.model || OPENAI_MODEL,
          messages: requestData.messages,
          temperature: requestData.temperature || 0.7,
          max_tokens: requestData.max_tokens || 2000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${B_API_KEY}`,
          },
          timeout: 60000,
        }
      );

      console.log(`✅ LLM response: ${provider.toUpperCase()}`);
      res.json(response.data);

    } else if (provider === 'b-api-academiccloud') {
      // B-API AcademicCloud with DeepSeek-R1
      const response = await axios.post(
        'https://b-api.staging.openeduhub.net/api/v1/llm/academiccloud/chat/completions',
        {
          model: requestData.model || 'deepseek-r1:14b',
          messages: requestData.messages,
          temperature: requestData.temperature || 0.7,
          max_tokens: requestData.max_tokens || 2000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${B_API_KEY}`,
          },
          timeout: 60000,
        }
      );

      console.log(`✅ LLM response: ${provider.toUpperCase()}`);
      res.json(response.data);

    } else {
      res.status(500).json({ error: 'Invalid LLM provider configuration' });
    }

  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    
    if (error.response) {
      // API responded with error
      res.status(error.response.status).json({
        error: error.response.data?.error?.message || 'API request failed',
        details: process.env.NODE_ENV === 'development' ? error.response.data : undefined
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(504).json({ error: 'Request timeout' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// Register LLM endpoints (both local proxy style and old API style)
app.post('/llm', proxyLimiter, handleLLMRequest);
app.post('/api/openai-proxy', proxyLimiter, handleLLMRequest);

// Fallback to index.html for Angular routing (catch-all route)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ===== Repository Helper Functions =====

async function checkDuplicate(url, authHeader, baseUrl) {
  try {
    // Extract value if URL is an object with value property
    let urlValue = url;
    if (typeof url === 'object' && url !== null) {
      urlValue = url.value || url.uri || '';
    }
    
    // If no URL provided, skip duplicate check
    if (!urlValue || urlValue === 'null' || typeof urlValue !== 'string' || urlValue.trim() === '') {
      console.log('   ⏭️  Skipping duplicate check (no URL provided)');
      return { exists: false };
    }
    
    // Add query parameters like browser plugin does
    const searchUrl = `${baseUrl}/rest/search/v1/queries/-home-/mds_oeh/ngsearch?contentType=FILES&maxItems=1&skipCount=0&propertyFilter=-all-`;
    
    // Match browser plugin format: only criteria, no facettes
    const searchBody = {
      criteria: [{ property: 'ccm:wwwurl', values: [urlValue] }]
    };
    
    console.log(`   🔍 Checking duplicate for URL: ${urlValue}`);
    
    const response = await axios.post(searchUrl, searchBody, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (response.data.nodes && response.data.nodes.length > 0) {
      const node = response.data.nodes[0];
      console.log(`   ⚠️  Duplicate found: ${node.ref.id}`);
      return {
        exists: true,
        nodeId: node.ref.id,
        title: node.title || node.properties?.['cclom:title']?.[0] || 'Unbekannter Titel'
      };
    }
    
    console.log('   ✅ No duplicate found');
    return { exists: false };
    
  } catch (error) {
    // Fail gracefully - don't block submission if duplicate check fails
    console.error('   ❌ Duplicate check error:', error.message);
    return { exists: false, warning: 'Duplicate check unavailable, continuing anyway' };
  }
}

async function createNode(metadata, authHeader, baseUrl) {
  const inboxId = '21144164-30c0-4c01-ae16-264452197063';
  const createUrl = `${baseUrl}/rest/node/v1/nodes/-home-/${inboxId}/children?type=ccm:io&renameIfExists=true&versionComment=MAIN_FILE_UPLOAD`;
  
  // Essential fields for node creation (more flexible for events)
  const essentialFields = [
    'cclom:title',
    'cclom:general_description',
    'cclom:general_keyword',
    'ccm:wwwurl',  // Optional for events
    'cclom:general_language'
  ];
  
  const cleanMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    // Skip virtual fields
    if (key.startsWith('virtual:')) {
      continue;
    }
    
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    
    if (essentialFields.includes(key)) {
      // Extract actual values from field objects and flatten nested arrays
      let extractedValue = [];

      const pushValue = (val) => {
        if (val === null || val === undefined || val === '') {
          return;
        }
        if (typeof val === 'object') {
          if (Array.isArray(val)) {
            val.forEach(inner => pushValue(inner));
          } else {
            pushValue(val.uri || val.label || '');
          }
          return;
        }
        extractedValue.push(val);
      };

      if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            if ('value' in item) {
              pushValue(item.value);
            } else {
              pushValue(item.uri || item.label || '');
            }
          } else {
            pushValue(item);
          }
        });
      } else if (typeof value === 'object' && value !== null && 'value' in value) {
        pushValue(value.value);
      } else {
        pushValue(value);
      }
      
      if (extractedValue.length > 0) {
        cleanMetadata[key] = extractedValue;
      }
    }
  }
  
  // Ensure at least title is present
  if (!cleanMetadata['cclom:title']) {
    throw new Error('Title is required to create a node');
  }
  
  console.log(`   📤 Sending ${Object.keys(cleanMetadata).length} fields for node creation`);
  console.log(`   📋 Fields: ${Object.keys(cleanMetadata).join(', ')}`);
  console.log(`   📊 Complete data for createNode:`, JSON.stringify(cleanMetadata, null, 2));
  
  const response = await axios.post(createUrl, cleanMetadata, {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  
  return { nodeId: response.data.node.ref.id };
}

async function setMetadata(nodeId, metadata, authHeader, baseUrl) {
  const metadataUrl = `${baseUrl}/rest/node/v1/nodes/-home-/${nodeId}/metadata?versionComment=METADATA_UPDATE`;
  
  const supportedFields = [
    'cclom:title',
    'cclom:general_description',
    'cclom:general_keyword',
    'ccm:wwwurl',
    'cclom:general_language',
    'ccm:taxonid',
    'ccm:educationalcontext',
    'ccm:educationalintendedenduserrole',
    'ccm:commonlicense_key',
    'ccm:commonlicense_cc_version',
    'ccm:custom_license',
    // Event-specific fields
    'ccm:oeh_event_type',
    'ccm:oeh_event_targetaudience',
    'ccm:oeh_event_place',
    'ccm:oeh_event_start',
    'ccm:oeh_event_end',
    'ccm:oeh_event_organizer',
    'ccm:oeh_event_fee',
    'ccm:oeh_event_registration',
    'ccm:oeh_flex_irt'
  ];
  
  const cleanMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key.startsWith('virtual:')) {
      continue;
    }
    
    if (!supportedFields.includes(key)) {
      console.log(`   ⏭️  Skipping unsupported field: ${key}`);
      continue;
    }
    
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    
    console.log(`   ✓ Including field ${key}:`, typeof value, Array.isArray(value) ? `Array[${value.length}]` : '');
    
    // Transform data: Extract value/uri from field objects
    const flattenedValues = [];

    const pushValue = (val) => {
      if (val === null || val === undefined || val === '') {
        return;
      }
      if (typeof val === 'object') {
        if (Array.isArray(val)) {
          val.forEach(inner => pushValue(inner));
        } else {
          pushValue(val.uri || val.label || '');
        }
        return;
      }
      flattenedValues.push(val);
    };

    if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          if ('value' in item) {
            pushValue(item.value);
          } else {
            pushValue(item.uri || item.label || '');
          }
        } else {
          pushValue(item);
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      if ('value' in value) {
        pushValue(value.value);
      } else {
        pushValue(value.uri || value.label || '');
      }
    } else {
      pushValue(value);
    }

    if (flattenedValues.length > 0) {
      cleanMetadata[key] = flattenedValues;
    }
  }

  console.log(`   📤 Sending ${Object.keys(cleanMetadata).length} fields to setMetadata`);
  console.log(`   📋 Fields:`, Object.keys(cleanMetadata).join(', '));
  console.log(`   📊 Complete data being sent:`, JSON.stringify(cleanMetadata, null, 2));
  
  await axios.post(metadataUrl, cleanMetadata, {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  
  return { success: true };
}

async function setCollections(nodeId, collectionIds, authHeader, baseUrl) {
  const results = [];
  
  const extractedIds = collectionIds
    .filter(id => id && id.trim())
    .map(id => {
      if (typeof id === 'string' && id.includes('/')) {
        return id.substring(id.lastIndexOf('/') + 1);
      }
      return id;
    });
  
  for (const collectionId of extractedIds) {
    try {
      const url = `${baseUrl}/rest/collection/v1/collections/-home-/${collectionId}/references/${nodeId}`;
      
      await axios.put(url, {}, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });
      
      results.push({ collectionId, success: true });
    } catch (error) {
      results.push({ collectionId, success: false, error: error.message });
    }
  }
  
  return { results };
}

async function startWorkflow(nodeId, authHeader, baseUrl) {
  const workflowUrl = `${baseUrl}/rest/node/v1/nodes/-home-/${nodeId}/workflow`;
  
  await axios.put(workflowUrl, {
    receiver: [{ authorityName: 'GROUP_ORG_WLO-Uploadmanager' }],
    comment: 'Upload via Canvas Webkomponente (Gast)',
    status: '200_tocheck'
  }, {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  
  return { success: true };
}

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 Metadata Agent Canvas Server                          ║
╠═══════════════════════════════════════════════════════════╣
║  Port:           ${PORT.toString().padEnd(42)} ║
║  Provider:       ${LLM_PROVIDER.padEnd(42)} ║
║  Environment:    ${(process.env.NODE_ENV || 'production').padEnd(42)} ║
║  Origins:        ${ALLOWED_ORIGINS.length} configured ${' '.repeat(24)} ║
║  Rate Limits:                                              ║
║    - LLM:        ${RATE_LIMIT_LLM_MAX} req/min ${' '.repeat(29)} ║
║    - API:        ${RATE_LIMIT_API_MAX} req/15min ${' '.repeat(25)} ║
╚═══════════════════════════════════════════════════════════╝
  `);
  console.log('✅ Server is ready to accept connections');
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully');
  process.exit(0);
});
