import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { AppModule } from './app/app.module';
import { CanvasViewComponent } from './app/components/canvas-view/canvas-view.component';
import { appConfig } from './app/app.config';

/**
 * Detect if we're running as a Web Component or standalone app
 * Web Component mode: When loaded via script tag (no <app-root> in DOM)
 * Standalone mode: Normal Angular app with <app-root>
 */
const isWebComponentMode = !document.querySelector('app-root');

if (isWebComponentMode) {
  // Web Component Mode: Register as Custom Element
  console.log('🧩 Metadata Agent: Starting in Web Component mode');
  
  createApplication(appConfig)
    .then((appRef) => {
      // Register the custom element
      const MetadataAgentElement = createCustomElement(CanvasViewComponent, {
        injector: appRef.injector
      });
      
      // Only register if not already defined
      if (!customElements.get('metadata-agent-canvas')) {
        customElements.define('metadata-agent-canvas', MetadataAgentElement);
        console.log('✅ Metadata Agent: <metadata-agent-canvas> registered');
      }
    })
    .catch(err => console.error('❌ Metadata Agent: Failed to create application', err));
} else {
  // Standalone Mode: Normal Angular bootstrap
  console.log('🚀 Metadata Agent: Starting in standalone mode');
  
  platformBrowserDynamic().bootstrapModule(AppModule)
    .catch(err => console.error(err));
}
