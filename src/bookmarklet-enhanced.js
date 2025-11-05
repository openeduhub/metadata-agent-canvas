// Enhanced Bookmarklet for Metadata Extraction
// Extracts Meta Tags, Schema.org, JSON-LD, OpenGraph, and structured DOM data

(function() {
  // If already open, just toggle
  if (window.MCanvas) {
    MCanvas.open();
    return;
  }

  const d = document;
  
  // Create container
  const container = d.createElement('div');
  container.id = 'mc-c';
  container.style.cssText = 'position:fixed;top:0;right:-900px;width:900px;height:100vh;background:white;box-shadow:-4px 0 16px rgba(0,0,0,.2);z-index:999999;transition:right .3s';
  
  // Create iframe
  const iframe = d.createElement('iframe');
  iframe.src = 'https://metadata-agent-canvas.vercel.app/?mode=bookmarklet';
  iframe.style.cssText = 'width:100%;height:100%;border:none';
  container.appendChild(iframe);
  d.body.appendChild(container);
  
  // Create toggle button
  const button = d.createElement('button');
  button.innerHTML = '📝';
  button.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#0062ac;color:white;border:none;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:999998;transition:transform 0.2s';
  button.onmouseover = () => button.style.transform = 'scale(1.1)';
  button.onmouseout = () => button.style.transform = 'scale(1)';
  button.onclick = () => container.style.right = container.style.right === '0px' ? '-900px' : '0';
  d.body.appendChild(button);
  
  // Helper: Get meta tag
  const getMeta = (name) => {
    const el = d.querySelector(`meta[name="${name}"]`) || 
               d.querySelector(`meta[property="${name}"]`);
    return el ? el.getAttribute('content') : null;
  };
  
  // Helper: Extract JSON-LD
  const getJsonLd = () => {
    const scripts = d.querySelectorAll('script[type="application/ld+json"]');
    const jsonLdData = [];
    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        jsonLdData.push(data);
      } catch (e) {
        console.warn('Failed to parse JSON-LD:', e);
      }
    });
    return jsonLdData;
  };
  
  // Helper: Extract Schema.org microdata
  const getSchemaOrg = () => {
    const items = d.querySelectorAll('[itemscope]');
    const schemaData = [];
    items.forEach(item => {
      const type = item.getAttribute('itemtype');
      if (type) {
        schemaData.push({
          type: type.split('/').pop(),
          html: item.innerHTML.substring(0, 500)
        });
      }
    });
    return schemaData;
  };
  
  // Helper: Extract license info
  const getLicense = () => {
    // Check license link
    const licLink = d.querySelector('[rel="license"]');
    if (licLink) return { source: 'rel=license', url: licLink.href, text: licLink.textContent?.trim() };
    
    // Check DC rights
    const dcRights = getMeta('DC.rights');
    if (dcRights) return { source: 'DC.rights', text: dcRights };
    
    // Check copyright
    const copyright = getMeta('copyright');
    if (copyright) return { source: 'copyright', text: copyright };
    
    // Search for CC license in text
    const ccMatch = d.body.textContent.match(/CC (BY|BY-SA|BY-NC|BY-ND|BY-NC-SA|BY-NC-ND|0) (\d\.\d)/i);
    if (ccMatch) return { source: 'body-text', text: ccMatch[0] };
    
    return null;
  };
  
  // Helper: Extract breadcrumbs
  const getBreadcrumbs = () => {
    const breadcrumbs = [];
    const selectors = ['[aria-label="breadcrumb"] a', '.breadcrumb a', '.breadcrumbs a'];
    for (const sel of selectors) {
      const links = d.querySelectorAll(sel);
      if (links.length > 0) {
        links.forEach(link => {
          const text = link.textContent?.trim();
          if (text) breadcrumbs.push({ text, href: link.href });
        });
        break;
      }
    }
    return breadcrumbs.length > 0 ? breadcrumbs : null;
  };
  
  // Helper: Extract tags
  const getTags = () => {
    const tags = [];
    // rel="tag"
    d.querySelectorAll('a[rel="tag"], [rel="category"]').forEach(link => {
      const text = link.textContent?.trim();
      if (text) tags.push(text);
    });
    // article:tag meta
    d.querySelectorAll('meta[property="article:tag"]').forEach(meta => {
      const content = meta.getAttribute('content');
      if (content) tags.push(content);
    });
    // tag containers
    d.querySelectorAll('.tags a, .tag-list a, .post-tags a').forEach(link => {
      const text = link.textContent?.trim();
      if (text && !tags.includes(text)) tags.push(text);
    });
    return tags.length > 0 ? tags : null;
  };
  
  // Extract and send page data
  const extractAndSend = () => {
    // Check if iframe is ready
    if (!iframe.contentWindow) {
      console.warn('⚠️ Iframe not ready yet, waiting...');
      setTimeout(extractAndSend, 100);
      return;
    }
    
    let text = '';
    const data = {
      url: window.location.href,
      title: d.title || ''
    };
    
    // Basic page info
    if (d.title) text += `Titel: ${d.title}\n\n`;
    text += `URL: ${window.location.href}\n\n`;
    
    // Standard Meta Tags
    const description = getMeta('description');
    const author = getMeta('author');
    const keywords = getMeta('keywords');
    const language = d.documentElement.lang || getMeta('language');
    const copyright = getMeta('copyright');
      
    data.meta = { description, keywords, author, language, copyright };
    
    if (description) text += `Beschreibung: ${description}\n\n`;
    if (author) text += `Autor: ${author}\n\n`;
    if (keywords) text += `Keywords: ${keywords}\n\n`;
    if (language) text += `Sprache: ${language}\n\n`;
    
    // OpenGraph
    const ogTitle = getMeta('og:title');
    const ogDesc = getMeta('og:description');
    const ogImage = getMeta('og:image');
    const ogType = getMeta('og:type');
    const ogLocale = getMeta('og:locale');
    const ogSiteName = getMeta('og:site_name');
    
    data.openGraph = { title: ogTitle, description: ogDesc, image: ogImage, type: ogType, locale: ogLocale, siteName: ogSiteName };
      
    if (ogTitle || ogDesc || ogImage || ogType) {
      text += '--- OpenGraph ---\n';
      if (ogTitle) text += `Title: ${ogTitle}\n`;
      if (ogType) text += `Type: ${ogType}\n`;
      if (ogDesc) text += `Description: ${ogDesc}\n`;
      if (ogImage) text += `Image: ${ogImage}\n`;
      if (ogLocale) text += `Locale: ${ogLocale}\n`;
      if (ogSiteName) text += `Site Name: ${ogSiteName}\n`;
      text += '\n';
    }
      
      // Twitter Cards
      const twCard = getMeta('twitter:card');
      const twTitle = getMeta('twitter:title');
      const twDesc = getMeta('twitter:description');
      const twImage = getMeta('twitter:image');
      
      data.twitter = { card: twCard, title: twTitle, description: twDesc, image: twImage };
      
      if (twCard || twTitle || twDesc || twImage) {
        text += '--- Twitter Card ---\n';
        if (twCard) text += `Card: ${twCard}\n`;
        if (twTitle) text += `Title: ${twTitle}\n`;
        if (twDesc) text += `Description: ${twDesc}\n`;
        if (twImage) text += `Image: ${twImage}\n`;
        text += '\n';
      }
      
      // Dublin Core (wichtig für Bildung/Bibliotheken)
      const dcTitle = getMeta('DC.title');
      const dcCreator = getMeta('DC.creator');
      const dcSubject = getMeta('DC.subject');
      const dcDesc = getMeta('DC.description');
      const dcDate = getMeta('DC.date');
      const dcType = getMeta('DC.type');
      const dcFormat = getMeta('DC.format');
      const dcLanguage = getMeta('DC.language');
      const dcRights = getMeta('DC.rights');
      
      data.dublinCore = { title: dcTitle, creator: dcCreator, subject: dcSubject, description: dcDesc, date: dcDate, type: dcType, format: dcFormat, language: dcLanguage, rights: dcRights };
      
      if (dcTitle || dcCreator || dcSubject) {
        text += '--- Dublin Core ---\n';
        if (dcTitle) text += `Title: ${dcTitle}\n`;
        if (dcCreator) text += `Creator: ${dcCreator}\n`;
        if (dcSubject) text += `Subject: ${dcSubject}\n`;
        if (dcDesc) text += `Description: ${dcDesc}\n`;
        if (dcDate) text += `Date: ${dcDate}\n`;
        if (dcType) text += `Type: ${dcType}\n`;
        if (dcRights) text += `Rights: ${dcRights}\n`;
        text += '\n';
      }
      
      // LRMI (Learning Resource Metadata Initiative - wichtig für Bildungsressourcen!)
      const lrmiUse = getMeta('lrmi:educationalUse');
      const lrmiLevel = getMeta('lrmi:educationalLevel');
      const lrmiType = getMeta('lrmi:learningResourceType');
      const lrmiTime = getMeta('lrmi:timeRequired');
      
      data.lrmi = { educationalUse: lrmiUse, educationalLevel: lrmiLevel, learningResourceType: lrmiType, timeRequired: lrmiTime };
      
      if (lrmiUse || lrmiLevel || lrmiType) {
        text += '--- LRMI (Learning Resource) ---\n';
        if (lrmiUse) text += `Educational Use: ${lrmiUse}\n`;
        if (lrmiLevel) text += `Educational Level: ${lrmiLevel}\n`;
        if (lrmiType) text += `Resource Type: ${lrmiType}\n`;
        if (lrmiTime) text += `Time Required: ${lrmiTime}\n`;
        text += '\n';
      }
      
      // License
      const license = getLicense();
      if (license) {
        data.license = license;
        text += `--- License ---\n${license.source}: ${license.text || license.url}\n\n`;
      }
      
      // Breadcrumbs (für Fach/Hierarchie)
      const breadcrumbs = getBreadcrumbs();
      if (breadcrumbs) {
        data.breadcrumbs = breadcrumbs;
        text += '--- Breadcrumbs ---\n';
        breadcrumbs.forEach(bc => text += `${bc.text} > `);
        text += '\n\n';
      }
      
      // Tags
      const tags = getTags();
      if (tags) {
        data.tags = tags;
        text += `--- Tags ---\n${tags.join(', ')}\n\n`;
      }
      
      // Canonical URL
      const canonical = d.querySelector('link[rel="canonical"]');
      if (canonical) {
        data.canonical = canonical.href;
        text += `Canonical URL: ${canonical.href}\n\n`;
      }
      
      // JSON-LD
      const jsonLd = getJsonLd();
      if (jsonLd.length > 0) {
        text += '--- JSON-LD Structured Data ---\n';
        text += JSON.stringify(jsonLd, null, 2).substring(0, 2000) + '\n\n';
        data.structuredData = jsonLd;
      }
      
      // Schema.org
      const schemaOrg = getSchemaOrg();
      if (schemaOrg.length > 0) {
        text += '--- Schema.org Microdata ---\n';
        schemaOrg.forEach(item => text += `Type: ${item.type}\n`);
        text += '\n';
        if (!data.structuredData) data.structuredData = [];
        data.schemaOrg = schemaOrg;
      }
      
      // Main content preview (5000 chars like plugin)
      const selectors = ['main', 'article', '[role="main"]', '.main-content', '#content'];
      let mainContent = '';
      for (const sel of selectors) {
        const el = d.querySelector(sel);
        if (el) {
          mainContent = (el.innerText || el.textContent).substring(0, 5000);
          break;
        }
      }
      if (!mainContent) mainContent = d.body.innerText.substring(0, 5000);
      
      data.mainContent = mainContent;
      text += '--- Seiteninhalt (Hauptbereich) ---\n';
      text += mainContent.substring(0, 1000).trim() + '...\n\n';
      
      // Send to Canvas with complete structured data
      iframe.contentWindow.postMessage({
        type: 'SET_PAGE_DATA',
        text: text,
        url: window.location.href,
        pageTitle: d.title,
        mode: 'bookmarklet',
        pageData: data  // Complete structured data matching plugin format
      }, '*');
      
      console.log('📤 Sent page data to Canvas:', {
        textLength: text.length,
        hasJsonLd: jsonLd.length > 0,
        hasSchemaOrg: schemaOrg.length > 0,
        hasDC: !!dcTitle,
        hasLRMI: !!lrmiUse,
        hasLicense: !!license,
        hasBreadcrumbs: !!breadcrumbs,
        hasTags: !!tags
      });
  };
  
  // Main control object
  window.MCanvas = {
    open: () => {
      // Open sidebar
      container.style.right = '0';
      // Extract and send data (with iframe ready check)
      extractAndSend();
    },
    
    close: () => {
      container.style.right = '-900px';
      setTimeout(() => {
        container.remove();
        button.remove();
      }, 300);
    }
  };
  
  // Listen for close message from Canvas
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'CANVAS_CLOSE') {
      console.log('🚪 Close message received');
      MCanvas.close();
    }
  });
  
  // Debug: Log bookmarklet initialization
  console.log('🚀 Bookmarklet initialized');
  console.log('📝 Button should be visible at bottom right');
  console.log('📦 Container created, iframe loading...');
  
  // Wait for iframe to load, then open and send data
  iframe.addEventListener('load', () => {
    console.log('✅ Iframe loaded, extracting page data...');
    // Small delay to ensure Canvas is fully initialized
    setTimeout(() => {
      console.log('📂 Opening sidebar...');
      container.style.right = '0';
      extractAndSend();
    }, 500);
  });
  
  // Fallback: If iframe doesn't load within 3 seconds, open anyway
  setTimeout(() => {
    if (container.style.right !== '0px') {
      console.warn('⚠️ Iframe load timeout, opening sidebar anyway...');
      container.style.right = '0';
      // Try to send data after another delay
      setTimeout(extractAndSend, 1000);
    }
  }, 3000);
})();
