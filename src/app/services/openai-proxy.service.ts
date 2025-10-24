import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { PlatformDetectionService } from './platform-detection.service';

export interface OpenAIMessage {
  role: string;
  content: string;
}

export interface OpenAIRequest {
  messages: OpenAIMessage[];
  model?: string;
  temperature?: number;
  modelKwargs?: any;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class OpenAIProxyService {
  private proxyUrl: string;
  private useDirectAccess: boolean;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE = 1000; // 1 second base delay
  
  // Provider configuration
  private provider: string;
  private providerConfig: any;

  constructor(private platformDetection: PlatformDetectionService) {
    // Select provider from environment
    this.provider = (environment as any).llmProvider || 'openai';
    
    // Map provider to config
    if (this.provider === 'b-api-openai') {
      this.providerConfig = (environment as any).bApiOpenai;
    } else if (this.provider === 'b-api-academiccloud') {
      this.providerConfig = (environment as any).bApiAcademicCloud;
    } else {
      this.providerConfig = environment.openai;
    }
    
    console.log('🧭 Provider configuration loaded:', {
      provider: this.provider,
      platform: this.platformDetection.getPlatformName(),
      production: environment.production
    });

    // Determine proxy URL based on platform (Netlify/Vercel/Local)
    if (environment.production) {
      // Production: Auto-detect platform and use correct proxy
      this.proxyUrl = this.providerConfig.proxyUrl || this.platformDetection.getOpenAIProxyUrl();
      console.log(`🚀 Production: ${this.provider.toUpperCase()} via ${this.platformDetection.getPlatformName()} → ${this.proxyUrl}`);
    } else {
      // Development: Use local proxy
      this.proxyUrl = this.providerConfig.proxyUrl || 'http://localhost:3001/llm';
      console.log(`🔧 Development: ${this.provider.toUpperCase()} via proxy → ${this.proxyUrl}`);
    }
    
    // SECURITY: Always use proxy to keep API keys server-side
    // Direct API access is disabled for security - keys must never be in frontend code
    this.useDirectAccess = false;
  }

  async invoke(messages: OpenAIMessage[]): Promise<OpenAIResponse> {
    return this.invokeWithRetry(messages, 0);
  }

  /**
   * Invoke with automatic retry on transient errors
   */
  private async invokeWithRetry(messages: OpenAIMessage[], attempt: number): Promise<OpenAIResponse> {
    try {
      // Development mode: Direct API access
      if (this.useDirectAccess) {
        return await this.invokeDirectly(messages);
      }
      
      // Production mode: Via Netlify Function proxy
      return await this.invokeViaProxy(messages);
      
    } catch (error: any) {
      const shouldRetry = this.shouldRetryError(error);
      const isLastAttempt = attempt >= this.MAX_RETRIES;
      
      if (shouldRetry && !isLastAttempt) {
        const delay = this.calculateBackoffDelay(attempt);
        console.warn(`⚠️ OpenAI API error (attempt ${attempt + 1}/${this.MAX_RETRIES + 1}): ${error.message}`);
        console.log(`🔄 Retrying in ${delay}ms...`);
        
        await this.sleep(delay);
        return this.invokeWithRetry(messages, attempt + 1);
      }
      
      // All retries exhausted or non-retriable error
      if (shouldRetry && isLastAttempt) {
        console.error(`❌ OpenAI API failed after ${this.MAX_RETRIES + 1} attempts: ${error.message}`);
      } else {
        console.error(`❌ OpenAI API non-retriable error: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Check if error should be retried
   */
  private shouldRetryError(error: any): boolean {
    const errorMessage = error.message || '';
    
    // Retry on specific HTTP status codes (transient errors)
    const retriableStatusCodes = [402, 429, 500, 502, 503, 504];
    const hasRetriableStatus = retriableStatusCodes.some(code => 
      errorMessage.includes(`${code}`)
    );
    
    // Also retry on network errors
    const isNetworkError = errorMessage.includes('fetch') || 
                          errorMessage.includes('network') ||
                          errorMessage.includes('timeout');
    
    return hasRetriableStatus || isNetworkError;
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s
    const exponentialDelay = this.RETRY_DELAY_BASE * Math.pow(2, attempt);
    
    // Add jitter (±25% randomness) to avoid thundering herd
    const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
    
    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Call API directly (development mode only)
   * Supports OpenAI and OpenAI-compatible providers
   */
  private async invokeDirectly(messages: OpenAIMessage[]): Promise<OpenAIResponse> {
    const requestBody: any = {
      messages,
      model: this.providerConfig.model,
      temperature: this.providerConfig.temperature,
    };

    // Add GPT-5 specific settings if applicable
    if (this.providerConfig.model.startsWith('gpt-5')) {
      requestBody.reasoning_effort = this.providerConfig.gpt5.reasoningEffort;
      requestBody.response_format = {
        type: 'text',
        verbosity: this.providerConfig.gpt5.verbosity
      };
    }

    // Determine API URL based on provider
    let apiUrl: string;
    const isBApiProvider = this.provider === 'b-api-openai' || this.provider === 'b-api-academiccloud';
    
    if (isBApiProvider) {
      // B-API providers: Direct access to their endpoint
      apiUrl = this.providerConfig.baseUrl + '/chat/completions';
    } else {
      // OpenAI: Use local proxy server in development (runs on port 3001)
      apiUrl = this.providerConfig.baseUrl || 'http://localhost:3001/v1/chat/completions';
    }
    
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // B-API providers require X-API-KEY header
    if (isBApiProvider && this.providerConfig.requiresCustomHeader) {
      headers['X-API-KEY'] = this.providerConfig.apiKey;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${this.provider.toUpperCase()} API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Call LLM API via Netlify Function proxy (production mode)
   * Supports OpenAI and OpenAI-compatible providers
   */
  private async invokeViaProxy(messages: OpenAIMessage[]): Promise<OpenAIResponse> {
    const requestBody: any = {
      messages,
      model: this.providerConfig.model,
      temperature: this.providerConfig.temperature,
      provider: this.provider, // Tell proxy which provider to use
    };

    // Add GPT-5 specific settings if applicable
    if (this.providerConfig.model.startsWith('gpt-5')) {
      requestBody.modelKwargs = {
        reasoning_effort: this.providerConfig.gpt5.reasoningEffort,
        response_format: {
          type: 'text',
          verbosity: this.providerConfig.gpt5.verbosity
        }
      };
    }

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${this.provider.toUpperCase()} proxy error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }
}
