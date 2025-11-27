import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { PlatformDetectionService } from './platform-detection.service';

@Injectable({
  providedIn: 'root'
})
export class GuestSubmissionService {
  
  // Use platform-specific proxy to avoid CORS issues
  private readonly PROXY_URL: string;
  
  constructor(private platformDetection: PlatformDetectionService) {
    this.PROXY_URL = this.getProxyUrl();
  }
  
  /**
   * Get proxy URL based on environment and platform
   * - Local development: http://localhost:3001/repository
   * - Production: Auto-detect (Vercel or Netlify)
   */
  private getProxyUrl(): string {
    if (environment.production) {
      // Use Platform Detection for correct endpoint
      const proxyUrl = this.platformDetection.getRepositoryProxyUrl();
      return proxyUrl;
    }
    
    // Development: Use URL from environment config
    const proxyUrl = (environment as any).repository?.proxyUrl || 'http://localhost:3001/repository';
    return proxyUrl;
  }
  
  /**
   * Check for duplicates by URL (via proxy)
   */
  async checkDuplicate(url: string): Promise<{exists: boolean; nodeId?: string; title?: string}> {
    try {
      const response = await fetch(this.PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'checkDuplicate',
          data: { url }
        })
      });
      
      if (!response.ok) {
        return { exists: false };
      }
      
      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('Duplicate check error:', error);
      return { exists: false };
    }
  }
  
  /**
   * Submit metadata as guest to WLO repository (via proxy)
   */
  async submitAsGuest(metadata: any): Promise<{success: boolean; nodeId?: string; error?: string; duplicate?: boolean}> {
    try {
      // 0. Check for duplicates first
      const url = metadata['ccm:wwwurl'];
      if (url) {
        const duplicateCheck = await this.checkDuplicate(url);
        if (duplicateCheck.exists) {
          return {
            success: false,
            duplicate: true,
            nodeId: duplicateCheck.nodeId,
            error: `Diese URL existiert bereits: "${duplicateCheck.title}"`
          };
        }
      }
      
      // 1. Create node via proxy
      const createResponse = await fetch(this.PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'createNode',
          data: { metadata }
        })
      });
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || `Create node failed: ${createResponse.status}`);
      }
      
      const createData = await createResponse.json();
      const nodeId = createData.nodeId;
      
      // 2. Set metadata via proxy
      await fetch(this.PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'setMetadata',
          data: { nodeId, metadata }
        })
      });
      
      // 3. Set collections if present
      const collectionIds = [
        metadata['virtual:collection_id_primary'],
        ...(metadata['ccm:collection_id'] || [])
      ].filter(Boolean);
      
      if (collectionIds.length > 0) {
        await fetch(this.PROXY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'setCollections',
            data: { nodeId, collectionIds }
          })
        });
        
        }
      
      // 4. Start workflow via proxy
      await fetch(this.PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'startWorkflow',
          data: { nodeId }
        })
      });
      
      return {
        success: true,
        nodeId: nodeId
      };
      
    } catch (error) {
      console.error('❌ Guest submission failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
}
