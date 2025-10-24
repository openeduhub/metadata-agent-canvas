/**
 * Metadata Agent Canvas Integration Library
 * 
 * Usage:
 * 1. Include this script in your HTML
 * 2. Call MetadataCanvas.init() to load the canvas
 * 3. Call MetadataCanvas.extractFromPage() to analyze current page
 */

(function(window) {
  'use strict';

  const MetadataCanvas = {
    canvasUrl: 'http://localhost:4200',
    container: null,
    iframe: null,
    isOpen: false,

    /**
     * Initialize the canvas (creates floating widget)
     */
    init: function(options = {}) {
      this.canvasUrl = options.canvasUrl || this.canvasUrl;
      this.createWidget();
      console.log('✅ Metadata Canvas initialized');
    },

    /**
     * Create floating widget with canvas
     */
    createWidget: function() {
      // Create container
      this.container = document.createElement('div');
      this.container.id = 'metadata-canvas-container';
      this.container.style.cssText = `
        position: fixed;
        top: 0;
        right: -520px;
        width: 520px;
        height: 100vh;
        background: white;
        box-shadow: -4px 0 16px rgba(0,0,0,0.2);
        z-index: 999999;
        transition: right 0.3s ease;
        display: flex;
        flex-direction: column;
      `;

      // Create header
      const header = document.createElement('div');
      header.style.cssText = `
        padding: 16px;
        background: #1976d2;
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: Arial, sans-serif;
      `;
      header.innerHTML = `
        <span style="font-weight: 600;">📝 Metadata Canvas</span>
        <button id="metadata-canvas-close" style="
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
        ">×</button>
      `;

      // Create iframe
      this.iframe = document.createElement('iframe');
      this.iframe.src = this.canvasUrl;
      this.iframe.style.cssText = `
        flex: 1;
        border: none;
        width: 100%;
      `;

      this.container.appendChild(header);
      this.container.appendChild(this.iframe);
      document.body.appendChild(this.container);

      // Create toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'metadata-canvas-toggle';
      toggleBtn.innerHTML = '📝';
      toggleBtn.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #1976d2;
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 999998;
        transition: transform 0.2s;
      `;
      toggleBtn.onmouseover = () => toggleBtn.style.transform = 'scale(1.1)';
      toggleBtn.onmouseout = () => toggleBtn.style.transform = 'scale(1)';
      toggleBtn.onclick = () => this.toggle();
      document.body.appendChild(toggleBtn);

      // Close button handler
      header.querySelector('#metadata-canvas-close').onclick = () => this.close();
    },

    /**
     * Open canvas
     */
    open: function() {
      this.container.style.right = '0';
      this.isOpen = true;
    },

    /**
     * Close canvas
     */
    close: function() {
      this.container.style.right = '-520px';
      this.isOpen = false;
    },

    /**
     * Toggle canvas
     */
    toggle: function() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    },

    /**
     * Extract metadata from current page
     */
    extractFromPage: function() {
      const metadata = this.extractPageMetadata();
      const text = this.formatMetadata(metadata);
      this.sendToCanvas(text);
      this.open();
    },

    /**
     * Extract page metadata
     */
    extractPageMetadata: function() {
      const getMetaContent = (name) => {
        const meta = document.querySelector(`meta[name="${name}"]`) || 
                      document.querySelector(`meta[property="${name}"]`) ||
                      document.querySelector(`meta[property="og:${name}"]`);
        return meta ? meta.getAttribute('content') : '';
      };

      // Get body text (first 3000 chars)
      const bodyText = document.body.innerText || document.body.textContent;
      const cleanText = bodyText.replace(/\s+/g, ' ').trim().substring(0, 3000);

      return {
        title: document.title || '',
        description: getMetaContent('description'),
        keywords: getMetaContent('keywords'),
        author: getMetaContent('author'),
        url: window.location.href,
        bodyText: cleanText
      };
    },

    /**
     * Format metadata for canvas
     */
    formatMetadata: function(metadata) {
      let text = '';
      
      if (metadata.title) {
        text += `Titel: ${metadata.title}\n\n`;
      }
      
      if (metadata.description) {
        text += `Beschreibung: ${metadata.description}\n\n`;
      }
      
      if (metadata.author) {
        text += `Autor: ${metadata.author}\n\n`;
      }
      
      if (metadata.keywords) {
        text += `Keywords: ${metadata.keywords}\n\n`;
      }
      
      text += `URL: ${metadata.url}\n\n`;
      text += `Inhalt:\n${metadata.bodyText}`;
      
      return text;
    },

    /**
     * Send text to canvas via postMessage
     */
    sendToCanvas: function(text) {
      if (!this.iframe || !this.iframe.contentWindow) {
        console.error('Canvas iframe not ready');
        return;
      }

      // Extract URL from metadata for separate handling
      const metadata = this.extractPageMetadata();

      // Wait a bit for iframe to load
      setTimeout(() => {
        this.iframe.contentWindow.postMessage({
          type: 'SET_PAGE_DATA',
          text: text,
          url: metadata.url,
          pageTitle: metadata.title,
          mode: 'bookmarklet'
        }, this.canvasUrl);
        
        console.log('✅ Metadata sent to canvas (URL:', metadata.url, ')');
      }, 500);
    }
  };

  // Expose to window
  window.MetadataCanvas = MetadataCanvas;

  console.log('📦 Metadata Canvas Integration Library loaded');

})(window);
