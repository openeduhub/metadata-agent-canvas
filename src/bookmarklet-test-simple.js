// Minimal test bookmarklet - just opens sidebar without iframe
(function() {
  console.log('🧪 TEST: Simple bookmarklet started');
  
  // Create container
  const container = document.createElement('div');
  container.id = 'test-sidebar';
  container.style.cssText = 'position:fixed;top:0;right:0;width:400px;height:100vh;background:#1976d2;color:white;z-index:999999;padding:20px;box-sizing:border-box;';
  container.innerHTML = `
    <h1 style="margin:0 0 20px 0;">✅ Sidebar Test</h1>
    <p>Wenn Sie dies sehen, funktioniert der Bookmarklet-Code!</p>
    <button onclick="this.parentElement.remove()" style="padding:10px 20px;margin-top:20px;cursor:pointer;">Schließen</button>
  `;
  document.body.appendChild(container);
  
  console.log('✅ TEST: Sidebar should be visible on the right');
})();
