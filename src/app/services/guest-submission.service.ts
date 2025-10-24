import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GuestSubmissionService {
  
  // Use Netlify Function as proxy to avoid CORS issues
  private readonly PROXY_URL = this.getProxyUrl();
  
  /**
   * Get proxy URL based on environment
   * - Local development: From environment.repository.proxyUrl
   * - Production: /.netlify/functions/repository-proxy
   */
  private getProxyUrl(): string {
    if (environment.production) {
      return '/.netlify/functions/repository-proxy';
    }
    
    // Development: Use URL from environment config
    const proxyUrl = (environment as any).repository?.proxyUrl || 'http://localhost:3001/repository';
    console.log(`📦 Using repository proxy: ${proxyUrl}`);
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
        console.warn('Duplicate check failed:', response.status);
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
      console.log('📮 Submitting metadata as guest via proxy...');
      
      // 0. Check for duplicates first
      const url = metadata['ccm:wwwurl'];
      if (url) {
        const duplicateCheck = await this.checkDuplicate(url);
        if (duplicateCheck.exists) {
          console.log('⚠️ Duplicate found:', duplicateCheck.nodeId);
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
      
      console.log('✅ Node created:', nodeId);
      
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
      
      console.log('✅ Metadata set');
      
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
        
        console.log('✅ Collections set');
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
      
      console.log('✅ Workflow started');
      
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
