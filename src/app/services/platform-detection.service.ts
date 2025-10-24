import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Platform Detection Service
 * Determines deployment platform (Netlify/Vercel/Local) and returns correct proxy paths
 * 
 * Priority:
 * 1. Environment variable (deploymentPlatform in environment.ts)
 * 2. Runtime hostname detection
 * 3. Fallback to Vercel
 */

export type DeploymentPlatform = 'netlify' | 'vercel' | 'local' | 'unknown';

@Injectable({
  providedIn: 'root'
})
export class PlatformDetectionService {
  
  private platform: DeploymentPlatform = 'unknown';
  private platformConfirmed: boolean = false;
  
  constructor() {
    this.detectPlatform();
  }
  
  /**
   * Detect the current deployment platform
   */
  private detectPlatform(): void {
    console.log('🔍 [PLATFORM DETECTION] Starting detection...');
    
    // PRIORITY 1: Check environment variable (build-time configuration)
    const envPlatform = (environment as any).deploymentPlatform;
    if (envPlatform && envPlatform !== 'auto') {
      this.platform = envPlatform as DeploymentPlatform;
      this.platformConfirmed = true;
      console.log(`✅ [PLATFORM DETECTION] Set via environment.ts: ${envPlatform.toUpperCase()}`);
      console.log(`✅ [PLATFORM DETECTION] Will use: ${this.getEndpointPrefix()} endpoints`);
      return;
    }
    
    // PRIORITY 2: Runtime hostname detection
    const hostname = window.location.hostname;
    const fullUrl = window.location.href;
    
    console.log('🔍 [PLATFORM DETECTION] Environment: auto-detect');
    console.log('🔍 [PLATFORM DETECTION] Hostname:', hostname);
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      this.platform = 'local';
      console.log('✅ [PLATFORM DETECTION] Detected: Local Development');
      return;
    }
    
    // Vercel detection (check first, has priority)
    const isVercelHost = hostname.includes('vercel.app') || 
                         hostname.includes('vercel.com') ||
                         hostname.includes('.vercel.') ||
                         hostname.endsWith('.vercel.app');
    const hasVercelInUrl = fullUrl.includes('vercel');
    
    if (isVercelHost || hasVercelInUrl || this.isVercelCustomDomain()) {
      this.platform = 'vercel';
      this.platformConfirmed = true;
      console.log('✅ [PLATFORM DETECTION] Detected: VERCEL (hostname)');
      console.log(`   Hostname: ${hostname}`);
      console.log('✅ [PLATFORM DETECTION] Will use: /api/* endpoints');
      return;
    }
    
    // Netlify detection (after Vercel check)
    const isNetlifyHost = hostname.includes('netlify.app') || 
                          hostname.includes('.netlify.') ||
                          hostname.endsWith('.netlify.app');
    
    if (isNetlifyHost || this.isNetlifyCustomDomain()) {
      this.platform = 'netlify';
      this.platformConfirmed = true;
      console.log('✅ [PLATFORM DETECTION] Detected: Netlify (hostname)');
      console.log(`   Hostname: ${hostname}`);
      console.log('✅ [PLATFORM DETECTION] Will use: /.netlify/functions/* endpoints');
      return;
    }
    
    // PRIORITY 3: Default fallback to Vercel
    console.warn('⚠️ [PLATFORM DETECTION] Could not detect platform from hostname:', hostname);
    console.warn('⚠️ [PLATFORM DETECTION] Defaulting to VERCEL (/api/*)');
    console.warn('⚠️ [PLATFORM DETECTION] TIP: Set deploymentPlatform in environment.ts to override');
    this.platform = 'vercel';
  }
  
  /**
   * Get endpoint prefix for current platform
   */
  private getEndpointPrefix(): string {
    switch (this.platform) {
      case 'vercel': return '/api';
      case 'netlify': return '/.netlify/functions';
      case 'local': return 'http://localhost:3001';
      default: return '/api';
    }
  }
  
  /**
   * Check if running on Vercel custom domain
   * Vercel sets window.__VERCEL__ or other indicators
   */
  private isVercelCustomDomain(): boolean {
    // Check for Vercel-specific indicators
    // Vercel injects __NEXT_DATA__ or __VERCEL__ in some cases
    return !!(window as any).__VERCEL__ || 
           !!(window as any).__NEXT_DATA__;
  }
  
  /**
   * Check if running on Netlify custom domain
   * Can check for Netlify-specific headers or scripts
   */
  private isNetlifyCustomDomain(): boolean {
    // Check for Netlify-specific indicators
    // Netlify often injects scripts with "netlify" in the URL
    const scripts = Array.from(document.scripts);
    return scripts.some(script => script.src.includes('netlify'));
  }
  
  /**
   * Get current platform
   */
  getPlatform(): DeploymentPlatform {
    return this.platform;
  }
  
  /**
   * Get OpenAI Proxy URL based on platform
   */
  getOpenAIProxyUrl(): string {
    // Runtime check: Try Vercel first if hostname contains vercel
    if (!this.platformConfirmed && window.location.hostname.includes('vercel')) {
      this.platform = 'vercel';
      this.platformConfirmed = true;
      console.log('🔄 Platform corrected to Vercel via runtime check');
    }
    
    switch (this.platform) {
      case 'netlify':
        return '/.netlify/functions/openai-proxy';
      case 'vercel':
        return '/api/openai-proxy';
      case 'local':
        return 'http://localhost:3001/llm';
      default:
        // Default to Vercel (most common deployment)
        console.warn('⚠️ [FALLBACK] Using Vercel API endpoint');
        return '/api/openai-proxy';
    }
  }
  
  /**
   * Get Geocoding Proxy URL based on platform
   */
  getGeocodingProxyUrl(): string {
    switch (this.platform) {
      case 'netlify':
        return '/.netlify/functions/photon';
      case 'vercel':
        return '/api/geocode-proxy';
      case 'local':
        return 'http://localhost:3001/geocoding';
      default:
        console.warn('⚠️ [FALLBACK] Using Vercel geocode endpoint');
        return '/api/geocode-proxy';
    }
  }
  
  /**
   * Get Repository Proxy URL based on platform
   */
  getRepositoryProxyUrl(): string {
    switch (this.platform) {
      case 'netlify':
        return '/.netlify/functions/repository-proxy';
      case 'vercel':
        return '/api/repository-proxy';
      case 'local':
        return 'http://localhost:3001/repository';
      default:
        console.warn('⚠️ [FALLBACK] Using Vercel repository endpoint');
        return '/api/repository-proxy';
    }
  }
  
  /**
   * Check if running on Netlify
   */
  isNetlify(): boolean {
    return this.platform === 'netlify';
  }
  
  /**
   * Check if running on Vercel
   */
  isVercel(): boolean {
    return this.platform === 'vercel';
  }
  
  /**
   * Check if running locally
   */
  isLocal(): boolean {
    return this.platform === 'local';
  }
  
  /**
   * Get platform display name
   */
  getPlatformName(): string {
    switch (this.platform) {
      case 'netlify':
        return 'Netlify';
      case 'vercel':
        return 'Vercel';
      case 'local':
        return 'Local Development';
      default:
        return 'Unknown Platform';
    }
  }
}
