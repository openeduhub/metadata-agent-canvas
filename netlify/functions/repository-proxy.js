/**
 * Netlify Function: Repository Proxy
 * Proxies requests to edu-sharing Repository API to avoid CORS issues
 */

// WLO Guest credentials
const GUEST_CONFIG = {
  username: 'WLO-Upload',
  password: 'wlo#upload!20',
  baseUrl: 'https://repository.staging.openeduhub.net/edu-sharing'
};

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { action, data } = JSON.parse(event.body);
    
    const authHeader = 'Basic ' + Buffer.from(`${GUEST_CONFIG.username}:${GUEST_CONFIG.password}`).toString('base64');
    
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
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Unknown action' })
        };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Repository proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        details: error.toString()
      })
    };
  }
};

/**
 * Check for duplicates
 */
async function checkDuplicate(url, authHeader) {
  const searchUrl = `${GUEST_CONFIG.baseUrl}/rest/search/v1/queries/-home-/mds_oeh/ngsearch`;
  
  const searchBody = {
    criteria: [{
      property: 'ccm:wwwurl',
      values: [url]
    }],
    facettes: []
  };
  
  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(searchBody)
  });
  
  if (!response.ok) {
    throw new Error(`Duplicate check failed: ${response.status}`);
  }
  
  const data = await response.json();
  
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

/**
 * Create node - Only send 5 essential fields
 */
async function createNode(metadata, authHeader) {
  const inboxId = '21144164-30c0-4c01-ae16-264452197063';
  const createUrl = `${GUEST_CONFIG.baseUrl}/rest/node/v1/nodes/-home-/${inboxId}/children?type=ccm%3Aio&renameIfExists=true&versionComment=MAIN_FILE_UPLOAD`;
  
  // Filter: Only 5 essential fields for node creation
  const essentialFields = [
    'cclom:title',
    'cclom:general_description',
    'cclom:general_keyword',
    'ccm:wwwurl',
    'cclom:general_language'
  ];
  
  const cleanMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    if (essentialFields.includes(key)) {
      cleanMetadata[key] = value;
    }
  }
  
  // Normalize to arrays
  const normalizedMetadata = {};
  for (const [key, value] of Object.entries(cleanMetadata)) {
    if (Array.isArray(value)) {
      normalizedMetadata[key] = value;
    } else if (value !== null && value !== undefined && value !== '') {
      normalizedMetadata[key] = [value];
    }
  }
  
  const response = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(normalizedMetadata)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create node failed: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return {
    nodeId: data.node.ref.id
  };
}

/**
 * Set metadata - With filtering, transformation, and normalization
 */
async function setMetadata(nodeId, metadata, authHeader) {
  const metadataUrl = `${GUEST_CONFIG.baseUrl}/rest/node/v1/nodes/-home-/${nodeId}/metadata?versionComment=METADATA_UPDATE`;
  
  // Whitelist: Only send supported fields
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
    'ccm:custom_license'
  ];
  
  const cleanMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key.startsWith('virtual:') || !supportedFields.includes(key)) {
      continue;
    }
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    cleanMetadata[key] = value;
  }
  
  // Transform license URL to key + version
  if (cleanMetadata['ccm:custom_license']) {
    let licenseUrl = Array.isArray(cleanMetadata['ccm:custom_license']) 
      ? cleanMetadata['ccm:custom_license'][0] 
      : cleanMetadata['ccm:custom_license'];
    
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
      const label = licenseKey.label || '';
      if (label) {
        cleanMetadata['ccm:commonlicense_key'] = [label.replace(/[\s\-]+/g, '_').toUpperCase()];
      }
    }
  }
  
  // Transform license version
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
  
  // Fallback: If license set but no version, default to "4.0"
  if (cleanMetadata['ccm:commonlicense_key'] && 
      (!cleanMetadata['ccm:commonlicense_cc_version'] || 
       cleanMetadata['ccm:commonlicense_cc_version'].length === 0 ||
       cleanMetadata['ccm:commonlicense_cc_version'][0] === '')) {
    cleanMetadata['ccm:commonlicense_cc_version'] = ['4.0'];
  }
  
  // Normalize: Extract URIs from objects, keep strings as-is
  const normalizedMetadata = {};
  for (const [key, value] of Object.entries(cleanMetadata)) {
    if (Array.isArray(value)) {
      // Text fields: no URI extraction
      const textFields = [
        'cclom:general_keyword', 
        'cclom:title', 
        'cclom:general_description', 
        'ccm:wwwurl', 
        'cclom:general_language',
        'ccm:commonlicense_key',
        'ccm:commonlicense_cc_version'
      ];
      if (textFields.includes(key)) {
        normalizedMetadata[key] = value.filter(item => item && item !== '');
      } else {
        // URI fields: Extract ONLY uri from objects
        normalizedMetadata[key] = value.map(item => {
          if (typeof item === 'object' && item !== null) {
            return item.uri || '';
          }
          return item;
        }).filter(item => item !== '');
      }
    } else if (typeof value === 'object' && value !== null) {
      if (value.uri) {
        normalizedMetadata[key] = [value.uri];
      }
    } else if (value !== null && value !== undefined && value !== '') {
      normalizedMetadata[key] = [value];
    }
  }
  
  const response = await fetch(metadataUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(normalizedMetadata)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Set metadata failed: ${response.status} - ${errorText}`);
  }
  
  return { success: true };
}

/**
 * Set collections - Extract IDs from URLs
 */
async function setCollections(nodeId, collectionIds, authHeader) {
  const results = [];
  
  // Extract collection IDs from URLs if needed
  const extractedIds = collectionIds
    .filter(id => id && id.trim())
    .map(id => {
      if (typeof id === 'string' && id.includes('/')) {
        // URL format: extract last segment
        return id.substring(id.lastIndexOf('/') + 1);
      }
      return id;
    });
  
  for (const collectionId of extractedIds) {
    try {
      const url = `${GUEST_CONFIG.baseUrl}/rest/collection/v1/collections/-home-/${collectionId}/references/${nodeId}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });
      
      results.push({
        collectionId,
        success: response.ok
      });
    } catch (error) {
      results.push({
        collectionId,
        success: false,
        error: error.message
      });
    }
  }
  
  return { results };
}

/**
 * Start workflow
 */
async function startWorkflow(nodeId, authHeader) {
  const workflowUrl = `${GUEST_CONFIG.baseUrl}/rest/node/v1/nodes/-home-/${nodeId}/workflow`;
  
  const response = await fetch(workflowUrl, {
    method: 'PUT',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      receiver: [{ authorityName: 'GROUP_ORG_WLO-Uploadmanager' }],
      comment: 'Upload via Canvas Webkomponente (Gast)',
      status: '200_tocheck'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Start workflow failed: ${response.status}`);
  }
  
  return { success: true };
}
