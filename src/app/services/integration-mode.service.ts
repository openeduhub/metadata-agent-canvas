import { Injectable } from '@angular/core';
import { I18nService } from './i18n.service';

export type IntegrationMode = 'standalone' | 'browser-extension' | 'bookmarklet';

export interface PageData {
  url: string;
  title?: string;
  content?: string;
  metaTags?: Record<string, string>;
  structuredData?: any[];
}

export interface UserInfo {
  isLoggedIn: boolean;
  username: string;
  systemName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class IntegrationModeService {
  
  private mode: IntegrationMode = 'standalone';
  private pageData: PageData | null = null;
  private userInfo: UserInfo = {
    isLoggedIn: false,
    username: 'Gast'
  };
  
  constructor(private i18n: I18nService) {
    this.detectMode();
  }
  
  /**
   * Detect integration mode from multiple signals
   */
  private detectMode() {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    
    // Priority 1: Explicit URL parameter
    if (modeParam === 'browser-extension') {
      this.mode = 'browser-extension';
      this.loadExtensionData(params);
      console.log('🔌 Mode: Browser Extension (URL param)');
      return;
    } else if (modeParam === 'bookmarklet') {
      this.mode = 'bookmarklet';
      this.loadBookmarkletData();
      console.log('🔖 Mode: Bookmarklet (URL param)');
      return;
    }
    
    // Priority 2: Check if running in iframe
    const isInIframe = window !== window.parent;
    
    if (isInIframe) {
      // In iframe - check origin to determine if Browser Extension or Bookmarklet
      // For now, we'll wait for postMessage to determine
      console.log('📱 Running in iframe - waiting for postMessage to determine mode...');
      
      // Listen for first postMessage to determine mode
      window.addEventListener('message', (event) => {
        if (event.data.mode === 'browser-extension') {
          this.mode = 'browser-extension';
          console.log('🔌 Mode: Browser Extension (via postMessage)');
        } else if (event.data.mode === 'bookmarklet') {
          this.mode = 'bookmarklet';
          console.log('🔖 Mode: Bookmarklet (via postMessage)');
        }
      }, { once: true });
      
      // Default to bookmarklet if running deployed
      const isDeployed = !window.location.hostname.includes('localhost') && 
                        !window.location.hostname.includes('127.0.0.1');
      
      if (isDeployed) {
        this.mode = 'bookmarklet';
        console.log('🌐 Mode: Bookmarklet (iframe, deployed)');
      } else {
        // Local iframe - likely extension testing
        this.mode = 'browser-extension';
        console.log('🔌 Mode: Browser Extension (iframe, local)');
      }
      return;
    }
    
    // Priority 3: Standalone mode detection
    const isDeployed = !window.location.hostname.includes('localhost') && 
                      !window.location.hostname.includes('127.0.0.1');
    
    if (isDeployed) {
      // Deployed without iframe = Standalone (direct access to Netlify URL)
      this.mode = 'standalone';
      console.log('🌐 Mode: Standalone (deployed, direct access)');
    } else {
      // Local development
      this.mode = 'standalone';
      console.log('🖥️ Mode: Standalone (local development)');
    }
  }
  
  /**
   * Load data from Browser Extension via URL parameters
   */
  private loadExtensionData(params: URLSearchParams) {
    const encodedData = params.get('data');
    if (!encodedData) {
      console.warn('⚠️ No data parameter in Extension mode');
      return;
    }
    
    try {
      const jsonString = decodeURIComponent(atob(encodedData));
      const data = JSON.parse(jsonString);
      
      this.pageData = {
        url: data.url,
        title: data.title,
        content: data.content?.main || data.content?.cleaned || data.content?.full || '',
        metaTags: data.meta || data.metaTags,
        structuredData: data.structuredData
      };
      
      this.userInfo = data.userInfo || {
        isLoggedIn: false,
        username: 'Gast'
      };
      
      console.log('📦 Extension data loaded:', {
        url: this.pageData.url,
        contentLength: this.pageData.content?.length,
        isLoggedIn: this.userInfo.isLoggedIn
      });
      
    } catch (error) {
      console.error('❌ Failed to parse Extension data:', error);
    }
  }
  
  /**
   * Load data from Bookmarklet (current page)
   */
  private loadBookmarkletData() {
    const params = new URLSearchParams(window.location.search);
    const encodedData = params.get('data');
    
    if (encodedData) {
      // Data passed via URL parameter (from bookmarklet script)
      try {
        const jsonString = decodeURIComponent(atob(encodedData));
        const data = JSON.parse(jsonString);
        
        this.pageData = {
          url: data.url,
          title: data.title,
          content: data.content,
          metaTags: data.metaTags
        };
        
        console.log('📦 Bookmarklet data loaded from URL:', {
          url: this.pageData.url,
          contentLength: this.pageData.content?.length
        });
      } catch (error) {
        console.error('❌ Failed to parse bookmarklet data:', error);
      }
    } else {
      // No data parameter - user will input manually
      console.log('📮 Bookmarklet mode (manual input)');
    }
    
    // Always guest mode in bookmarklet
    this.userInfo = {
      isLoggedIn: false,
      username: 'Gast'
    };
  }
  
  /**
   * Set mode explicitly (e.g., from postMessage)
   */
  setMode(mode: IntegrationMode) {
    this.mode = mode;
    console.log(`🔄 Mode updated to: ${mode}`);
  }
  
  /**
   * Get current integration mode
   */
  getMode(): IntegrationMode {
    return this.mode;
  }
  
  /**
   * Check if running in Browser Extension
   */
  isBrowserExtension(): boolean {
    return this.mode === 'browser-extension';
  }
  
  /**
   * Check if running as Bookmarklet
   */
  isBookmarklet(): boolean {
    return this.mode === 'bookmarklet';
  }
  
  /**
   * Check if running standalone
   */
  isStandalone(): boolean {
    return this.mode === 'standalone';
  }
  
  /**
   * Get page data
   */
  getPageData(): PageData | null {
    return this.pageData;
  }
  
  /**
   * Set page data (for bookmarklet)
   */
  setPageData(data: PageData) {
    this.pageData = data;
  }
  
  /**
   * Get user info
   */
  getUserInfo(): UserInfo {
    return this.userInfo;
  }
  
  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    return this.userInfo.isLoggedIn;
  }
  
