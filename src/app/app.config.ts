import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { BApiModule } from 'ngx-edu-sharing-b-api';

// Ermittelt die Base-URL der Web Component Scripts für Cross-Origin Einbindung
function getComponentBaseUrl(): string {
  const scripts = document.querySelectorAll('script[src*="main"]');
  for (const script of Array.from(scripts)) {
    const src = script.getAttribute('src');
    if (src && (src.includes('main.js') || src.includes('main.') && src.endsWith('.js'))) {
      const lastSlash = src.lastIndexOf('/');
      if (lastSlash > 0) {
        return src.substring(0, lastSlash + 1);
      }
    }
  }
  return './'; // Fallback für Same-Origin
}

// Translate loader mit dynamischer Base-URL für Cross-Origin Web Component
class AssetTranslateLoader implements TranslateLoader {
  private baseUrl: string;
  
  constructor(private http: HttpClient) {
    this.baseUrl = getComponentBaseUrl();
  }

  getTranslation(lang: string): Observable<any> {
    const url = `${this.baseUrl}assets/i18n/${lang}.json`;
    return this.http.get(url);
  }
}

export function HttpLoaderFactory(http: HttpClient): TranslateLoader {
  return new AssetTranslateLoader(http);
}

/**
 * Application configuration for Web Component mode
 * Used when the app is loaded as a custom element
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideHttpClient(withFetch()),
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient]
        }
      }),
      BApiModule.forRoot({ rootUrl: 'https://repository.staging.openeduhub.net/edu-sharing/rest/bapi' })
    )
  ]
};
