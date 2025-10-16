export const environment = {
  production: false,
  
  // LLM Provider Selection ('openai', 'b-api-openai', or 'b-api-academiccloud')
  llmProvider: 'b-api-openai', // Switch between providers
  
  // OpenAI Configuration
  openai: {
    apiKey: '',
    baseUrl: '', // Optional: Custom OpenAI-compatible endpoint (leave empty for default)
    proxyUrl: '', // Optional: Custom proxy URL (leave empty to use /.netlify/functions/openai-proxy)
    model: 'gpt-4.1-mini',
    temperature: 0.3,
    
    // GPT-5 specific settings (only used if model starts with 'gpt-5')
    gpt5: {
      reasoningEffort: 'medium',
      verbosity: 'low'
    }
  },
  
  // B-API OpenAI Configuration (OpenAI-compatible endpoint)
  bApiOpenai: {
    apiKey: '', // Set B_API_KEY in environment variable
    baseUrl: 'https://b-api.staging.openeduhub.net/api/v1/llm/openai',
    proxyUrl: '', // Optional: Custom proxy URL
    model: 'gpt-4.1-mini',
    temperature: 0.3,
    requiresCustomHeader: true, // Send X-API-KEY header
    
    // GPT-5 specific settings
    gpt5: {
      reasoningEffort: 'medium',
      verbosity: 'low'
    }
  },
  
  // B-API AcademicCloud Configuration (AcademicCloud endpoint)
  bApiAcademicCloud: {
    apiKey: '', // Set B_API_KEY in environment variable
    baseUrl: 'https://b-api.staging.openeduhub.net/api/v1/llm/academiccloud',
    proxyUrl: '', // Optional: Custom proxy URL
    model: 'deepseek-r1',
    temperature: 0.3,
    requiresCustomHeader: true, // Send X-API-KEY header
  },
  
  // Canvas Worker Pool Configuration
  canvas: {
    maxWorkers: 10, // Number of parallel field extractions (5-20 recommended)
    timeout: 30000 // Timeout per field extraction in milliseconds
  }
};
