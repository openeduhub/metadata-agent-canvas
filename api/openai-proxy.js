/**
 * Vercel Serverless Function: Multi-Provider LLM API Proxy
 * Compatible with Netlify Function API
 * Handles OpenAI and OpenAI-compatible API requests from the browser
 * API Keys are stored in Vercel Environment Variables (secure)
 * 
 * Supported Providers:
 * - openai: Standard OpenAI API (uses OPENAI_API_KEY)
 * - b-api-openai: B-API OpenAI-compatible endpoint (uses B_API_KEY)
 * - b-api-academiccloud: B-API AcademicCloud endpoint with deepseek-r1 (uses B_API_KEY)
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model, temperature, modelKwargs, provider } = req.body;
    
    // Determine which provider to use (default: openai)
    const selectedProvider = provider || 'openai';
    
    // Get API key and base URL based on provider
    let apiKey, baseUrl, requiresCustomHeader;
    
    if (selectedProvider === 'b-api-openai') {
      apiKey = process.env.B_API_KEY;
      baseUrl = 'https://b-api.staging.openeduhub.net/api/v1/llm/openai';
      requiresCustomHeader = true;
      
      if (!apiKey) {
        console.error('B_API_KEY not set in Vercel environment variables');
        return res.status(500).json({ 
          error: 'API key not configured',
          message: 'Please set B_API_KEY in Vercel Dashboard → Settings → Environment Variables'
        });
      }
    } else if (selectedProvider === 'b-api-academiccloud') {
      apiKey = process.env.B_API_KEY;
      baseUrl = 'https://b-api.staging.openeduhub.net/api/v1/llm/academiccloud';
      requiresCustomHeader = true;
      
      if (!apiKey) {
        console.error('B_API_KEY not set in Vercel environment variables');
        return res.status(500).json({ 
          error: 'API key not configured',
          message: 'Please set B_API_KEY in Vercel Dashboard → Settings → Environment Variables'
        });
      }
    } else {
      // Default: OpenAI
      apiKey = process.env.OPENAI_API_KEY;
      baseUrl = 'https://api.openai.com/v1';
      requiresCustomHeader = false;
      
      if (!apiKey) {
        console.error('OPENAI_API_KEY not set in Vercel environment variables');
        return res.status(500).json({ 
          error: 'API key not configured',
          message: 'Please set OPENAI_API_KEY in Vercel Dashboard → Settings → Environment Variables'
        });
      }
    }

    // Build LLM API request
    const llmRequest = {
      model: model || 'gpt-4o-mini',
      messages: messages,
      temperature: temperature !== undefined ? temperature : 0.3,
    };

    // Add GPT-5 or other model-specific parameters
    if (modelKwargs) {
      if (modelKwargs.reasoning_effort) {
        llmRequest.reasoning_effort = modelKwargs.reasoning_effort;
      }
      if (modelKwargs.response_format) {
        llmRequest.response_format = modelKwargs.response_format;
      }
    }

    console.log(`[Vercel] Proxying request to ${selectedProvider.toUpperCase()} API (Model: ${llmRequest.model})`);

    // Build request headers
    const requestHeaders = {
      'Content-Type': 'application/json',
    };
    
    // Provider-specific headers
    if (requiresCustomHeader) {
      requestHeaders['X-API-KEY'] = apiKey;
    } else {
      requestHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    // Call LLM API
    const apiUrl = `${baseUrl}/chat/completions`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(llmRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${selectedProvider.toUpperCase()} API error:`, response.status, errorText);
      return res.status(response.status).json({ 
        error: `${selectedProvider.toUpperCase()} API error`, 
        status: response.status,
        message: errorText
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('[Vercel] Function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}
