/**
 * Netlify Function: Multi-Provider LLM API Proxy
 * Handles OpenAI and OpenAI-compatible API requests from the browser
 * API Keys are stored in Netlify Environment Variables (secure)
 * 
 * Supported Providers:
 * - openai: Standard OpenAI API (uses OPENAI_API_KEY)
 * - b-api-openai: B-API OpenAI-compatible endpoint (uses B_API_KEY)
 * - b-api-academiccloud: B-API AcademicCloud endpoint with deepseek-r1 (uses B_API_KEY)
 */

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { messages, model, temperature, modelKwargs, provider } = body;
    
    // Determine which provider to use (default: openai)
    const selectedProvider = provider || 'openai';
    
    // Get API key and base URL based on provider
    let apiKey, baseUrl, requiresCustomHeader;
    
    if (selectedProvider === 'b-api-openai') {
      apiKey = process.env.B_API_KEY;
      baseUrl = 'https://b-api.staging.openeduhub.net/api/v1/llm/openai';
      requiresCustomHeader = true;
      
      if (!apiKey) {
        console.error('B_API_KEY not set in Netlify environment variables');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'API key not configured',
            message: 'Please set B_API_KEY in Netlify Dashboard → Site Settings → Environment Variables'
          }),
        };
      }
    } else if (selectedProvider === 'b-api-academiccloud') {
      apiKey = process.env.B_API_KEY;
      baseUrl = 'https://b-api.staging.openeduhub.net/api/v1/llm/academiccloud';
      requiresCustomHeader = true;
      
      if (!apiKey) {
        console.error('B_API_KEY not set in Netlify environment variables');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'API key not configured',
            message: 'Please set B_API_KEY in Netlify Dashboard → Site Settings → Environment Variables'
          }),
        };
      }
    } else {
      // Default: OpenAI
      apiKey = process.env.OPENAI_API_KEY;
      baseUrl = 'https://api.openai.com/v1';
      requiresCustomHeader = false;
      
      if (!apiKey) {
        console.error('OPENAI_API_KEY not set in Netlify environment variables');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'API key not configured',
            message: 'Please set OPENAI_API_KEY in Netlify Dashboard → Site Settings → Environment Variables'
          }),
        };
      }
    }

    // Build LLM API request
    const llmRequest = {
      model: model || 'gpt-4.1-mini',
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

    console.log(`Proxying request to ${selectedProvider.toUpperCase()} API (Model: ${llmRequest.model})`);

    // Build request headers
    const requestHeaders = {
      'Content-Type': 'application/json',
    };
    
    // Provider-specific headers
    if (requiresCustomHeader) {
      // Provider B requires X-API-KEY header
      requestHeaders['X-API-KEY'] = apiKey;
    } else {
      // OpenAI uses Authorization Bearer
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
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `${selectedProvider.toUpperCase()} API error`, 
          status: response.status,
          message: errorText
        }),
      };
    }

    const data = await response.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }),
    };
  }
};