  /**
   * Send metadata back to parent (Extension or Bookmarklet)
   */
  sendMetadataToParent(metadata: any) {
    if (this.isBrowserExtension() || this.isBookmarklet()) {
      window.parent.postMessage({
        type: 'CANVAS_METADATA_READY',
        metadata: metadata,
        mode: this.mode
      }, '*');
      
      console.log('📤 Metadata sent to parent');
    }
  }
  
  /**
   * Request close from parent
   */
  requestClose() {
    if (this.isBrowserExtension() || this.isBookmarklet()) {
      window.parent.postMessage({
        type: 'CANVAS_CLOSE'
      }, '*');
      
      console.log('🚪 Close requested');
    }
  }
  
  /**
   * Get submit button text based on mode
   */
  getSubmitButtonText(): string {
    if (this.isLoggedIn()) {
      return this.i18n.instant('FOOTER.SUBMIT_LOGGED_IN');
    }

    if (this.isBrowserExtension()) {
      return this.i18n.instant('FOOTER.SEND_TO_PLUGIN');
    }

    if (this.isBookmarklet()) {
      return this.i18n.instant('FOOTER.SUBMIT_GUEST');
    }

    return this.i18n.instant('FOOTER.DOWNLOAD_JSON');
  }
  
  /**
   * Get mode display name
   */
  getModeDisplayName(): string {
    switch (this.mode) {
      case 'browser-extension':
        return this.i18n.instant('HEADER.MODE.BROWSER_EXTENSION');
      case 'bookmarklet':
        return this.i18n.instant('HEADER.MODE.BOOKMARKLET');
      default:
        return this.i18n.instant('HEADER.MODE.STANDALONE');
    }
  }
}
