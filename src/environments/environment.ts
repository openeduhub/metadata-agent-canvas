export const environment = {
  production: false,
  
  // Deployment Platform (auto-detect if not set)
  // Options: 'vercel', 'netlify', 'local', 'auto'
  deploymentPlatform: 'local',
  
  // LLM Provider Selection ('openai', 'b-api-openai', or 'b-api-academiccloud')
  llmProvider: 'b-api-openai', // Switch between providers
  
  // OpenAI Configuration
  openai: {
    apiKey: '', // NOT USED - API key is kept server-side for security
    baseUrl: '', // Optional: Custom OpenAI-compatible endpoint (leave empty for default)
    proxyUrl: 'http://localhost:3001/llm', // Local dev proxy
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
    apiKey: '', // NOT USED - API key is kept server-side for security
    baseUrl: 'https://b-api.staging.openeduhub.net/api/v1/llm/openai',
    proxyUrl: 'http://localhost:3001/llm', // Local dev proxy
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
    apiKey: '', // NOT USED - API key is kept server-side for security
    baseUrl: 'https://b-api.staging.openeduhub.net/api/v1/llm/academiccloud',
    proxyUrl: 'http://localhost:3001/llm', // Local dev proxy
    model: 'deepseek-r1',
    temperature: 0.3,
    requiresCustomHeader: true, // Send X-API-KEY header
  },
  
  // Canvas Worker Pool Configuration
  canvas: {
    maxWorkers: 10, // Number of parallel field extractions (5-20 recommended)
    timeout: 30000 // Timeout per field extraction in milliseconds
  },
  
  // Geocoding API Configuration (Photon)
  geocoding: {
    proxyUrl: 'http://localhost:3001/geocoding'
  },
  
  // Repository API Configuration (edu-sharing)
  repository: {
    proxyUrl: 'http://localhost:3001/repository',
    baseUrl: 'https://repository.staging.openeduhub.net/edu-sharing'
  }
};
