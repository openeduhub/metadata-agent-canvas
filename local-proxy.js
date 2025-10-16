#!/usr/bin/env node

/**
 * Local development proxy for Multi-Provider LLM API
 * Solves CORS issues by proxying requests from browser to LLM providers
 * 
 * Supported Providers:
 * - OpenAI (OPENAI_API_KEY)
 * - B-API OpenAI (B_API_KEY) - OpenAI-compatible endpoint
 * - B-API AcademicCloud (B_API_KEY) - AcademicCloud endpoint with deepseek-r1
 * 
 * Usage: node local-proxy.js
 * Or: npm run proxy
 */

const http = require('http');
const https = require('https');

const PORT = 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const B_API_KEY = process.env.B_API_KEY;

// Check if at least one API key is provided
if (!OPENAI_API_KEY && !B_API_KEY) {
  console.error('❌ ERROR: No API key environment variable is set!');
  console.error('');
  console.error('Please set at least one before starting the proxy:');
  console.error('');
  console.error('For OpenAI:');
  console.error('  Windows (PowerShell): $env:OPENAI_API_KEY="sk-proj-..."');
  console.error('  Windows (CMD):        set OPENAI_API_KEY=sk-proj-...');
  console.error('  Linux/Mac:            export OPENAI_API_KEY=sk-proj-...');
  console.error('');
  console.error('For Provider B:');
  console.error('  Windows (PowerShell): $env:B_API_KEY="bb6cdf84-..."');
  console.error('  Windows (CMD):        set B_API_KEY=bb6cdf84-...');
  console.error('  Linux/Mac:            export B_API_KEY=bb6cdf84-...');
  console.error('');
  console.error('Or configure it in src/environments/environment.ts (recommended for local development)');
  process.exit(1);
}

console.log('🚀 Starting local Multi-Provider LLM proxy server...');
console.log(`📡 Proxy listening on: http://localhost:${PORT}`);
if (OPENAI_API_KEY) {
  console.log(`🔑 OpenAI API Key: ${OPENAI_API_KEY.substring(0, 20)}...`);
}
if (B_API_KEY) {
  console.log(`🔑 Provider B API Key: ${B_API_KEY.substring(0, 20)}...`);
}
console.log('');
console.log('💡 Configure your app to use: http://localhost:3001/v1/chat/completions');
console.log('');

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Collect request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      // Parse request
      const requestData = JSON.parse(body);
      const provider = requestData.provider || 'openai';
      
      // Determine provider configuration
      let hostname, path, apiKey, requiresCustomHeader;
      
      if (provider === 'b-api-openai') {
        if (!B_API_KEY) {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({ 
            error: 'B_API_KEY not configured',
            message: 'Please set B_API_KEY environment variable or configure in environment.ts'
          }));
          return;
        }
        
        hostname = 'b-api.staging.openeduhub.net';
        path = '/api/v1/llm/openai/chat/completions';
        apiKey = B_API_KEY;
        requiresCustomHeader = true;
      } else if (provider === 'b-api-academiccloud') {
        if (!B_API_KEY) {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({ 
            error: 'B_API_KEY not configured',
            message: 'Please set B_API_KEY environment variable or configure in environment.ts'
          }));
          return;
        }
        
        hostname = 'b-api.staging.openeduhub.net';
        path = '/api/v1/llm/academiccloud/chat/completions';
        apiKey = B_API_KEY;
        requiresCustomHeader = true;
      } else {
        // Default: OpenAI
        if (!OPENAI_API_KEY) {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({ 
            error: 'OPENAI_API_KEY not configured',
            message: 'Please set OPENAI_API_KEY environment variable or configure in environment.ts'
          }));
          return;
        }
        
        hostname = 'api.openai.com';
        path = '/v1/chat/completions';
        apiKey = OPENAI_API_KEY;
        requiresCustomHeader = false;
      }
      
      console.log(`📤 Proxying request to ${provider.toUpperCase()} API...`);
      console.log(`   Model: ${requestData.model || 'default'}`);
      console.log(`   Messages: ${requestData.messages?.length || 0}`);

      // Remove provider field from request body (API doesn't need it)
      delete requestData.provider;
      
      // Prepare LLM request
      const postData = JSON.stringify(requestData);
      
      // Build headers
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      };
      
      if (requiresCustomHeader) {
        headers['X-API-KEY'] = apiKey;
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const options = {
        hostname,
        port: 443,
        path,
        method: 'POST',
        headers,
      };

      // Forward request to LLM provider
      const proxyReq = https.request(options, (proxyRes) => {
        let responseBody = '';

        proxyRes.on('data', (chunk) => {
          responseBody += chunk;
        });

        proxyRes.on('end', () => {
          console.log(`✅ Response received from ${provider.toUpperCase()} (${proxyRes.statusCode})`);
          
          // Send response back to browser with CORS headers
          res.writeHead(proxyRes.statusCode || 200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          });
          res.end(responseBody);
        });
      });

      proxyReq.on('error', (error) => {
        console.error(`❌ Proxy error (${provider}):`, error.message);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ error: 'Proxy error', message: error.message }));
      });

      // Send request to LLM provider
      proxyReq.write(postData);
      proxyReq.end();

    } catch (error) {
      console.error('❌ Error parsing request:', error.message);
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: 'Invalid request', message: error.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log('✅ Proxy server ready!');
  console.log('');
  console.log('📋 Next steps:');
  console.log('   1. Keep this terminal running');
  console.log('   2. In another terminal: npm start');
  console.log('   3. App will use this proxy automatically');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down proxy server...');
  server.close(() => {
    console.log('✅ Proxy server stopped');
    process.exit(0);
  });
});
