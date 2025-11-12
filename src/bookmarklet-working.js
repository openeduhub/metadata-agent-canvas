// Functional Bookmarklet - Opens sidebar reliably
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
  iframe.src = 'https://metadata-agent-canvas.staging.openeduhub.net/?mode=bookmarklet';
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
  
  // Helper: Get JSON-LD
  const getJsonLd = () => {
    const scripts = d.querySelectorAll('script[type="application/ld+json"]');
    const jsonLdData = [];
    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        jsonLdData.push(data);
      } catch(e) {
        console.warn('Failed to parse JSON-LD:', e);
      }
    });
    return jsonLdData;
  };
  
  // Helper: Get Schema.org Microdata
  const getSchemaOrg = () => {
    const items = d.querySelectorAll('[itemscope]');
    const schemaData = [];
    items.forEach(item => {
      const itemType = item.getAttribute('itemtype');
      if (itemType) {
        schemaData.push({
          type: itemType.split('/').pop(),
          html: item.innerHTML.substring(0, 500)
        });
      }
    });
    return schemaData;
  };
  
  // Helper: Get license info
  const getLicense = () => {
    const licenseLink = d.querySelector('link[rel="license"]');
    if (licenseLink) return { source: 'link[rel=license]', url: licenseLink.href };
    const dcRights = getMeta('DC.rights');
    if (dcRights) return { source: 'DC.rights', text: dcRights };
    const copyright = getMeta('copyright');
    if (copyright) return { source: 'meta[copyright]', text: copyright };
    return null;
  };
  
  // Helper: Get breadcrumbs
  const getBreadcrumbs = () => {
    const breadcrumbs = [];
    const selectors = ['nav[aria-label="breadcrumb"] a', '.breadcrumb a', '.breadcrumbs a', '[itemtype*="BreadcrumbList"] a'];
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
  
  // Helper: Get tags
  const getTags = () => {
    const tags = [];
    d.querySelectorAll('a[rel="tag"], [rel="category"]').forEach(link => {
      const text = link.textContent?.trim();
      if (text) tags.push(text);
    });
    d.querySelectorAll('meta[property="article:tag"]').forEach(meta => {
      const content = meta.getAttribute('content');
      if (content) tags.push(content);
    });
    d.querySelectorAll('.tags a, .tag-list a, .post-tags a').forEach(link => {
      const text = link.textContent?.trim();
      if (text && !tags.includes(text)) tags.push(text);
    });
    return tags.length > 0 ? tags : null;
  };
  
  // Extract and send data
  const sendData = () => {
    // Check if iframe is ready
    if (!iframe.contentWindow) {
      console.log('⏳ Waiting for iframe...');
      setTimeout(sendData, 200);
      return;
    }
    
    console.log('📊 Extracting page data...');
    
    let text = '';
    const data = {
      url: window.location.href,
      title: d.title || ''
    };
    
    // Basic info
    if (d.title) text += `Titel: ${d.title}\n\n`;
    text += `URL: ${window.location.href}\n\n`;
    
    // Meta tags
    const description = getMeta('description');
    const author = getMeta('author');
    const keywords = getMeta('keywords');
    const language = d.documentElement.lang || getMeta('language');
    const copyright = getMeta('copyright');
    
    data.meta = { description, keywords, author, language, copyright };
    
    if (description) text += `Beschreibung: ${description}\n\n`;
    if (author) text += `Autor: ${author}\n\n`;
    if (keywords) text += `Keywords: ${keywords}\n\n`;
    
    // OpenGraph
    const ogTitle = getMeta('og:title');
    const ogDesc = getMeta('og:description');
    const ogImage = getMeta('og:image');
    const ogType = getMeta('og:type');
    const ogLocale = getMeta('og:locale');
    const ogSiteName = getMeta('og:site_name');
    
    data.openGraph = { title: ogTitle, description: ogDesc, image: ogImage, type: ogType, locale: ogLocale, siteName: ogSiteName };
    
    if (ogTitle || ogDesc) {
      text += '--- OpenGraph ---\n';
      if (ogTitle) text += `Title: ${ogTitle}\n`;
      if (ogType) text += `Type: ${ogType}\n`;
      if (ogDesc) text += `Description: ${ogDesc}\n`;
      text += '\n';
    }
    
    // Twitter
    const twCard = getMeta('twitter:card');
    const twTitle = getMeta('twitter:title');
    const twDesc = getMeta('twitter:description');
    const twImage = getMeta('twitter:image');
    
    data.twitter = { card: twCard, title: twTitle, description: twDesc, image: twImage };
    
    // Dublin Core
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
      if (dcCreator) text += `Creator: ${dcCreator}\n`;
      if (dcSubject) text += `Subject: ${dcSubject}\n`;
      text += '\n';
    }
    
    // LRMI
    const lrmiUse = getMeta('lrmi:educationalUse');
    const lrmiLevel = getMeta('lrmi:educationalLevel');
    const lrmiType = getMeta('lrmi:learningResourceType');
    const lrmiTime = getMeta('lrmi:timeRequired');
    
    data.lrmi = { educationalUse: lrmiUse, educationalLevel: lrmiLevel, learningResourceType: lrmiType, timeRequired: lrmiTime };
    
    if (lrmiUse || lrmiLevel) {
      text += '--- LRMI (Learning Resource) ---\n';
      if (lrmiUse) text += `Educational Use: ${lrmiUse}\n`;
      if (lrmiLevel) text += `Educational Level: ${lrmiLevel}\n`;
      text += '\n';
    }
    
    // License
    const license = getLicense();
    if (license) {
      data.license = license;
      text += `License: ${license.text || license.url}\n\n`;
    }
    
    // Breadcrumbs
    const breadcrumbs = getBreadcrumbs();
    if (breadcrumbs) {
      data.breadcrumbs = breadcrumbs;
      text += 'Breadcrumbs: ' + breadcrumbs.map(b => b.text).join(' > ') + '\n\n';
    }
    
    // Tags
    const tags = getTags();
    if (tags) {
      data.tags = tags;
      text += `Tags: ${tags.join(', ')}\n\n`;
    }
    
    // Canonical
    const canonical = d.querySelector('link[rel="canonical"]');
    if (canonical) {
      data.canonical = canonical.href;
    }
    
    // Structured data
    const jsonLd = getJsonLd();
    if (jsonLd.length > 0) {
      text += '--- JSON-LD ---\n' + JSON.stringify(jsonLd, null, 2).substring(0, 1000) + '\n\n';
      data.structuredData = jsonLd;
    }
    
    const schemaOrg = getSchemaOrg();
    if (schemaOrg.length > 0) {
      if (!data.structuredData) data.structuredData = [];
      data.schemaOrg = schemaOrg;
    }
    
    // Main content
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
    
    // Send to Canvas
    try {
      iframe.contentWindow.postMessage({
        type: 'SET_PAGE_DATA',
        text: text,
        url: window.location.href,
        pageTitle: d.title,
        mode: 'bookmarklet',
        pageData: data
      }, '*');
      console.log('✅ Data sent to Canvas');
    } catch(e) {
      console.error('❌ Failed to send data:', e);
    }
  };
  
  // Main control
  window.MCanvas = {
    open: () => {
      container.style.right = '0';
      sendData();
    },
    close: () => {
      container.style.right = '-900px';
      setTimeout(() => {
        container.remove();
        button.remove();
      }, 300);
    }
  };
  
  // Listen for close
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'CANVAS_CLOSE') {
      MCanvas.close();
    }
  });
  
  // Open sidebar after short delay, then send data
  setTimeout(() => {
    container.style.right = '0';
    // Wait a bit longer for iframe to be ready
    setTimeout(sendData, 1500);
  }, 100);
})();
